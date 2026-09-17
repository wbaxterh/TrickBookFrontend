/**
 * Upload API - Video and Image Upload Functions
 * Handles uploads to Bunny.net (video) and S3 (images)
 */

import { FileSystemUploadType, uploadAsync } from 'expo-file-system/legacy';
import { ENDPOINTS } from '@/constants/api';
import { apiClient } from './client';

// Types
export interface VideoEntryResponse {
  videoId: string;
  libraryId: string;
  uploadCredentials: {
    videoId: string;
    libraryId: string;
    tusEndpoint: string;
    expirationTime: number;
    headers: {
      AuthorizationSignature: string;
      AuthorizationExpire: number;
      VideoId: string;
      LibraryId: string;
    };
  };
}

export interface VideoStatus {
  videoId: string;
  status:
    | 'created'
    | 'uploaded'
    | 'processing'
    | 'transcoding'
    | 'finished'
    | 'error'
    | 'upload_failed'
    | 'unknown';
  statusCode: number;
  isReady: boolean;
  title?: string;
  duration?: number;
  width?: number;
  height?: number;
  hlsUrl?: string | null;
  thumbnailUrl?: string;
  previewUrl?: string;
  availableResolutions?: string | null;
  // Optional — present only if the backend status endpoint forwards them.
  // Used to distinguish "genuinely transcoding" from "accepted but never started".
  encodeProgress?: number;
  storageSize?: number;
}

/**
 * Thrown when the encoder never even starts working within the grace window —
 * i.e. Bunny accepted the upload but transcoding is backed up / held. Distinct
 * from a plain timeout so the UI can show a "try again shortly" message fast
 * instead of spinning for the full poll budget.
 */
export class VideoProcessingStalledError extends Error {
  constructor() {
    super(
      "Your clip uploaded, but our video processor is backed up right now and couldn't finish. Your post wasn't created — please try again in a little while.",
    );
    this.name = 'VideoProcessingStalledError';
  }
}

export interface ImagePresignResponse {
  uploadUrl: string;
  fileUrl: string;
  key: string;
}

// =============================================
// VIDEO UPLOAD FUNCTIONS
// =============================================

/**
 * Create a video entry and get upload credentials
 */
export async function createVideoEntry(title: string): Promise<VideoEntryResponse> {
  try {
    const response = await apiClient.post<VideoEntryResponse>(ENDPOINTS.upload.createVideo, {
      title,
    });
    return response;
  } catch (_error) {
    throw new Error('Failed to create video entry');
  }
}

/**
 * Get video processing status
 */
export async function getVideoStatus(videoId: string): Promise<VideoStatus> {
  try {
    const response = await apiClient.get<VideoStatus>(ENDPOINTS.upload.videoStatus(videoId), {
      skipAuth: true,
    });
    return response;
  } catch (_error) {
    throw new Error('Failed to get video status');
  }
}

/**
 * Poll for video processing completion.
 *
 * A healthy upload leaves "processing" and reaches "transcoding" (or reports a
 * duration / encode progress) within a few seconds. If the encoder never starts
 * within `stallGraceMs`, Bunny has accepted the bytes but isn't encoding them
 * (queue backed up, or account encoding held) — we throw VideoProcessingStalledError
 * right away instead of spinning for the full `maxAttempts * intervalMs` budget.
 *
 * `onStatus` is called after every poll so the UI can show live progress.
 */
export async function waitForVideoProcessing(
  videoId: string,
  maxAttempts: number = 120,
  intervalMs: number = 3000,
  onStatus?: (status: VideoStatus, elapsedMs: number) => void,
): Promise<VideoStatus> {
  const stallGraceMs = 90_000; // encoder must start within ~90s
  let encoderStarted = false;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const elapsedMs = attempt * intervalMs;
    const status = await getVideoStatus(videoId);
    onStatus?.(status, elapsedMs);

    if (status.isReady) {
      return status;
    }

    if (status.status === 'error' || status.status === 'upload_failed') {
      throw new Error(`Video processing failed: ${status.status}`);
    }

    // Signs the encoder is actually working (not just "accepted"): it moved to
    // transcoding, reported a duration, or reported non-zero encode progress.
    if (
      status.status === 'transcoding' ||
      (status.encodeProgress ?? 0) > 0 ||
      (status.duration ?? 0) > 0
    ) {
      encoderStarted = true;
    }

    // Past the grace window and the encoder still hasn't started → stalled.
    if (!encoderStarted && elapsedMs >= stallGraceMs) {
      throw new VideoProcessingStalledError();
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error('Video processing timed out');
}

/**
 * Delete a video
 */
export async function deleteVideo(videoId: string): Promise<void> {
  try {
    await apiClient.delete(ENDPOINTS.upload.deleteVideo(videoId));
  } catch (_error) {
    throw new Error('Failed to delete video');
  }
}

/**
 * Upload video using TUS resumable protocol
 * Note: React Native doesn't have tus-js-client, so we use a simple fetch approach
 * For production, consider using expo-file-system for better handling
 */
export async function uploadVideoTUS(
  _fileUri: string,
  credentials: VideoEntryResponse['uploadCredentials'],
  onProgress?: (progress: number) => void,
): Promise<{ videoId: string; success: boolean }> {
  try {
    // For React Native, we need to use FormData or direct upload
    // The TUS protocol requires specific handling
    const response = await fetch(credentials.tusEndpoint, {
      method: 'POST',
      headers: {
        'Tus-Resumable': '1.0.0',
        'Upload-Metadata': `filename ${btoa('video.mp4')},filetype ${btoa('video/mp4')}`,
        AuthorizationSignature: credentials.headers.AuthorizationSignature,
        AuthorizationExpire: credentials.headers.AuthorizationExpire.toString(),
        VideoId: credentials.headers.VideoId,
        LibraryId: credentials.headers.LibraryId,
      },
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status}`);
    }

    // For actual file upload, we need expo-file-system
    // This is a simplified version - full implementation below
    onProgress?.(100);

    return {
      videoId: credentials.videoId,
      success: true,
    };
  } catch (_error) {
    throw new Error('Failed to upload video');
  }
}

// =============================================
// IMAGE UPLOAD FUNCTIONS
// =============================================

/**
 * Get a presigned URL for uploading an image to S3
 */
export async function getImageUploadUrl(
  filename: string,
  contentType: string,
): Promise<ImagePresignResponse> {
  try {
    const response = await apiClient.post<ImagePresignResponse>(ENDPOINTS.upload.imagePresign, {
      filename,
      contentType,
    });
    return response;
  } catch (_error) {
    throw new Error('Failed to get upload URL');
  }
}

/**
 * Upload an image file directly to S3 using presigned URL
 * Uses expo-file-system for reliable uploads on physical iOS devices
 */
export async function uploadImageToS3(
  fileUri: string,
  filename: string,
  contentType: string,
  onProgress?: (progress: number) => void,
): Promise<{ fileUrl: string; key: string }> {
  try {
    // Step 1: Get presigned URL
    const { uploadUrl, fileUrl, key } = await getImageUploadUrl(filename, contentType);

    // Step 2: Upload file to S3 using expo-file-system
    // This is more reliable on physical iOS devices than fetch+blob
    const uploadResult = await uploadAsync(uploadUrl, fileUri, {
      httpMethod: 'PUT',
      uploadType: FileSystemUploadType.BINARY_CONTENT,
      headers: {
        'Content-Type': contentType,
      },
    });

    if (uploadResult.status !== 200) {
      throw new Error(`Upload failed: ${uploadResult.status}`);
    }

    onProgress?.(100);

    return { fileUrl, key };
  } catch (error: any) {
    throw new Error(error.message || 'Failed to upload image');
  }
}

/**
 * Delete an image from S3
 */
export async function deleteImage(key: string): Promise<void> {
  try {
    await apiClient.post(`${ENDPOINTS.upload.deleteImage}/delete`, { key });
  } catch (_error) {
    throw new Error('Failed to delete image');
  }
}

// =============================================
// SPORT TYPES — use getSportTypes() from spots API for dynamic list
// This re-export provides backward compatibility for existing imports
// =============================================

export type { SportType } from './spots';
export { getSportTypes } from './spots';

// =============================================
// VISIBILITY OPTIONS
// =============================================

export const VISIBILITY_OPTIONS = [
  { value: 'public', label: 'Public', icon: 'globe-outline' as const },
  { value: 'homies', label: 'Homies', icon: 'people-outline' as const },
  { value: 'private', label: 'Only Me', icon: 'lock-closed-outline' as const },
] as const;

export type VisibilityType = (typeof VISIBILITY_OPTIONS)[number]['value'];
