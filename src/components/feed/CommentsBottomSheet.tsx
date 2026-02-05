/**
 * Comments Bottom Sheet - TikTok-style overlay for viewing/adding comments
 * Slides up from bottom, video continues playing behind
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Animated,
  Dimensions,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import {
  getComments,
  addComment,
  toggleCommentLove,
  Comment,
  FeedPost,
  formatTimeAgo,
} from '@/lib/api/feed';
import { useAuthStore } from '@/lib/stores/authStore';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.6;
const YELLOW = '#FCF150';

interface CommentsBottomSheetProps {
  visible: boolean;
  post: FeedPost | null;
  onClose: () => void;
}

export default function CommentsBottomSheet({
  visible,
  post,
  onClose,
}: CommentsBottomSheetProps) {
  const { user, token } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const inputRef = useRef<TextInput>(null);
  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;

  // Fetch comments when modal opens
  useEffect(() => {
    if (visible && post) {
      fetchComments(1, true);
      // Animate slide up
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      // Reset when closed
      slideAnim.setValue(SHEET_HEIGHT);
      setComments([]);
      setPage(1);
      setHasMore(true);
    }
  }, [visible, post?._id]);

  const fetchComments = async (pageNum: number = 1, refresh: boolean = false) => {
    if (!post) return;

    setLoading(true);
    try {
      const response = await getComments(post._id, { page: pageNum, limit: 20 });
      if (refresh || pageNum === 1) {
        setComments(response.comments);
      } else {
        setComments((prev) => [...prev, ...response.comments]);
      }
      setHasMore(response.pagination.hasMore ?? response.comments.length === 20);
      setPage(pageNum);
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!post || !newComment.trim() || !user || submitting) return;

    setSubmitting(true);
    try {
      const comment = await addComment(post._id, newComment.trim());
      if (comment) {
        // Add to top of list
        setComments((prev) => [comment, ...prev]);
        setNewComment('');
        inputRef.current?.blur();
      }
    } catch (error) {
      console.error('Error adding comment:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLove = async (comment: Comment) => {
    if (!post || !user) return;

    // Optimistic update
    setComments((prev) =>
      prev.map((c) => {
        if (c._id === comment._id) {
          return {
            ...c,
            loved: !c.loved,
            loveCount: c.loved ? c.loveCount - 1 : c.loveCount + 1,
          };
        }
        return c;
      })
    );

    await toggleCommentLove(post._id, comment._id);
  };

  const handleClose = () => {
    Animated.timing(slideAnim, {
      toValue: SHEET_HEIGHT,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };

  const loadMore = () => {
    if (!loading && hasMore) {
      fetchComments(page + 1);
    }
  };

  const renderComment = ({ item }: { item: Comment }) => (
    <View style={styles.commentItem}>
      {/* Avatar */}
      <View style={styles.commentAvatar}>
        {item.user?.imageUri ? (
          <Image source={{ uri: item.user.imageUri }} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarEmoji}>🛹</Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View style={styles.commentContent}>
        <View style={styles.commentHeader}>
          <Text style={styles.commentUsername}>{item.user?.name || 'Unknown'}</Text>
          <Text style={styles.commentTime}>{formatTimeAgo(item.createdAt)}</Text>
        </View>
        <Text style={styles.commentText}>{item.content}</Text>

        {/* Reply count */}
        {item.replyCount > 0 && (
          <Pressable style={styles.repliesButton}>
            <Text style={styles.repliesText}>View {item.replyCount} replies</Text>
          </Pressable>
        )}
      </View>

      {/* Love button */}
      <Pressable style={styles.loveButton} onPress={() => handleLove(item)}>
        <Ionicons
          name={item.loved ? 'heart' : 'heart-outline'}
          size={16}
          color={item.loved ? '#ef4444' : 'rgba(255,255,255,0.5)'}
        />
        {item.loveCount > 0 && (
          <Text style={styles.loveCount}>{item.loveCount}</Text>
        )}
      </Pressable>
    </View>
  );

  if (!post) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <View style={styles.backdropInner} />
      </Pressable>

      {/* Bottom Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          {
            transform: [{ translateY: slideAnim }],
            paddingBottom: insets.bottom,
          },
        ]}
      >
        {/* Handle */}
        <View style={styles.handleContainer}>
          <View style={styles.handle} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {post.stats.commentCount} {post.stats.commentCount === 1 ? 'comment' : 'comments'}
          </Text>
          <Pressable onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#fff" />
          </Pressable>
        </View>

        {/* Comments List */}
        <FlatList
          data={comments}
          keyExtractor={(item) => item._id}
          renderItem={renderComment}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={YELLOW} />
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No comments yet</Text>
                <Text style={styles.emptySubtext}>Be the first to comment!</Text>
              </View>
            )
          }
          ListFooterComponent={
            loading && comments.length > 0 ? (
              <ActivityIndicator size="small" color={YELLOW} style={{ padding: 16 }} />
            ) : null
          }
        />

        {/* Input */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <View style={styles.inputContainer}>
            {user ? (
              <>
                <TextInput
                  ref={inputRef}
                  style={styles.input}
                  placeholder="Add a comment..."
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  value={newComment}
                  onChangeText={setNewComment}
                  multiline
                  maxLength={500}
                />
                <Pressable
                  style={[
                    styles.sendButton,
                    (!newComment.trim() || submitting) && styles.sendButtonDisabled,
                  ]}
                  onPress={handleSubmit}
                  disabled={!newComment.trim() || submitting}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <Ionicons name="send" size={20} color="#000" />
                  )}
                </Pressable>
              </>
            ) : (
              <Text style={styles.loginPrompt}>Sign in to comment</Text>
            )}
          </View>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropInner: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    padding: 4,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  commentAvatar: {
    marginRight: 12,
  },
  avatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: {
    fontSize: 18,
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  commentUsername: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  commentTime: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  commentText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 20,
  },
  repliesButton: {
    marginTop: 8,
  },
  repliesText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
  },
  loveButton: {
    alignItems: 'center',
    paddingLeft: 12,
  },
  loveCount: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    backgroundColor: '#1a1a1a',
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 14,
    maxHeight: 100,
  },
  sendButton: {
    marginLeft: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: YELLOW,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  loginPrompt: {
    flex: 1,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
  },
});
