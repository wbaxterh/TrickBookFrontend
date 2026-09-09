/**
 * Event Detail
 * Full event: hero, date/venue, sports, description, save toggle, and
 * external links (official page, registration, tickets, stream, results).
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
import { getEvent, saveEvent, type TrickEvent, unsaveEvent } from '@/lib/api/events';
import { formatEventDate, formatEventLocation } from '@/lib/eventFormat';
import { useThemeContext } from '@/lib/providers/ThemeProvider';
import { useAuthStore } from '@/lib/stores/authStore';

type Theme = ReturnType<typeof useThemeContext>['theme'];

interface LinkAction {
  label: string;
  url: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
}

function collectLinks(event: TrickEvent): LinkAction[] {
  const links: LinkAction[] = [];
  if (event.participation?.registrationUrl) {
    links.push({
      label: 'Register',
      url: event.participation.registrationUrl,
      icon: 'clipboard-outline',
    });
  }
  if (event.spectating?.ticketUrl) {
    links.push({ label: 'Tickets', url: event.spectating.ticketUrl, icon: 'ticket-outline' });
  }
  if (event.spectating?.streamUrl) {
    links.push({ label: 'Watch stream', url: event.spectating.streamUrl, icon: 'tv-outline' });
  }
  if (event.resultsUrl) {
    links.push({ label: 'Results', url: event.resultsUrl, icon: 'trophy-outline' });
  }
  for (const link of event.externalLinks ?? []) {
    if (link.url) {
      links.push({ label: link.label || 'Event page', url: link.url, icon: 'open-outline' });
    }
  }
  return links;
}

function useEventDetail(slug: string) {
  const [event, setEvent] = useState<TrickEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await getEvent(slug);
        if (active) setEvent(data);
      } catch {
        if (active) setError('This event could not be loaded.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [slug]);

  return { event, loading, error };
}

export default function EventDetail() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { theme } = useThemeContext();
  const { event, loading, error } = useEventDetail(String(slug));

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, styles.centered, { backgroundColor: theme.background }]}
      >
        <ActivityIndicator color="#FCF150" />
      </SafeAreaView>
    );
  }

  if (error || !event) {
    return (
      <SafeAreaView
        style={[styles.container, styles.centered, { backgroundColor: theme.background }]}
        edges={['top']}
      >
        <Pressable style={styles.backFloating} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.errorText, { color: theme.textSecondary }]}>
          {error || 'Event not found.'}
        </Text>
      </SafeAreaView>
    );
  }

  return <EventBody event={event} theme={theme} />;
}

function EventBody({ event, theme }: { event: TrickEvent; theme: Theme }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [saved, setSaved] = useState(false);
  const [savePending, setSavePending] = useState(false);
  const location = formatEventLocation(event);
  const links = collectLinks(event);

  const toggleSave = useCallback(async () => {
    if (!isAuthenticated) {
      router.push('/(auth)/login');
      return;
    }
    if (savePending) return;
    setSavePending(true);
    const next = !saved;
    setSaved(next); // optimistic
    try {
      if (next) await saveEvent(event._id);
      else await unsaveEvent(event._id);
    } catch {
      setSaved(!next); // revert on failure
    } finally {
      setSavePending(false);
    }
  }, [isAuthenticated, saved, savePending, event._id]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.heroWrap}>
          {event.image ? (
            <Image source={{ uri: event.image }} style={styles.hero} contentFit="cover" />
          ) : (
            <View style={[styles.hero, styles.heroFallback, { backgroundColor: theme.surface }]}>
              <Ionicons name="calendar-outline" size={40} color={theme.textSecondary} />
            </View>
          )}
          <Pressable style={styles.backFloating} onPress={() => router.back()}>
            <View style={styles.backCircle}>
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </View>
          </Pressable>
        </View>

        <View style={styles.content}>
          <Text style={[styles.date, { color: '#806D00' }]}>{formatEventDate(event)}</Text>
          <Text style={[styles.title, { color: theme.text }]}>{event.title}</Text>

          {location ? (
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={16} color={theme.textSecondary} />
              <Text style={[styles.metaText, { color: theme.textSecondary }]}>
                {event.venue?.name ? `${event.venue.name} · ${location}` : location}
              </Text>
            </View>
          ) : null}
          {event.organizer?.name ? (
            <View style={styles.metaRow}>
              <Ionicons name="business-outline" size={16} color={theme.textSecondary} />
              <Text style={[styles.metaText, { color: theme.textSecondary }]}>
                {event.organizer.name}
              </Text>
            </View>
          ) : null}
          {event.sports && event.sports.length > 0 ? (
            <View style={styles.tagsWrap}>
              {event.sports.map((s) => (
                <View key={s} style={[styles.tag, { backgroundColor: theme.surface }]}>
                  <Text style={[styles.tagText, { color: theme.text }]}>{s}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <Pressable
            style={[styles.saveBtn, { backgroundColor: saved ? theme.surface : '#FCF150' }]}
            onPress={toggleSave}
          >
            <Ionicons
              name={saved ? 'bookmark' : 'bookmark-outline'}
              size={18}
              color={saved ? theme.text : '#1f1f1f'}
            />
            <Text style={[styles.saveText, { color: saved ? theme.text : '#1f1f1f' }]}>
              {saved ? 'Saved' : 'Save event'}
            </Text>
          </Pressable>

          {event.description ? (
            <Text style={[styles.body, { color: theme.textSecondary }]}>{event.description}</Text>
          ) : null}

          {event.resultsSummary ? (
            <View style={[styles.card, { backgroundColor: theme.surface }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Results</Text>
              <Text style={[styles.body, { color: theme.textSecondary }]}>
                {event.resultsSummary}
              </Text>
            </View>
          ) : null}

          {links.length > 0 ? (
            <View style={styles.links}>
              {links.map((link) => (
                <Pressable
                  key={link.url}
                  style={[styles.linkBtn, { borderColor: theme.border }]}
                  onPress={() => Linking.openURL(link.url)}
                >
                  <Ionicons name={link.icon} size={17} color={theme.text} />
                  <Text style={[styles.linkText, { color: theme.text }]}>{link.label}</Text>
                  <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingBottom: 32 },
  heroWrap: { position: 'relative' },
  hero: { width: '100%', height: 220 },
  heroFallback: { alignItems: 'center', justifyContent: 'center' },
  backFloating: { position: 'absolute', top: 12, left: 12 },
  backCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { padding: 16 },
  date: { fontSize: 14, fontWeight: '700' },
  title: { fontSize: 24, fontWeight: '800', marginTop: 4, lineHeight: 30 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  metaText: { fontSize: 14, flex: 1 },
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  tag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  tagText: { fontSize: 13, fontWeight: '600' },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 13,
    marginTop: 18,
  },
  saveText: { fontSize: 16, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 22, marginTop: 18 },
  card: { borderRadius: 14, padding: 14, marginTop: 18 },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
  links: { marginTop: 20, gap: 10 },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  linkText: { fontSize: 15, fontWeight: '600', flex: 1 },
  errorText: { fontSize: 14, textAlign: 'center', paddingHorizontal: 24 },
});
