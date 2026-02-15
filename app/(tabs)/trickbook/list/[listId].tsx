/**
 * TrickList Detail Screen
 * Shows tricks in a specific list with swipe actions
 *
 * Features:
 * - View all tricks in a list
 * - Tap status button to toggle Complete/To Do
 * - Tap row to view/edit trick details
 * - Swipe left to delete
 * - Swipe right to edit
 * - Add new tricks with name, notes, and link
 */

import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShareToHomieModal } from '@/components/share';
import {
  addTrickToList,
  deleteTrickList,
  editTrick,
  getTrickList,
  removeTrickFromList,
  updateTrickList,
  updateTrickStatus,
} from '@/lib/api/trickbook';
import { useThemeContext } from '@/lib/providers/ThemeProvider';
import { useAuthStore } from '@/lib/stores/authStore';
import type { TrickList, TrickListItem, TrickStatus } from '@/types/trickbook';

const YELLOW = '#FCF150';
const DARK = '#1f1f1f';
const GRAY = '#666666';
const RED = '#ef4444';
const BLUE = '#3b82f6';

/**
 * Maps backend 'checked' field to display status
 * Backend uses: "To Do", "Complete", "Completed", "Learning"
 * Frontend uses: "Not Started", "Learning", "Landed", "Mastered"
 */
function isComplete(trick: TrickListItem): boolean {
  // Check both 'checked' (backend) and 'status' (frontend) fields
  const checked = trick.checked;
  const status = trick.status;

  // Backend values that mean "complete"
  if (checked === 'Complete' || checked === 'Completed') return true;

  // Frontend values that mean "complete"
  if (status === 'Mastered' || status === 'Landed') return true;

  return false;
}

export default function TrickListDetailScreen() {
  const { listId } = useLocalSearchParams<{ listId: string }>();
  const { theme } = useThemeContext();
  const { token, user } = useAuthStore();

  const [list, setList] = useState<TrickList | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [selectedTrick, setSelectedTrick] = useState<TrickListItem | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [listEditModalVisible, setListEditModalVisible] = useState(false);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [shareModalVisible, setShareModalVisible] = useState(false);

  // Form states
  const [trickName, setTrickName] = useState('');
  const [trickLink, setTrickLink] = useState('');
  const [trickNotes, setTrickNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const loadList = useCallback(async () => {
    if (!listId || !token) return;

    try {
      setLoading(true);
      const userId = user?.id || user?._id;
      const data = await getTrickList(listId, token, userId);
      if (data?.tricks) {
        // Log all tricks with their checked status
        data.tricks.forEach((_t, _i) => {});
      }
      setList(data);
    } catch (_error) {
      Alert.alert('Error', 'Failed to load trick list');
    } finally {
      setLoading(false);
    }
  }, [listId, token, user?.id, user?._id]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  // Toggle status between To Do and Complete
  const handleToggleStatus = async (trick: TrickListItem) => {
    if (!listId || !token) return;

    const currentlyComplete = isComplete(trick);
    const newStatus: TrickStatus = currentlyComplete ? 'Not Started' : 'Mastered';

    try {
      await updateTrickStatus(listId, trick._id, newStatus, token);

      // Update local state
      setList((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          tricks: prev.tricks.map((t) =>
            t._id === trick._id
              ? { ...t, checked: currentlyComplete ? 'To Do' : 'Completed', status: newStatus }
              : t,
          ),
        };
      });
    } catch (_error) {
      Alert.alert('Error', 'Failed to update trick status');
    }
  };

  // Delete trick
  const handleDeleteTrick = async (trick: TrickListItem) => {
    if (!listId || !token) return;

    Alert.alert('Delete Trick', `Delete "${trick.name}" from this list?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeTrickFromList(listId, trick._id, token);
            setList((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                tricks: prev.tricks.filter((t) => t._id !== trick._id),
              };
            });
          } catch (_error) {
            Alert.alert('Error', 'Failed to delete trick');
          }
        },
      },
    ]);
  };

  // Open edit modal
  const openEditModal = (trick: TrickListItem) => {
    setSelectedTrick(trick);
    setTrickName(trick.name);
    setTrickLink(trick.link || '');
    setTrickNotes(trick.notes || '');
    setEditModalVisible(true);
  };

  // Save edited trick
  const handleSaveEdit = async () => {
    if (!selectedTrick || !trickName.trim() || !token) return;

    try {
      setSaving(true);
      await editTrick(
        selectedTrick._id,
        {
          name: trickName.trim(),
          link: trickLink.trim(),
          notes: trickNotes.trim(),
        },
        token,
      );

      // Update local state
      setList((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          tricks: prev.tricks.map((t) =>
            t._id === selectedTrick._id
              ? { ...t, name: trickName.trim(), link: trickLink.trim(), notes: trickNotes.trim() }
              : t,
          ),
        };
      });

      setEditModalVisible(false);
      resetForm();
    } catch (_error) {
      Alert.alert('Error', 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  // Add new trick
  const handleAddTrick = async () => {
    if (!trickName.trim() || !listId || !token) return;

    try {
      setSaving(true);
      await addTrickToList(
        listId,
        {
          name: trickName.trim(),
          link: trickLink.trim(),
          notes: trickNotes.trim(),
        },
        token,
      );

      await loadList();
      setAddModalVisible(false);
      resetForm();
    } catch (_error) {
      Alert.alert('Error', 'Failed to add trick');
    } finally {
      setSaving(false);
    }
  };

  // Reset form fields
  const resetForm = () => {
    setTrickName('');
    setTrickLink('');
    setTrickNotes('');
    setSelectedTrick(null);
  };

  // Open share modal
  const handleOpenShare = () => {
    setListEditModalVisible(false);
    setShareModalVisible(true);
  };

  // Open rename modal
  const handleOpenRename = () => {
    setNewListName(list?.name || '');
    setListEditModalVisible(false);
    setRenameModalVisible(true);
  };

  // Rename the list
  const handleRenameList = async () => {
    if (!listId || !token || !newListName.trim()) return;

    try {
      setSaving(true);
      const success = await updateTrickList(listId, newListName.trim(), token);
      if (success) {
        setList((prev) => (prev ? { ...prev, name: newListName.trim() } : prev));
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
    setListEditModalVisible(false);
    Alert.alert(
      'Delete List',
      `Are you sure you want to delete "${list?.name}"? This will also delete all tricks in this list.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!listId || !token) return;
            try {
              const success = await deleteTrickList(listId, token);
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

  // Render swipe actions
  const renderLeftActions =
    (trick: TrickListItem) =>
    (
      _progress: Animated.AnimatedInterpolation<number>,
      dragX: Animated.AnimatedInterpolation<number>,
    ) => {
      const scale = dragX.interpolate({
        inputRange: [0, 100],
        outputRange: [0, 1],
        extrapolate: 'clamp',
      });

      return (
        <Pressable
          style={[styles.swipeAction, styles.editAction]}
          onPress={() => openEditModal(trick)}
        >
          <Animated.View style={{ transform: [{ scale }] }}>
            <Ionicons name="pencil" size={24} color="#fff" />
            <Text style={styles.swipeActionText}>Edit</Text>
          </Animated.View>
        </Pressable>
      );
    };

  const renderRightActions =
    (trick: TrickListItem) =>
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
          onPress={() => handleDeleteTrick(trick)}
        >
          <Animated.View style={{ transform: [{ scale }] }}>
            <Ionicons name="trash" size={24} color="#fff" />
            <Text style={styles.swipeActionText}>Delete</Text>
          </Animated.View>
        </Pressable>
      );
    };

  // Render trick item
  const renderTrickItem = ({ item }: { item: TrickListItem }) => {
    const complete = isComplete(item);

    return (
      <Swipeable
        renderLeftActions={renderLeftActions(item)}
        renderRightActions={renderRightActions(item)}
        overshootLeft={false}
        overshootRight={false}
      >
        <Pressable
          style={[
            styles.trickRow,
            { backgroundColor: theme.background, borderBottomColor: theme.border },
          ]}
          onPress={() => {
            setSelectedTrick(item);
            setDetailModalVisible(true);
          }}
        >
          <Text style={[styles.trickName, { color: theme.text }]}>{item.name}</Text>
          <Pressable
            style={[styles.statusButton, { backgroundColor: complete ? YELLOW : GRAY }]}
            onPress={(e) => {
              e.stopPropagation();
              handleToggleStatus(item);
            }}
          >
            <Text style={[styles.statusButtonText, { color: complete ? DARK : '#fff' }]}>
              {complete ? 'COMPLETE' : 'TO DO'}
            </Text>
          </Pressable>
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

  if (!list) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
        edges={['top']}
      >
        <View style={styles.loadingContainer}>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>List not found</Text>
          <Pressable style={styles.goBackButton} onPress={() => router.back()}>
            <Text style={styles.goBackButtonText}>Go Back</Text>
          </Pressable>
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
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color={theme.text} />
            <Text style={[styles.backText, { color: theme.text }]}>Back</Text>
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
            {list.name}
          </Text>
          <Pressable style={styles.listEditButton} onPress={() => setListEditModalVisible(true)}>
            <Ionicons name="ellipsis-horizontal" size={24} color={theme.text} />
          </Pressable>
        </View>

        {/* Tricks List */}
        <FlatList
          data={list.tricks}
          keyExtractor={(item) => item._id}
          renderItem={renderTrickItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="list-outline" size={48} color={theme.textSecondary} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                No tricks in this list yet
              </Text>
              <Text style={[styles.emptySubtext, { color: theme.textSecondary }]}>
                Tap the button below to add your first trick
              </Text>
            </View>
          }
        />

        {/* Fixed Bottom Add Button */}
        <View
          style={[
            styles.bottomContainer,
            { borderTopColor: theme.border, backgroundColor: theme.background },
          ]}
        >
          <Pressable style={styles.addButton} onPress={() => setAddModalVisible(true)}>
            <Text style={styles.addButtonText}>+ ADD TRICK</Text>
          </Pressable>
        </View>

        {/* Trick Detail Modal */}
        <Modal
          visible={detailModalVisible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => {
            setDetailModalVisible(false);
            setSelectedTrick(null);
          }}
        >
          <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
            <SafeAreaView style={styles.container}>
              <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
                <Pressable
                  onPress={() => {
                    setDetailModalVisible(false);
                    setSelectedTrick(null);
                  }}
                >
                  <Text style={[styles.modalHeaderButton, { color: theme.text }]}>Close</Text>
                </Pressable>
                <Text style={[styles.modalTitle, { color: theme.text }]}>Trick Details</Text>
                <Pressable
                  style={styles.editButton}
                  onPress={() => {
                    setDetailModalVisible(false);
                    if (selectedTrick) openEditModal(selectedTrick);
                  }}
                >
                  <Ionicons name="pencil" size={16} color={DARK} />
                  <Text style={styles.editButtonText}>Edit</Text>
                </Pressable>
              </View>

              {selectedTrick && (
                <View style={styles.modalContent}>
                  <Text style={[styles.trickDetailName, { color: theme.text }]}>
                    {selectedTrick.name}
                  </Text>

                  {/* Status */}
                  <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>STATUS</Text>
                  <View style={styles.statusOptions}>
                    <Pressable
                      style={[
                        styles.statusOption,
                        {
                          backgroundColor: isComplete(selectedTrick) ? YELLOW : theme.surface,
                          borderColor: isComplete(selectedTrick) ? YELLOW : theme.border,
                        },
                      ]}
                      onPress={() => {
                        handleToggleStatus(selectedTrick);
                        setSelectedTrick({
                          ...selectedTrick,
                          checked: 'Completed',
                          status: 'Mastered',
                        });
                      }}
                    >
                      <Text
                        style={[
                          styles.statusOptionText,
                          { color: isComplete(selectedTrick) ? DARK : theme.textSecondary },
                        ]}
                      >
                        COMPLETE
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.statusOption,
                        {
                          backgroundColor: !isComplete(selectedTrick) ? GRAY : theme.surface,
                          borderColor: !isComplete(selectedTrick) ? GRAY : theme.border,
                        },
                      ]}
                      onPress={() => {
                        handleToggleStatus(selectedTrick);
                        setSelectedTrick({
                          ...selectedTrick,
                          checked: 'To Do',
                          status: 'Not Started',
                        });
                      }}
                    >
                      <Text
                        style={[
                          styles.statusOptionText,
                          { color: !isComplete(selectedTrick) ? '#fff' : theme.textSecondary },
                        ]}
                      >
                        TO DO
                      </Text>
                    </Pressable>
                  </View>

                  {/* Notes */}
                  {selectedTrick.notes ? (
                    <>
                      <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                        NOTES
                      </Text>
                      <View style={[styles.infoBox, { backgroundColor: theme.surface }]}>
                        <Text style={{ color: theme.text }}>{selectedTrick.notes}</Text>
                      </View>
                    </>
                  ) : null}

                  {/* Link */}
                  {selectedTrick.link ? (
                    <>
                      <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                        VIDEO LINK
                      </Text>
                      <Pressable
                        style={[styles.linkBox, { backgroundColor: theme.surface }]}
                        onPress={() => {
                          Linking.openURL(selectedTrick.link!).catch(() => {
                            Alert.alert('Error', 'Could not open link');
                          });
                        }}
                      >
                        <Ionicons name="play-circle-outline" size={20} color={BLUE} />
                        <Text style={styles.linkText} numberOfLines={1}>
                          {selectedTrick.link}
                        </Text>
                        <Ionicons name="open-outline" size={16} color={BLUE} />
                      </Pressable>
                    </>
                  ) : null}

                  {/* Trickipedia Link - shown if trick was added from Trickipedia */}
                  {selectedTrick.trickipediaId ? (
                    <>
                      <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                        FROM TRICKIPEDIA
                      </Text>
                      <Pressable
                        style={[styles.trickipediaButton, { backgroundColor: theme.surface }]}
                        onPress={() => {
                          setDetailModalVisible(false);
                          router.push(`/(tabs)/trickbook/${selectedTrick.trickipediaId}`);
                        }}
                      >
                        <Ionicons name="book-outline" size={20} color={YELLOW} />
                        <Text style={styles.trickipediaButtonText}>View Tutorial & Steps</Text>
                        <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
                      </Pressable>
                    </>
                  ) : null}

                  {/* Delete Button */}
                  <Pressable
                    style={[styles.deleteButton, { backgroundColor: RED }]}
                    onPress={() => {
                      setDetailModalVisible(false);
                      handleDeleteTrick(selectedTrick);
                    }}
                  >
                    <Ionicons name="trash-outline" size={20} color="#fff" />
                    <Text style={styles.deleteButtonText}>Delete Trick</Text>
                  </Pressable>
                </View>
              )}
            </SafeAreaView>
          </View>
        </Modal>

        {/* Edit Trick Modal */}
        <Modal
          visible={editModalVisible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => {
            setEditModalVisible(false);
            resetForm();
          }}
        >
          <KeyboardAvoidingView
            style={[styles.modalContainer, { backgroundColor: theme.background }]}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <SafeAreaView style={styles.container}>
              <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
                <Pressable
                  onPress={() => {
                    setEditModalVisible(false);
                    resetForm();
                  }}
                >
                  <Text style={[styles.modalHeaderButton, { color: theme.textSecondary }]}>
                    Cancel
                  </Text>
                </Pressable>
                <Text style={[styles.modalTitle, { color: theme.text }]}>Edit Trick</Text>
                <Pressable
                  style={[
                    styles.saveButton,
                    (!trickName.trim() || saving) && styles.saveButtonDisabled,
                  ]}
                  onPress={handleSaveEdit}
                  disabled={!trickName.trim() || saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color={DARK} />
                  ) : (
                    <Text style={styles.saveButtonText}>Save</Text>
                  )}
                </Pressable>
              </View>

              <View style={styles.formContent}>
                <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                  TRICK NAME *
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: theme.surface,
                      color: theme.text,
                      borderColor: theme.border,
                    },
                  ]}
                  placeholder="e.g., Kickflip"
                  placeholderTextColor={theme.textSecondary}
                  value={trickName}
                  onChangeText={setTrickName}
                  autoFocus
                />

                <Text style={[styles.sectionLabel, { color: theme.textSecondary, marginTop: 20 }]}>
                  VIDEO LINK
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: theme.surface,
                      color: theme.text,
                      borderColor: theme.border,
                    },
                  ]}
                  placeholder="https://youtube.com/watch?v=..."
                  placeholderTextColor={theme.textSecondary}
                  value={trickLink}
                  onChangeText={setTrickLink}
                  autoCapitalize="none"
                  keyboardType="url"
                />

                <Text style={[styles.sectionLabel, { color: theme.textSecondary, marginTop: 20 }]}>
                  NOTES
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    styles.textArea,
                    {
                      backgroundColor: theme.surface,
                      color: theme.text,
                      borderColor: theme.border,
                    },
                  ]}
                  placeholder="Add notes about this trick..."
                  placeholderTextColor={theme.textSecondary}
                  value={trickNotes}
                  onChangeText={setTrickNotes}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>
            </SafeAreaView>
          </KeyboardAvoidingView>
        </Modal>

        {/* Add Trick Modal */}
        <Modal
          visible={addModalVisible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => {
            setAddModalVisible(false);
            resetForm();
          }}
        >
          <KeyboardAvoidingView
            style={[styles.modalContainer, { backgroundColor: theme.background }]}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <SafeAreaView style={styles.container}>
              <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
                <Pressable
                  onPress={() => {
                    setAddModalVisible(false);
                    resetForm();
                  }}
                >
                  <Text style={[styles.modalHeaderButton, { color: theme.textSecondary }]}>
                    Cancel
                  </Text>
                </Pressable>
                <Text style={[styles.modalTitle, { color: theme.text }]}>Add Trick</Text>
                <Pressable onPress={handleAddTrick} disabled={!trickName.trim() || saving}>
                  <Text
                    style={[
                      styles.modalHeaderButton,
                      { color: trickName.trim() ? YELLOW : theme.textSecondary },
                    ]}
                  >
                    {saving ? 'Adding...' : 'Add'}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.formContent}>
                <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                  TRICK NAME *
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: theme.surface,
                      color: theme.text,
                      borderColor: theme.border,
                    },
                  ]}
                  placeholder="e.g., Kickflip, Heelflip, 360 flip..."
                  placeholderTextColor={theme.textSecondary}
                  value={trickName}
                  onChangeText={setTrickName}
                  autoFocus
                />

                <Text style={[styles.sectionLabel, { color: theme.textSecondary, marginTop: 20 }]}>
                  VIDEO LINK
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: theme.surface,
                      color: theme.text,
                      borderColor: theme.border,
                    },
                  ]}
                  placeholder="https://youtube.com/watch?v=..."
                  placeholderTextColor={theme.textSecondary}
                  value={trickLink}
                  onChangeText={setTrickLink}
                  autoCapitalize="none"
                  keyboardType="url"
                />

                <Text style={[styles.sectionLabel, { color: theme.textSecondary, marginTop: 20 }]}>
                  NOTES
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    styles.textArea,
                    {
                      backgroundColor: theme.surface,
                      color: theme.text,
                      borderColor: theme.border,
                    },
                  ]}
                  placeholder="Add notes about this trick..."
                  placeholderTextColor={theme.textSecondary}
                  value={trickNotes}
                  onChangeText={setTrickNotes}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>
            </SafeAreaView>
          </KeyboardAvoidingView>
        </Modal>

        {/* List Edit Action Sheet Modal */}
        <Modal
          visible={listEditModalVisible}
          animationType="fade"
          transparent
          onRequestClose={() => setListEditModalVisible(false)}
        >
          <Pressable
            style={styles.actionSheetOverlay}
            onPress={() => setListEditModalVisible(false)}
          >
            <View style={[styles.actionSheet, { backgroundColor: theme.surface }]}>
              <Text style={[styles.actionSheetTitle, { color: theme.text }]}>{list.name}</Text>
              <Pressable
                style={[styles.actionSheetButton, { borderBottomColor: theme.border }]}
                onPress={handleOpenShare}
              >
                <Ionicons name="share-outline" size={22} color={theme.text} />
                <Text style={[styles.actionSheetButtonText, { color: theme.text }]}>
                  Share to Homie
                </Text>
              </Pressable>
              <Pressable
                style={[styles.actionSheetButton, { borderBottomColor: theme.border }]}
                onPress={handleOpenRename}
              >
                <Ionicons name="pencil-outline" size={22} color={theme.text} />
                <Text style={[styles.actionSheetButtonText, { color: theme.text }]}>
                  Rename List
                </Text>
              </Pressable>
              <Pressable style={styles.actionSheetButton} onPress={handleDeleteList}>
                <Ionicons name="trash-outline" size={22} color={RED} />
                <Text style={[styles.actionSheetButtonText, { color: RED }]}>Delete List</Text>
              </Pressable>
              <Pressable
                style={[styles.actionSheetCancelButton, { backgroundColor: theme.background }]}
                onPress={() => setListEditModalVisible(false)}
              >
                <Text style={[styles.actionSheetCancelText, { color: theme.text }]}>Cancel</Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>

        {/* Rename List Modal */}
        <Modal
          visible={renameModalVisible}
          animationType="fade"
          transparent
          onRequestClose={() => setRenameModalVisible(false)}
        >
          <KeyboardAvoidingView
            style={styles.renameOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={[styles.renameModal, { backgroundColor: theme.surface }]}>
              <Text style={[styles.renameTitle, { color: theme.text }]}>Rename List</Text>
              <TextInput
                style={[
                  styles.renameInput,
                  {
                    backgroundColor: theme.background,
                    color: theme.text,
                    borderColor: theme.border,
                  },
                ]}
                value={newListName}
                onChangeText={setNewListName}
                placeholder="List name"
                placeholderTextColor={theme.textSecondary}
                autoFocus
                selectTextOnFocus
              />
              <View style={styles.renameButtons}>
                <Pressable
                  style={[styles.renameButton, { backgroundColor: theme.background }]}
                  onPress={() => setRenameModalVisible(false)}
                >
                  <Text style={[styles.renameButtonText, { color: theme.textSecondary }]}>
                    Cancel
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.renameButton,
                    { backgroundColor: YELLOW },
                    (!newListName.trim() || saving) && { opacity: 0.5 },
                  ]}
                  onPress={handleRenameList}
                  disabled={!newListName.trim() || saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color={DARK} />
                  ) : (
                    <Text style={[styles.renameButtonText, { color: DARK }]}>Save</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Share to Homie Modal */}
        {list && (
          <ShareToHomieModal
            visible={shareModalVisible}
            onClose={() => setShareModalVisible(false)}
            contentType="tricklist"
            contentId={list._id}
            preview={{
              title: list.name,
              subtitle: `${list.tricks?.length || 0} tricks`,
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 60,
  },
  backText: {
    fontSize: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  listEditButton: {
    padding: 4,
    minWidth: 60,
    alignItems: 'flex-end',
  },
  listContent: {
    flexGrow: 1,
  },
  trickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderBottomWidth: 1,
  },
  trickName: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
    marginRight: 12,
  },
  statusButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  statusButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  swipeAction: {
    width: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editAction: {
    backgroundColor: BLUE,
  },
  deleteAction: {
    backgroundColor: RED,
  },
  swipeActionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  bottomContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
  },
  addButton: {
    backgroundColor: YELLOW,
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
  },
  addButtonText: {
    color: DARK,
    fontSize: 16,
    fontWeight: '700',
  },
  goBackButton: {
    marginTop: 16,
    backgroundColor: YELLOW,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  goBackButtonText: {
    color: DARK,
    fontSize: 16,
    fontWeight: '600',
  },
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
  modalHeaderButton: {
    fontSize: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  formContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  trickDetailName: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  statusOptions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statusOption: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
  },
  statusOptionText: {
    fontSize: 14,
    fontWeight: '700',
  },
  infoBox: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  linkBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
    gap: 10,
  },
  linkText: {
    flex: 1,
    color: BLUE,
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  trickipediaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
    gap: 10,
  },
  trickipediaButtonText: {
    flex: 1,
    color: YELLOW,
    fontSize: 15,
    fontWeight: '600',
  },
  textInput: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 14,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 'auto',
    marginBottom: 20,
    gap: 8,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: YELLOW,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 6,
  },
  editButtonText: {
    color: DARK,
    fontSize: 14,
    fontWeight: '600',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: YELLOW,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: DARK,
    fontSize: 14,
    fontWeight: '600',
  },
  actionSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  actionSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 40,
    paddingHorizontal: 16,
  },
  actionSheetTitle: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
  },
  actionSheetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    gap: 12,
  },
  actionSheetButtonText: {
    fontSize: 17,
  },
  actionSheetCancelButton: {
    marginTop: 12,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionSheetCancelText: {
    fontSize: 17,
    fontWeight: '600',
  },
  renameOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  renameModal: {
    width: '100%',
    borderRadius: 16,
    padding: 20,
  },
  renameTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 20,
  },
  renameInput: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  renameButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  renameButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  renameButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
