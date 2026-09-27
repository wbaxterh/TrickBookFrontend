/**
 * Shop Detail
 * Full shop profile (mirrors web /shops/[slug]): info, sports/services, address
 * with directions, website/phone, hours, socials, team riders (link internally
 * to editorial rider profiles), and the comments thread.
 */

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  addShopComment,
  formatShopLocation,
  formatSportLabel,
  getShop,
  getShopComments,
  type Shop,
  type ShopComment,
} from '@/lib/api/shops';
import { useThemeContext } from '@/lib/providers/ThemeProvider';
import { useAuthStore } from '@/lib/stores/authStore';

const YELLOW = '#FCF150';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

function openMaps(shop: Shop) {
  const a = shop.address;
  let dest = '';
  if (a?.lat != null && a?.lng != null) dest = `${a.lat},${a.lng}`;
  else dest = [a?.street, a?.city, a?.region, a?.postalCode].filter(Boolean).join(', ');
  if (!dest) return;
  const url =
    Platform.OS === 'ios'
      ? `http://maps.apple.com/?daddr=${encodeURIComponent(dest)}`
      : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
  Linking.openURL(url).catch(() => {});
}

function openUrl(url?: string) {
  if (!url) return;
  const full = url.startsWith('http') ? url : `https://${url}`;
  Linking.openURL(full).catch(() => {});
}

export default function ShopDetailScreen() {
  const { slugOrId } = useLocalSearchParams<{ slugOrId: string }>();
  const { theme } = useThemeContext();
  const { user } = useAuthStore();

  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<ShopComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [posting, setPosting] = useState(false);

  const loadComments = useCallback(async () => {
    if (!slugOrId) return;
    const res = await getShopComments(slugOrId, { limit: 30 });
    setComments(res.comments);
  }, [slugOrId]);

  useEffect(() => {
    if (!slugOrId) return;
    (async () => {
      setLoading(true);
      const data = await getShop(slugOrId);
      setShop(data);
      setLoading(false);
      loadComments();
    })();
  }, [slugOrId, loadComments]);

  const handlePost = async () => {
    const text = commentText.trim();
    if (!text || !slugOrId) return;
    if (!user) {
      Alert.alert('Sign in required', 'Please sign in to leave a comment.');
      return;
    }
    setPosting(true);
    const created = await addShopComment(slugOrId, text);
    setPosting(false);
    if (created) {
      setCommentText('');
      loadComments();
    } else {
      Alert.alert('Error', 'Could not post your comment. Please try again.');
    }
  };

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
        edges={['top']}
      >
        <Header theme={theme} title="" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={YELLOW} />
        </View>
      </SafeAreaView>
    );
  }

  if (!shop) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
        edges={['top']}
      >
        <Header theme={theme} title="" />
        <View style={styles.centered}>
          <Ionicons name="storefront-outline" size={56} color={theme.textSecondary} />
          <Text style={[styles.emptyText, { color: theme.text }]}>Shop not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const location = formatShopLocation(shop);
  const fullAddress = [shop.address?.street, location, shop.address?.postalCode]
    .filter(Boolean)
    .join(', ');
  const socials = Object.entries(shop.socialLinks ?? {}).filter(([, v]) => !!v);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <Header theme={theme} title={shop.name} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Hero */}
          <View style={[styles.hero, { backgroundColor: theme.surface }]}>
            {shop.imageUrl ? (
              <Image source={{ uri: shop.imageUrl }} style={styles.heroImg} contentFit="cover" />
            ) : (
              <Ionicons name="storefront" size={56} color={YELLOW} />
            )}
          </View>

          {/* Title + verified */}
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: theme.text }]}>{shop.name}</Text>
            {shop.verified && <Ionicons name="shield-checkmark" size={20} color="#10b981" />}
          </View>

          {/* Sports */}
          {shop.sports && shop.sports.length > 0 && (
            <View style={styles.badges}>
              {shop.sports.map((s) => (
                <View key={s} style={[styles.badge, { backgroundColor: `${YELLOW}20` }]}>
                  <Text style={styles.badgeText}>{formatSportLabel(s)}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Description */}
          {shop.description ? (
            <Text style={[styles.description, { color: theme.textSecondary }]}>
              {shop.description}
            </Text>
          ) : null}

          {/* Action rows */}
          <View style={styles.actions}>
            {fullAddress ? (
              <ActionRow
                theme={theme}
                icon="navigate-outline"
                label={fullAddress}
                onPress={() => openMaps(shop)}
              />
            ) : null}
            {shop.phone ? (
              <ActionRow
                theme={theme}
                icon="call-outline"
                label={shop.phone}
                onPress={() => openUrl(`tel:${shop.phone}`)}
              />
            ) : null}
            {shop.website ? (
              <ActionRow
                theme={theme}
                icon="globe-outline"
                label={shop.website.replace(/^https?:\/\//, '')}
                onPress={() => openUrl(shop.website)}
              />
            ) : null}
          </View>

          {/* Services */}
          {shop.services && shop.services.length > 0 && (
            <Section title="Services" theme={theme}>
              <View style={styles.badges}>
                {shop.services.map((s) => (
                  <View key={s} style={[styles.serviceChip, { backgroundColor: theme.surface }]}>
                    <Text style={[styles.serviceText, { color: theme.textSecondary }]}>{s}</Text>
                  </View>
                ))}
              </View>
            </Section>
          )}

          {/* Team riders → link to editorial rider profiles */}
          {shop.teamRiders && shop.teamRiders.length > 0 && (
            <Section title="Team Riders" theme={theme}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.riderShelf}>
                  {shop.teamRiders.map((r) => {
                    const clickable = !!r.slug;
                    return (
                      <Pressable
                        key={`${r.name}-${r.slug ?? ''}`}
                        disabled={!clickable}
                        style={styles.riderCard}
                        onPress={() => clickable && router.push(`/(tabs)/riders/${r.slug}`)}
                      >
                        <View style={[styles.riderAvatar, { backgroundColor: theme.surface }]}>
                          {r.imageUrl ? (
                            <Image source={{ uri: r.imageUrl }} style={styles.riderAvatarImg} />
                          ) : (
                            <Text style={[styles.riderInitials, { color: theme.textSecondary }]}>
                              {initials(r.name)}
                            </Text>
                          )}
                        </View>
                        <Text numberOfLines={1} style={[styles.riderName, { color: theme.text }]}>
                          {r.name}
                        </Text>
                        {clickable && <Text style={styles.riderLink}>View</Text>}
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            </Section>
          )}

          {/* Hours */}
          {shop.hours && !Array.isArray(shop.hours) && Object.keys(shop.hours).length > 0 && (
            <Section title="Hours" theme={theme}>
              {Object.entries(shop.hours).map(([day, val]) => (
                <View key={day} style={styles.hourRow}>
                  <Text style={[styles.hourDay, { color: theme.text }]}>{day}</Text>
                  <Text style={[styles.hourVal, { color: theme.textSecondary }]}>
                    {String(val)}
                  </Text>
                </View>
              ))}
            </Section>
          )}

          {/* Socials */}
          {socials.length > 0 && (
            <Section title="Follow" theme={theme}>
              <View style={styles.badges}>
                {socials.map(([key, url]) => (
                  <Pressable
                    key={key}
                    style={[styles.serviceChip, { backgroundColor: theme.surface }]}
                    onPress={() => openUrl(url)}
                  >
                    <Text style={[styles.serviceText, { color: theme.textSecondary }]}>{key}</Text>
                  </Pressable>
                ))}
              </View>
            </Section>
          )}

          {/* Comments */}
          <Section
            title={`Comments${comments.length ? ` (${comments.length})` : ''}`}
            theme={theme}
          >
            <View style={[styles.commentBox, { backgroundColor: theme.surface }]}>
              <TextInput
                value={commentText}
                onChangeText={setCommentText}
                placeholder={user ? 'Add a comment…' : 'Sign in to comment'}
                placeholderTextColor={theme.textSecondary}
                editable={!!user && !posting}
                multiline
                style={[styles.commentInput, { color: theme.text }]}
              />
              <Pressable
                onPress={handlePost}
                disabled={!commentText.trim() || posting}
                style={[
                  styles.postBtn,
                  { backgroundColor: commentText.trim() ? YELLOW : theme.border },
                ]}
              >
                {posting ? (
                  <ActivityIndicator size="small" color="#1a1a1a" />
                ) : (
                  <Ionicons name="send" size={16} color="#1a1a1a" />
                )}
              </Pressable>
            </View>

            {comments.map((c) => (
              <View key={c._id} style={styles.comment}>
                <View style={[styles.commentAvatar, { backgroundColor: theme.surface }]}>
                  {c.user?.imageUri ? (
                    <Image source={{ uri: c.user.imageUri }} style={styles.commentAvatarImg} />
                  ) : (
                    <Text style={[styles.riderInitials, { color: theme.textSecondary }]}>
                      {initials(c.user?.name ?? '?')}
                    </Text>
                  )}
                </View>
                <View style={styles.commentBody}>
                  <Text style={[styles.commentAuthor, { color: theme.text }]}>
                    {c.user?.name ?? 'Rider'}
                  </Text>
                  <Text style={[styles.commentText, { color: theme.textSecondary }]}>
                    {c.content}
                  </Text>
                </View>
              </View>
            ))}
            {comments.length === 0 && (
              <Text style={[styles.noComments, { color: theme.textSecondary }]}>
                No comments yet. Be the first.
              </Text>
            )}
          </Section>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Header({ theme, title }: { theme: any; title: string }) {
  return (
    <View style={styles.header}>
      <Pressable hitSlop={8} onPress={() => router.back()} style={styles.back}>
        <Ionicons name="chevron-back" size={24} color={theme.text} />
      </Pressable>
      <Text numberOfLines={1} style={[styles.headerTitle, { color: theme.text }]}>
        {title}
      </Text>
      <View style={styles.back} />
    </View>
  );
}

function Section({
  title,
  theme,
  children,
}: {
  title: string;
  theme: any;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
      {children}
    </View>
  );
}

function ActionRow({
  theme,
  icon,
  label,
  onPress,
}: {
  theme: any;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.actionRow, { backgroundColor: theme.surface }]} onPress={onPress}>
      <Ionicons name={icon} size={18} color={YELLOW} />
      <Text numberOfLines={1} style={[styles.actionLabel, { color: theme.text }]}>
        {label}
      </Text>
      <Ionicons name="open-outline" size={16} color={theme.textSecondary} />
    </Pressable>
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
  back: { width: 32, alignItems: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontSize: 18, fontWeight: '600' },
  scroll: { paddingHorizontal: 16, paddingBottom: 24 },
  hero: {
    height: 160,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginTop: 4,
  },
  heroImg: { width: '100%', height: '100%' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  title: { fontSize: 24, fontWeight: '800', flexShrink: 1 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 12, color: YELLOW, fontWeight: '600' },
  description: { fontSize: 15, lineHeight: 22, marginTop: 12 },
  actions: { marginTop: 16, gap: 8 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
  },
  actionLabel: { flex: 1, fontSize: 14, fontWeight: '500' },
  section: { marginTop: 22 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 10 },
  serviceChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  serviceText: { fontSize: 13, fontWeight: '500', textTransform: 'capitalize' },
  riderShelf: { flexDirection: 'row', gap: 12 },
  riderCard: { width: 84, alignItems: 'center' },
  riderAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  riderAvatarImg: { width: 64, height: 64 },
  riderInitials: { fontSize: 18, fontWeight: '700' },
  riderName: { fontSize: 12, fontWeight: '600', marginTop: 6, textAlign: 'center' },
  riderLink: { fontSize: 11, color: '#806D00', fontWeight: '700', marginTop: 1 },
  hourRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  hourDay: { fontSize: 14, fontWeight: '600', textTransform: 'capitalize' },
  hourVal: { fontSize: 14 },
  commentBox: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: 12,
    padding: 8,
    gap: 8,
  },
  commentInput: { flex: 1, fontSize: 15, maxHeight: 100, paddingHorizontal: 6, paddingTop: 6 },
  postBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  comment: { flexDirection: 'row', gap: 10, marginTop: 14 },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  commentAvatarImg: { width: 36, height: 36 },
  commentBody: { flex: 1 },
  commentAuthor: { fontSize: 14, fontWeight: '700' },
  commentText: { fontSize: 14, marginTop: 2, lineHeight: 20 },
  noComments: { fontSize: 14, marginTop: 12, fontStyle: 'italic' },
});
