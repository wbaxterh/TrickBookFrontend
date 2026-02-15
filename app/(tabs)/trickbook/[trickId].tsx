/**
 * Trickipedia Trick Detail Screen
 * Shows detailed info about a specific trick from the Trickipedia database
 *
 * Features:
 * - Trick name, category, difficulty
 * - Tutorial video (if available)
 * - Description and step-by-step tips
 * - Add to TrickList functionality
 */

import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShareToHomieModal } from '@/components/share';
import { addTrickToList, getTrickById, getUserTrickLists } from '@/lib/api/trickbook';
import { useThemeContext } from '@/lib/providers/ThemeProvider';
import { useAuthStore } from '@/lib/stores/authStore';
import {
  DIFFICULTY_COLORS,
  type Trick,
  type TrickDifficulty,
  type TrickList,
} from '@/types/trickbook';

const YELLOW = '#FCF150';
const DARK = '#1f1f1f';
const _GRAY = '#666666';

/**
 * Convert difficulty string to numeric rating (1-4)
 */
function getDifficultyRating(difficulty: TrickDifficulty): number {
  switch (difficulty) {
    case 'Beginner':
      return 1;
    case 'Intermediate':
      return 2;
    case 'Advanced':
      return 3;
    case 'Expert':
      return 4;
    default:
      return 2;
  }
}

/**
 * Get difficulty label and color
 */
function getDifficultyInfo(difficulty: TrickDifficulty) {
  return {
    label: difficulty,
    color: DIFFICULTY_COLORS[difficulty] || YELLOW,
    rating: getDifficultyRating(difficulty),
  };
}

export default function TrickDetailScreen() {
  const { trickId } = useLocalSearchParams<{ trickId: string }>();
  const { theme } = useThemeContext();
  const { token, user } = useAuthStore();

  const [trick, setTrick] = useState<Trick | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);

  // Add to list modal
  const [listModalVisible, setListModalVisible] = useState(false);
  const [userLists, setUserLists] = useState<TrickList[]>([]);
  const [loadingLists, setLoadingLists] = useState(false);
  const [addingToList, setAddingToList] = useState<string | null>(null);

  // Share modal
  const [shareModalVisible, setShareModalVisible] = useState(false);

  // Load trick data
  const loadTrick = useCallback(async () => {
    if (!trickId) return;

    try {
      setLoading(true);
      const data = await getTrickById(trickId);
      setTrick(data);
    } catch (_error) {
    } finally {
      setLoading(false);
    }
  }, [trickId]);

  useEffect(() => {
    loadTrick();
  }, [loadTrick]);

  // Load user's trick lists for the modal
  const loadUserLists = useCallback(async () => {
    if (!token || !user?.id) return;

    try {
      setLoadingLists(true);
      const lists = await getUserTrickLists(user.id, token);
      setUserLists(lists);
    } catch (_error) {
    } finally {
      setLoadingLists(false);
    }
  }, [token, user?.id]);

  // Open the add to list modal
  const handleOpenListModal = () => {
    if (!token || !user?.id) {
      Alert.alert('Sign In Required', 'Please sign in to add tricks to your lists.');
      return;
    }
    loadUserLists();
    setListModalVisible(true);
  };

  // Add trick to a specific list
  const handleAddToList = async (listId: string, listName: string) => {
    if (!trick || !token) return;

    try {
      setAddingToList(listId);
      const success = await addTrickToList(
        listId,
        {
          name: trick.name,
          link: trick.videoUrl || trick.url || '',
          notes: `From Trickipedia: ${trick.category} - ${trick.difficulty}`,
          trickipediaId: trick._id, // Link back to Trickipedia for "View Tutorial" feature
        },
        token,
      );

      if (success) {
        Alert.alert('Added!', `"${trick.name}" has been added to "${listName}"`);
        setListModalVisible(false);
      } else {
        Alert.alert('Error', 'Failed to add trick to list');
      }
    } catch (_error) {
      Alert.alert('Error', 'Something went wrong');
    } finally {
      setAddingToList(null);
    }
  };

  // Open video URL
  const handleOpenVideo = () => {
    const videoUrl = trick?.videoUrl || trick?.url;
    if (videoUrl) {
      Linking.openURL(videoUrl).catch(() => {
        Alert.alert('Error', 'Could not open video link');
      });
    }
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

  if (!trick) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
        edges={['top']}
      >
        <View style={styles.loadingContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={theme.textSecondary} />
          <Text style={[styles.errorText, { color: theme.textSecondary }]}>Trick not found</Text>
          <Pressable style={styles.backButtonLarge} onPress={() => router.back()}>
            <Text style={styles.backButtonLargeText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const difficultyInfo = getDifficultyInfo(trick.difficulty);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Pressable
            style={[styles.backButton, { backgroundColor: theme.surface }]}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </Pressable>
          <View style={styles.headerTitleContainer}>
            <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
              {trick.name}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              style={[styles.headerActionButton, { backgroundColor: theme.surface }]}
              onPress={() => setShareModalVisible(true)}
            >
              <Ionicons name="share-outline" size={22} color={theme.text} />
            </Pressable>
            <Pressable
              style={[styles.headerActionButton, { backgroundColor: theme.surface }]}
              onPress={() => setIsFavorite(!isFavorite)}
            >
              <Ionicons
                name={isFavorite ? 'heart' : 'heart-outline'}
                size={22}
                color={isFavorite ? '#ef4444' : theme.text}
              />
            </Pressable>
          </View>
        </View>

        {/* Video Section */}
        <Pressable
          style={[styles.videoContainer, { backgroundColor: theme.surface }]}
          onPress={handleOpenVideo}
          disabled={!trick.videoUrl && !trick.url}
        >
          <View style={styles.videoPlayButton}>
            <Ionicons name="play" size={32} color={DARK} />
          </View>
          <Text style={[styles.videoLabel, { color: theme.textSecondary }]}>
            {trick.videoUrl || trick.url ? 'Watch Tutorial Video' : 'No Video Available'}
          </Text>
          {(trick.videoUrl || trick.url) && (
            <Ionicons
              name="open-outline"
              size={16}
              color={theme.textSecondary}
              style={styles.videoExternalIcon}
            />
          )}
        </Pressable>

        {/* Category & Difficulty */}
        <View style={styles.metaContainer}>
          <View style={[styles.categoryBadge, { backgroundColor: theme.surface }]}>
            <Ionicons name="folder-outline" size={16} color={theme.text} />
            <Text style={[styles.categoryText, { color: theme.text }]}>{trick.category}</Text>
          </View>
          <View style={styles.difficultyContainer}>
            <View
              style={[styles.difficultyBadge, { backgroundColor: `${difficultyInfo.color}20` }]}
            >
              <Text style={[styles.difficultyText, { color: difficultyInfo.color }]}>
                {difficultyInfo.label}
              </Text>
            </View>
            <View style={styles.starsContainer}>
              {[1, 2, 3, 4].map((star) => (
                <Ionicons
                  key={star}
                  name={star <= difficultyInfo.rating ? 'star' : 'star-outline'}
                  size={18}
                  color={YELLOW}
                  style={styles.starIcon}
                />
              ))}
            </View>
          </View>
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>About</Text>
          <Text style={[styles.description, { color: theme.textSecondary }]}>
            {trick.description}
          </Text>
        </View>

        {/* Tips / Steps */}
        {trick.steps && trick.steps.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Steps & Tips</Text>
            <View style={styles.tipsContainer}>
              {trick.steps.map((step, index) => (
                <View key={index} style={[styles.tipCard, { backgroundColor: theme.surface }]}>
                  <View style={styles.tipNumber}>
                    <Text style={styles.tipNumberText}>{index + 1}</Text>
                  </View>
                  <Text style={[styles.tipText, { color: theme.text }]}>{step}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Source attribution */}
        {trick.source && (
          <View style={styles.sourceContainer}>
            <Ionicons name="information-circle-outline" size={14} color={theme.textSecondary} />
            <Text style={[styles.sourceText, { color: theme.textSecondary }]}>
              Source: {trick.source}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Fixed Bottom Button */}
      <View
        style={[
          styles.bottomContainer,
          { backgroundColor: theme.background, borderTopColor: theme.border },
        ]}
      >
        <Pressable style={styles.addButton} onPress={handleOpenListModal}>
          <Ionicons name="add-circle-outline" size={22} color={DARK} />
          <Text style={styles.addButtonText}>Add to TrickList</Text>
        </Pressable>
      </View>

      {/* Add to List Modal */}
      <Modal
        visible={listModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setListModalVisible(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
          <SafeAreaView style={styles.container}>
            {/* Modal Header */}
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Pressable onPress={() => setListModalVisible(false)}>
                <Text style={[styles.modalCancel, { color: theme.textSecondary }]}>Cancel</Text>
              </Pressable>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Add to TrickList</Text>
              <View style={{ width: 60 }} />
            </View>

            {/* Lists */}
            {loadingLists ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={YELLOW} />
              </View>
            ) : userLists.length === 0 ? (
              <View style={styles.emptyListsContainer}>
                <Ionicons name="list-outline" size={48} color={theme.textSecondary} />
                <Text style={[styles.emptyListsText, { color: theme.textSecondary }]}>
                  No trick lists yet
                </Text>
                <Text style={[styles.emptyListsSubtext, { color: theme.textSecondary }]}>
                  Create a trick list first to add tricks
                </Text>
              </View>
            ) : (
              <FlatList
                data={userLists}
                keyExtractor={(item) => item._id}
                contentContainerStyle={styles.listsContent}
                renderItem={({ item }) => (
                  <Pressable
                    style={[styles.listItem, { backgroundColor: theme.surface }]}
                    onPress={() => handleAddToList(item._id, item.name)}
                    disabled={addingToList === item._id}
                  >
                    <View style={styles.listItemContent}>
                      <Ionicons name="list" size={24} color={YELLOW} />
                      <View style={styles.listItemInfo}>
                        <Text style={[styles.listItemName, { color: theme.text }]}>
                          {item.name}
                        </Text>
                        <Text style={[styles.listItemCount, { color: theme.textSecondary }]}>
                          {item.tricks?.length || 0} tricks
                        </Text>
                      </View>
                    </View>
                    {addingToList === item._id ? (
                      <ActivityIndicator size="small" color={YELLOW} />
                    ) : (
                      <Ionicons name="add-circle" size={28} color={YELLOW} />
                    )}
                  </Pressable>
                )}
              />
            )}
          </SafeAreaView>
        </View>
      </Modal>

      {/* Share to Homie Modal */}
      {trick && (
        <ShareToHomieModal
          visible={shareModalVisible}
          onClose={() => setShareModalVisible(false)}
          contentType="trick"
          contentId={trick._id}
          preview={{
            title: trick.name,
            subtitle: `${trick.category} - ${trick.difficulty}`,
          }}
          onSuccess={(conversationId) => {
            router.push(`/(tabs)/homies/chat/${conversationId}`);
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 16,
    marginTop: 16,
  },
  backButtonLarge: {
    marginTop: 24,
    backgroundColor: YELLOW,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 25,
  },
  backButtonLargeText: {
    color: DARK,
    fontSize: 16,
    fontWeight: '600',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    paddingHorizontal: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerActionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Video
  videoContainer: {
    marginHorizontal: 16,
    marginTop: 16,
    height: 180,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPlayButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: YELLOW,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoLabel: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '500',
  },
  videoExternalIcon: {
    marginTop: 4,
  },

  // Meta (category & difficulty)
  metaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 20,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '500',
  },
  difficultyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  difficultyBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  difficultyText: {
    fontSize: 12,
    fontWeight: '700',
  },
  starsContainer: {
    flexDirection: 'row',
  },
  starIcon: {
    marginHorizontal: 1,
  },

  // Sections
  section: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    lineHeight: 24,
  },

  // Tips
  tipsContainer: {
    gap: 12,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
  },
  tipNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: YELLOW,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  tipNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: DARK,
  },
  tipText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },

  // Source
  sourceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 24,
    gap: 6,
  },
  sourceText: {
    fontSize: 12,
  },

  // Bottom Button
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: YELLOW,
    paddingVertical: 16,
    borderRadius: 30,
    gap: 8,
  },
  addButtonText: {
    color: DARK,
    fontSize: 16,
    fontWeight: '700',
  },

  // Modal
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalCancel: {
    fontSize: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  emptyListsContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyListsText: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 16,
  },
  emptyListsSubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  listsContent: {
    padding: 16,
    gap: 12,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
  },
  listItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  listItemInfo: {
    marginLeft: 12,
    flex: 1,
  },
  listItemName: {
    fontSize: 16,
    fontWeight: '600',
  },
  listItemCount: {
    fontSize: 13,
    marginTop: 2,
  },
});
