/**
 * AddToSpotListModal Component
 * Modal for adding a spot to user's spot lists
 *
 * Features:
 * - Shows all user's spot lists with checkmarks
 * - Option to create a new list
 * - Adds spot to selected list(s)
 */

import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { addSpotToList, createSpotList, getSpotLists } from '@/lib/api/spotlists';
import { useThemeContext } from '@/lib/providers/ThemeProvider';
import { useAuthStore } from '@/lib/stores/authStore';
import type { CreateSpotListInput, SpotList } from '@/types/spots';

const YELLOW = '#FCF150';
const DARK = '#1f1f1f';

interface AddToSpotListModalProps {
  visible: boolean;
  spotId: string;
  spotName: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AddToSpotListModal({
  visible,
  spotId,
  spotName,
  onClose,
  onSuccess,
}: AddToSpotListModalProps) {
  const { theme, isDark } = useThemeContext();
  const { user } = useAuthStore();

  const [lists, setLists] = useState<SpotList[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  // Create new list state
  const [showCreateInput, setShowCreateInput] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [creating, setCreating] = useState(false);

  // Fetch user's spot lists
  const fetchLists = useCallback(async () => {
    if (!user?.id && !user?._id) return;
    setLoading(true);
    try {
      const data = await getSpotLists();
      setLists(data);
    } catch (_error) {
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?._id]);

  useEffect(() => {
    if (visible) {
      fetchLists();
      setShowCreateInput(false);
      setNewListName('');
    }
  }, [visible, fetchLists]);

  // Check if spot is already in a list
  const isSpotInList = (list: SpotList): boolean => {
    return list.spotIds?.includes(spotId) || false;
  };

  // Add spot to a list
  const handleAddToList = async (list: SpotList) => {
    if (isSpotInList(list)) {
      Alert.alert('Already Added', `"${spotName}" is already in "${list.name}"`);
      return;
    }

    setAdding(true);
    try {
      const success = await addSpotToList(list._id, spotId);
      if (success) {
        Alert.alert('Success', `Added "${spotName}" to "${list.name}"`);
        // Update local state
        setLists((prev) =>
          prev.map((l) =>
            l._id === list._id
              ? { ...l, spotIds: [...l.spotIds, spotId], spotCount: (l.spotCount || 0) + 1 }
              : l,
          ),
        );
        onSuccess?.();
      } else {
        Alert.alert('Error', 'Failed to add spot to list');
      }
    } catch (_error) {
      Alert.alert('Error', 'Failed to add spot to list');
    } finally {
      setAdding(false);
    }
  };

  // Create new list and add spot
  const handleCreateAndAdd = async () => {
    if (!newListName.trim()) return;

    setCreating(true);
    try {
      const data: CreateSpotListInput = { name: newListName.trim() };
      const newList = await createSpotList(data);
      if (newList) {
        // Add spot to the new list
        const success = await addSpotToList(newList._id, spotId);
        if (success) {
          Alert.alert('Success', `Created "${newList.name}" and added "${spotName}"`);
          setLists((prev) => [{ ...newList, spotIds: [spotId], spotCount: 1 }, ...prev]);
          setNewListName('');
          setShowCreateInput(false);
          onSuccess?.();
        } else {
          // List created but spot not added
          setLists((prev) => [newList, ...prev]);
          setNewListName('');
          setShowCreateInput(false);
        }
      } else {
        Alert.alert('Error', 'Failed to create list');
      }
    } catch (_error) {
      Alert.alert('Error', 'Failed to create list');
    } finally {
      setCreating(false);
    }
  };

  // Render list item
  const renderListItem = ({ item }: { item: SpotList }) => {
    const inList = isSpotInList(item);
    const spotCount = item.spotCount ?? item.spotIds?.length ?? 0;

    return (
      <Pressable
        style={[styles.listItem, { backgroundColor: theme.surface }]}
        onPress={() => handleAddToList(item)}
        disabled={adding}
      >
        <View style={[styles.listIcon, { backgroundColor: `${YELLOW}25` }]}>
          <Ionicons name="location" size={20} color={YELLOW} />
        </View>
        <View style={styles.listInfo}>
          <Text style={[styles.listName, { color: theme.text }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.listCount, { color: theme.textSecondary }]}>
            {spotCount} {spotCount === 1 ? 'spot' : 'spots'}
          </Text>
        </View>
        {inList ? (
          <View style={[styles.checkmark, { backgroundColor: YELLOW }]}>
            <Ionicons name="checkmark" size={16} color={DARK} />
          </View>
        ) : (
          <Ionicons name="add-circle-outline" size={24} color={theme.textSecondary} />
        )}
      </Pressable>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.content, { backgroundColor: theme.surface }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>Add to List</Text>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.text} />
            </Pressable>
          </View>

          <Text style={[styles.spotName, { color: theme.textSecondary }]} numberOfLines={1}>
            {spotName}
          </Text>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={YELLOW} />
            </View>
          ) : (
            <>
              {/* Create New List */}
              {showCreateInput ? (
                <View style={styles.createContainer}>
                  <TextInput
                    style={[
                      styles.createInput,
                      {
                        backgroundColor: theme.background,
                        color: theme.text,
                        borderColor: theme.border,
                      },
                    ]}
                    placeholder="Enter list name..."
                    placeholderTextColor={theme.textSecondary}
                    value={newListName}
                    onChangeText={setNewListName}
                    autoFocus
                  />
                  <View style={styles.createButtons}>
                    <Pressable
                      style={[styles.createCancelButton, { borderColor: theme.border }]}
                      onPress={() => {
                        setShowCreateInput(false);
                        setNewListName('');
                      }}
                    >
                      <Text style={[styles.createCancelText, { color: theme.text }]}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.createSubmitButton,
                        { backgroundColor: YELLOW },
                        (!newListName.trim() || creating) && styles.buttonDisabled,
                      ]}
                      onPress={handleCreateAndAdd}
                      disabled={!newListName.trim() || creating}
                    >
                      {creating ? (
                        <ActivityIndicator size="small" color={DARK} />
                      ) : (
                        <Text style={styles.createSubmitText}>Create & Add</Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable
                  style={[styles.createNewButton, { borderColor: theme.border }]}
                  onPress={() => setShowCreateInput(true)}
                >
                  <Ionicons name="add" size={22} color={YELLOW} />
                  <Text style={[styles.createNewText, { color: theme.text }]}>Create New List</Text>
                </Pressable>
              )}

              {/* Lists */}
              <FlatList
                data={lists}
                keyExtractor={(item) => item._id}
                renderItem={renderListItem}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                      No spot lists yet. Create one above!
                    </Text>
                  </View>
                }
                ItemSeparatorComponent={() => <View style={styles.separator} />}
              />
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  content: {
    maxHeight: '70%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  spotName: {
    fontSize: 14,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  createNewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    gap: 8,
  },
  createNewText: {
    fontSize: 15,
    fontWeight: '600',
  },
  createContainer: {
    marginHorizontal: 20,
    marginBottom: 16,
  },
  createInput: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
    marginBottom: 12,
  },
  createButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  createCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  createCancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  createSubmitButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  createSubmitText: {
    fontSize: 15,
    fontWeight: '600',
    color: DARK,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  separator: {
    height: 8,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
  },
  listIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listInfo: {
    flex: 1,
    marginLeft: 12,
  },
  listName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  listCount: {
    fontSize: 13,
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
});

export default AddToSpotListModal;
