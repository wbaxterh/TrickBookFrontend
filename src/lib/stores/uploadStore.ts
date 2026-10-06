/**
 * Background upload store.
 *
 * The Feed upload pipeline (Bunny TUS video upload / S3 image upload →
 * processing → post creation) runs here instead of inside the upload screen, so
 * the user can hit "Share", get sent straight to the Feed, and keep browsing
 * while the clip finishes in the background. On completion we fire a local
 * notification and hand the created post to the Feed to prepend optimistically.
 *
 * v1 continues while the app is foregrounded; a full app-suspended background
 * upload (iOS background URLSession) is a fast-follow.
 */

import { FileSystemUploadType, getInfoAsync, uploadAsync } from 'expo-file-system/legacy';
import * as Notifications from 'expo-notifications';
import { create } from 'zustand';
import { track } from '@/lib/analytics';
import { postCreatedProperties } from '@/lib/analytics/properties';
import { type CreatePostData, createPost, type FeedPost } from '@/lib/api/feed';
import {
  createVideoEntry,
  deleteVideo,
  uploadImageToS3,
  VideoProcessingStalledError,
  waitForVideoProcessing,
} from '@/lib/api/upload';

export type UploadPhase = 'uploading' | 'processing' | 'creating' | 'done' | 'failed';

/** Everything the pipeline needs — captured from the upload screen at "Share". */
export interface UploadJobInput {
  mediaType: 'video' | 'image';
  fileUri: string;
  fileSize?: number;
  width?: number;
  height?: number;
  caption: string;
  sportTypes: string[];
  tricks: string[];
  visibility: 'public' | 'homies' | 'private';
  spotId?: string;
}

export interface UploadJob {
  id: string;
  input: UploadJobInput;
  phase: UploadPhase;
  progress: number; // 0-100 during the upload phase
  statusText: string;
  post?: FeedPost; // set when phase === 'done'
  error?: string; // set when phase === 'failed'
}

interface UploadStoreState {
  job: UploadJob | null;
  /** Kick off a background upload (fire-and-forget). Replaces any prior job. */
  startUpload: (input: UploadJobInput) => void;
  /** Retry a failed job with the same input. */
  retry: () => void;
  /** Clear the current job (e.g. after the Feed has consumed a completed post). */
  dismiss: () => void;
}

async function notify(title: string, body: string) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data: { type: 'feed_upload' } },
      trigger: null, // immediate
    });
  } catch {
    // No permission / not a device — silently skip.
  }
}

let jobCounter = 0;

export const useUploadStore = create<UploadStoreState>((set, get) => {
  const patch = (updates: Partial<UploadJob>) => {
    const cur = get().job;
    if (cur) set({ job: { ...cur, ...updates } });
  };

  const runVideo = async (input: UploadJobInput) => {
    patch({ phase: 'uploading', progress: 0, statusText: 'Uploading video…' });

    const info = await getInfoAsync(input.fileUri);
    if (!info.exists) throw new Error('Video file not found');
    const fileSize = info.size || input.fileSize || 0;
    if (fileSize === 0) throw new Error('Could not determine video file size');

    const title = input.caption.slice(0, 50) || `Video ${Date.now()}`;
    const entry = await createVideoEntry(title);

    const isMov = input.fileUri.toLowerCase().includes('.mov');
    const mimeType = isMov ? 'video/quicktime' : 'video/mp4';
    const fileName = isMov ? 'video.mov' : 'video.mp4';
    const h = entry.uploadCredentials.headers;

    // TUS: create the upload session, then PATCH the file.
    const createRes = await fetch(entry.uploadCredentials.tusEndpoint, {
      method: 'POST',
      headers: {
        'Tus-Resumable': '1.0.0',
        'Upload-Length': String(fileSize),
        'Upload-Metadata': `filename ${btoa(fileName)},filetype ${btoa(mimeType)}`,
        AuthorizationSignature: h.AuthorizationSignature,
        AuthorizationExpire: String(h.AuthorizationExpire),
        VideoId: h.VideoId,
        LibraryId: h.LibraryId,
      },
    });
    if (!createRes.ok) throw new Error('Failed to initiate upload');
    const location = createRes.headers.get('Location');
    if (!location) throw new Error('No upload URL received');
    let uploadUrl = location;
    if (location.startsWith('/')) {
      const tusUrl = new URL(entry.uploadCredentials.tusEndpoint);
      uploadUrl = `${tusUrl.protocol}//${tusUrl.host}${location}`;
    }

    patch({ progress: 10, statusText: 'Uploading video…' });
    const uploadRes = await uploadAsync(uploadUrl, input.fileUri, {
      httpMethod: 'PATCH',
      uploadType: FileSystemUploadType.BINARY_CONTENT,
      headers: {
        'Tus-Resumable': '1.0.0',
        'Upload-Offset': '0',
        'Content-Type': 'application/offset+octet-stream',
        AuthorizationSignature: h.AuthorizationSignature,
        AuthorizationExpire: String(h.AuthorizationExpire),
        VideoId: h.VideoId,
        LibraryId: h.LibraryId,
      },
    });
    if (uploadRes.status !== 204 && uploadRes.status !== 200) {
      throw new Error('Failed to upload video data');
    }
    patch({ progress: 100, phase: 'processing', statusText: 'Processing…' });

    let processed: Awaited<ReturnType<typeof waitForVideoProcessing>>;
    try {
      processed = await waitForVideoProcessing(entry.videoId, 120, 3000, (status) => {
        if (status.encodeProgress && status.encodeProgress > 0) {
          patch({ statusText: `Processing… ${status.encodeProgress}%` });
        }
      });
    } catch (err) {
      if (err instanceof VideoProcessingStalledError) deleteVideo(entry.videoId).catch(() => {});
      throw err;
    }

    patch({ phase: 'creating', statusText: 'Posting…' });
    const aspectRatio =
      input.width && input.height ? (input.width > input.height ? '16:9' : '9:16') : '9:16';
    const postData: CreatePostData = {
      mediaType: 'video',
      bunnyVideoId: entry.videoId,
      hlsUrl: processed.hlsUrl || undefined,
      thumbnailUrl: processed.thumbnailUrl,
      caption: input.caption,
      sportTypes: input.sportTypes,
      tricks: input.tricks,
      visibility: input.visibility,
      duration: processed.duration,
      aspectRatio,
      spotId: input.spotId,
    };
    const post = await createPost(postData);
    if (!post) throw new Error('Failed to create post');
    track('post_created', postCreatedProperties(post)).catch(() => {});
    return post;
  };

  const runImage = async (input: UploadJobInput) => {
    patch({ phase: 'uploading', progress: 0, statusText: 'Uploading photo…' });
    const isPng = input.fileUri.toLowerCase().includes('.png');
    const isHeic = input.fileUri.toLowerCase().includes('.heic');
    const filename = `feed-${Date.now()}.${isPng ? 'png' : 'jpg'}`;
    const contentType = isPng ? 'image/png' : isHeic ? 'image/heic' : 'image/jpeg';
    const { fileUrl } = await uploadImageToS3(input.fileUri, filename, contentType, (p) =>
      patch({ progress: p }),
    );
    patch({ phase: 'creating', progress: 100, statusText: 'Posting…' });
    const post = await createPost({
      mediaType: 'image',
      imageUrls: [fileUrl],
      thumbnailUrl: fileUrl,
      caption: input.caption,
      sportTypes: input.sportTypes,
      tricks: input.tricks,
      visibility: input.visibility,
      spotId: input.spotId,
    });
    if (!post) throw new Error('Failed to create post');
    track('post_created', postCreatedProperties(post)).catch(() => {});
    return post;
  };

  const run = async (input: UploadJobInput) => {
    try {
      const post = input.mediaType === 'video' ? await runVideo(input) : await runImage(input);
      patch({ phase: 'done', progress: 100, statusText: 'Posted!', post });
      notify('Your clip is live 🎬', input.caption?.trim() || 'Your post is now on the Feed.');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Upload failed. Please try again in a bit.';
      patch({ phase: 'failed', statusText: 'Upload failed', error: message });
      notify('Upload didn’t finish', message);
    }
  };

  return {
    job: null,
    startUpload: (input) => {
      jobCounter += 1;
      const id = `upl_${jobCounter}`;
      set({ job: { id, input, phase: 'uploading', progress: 0, statusText: 'Starting…' } });
      run(input);
    },
    retry: () => {
      const cur = get().job;
      if (!cur) return;
      set({
        job: { ...cur, phase: 'uploading', progress: 0, statusText: 'Starting…', error: undefined },
      });
      run(cur.input);
    },
    dismiss: () => set({ job: null }),
  };
});
