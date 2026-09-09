/**
 * Editorial Rider Detail
 * Curated pro profile: hero, rep score breakdown, bio, sponsors, notable
 * results, film credits (deep-linked into Couch), and sources.
 */

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type EditorialRider, getEditorialRider } from '@/lib/api/riders';
import { useThemeContext } from '@/lib/providers/ThemeProvider';

function Chip({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <View style={[styles.tag, { backgroundColor: bg }]}>
      <Text style={[styles.tagText, { color }]}>{label}</Text>
    </View>
  );
}

function useEditorialRider(slug: string) {
  const [rider, setRider] = useState<EditorialRider | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await getEditorialRider(slug);
        if (active) setRider(data);
      } catch {
        if (active) setError('This rider profile could not be loaded.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [slug]);

  return { rider, loading, error };
}

type Theme = ReturnType<typeof useThemeContext>['theme'];

export default function RiderDetail() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { theme } = useThemeContext();
  const { rider, loading, error } = useEditorialRider(String(slug));

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, styles.centered, { backgroundColor: theme.background }]}
      >
        <ActivityIndicator color="#FCF150" />
      </SafeAreaView>
    );
  }

  if (error || !rider) {
    return (
      <SafeAreaView
        style={[styles.container, styles.centered, { backgroundColor: theme.background }]}
        edges={['top']}
      >
        <Pressable style={styles.backFloating} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.errorText, { color: theme.textSecondary }]}>
          {error || 'Rider not found.'}
        </Text>
      </SafeAreaView>
    );
  }

  return <RiderProfileBody rider={rider} theme={theme} />;
}

function RiderProfileBody({ rider, theme }: { rider: EditorialRider; theme: Theme }) {
  const openFilm = useCallback((filmSlug?: string) => {
    if (!filmSlug) return;
    router.push(`/(tabs)/media/video/${filmSlug}`);
  }, []);

  const hero = rider.heroImage?.url ?? rider.profileImage?.url;
  const years = rider.activeYears;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
          <Text style={[styles.backText, { color: theme.text }]}>Riders</Text>
        </Pressable>

        <View style={styles.heroRow}>
          <View style={[styles.heroAvatar, { backgroundColor: theme.surface }]}>
            {hero ? (
              <Image source={{ uri: hero }} style={styles.heroAvatarImg} contentFit="cover" />
            ) : (
              <Ionicons name="person" size={40} color={theme.textSecondary} />
            )}
          </View>
          <View style={styles.heroInfo}>
            <Text style={[styles.name, { color: theme.text }]}>{rider.canonicalName}</Text>
            {rider.primarySport ? (
              <Text style={[styles.sport, { color: theme.textSecondary }]}>
                {rider.primarySport}
                {rider.homeRegion ? ` · ${rider.homeRegion}` : ''}
                {rider.nationality ? ` · ${rider.nationality}` : ''}
              </Text>
            ) : null}
            {typeof rider.rep?.score === 'number' && (
              <View style={styles.repBadge}>
                <Ionicons name="star" size={13} color="#1f1f1f" />
                <Text style={styles.repText}>Rep {Math.round(rider.rep.score)}</Text>
              </View>
            )}
          </View>
        </View>

        {rider.rep?.breakdown && (
          <View style={[styles.card, { backgroundColor: theme.surface }]}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>Rep score</Text>
            {(
              [
                ['Video parts', rider.rep.breakdown.parts],
                ['Contest results', rider.rep.breakdown.results],
                ['Social reach', rider.rep.breakdown.social],
                ['Longevity', rider.rep.breakdown.longevity],
                ['Evidence', rider.rep.breakdown.evidence],
              ] as const
            ).map(([label, value]) => (
              <View key={label} style={styles.repRow}>
                <Text style={[styles.repLabel, { color: theme.textSecondary }]}>{label}</Text>
                <Text style={[styles.repValue, { color: theme.text }]}>
                  {Math.round(value ?? 0)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {rider.biography ? (
          <View style={[styles.card, { backgroundColor: theme.surface }]}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>Bio</Text>
            <Text style={[styles.body, { color: theme.textSecondary }]}>{rider.biography}</Text>
            {years?.from ? (
              <Text style={[styles.meta, { color: theme.textSecondary }]}>
                Active {years.from}
                {years.to ? `–${years.to}` : '–present'}
              </Text>
            ) : null}
          </View>
        ) : null}

        {rider.disciplines && rider.disciplines.length > 0 ? (
          <View style={styles.tagsWrap}>
            {rider.disciplines.map((d) => (
              <Chip key={d} label={d} color={theme.text} bg={theme.surface} />
            ))}
          </View>
        ) : null}

        {rider.sponsors && rider.sponsors.length > 0 ? (
          <View style={[styles.card, { backgroundColor: theme.surface }]}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>Sponsors</Text>
            <Text style={[styles.body, { color: theme.textSecondary }]}>
              {rider.sponsors.join(' · ')}
            </Text>
          </View>
        ) : null}

        {rider.notableResults && rider.notableResults.length > 0 ? (
          <View style={[styles.card, { backgroundColor: theme.surface }]}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>Notable results</Text>
            {rider.notableResults.slice(0, 8).map((r, i) => (
              <View key={`${r.event}-${i}`} style={styles.resultRow}>
                <Text style={[styles.resultPlace, { color: '#FCF150' }]}>{r.placement ?? '—'}</Text>
                <Text style={[styles.resultEvent, { color: theme.textSecondary }]}>
                  {r.event}
                  {r.year ? ` (${r.year})` : ''}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {rider.couchCredits && rider.couchCredits.length > 0 ? (
          <View style={[styles.card, { backgroundColor: theme.surface }]}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>On The Couch</Text>
            {rider.couchCredits
              .filter((c) => c.filmTitle)
              .slice(0, 12)
              .map((c, i) => (
                <Pressable
                  key={`${c.filmSlug}-${i}`}
                  style={styles.creditRow}
                  onPress={() => openFilm(c.filmSlug)}
                  disabled={!c.filmSlug}
                >
                  <Ionicons name="film-outline" size={16} color={theme.textSecondary} />
                  <Text numberOfLines={1} style={[styles.creditTitle, { color: theme.text }]}>
                    {c.filmTitle}
                  </Text>
                  {c.filmSlug ? (
                    <Ionicons name="chevron-forward" size={15} color={theme.textSecondary} />
                  ) : null}
                </Pressable>
              ))}
          </View>
        ) : null}

        {rider.officialWebsite ? (
          <Pressable
            style={[styles.linkBtn, { borderColor: theme.border }]}
            onPress={() => rider.officialWebsite && Linking.openURL(rider.officialWebsite)}
          >
            <Ionicons name="globe-outline" size={18} color={theme.text} />
            <Text style={[styles.linkText, { color: theme.text }]}>Official website</Text>
          </Pressable>
        ) : null}

        <View style={styles.spacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16, paddingBottom: 32 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 12 },
  backFloating: { position: 'absolute', top: 12, left: 12 },
  backText: { fontSize: 16, fontWeight: '600' },
  heroRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  heroAvatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heroAvatarImg: { width: 96, height: 96 },
  heroInfo: { flex: 1 },
  name: { fontSize: 24, fontWeight: '800' },
  sport: { fontSize: 14, marginTop: 3 },
  repBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: '#FCF150',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: 8,
  },
  repText: { fontSize: 13, fontWeight: '800', color: '#1f1f1f' },
  card: { borderRadius: 14, padding: 14, marginTop: 14 },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  body: { fontSize: 14, lineHeight: 20 },
  meta: { fontSize: 12, marginTop: 8 },
  repRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  repLabel: { fontSize: 13 },
  repValue: { fontSize: 13, fontWeight: '700' },
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  tag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  tagText: { fontSize: 13, fontWeight: '600' },
  resultRow: { flexDirection: 'row', gap: 10, paddingVertical: 4 },
  resultPlace: { fontSize: 13, fontWeight: '800', width: 64 },
  resultEvent: { fontSize: 13, flex: 1 },
  creditRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  creditTitle: { fontSize: 14, flex: 1 },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 16,
    justifyContent: 'center',
  },
  linkText: { fontSize: 15, fontWeight: '600' },
  errorText: { fontSize: 14, textAlign: 'center', paddingHorizontal: 24 },
  spacer: { height: 24 },
});
