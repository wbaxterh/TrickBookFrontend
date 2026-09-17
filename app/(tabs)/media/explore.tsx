/**
 * Explore All — the full Couch catalog (900+ videos), paginated with search +
 * sport filter. Reached from the Couch header/search affordance. The Couch home
 * only surfaces the first ~100 grouped into rows; this screen lets you scan and
 * search the entire index. Posters deep-link to the in-app video detail screen.
 */

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type CouchVideo, getThumbnailUrl, getVideos } from '@/lib/api/couch';

const YELLOW = '#FCF150';
const PAGE_SIZE = 30;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_PADDING = 12;
const GRID_GAP = 10;
const NUM_COLUMNS = 3;
const POSTER_WIDTH = Math.floor(
  (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS,
);
const POSTER_HEIGHT = Math.round(POSTER_WIDTH * 1.5);

// Filter chips use the sport values as stored in the catalog (see couch docs).
// Labels are humanized; '' means "All".
const SPORT_FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'snowboarding', label: 'Snowboarding' },
  { value: 'skateboarding', label: 'Skateboarding' },
  { value: 'surf', label: 'Surf' },
  { value: 'scooter', label: 'Scooter' },
  { value: 'rollerblading', label: 'Rollerblading' },
  { value: 'mtb', label: 'MTB' },
  { value: 'bmx', label: 'BMX' },
  { value: 'wakeboarding', label: 'Wakeboarding' },
  { value: 'skiing', label: 'Skiing' },
];

export default function ExploreVideosScreen() {
  const [query, setQuery] = useState('');
  const [sport, setSport] = useState('');
  const [sort, setSort] = useState<'releaseYear' | 'popular'>('releaseYear');
  const [videos, setVideos] = useState<CouchVideo[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  // Guards against stale responses when the query/sport/sort changes rapidly.
  const reqId = useRef(0);

  // Reset + fetch page 1 whenever the query, sport, or sort changes (debounced).
  useEffect(() => {
    const id = ++reqId.current;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const data = await getVideos({ q: query, sport, sort, limit: PAGE_SIZE, page: 1 });
        if (id !== reqId.current) return;
        setVideos(data);
        setPage(1);
        setHasMore(data.length === PAGE_SIZE);
      } catch {
        if (id === reqId.current) setVideos([]);
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, sport, sort]);

  const loadMore = async () => {
    if (loadingMore || loading || !hasMore) return;
    const id = reqId.current;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const data = await getVideos({ q: query, sport, sort, limit: PAGE_SIZE, page: next });
      // Ignore if the filters changed while this page was in flight.
      if (id !== reqId.current) return;
      setVideos((prev) => [...prev, ...data]);
      setPage(next);
      setHasMore(data.length === PAGE_SIZE);
    } catch {
      // stop advancing on error
    } finally {
      if (id === reqId.current) setLoadingMore(false);
    }
  };

  const headerLabel = useMemo(() => {
    const active = SPORT_FILTERS.find((s) => s.value === sport);
    return active && active.value ? active.label : 'All Videos';
  }, [sport]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {headerLabel}
        </Text>
        <Pressable
          style={styles.back}
          hitSlop={8}
          onPress={() => setSort((s) => (s === 'releaseYear' ? 'popular' : 'releaseYear'))}
        >
          <Ionicons
            name={sort === 'popular' ? 'flame' : 'time-outline'}
            size={20}
            color={sort === 'popular' ? YELLOW : '#fff'}
          />
        </Pressable>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color="rgba(255,255,255,0.5)" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search all videos"
          placeholderTextColor="rgba(255,255,255,0.5)"
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.5)" />
          </Pressable>
        )}
      </View>

      <View style={styles.filterRow}>
        <FlatList
          horizontal
          data={SPORT_FILTERS}
          keyExtractor={(item) => item.value || 'all'}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContent}
          renderItem={({ item }) => {
            const active = sport === item.value;
            return (
              <Pressable
                onPress={() => setSport(item.value)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.label}</Text>
              </Pressable>
            );
          }}
        />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={YELLOW} />
        </View>
      ) : (
        <FlatList
          data={videos}
          keyExtractor={(item) => item._id}
          numColumns={NUM_COLUMNS}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.listContent}
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListEmptyComponent={
            <View style={styles.centered}>
              <Ionicons name="film-outline" size={48} color="rgba(255,255,255,0.4)" />
              <Text style={styles.emptyText}>
                {query ? `No videos match “${query}”.` : 'No videos found.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => <ExplorePoster video={item} />}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator color={YELLOW} style={styles.footer} /> : null
          }
        />
      )}
    </SafeAreaView>
  );
}

function ExplorePoster({ video }: { video: CouchVideo }) {
  const posterUri = getThumbnailUrl(video);
  return (
    <Pressable
      style={styles.poster}
      onPress={() => router.push(`/(tabs)/media/video/${video._id}`)}
    >
      {posterUri ? (
        <Image source={{ uri: posterUri }} style={styles.posterImage} contentFit="cover" />
      ) : (
        <View style={[styles.posterImage, styles.posterPlaceholder]}>
          <Ionicons name="film-outline" size={28} color="rgba(255,255,255,0.5)" />
        </View>
      )}
      <Text style={styles.posterTitle} numberOfLines={2}>
        {video.title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  back: { padding: 4, minWidth: 32, alignItems: 'center' },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '800', color: '#fff', textAlign: 'center' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    height: 44,
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  searchInput: { flex: 1, fontSize: 16, color: '#fff' },
  filterRow: { marginTop: 10, marginBottom: 4 },
  filterContent: { paddingHorizontal: 16, gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  chipActive: { backgroundColor: YELLOW },
  chipText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  chipTextActive: { color: '#1f1f1f' },
  listContent: { paddingHorizontal: GRID_PADDING, paddingTop: 8, paddingBottom: 100 },
  columnWrapper: { gap: GRID_GAP, marginBottom: GRID_GAP + 6 },
  poster: { width: POSTER_WIDTH },
  posterImage: {
    width: POSTER_WIDTH,
    height: POSTER_HEIGHT,
    borderRadius: 6,
    backgroundColor: '#1a1a1a',
  },
  posterPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  posterTitle: { color: 'rgba(255,255,255,0.9)', fontSize: 12, marginTop: 6 },
  centered: { paddingVertical: 60, alignItems: 'center', gap: 12 },
  emptyText: { fontSize: 14, color: 'rgba(255,255,255,0.6)', textAlign: 'center' },
  footer: { marginVertical: 24 },
});
