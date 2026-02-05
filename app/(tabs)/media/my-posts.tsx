/**
 * My Posts Screen
 * Shows the user's own posts with edit/delete functionality
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  Image,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeContext } from '@/lib/providers/ThemeProvider';
import { useAuthStore } from '@/lib/stores/authStore';
import { getUserPosts, deletePost, FeedPost, formatTimeAgo, formatCount } from '@/lib/api/feed';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = 2;
const NUM_COLUMNS = 3;
const ITEM_SIZE = (SCREEN_WIDTH - GRID_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

const YELLOW = '#FCF150';
const DARK = '#1a1a1a';

export default function MyPostsScreen() {
  const { theme, colors } = useThemeContext();
  const { user } = useAuthStore();

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [selectedPost, setSelectedPost] = useState<FeedPost | null>(null);
  const [showActionSheet, setShowActionSheet] = useState(false);

  const fetchPosts = useCallback(async (pageNum: number = 1, refresh: boolean = false) => {
    if (!user?.id) return;

    try {
      const response = await getUserPosts(user.id, { page: pageNum, limit: 30 });

      if (refresh || pageNum === 1) {
        setPosts(response.posts);
      } else {
        setPosts((prev) => [...prev, ...response.posts]);
      }
      setHasMore(response.pagination.hasMore ?? response.posts.length === 30);
      setPage(pageNum);
    } catch (error) {
      console.error('Error fetching user posts:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchPosts(1, true);
  }, [fetchPosts]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPosts(1, true);
    setRefreshing(false);
  }, [fetchPosts]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      fetchPosts(page + 1);
    }
  }, [loading, hasMore, page, fetchPosts]);

  const handlePostPress = (post: FeedPost) => {
    setSelectedPost(post);
    setShowActionSheet(true);
  };

  const handleDelete = async () => {
    if (!selectedPost) return;

    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await deletePost(selectedPost._id);
            if (success) {
              setPosts((prev) => prev.filter((p) => p._id !== selectedPost._id));
              setShowActionSheet(false);
              setSelectedPost(null);
            } else {
              Alert.alert('Error', 'Failed to delete post');
            }
          },
        },
      ]
    );
  };

  const handleEdit = () => {
    if (!selectedPost) return;
    setShowActionSheet(false);
    router.push(`/(tabs)/media/edit-post/${selectedPost._id}`);
  };

  const handleViewPost = () => {
    if (!selectedPost) return;
    setShowActionSheet(false);
    router.push(`/(tabs)/media/post/${selectedPost._id}`);
  };

  const renderPost = ({ item }: { item: FeedPost }) => {
    const isVideo = item.mediaType === 'video';
    const thumbnailUrl = item.thumbnailUrl || item.imageUrls?.[0];

    return (
      <Pressable
        style={styles.gridItem}
        onPress={() => handlePostPress(item)}
      >
        {thumbnailUrl ? (
          <Image
            source={{ uri: thumbnailUrl }}
            style={styles.gridImage}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.gridImage, styles.gridPlaceholder]}>
            <Ionicons
              name={isVideo ? 'videocam' : 'image'}
              size={24}
              color="rgba(255,255,255,0.5)"
            />
          </View>
        )}

        {/* Video indicator */}
        {isVideo && (
          <View style={styles.videoIndicator}>
            <Ionicons name="play" size={12} color="#fff" />
          </View>
        )}

        {/* Stats overlay */}
        <View style={styles.statsOverlay}>
          <View style={styles.statItem}>
            <Ionicons name="heart" size={12} color="#fff" />
            <Text style={styles.statText}>{formatCount(item.stats.loveCount)}</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="chatbubble" size={12} color="#fff" />
            <Text style={styles.statText}>{formatCount(item.stats.commentCount)}</Text>
          </View>
        </View>
      </Pressable>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
        <View style={styles.header}>
          <Pressable
            style={[styles.backButton, { backgroundColor: theme.surface }]}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.text }]}>My Posts</Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={YELLOW} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={[styles.backButton, { backgroundColor: theme.surface }]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>My Posts</Text>
        <Pressable
          style={[styles.backButton, { backgroundColor: theme.surface }]}
          onPress={() => router.push('/(tabs)/media/upload')}
        >
          <Ionicons name="add" size={24} color={theme.text} />
        </Pressable>
      </View>

      {/* Stats summary */}
      <View style={[styles.statsBar, { backgroundColor: theme.surface }]}>
        <Text style={[styles.statsText, { color: theme.text }]}>
          {posts.length} {posts.length === 1 ? 'post' : 'posts'}
        </Text>
      </View>

      {posts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="images-outline" size={64} color={theme.textSecondary} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No posts yet</Text>
          <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
            Share your first clip with the community!
          </Text>
          <Pressable
            style={[styles.createButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/(tabs)/media/upload')}
          >
            <Ionicons name="add" size={20} color={DARK} />
            <Text style={styles.createButtonText}>Create Post</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item._id}
          numColumns={NUM_COLUMNS}
          renderItem={renderPost}
          contentContainerStyle={styles.gridContent}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={YELLOW} />
          }
        />
      )}

      {/* Action Sheet Modal */}
      {showActionSheet && selectedPost && (
        <Pressable
          style={styles.actionSheetOverlay}
          onPress={() => {
            setShowActionSheet(false);
            setSelectedPost(null);
          }}
        >
          <Pressable
            style={[styles.actionSheet, { backgroundColor: theme.surface }]}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Post preview */}
            <View style={styles.actionSheetPreview}>
              {selectedPost.thumbnailUrl || selectedPost.imageUrls?.[0] ? (
                <Image
                  source={{ uri: selectedPost.thumbnailUrl || selectedPost.imageUrls?.[0] }}
                  style={styles.previewImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.previewImage, styles.previewPlaceholder]}>
                  <Ionicons name="image" size={24} color={theme.textSecondary} />
                </View>
              )}
              <View style={styles.previewInfo}>
                <Text style={[styles.previewCaption, { color: theme.text }]} numberOfLines={2}>
                  {selectedPost.caption || 'No caption'}
                </Text>
                <Text style={[styles.previewDate, { color: theme.textSecondary }]}>
                  {formatTimeAgo(selectedPost.createdAt)}
                </Text>
              </View>
            </View>

            {/* Actions */}
            <View style={styles.actionSheetActions}>
              <Pressable
                style={[styles.actionButton, { backgroundColor: theme.background }]}
                onPress={handleViewPost}
              >
                <Ionicons name="eye-outline" size={20} color={theme.text} />
                <Text style={[styles.actionButtonText, { color: theme.text }]}>View Post</Text>
              </Pressable>

              <Pressable
                style={[styles.actionButton, { backgroundColor: theme.background }]}
                onPress={handleEdit}
              >
                <Ionicons name="pencil-outline" size={20} color={theme.text} />
                <Text style={[styles.actionButtonText, { color: theme.text }]}>Edit Post</Text>
              </Pressable>

              <Pressable
                style={[styles.actionButton, styles.deleteButton]}
                onPress={handleDelete}
              >
                <Ionicons name="trash-outline" size={20} color="#ef4444" />
                <Text style={[styles.actionButtonText, { color: '#ef4444' }]}>Delete Post</Text>
              </Pressable>
            </View>

            {/* Cancel */}
            <Pressable
              style={[styles.cancelButton, { backgroundColor: theme.background }]}
              onPress={() => {
                setShowActionSheet(false);
                setSelectedPost(null);
              }}
            >
              <Text style={[styles.cancelButtonText, { color: theme.text }]}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      )}
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
  backButton: {
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
  },
  statsText: {
    fontSize: 14,
    fontWeight: '500',
  },
  gridContent: {
    paddingHorizontal: 0,
  },
  gridItem: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    marginRight: GRID_GAP,
    marginBottom: GRID_GAP,
  },
  gridImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1a1a1a',
  },
  gridPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoIndicator: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 4,
    padding: 4,
  },
  statsOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 24,
  },
  createButtonText: {
    color: DARK,
    fontSize: 16,
    fontWeight: '600',
  },
  actionSheetOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  actionSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  actionSheetPreview: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  previewImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#1a1a1a',
  },
  previewPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  previewCaption: {
    fontSize: 14,
    fontWeight: '500',
  },
  previewDate: {
    fontSize: 12,
    marginTop: 4,
  },
  actionSheetActions: {
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  deleteButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  cancelButton: {
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
