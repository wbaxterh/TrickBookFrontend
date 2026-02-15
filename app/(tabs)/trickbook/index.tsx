/**
 * TrickBook Screen
 * Main screen with Trickipedia and My TrickLists tabs
 *
 * Design: /TrickBookScreenshots/MobileApp/newScreens/TrickBook-*.png
 */

import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TrickCard, TrickListCard } from '@/components/trickbook';
import { colors as brandColors } from '@/constants/colors';
import {
  addTrickToList,
  createTrickList,
  getCategories,
  getTricks,
  getUserTrickLists,
} from '@/lib/api/trickbook';
import { useThemeContext } from '@/lib/providers/ThemeProvider';
import { useAuthStore } from '@/lib/stores/authStore';
import type { Category, Trick, TrickList } from '@/types/trickbook';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_GAP = 12;
const CARD_WIDTH = (SCREEN_WIDTH - 48 - CARD_GAP) / 2;

type TabType = 'trickipedia' | 'mylists';

export default function TrickBookScreen() {
  const { theme, colors, isDark } = useThemeContext();
  const { user, token } = useAuthStore();
  const params = useLocalSearchParams<{ tab?: string }>();

  // Use dark charcoal for text/icons in light mode, bright yellow in dark mode
  const accentColor = isDark ? brandColors.primary : brandColors.primaryText;

  // Tab state - check for URL param to set initial tab
  const [activeTab, setActiveTab] = useState<TabType>(
    params.tab === 'mylists' ? 'mylists' : 'trickipedia',
  );

  // Trickipedia state
  const [tricks, setTricks] = useState<Trick[]>([]);
  const [filteredTricks, setFilteredTricks] = useState<Trick[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [tricksLoading, setTricksLoading] = useState(true);

  // My Lists state
  const [myLists, setMyLists] = useState<TrickList[]>([]);
  const [listsLoading, setListsLoading] = useState(false);

  // Filter modal
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  // Create list modal
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [creating, setCreating] = useState(false);

  // Add to list modal
  const [addToListModalVisible, setAddToListModalVisible] = useState(false);
  const [selectedTrick, setSelectedTrick] = useState<Trick | null>(null);

  // Fetch tricks
  const fetchTricks = useCallback(async () => {
    setTricksLoading(true);
    try {
      const params: { category?: string; search?: string } = {};
      if (selectedCategory) params.category = selectedCategory;
      if (searchQuery) params.search = searchQuery;

      const data = await getTricks(params);
      setTricks(data);
      setFilteredTricks(data);
    } catch (_error) {
    } finally {
      setTricksLoading(false);
    }
  }, [selectedCategory, searchQuery]);

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    const data = await getCategories();
    setCategories(data);
  }, []);

  // Fetch user's lists
  const fetchMyLists = useCallback(async () => {
    if (!user?.id || !token) return;
    setListsLoading(true);
    try {
      const data = await getUserTrickLists(user.id, token);
      setMyLists(data);
    } catch (_error) {
    } finally {
      setListsLoading(false);
    }
  }, [user?.id, token]);

  // Handle tab param changes
  useEffect(() => {
    if (params.tab === 'mylists') {
      setActiveTab('mylists');
    }
  }, [params.tab]);

  // Initial fetch
  useEffect(() => {
    fetchCategories();
    fetchTricks();
  }, [fetchCategories, fetchTricks]);

  // Refetch when tab changes
  useEffect(() => {
    if (activeTab === 'trickipedia') {
      fetchTricks();
    } else if (activeTab === 'mylists') {
      fetchMyLists();
    }
  }, [activeTab, fetchMyLists, fetchTricks]);

  // Refetch lists when screen gains focus (e.g., after deleting a list)
  useFocusEffect(
    useCallback(() => {
      if (activeTab === 'mylists') {
        fetchMyLists();
      }
    }, [activeTab, fetchMyLists]),
  );

  // Filter tricks by search
  useEffect(() => {
    if (!searchQuery) {
      setFilteredTricks(tricks);
    } else {
      const filtered = tricks.filter(
        (trick) =>
          trick.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          trick.description?.toLowerCase().includes(searchQuery.toLowerCase()),
      );
      setFilteredTricks(filtered);
    }
  }, [searchQuery, tricks]);

  // Handle category filter
  const handleCategorySelect = (category: string | null) => {
    setSelectedCategory(category);
    setFilterModalVisible(false);
    // Refetch with new category
    setTimeout(() => fetchTricks(), 100);
  };

  // Handle create list
  const handleCreateList = async () => {
    if (!newListName.trim() || !user?.id || !token) return;
    setCreating(true);
    try {
      await createTrickList(newListName.trim(), user.id, token);
      setCreateModalVisible(false);
      setNewListName('');
      fetchMyLists();
    } catch (_error) {
      Alert.alert('Error', 'Failed to create list');
    } finally {
      setCreating(false);
    }
  };

  // Handle add to list
  const handleAddToList = (trick: Trick) => {
    setSelectedTrick(trick);
    setAddToListModalVisible(true);
  };

  // Render trick card for grid
  const renderTrickCard = ({ item, index }: { item: Trick; index: number }) => (
    <View style={[styles.trickCardWrapper, { width: CARD_WIDTH }]}>
      <TrickCard
        trick={item}
        onPress={() => router.push(`/(tabs)/trickbook/${item._id}`)}
        onAddToList={() => handleAddToList(item)}
      />
    </View>
  );

  // Render list card
  const renderListCard = ({ item }: { item: TrickList }) => (
    <TrickListCard list={item} onPress={() => router.push(`/(tabs)/trickbook/list/${item._id}`)} />
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          {activeTab === 'trickipedia' ? 'Trickipedia' : 'TrickBook'}
        </Text>
        {activeTab === 'trickipedia' && (
          <Pressable style={styles.filterButton} onPress={() => setFilterModalVisible(true)}>
            <Ionicons name="options-outline" size={18} color={accentColor} />
            <Text style={[styles.filterText, { color: accentColor }]}>Filter</Text>
          </Pressable>
        )}
      </View>

      {/* Tab Toggle */}
      <View style={[styles.tabContainer, { backgroundColor: theme.surface }]}>
        <Pressable
          style={[
            styles.tab,
            activeTab === 'trickipedia' && {
              backgroundColor: colors.primary,
            },
          ]}
          onPress={() => setActiveTab('trickipedia')}
        >
          <Text
            style={[
              styles.tabText,
              {
                color: activeTab === 'trickipedia' ? '#000000' : theme.textSecondary,
              },
            ]}
          >
            Trickipedia
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.tab,
            activeTab === 'mylists' && {
              backgroundColor: colors.primary,
            },
          ]}
          onPress={() => setActiveTab('mylists')}
        >
          <Text
            style={[
              styles.tabText,
              {
                color: activeTab === 'mylists' ? '#000000' : theme.textSecondary,
              },
            ]}
          >
            My TrickLists
          </Text>
        </Pressable>
      </View>

      {activeTab === 'trickipedia' ? (
        <>
          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <View style={[styles.searchBar, { backgroundColor: theme.surface }]}>
              <Ionicons name="search" size={20} color={theme.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: theme.text }]}
                placeholder="Search tricks..."
                placeholderTextColor={theme.textTertiary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={20} color={theme.textSecondary} />
                </Pressable>
              )}
            </View>
          </View>

          {/* Tricks Grid */}
          {tricksLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <FlatList
              data={filteredTricks}
              keyExtractor={(item) => item._id}
              renderItem={renderTrickCard}
              numColumns={2}
              columnWrapperStyle={styles.gridRow}
              contentContainerStyle={styles.gridContent}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="search-outline" size={64} color={theme.textSecondary} />
                  <Text style={[styles.emptyTitle, { color: theme.text }]}>No tricks found</Text>
                  <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                    Try adjusting your search or filters
                  </Text>
                </View>
              }
            />
          )}
        </>
      ) : (
        <>
          {/* My Lists Content */}
          {listsLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <FlatList
              data={myLists}
              keyExtractor={(item) => item._id}
              renderItem={renderListCard}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
              ListHeaderComponent={
                <Pressable
                  style={[styles.createListButton, { borderColor: accentColor }]}
                  onPress={() => setCreateModalVisible(true)}
                >
                  <Ionicons name="add-circle" size={24} color={accentColor} />
                  <Text style={[styles.createListText, { color: accentColor }]}>
                    Create New List
                  </Text>
                </Pressable>
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="book-outline" size={64} color={theme.textSecondary} />
                  <Text style={[styles.emptyTitle, { color: theme.text }]}>No trick lists yet</Text>
                  <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                    Create your first list to start tracking your progress
                  </Text>
                </View>
              }
            />
          )}
        </>
      )}

      {/* Filter Modal */}
      <Modal
        visible={filterModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setFilterModalVisible(false)}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Filter by Category</Text>
              <Pressable onPress={() => setFilterModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </Pressable>
            </View>

            <ScrollView>
              <Pressable
                style={[
                  styles.filterOption,
                  selectedCategory === null && {
                    backgroundColor: `${accentColor}20`,
                  },
                ]}
                onPress={() => handleCategorySelect(null)}
              >
                <Text
                  style={[
                    styles.filterOptionText,
                    {
                      color: selectedCategory === null ? accentColor : theme.text,
                    },
                  ]}
                >
                  All Categories
                </Text>
                {selectedCategory === null && (
                  <Ionicons name="checkmark" size={20} color={accentColor} />
                )}
              </Pressable>

              {categories.map((category) => (
                <Pressable
                  key={category._id}
                  style={[
                    styles.filterOption,
                    selectedCategory === category.name && {
                      backgroundColor: `${accentColor}20`,
                    },
                  ]}
                  onPress={() => handleCategorySelect(category.name)}
                >
                  <Text
                    style={[
                      styles.filterOptionText,
                      {
                        color: selectedCategory === category.name ? accentColor : theme.text,
                      },
                    ]}
                  >
                    {category.name}
                  </Text>
                  {selectedCategory === category.name && (
                    <Ionicons name="checkmark" size={20} color={accentColor} />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* Create List Modal */}
      <Modal
        visible={createModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoid}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setCreateModalVisible(false)}>
            <View
              style={[styles.createModalContent, { backgroundColor: theme.surface }]}
              onStartShouldSetResponder={() => true}
            >
              <Text style={[styles.modalTitle, { color: theme.text }]}>Create New List</Text>

              <TextInput
                style={[
                  styles.createInput,
                  {
                    backgroundColor: theme.background,
                    color: theme.text,
                    borderColor: theme.border,
                  },
                ]}
                placeholder="List name..."
                placeholderTextColor={theme.textSecondary}
                value={newListName}
                onChangeText={setNewListName}
                autoFocus
              />

              <View style={styles.createModalButtons}>
                <Pressable
                  style={[styles.cancelButton, { borderColor: theme.border }]}
                  onPress={() => setCreateModalVisible(false)}
                >
                  <Text style={{ color: theme.text }}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.createButton,
                    { backgroundColor: colors.primary },
                    (!newListName.trim() || creating) && { opacity: 0.5 },
                  ]}
                  onPress={handleCreateList}
                  disabled={!newListName.trim() || creating}
                >
                  {creating ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <Text style={styles.createButtonText}>Create</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add to List Modal */}
      <Modal
        visible={addToListModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAddToListModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setAddToListModalVisible(false)}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                Add "{selectedTrick?.name}" to List
              </Text>
              <Pressable onPress={() => setAddToListModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </Pressable>
            </View>

            {myLists.length > 0 ? (
              <ScrollView>
                {myLists.map((list) => (
                  <Pressable
                    key={list._id}
                    style={styles.filterOption}
                    onPress={async () => {
                      if (!selectedTrick || !token) return;
                      try {
                        const success = await addTrickToList(
                          list._id,
                          {
                            name: selectedTrick.name,
                            link: selectedTrick.videoUrl || selectedTrick.url || '',
                            notes: `From Trickipedia: ${selectedTrick.category} - ${selectedTrick.difficulty}`,
                            trickipediaId: selectedTrick._id,
                          },
                          token,
                        );
                        if (success) {
                          Alert.alert('Added!', `"${selectedTrick.name}" added to "${list.name}"`);
                          // Refresh lists to show updated count
                          fetchMyLists();
                        } else {
                          Alert.alert('Error', 'Failed to add trick to list');
                        }
                      } catch (_error) {
                        Alert.alert('Error', 'Something went wrong');
                      }
                      setAddToListModalVisible(false);
                    }}
                  >
                    <Text style={[styles.filterOptionText, { color: theme.text }]}>
                      {list.name}
                    </Text>
                    <Ionicons name="add" size={20} color={accentColor} />
                  </Pressable>
                ))}
              </ScrollView>
            ) : (
              <View style={styles.emptyModalContent}>
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                  No lists yet. Create one first!
                </Text>
                <Pressable
                  style={[styles.createButton, { backgroundColor: colors.primary, marginTop: 16 }]}
                  onPress={() => {
                    setAddToListModalVisible(false);
                    setCreateModalVisible(true);
                  }}
                >
                  <Text style={styles.createButtonText}>Create List</Text>
                </Pressable>
              </View>
            )}
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  filterText: {
    fontSize: 15,
    fontWeight: '500',
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    padding: 4,
    borderRadius: 12,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 12,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: CARD_GAP,
  },
  trickCardWrapper: {
    flex: 1,
    maxWidth: CARD_WIDTH,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  createListButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    marginBottom: 16,
    gap: 8,
  },
  createListText: {
    fontSize: 15,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  keyboardAvoid: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  filterOptionText: {
    fontSize: 16,
  },
  createModalContent: {
    margin: 20,
    borderRadius: 16,
    padding: 20,
  },
  createInput: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 16,
    marginTop: 16,
    marginBottom: 20,
  },
  createModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButton: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButtonText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '600',
  },
  emptyModalContent: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
});
