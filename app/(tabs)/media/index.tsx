/**
 * Media Screen
 * Toggle between The Couch (Netflix-style video library) and The Feed (TikTok-style reels)
 */

import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  ImageBackground,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewToken,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CommentsBottomSheet } from '@/components/feed';
import { ShareToHomieModal } from '@/components/share';
import {
  type CouchCollection,
  type CouchVideo,
  formatDuration,
  getCollections,
  getFeatured,
  getThumbnailUrl,
  getVideos,
} from '@/lib/api/couch';
import {
  addReaction,
  type FeedPost,
  formatCount,
  formatTimeAgo,
  getFeed,
  getTrending,
  removeReaction,
  toggleSavePost,
} from '@/lib/api/feed';
import { useThemeContext } from '@/lib/providers/ThemeProvider';
import { useAuthStore } from '@/lib/stores/authStore';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const POSTER_WIDTH = 130;
const POSTER_HEIGHT = 195;

const YELLOW = '#FCF150';
const DARK = '#1a1a1a';

type TabType = 'couch' | 'feed';

export default function MediaScreen() {
  const { theme, colors } = useThemeContext();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const [activeTab, setActiveTab] = useState<TabType>(tab === 'feed' ? 'feed' : 'couch');

  // Update active tab when navigating with ?tab= parameter
  useEffect(() => {
    if (tab === 'feed') {
      setActiveTab('feed');
    }
  }, [tab]);

  return (
    <View style={[styles.container, { backgroundColor: '#000' }]}>
      {activeTab === 'couch' ? (
        <CouchView theme={theme} colors={colors} onSwitchTab={() => setActiveTab('feed')} />
      ) : (
        <FeedView theme={theme} colors={colors} onSwitchTab={() => setActiveTab('couch')} />
      )}
    </View>
  );
}

// =============================================
// THE COUCH VIEW - Netflix Style
// =============================================

interface CouchViewProps {
  theme: any;
  colors: any;
  onSwitchTab: () => void;
}

function CouchView({ theme, colors, onSwitchTab }: CouchViewProps) {
  const insets = useSafeAreaInsets();
  const [featured, setFeatured] = useState<CouchVideo | null>(null);
  const [collections, setCollections] = useState<CouchCollection[]>([]);
  const [recentVideos, setRecentVideos] = useState<CouchVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [featuredData, collectionsData, videosData] = await Promise.all([
        getFeatured(),
        getCollections(),
        getVideos({ limit: 20 }),
      ]);
      setFeatured(featuredData);
      setCollections(collectionsData);
      setRecentVideos(videosData || []);
    } catch (_error) {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={YELLOW} />
      </View>
    );
  }

  const hasContent = featured || collections.length > 0 || recentVideos.length > 0;

  return (
    <ScrollView
      style={styles.scrollView}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.couchScrollContent, { paddingTop: insets.top }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={YELLOW} />
      }
    >
      {/* Header with Title and Actions */}
      <View style={styles.couchHeader}>
        <Text style={styles.couchHeaderTitle}>Media</Text>
        <View style={styles.couchHeaderActions}>
          <Pressable style={styles.couchHeaderButton}>
            <Ionicons name="albums-outline" size={24} color="#fff" />
          </Pressable>
          <Pressable
            style={styles.couchHeaderButton}
            onPress={() => router.push('/(tabs)/media/upload')}
          >
            <Ionicons name="add" size={28} color="#fff" />
          </Pressable>
        </View>
      </View>

      {/* Tab Toggle - Below Header */}
      <View style={styles.couchTabContainer}>
        <Pressable style={[styles.couchTab, styles.couchTabActive]}>
          <Text style={styles.couchTabTextActive}>The Couch</Text>
        </Pressable>
        <Pressable style={styles.couchTab} onPress={onSwitchTab}>
          <Text style={styles.couchTabText}>The Feed</Text>
        </Pressable>
      </View>

      {hasContent ? (
        <>
          {/* Hero Featured */}
          {featured && <HeroSection video={featured} colors={colors} />}

          {/* Recent Videos Row */}
          {recentVideos.length > 0 && <MediaRow title="Recently Added" videos={recentVideos} />}

          {/* Collections as Rows */}
          {collections.map((collection) => (
            <CollectionRow key={collection._id} collection={collection} />
          ))}
        </>
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="tv-outline" size={64} color="rgba(255,255,255,0.5)" />
          <Text style={styles.emptyTitle}>No content yet</Text>
          <Text style={styles.emptySubtitle}>Check back later for curated action sports films</Text>
        </View>
      )}
    </ScrollView>
  );
}

// Hero Section Component
function HeroSection({ video, colors }: { video: CouchVideo; colors: any }) {
  const posterUri = getThumbnailUrl(video);

  return (
    <Pressable
      style={styles.heroContainer}
      onPress={() => router.push(`/(tabs)/media/video/${video._id}`)}
    >
      {posterUri ? (
        <ImageBackground source={{ uri: posterUri }} style={styles.heroImage} resizeMode="cover">
          <View style={styles.heroGradient}>
            <View style={styles.heroContent}>
              <View style={styles.heroBadge}>
                <Ionicons name="star" size={12} color={YELLOW} />
                <Text style={styles.heroBadgeText}>Featured</Text>
              </View>
              <Text style={styles.heroTitle} numberOfLines={2}>
                {video.title}
              </Text>
              {video.description && (
                <Text style={styles.heroDescription} numberOfLines={2}>
                  {video.description}
                </Text>
              )}
              <View style={styles.heroMeta}>
                {video.releaseYear && <Text style={styles.heroMetaText}>{video.releaseYear}</Text>}
                {video.sportTypes?.[0] && (
                  <Text style={styles.heroMetaText}>{video.sportTypes[0]}</Text>
                )}
                {video.duration && (
                  <Text style={styles.heroMetaText}>{formatDuration(video.duration)}</Text>
                )}
              </View>
              <View style={styles.heroActions}>
                <Pressable
                  style={styles.playButton}
                  onPress={() => router.push(`/(tabs)/media/video/${video._id}`)}
                >
                  <Ionicons name="play" size={20} color={DARK} />
                  <Text style={styles.playButtonText}>Play</Text>
                </Pressable>
                <Pressable style={styles.infoButton}>
                  <Ionicons name="information-circle-outline" size={24} color="#fff" />
                  <Text style={styles.infoButtonText}>More Info</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </ImageBackground>
      ) : (
        <View style={[styles.heroImage, styles.heroPlaceholder]}>
          <Ionicons name="film-outline" size={80} color="rgba(255,255,255,0.3)" />
        </View>
      )}
    </Pressable>
  );
}

// Media Row Component (horizontal scrolling)
function MediaRow({ title, videos }: { title: string; videos: CouchVideo[] }) {
  return (
    <View style={styles.rowContainer}>
      <Text style={styles.rowTitle}>{title}</Text>
      <FlatList
        data={videos}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rowContent}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => <VideoPoster video={item} />}
      />
    </View>
  );
}

// Collection Row Component
function CollectionRow({ collection }: { collection: CouchCollection }) {
  const videos = collection.videos || [];
  if (videos.length === 0) return null;

  return (
    <View style={styles.rowContainer}>
      <Pressable
        style={styles.rowHeader}
        onPress={() => router.push(`/(tabs)/media/collection/${collection._id}`)}
      >
        <Text style={styles.rowTitle}>{collection.name}</Text>
        <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" />
      </Pressable>
      <FlatList
        data={videos}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rowContent}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => <VideoPoster video={item} />}
      />
    </View>
  );
}

// Video Poster Component
function VideoPoster({ video }: { video: CouchVideo }) {
  const posterUri = getThumbnailUrl(video);

  return (
    <Pressable
      style={styles.posterContainer}
      onPress={() => router.push(`/(tabs)/media/video/${video._id}`)}
    >
      {posterUri ? (
        <Image source={{ uri: posterUri }} style={styles.posterImage} resizeMode="cover" />
      ) : (
        <View style={[styles.posterImage, styles.posterPlaceholder]}>
          <Ionicons name="film-outline" size={32} color="rgba(255,255,255,0.5)" />
        </View>
      )}
      <Text style={styles.posterTitle} numberOfLines={1}>
        {video.title}
      </Text>
    </Pressable>
  );
}

// =============================================
// THE FEED VIEW - TikTok/Reels Style
// =============================================

interface FeedViewProps {
  theme: any;
  colors: any;
  onSwitchTab: () => void;
}

function FeedView({ theme, colors, onSwitchTab }: FeedViewProps) {
  const { user } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [selectedPost, setSelectedPost] = useState<FeedPost | null>(null);
  const [isFocused, setIsFocused] = useState(true);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [postToShare, setPostToShare] = useState<FeedPost | null>(null);

  const flatListRef = useRef<FlatList>(null);

  // Pause videos when screen loses focus (navigating away)
  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => {
        setIsFocused(false);
      };
    }, []),
  );

  // Calculate video height (full screen minus tab bar)
  const TAB_BAR_HEIGHT = 80;
  const VIDEO_HEIGHT = SCREEN_HEIGHT - TAB_BAR_HEIGHT;

  const fetchPosts = useCallback(
    async (pageNum: number = 1, refresh: boolean = false) => {
      try {
        const response = user
          ? await getFeed({ page: pageNum, limit: 20 })
          : await getTrending({ page: pageNum, limit: 20 });

        if (refresh || pageNum === 1) {
          setPosts(response.posts);
        } else {
          setPosts((prev) => [...prev, ...response.posts]);
        }
        setHasMore(response.pagination.hasMore ?? response.posts.length === 20);
        setPage(pageNum);
      } catch (_error) {
      } finally {
        setLoading(false);
      }
    },
    [user],
  );

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

  // Track visible item
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      setActiveIndex(viewableItems[0].index);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  // Handle reaction toggle
  const handleReaction = async (post: FeedPost, type: 'love' | 'respect') => {
    if (!user) {
      router.push('/login');
      return;
    }

    const hasReaction = post.userReactions?.includes(type);

    // Optimistic update
    setPosts((prev) =>
      prev.map((p) => {
        if (p._id === post._id) {
          const newReactions = hasReaction
            ? (p.userReactions || []).filter((r) => r !== type)
            : [...(p.userReactions || []), type];
          const countChange = hasReaction ? -1 : 1;
          return {
            ...p,
            userReactions: newReactions,
            stats: {
              ...p.stats,
              [type === 'love' ? 'loveCount' : 'respectCount']:
                p.stats[type === 'love' ? 'loveCount' : 'respectCount'] + countChange,
            },
          };
        }
        return p;
      }),
    );

    if (hasReaction) {
      await removeReaction(post._id, type);
    } else {
      await addReaction(post._id, type);
    }
  };

  // Handle save toggle
  const handleSave = async (post: FeedPost) => {
    if (!user) {
      router.push('/login');
      return;
    }

    const isSaved = post.saved;

    // Optimistic update
    setPosts((prev) =>
      prev.map((p) => {
        if (p._id === post._id) {
          return { ...p, saved: !isSaved };
        }
        return p;
      }),
    );

    await toggleSavePost(post._id, !isSaved);
  };

  // Handle opening comments
  const handleOpenComments = (post: FeedPost) => {
    setSelectedPost(post);
    setCommentsVisible(true);
  };

  // Handle opening share modal
  const handleOpenShare = (post: FeedPost) => {
    setPostToShare(post);
    setShareModalVisible(true);
  };

  if (loading) {
    return (
      <View style={[styles.feedLoadingContainer, { backgroundColor: '#000' }]}>
        <ActivityIndicator size="large" color={YELLOW} />
      </View>
    );
  }

  if (posts.length === 0) {
    return (
      <SafeAreaView
        style={[styles.feedEmptyContainer, { backgroundColor: '#000' }]}
        edges={['top']}
      >
        {/* Header */}
        <View style={styles.feedEmptyHeader}>
          <Text style={styles.feedHeaderTitle}>Media</Text>
          <View style={styles.feedHeaderActions}>
            <Pressable
              style={styles.feedHeaderButton}
              onPress={() => router.push('/(tabs)/media/my-posts')}
            >
              <Ionicons name="person-circle-outline" size={24} color="#fff" />
            </Pressable>
            <Pressable
              style={styles.feedHeaderButton}
              onPress={() => router.push('/(tabs)/media/upload')}
            >
              <Ionicons name="add" size={28} color="#fff" />
            </Pressable>
          </View>
        </View>
        {/* Tabs */}
        <View style={styles.feedEmptyTabContainer}>
          <Pressable style={styles.feedTab} onPress={onSwitchTab}>
            <Text style={styles.feedTabText}>The Couch</Text>
          </Pressable>
          <Pressable style={[styles.feedTab, styles.feedTabActive]}>
            <Text style={styles.feedTabTextActive}>The Feed</Text>
          </Pressable>
        </View>
        <View style={styles.feedEmptyContent}>
          <Ionicons name="albums-outline" size={64} color="rgba(255,255,255,0.5)" />
          <Text style={styles.feedEmptyTitle}>No posts yet</Text>
          <Text style={styles.feedEmptySubtitle}>
            {user ? 'Be the first to share something!' : 'Sign in to see your feed'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.feedContainer}>
      {/* Header overlay with tabs */}
      <View style={[styles.feedHeader, { paddingTop: insets.top + 10 }]}>
        <View style={styles.feedHeaderTop}>
          <Text style={styles.feedHeaderTitle}>Media</Text>
          <View style={styles.feedHeaderActions}>
            <Pressable
              style={styles.feedHeaderButton}
              onPress={() => router.push('/(tabs)/media/my-posts')}
            >
              <Ionicons name="person-circle-outline" size={24} color="#fff" />
            </Pressable>
            <Pressable
              style={styles.feedHeaderButton}
              onPress={() => router.push('/(tabs)/media/upload')}
            >
              <Ionicons name="add" size={28} color="#fff" />
            </Pressable>
          </View>
        </View>
        {/* Tab Toggle */}
        <View style={styles.feedTabContainer}>
          <Pressable style={styles.feedTab} onPress={onSwitchTab}>
            <Text style={styles.feedTabText}>The Couch</Text>
          </Pressable>
          <Pressable style={[styles.feedTab, styles.feedTabActive]}>
            <Text style={styles.feedTabTextActive}>The Feed</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        ref={flatListRef}
        data={posts}
        keyExtractor={(item) => item._id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={VIDEO_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={YELLOW} />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        getItemLayout={(_, index) => ({
          length: VIDEO_HEIGHT,
          offset: VIDEO_HEIGHT * index,
          index,
        })}
        renderItem={({ item, index }) => (
          <FeedVideoItem
            post={item}
            isActive={index === activeIndex && isFocused}
            videoHeight={VIDEO_HEIGHT}
            onReaction={(type) => handleReaction(item, type)}
            onSave={() => handleSave(item)}
            onComment={() => handleOpenComments(item)}
            onShare={() => handleOpenShare(item)}
            onUserPress={() =>
              item.user &&
              router.push({
                pathname: '/(tabs)/profile/[userId]',
                params: { userId: item.userId, from: 'feed' },
              })
            }
          />
        )}
      />

      {/* Comments Bottom Sheet */}
      <CommentsBottomSheet
        visible={commentsVisible}
        post={selectedPost}
        onClose={() => setCommentsVisible(false)}
      />

      {/* Share to Homie Modal */}
      {postToShare && (
        <ShareToHomieModal
          visible={shareModalVisible}
          onClose={() => setShareModalVisible(false)}
          contentType="video"
          contentId={postToShare._id}
          preview={{
            title: postToShare.caption || 'Video',
            subtitle: `@${postToShare.user?.name || 'unknown'}`,
            thumbnailUrl: postToShare.thumbnailUrl,
          }}
          onSuccess={(conversationId) => {
            router.push(`/(tabs)/homies/chat/${conversationId}`);
          }}
        />
      )}
    </View>
  );
}

// =============================================
// FEED VIDEO ITEM - Individual Reel
// =============================================

interface FeedVideoItemProps {
  post: FeedPost;
  isActive: boolean;
  videoHeight: number;
  onReaction: (type: 'love' | 'respect') => void;
  onSave: () => void;
  onComment: () => void;
  onShare: () => void;
  onUserPress: () => void;
}

// Separate video player component that only renders when we have a URL
function FeedVideoPlayer({
  videoUrl,
  fallbackUrls,
  isActive,
  isMuted,
  onMutedChange,
}: {
  videoUrl: string;
  fallbackUrls?: string[];
  isActive: boolean;
  isMuted: boolean;
  onMutedChange: (muted: boolean) => void;
}) {
  const [currentUrl, setCurrentUrl] = useState(videoUrl);
  const triedUrls = useRef(new Set<string>());

  // Reset when videoUrl prop changes (new post)
  useEffect(() => {
    setCurrentUrl(videoUrl);
    triedUrls.current.clear();
  }, [videoUrl]);

  const player = useVideoPlayer(currentUrl, (p) => {
    p.loop = true;
    p.muted = isMuted;
  });

  // Listen for player events — try fallback URLs on error
  useEffect(() => {
    if (!player) return;

    const statusSub = player.addListener('statusChange', ({ status }) => {
      if (status === 'error') {
        console.error('Video playback error for URL:', currentUrl);
        triedUrls.current.add(currentUrl);

        // Try next fallback URL
        const nextUrl = fallbackUrls?.find((u) => !triedUrls.current.has(u));
        if (nextUrl) {
          console.log('Trying fallback URL:', nextUrl);
          setCurrentUrl(nextUrl);
        }
      }
    });

    return () => {
      statusSub.remove();
    };
  }, [player, currentUrl, fallbackUrls]);

  // Handle play/pause based on visibility
  useEffect(() => {
    if (!player) return;

    if (isActive) {
      player.play();
    } else {
      player.pause();
    }
  }, [isActive, player]);

  // Sync muted state
  useEffect(() => {
    if (player) {
      player.muted = isMuted;
    }
  }, [player, isMuted]);

  const handlePress = () => {
    if (!player) return;
    if (player.playing) {
      player.pause();
    } else {
      player.play();
    }
  };

  return (
    <Pressable style={styles.videoTouchable} onPress={handlePress}>
      <VideoView
        player={player}
        style={[styles.video, { backgroundColor: '#000' }]}
        contentFit="cover"
        nativeControls={false}
      />
    </Pressable>
  );
}

const FeedVideoItem = memo(function FeedVideoItem({
  post,
  isActive,
  videoHeight,
  onReaction,
  onSave,
  onComment,
  onShare,
  onUserPress,
}: FeedVideoItemProps) {
  const [_showPlayPause, _setShowPlayPause] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const hasLove = post.userReactions?.includes('love');
  const hasRespect = post.userReactions?.includes('respect');

  // Determine video URL - prefer HLS so playback adapts to whatever
  // resolutions Bunny actually transcoded (the hardcoded play_720p.mp4
  // fallback returns 404 for source videos uploaded below 720p).
  const videoUrl = useMemo(() => {
    if (post.mediaType !== 'video') return null;

    // Prefer signed HLS URL — adaptive, works for any source resolution
    if (post.signedHlsUrl) {
      return post.signedHlsUrl;
    }

    // Fall back to unsigned HLS
    if (post.hlsUrl) {
      return post.hlsUrl;
    }

    // Last resort: signed 720p MP4 (only valid if source >= 720p)
    if (post.signedMp4Url) {
      return post.signedMp4Url;
    }

    return null;
  }, [post.mediaType, post.signedHlsUrl, post.hlsUrl, post.signedMp4Url]);

  // Toggle mute
  const handleMuteToggle = () => {
    setIsMuted(!isMuted);
  };

  // Build fallback URL list (all available URLs except the primary one)
  const fallbackUrls = useMemo(() => {
    const urls = [post.signedHlsUrl, post.hlsUrl, post.signedMp4Url].filter(
      (u): u is string => !!u && u !== videoUrl,
    );
    return urls;
  }, [post.signedHlsUrl, post.hlsUrl, post.signedMp4Url, videoUrl]);

  const isVideo = post.mediaType === 'video' && videoUrl;

  return (
    <View style={[styles.videoItemContainer, { height: videoHeight }]}>
      {/* Video or Image */}
      {isVideo && videoUrl ? (
        <FeedVideoPlayer
          videoUrl={videoUrl}
          fallbackUrls={fallbackUrls}
          isActive={isActive}
          isMuted={isMuted}
          onMutedChange={setIsMuted}
        />
      ) : (
        <Pressable style={styles.videoTouchable}>
          <Image
            source={{ uri: post.thumbnailUrl || post.imageUrls?.[0] }}
            style={styles.video}
            resizeMode="cover"
          />
          {/* Debug: Show if no video URL */}
          {post.mediaType === 'video' && !videoUrl && (
            <View style={styles.playPauseIndicator}>
              <Text style={{ color: '#fff', backgroundColor: 'rgba(255,0,0,0.7)', padding: 10 }}>
                No video URL found
              </Text>
            </View>
          )}
        </Pressable>
      )}

      {/* Right side actions */}
      <View style={styles.actionsColumn}>
        {/* User avatar */}
        <Pressable style={styles.actionAvatarContainer} onPress={onUserPress}>
          {post.user?.imageUri ? (
            <Image source={{ uri: post.user.imageUri }} style={styles.actionAvatar} />
          ) : (
            <View style={styles.actionAvatarPlaceholder}>
              <Text style={styles.actionAvatarEmoji}>🛹</Text>
            </View>
          )}
        </Pressable>

        {/* Love */}
        <Pressable style={styles.actionItem} onPress={() => onReaction('love')}>
          <Ionicons
            name={hasLove ? 'heart' : 'heart-outline'}
            size={32}
            color={hasLove ? '#ef4444' : '#fff'}
          />
          <Text style={styles.actionCount}>{formatCount(post.stats.loveCount)}</Text>
        </Pressable>

        {/* Respect */}
        <Pressable style={styles.actionItem} onPress={() => onReaction('respect')}>
          <Text style={[styles.respectEmojiLarge, hasRespect && styles.respectActiveLarge]}>
            🤙
          </Text>
          <Text style={styles.actionCount}>{formatCount(post.stats.respectCount)}</Text>
        </Pressable>

        {/* Comments */}
        <Pressable style={styles.actionItem} onPress={onComment}>
          <Ionicons name="chatbubble-ellipses" size={30} color="#fff" />
          <Text style={styles.actionCount}>{formatCount(post.stats.commentCount)}</Text>
        </Pressable>

        {/* Share */}
        <Pressable style={styles.actionItem} onPress={onShare}>
          <Ionicons name="arrow-redo" size={30} color="#fff" />
        </Pressable>

        {/* Save */}
        <Pressable style={styles.actionItem} onPress={onSave}>
          <Ionicons
            name={post.saved ? 'bookmark' : 'bookmark-outline'}
            size={28}
            color={post.saved ? YELLOW : '#fff'}
          />
        </Pressable>

        {/* Mute toggle */}
        {isVideo && (
          <Pressable style={styles.actionItem} onPress={handleMuteToggle}>
            <Ionicons name={isMuted ? 'volume-mute' : 'volume-high'} size={26} color="#fff" />
          </Pressable>
        )}
      </View>

      {/* Bottom info */}
      <View style={styles.videoInfo}>
        {/* Username */}
        <Pressable onPress={onUserPress}>
          <Text style={styles.videoUsername}>@{post.user?.name || 'unknown'}</Text>
        </Pressable>

        {/* Caption */}
        {post.caption && (
          <Text style={styles.videoCaption} numberOfLines={2}>
            {post.caption}
          </Text>
        )}

        {/* Spot chip */}
        {post.spot && (
          <Pressable
            style={styles.spotChip}
            onPress={() => router.push(`/(tabs)/spots/${post.spot?._id}`)}
          >
            <Ionicons name="location" size={14} color={YELLOW} />
            <Text style={styles.spotChipText} numberOfLines={1}>
              {post.spot.name}
            </Text>
          </Pressable>
        )}

        {/* Tags */}
        {post.sportTypes && post.sportTypes.length > 0 && (
          <View style={styles.videoTags}>
            {post.sportTypes.slice(0, 3).map((sport) => (
              <View key={sport} style={styles.videoTag}>
                <Text style={styles.videoTagText}>#{sport}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Time ago */}
        <Text style={styles.videoTime}>{formatTimeAgo(post.createdAt)}</Text>
      </View>
    </View>
  );
});

// =============================================
// STYLES
// =============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  scrollView: {
    flex: 1,
  },
  couchScrollContent: {
    paddingBottom: 100,
  },

  // Couch Header
  couchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
  },
  couchHeaderTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  couchHeaderActions: {
    flexDirection: 'row',
    gap: 8,
  },
  couchHeaderButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },

  // Couch Tabs
  couchTabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 24,
    gap: 12,
  },
  couchTab: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'transparent',
  },
  couchTabActive: {
    backgroundColor: YELLOW,
    borderColor: YELLOW,
  },
  couchTabText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 15,
    fontWeight: '500',
  },
  couchTabTextActive: {
    color: '#000',
    fontSize: 15,
    fontWeight: '600',
  },

  // Hero Section
  heroContainer: {
    marginBottom: 20,
  },
  heroImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.55,
  },
  heroPlaceholder: {
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroGradient: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  heroContent: {
    padding: 20,
    paddingBottom: 30,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
  },
  heroBadgeText: {
    color: YELLOW,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  heroDescription: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  heroMeta: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  heroMetaText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
  },
  heroActions: {
    flexDirection: 'row',
    gap: 12,
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 4,
  },
  playButtonText: {
    color: DARK,
    fontSize: 16,
    fontWeight: '600',
  },
  infoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 4,
  },
  infoButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },

  // Media Rows
  rowContainer: {
    marginBottom: 24,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  rowTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  rowContent: {
    paddingHorizontal: 12,
    gap: 10,
  },

  // Poster
  posterContainer: {
    width: POSTER_WIDTH,
  },
  posterImage: {
    width: POSTER_WIDTH,
    height: POSTER_HEIGHT,
    borderRadius: 6,
    backgroundColor: '#1a1a1a',
  },
  posterPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  posterTitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    marginTop: 6,
  },

  // Empty
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginTop: 20,
  },
  emptySubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },

  // ============= FEED STYLES =============
  feedContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  feedLoadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedEmptyContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  feedEmptyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
  },
  feedEmptyTabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 24,
  },
  feedEmptyContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedEmptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginTop: 20,
  },
  feedEmptySubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  feedHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 12,
    zIndex: 100,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  feedHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  feedHeaderActions: {
    flexDirection: 'row',
    gap: 8,
  },
  feedHeaderButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  feedHeaderTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  feedTabContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  feedTab: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'transparent',
  },
  feedTabActive: {
    backgroundColor: YELLOW,
    borderColor: YELLOW,
  },
  feedTabText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 15,
    fontWeight: '500',
  },
  feedTabTextActive: {
    color: '#000',
    fontSize: 15,
    fontWeight: '600',
  },

  // Video Item
  videoItemContainer: {
    width: SCREEN_WIDTH,
    backgroundColor: '#000',
    position: 'relative',
  },
  videoTouchable: {
    flex: 1,
  },
  video: {
    width: '100%',
    height: '100%',
  },
  playPauseIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playPauseCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Actions Column (right side)
  actionsColumn: {
    position: 'absolute',
    right: 12,
    bottom: 120,
    alignItems: 'center',
    gap: 16,
  },
  actionAvatarContainer: {
    marginBottom: 8,
  },
  actionAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#fff',
  },
  actionAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  actionAvatarEmoji: {
    fontSize: 22,
  },
  actionItem: {
    alignItems: 'center',
    gap: 2,
  },
  actionCount: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  respectEmojiLarge: {
    fontSize: 28,
    opacity: 0.7,
  },
  respectActiveLarge: {
    opacity: 1,
  },

  // Video Info (bottom)
  videoInfo: {
    position: 'absolute',
    left: 12,
    right: 80,
    bottom: 100,
  },
  videoUsername: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  videoCaption: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  videoTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  videoTag: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  videoTagText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  videoTime: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  spotChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    maxWidth: '100%',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderWidth: 1,
    borderColor: `${YELLOW}80`,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    marginBottom: 8,
  },
  spotChipText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
});
