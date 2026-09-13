/**
 * Events Discovery
 * Cursor-paginated events archive with search + sport/date filters.
 * Mirrors the web /events MVP.
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
import { getEvents, type TrickEvent } from '@/lib/api/events';
import { formatEventDate, formatEventLocation, isUpcoming } from '@/lib/eventFormat';
import { useThemeContext } from '@/lib/providers/ThemeProvider';

const SPORTS = ['', 'skateboarding', 'snowboarding', 'bmx', 'skiing', 'surfing'];
const SPORT_LABELS: Record<string, string> = {
  '': 'All',
  skateboarding: 'Skate',
  snowboarding: 'Snow',
  bmx: 'BMX',
  skiing: 'Ski',
  surfing: 'Surf',
};
const DATES: { key: string; label: string }[] = [
  { key: '', label: 'Any time' },
  { key: 'weekend', label: 'This weekend' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
];

function EventCard({
  event,
  theme,
}: {
  event: TrickEvent;
  theme: ReturnType<typeof useThemeContext>['theme'];
}) {
  const location = formatEventLocation(event);
  const upcoming = isUpcoming(event);
  const regOpen = event.participation?.registrationStatus === 'open';
  return (
    <Pressable
      style={[styles.card, { backgroundColor: theme.surface }]}
      onPress={() => router.push(`/(tabs)/events/${event.slug}`)}
    >
      {event.image ? (
        <Image source={{ uri: event.image }} style={styles.cardImage} contentFit="cover" />
      ) : (
        <View
          style={[
            styles.cardImage,
            styles.cardImageFallback,
            { backgroundColor: theme.background },
          ]}
        >
          <Ionicons name="calendar-outline" size={28} color={theme.textSecondary} />
        </View>
      )}
      <View style={styles.cardBody}>
        <View style={styles.cardMetaRow}>
          <Text style={[styles.cardDate, { color: '#806D00' }]}>{formatEventDate(event)}</Text>
          {!upcoming && (
            <View style={[styles.pastPill, { backgroundColor: theme.background }]}>
              <Text style={[styles.pastPillText, { color: theme.textSecondary }]}>Past</Text>
            </View>
          )}
          {regOpen && upcoming && (
            <View style={styles.regPill}>
              <Text style={styles.regPillText}>Registration open</Text>
            </View>
          )}
        </View>
        <Text numberOfLines={2} style={[styles.cardTitle, { color: theme.text }]}>
          {event.title}
        </Text>
        {location ? (
          <View style={styles.cardLocationRow}>
            <Ionicons name="location-outline" size={13} color={theme.textSecondary} />
            <Text numberOfLines={1} style={[styles.cardLocation, { color: theme.textSecondary }]}>
              {location}
            </Text>
          </View>
        ) : null}
        {event.sports && event.sports.length > 0 ? (
          <Text numberOfLines={1} style={[styles.cardSports, { color: theme.textSecondary }]}>
            {event.sports.map((s) => SPORT_LABELS[s] ?? s).join(' · ')}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export default function EventsDiscovery() {
  const { theme } = useThemeContext();
  const [query, setQuery] = useState('');
  const [sport, setSport] = useState('');
  const [date, setDate] = useState('');
  const [events, setEvents] = useState<TrickEvent[]>([]);
  const [cursor, setCursor] = useState<string | number | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const reqId = useRef(0);

  useEffect(() => {
    const id = ++reqId.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const result = await getEvents({ q: query, sport, date });
        if (id !== reqId.current) return;
        setEvents(result.events);
        setCursor(result.nextCursor);
        setTotal(result.totalCount);
      } catch {
        if (id === reqId.current) setError('Events could not be loaded. Try again in a moment.');
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, sport, date]);

  const loadMore = useCallback(async () => {
    if (loadingMore || loading || cursor === null) return;
    setLoadingMore(true);
    try {
      const result = await getEvents({ q: query, sport, date }, cursor);
      setEvents((prev) => [...prev, ...result.events]);
      setCursor(result.nextCursor);
    } catch {
      // Keep what we have; the footer just stops advancing.
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loading, loadingMore, query, sport, date]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Events</Text>
        <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
          Contests, premieres, and sessions across action sports.
        </Text>
      </View>

      <View style={[styles.searchBar, { backgroundColor: theme.surface }]}>
        <Ionicons name="search" size={18} color={theme.textSecondary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search events"
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
                  {SPORT_LABELS[item] ?? item}
                </Text>
              </Pressable>
            );
          }}
        />
      </View>

      <View style={styles.filterRow}>
        <FlatList
          horizontal
          data={DATES}
          keyExtractor={(item) => item.key || 'any'}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContent}
          renderItem={({ item }) => {
            const active = date === item.key;
            return (
              <Pressable
                onPress={() => setDate(item.key)}
                style={[styles.datePill, { borderColor: active ? '#FCF150' : theme.border }]}
              >
                <Text
                  style={[
                    styles.datePillText,
                    { color: active ? theme.text : theme.textSecondary },
                  ]}
                >
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
      ) : error ? (
        <View style={styles.centered}>
          <Text style={[styles.errorText, { color: theme.textSecondary }]}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          renderItem={({ item }) => <EventCard event={item} theme={theme} />}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={[styles.errorText, { color: theme.textSecondary }]}>
                No events match your filters.
              </Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator color="#FCF150" style={styles.footerSpinner} />
            ) : total !== null && events.length > 0 ? (
              <Text style={[styles.count, { color: theme.textSecondary }]}>
                {events.length} of {total} events
              </Text>
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
  datePill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  datePillText: { fontSize: 13, fontWeight: '500' },
  listContent: { paddingHorizontal: 16, paddingBottom: 24, paddingTop: 8 },
  card: { borderRadius: 14, marginTop: 12, overflow: 'hidden' },
  cardImage: { width: '100%', height: 140 },
  cardImageFallback: { alignItems: 'center', justifyContent: 'center' },
  cardBody: { padding: 12 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  cardDate: { fontSize: 13, fontWeight: '700' },
  pastPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  pastPillText: { fontSize: 11, fontWeight: '600' },
  regPill: {
    backgroundColor: '#FCF150',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  regPillText: { fontSize: 11, fontWeight: '700', color: '#1f1f1f' },
  cardTitle: { fontSize: 17, fontWeight: '700', lineHeight: 22 },
  cardLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  cardLocation: { fontSize: 13, flex: 1 },
  cardSports: { fontSize: 12, marginTop: 4 },
  centered: { paddingVertical: 48, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: 14, textAlign: 'center', paddingHorizontal: 24 },
  footerSpinner: { marginVertical: 20 },
  count: { fontSize: 12, textAlign: 'center', marginVertical: 18 },
});
