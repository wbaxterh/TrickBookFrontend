/**
 * GlobalSearch — one search box on the home screen that queries the whole app
 * (tricks, spots, riders, events, films) via client-side fan-out, and renders
 * grouped results that deep-link into each section.
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { type CouchVideo, searchFilms } from '@/lib/api/couch';
import { getEvents, type TrickEvent } from '@/lib/api/events';
import { type EditorialRider, getEditorialRiders } from '@/lib/api/riders';
import { type Spot, searchSpots } from '@/lib/api/spots';
import { getTricks } from '@/lib/api/trickbook';
import { useThemeContext } from '@/lib/providers/ThemeProvider';
import type { Trick } from '@/types/trickbook';

interface SearchResults {
  tricks: Trick[];
  spots: Spot[];
  riders: EditorialRider[];
  events: TrickEvent[];
  films: CouchVideo[];
}

const EMPTY: SearchResults = { tricks: [], spots: [], riders: [], events: [], films: [] };

async function runSearch(q: string): Promise<SearchResults> {
  const [tricks, spots, riders, events, films] = await Promise.all([
    getTricks({ search: q }).catch(() => []),
    searchSpots(q)
      .then((r) => r.spots ?? [])
      .catch(() => []),
    getEditorialRiders({ q, limit: 6 })
      .then((r) => r.items ?? [])
      .catch(() => []),
    getEvents({ q })
      .then((r) => r.events ?? [])
      .catch(() => []),
    searchFilms(q).catch(() => []),
  ]);
  // getTricks has no server search on some deployments — filter client-side too.
  const ql = q.toLowerCase();
  const filteredTricks = tricks.filter((t) => t.name?.toLowerCase().includes(ql)).slice(0, 6);
  return {
    tricks: filteredTricks,
    spots: spots.slice(0, 6),
    riders: riders.slice(0, 6),
    events: events.slice(0, 6),
    films: films.slice(0, 6),
  };
}

interface RowProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle?: string;
  onPress: () => void;
}

function ResultRow({ icon, title, subtitle, onPress }: RowProps) {
  const { theme } = useThemeContext();
  return (
    <Pressable style={[styles.row, { backgroundColor: theme.surface }]} onPress={onPress}>
      <Ionicons name={icon} size={18} color="#806D00" style={styles.rowIcon} />
      <View style={styles.rowText}>
        <Text numberOfLines={1} style={[styles.rowTitle, { color: theme.text }]}>
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} style={[styles.rowSubtitle, { color: theme.textSecondary }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
    </Pressable>
  );
}

export function GlobalSearch({ query }: { query: string }) {
  const { theme } = useThemeContext();
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [loading, setLoading] = useState(false);
  const reqId = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(EMPTY);
      setLoading(false);
      return;
    }
    const id = ++reqId.current;
    setLoading(true);
    const timer = setTimeout(async () => {
      const r = await runSearch(q);
      if (id === reqId.current) {
        setResults(r);
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const total =
    results.tricks.length +
    results.spots.length +
    results.riders.length +
    results.events.length +
    results.films.length;

  if (query.trim().length < 2) {
    return (
      <View style={styles.hint}>
        <Text style={[styles.hintText, { color: theme.textSecondary }]}>
          Search tricks, spots, riders, events, and films.
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#FCF150" />
      </View>
    );
  }

  if (total === 0) {
    return (
      <View style={styles.centered}>
        <Text style={[styles.hintText, { color: theme.textSecondary }]}>
          No results for “{query.trim()}”.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      <View>
        {results.tricks.length > 0 && (
          <Section title="Tricks" theme={theme}>
            {results.tricks.map((t) => (
              <ResultRow
                key={t._id}
                icon="book-outline"
                title={t.name}
                subtitle={t.category}
                onPress={() => router.push(`/(tabs)/trickbook/${t._id}`)}
              />
            ))}
          </Section>
        )}
        {results.riders.length > 0 && (
          <Section title="Riders" theme={theme}>
            {results.riders.map((r) => (
              <ResultRow
                key={r._id}
                icon="people-circle-outline"
                title={r.canonicalName}
                subtitle={r.primarySport}
                onPress={() => router.push(`/(tabs)/riders/${r.slug}`)}
              />
            ))}
          </Section>
        )}
        {results.spots.length > 0 && (
          <Section title="Spots" theme={theme}>
            {results.spots.map((s) => (
              <ResultRow
                key={s._id}
                icon="location-outline"
                title={s.name}
                subtitle={[s.city, s.state].filter(Boolean).join(', ')}
                onPress={() => router.push(`/(tabs)/spots/${s._id}`)}
              />
            ))}
          </Section>
        )}
        {results.events.length > 0 && (
          <Section title="Events" theme={theme}>
            {results.events.map((e) => (
              <ResultRow
                key={e._id}
                icon="calendar-outline"
                title={e.title}
                subtitle={e.venue?.city}
                onPress={() => router.push(`/(tabs)/events/${e.slug}`)}
              />
            ))}
          </Section>
        )}
        {results.films.length > 0 && (
          <Section title="Films" theme={theme}>
            {results.films.map((f) => (
              <ResultRow
                key={f._id}
                icon="film-outline"
                title={f.title}
                subtitle={f.releaseYear ? String(f.releaseYear) : undefined}
                onPress={() => router.push(`/(tabs)/media/video/${f._id}`)}
              />
            ))}
          </Section>
        )}
      </View>
    </View>
  );
}

function Section({
  title,
  theme,
  children,
}: {
  title: string;
  theme: ReturnType<typeof useThemeContext>['theme'];
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
        {title.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 24 },
  section: { marginBottom: 18 },
  sectionTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  rowIcon: { width: 20 },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '600' },
  rowSubtitle: { fontSize: 13, marginTop: 2 },
  centered: { paddingVertical: 40, alignItems: 'center' },
  hint: { paddingVertical: 32, alignItems: 'center', paddingHorizontal: 24 },
  hintText: { fontSize: 14, textAlign: 'center' },
});
