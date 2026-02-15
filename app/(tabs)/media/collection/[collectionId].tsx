/**
 * Collection Detail Screen
 * Shows all videos in a collection from The Couch
 */

import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  formatDuration,
  getCollection,
  getTypeLabel,
  type MediaCollection,
  type MediaVideo,
} from '@/lib/api/couch';
import { useThemeContext } from '@/lib/providers/ThemeProvider';

const YELLOW = '#FCF150';
const _DARK = '#1a1a1a';

export default function CollectionDetailScreen() {
  const { collectionId } = useLocalSearchParams<{ collectionId: string }>();
  const { theme, colors } = useThemeContext();

  const [collection, setCollection] = useState<MediaCollection | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!collectionId) return;

    try {
      const data = await getCollection(collectionId);
      setCollection(data);
    } catch (_error) {
    } finally {
      setLoading(false);
    }
  }, [collectionId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  if (!collection) {
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
          <Ionicons name="folder-outline" size={64} color={theme.textSecondary} />
          <Text style={[styles.errorText, { color: theme.text }]}>Collection not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <FlatList
        data={collection.videos || []}
        keyExtractor={(item) => item._id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            {/* Header */}
            <View style={styles.header}>
              <Pressable
                style={[styles.backButton, { backgroundColor: theme.surface }]}
                onPress={() => router.back()}
              >
                <Ionicons name="arrow-back" size={24} color={theme.text} />
              </Pressable>
            </View>

            {/* Collection Info */}
            <View style={styles.collectionInfo}>
              {collection.coverImage ? (
                <Image
                  source={{ uri: collection.coverImage }}
                  style={styles.coverImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.coverPlaceholder, { backgroundColor: theme.surface }]}>
                  <Ionicons name="film-outline" size={48} color={theme.textSecondary} />
                </View>
              )}
              <Text style={[styles.collectionTitle, { color: theme.text }]}>{collection.name}</Text>
              {collection.description && (
                <Text style={[styles.collectionDescription, { color: theme.textSecondary }]}>
                  {collection.description}
                </Text>
              )}
              <Text style={[styles.videoCount, { color: theme.textSecondary }]}>
                {collection.videos?.length || 0} videos
              </Text>
            </View>

            {/* Videos Header */}
            <View style={styles.videosHeader}>
              <Text style={[styles.videosHeaderText, { color: theme.text }]}>Videos</Text>
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="film-outline" size={48} color={theme.textSecondary} />
            <Text style={[styles.emptyText, { color: theme.text }]}>
              No videos in this collection
            </Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => <VideoListItem video={item} theme={theme} colors={colors} />}
      />
    </SafeAreaView>
  );
}

interface VideoListItemProps {
  video: MediaVideo;
  theme: any;
  colors: any;
}

function VideoListItem({ video, theme, colors }: VideoListItemProps) {
  return (
    <Pressable
      style={[styles.videoItem, { backgroundColor: theme.surface }]}
      onPress={() => router.push(`/(tabs)/media/video/${video._id}`)}
    >
      {/* Thumbnail */}
      <View style={styles.thumbnailContainer}>
        {video.thumbnails?.medium || video.thumbnails?.small ? (
          <Image
            source={{ uri: video.thumbnails.medium || video.thumbnails.small }}
            style={styles.videoThumbnail}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.thumbnailPlaceholder, { backgroundColor: theme.surfaceElevated }]}>
            <Ionicons name="film-outline" size={24} color={theme.textSecondary} />
          </View>
        )}
        <View style={styles.playIcon}>
          <Ionicons name="play" size={20} color="#fff" />
        </View>
        {video.duration && (
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>{formatDuration(video.duration)}</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.videoInfo}>
        <Text style={[styles.videoTitle, { color: theme.text }]} numberOfLines={2}>
          {video.title}
        </Text>
        <View style={styles.videoMeta}>
          <Text style={[styles.videoMetaText, { color: theme.textSecondary }]}>
            {getTypeLabel(video.type)}
          </Text>
          {video.avgRating !== undefined && video.avgRating > 0 && (
            <View style={styles.ratingDisplay}>
              <Ionicons name="star" size={12} color={YELLOW} />
              <Text style={[styles.ratingText, { color: theme.textSecondary }]}>
                {video.avgRating.toFixed(1)}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Chevron */}
      <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
    </Pressable>
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
  listContent: {
    paddingBottom: 40,
  },
  collectionInfo: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  coverImage: {
    width: 160,
    height: 160,
    borderRadius: 16,
    marginBottom: 16,
  },
  coverPlaceholder: {
    width: 160,
    height: 160,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  collectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  collectionDescription: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  videoCount: {
    fontSize: 14,
  },
  videosHeader: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  videosHeaderText: {
    fontSize: 18,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
  },
  separator: {
    height: 8,
  },
  videoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    padding: 12,
    borderRadius: 12,
  },
  thumbnailContainer: {
    position: 'relative',
    width: 120,
    height: 68,
    borderRadius: 8,
    overflow: 'hidden',
  },
  videoThumbnail: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 2,
  },
  durationText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  videoInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  videoTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  videoMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  videoMetaText: {
    fontSize: 12,
  },
  ratingDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingText: {
    fontSize: 12,
  },
});
