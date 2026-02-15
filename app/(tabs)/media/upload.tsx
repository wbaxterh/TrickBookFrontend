/**
 * Upload Screen - Create New Feed Post
 * Allows users to upload videos/images to The Feed
 */

import { Ionicons } from '@expo/vector-icons';
import { ResizeMode, Video } from 'expo-av';
import { FileSystemUploadType, getInfoAsync, uploadAsync } from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type CreatePostData, createPost } from '@/lib/api/feed';
import {
  createVideoEntry,
  SPORT_TYPES,
  uploadImageToS3,
  VISIBILITY_OPTIONS,
  waitForVideoProcessing,
} from '@/lib/api/upload';
import { useThemeContext } from '@/lib/providers/ThemeProvider';
import { useAuthStore } from '@/lib/stores/authStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const YELLOW = '#FCF150';
const DARK = '#1a1a1a';

type UploadStep = 'idle' | 'uploading' | 'processing' | 'creating' | 'done' | 'error';
type MediaType = 'video' | 'image' | null;

export default function UploadScreen() {
  const { theme, colors } = useThemeContext();
  const { user, token } = useAuthStore();

  // Form state
  const [selectedFile, setSelectedFile] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [mediaType, setMediaType] = useState<MediaType>(null);
  const [caption, setCaption] = useState('');
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [tricks, setTricks] = useState<string[]>([]);
  const [trickInput, setTrickInput] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'homies' | 'private'>('public');

  // Upload state
  const [uploadStep, setUploadStep] = useState<UploadStep>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingStatus, setProcessingStatus] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Redirect if not logged in
  useEffect(() => {
    if (!user) {
      router.replace('/login');
    }
  }, [user]);

  const handleSelectMedia = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to your media library.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: false,
        quality: 1,
        videoMaxDuration: 180, // 3 minutes max
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const isVideo = asset.type === 'video';

        // Check file size (rough estimate)
        // Videos: max 500MB, Images: max 10MB
        if (asset.fileSize) {
          const maxSize = isVideo ? 500 * 1024 * 1024 : 10 * 1024 * 1024;
          if (asset.fileSize > maxSize) {
            Alert.alert('File Too Large', `Maximum size: ${isVideo ? '500MB' : '10MB'}`);
            return;
          }
        }

        setSelectedFile(asset);
        setMediaType(isVideo ? 'video' : 'image');
        setError(null);
        setUploadStep('idle');
      }
    } catch (_err) {
      Alert.alert('Error', 'Failed to select media');
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setMediaType(null);
    setUploadStep('idle');
    setUploadProgress(0);
    setError(null);
  };

  const toggleSport = (sportValue: string) => {
    if (selectedSports.includes(sportValue)) {
      setSelectedSports(selectedSports.filter((s) => s !== sportValue));
    } else {
      setSelectedSports([...selectedSports, sportValue]);
    }
  };

  const handleAddTrick = () => {
    const trimmed = trickInput.trim();
    if (trimmed && !tricks.includes(trimmed)) {
      setTricks([...tricks, trimmed]);
      setTrickInput('');
    }
  };

  const handleRemoveTrick = (trick: string) => {
    setTricks(tricks.filter((t) => t !== trick));
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      setError('Please select a video or image to upload');
      return;
    }

    if (selectedSports.length === 0) {
      setError('Please select at least one sport type');
      return;
    }

    setError(null);

    try {
      // Verify file exists before attempting upload
      const fileInfo = await getInfoAsync(selectedFile.uri);
      if (!fileInfo.exists) {
        throw new Error('Selected file no longer exists. Please select again.');
      }

      if (mediaType === 'video') {
        await handleVideoUpload();
      } else {
        await handleImageUpload();
      }
    } catch (err: any) {
      setError(err.message || 'Upload failed. Please try again.');
      setUploadStep('error');
    }
  };

  const handleVideoUpload = async () => {
    if (!selectedFile || !token) return;

    // Step 1: Create video entry
    setUploadStep('uploading');
    setUploadProgress(0);
    setProcessingStatus('Creating video entry...');

    const videoTitle = caption.slice(0, 50) || `Video ${Date.now()}`;
    const videoEntry = await createVideoEntry(videoTitle);

    // Step 2: Upload video using TUS
    setProcessingStatus('Uploading video...');

    // Get actual file info using expo-file-system (more reliable on physical devices)
    const fileInfo = await getInfoAsync(selectedFile.uri);
    if (!fileInfo.exists) {
      throw new Error('Video file not found');
    }

    const fileSize = fileInfo.size || selectedFile.fileSize || 0;
    if (fileSize === 0) {
      throw new Error('Could not determine video file size');
    }

    // Detect MIME type from URI/extension (iPhones often use .mov)
    const isMovFile = selectedFile.uri.toLowerCase().includes('.mov');
    const mimeType = isMovFile ? 'video/quicktime' : 'video/mp4';
    const fileName = isMovFile ? 'video.mov' : 'video.mp4';

    // Upload to Bunny TUS endpoint
    const tusHeaders = videoEntry.uploadCredentials.headers;

    try {
      // First, create the TUS upload session
      const createResponse = await fetch(videoEntry.uploadCredentials.tusEndpoint, {
        method: 'POST',
        headers: {
          'Tus-Resumable': '1.0.0',
          'Upload-Length': fileSize.toString(),
          'Upload-Metadata': `filename ${btoa(fileName)},filetype ${btoa(mimeType)}`,
          AuthorizationSignature: tusHeaders.AuthorizationSignature,
          AuthorizationExpire: tusHeaders.AuthorizationExpire.toString(),
          VideoId: tusHeaders.VideoId,
          LibraryId: tusHeaders.LibraryId,
        },
      });

      if (!createResponse.ok) {
        const _errorText = await createResponse.text();
        throw new Error('Failed to initiate upload');
      }

      const locationHeader = createResponse.headers.get('Location');
      if (!locationHeader) {
        throw new Error('No upload URL received');
      }

      // Construct full upload URL - Location header may be relative
      let uploadUrl = locationHeader;
      if (locationHeader.startsWith('/')) {
        // Extract base URL from TUS endpoint (e.g., https://video.bunnycdn.com)
        const tusUrl = new URL(videoEntry.uploadCredentials.tusEndpoint);
        uploadUrl = `${tusUrl.protocol}//${tusUrl.host}${locationHeader}`;
      }
      setUploadProgress(10);
      setProcessingStatus('Uploading video file...');

      // Use expo-file-system uploadAsync for reliable uploads on physical devices
      // Include auth headers - Bunny.net TUS requires them for PATCH as well
      const uploadResult = await uploadAsync(uploadUrl, selectedFile.uri, {
        httpMethod: 'PATCH',
        uploadType: FileSystemUploadType.BINARY_CONTENT,
        headers: {
          'Tus-Resumable': '1.0.0',
          'Upload-Offset': '0',
          'Content-Type': 'application/offset+octet-stream',
          AuthorizationSignature: tusHeaders.AuthorizationSignature,
          AuthorizationExpire: tusHeaders.AuthorizationExpire.toString(),
          VideoId: tusHeaders.VideoId,
          LibraryId: tusHeaders.LibraryId,
        },
      });

      if (uploadResult.status !== 204 && uploadResult.status !== 200) {
        throw new Error('Failed to upload video data');
      }

      setUploadProgress(100);
    } catch (uploadError: any) {
      throw new Error(uploadError.message || 'Failed to upload video');
    }

    // Step 3: Wait for processing
    setUploadStep('processing');
    setProcessingStatus('Processing video...');

    const processedVideo = await waitForVideoProcessing(videoEntry.videoId, 120, 3000);

    // Step 4: Create feed post
    setUploadStep('creating');
    setProcessingStatus('Creating post...');

    const aspectRatio =
      selectedFile.width && selectedFile.height
        ? selectedFile.width > selectedFile.height
          ? '16:9'
          : '9:16'
        : '9:16';

    const postData: CreatePostData = {
      mediaType: 'video',
      bunnyVideoId: videoEntry.videoId,
      hlsUrl: processedVideo.hlsUrl || undefined,
      thumbnailUrl: processedVideo.thumbnailUrl,
      caption,
      sportTypes: selectedSports,
      tricks,
      visibility,
      duration: processedVideo.duration,
      aspectRatio,
    };

    const post = await createPost(postData);

    if (!post) {
      throw new Error('Failed to create post');
    }

    setUploadStep('done');
    setProcessingStatus('Post created!');

    // Redirect after short delay
    setTimeout(() => {
      router.replace('/(tabs)/media?tab=feed');
    }, 1500);
  };

  const handleImageUpload = async () => {
    if (!selectedFile || !token) return;

    // Step 1: Upload image to S3
    setUploadStep('uploading');
    setUploadProgress(0);
    setProcessingStatus('Uploading image...');

    // Detect image type from URI
    const isPng = selectedFile.uri.toLowerCase().includes('.png');
    const isHeic = selectedFile.uri.toLowerCase().includes('.heic');
    const filename = `feed-${Date.now()}.${isPng ? 'png' : 'jpg'}`;
    const contentType = isPng ? 'image/png' : isHeic ? 'image/heic' : 'image/jpeg';

    const { fileUrl } = await uploadImageToS3(selectedFile.uri, filename, contentType, (progress) =>
      setUploadProgress(progress),
    );

    // Step 2: Create feed post
    setUploadStep('creating');
    setProcessingStatus('Creating post...');

    const postData: CreatePostData = {
      mediaType: 'image',
      imageUrls: [fileUrl],
      thumbnailUrl: fileUrl,
      caption,
      sportTypes: selectedSports,
      tricks,
      visibility,
    };

    const post = await createPost(postData);

    if (!post) {
      throw new Error('Failed to create post');
    }

    setUploadStep('done');
    setProcessingStatus('Post created!');

    setTimeout(() => {
      router.replace('/(tabs)/media?tab=feed');
    }, 1500);
  };

  const isUploading = uploadStep !== 'idle' && uploadStep !== 'error';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            style={[styles.headerButton, { backgroundColor: theme.surface }]}
            onPress={() => router.back()}
            disabled={isUploading}
          >
            <Ionicons name="close" size={24} color={theme.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.text }]}>New Post</Text>
          <View style={styles.headerButton} />
        </View>

        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Media Selection / Preview */}
          {!selectedFile ? (
            <Pressable
              style={[styles.uploadArea, { backgroundColor: theme.surface }]}
              onPress={handleSelectMedia}
            >
              <Ionicons name="cloud-upload-outline" size={64} color={colors.primary} />
              <Text style={[styles.uploadTitle, { color: theme.text }]}>Upload your clip</Text>
              <Text style={[styles.uploadSubtitle, { color: theme.textSecondary }]}>
                Video (max 3 min, 500MB) or Image (max 10MB)
              </Text>
              <View style={styles.formatRow}>
                <View style={styles.formatItem}>
                  <Ionicons name="videocam" size={16} color={theme.textSecondary} />
                  <Text style={[styles.formatText, { color: theme.textSecondary }]}>MP4, MOV</Text>
                </View>
                <View style={styles.formatItem}>
                  <Ionicons name="image" size={16} color={theme.textSecondary} />
                  <Text style={[styles.formatText, { color: theme.textSecondary }]}>JPG, PNG</Text>
                </View>
              </View>
              <View style={[styles.selectButton, { backgroundColor: colors.primary }]}>
                <Ionicons name="add" size={20} color={DARK} />
                <Text style={styles.selectButtonText}>Select Media</Text>
              </View>
            </Pressable>
          ) : (
            <View style={styles.previewContainer}>
              {mediaType === 'video' ? (
                <Video
                  source={{ uri: selectedFile.uri }}
                  style={styles.preview}
                  useNativeControls
                  resizeMode={ResizeMode.CONTAIN}
                  isLooping
                />
              ) : (
                <Image
                  source={{ uri: selectedFile.uri }}
                  style={styles.preview}
                  resizeMode="contain"
                />
              )}
              {uploadStep === 'idle' && (
                <Pressable style={styles.clearButton} onPress={clearFile}>
                  <Ionicons name="close" size={20} color="#fff" />
                </Pressable>
              )}
            </View>
          )}

          {/* Caption */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Caption</Text>
            <TextInput
              style={[styles.captionInput, { backgroundColor: theme.surface, color: theme.text }]}
              placeholder="What trick is this? Add some context..."
              placeholderTextColor={theme.textSecondary}
              value={caption}
              onChangeText={setCaption}
              multiline
              maxLength={500}
              editable={!isUploading}
            />
            <Text style={[styles.charCount, { color: theme.textSecondary }]}>
              {caption.length}/500
            </Text>
          </View>

          {/* Sport Types */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Sport Type <Text style={{ color: '#ef4444' }}>*</Text>
            </Text>
            <View style={styles.chipContainer}>
              {SPORT_TYPES.map((sport) => (
                <Pressable
                  key={sport.value}
                  style={[
                    styles.chip,
                    { backgroundColor: theme.surface },
                    selectedSports.includes(sport.value) && styles.chipSelected,
                  ]}
                  onPress={() => toggleSport(sport.value)}
                  disabled={isUploading}
                >
                  {selectedSports.includes(sport.value) && (
                    <Ionicons name="checkmark" size={14} color={DARK} style={{ marginRight: 4 }} />
                  )}
                  <Text
                    style={[
                      styles.chipText,
                      { color: theme.text },
                      selectedSports.includes(sport.value) && styles.chipTextSelected,
                    ]}
                  >
                    {sport.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Tag Tricks */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Tag Tricks</Text>
            <View style={styles.trickInputRow}>
              <TextInput
                style={[styles.trickInput, { backgroundColor: theme.surface, color: theme.text }]}
                placeholder="e.g., Kickflip, Backside 360"
                placeholderTextColor={theme.textSecondary}
                value={trickInput}
                onChangeText={setTrickInput}
                onSubmitEditing={handleAddTrick}
                returnKeyType="done"
                editable={!isUploading}
              />
              <Pressable
                style={[styles.addTrickButton, { backgroundColor: theme.surface }]}
                onPress={handleAddTrick}
                disabled={isUploading}
              >
                <Ionicons name="add" size={24} color={theme.text} />
              </Pressable>
            </View>
            {tricks.length > 0 && (
              <View style={styles.tricksContainer}>
                {tricks.map((trick) => (
                  <View key={trick} style={styles.trickTag}>
                    <Text style={styles.trickTagText}>{trick}</Text>
                    {!isUploading && (
                      <Pressable onPress={() => handleRemoveTrick(trick)}>
                        <Ionicons name="close" size={14} color={YELLOW} />
                      </Pressable>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Visibility */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Who can see this?</Text>
            <View style={styles.visibilityContainer}>
              {VISIBILITY_OPTIONS.map((option) => (
                <Pressable
                  key={option.value}
                  style={[
                    styles.visibilityOption,
                    { backgroundColor: theme.surface },
                    visibility === option.value && styles.visibilitySelected,
                  ]}
                  onPress={() => setVisibility(option.value as typeof visibility)}
                  disabled={isUploading}
                >
                  <Ionicons
                    name={option.icon}
                    size={24}
                    color={visibility === option.value ? YELLOW : theme.textSecondary}
                  />
                  <Text
                    style={[
                      styles.visibilityText,
                      { color: theme.text },
                      visibility === option.value && styles.visibilityTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Error Message */}
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Upload Progress */}
          {isUploading && (
            <View style={[styles.progressContainer, { backgroundColor: theme.surface }]}>
              <View style={styles.progressHeader}>
                {uploadStep === 'done' ? (
                  <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
                ) : (
                  <ActivityIndicator size="small" color={YELLOW} />
                )}
                <Text style={[styles.progressText, { color: theme.text }]}>{processingStatus}</Text>
              </View>

              {(uploadStep === 'uploading' || uploadStep === 'processing') && (
                <View style={styles.progressBarContainer}>
                  <View
                    style={[
                      styles.progressBar,
                      {
                        width: uploadStep === 'processing' ? '100%' : `${uploadProgress}%`,
                        opacity: uploadStep === 'processing' ? 0.5 : 1,
                      },
                    ]}
                  />
                </View>
              )}

              {uploadStep === 'done' && (
                <Text style={styles.successText}>Redirecting to feed...</Text>
              )}
            </View>
          )}

          {/* Submit Button */}
          <Pressable
            style={[
              styles.submitButton,
              { backgroundColor: colors.primary },
              (isUploading || !selectedFile) && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={isUploading || !selectedFile}
          >
            {isUploading ? (
              <>
                <ActivityIndicator size="small" color={DARK} />
                <Text style={styles.submitButtonText}>
                  {uploadStep === 'done' ? 'Done!' : 'Uploading...'}
                </Text>
              </>
            ) : (
              <Text style={styles.submitButtonText}>Share Post</Text>
            )}
          </Pressable>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  uploadArea: {
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.2)',
  },
  uploadTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  uploadSubtitle: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  formatRow: {
    flexDirection: 'row',
    gap: 24,
    marginTop: 16,
  },
  formatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  formatText: {
    fontSize: 13,
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  selectButtonText: {
    color: DARK,
    fontSize: 16,
    fontWeight: '600',
  },
  previewContainer: {
    width: '100%',
    aspectRatio: 9 / 16,
    maxHeight: 400,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  preview: {
    width: '100%',
    height: '100%',
  },
  clearButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  captionInput: {
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  chipSelected: {
    backgroundColor: YELLOW,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  chipTextSelected: {
    color: DARK,
  },
  trickInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  trickInput: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
  },
  addTrickButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tricksContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  trickTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: `${YELLOW}30`,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  trickTagText: {
    color: YELLOW,
    fontSize: 14,
    fontWeight: '500',
  },
  visibilityContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  visibilityOption: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  visibilitySelected: {
    borderWidth: 2,
    borderColor: YELLOW,
    backgroundColor: `${YELLOW}15`,
  },
  visibilityText: {
    fontSize: 13,
    fontWeight: '500',
  },
  visibilityTextSelected: {
    color: YELLOW,
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
  },
  progressContainer: {
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '500',
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: YELLOW,
    borderRadius: 3,
  },
  successText: {
    color: '#22c55e',
    fontSize: 13,
    marginTop: 8,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 24,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: DARK,
    fontSize: 16,
    fontWeight: '600',
  },
});
