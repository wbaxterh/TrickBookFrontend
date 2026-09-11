/**
 * New Chat (compose) screen.
 *
 * Search users, multi-select, and start a conversation:
 *  - 1 selected  → a 1:1 DM (or a message REQUEST if they aren't your homie).
 *  - 2+ selected → a group chat (homies only).
 *
 * Selected people show as removable chips at the top (messaging best-practice);
 * the action button adapts to Message vs Create group, and a group-name field
 * appears once you pick a second person.
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getMyHomies, type Homie, searchDiscoverableUsers } from '@/lib/api/homies';
import { createConversation } from '@/lib/api/messages';
import { useThemeContext } from '@/lib/providers/ThemeProvider';

const YELLOW = '#FCF150';
const DARK = '#1a1a1a';

interface Selectable extends Homie {
  isHomie: boolean;
}

export default function NewChatScreen() {
  const { theme } = useThemeContext();

  const [query, setQuery] = useState('');
  const [homies, setHomies] = useState<Selectable[]>([]);
  const [discovered, setDiscovered] = useState<Selectable[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Selectable[]>([]);
  const [groupName, setGroupName] = useState('');
  const [creating, setCreating] = useState(false);

  // Load my homies once (the default list + the group-eligible pool).
  useEffect(() => {
    (async () => {
      const list = await getMyHomies();
      setHomies(list.map((h) => ({ ...h, isHomie: true })));
      setLoading(false);
    })();
  }, []);

  // Debounced discoverable-user search (non-homies you can still message).
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setDiscovered([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      const res = await searchDiscoverableUsers(q, 1, 20);
      setDiscovered(res.users.map((u) => ({ ...u, isHomie: false })));
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const selectedIds = useMemo(() => new Set(selected.map((s) => s._id)), [selected]);

  // Results = matching homies (client filter) + discovered non-homies, deduped.
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matchedHomies = q ? homies.filter((h) => h.name?.toLowerCase().includes(q)) : homies;
    const seen = new Set(matchedHomies.map((h) => h._id));
    const extra = discovered.filter((d) => !seen.has(d._id));
    return [...matchedHomies, ...extra];
  }, [homies, discovered, query]);

  const toggle = useCallback((u: Selectable) => {
    setSelected((prev) =>
      prev.some((s) => s._id === u._id) ? prev.filter((s) => s._id !== u._id) : [...prev, u],
    );
  }, []);

  const isGroup = selected.length >= 2;
  const hasNonHomie = selected.some((s) => !s.isHomie);
  // A group can't include non-homies; a single non-homie is fine (→ request).
  const groupBlocked = isGroup && hasNonHomie;
  const canSubmit = selected.length >= 1 && !groupBlocked && !creating;

  const submit = useCallback(async () => {
    if (!canSubmit) return;
    setCreating(true);
    try {
      const conversation = isGroup
        ? await createConversation({
            participantIds: selected.map((s) => s._id),
            groupName: groupName.trim() || 'New group',
          })
        : await createConversation({ targetUserId: selected[0]._id });

      if (conversation?._id) {
        // Replace so the modal doesn't linger behind the thread.
        router.replace(`/(tabs)/homies/chat/${conversation._id}`);
      } else {
        setCreating(false);
      }
    } catch {
      setCreating(false);
    }
  }, [canSubmit, isGroup, selected, groupName]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable hitSlop={8} onPress={() => router.back()}>
          <Text style={[styles.cancel, { color: theme.textSecondary }]}>Cancel</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>New chat</Text>
        <Pressable hitSlop={8} onPress={submit} disabled={!canSubmit}>
          <Text style={[styles.action, { color: canSubmit ? YELLOW : theme.textSecondary }]}>
            {isGroup ? 'Create' : 'Message'}
          </Text>
        </Pressable>
      </View>

      {/* Selected chips */}
      {selected.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsRow}
          contentContainerStyle={styles.chipsContent}
        >
          {selected.map((s) => (
            <Pressable
              key={s._id}
              style={[styles.chip, { backgroundColor: theme.surfaceElevated || theme.surface }]}
              onPress={() => toggle(s)}
            >
              <Text style={[styles.chipText, { color: theme.text }]} numberOfLines={1}>
                {s.name}
              </Text>
              <Ionicons name="close-circle" size={16} color={theme.textSecondary} />
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* Search */}
      <View style={[styles.searchBar, { backgroundColor: theme.surface }]}>
        <Ionicons name="search" size={18} color={theme.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Search riders…"
          placeholderTextColor={theme.textSecondary}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searching && <ActivityIndicator size="small" color={theme.textSecondary} />}
      </View>

      {/* Group name (once it's a group) */}
      {isGroup && (
        <View style={[styles.groupNameRow, { borderColor: theme.border }]}>
          <Ionicons name="people" size={18} color={YELLOW} />
          <TextInput
            style={[styles.groupNameInput, { color: theme.text }]}
            placeholder="Group name"
            placeholderTextColor={theme.textSecondary}
            value={groupName}
            onChangeText={setGroupName}
            maxLength={40}
          />
        </View>
      )}

      {groupBlocked && (
        <Text style={styles.warn}>Groups are for homies only — remove non-homies to continue.</Text>
      )}

      {/* Results */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={YELLOW} />
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item._id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              {query.trim() ? 'No riders found' : 'Add some homies to start chatting'}
            </Text>
          }
          renderItem={({ item }) => {
            const isSelected = selectedIds.has(item._id);
            return (
              <Pressable style={styles.row} onPress={() => toggle(item)}>
                {item.imageUri ? (
                  <Image source={{ uri: item.imageUri }} style={styles.avatar} />
                ) : (
                  <View
                    style={[
                      styles.avatarPlaceholder,
                      { backgroundColor: theme.surfaceElevated || theme.border },
                    ]}
                  >
                    <Ionicons name="person" size={22} color={theme.textSecondary} />
                  </View>
                )}
                <View style={styles.rowInfo}>
                  <Text style={[styles.rowName, { color: theme.text }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {!item.isHomie && (
                    <Text style={[styles.rowMeta, { color: theme.textSecondary }]}>
                      Not a homie — sends a request
                    </Text>
                  )}
                </View>
                <View
                  style={[
                    styles.checkbox,
                    { borderColor: isSelected ? YELLOW : theme.border },
                    isSelected && { backgroundColor: YELLOW },
                  ]}
                >
                  {isSelected && <Ionicons name="checkmark" size={16} color={DARK} />}
                </View>
              </Pressable>
            );
          }}
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  cancel: { fontSize: 16 },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  action: { fontSize: 16, fontWeight: '700' },
  chipsRow: { maxHeight: 44, marginBottom: 4 },
  chipsContent: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 7,
    borderRadius: 16,
    maxWidth: 160,
  },
  chipText: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 12,
  },
  searchInput: { flex: 1, fontSize: 15 },
  groupNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  groupNameInput: { flex: 1, fontSize: 16, fontWeight: '600', paddingVertical: 6 },
  warn: {
    color: '#e8873b',
    fontSize: 13,
    marginHorizontal: 16,
    marginTop: 8,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 },
  emptyText: { textAlign: 'center', marginTop: 40, fontSize: 15 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 16, fontWeight: '600' },
  rowMeta: { fontSize: 12, marginTop: 2 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
