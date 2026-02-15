/**
 * Post Detail Screen
 * Full post view with comments for The Feed
 */

import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import {
  addComment,
  addReaction,
  type Comment,
  type FeedPost,
  formatCount,
  formatTimeAgo,
  getComments,
  getPost,
  removeReaction,
  toggleSavePost,
  trackPostView,
} from '@/lib/api/feed';
import { useThemeContext } from '@/lib/providers/ThemeProvider';
import { useAuthStore } from '@/lib/stores/authStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const YELLOW = '#FCF150';
const DARK = '#1a1a1a';

export default function PostDetailScreen() {
  const { postId, comments: showComments } = useLocalSearchParams<{
    postId: string;
    comments?: string;
  }>();
  const { theme, colors } = useThemeContext();
  const { user } = useAuthStore();

  const [post, setPost] = useState<FeedPost | null>(null);
  const [postComments, setPostComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [commentsPage, setCommentsPage] = useState(1);
  const [hasMoreComments, setHasMoreComments] = useState(true);

  const scrollViewRef = useRef<ScrollView>(null);
  const commentInputRef = useRef<TextInput>(null);

  const fetchData = useCallback(async () => {
    if (!postId) return;

    try {
      const [postData, commentsData] = await Promise.all([
        getPost(postId),
        getComments(postId, { page: 1, limit: 20 }),
      ]);

      setPost(postData);
      setPostComments(commentsData.comments);
      setHasMoreComments(commentsData.pagination.hasMore ?? false);

      // Track view
      if (postData) {
        trackPostView(postId);
      }
    } catch (_error) {
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Focus comment input if coming from comments button
  useEffect(() => {
    if (showComments === 'true' && !loading) {
      setTimeout(() => {
        commentInputRef.current?.focus();
      }, 500);
    }
  }, [showComments, loading]);

  // Load more comments
  const loadMoreComments = async () => {
    if (!hasMoreComments || !postId) return;

    const nextPage = commentsPage + 1;
    const commentsData = await getComments(postId, { page: nextPage, limit: 20 });

    if (commentsData.comments) {
      setPostComments((prev) => [...prev, ...commentsData.comments]);
      setCommentsPage(nextPage);
      setHasMoreComments(commentsData.pagination.hasMore ?? false);
    }
  };

  // Handle send comment
  const handleSendComment = async () => {
    if (!commentText.trim() || !postId || !user || sendingComment) return;

    const content = commentText.trim();
    setCommentText('');
    setSendingComment(true);

    try {
      const newComment = await addComment(postId, content);
      if (newComment) {
        setPostComments((prev) => [newComment, ...prev]);
        // Update post comment count
        if (post) {
          setPost({
            ...post,
            stats: { ...post.stats, commentCount: post.stats.commentCount + 1 },
          });
        }
      }
    } catch (_error) {
      setCommentText(content);
      Alert.alert('Error', 'Could not send comment');
    } finally {
      setSendingComment(false);
    }
  };

  // Handle reaction
  const handleReaction = async (type: 'love' | 'respect') => {
    if (!post || !user) {
      router.push('/login');
      return;
    }

    const hasReaction = post.userReactions?.includes(type);

    // Optimistic update
    setPost({
      ...post,
      userReactions: hasReaction
        ? (post.userReactions || []).filter((r) => r !== type)
        : [...(post.userReactions || []), type],
      stats: {
        ...post.stats,
        [type === 'love' ? 'loveCount' : 'respectCount']:
          post.stats[type === 'love' ? 'loveCount' : 'respectCount'] + (hasReaction ? -1 : 1),
      },
    });

    if (hasReaction) {
      await removeReaction(post._id, type);
    } else {
      await addReaction(post._id, type);
    }
  };

  // Handle save
  const handleSave = async () => {
    if (!post || !user) {
      router.push('/login');
      return;
    }

    const isSaved = post.saved;
    setPost({ ...post, saved: !isSaved });
    await toggleSavePost(post._id, !isSaved);
  };

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

  if (!post) {
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
          <Ionicons name="image-outline" size={64} color={theme.textSecondary} />
          <Text style={[styles.errorText, { color: theme.text }]}>Post not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const hasLove = post.userReactions?.includes('love');
  const hasRespect = post.userReactions?.includes('respect');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollViewRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Header */}
          <View style={styles.header}>
            <Pressable
              style={[styles.backButton, { backgroundColor: theme.surface }]}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={24} color={theme.text} />
            </Pressable>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Post</Text>
            <Pressable style={[styles.backButton, { backgroundColor: theme.surface }]}>
              <Ionicons name="ellipsis-horizontal" size={22} color={theme.text} />
            </Pressable>
          </View>

          {/* User info */}
          <Pressable
            style={styles.userRow}
            onPress={() => post.user && router.push(`/(tabs)/homies/${post.userId}`)}
          >
            {post.user?.imageUri ? (
              <Image source={{ uri: post.user.imageUri }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: theme.surface }]}>
                <Text style={styles.avatarEmoji}>🛹</Text>
              </View>
            )}
            <View style={styles.userInfo}>
              <Text style={[styles.userName, { color: theme.text }]}>
                {post.user?.name || 'Unknown'}
              </Text>
              <Text style={[styles.postTime, { color: theme.textSecondary }]}>
                {formatTimeAgo(post.createdAt)}
              </Text>
            </View>
          </Pressable>

          {/* Media */}
          <View style={styles.mediaContainer}>
            {post.mediaType === 'video' && post.hlsUrl ? (
              <PostVideoPlayer hlsUrl={post.hlsUrl} />
            ) : post.thumbnailUrl || (post.imageUrls && post.imageUrls.length > 0) ? (
              <Image
                source={{ uri: post.thumbnailUrl || post.imageUrls?.[0] }}
                style={styles.media}
                resizeMode="contain"
              />
            ) : (
              <View style={[styles.mediaPlaceholder, { backgroundColor: theme.surface }]}>
                <Ionicons name="image-outline" size={64} color={theme.textSecondary} />
              </View>
            )}
          </View>

          {/* Actions */}
          <View style={styles.actionsRow}>
            <Pressable style={styles.actionButton} onPress={() => handleReaction('love')}>
              <Ionicons
                name={hasLove ? 'heart' : 'heart-outline'}
                size={26}
                color={hasLove ? '#ef4444' : theme.text}
              />
              <Text style={[styles.actionCount, { color: theme.textSecondary }]}>
                {formatCount(post.stats.loveCount)}
              </Text>
            </Pressable>
            <Pressable style={styles.actionButton} onPress={() => handleReaction('respect')}>
              <Text style={[styles.respectEmoji, hasRespect && styles.respectActive]}>🤙</Text>
              <Text style={[styles.actionCount, { color: theme.textSecondary }]}>
                {formatCount(post.stats.respectCount)}
              </Text>
            </Pressable>
            <Pressable style={styles.actionButton} onPress={() => commentInputRef.current?.focus()}>
              <Ionicons name="chatbubble-outline" size={24} color={theme.text} />
              <Text style={[styles.actionCount, { color: theme.textSecondary }]}>
                {formatCount(post.stats.commentCount)}
              </Text>
            </Pressable>
            <Pressable style={styles.actionButton}>
              <Ionicons name="share-outline" size={26} color={theme.text} />
            </Pressable>
            <View style={styles.actionSpacer} />
            <Pressable onPress={handleSave}>
              <Ionicons
                name={post.saved ? 'bookmark' : 'bookmark-outline'}
                size={26}
                color={post.saved ? colors.primary : theme.text}
              />
            </Pressable>
          </View>

          {/* Caption */}
          {post.caption && (
            <View style={styles.captionSection}>
              <Text style={[styles.caption, { color: theme.text }]}>{post.caption}</Text>
            </View>
          )}

          {/* Comments Section */}
          <View style={[styles.commentsSection, { borderTopColor: theme.border }]}>
            <Text style={[styles.commentsSectionTitle, { color: theme.text }]}>
              Comments ({post.stats.commentCount})
            </Text>

            {postComments.length === 0 ? (
              <View style={styles.noComments}>
                <Text style={[styles.noCommentsText, { color: theme.textSecondary }]}>
                  No comments yet. Be the first!
                </Text>
              </View>
            ) : (
              postComments.map((comment) => (
                <CommentItem key={comment._id} comment={comment} theme={theme} />
              ))
            )}

            {hasMoreComments && (
              <Pressable style={styles.loadMoreButton} onPress={loadMoreComments}>
                <Text style={[styles.loadMoreText, { color: colors.primary }]}>
                  Load more comments
                </Text>
              </Pressable>
            )}
          </View>
        </ScrollView>

        {/* Comment Input */}
        <View style={[styles.commentInputContainer, { borderTopColor: theme.border }]}>
          <View style={[styles.commentInputWrapper, { backgroundColor: theme.surface }]}>
            <TextInput
              ref={commentInputRef}
              style={[styles.commentInput, { color: theme.text }]}
              placeholder="Add a comment..."
              placeholderTextColor={theme.textTertiary}
              value={commentText}
              onChangeText={setCommentText}
              multiline
              maxLength={500}
            />
          </View>
          <Pressable
            style={[
              styles.sendButton,
              { backgroundColor: commentText.trim() ? colors.primary : theme.surface },
            ]}
            onPress={handleSendComment}
            disabled={!commentText.trim() || sendingComment}
          >
            {sendingComment ? (
              <ActivityIndicator size="small" color={DARK} />
            ) : (
              <Ionicons
                name="send"
                size={20}
                color={commentText.trim() ? DARK : theme.textSecondary}
              />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Video Player Component using expo-video
function PostVideoPlayer({ hlsUrl }: { hlsUrl: string }) {
  const player = useVideoPlayer(hlsUrl, (player) => {
    player.loop = true;
    player.play();
  });

  return <VideoView player={player} style={styles.media} contentFit="contain" nativeControls />;
}

interface CommentItemProps {
  comment: Comment;
  theme: any;
}

function CommentItem({ comment, theme }: CommentItemProps) {
  return (
    <View style={styles.commentItem}>
      {comment.user?.imageUri ? (
        <Image source={{ uri: comment.user.imageUri }} style={styles.commentAvatar} />
      ) : (
        <View style={[styles.commentAvatarPlaceholder, { backgroundColor: theme.surface }]}>
          <Text style={styles.commentAvatarEmoji}>🛹</Text>
        </View>
      )}
      <View style={styles.commentContent}>
        <View style={styles.commentHeader}>
          <Text style={[styles.commentUserName, { color: theme.text }]}>
            {comment.user?.name || 'Unknown'}
          </Text>
          <Text style={[styles.commentTime, { color: theme.textSecondary }]}>
            {formatTimeAgo(comment.createdAt)}
          </Text>
        </View>
        <Text style={[styles.commentText, { color: theme.text }]}>{comment.content}</Text>
        {comment.loveCount > 0 && (
          <View style={styles.commentLikes}>
            <Ionicons name="heart" size={12} color="#ef4444" />
            <Text style={[styles.commentLikesText, { color: theme.textSecondary }]}>
              {comment.loveCount}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
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
  scrollContent: {
    paddingBottom: 20,
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: {
    fontSize: 20,
  },
  userInfo: {
    marginLeft: 12,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
  },
  postTime: {
    fontSize: 13,
    marginTop: 2,
  },
  mediaContainer: {
    width: SCREEN_WIDTH,
    aspectRatio: 1,
    backgroundColor: '#000',
  },
  media: {
    width: '100%',
    height: '100%',
  },
  mediaPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionCount: {
    fontSize: 14,
  },
  actionSpacer: {
    flex: 1,
  },
  respectEmoji: {
    fontSize: 22,
    opacity: 0.6,
  },
  respectActive: {
    opacity: 1,
  },
  captionSection: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  caption: {
    fontSize: 15,
    lineHeight: 22,
  },
  commentsSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  commentsSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  noComments: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  noCommentsText: {
    fontSize: 14,
  },
  loadMoreButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: '600',
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  commentAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentAvatarEmoji: {
    fontSize: 16,
  },
  commentContent: {
    flex: 1,
    marginLeft: 10,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  commentUserName: {
    fontSize: 14,
    fontWeight: '600',
    marginRight: 8,
  },
  commentTime: {
    fontSize: 12,
  },
  commentText: {
    fontSize: 14,
    lineHeight: 20,
  },
  commentLikes: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  commentLikesText: {
    fontSize: 12,
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    gap: 10,
  },
  commentInputWrapper: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 40,
  },
  commentInput: {
    fontSize: 15,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
