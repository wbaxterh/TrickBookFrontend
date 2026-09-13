/**
 * All Pros — the full editorial (curated) rider directory, paginated with
 * search + sport filter. Reached via "See all" on the Riders segment's
 * Pros shelf. Rows deep-link to the editorial profile.
 */

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type EditorialRider, getEditorialRiders } from '@/lib/api/riders';
import { useThemeContext } from '@/lib/providers/ThemeProvider';

const SPORTS = ['', 'Skateboarding', 'Snowboarding', 'BMX', 'Skiing', 'Surfing', 'Wakeboarding'];

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export default function AllProsScreen() {
  const { theme } = useThemeContext();
  const [query, setQuery] = useState('');
  const [sport, setSport] = useState('');
  const [pros, setPros] = useState<EditorialRider[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const reqId = useRef(0);

  // Reset + fetch page 1 whenever the query or sport changes (debounced).
  useEffect(() => {
    const id = ++reqId.current;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const data = await getEditorialRiders({ q: query, sport, page: 1, limit: 24 });
        if (id !== reqId.current) return;
        setPros(data.items ?? []);
        setPage(1);
        setPages(data.pages ?? 1);
        setTotal(data.total ?? 0);
      } catch {
        if (id === reqId.current) setPros([]);
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, sport]);

  const loadMore = async () => {
    if (loadingMore || loading || page >= pages) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const data = await getEditorialRiders({ q: query, sport, page: next, limit: 24 });
      setPros((prev) => [...prev, ...(data.items ?? [])]);
      setPage(next);
    } catch {
      // stop advancing on error
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>All Pros</Text>
        <View style={styles.backSpacer} />
      </View>

      <View style={[styles.searchBar, { backgroundColor: theme.surface }]}>
        <Ionicons name="search" size={18} color={theme.textSecondary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search pros"
          placeholderTextColor={theme.textSecondary}
          style={[styles.searchInput, { color: theme.text }]}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
          </Pressable>
        )}
      </View>

      <View style={styles.filterRow}>
        <FlatList
          horizontal
          data={SPORTS}
          keyExtractor={(item) => item || 'all'}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContent}
          renderItem={({ item }) => {
            const active = sport === item;
            return (
              <Pressable
                onPress={() => setSport(item)}
                style={[styles.chip, { backgroundColor: active ? '#FCF150' : theme.surface }]}
              >
                <Text style={[styles.chipText, { color: active ? '#1f1f1f' : theme.text }]}>
                  {item || 'All'}
                </Text>
              </Pressable>
            );
          }}
        />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#FCF150" />
        </View>
      ) : (
        <FlatList
          data={pros}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListHeaderComponent={
            total > 0 ? (
              <Text style={[styles.count, { color: theme.textSecondary }]}>
                {total} pro{total === 1 ? '' : 's'}
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                No pros match your search.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={[styles.row, { backgroundColor: theme.surface }]}
              onPress={() => router.push(`/(tabs)/riders/${item.slug}`)}
            >
              <View style={[styles.avatar, { backgroundColor: theme.background }]}>
                {item.profileImage?.url || item.heroImage?.url ? (
                  <Image
                    source={{ uri: item.profileImage?.url ?? item.heroImage?.url }}
                    style={styles.avatarImg}
                  />
                ) : (
                  <Text style={[styles.avatarInitials, { color: theme.textSecondary }]}>
                    {initials(item.canonicalName)}
                  </Text>
                )}
              </View>
              <View style={styles.info}>
                <Text numberOfLines={1} style={[styles.name, { color: theme.text }]}>
                  {item.canonicalName}
                </Text>
                {item.primarySport ? (
                  <Text numberOfLines={1} style={[styles.sport, { color: theme.textSecondary }]}>
                    {item.primarySport}
                    {item.homeRegion ? ` · ${item.homeRegion}` : ''}
                  </Text>
                ) : null}
              </View>
              {typeof item.rep?.score === 'number' && (
                <View style={styles.repBadge}>
                  <Ionicons name="star" size={11} color="#1f1f1f" />
                  <Text style={styles.repText}>{Math.round(item.rep.score)}</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
            </Pressable>
          )}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator color="#FCF150" style={styles.footer} /> : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  back: { padding: 4 },
  backSpacer: { width: 32 },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    height: 44,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 16 },
  filterRow: { marginTop: 10 },
  filterContent: { paddingHorizontal: 16, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999 },
  chipText: { fontSize: 13, fontWeight: '600' },
  listContent: { paddingHorizontal: 16, paddingBottom: 24, paddingTop: 8 },
  count: { fontSize: 13, marginBottom: 8, marginTop: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: 48, height: 48 },
  avatarInitials: { fontSize: 18, fontWeight: '700' },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: '700' },
  sport: { fontSize: 13, marginTop: 2 },
  repBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#FCF150',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  repText: { fontSize: 12, fontWeight: '800', color: '#1f1f1f' },
  centered: { paddingVertical: 48, alignItems: 'center' },
  emptyText: { fontSize: 14, textAlign: 'center', paddingHorizontal: 24 },
  footer: { marginVertical: 20 },
});
