/**
 * Video Detail Screen
 * Full video player and details for The Couch content
 * Supports HLS (Bunny.net) via expo-video and Google Drive via WebView
 */

import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import {
  type CouchVideo,
  formatDuration,
  getStreamUrl,
  getThumbnailUrl,
  getVideo,
  type StreamUrlResponse,
} from '@/lib/api/couch';
import { useThemeContext } from '@/lib/providers/ThemeProvider';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const YELLOW = '#FCF150';
const DARK = '#1a1a1a';

// Separate component for HLS video player
function HLSVideoPlayer({ url }: { url: string }) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = false;
  });

  useEffect(() => {
    if (player) {
      player.play();
    }
  }, [player]);

  // Lock to landscape when entering fullscreen (Couch videos are always horizontal)
  const handleFullscreenEnter = async () => {
    StatusBar.setHidden(true);
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
  };

  // Unlock orientation when exiting fullscreen
  const handleFullscreenExit = async () => {
    StatusBar.setHidden(false);
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  };

  // Cleanup: ensure orientation is reset when component unmounts
  useEffect(() => {
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      StatusBar.setHidden(false);
    };
  }, []);

  return (
    <VideoView
      player={player}
      style={styles.videoPlayer}
      contentFit="contain"
      nativeControls={true}
      onFullscreenEnter={handleFullscreenEnter}
      onFullscreenExit={handleFullscreenExit}
    />
  );
}

// Separate component for Google Drive video (WebView embed)
function DriveVideoPlayer({ embedUrl }: { embedUrl: string }) {
  return (
    <WebView
      source={{ uri: embedUrl }}
      style={styles.videoPlayer}
      allowsFullscreenVideo={true}
      allowsInlineMediaPlayback={true}
      mediaPlaybackRequiresUserAction={false}
      javaScriptEnabled={true}
    />
  );
}

export default function VideoDetailScreen() {
  const { videoId } = useLocalSearchParams<{ videoId: string }>();
  const { theme, colors } = useThemeContext();

  const [video, setVideo] = useState<CouchVideo | null>(null);
  const [streamData, setStreamData] = useState<StreamUrlResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);

  const fetchData = useCallback(async () => {
    if (!videoId) return;

    try {
      const [videoData, streamResponse] = await Promise.all([
        getVideo(videoId),
        getStreamUrl(videoId),
      ]);
      setVideo(videoData);
      setStreamData(streamResponse);
    } catch (_error) {
    } finally {
      setLoading(false);
    }
  }, [videoId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePlay = () => {
    setIsPlaying(true);
  };

  // Determine which player to use based on stream type
  const hasHLS = streamData?.type === 'hls' && streamData?.hlsUrl;
  const hasDriveEmbed = streamData?.type === 'drive' && streamData?.embedUrl;
  const canPlay = hasHLS || hasDriveEmbed;

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
        edges={['top']}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={YELLOW} />
        </View>
      </SafeAreaView>
    );
  }

  if (!video) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
        edges={['top']}
      >
        <View style={styles.header}>
          <Pressable
            style={[styles.backButton, { backgroundColor: theme.surface }]}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </Pressable>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="film-outline" size={64} color={theme.textSecondary} />
          <Text style={[styles.errorText, { color: theme.text }]}>Video not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const thumbnailUrl = getThumbnailUrl(video);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            style={[styles.backButton, { backgroundColor: theme.surface }]}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </Pressable>
          <Pressable style={[styles.backButton, { backgroundColor: theme.surface }]}>
            <Ionicons name="share-outline" size={22} color={theme.text} />
          </Pressable>
        </View>

        {/* Video Player / Thumbnail */}
        <View style={styles.videoContainer}>
          {isPlaying && hasHLS ? (
            <HLSVideoPlayer url={streamData.hlsUrl!} />
          ) : isPlaying && hasDriveEmbed ? (
            <DriveVideoPlayer embedUrl={streamData.embedUrl!} />
          ) : (
            <Pressable style={styles.thumbnailContainer} onPress={canPlay ? handlePlay : undefined}>
              {thumbnailUrl ? (
                <Image
                  source={{ uri: thumbnailUrl }}
                  style={styles.videoThumbnail}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.videoPlaceholder, { backgroundColor: theme.surface }]}>
                  <Ionicons name="film-outline" size={64} color={theme.textSecondary} />
                </View>
              )}
              {canPlay && (
                <View style={styles.playOverlay}>
                  <View style={[styles.playButton, { backgroundColor: colors.primary }]}>
                    <Ionicons name="play" size={32} color={DARK} />
                  </View>
                </View>
              )}
              {!canPlay && (
                <View style={styles.noVideoOverlay}>
                  <Text style={styles.noVideoText}>Video not available</Text>
                </View>
              )}
              {video.duration && (
                <View style={styles.durationBadge}>
                  <Text style={styles.durationText}>{formatDuration(video.duration)}</Text>
                </View>
              )}
            </Pressable>
          )}
        </View>

        {/* Info Section */}
        <View style={styles.infoSection}>
          <Text style={[styles.title, { color: theme.text }]}>{video.title}</Text>

          <View style={styles.metaRow}>
            {video.releaseYear && (
              <Text style={[styles.metaText, { color: theme.textSecondary }]}>
                {video.releaseYear}
              </Text>
            )}
            {video.sportTypes?.[0] && (
              <View style={[styles.typeBadge, { backgroundColor: theme.surface }]}>
                <Text style={[styles.typeBadgeText, { color: theme.text }]}>
                  {video.sportTypes[0]}
                </Text>
              </View>
            )}
            {video.viewCount !== undefined && video.viewCount > 0 && (
              <View style={styles.viewsDisplay}>
                <Ionicons name="eye-outline" size={14} color={theme.textSecondary} />
                <Text style={[styles.viewsText, { color: theme.textSecondary }]}>
                  {video.viewCount.toLocaleString()} views
                </Text>
              </View>
            )}
          </View>

          {/* Description */}
          {video.description && (
            <Text style={[styles.description, { color: theme.textSecondary }]}>
              {video.description}
            </Text>
          )}

          {/* Sports Tags */}
          {video.sportTypes && video.sportTypes.length > 0 && (
            <View style={styles.tagsRow}>
              {video.sportTypes.map((sport) => (
                <View key={sport} style={[styles.tag, { backgroundColor: theme.surface }]}>
                  <Text style={[styles.tagText, { color: theme.text }]}>{sport}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Tags */}
          {video.tags && video.tags.length > 0 && (
            <View style={styles.tagsRow}>
              {video.tags.map((tag) => (
                <View key={tag} style={[styles.tag, { backgroundColor: theme.surface }]}>
                  <Text style={[styles.tagText, { color: theme.text }]}>#{tag}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Production Info */}
          {video.producedBy && (
            <View style={styles.creditsSection}>
              <Text style={[styles.creditsSectionTitle, { color: theme.textSecondary }]}>
                Produced By
              </Text>
              <Text style={[styles.creditText, { color: theme.text }]}>{video.producedBy}</Text>
            </View>
          )}

          {/* Riders */}
          {video.riders && video.riders.length > 0 && (
            <View style={styles.creditsSection}>
              <Text style={[styles.creditsSectionTitle, { color: theme.textSecondary }]}>
                Riders
              </Text>
              <Text style={[styles.creditText, { color: theme.text }]}>
                {video.riders.join(', ')}
              </Text>
            </View>
          )}

          {/* Sponsors */}
          {video.sponsors && video.sponsors.length > 0 && (
            <View style={styles.creditsSection}>
              <Text style={[styles.creditsSectionTitle, { color: theme.textSecondary }]}>
                Sponsors
              </Text>
              <Text style={[styles.creditText, { color: theme.text }]}>
                {video.sponsors.join(', ')}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoContainer: {
    width: SCREEN_WIDTH,
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
  },
  videoPlayer: {
    width: '100%',
    height: '100%',
  },
  thumbnailContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  videoThumbnail: {
    width: '100%',
    height: '100%',
  },
  videoPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  noVideoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  noVideoText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  durationText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  infoSection: {
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  metaText: {
    fontSize: 14,
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  viewsDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewsText: {
    fontSize: 13,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagText: {
    fontSize: 13,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  creditsSection: {
    marginBottom: 16,
  },
  creditsSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  creditText: {
    fontSize: 14,
  },
  bottomSpacer: {
    height: 40,
  },
});
