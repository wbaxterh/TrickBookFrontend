/**
 * Riders Directory
 * Two data sources on one screen (mirrors the web /riders page):
 *  - Editorial pros (curated, rep-scored) shown as a horizontal shelf
 *  - Community members (network riders) in the main list, searchable + paged
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  type EditorialRider,
  getEditorialRiders,
  getNetworkRiders,
  type NetworkRider,
} from '@/lib/api/riders';
import { useThemeContext } from '@/lib/providers/ThemeProvider';

const SPORTS = ['', 'Skateboarding', 'BMX', 'Snowboarding', 'Skiing', 'Surfing', 'Wakeboarding'];

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export default function RidersDirectory() {
  const { theme } = useThemeContext();
  const [query, setQuery] = useState('');
  const [sport, setSport] = useState('');
  const [pros, setPros] = useState<EditorialRider[]>([]);
  const [members, setMembers] = useState<NetworkRider[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        // The pro shelf is additive — if it fails, the community directory
        // still renders.
        const [memberResult, proResult] = await Promise.allSettled([
          getNetworkRiders({ q: query, sport, page }),
          getEditorialRiders({ q: query, sport, limit: 12 }),
        ]);
        if (memberResult.status === 'rejected') throw memberResult.reason;
        const data = memberResult.value;
        setMembers(data.items ?? []);
        setPages(data.pages ?? 1);
        setTotal(data.total ?? 0);
        setPros(proResult.status === 'fulfilled' ? (proResult.value.items ?? []) : []);
      } catch {
        setError('The rider directory could not be loaded. Try again in a moment.');
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, sport, page]);

  const onQuery = useCallback((value: string) => {
    setQuery(value);
    setPage(1);
  }, []);

  const onSport = useCallback((value: string) => {
    setSport(value);
    setPage(1);
  }, []);

  const proShelf = useMemo(
    () =>
      pros.length > 0 ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Pros</Text>
          <FlatList
            horizontal
            data={pros}
            keyExtractor={(item) => item._id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.shelfContent}
            renderItem={({ item }) => (
              <Pressable
                style={[styles.proCard, { backgroundColor: theme.surface }]}
                onPress={() => router.push(`/(tabs)/riders/${item.slug}`)}
              >
                <View style={[styles.proAvatar, { backgroundColor: theme.background }]}>
                  {item.profileImage?.url || item.heroImage?.url ? (
                    <Image
                      source={{ uri: item.profileImage?.url ?? item.heroImage?.url }}
                      style={styles.proAvatarImg}
                    />
                  ) : (
                    <Text style={[styles.avatarInitials, { color: theme.textSecondary }]}>
                      {initials(item.canonicalName)}
                    </Text>
                  )}
                </View>
                <Text numberOfLines={1} style={[styles.proName, { color: theme.text }]}>
                  {item.canonicalName}
                </Text>
                {typeof item.rep?.score === 'number' && (
                  <View style={styles.repBadge}>
                    <Ionicons name="star" size={11} color="#1f1f1f" />
                    <Text style={styles.repText}>{Math.round(item.rep.score)}</Text>
                  </View>
                )}
                {item.primarySport ? (
                  <Text numberOfLines={1} style={[styles.proSport, { color: theme.textSecondary }]}>
                    {item.primarySport}
                  </Text>
                ) : null}
              </Pressable>
            )}
          />
        </View>
      ) : null,
    [pros, theme],
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Riders</Text>
        <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
          The people progressing action sports on TrickBook.
        </Text>
      </View>

      <View style={[styles.searchBar, { backgroundColor: theme.surface }]}>
        <Ionicons name="search" size={18} color={theme.textSecondary} />
        <TextInput
          value={query}
          onChangeText={onQuery}
          placeholder="Search riders"
          placeholderTextColor={theme.textSecondary}
          style={[styles.searchInput, { color: theme.text }]}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {query.length > 0 && (
          <Pressable onPress={() => onQuery('')} hitSlop={8}>
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
                onPress={() => onSport(item)}
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
          data={members}
          keyExtractor={(item) => item._id}
          ListHeaderComponent={proShelf}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={[styles.errorText, { color: theme.textSecondary }]}>
                No riders match your search yet.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={[styles.memberRow, { backgroundColor: theme.surface }]}
              onPress={() => router.push(`/(tabs)/profile/${item._id}`)}
            >
              <View style={[styles.memberAvatar, { backgroundColor: theme.background }]}>
                {item.imageUri ? (
                  <Image source={{ uri: item.imageUri }} style={styles.memberAvatarImg} />
                ) : (
                  <Text style={[styles.avatarInitials, { color: theme.textSecondary }]}>
                    {initials(item.name)}
                  </Text>
                )}
              </View>
              <View style={styles.memberInfo}>
                <Text numberOfLines={1} style={[styles.memberName, { color: theme.text }]}>
                  {item.name}
                </Text>
                {item.sports && item.sports.length > 0 ? (
                  <Text
                    numberOfLines={1}
                    style={[styles.memberSports, { color: theme.textSecondary }]}
                  >
                    {item.sports.join(' · ')}
                  </Text>
                ) : item.bio ? (
                  <Text
                    numberOfLines={1}
                    style={[styles.memberSports, { color: theme.textSecondary }]}
                  >
                    {item.bio}
                  </Text>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
            </Pressable>
          )}
          ListFooterComponent={
            pages > 1 ? (
              <View style={styles.pager}>
                <Pressable
                  disabled={page <= 1}
                  onPress={() => setPage((p) => Math.max(1, p - 1))}
                  style={[styles.pagerBtn, { opacity: page <= 1 ? 0.4 : 1 }]}
                >
                  <Ionicons name="chevron-back" size={18} color={theme.text} />
                </Pressable>
                <Text style={[styles.pagerText, { color: theme.textSecondary }]}>
                  Page {page} of {pages} · {total} riders
                </Text>
                <Pressable
                  disabled={page >= pages}
                  onPress={() => setPage((p) => Math.min(pages, p + 1))}
                  style={[styles.pagerBtn, { opacity: page >= pages ? 0.4 : 1 }]}
                >
                  <Ionicons name="chevron-forward" size={18} color={theme.text} />
                </Pressable>
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
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
  section: { marginTop: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', paddingHorizontal: 16, marginBottom: 8 },
  shelfContent: { paddingHorizontal: 16, gap: 12 },
  proCard: { width: 120, borderRadius: 14, padding: 12, alignItems: 'center' },
  proAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 8,
  },
  proAvatarImg: { width: 72, height: 72 },
  proName: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  proSport: { fontSize: 12, marginTop: 2 },
  repBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#FCF150',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    marginTop: 6,
  },
  repText: { fontSize: 12, fontWeight: '800', color: '#1f1f1f' },
  listContent: { paddingHorizontal: 16, paddingBottom: 24, paddingTop: 4 },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 10,
    marginTop: 10,
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
  centered: { paddingVertical: 48, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: 14, textAlign: 'center', paddingHorizontal: 24 },
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginTop: 18,
  },
  pagerBtn: { padding: 8 },
  pagerText: { fontSize: 13 },
});
