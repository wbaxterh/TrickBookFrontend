/**
 * Shops Directory
 * The core skate/board shop directory (mirrors the web /shops page). Rendered
 * standalone by the (hidden) /shops route and embedded inside the Spots tab's
 * "Shops" segment (embedded skips the outer SafeAreaView + page header so it
 * sits under the Spots chrome). Rows deep-link to the shop detail.
 */

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { formatShopLocation, formatSportLabel, getShops, type Shop } from '@/lib/api/shops';
import { useThemeContext } from '@/lib/providers/ThemeProvider';

const PAGE_SIZE = 20;

// Shop sport values as stored in the catalog; '' = All.
const SPORT_FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'skateboarding', label: 'Skate' },
  { value: 'snowboarding', label: 'Snow' },
  { value: 'surfing', label: 'Surf' },
  { value: 'bmx', label: 'BMX' },
  { value: 'mtb', label: 'MTB' },
  { value: 'skiing', label: 'Ski' },
];

export default function ShopsScreen() {
  return <ShopsDirectory />;
}

export function ShopsDirectory({ embedded = false }: { embedded?: boolean }) {
  const { theme } = useThemeContext();
  const [query, setQuery] = useState('');
  const [sport, setSport] = useState('');
  const [shops, setShops] = useState<Shop[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const reqId = useRef(0);

  // Reset + fetch first page when the query or sport changes (debounced).
  useEffect(() => {
    const id = ++reqId.current;
    setLoading(true);
    const timer = setTimeout(async () => {
      const data = await getShops({ q: query, sport, limit: PAGE_SIZE });
      if (id !== reqId.current) return;
      setShops(data.shops);
      setTotal(data.totalCount);
      setNextCursor(data.nextCursor);
      setLoading(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [query, sport]);

  const loadMore = useCallback(async () => {
    if (loadingMore || loading || !nextCursor) return;
    const id = reqId.current;
    setLoadingMore(true);
    const data = await getShops({ q: query, sport, cursor: nextCursor, limit: PAGE_SIZE });
    if (id === reqId.current) {
      setShops((prev) => [...prev, ...data.shops]);
      setNextCursor(data.nextCursor);
    }
    setLoadingMore(false);
  }, [loadingMore, loading, nextCursor, query, sport]);

  const Container = embedded ? View : SafeAreaView;
  const containerProps = embedded ? {} : { edges: ['top'] as const };

  return (
    <Container
      style={[styles.container, { backgroundColor: theme.background }]}
      {...containerProps}
    >
      {embedded ? null : (
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Shops</Text>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            Core skate & board shops worth supporting.
          </Text>
        </View>
      )}

      <View style={[styles.searchBar, { backgroundColor: theme.surface }]}>
        <Ionicons name="search" size={18} color={theme.textSecondary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search shops"
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
          data={SPORT_FILTERS}
          keyExtractor={(item) => item.value || 'all'}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContent}
          renderItem={({ item }) => {
            const active = sport === item.value;
            return (
              <Pressable
                onPress={() => setSport(item.value)}
                style={[styles.chip, { backgroundColor: active ? '#FCF150' : theme.surface }]}
              >
                <Text style={[styles.chipText, { color: active ? '#1f1f1f' : theme.text }]}>
                  {item.label}
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
          data={shops}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListHeaderComponent={
            total != null && total > 0 ? (
              <Text style={[styles.count, { color: theme.textSecondary }]}>
                {total} shop{total === 1 ? '' : 's'}
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.centered}>
              <Ionicons name="storefront-outline" size={44} color={theme.textSecondary} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                {query ? `No shops match "${query}".` : 'No shops found.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => <ShopRow shop={item} theme={theme} />}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator color="#FCF150" style={styles.footer} /> : null
          }
        />
      )}
    </Container>
  );
}

function ShopRow({ shop, theme }: { shop: Shop; theme: any }) {
  const location = formatShopLocation(shop);
  return (
    <Pressable
      style={[styles.row, { backgroundColor: theme.surface }]}
      onPress={() => router.push(`/(tabs)/shops/${shop.slug || shop._id}`)}
    >
      <View style={[styles.thumb, { backgroundColor: theme.background }]}>
        {shop.imageUrl ? (
          <Image source={{ uri: shop.imageUrl }} style={styles.thumbImg} contentFit="cover" />
        ) : (
          <Ionicons name="storefront" size={26} color="#FCF150" />
        )}
      </View>
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text numberOfLines={1} style={[styles.name, { color: theme.text }]}>
            {shop.name}
          </Text>
          {shop.verified && <Ionicons name="shield-checkmark" size={14} color="#10b981" />}
        </View>
        {location ? (
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={13} color={theme.textSecondary} />
            <Text numberOfLines={1} style={[styles.meta, { color: theme.textSecondary }]}>
              {location}
            </Text>
          </View>
        ) : null}
        {shop.sports && shop.sports.length > 0 ? (
          <View style={styles.badges}>
            {shop.sports.slice(0, 3).map((s) => (
              <View key={s} style={[styles.badge, { backgroundColor: `${'#FCF150'}20` }]}>
                <Text style={styles.badgeText}>{formatSportLabel(s)}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
    </Pressable>
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
  listContent: { paddingHorizontal: 16, paddingBottom: 24, paddingTop: 8 },
  count: { fontSize: 13, marginBottom: 8, marginTop: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    gap: 12,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImg: { width: 56, height: 56 },
  info: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 16, fontWeight: '700', flexShrink: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  meta: { fontSize: 13, flexShrink: 1 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  badgeText: { fontSize: 11, color: '#FCF150', fontWeight: '600' },
  centered: { paddingVertical: 56, alignItems: 'center', gap: 12 },
  emptyText: { fontSize: 14, textAlign: 'center', paddingHorizontal: 24 },
  footer: { marginVertical: 20 },
});
