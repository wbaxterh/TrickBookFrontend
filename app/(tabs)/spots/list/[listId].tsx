/**
 * SpotList Detail Screen
 * Shows spots in a specific list with swipe actions
 *
 * Features:
 * - View all spots in a list
 * - Tap to view spot detail
 * - Swipe left to delete from list
 * - Add spots from existing approved spots
 * - Rename/Delete list via ellipsis menu
 */

import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShareToHomieModal } from '@/components/share';
import { useKeyboardVisible } from '@/hooks/useKeyboardVisible';
import {
  addSpotToList,
  deleteSpotList,
  getSpotList,
  getSpotsInList,
  removeSpotFromList,
  updateSpotList,
} from '@/lib/api/spotlists';
import { getSpots, type Spot } from '@/lib/api/spots';
import { useThemeContext } from '@/lib/providers/ThemeProvider';
import { useAuthStore } from '@/lib/stores/authStore';
import type { SpotList } from '@/types/spots';

const YELLOW = '#FCF150';
const DARK = '#1f1f1f';
const RED = '#ef4444';

export default function SpotListDetailScreen() {
  const { listId } = useLocalSearchParams<{ listId: string }>();
  const { theme, isDark } = useThemeContext();
  const { token, user } = useAuthStore();
  const { isKeyboardVisible, dismissKeyboard } = useKeyboardVisible();

  const handleRenameBackdropPress = () => {
    if (isKeyboardVisible()) {
      dismissKeyboard();
    } else {
      setRenameModalVisible(false);
    }
  };

  const [list, setList] = useState<SpotList | null>(null);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal states
  const [menuModalVisible, setMenuModalVisible] = useState(false);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [addSpotModalVisible, setAddSpotModalVisible] = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListDescription, setNewListDescription] = useState('');
  const [saving, setSaving] = useState(false);

  // Add spot modal state
  const [availableSpots, setAvailableSpots] = useState<Spot[]>([]);
  const [spotsSearchQuery, setSpotsSearchQuery] = useState('');
  const [loadingAvailableSpots, setLoadingAvailableSpots] = useState(false);

  const swipeableRefs = useRef<Map<string, Swipeable>>(new Map());

  const loadList = useCallback(async () => {
    if (!listId) return;

    try {
      setLoading(true);
      const [listData, spotsData] = await Promise.all([
        getSpotList(listId),
        getSpotsInList(listId),
      ]);
      setList(listData);
      setSpots(spotsData);
    } catch (_error) {
      Alert.alert('Error', 'Failed to load spot list');
    } finally {
      setLoading(false);
    }
  }, [listId]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadList();
    setRefreshing(false);
  }, [loadList]);

  // Delete spot from list
  const handleRemoveSpot = async (spot: Spot) => {
    if (!listId) return;

    Alert.alert('Remove Spot', `Remove "${spot.name}" from this list?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            const success = await removeSpotFromList(listId, spot._id);
            if (success) {
              setSpots((prev) => prev.filter((s) => s._id !== spot._id));
              setList((prev) =>
                prev
                  ? {
                      ...prev,
                      spotCount: (prev.spotCount || 0) - 1,
                      spotIds: prev.spotIds.filter((id) => id !== spot._id),
                    }
                  : prev,
              );
            } else {
              Alert.alert('Error', 'Failed to remove spot');
            }
          } catch (_error) {
            Alert.alert('Error', 'Failed to remove spot');
          }
        },
      },
    ]);
  };

  // Open share modal
  const handleOpenShare = () => {
    setMenuModalVisible(false);
    setShareModalVisible(true);
  };

  // Open rename modal
  const handleOpenRename = () => {
    setNewListName(list?.name || '');
    setNewListDescription(list?.description || '');
    setMenuModalVisible(false);
    setRenameModalVisible(true);
  };

  // Rename the list
  const handleRenameList = async () => {
    if (!listId || !newListName.trim()) return;

    try {
      setSaving(true);
      const success = await updateSpotList(listId, {
        name: newListName.trim(),
        description: newListDescription.trim() || undefined,
      });
      if (success) {
        setList((prev) =>
          prev
            ? {
                ...prev,
                name: newListName.trim(),
                description: newListDescription.trim() || undefined,
              }
            : prev,
        );
        setRenameModalVisible(false);
      } else {
        Alert.alert('Error', 'Failed to rename list');
      }
    } catch (_error) {
      Alert.alert('Error', 'Failed to rename list');
    } finally {
      setSaving(false);
    }
  };

  // Delete the list
  const handleDeleteList = () => {
    setMenuModalVisible(false);
    Alert.alert(
      'Delete List',
      `Are you sure you want to delete "${list?.name}"? Spots will not be deleted, only removed from this list.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!listId) return;
            try {
              const success = await deleteSpotList(listId);
              if (success) {
                router.back();
              } else {
                Alert.alert('Error', 'Failed to delete list');
              }
            } catch (_error) {
              Alert.alert('Error', 'Failed to delete list');
            }
          },
        },
      ],
    );
  };

  // Open add spot modal and fetch available spots
  const handleOpenAddSpot = async () => {
    setAddSpotModalVisible(true);
    setLoadingAvailableSpots(true);
    try {
      const response = await getSpots({ limit: 100 });
      // Filter out spots already in the list
      const spotIdsInList = new Set(list?.spotIds || []);
      const available = response.spots.filter((s) => !spotIdsInList.has(s._id));
      setAvailableSpots(available);
    } catch (_error) {
    } finally {
      setLoadingAvailableSpots(false);
    }
  };

  // Add spot to list
  const handleAddSpotToList = async (spot: Spot) => {
    if (!listId) return;

    try {
      const success = await addSpotToList(listId, spot._id);
      if (success) {
        setSpots((prev) => [...prev, spot]);
        setList((prev) =>
          prev
            ? {
                ...prev,
                spotCount: (prev.spotCount || 0) + 1,
                spotIds: [...prev.spotIds, spot._id],
              }
            : prev,
        );
        setAvailableSpots((prev) => prev.filter((s) => s._id !== spot._id));
        Alert.alert('Success', `Added "${spot.name}" to the list`);
      } else {
        Alert.alert('Error', 'Failed to add spot to list');
      }
    } catch (_error) {
      Alert.alert('Error', 'Failed to add spot to list');
    }
  };

  // Filter available spots by search
  const filteredAvailableSpots = availableSpots.filter(
    (spot) =>
      spot.name.toLowerCase().includes(spotsSearchQuery.toLowerCase()) ||
      spot.city?.toLowerCase().includes(spotsSearchQuery.toLowerCase()) ||
      spot.state?.toLowerCase().includes(spotsSearchQuery.toLowerCase()),
  );

  // Render swipe actions
  const renderRightActions =
    (spot: Spot) =>
    (
      _progress: Animated.AnimatedInterpolation<number>,
      dragX: Animated.AnimatedInterpolation<number>,
    ) => {
      const scale = dragX.interpolate({
        inputRange: [-100, 0],
        outputRange: [1, 0],
        extrapolate: 'clamp',
      });

      return (
        <Pressable
          style={[styles.swipeAction, styles.deleteAction]}
          onPress={() => {
            swipeableRefs.current.get(spot._id)?.close();
            handleRemoveSpot(spot);
          }}
        >
          <Animated.View style={{ transform: [{ scale }] }}>
            <Ionicons name="trash" size={24} color="#fff" />
            <Text style={styles.swipeActionText}>Remove</Text>
          </Animated.View>
        </Pressable>
      );
    };

  // Render spot item
  const renderSpotItem = ({ item }: { item: Spot }) => {
    const address = [item.city, item.state].filter(Boolean).join(', ') || 'Unknown location';

    return (
      <Swipeable
        ref={(ref) => {
          if (ref) swipeableRefs.current.set(item._id, ref);
        }}
        renderRightActions={renderRightActions(item)}
        overshootRight={false}
        friction={2}
      >
        <Pressable
          style={[styles.spotRow, { backgroundColor: theme.surface }]}
          onPress={() => router.push(`/(tabs)/spots/${item._id}`)}
        >
          {item.imageURL ? (
            <Image source={{ uri: item.imageURL }} style={styles.spotImage} />
          ) : (
            <View style={[styles.spotImagePlaceholder, { backgroundColor: theme.border }]}>
              <Ionicons name="image-outline" size={24} color={theme.textSecondary} />
            </View>
          )}
          <View style={styles.spotInfo}>
            <Text style={[styles.spotName, { color: theme.text }]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={[styles.spotAddress, { color: theme.textSecondary }]} numberOfLines={1}>
              {address}
            </Text>
            <View style={styles.spotMeta}>
              <Ionicons name="star" size={14} color={YELLOW} />
              <Text style={[styles.spotRating, { color: theme.text }]}>
                {item.rating?.toFixed(1) || 'N/A'}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
        </Pressable>
      </Swipeable>
    );
  };

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
        edges={['top']}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={YELLOW} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
        edges={['top']}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
              {list?.name || 'Spot List'}
            </Text>
            <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
              {spots.length} {spots.length === 1 ? 'spot' : 'spots'}
            </Text>
          </View>
          <Pressable style={styles.menuButton} onPress={() => setMenuModalVisible(true)}>
            <Ionicons name="ellipsis-horizontal" size={24} color={theme.text} />
          </Pressable>
        </View>

        {/* Spots List */}
        <FlatList
          data={spots}
          keyExtractor={(item) => item._id}
          renderItem={renderSpotItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={YELLOW} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="location-outline" size={48} color={theme.textSecondary} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No spots yet</Text>
              <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                Add spots to this list to keep track of your favorites
              </Text>
            </View>
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />

        {/* Add Spot Button */}
        <View style={styles.bottomButtonContainer}>
          <Pressable
            style={[styles.addSpotButton, { backgroundColor: YELLOW }]}
            onPress={handleOpenAddSpot}
          >
            <Ionicons name="add" size={22} color={DARK} />
            <Text style={styles.addSpotButtonText}>ADD SPOT</Text>
          </Pressable>
        </View>

        {/* Menu Modal */}
        <Modal
          visible={menuModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setMenuModalVisible(false)}
        >
          <Pressable style={styles.menuOverlay} onPress={() => setMenuModalVisible(false)}>
            <View style={[styles.menuContent, { backgroundColor: theme.surface }]}>
              <Pressable style={styles.menuOption} onPress={handleOpenShare}>
                <Ionicons name="share-outline" size={22} color={theme.text} />
                <Text style={[styles.menuOptionText, { color: theme.text }]}>Share to Homie</Text>
              </Pressable>
              <View style={[styles.menuDivider, { backgroundColor: theme.border }]} />
              <Pressable style={styles.menuOption} onPress={handleOpenRename}>
                <Ionicons name="pencil-outline" size={22} color={theme.text} />
                <Text style={[styles.menuOptionText, { color: theme.text }]}>Rename List</Text>
              </Pressable>
              <View style={[styles.menuDivider, { backgroundColor: theme.border }]} />
              <Pressable style={styles.menuOption} onPress={handleDeleteList}>
                <Ionicons name="trash-outline" size={22} color={RED} />
                <Text style={[styles.menuOptionText, { color: RED }]}>Delete List</Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>

        {/* Rename Modal */}
        <Modal
          visible={renameModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setRenameModalVisible(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
            <Pressable style={styles.modalOverlay} onPress={handleRenameBackdropPress}>
              <Pressable
                style={[styles.modalContent, { backgroundColor: theme.surface }]}
                onPress={(e) => e.stopPropagation()}
              >
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: theme.text }]}>Rename List</Text>
                  <Pressable onPress={() => setRenameModalVisible(false)}>
                    <Ionicons name="close" size={24} color={theme.text} />
                  </Pressable>
                </View>

                <ScrollView keyboardShouldPersistTaps="handled">
                  <View style={styles.modalBody}>
                    <Text style={[styles.inputLabel, { color: theme.text }]}>List Name</Text>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: theme.background,
                          color: theme.text,
                          borderColor: theme.border,
                        },
                      ]}
                      value={newListName}
                      onChangeText={setNewListName}
                      placeholder="Enter list name"
                      placeholderTextColor={theme.textSecondary}
                      autoFocus
                    />

                    <Text style={[styles.inputLabel, { color: theme.text, marginTop: 16 }]}>
                      Description (optional)
                    </Text>
                    <TextInput
                      style={[
                        styles.input,
                        styles.inputMultiline,
                        {
                          backgroundColor: theme.background,
                          color: theme.text,
                          borderColor: theme.border,
                        },
                      ]}
                      value={newListDescription}
                      onChangeText={setNewListDescription}
                      placeholder="Add a description..."
                      placeholderTextColor={theme.textSecondary}
                      multiline
                      numberOfLines={3}
                    />

                    <Pressable
                      style={[
                        styles.submitButton,
                        { backgroundColor: YELLOW },
                        (!newListName.trim() || saving) && styles.submitButtonDisabled,
                      ]}
                      onPress={handleRenameList}
                      disabled={!newListName.trim() || saving}
                    >
                      {saving ? (
                        <ActivityIndicator size="small" color={DARK} />
                      ) : (
                        <Text style={styles.submitButtonText}>Save Changes</Text>
                      )}
                    </Pressable>
                  </View>
                </ScrollView>
              </Pressable>
            </Pressable>
          </KeyboardAvoidingView>
        </Modal>

        {/* Add Spot Modal */}
        <Modal
          visible={addSpotModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setAddSpotModalVisible(false)}
        >
          <View style={[styles.addSpotModalContainer, { backgroundColor: theme.background }]}>
            <SafeAreaView style={{ flex: 1 }} edges={['top']}>
              <View style={styles.addSpotHeader}>
                <Pressable onPress={() => setAddSpotModalVisible(false)}>
                  <Ionicons name="close" size={28} color={theme.text} />
                </Pressable>
                <Text style={[styles.addSpotTitle, { color: theme.text }]}>Add Spot</Text>
                <View style={{ width: 28 }} />
              </View>

              <View style={styles.searchContainer}>
                <View style={[styles.searchBar, { backgroundColor: theme.surface }]}>
                  <Ionicons name="search" size={20} color={theme.textSecondary} />
                  <TextInput
                    style={[styles.searchInput, { color: theme.text }]}
                    placeholder="Search spots..."
                    placeholderTextColor={theme.textSecondary}
                    value={spotsSearchQuery}
                    onChangeText={setSpotsSearchQuery}
                  />
                  {spotsSearchQuery.length > 0 && (
                    <Pressable onPress={() => setSpotsSearchQuery('')}>
                      <Ionicons name="close-circle" size={20} color={theme.textSecondary} />
                    </Pressable>
                  )}
                </View>
              </View>

              {loadingAvailableSpots ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={YELLOW} />
                </View>
              ) : (
                <FlatList
                  data={filteredAvailableSpots}
                  keyExtractor={(item) => item._id}
                  contentContainerStyle={styles.addSpotListContent}
                  showsVerticalScrollIndicator={false}
                  ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                      <Ionicons name="search-outline" size={48} color={theme.textSecondary} />
                      <Text style={[styles.emptyTitle, { color: theme.text }]}>No spots found</Text>
                      <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                        {spotsSearchQuery
                          ? 'Try a different search term'
                          : 'All available spots are already in this list'}
                      </Text>
                    </View>
                  }
                  renderItem={({ item }) => {
                    const address =
                      [item.city, item.state].filter(Boolean).join(', ') || 'Unknown location';
                    return (
                      <Pressable
                        style={[styles.addSpotRow, { backgroundColor: theme.surface }]}
                        onPress={() => handleAddSpotToList(item)}
                      >
                        {item.imageURL ? (
                          <Image source={{ uri: item.imageURL }} style={styles.addSpotImage} />
                        ) : (
                          <View
                            style={[
                              styles.addSpotImagePlaceholder,
                              { backgroundColor: theme.border },
                            ]}
                          >
                            <Ionicons name="image-outline" size={20} color={theme.textSecondary} />
                          </View>
                        )}
                        <View style={styles.addSpotInfo}>
                          <Text
                            style={[styles.addSpotName, { color: theme.text }]}
                            numberOfLines={1}
                          >
                            {item.name}
                          </Text>
                          <Text
                            style={[styles.addSpotAddress, { color: theme.textSecondary }]}
                            numberOfLines={1}
                          >
                            {address}
                          </Text>
                        </View>
                        <Ionicons name="add-circle" size={28} color={YELLOW} />
                      </Pressable>
                    );
                  }}
                  ItemSeparatorComponent={() => <View style={styles.separator} />}
                />
              )}
            </SafeAreaView>
          </View>
        </Modal>

        {/* Share to Homie Modal */}
        {list && (
          <ShareToHomieModal
            visible={shareModalVisible}
            onClose={() => setShareModalVisible(false)}
            contentType="spotlist"
            contentId={list._id}
            preview={{
              title: list.name,
              subtitle: `${spots.length} ${spots.length === 1 ? 'spot' : 'spots'}`,
            }}
            onSuccess={(conversationId) => {
              router.push(`/(tabs)/homies/chat/${conversationId}`);
            }}
          />
        )}
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 4,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  menuButton: {
    padding: 4,
  },

  // List
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  separator: {
    height: 8,
  },

  // Spot Row
  spotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
  },
  spotImage: {
    width: 60,
    height: 60,
    borderRadius: 10,
  },
  spotImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotInfo: {
    flex: 1,
    marginLeft: 12,
  },
  spotName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  spotAddress: {
    fontSize: 13,
    marginBottom: 4,
  },
  spotMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  spotRating: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Swipe Actions
  swipeAction: {
    width: 80,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  deleteAction: {
    backgroundColor: RED,
  },
  swipeActionText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 40,
  },

  // Bottom Button
  bottomButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 12,
  },
  addSpotButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  addSpotButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: DARK,
  },

  // Menu Modal
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  menuContent: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  menuOptionText: {
    fontSize: 16,
    fontWeight: '500',
  },
  menuDivider: {
    height: 1,
    marginHorizontal: 20,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128,128,128,0.2)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 40,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
  },
  inputMultiline: {
    height: 80,
    textAlignVertical: 'top',
  },
  submitButton: {
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: DARK,
  },

  // Add Spot Modal
  addSpotModalContainer: {
    flex: 1,
  },
  addSpotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  addSpotTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 48,
    borderRadius: 12,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  addSpotListContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  addSpotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
  },
  addSpotImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
  },
  addSpotImagePlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addSpotInfo: {
    flex: 1,
    marginLeft: 12,
  },
  addSpotName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  addSpotAddress: {
    fontSize: 13,
  },
});
