/**
 * Riders Directory (Pros)
 * The curated, rep-scored editorial pro riders — each links to a full profile
 * that ties into their films/clips. Rendered standalone by the (hidden) /riders
 * route and embedded inside the Riders tab's "Pros" segment. TrickBook app users
 * you can add as homies live in the Find segment, not here.
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

const SPORTS = ['', 'Skateboarding', 'BMX', 'Snowboarding', 'Skiing', 'Surfing', 'Wakeboarding'];
const PAGE_SIZE = 24;

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export default function RidersScreen() {
  return <RidersDirectory />;
}

/**
 * The Riders directory body — editorial pros only, paginated + searchable.
 * `embedded` skips the outer SafeAreaView + page header so it sits under the
 * Riders tab chrome.
 */
export function RidersDirectory({ embedded = false }: { embedded?: boolean }) {
  const { theme } = useThemeContext();
  const [query, setQuery] = useState('');
  const [sport, setSport] = useState('');
  const [pros, setPros] = useState<EditorialRider[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const reqId = useRef(0);

  // Reset + fetch page 1 whenever the query or sport changes (debounced).
  useEffect(() => {
    const id = ++reqId.current;
    setLoading(true);
    setError('');
    const timer = setTimeout(async () => {
      try {
        const data = await getEditorialRiders({ q: query, sport, page: 1, limit: PAGE_SIZE });
        if (id !== reqId.current) return;
        setPros(data.items ?? []);
        setPage(1);
        setPages(data.pages ?? 1);
        setTotal(data.total ?? 0);
      } catch {
        if (id === reqId.current) setError('The riders directory could not be loaded.');
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, sport]);

  const loadMore = async () => {
    if (loadingMore || loading || page >= pages) return;
    const id = reqId.current;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const data = await getEditorialRiders({ q: query, sport, page: next, limit: PAGE_SIZE });
      if (id !== reqId.current) return;
      setPros((prev) => [...prev, ...(data.items ?? [])]);
      setPage(next);
    } catch {
      // stop advancing on error
    } finally {
      if (id === reqId.current) setLoadingMore(false);
    }
  };

  const Container = embedded ? View : SafeAreaView;
  const containerProps = embedded ? {} : { edges: ['top'] as const };

  return (
    <Container
      style={[styles.container, { backgroundColor: theme.background }]}
      {...containerProps}
    >
      {embedded ? null : (
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Riders</Text>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            The pros progressing action sports.
          </Text>
        </View>
      )}

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
      ) : error ? (
        <View style={styles.centered}>
          <Text style={[styles.errorText, { color: theme.textSecondary }]}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={pros}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListHeaderComponent={
            total > 0 ? (
              <Text style={[styles.count, { color: theme.textSecondary }]}>
                {total} pro{total === 1 ? '' : 's'}
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={[styles.errorText, { color: theme.textSecondary }]}>
                No pros match your search yet.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={[styles.memberRow, { backgroundColor: theme.surface }]}
              onPress={() => router.push(`/(tabs)/riders/${item.slug}`)}
            >
              <View style={[styles.memberAvatar, { backgroundColor: theme.background }]}>
                {item.profileImage?.url || item.heroImage?.url ? (
                  <Image
                    source={{ uri: item.profileImage?.url ?? item.heroImage?.url }}
                    style={styles.memberAvatarImg}
                  />
                ) : (
                  <Text style={[styles.avatarInitials, { color: theme.textSecondary }]}>
                    {initials(item.canonicalName)}
                  </Text>
                )}
              </View>
              <View style={styles.memberInfo}>
                <Text numberOfLines={1} style={[styles.memberName, { color: theme.text }]}>
                  {item.canonicalName}
                </Text>
                {item.primarySport ? (
                  <Text
                    numberOfLines={1}
                    style={[styles.memberSports, { color: theme.textSecondary }]}
                  >
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
    </Container>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  headerTitle: { fontSize: 30, fontWeight: '800' },
  headerSubtitle: { fontSize: 14, marginTop: 2 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 10,
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
  listContent: { paddingHorizontal: 16, paddingBottom: 24, paddingTop: 4 },
  count: { fontSize: 13, marginBottom: 8, marginTop: 4 },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    gap: 12,
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  memberAvatarImg: { width: 48, height: 48 },
  avatarInitials: { fontSize: 18, fontWeight: '700' },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 16, fontWeight: '700' },
  memberSports: { fontSize: 13, marginTop: 2 },
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
  centered: { paddingVertical: 48, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: 14, textAlign: 'center', paddingHorizontal: 24 },
  footer: { marginVertical: 20 },
});
