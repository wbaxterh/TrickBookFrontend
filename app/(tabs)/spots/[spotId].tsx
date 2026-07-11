/**
 * Spot Detail Screen
 * Shows detailed info about a specific spot
 */

import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
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
import { ShareToHomieModal } from '@/components/share';
import { AddToSpotListModal, SpotMap, SpotReviewsList } from '@/components/spots';
import {
  deleteSpot,
  getSpotById,
  isSpotSaved,
  type Spot,
  type SpotPhoto,
  saveSpot,
  unsaveSpot,
  updateSpot,
} from '@/lib/api/spots';
import { useThemeContext } from '@/lib/providers/ThemeProvider';
import { useAuthStore } from '@/lib/stores/authStore';

const SPOT_CATEGORIES: { id: Spot['category']; label: string }[] = [
  { id: 'park', label: 'Park' },
  { id: 'street', label: 'Street' },
  { id: 'indoor', label: 'Indoor' },
  { id: 'diy', label: 'DIY' },
  { id: 'resort', label: 'Resort' },
  { id: 'other', label: 'Other' },
];

const YELLOW = '#FCF150';
const DARK = '#1a1a1a';

export default function SpotDetailScreen() {
  const { spotId } = useLocalSearchParams<{ spotId: string }>();
  const { theme, isDark } = useThemeContext();
  const { user } = useAuthStore();
  const [isFavorite, setIsFavorite] = useState(false);
  const [spot, setSpot] = useState<Spot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareModalVisible, setShareModalVisible] = useState(false);

  // Save state ("My Spots" saved bucket)
  const [isSaved, setIsSaved] = useState(false);
  const [savePending, setSavePending] = useState(false);
  const [listModalVisible, setListModalVisible] = useState(false);

  // Owner edit/delete state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState<Spot['category']>('other');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Is the current user the author/owner of this spot?
  const currentUserId = user?.id || user?._id;
  const isOwner = !!currentUserId && !!spot?.userId && spot.userId === currentUserId;

  // Combined photo gallery: user photos first, then Google photos, else header image
  const galleryPhotos = useMemo<SpotPhoto[]>(() => {
    if (!spot) return [];
    const photos: SpotPhoto[] = [...(spot.userPhotos ?? []), ...(spot.googlePhotos ?? [])];
    if (photos.length === 0 && spot.imageURL) {
      photos.push({ url: spot.imageURL });
    }
    return photos;
  }, [spot]);

  // Fetch spot data from backend
  const loadSpot = useCallback(async () => {
    if (!spotId) return;

    try {
      setLoading(true);
      setError(null);
      const data = await getSpotById(spotId);
      if (data) {
        setSpot(data);
      } else {
        setError('Spot not found');
      }
    } catch (_err) {
      setError('Failed to load spot');
    } finally {
      setLoading(false);
    }
  }, [spotId]);

  useEffect(() => {
    loadSpot();
  }, [loadSpot]);

  // Load the current saved state for this spot
  useEffect(() => {
    if (!spotId) return;
    let cancelled = false;
    isSpotSaved(spotId).then((saved) => {
      if (!cancelled) setIsSaved(saved);
    });
    return () => {
      cancelled = true;
    };
  }, [spotId]);

  // One-tap save toggle
  const handleToggleSave = useCallback(async () => {
    if (!spotId || savePending) return;
    setSavePending(true);
    const next = !isSaved;
    // Optimistic update
    setIsSaved(next);
    const ok = next ? await saveSpot(spotId) : await unsaveSpot(spotId);
    if (ok) {
      if (next) Alert.alert('Saved', 'Saved to My Spots');
    } else {
      // Revert on failure
      setIsSaved(!next);
      Alert.alert('Error', next ? 'Failed to save spot' : 'Failed to remove spot');
    }
    setSavePending(false);
  }, [spotId, isSaved, savePending]);

  // Long-press opens the named-list picker
  const handleOpenListPicker = useCallback(() => {
    setListModalVisible(true);
  }, []);

  // Open the inline edit modal, prefilled from the loaded spot
  const handleOpenEdit = useCallback(() => {
    if (!spot) return;
    setEditName(spot.name ?? '');
    setEditDescription(spot.description ?? '');
    setEditCategory(spot.category ?? 'other');
    setEditModalVisible(true);
  }, [spot]);

  // Save inline edits
  const handleSaveEdit = useCallback(async () => {
    if (!spotId || !editName.trim() || savingEdit) return;
    setSavingEdit(true);
    const updated = await updateSpot(spotId, {
      name: editName.trim(),
      description: editDescription.trim(),
      category: editCategory,
    });
    setSavingEdit(false);
    if (updated) {
      setSpot(updated);
      setEditModalVisible(false);
    } else {
      Alert.alert('Error', 'Failed to update spot');
    }
  }, [spotId, editName, editDescription, editCategory, savingEdit]);

  // Delete this spot (owner only), with confirmation
  const handleDelete = useCallback(() => {
    if (!spotId) return;
    Alert.alert(
      'Delete Spot',
      'Are you sure you want to delete this spot? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            const ok = await deleteSpot(spotId);
            setDeleting(false);
            if (ok) {
              router.back();
            } else {
              Alert.alert('Error', 'Failed to delete spot');
            }
          },
        },
      ],
    );
  }, [spotId]);

  // Parse tags into features array
  const getFeatures = (): string[] => {
    if (!spot?.tags) return [];
    // Tags might be comma-separated or already an array
    if (typeof spot.tags === 'string') {
      return spot.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
    }
    return [];
  };

  // Build full address string
  const getFullAddress = (): string => {
    const parts = [];
    if (spot?.city) parts.push(spot.city);
    if (spot?.state) parts.push(spot.state);
    return parts.join(', ') || 'Location not specified';
  };

  const getCategoryIcon = (cat: string): keyof typeof Ionicons.glyphMap => {
    const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
      park: 'leaf',
      street: 'business',
      indoor: 'home',
      diy: 'construct',
    };
    return icons[cat] || 'location';
  };

  const handleGetDirections = () => {
    if (!spot?.latitude || !spot?.longitude) return;
    const url = Platform.select({
      ios: `maps://app?daddr=${spot.latitude},${spot.longitude}`,
      android: `google.navigation:q=${spot.latitude},${spot.longitude}`,
    });
    if (url) Linking.openURL(url);
  };

  const handleShare = () => {
    setShareModalVisible(true);
  };

  // Loading state
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

  // Error or not found state
  if (error || !spot) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
        edges={['top']}
      >
        <View style={styles.loadingContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={theme.textSecondary} />
          <Text style={[styles.errorText, { color: theme.textSecondary }]}>
            {error || 'Spot not found'}
          </Text>
          <Pressable style={styles.goBackButton} onPress={() => router.back()}>
            <Text style={styles.goBackButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const features = getFeatures();
  const fullAddress = getFullAddress();
  const category = spot.category || 'other';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header Image */}
        <View style={styles.imageContainer}>
          {galleryPhotos.length > 0 ? (
            <ExpoImage
              source={{ uri: galleryPhotos[0].url }}
              style={styles.headerImage}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <View style={[styles.imagePlaceholder, { backgroundColor: theme.surface }]}>
              <Ionicons name={getCategoryIcon(category)} size={64} color={theme.textSecondary} />
            </View>
          )}

          {/* Gradient overlay for better button visibility */}
          <View style={styles.imageOverlay} />

          {/* Back button */}
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </Pressable>

          {/* Action buttons */}
          <View style={styles.headerActions}>
            <Pressable style={styles.actionButton} onPress={() => setIsFavorite(!isFavorite)}>
              <Ionicons
                name={isFavorite ? 'heart' : 'heart-outline'}
                size={22}
                color={isFavorite ? '#FF6B6B' : '#FFFFFF'}
              />
            </Pressable>
            <Pressable style={styles.actionButton} onPress={handleShare}>
              <Ionicons name="share-outline" size={22} color="#FFFFFF" />
            </Pressable>
          </View>

          {/* Category badge */}
          <View style={[styles.categoryBadge, { backgroundColor: YELLOW }]}>
            <Ionicons name={getCategoryIcon(category)} size={14} color={DARK} />
            <Text style={styles.categoryText}>
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </Text>
          </View>
        </View>

        {/* Photo Gallery (user + Google photos) */}
        {galleryPhotos.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.gallery}
            contentContainerStyle={styles.galleryContent}
          >
            {galleryPhotos.map((photo, index) => (
              <ExpoImage
                key={photo.key ?? photo.url ?? `photo-${index}`}
                source={{ uri: photo.url }}
                style={styles.galleryThumb}
                contentFit="cover"
                transition={200}
              />
            ))}
          </ScrollView>
        )}

        {/* Content */}
        <View style={styles.content}>
          {/* Owner Actions */}
          {isOwner && (
            <View style={styles.ownerActions}>
              <Pressable
                style={[styles.ownerButton, { backgroundColor: theme.surface }]}
                onPress={handleOpenEdit}
              >
                <Ionicons name="create-outline" size={18} color={theme.text} />
                <Text style={[styles.ownerButtonText, { color: theme.text }]}>Edit</Text>
              </Pressable>
              <Pressable
                style={[styles.ownerButton, { backgroundColor: theme.surface }]}
                onPress={handleDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color="#FF6B6B" />
                ) : (
                  <>
                    <Ionicons name="trash-outline" size={18} color="#FF6B6B" />
                    <Text style={[styles.ownerButtonText, { color: '#FF6B6B' }]}>Delete</Text>
                  </>
                )}
              </Pressable>
            </View>
          )}

          {/* Title & Rating Row */}
          <View style={styles.titleRow}>
            <View style={styles.titleContainer}>
              <Text style={[styles.title, { color: theme.text }]}>{spot.name}</Text>
              <Text style={[styles.address, { color: theme.textSecondary }]}>{fullAddress}</Text>
            </View>
            {spot.rating !== undefined && spot.rating > 0 && (
              <View
                style={[styles.ratingBadge, { backgroundColor: isDark ? '#2a2a2a' : '#f5f5f5' }]}
              >
                <Ionicons name="star" size={18} color={YELLOW} />
                <Text style={[styles.ratingText, { color: theme.text }]}>
                  {spot.rating.toFixed(1)}
                </Text>
              </View>
            )}
          </View>

          {/* Quick Stats */}
          <View style={[styles.statsCard, { backgroundColor: theme.surface }]}>
            {spot.distance !== undefined && (
              <>
                <View style={styles.statItem}>
                  <View
                    style={[
                      styles.statIconContainer,
                      { backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0' },
                    ]}
                  >
                    <Ionicons name="navigate-outline" size={18} color={YELLOW} />
                  </View>
                  <View>
                    <Text style={[styles.statValue, { color: theme.text }]}>
                      {spot.distance.toFixed(1)} mi
                    </Text>
                    <Text style={[styles.statLabel, { color: theme.textSecondary }]}>away</Text>
                  </View>
                </View>
                <View style={styles.statDivider} />
              </>
            )}

            {spot.reviewCount !== undefined && spot.reviewCount > 0 && (
              <>
                <View style={styles.statItem}>
                  <View
                    style={[
                      styles.statIconContainer,
                      { backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0' },
                    ]}
                  >
                    <Ionicons name="chatbubble-outline" size={18} color={YELLOW} />
                  </View>
                  <View>
                    <Text style={[styles.statValue, { color: theme.text }]}>
                      {spot.reviewCount}
                    </Text>
                    <Text style={[styles.statLabel, { color: theme.textSecondary }]}>reviews</Text>
                  </View>
                </View>
                <View style={styles.statDivider} />
              </>
            )}

            {/* Sport Types */}
            {spot.sportTypes && spot.sportTypes.length > 0 && (
              <View style={styles.statItem}>
                <View
                  style={[
                    styles.statIconContainer,
                    { backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0' },
                  ]}
                >
                  <Ionicons name="bicycle-outline" size={18} color={YELLOW} />
                </View>
                <View>
                  <Text style={[styles.statValue, { color: theme.text }]}>
                    {spot.sportTypes.length}
                  </Text>
                  <Text style={[styles.statLabel, { color: theme.textSecondary }]}>sports</Text>
                </View>
              </View>
            )}
          </View>

          {/* About Section */}
          {spot.description && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>About</Text>
              <View style={[styles.card, { backgroundColor: theme.surface }]}>
                <Text style={[styles.description, { color: theme.text }]}>{spot.description}</Text>
              </View>
            </View>
          )}

          {/* Sport Types Section */}
          {spot.sportTypes && spot.sportTypes.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Sports</Text>
              <View style={[styles.card, { backgroundColor: theme.surface }]}>
                <View style={styles.featuresGrid}>
                  {spot.sportTypes.map((sport) => (
                    <View
                      key={sport}
                      style={[
                        styles.featureItem,
                        { backgroundColor: isDark ? '#2a2a2a' : '#f5f5f5' },
                      ]}
                    >
                      <Ionicons name="checkmark-circle" size={16} color={YELLOW} />
                      <Text style={[styles.featureText, { color: theme.text }]}>
                        {sport.charAt(0).toUpperCase() + sport.slice(1)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* Features/Tags Section */}
          {features.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Features</Text>
              <View style={[styles.card, { backgroundColor: theme.surface }]}>
                <View style={styles.featuresGrid}>
                  {features.map((feature) => (
                    <View
                      key={feature}
                      style={[
                        styles.featureItem,
                        { backgroundColor: isDark ? '#2a2a2a' : '#f5f5f5' },
                      ]}
                    >
                      <Ionicons name="checkmark-circle" size={16} color={YELLOW} />
                      <Text style={[styles.featureText, { color: theme.text }]}>{feature}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* Location Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Location</Text>
            <View style={[styles.card, { backgroundColor: theme.surface }]}>
              {/* Interactive Map */}
              {spot.latitude && spot.longitude ? (
                <SpotMap
                  latitude={spot.latitude}
                  longitude={spot.longitude}
                  spotName={spot.name}
                  height={200}
                />
              ) : (
                <View
                  style={[
                    styles.mapPlaceholder,
                    { backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0' },
                  ]}
                >
                  <Ionicons name="map" size={48} color={theme.textSecondary} />
                  <Text style={[styles.mapPlaceholderText, { color: theme.textSecondary }]}>
                    Location not available
                  </Text>
                </View>
              )}

              {/* Address row */}
              <View style={[styles.addressRow, { marginTop: 16 }]}>
                <View
                  style={[styles.addressIcon, { backgroundColor: isDark ? '#2a2a2a' : '#f5f5f5' }]}
                >
                  <Ionicons name="location" size={18} color={YELLOW} />
                </View>
                <View style={styles.addressInfo}>
                  <Text style={[styles.addressText, { color: theme.text }]}>{fullAddress}</Text>
                  {spot.latitude && spot.longitude && (
                    <Text style={[styles.cityText, { color: theme.textSecondary }]}>
                      {spot.latitude.toFixed(4)}, {spot.longitude.toFixed(4)}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          </View>

          {/* Reviews Section */}
          <SpotReviewsList
            spotId={spotId || ''}
            spotName={spot.name}
            spotRating={spot.rating}
            reviewCount={spot.reviewCount}
          />
        </View>
      </ScrollView>

      {/* Bottom Action Bar */}
      <View
        style={[styles.bottomBar, { backgroundColor: theme.surface, borderTopColor: theme.border }]}
      >
        <Pressable
          style={[styles.directionsButton, { backgroundColor: YELLOW }]}
          onPress={handleGetDirections}
        >
          <Ionicons name="navigate" size={20} color={DARK} />
          <Text style={styles.directionsButtonText}>Get Directions</Text>
        </Pressable>

        <Pressable
          style={[
            styles.addButton,
            { borderColor: isSaved ? YELLOW : theme.border },
            isSaved && { backgroundColor: `${YELLOW}20` },
          ]}
          onPress={handleToggleSave}
          onLongPress={handleOpenListPicker}
          delayLongPress={300}
          disabled={savePending}
        >
          <Ionicons
            name={isSaved ? 'bookmark' : 'bookmark-outline'}
            size={22}
            color={isSaved ? YELLOW : theme.text}
          />
        </Pressable>
      </View>

      {/* Share to Homie Modal */}
      {spot && (
        <ShareToHomieModal
          visible={shareModalVisible}
          onClose={() => setShareModalVisible(false)}
          contentType="spot"
          contentId={spot._id}
          preview={{
            title: spot.name,
            subtitle: fullAddress,
            thumbnailUrl: spot.imageURL ?? undefined,
          }}
          onSuccess={(conversationId) => {
            router.push(`/(tabs)/homies/chat/${conversationId}`);
          }}
        />
      )}

      {/* Add to Spot List Modal (long-press on save) */}
      {spot && (
        <AddToSpotListModal
          visible={listModalVisible}
          spotId={spot._id}
          spotName={spot.name}
          onClose={() => setListModalVisible(false)}
          onSuccess={() => {
            // A saved-to-a-list spot also lives in "My Spots"; reflect saved state.
            setIsSaved(true);
          }}
        />
      )}

      {/* Inline Edit Modal (owner only) */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <Pressable style={styles.editOverlay} onPress={() => setEditModalVisible(false)}>
          <Pressable
            style={[styles.editSheet, { backgroundColor: theme.surface }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.editHeader}>
              <Text style={[styles.editTitle, { color: theme.text }]}>Edit Spot</Text>
              <Pressable onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </Pressable>
            </View>

            <Text style={[styles.editLabel, { color: theme.textSecondary }]}>Name</Text>
            <TextInput
              style={[
                styles.editInput,
                { backgroundColor: theme.background, color: theme.text, borderColor: theme.border },
              ]}
              value={editName}
              onChangeText={setEditName}
              placeholder="Spot name"
              placeholderTextColor={theme.textSecondary}
            />

            <Text style={[styles.editLabel, { color: theme.textSecondary }]}>Description</Text>
            <TextInput
              style={[
                styles.editInput,
                styles.editTextarea,
                { backgroundColor: theme.background, color: theme.text, borderColor: theme.border },
              ]}
              value={editDescription}
              onChangeText={setEditDescription}
              placeholder="Describe this spot..."
              placeholderTextColor={theme.textSecondary}
              multiline
            />

            <Text style={[styles.editLabel, { color: theme.textSecondary }]}>Category</Text>
            <View style={styles.editCategoryRow}>
              {SPOT_CATEGORIES.map((cat) => {
                const selected = editCategory === cat.id;
                return (
                  <Pressable
                    key={cat.id}
                    style={[
                      styles.editCategoryChip,
                      { backgroundColor: theme.background, borderColor: theme.border },
                      selected && { backgroundColor: YELLOW, borderColor: YELLOW },
                    ]}
                    onPress={() => setEditCategory(cat.id)}
                  >
                    <Text
                      style={[styles.editCategoryText, { color: selected ? DARK : theme.text }]}
                    >
                      {cat.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              style={[
                styles.editSaveButton,
                { backgroundColor: YELLOW },
                (!editName.trim() || savingEdit) && styles.editSaveButtonDisabled,
              ]}
              onPress={handleSaveEdit}
              disabled={!editName.trim() || savingEdit}
            >
              {savingEdit ? (
                <ActivityIndicator size="small" color={DARK} />
              ) : (
                <Text style={styles.editSaveButtonText}>Save Changes</Text>
              )}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
    paddingBottom: 100, // Space for bottom bar
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
  goBackButton: {
    marginTop: 24,
    backgroundColor: YELLOW,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 25,
  },
  goBackButtonText: {
    color: DARK,
    fontSize: 16,
    fontWeight: '600',
  },

  // Header Image
  imageContainer: {
    position: 'relative',
    height: 280,
  },
  headerImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 100,
    backgroundColor: 'transparent',
    // Gradient effect using multiple views would be better, simplified here
  },
  backButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActions: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryBadge: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '600',
    color: DARK,
  },

  // Photo Gallery
  gallery: {
    marginTop: 12,
  },
  galleryContent: {
    paddingHorizontal: 20,
    gap: 10,
  },
  galleryThumb: {
    width: 110,
    height: 80,
    borderRadius: 12,
  },

  // Content
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  // Owner Actions
  ownerActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  ownerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: 12,
  },
  ownerButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },

  // Edit Modal
  editOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  editSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
  },
  editHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  editTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  editLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 6,
  },
  editInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  editTextarea: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  editCategoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  editCategoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  editCategoryText: {
    fontSize: 14,
    fontWeight: '500',
  },
  editSaveButton: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  editSaveButtonDisabled: {
    opacity: 0.5,
  },
  editSaveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: DARK,
  },

  // Title Row
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  titleContainer: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 4,
  },
  address: {
    fontSize: 14,
    lineHeight: 20,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 4,
  },
  ratingText: {
    fontSize: 18,
    fontWeight: '700',
  },

  // Stats Card
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(128,128,128,0.2)',
  },

  // Sections
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  card: {
    borderRadius: 16,
    padding: 16,
  },
  description: {
    fontSize: 15,
    lineHeight: 24,
  },

  // Features
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
  },
  featureText: {
    fontSize: 14,
    fontWeight: '500',
  },

  // Map
  mapPlaceholder: {
    height: 160,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  mapPlaceholderText: {
    fontSize: 14,
    marginTop: 8,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  addressIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressInfo: {
    flex: 1,
  },
  addressText: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 2,
  },
  cityText: {
    fontSize: 13,
  },

  // Bottom Bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 34, // Safe area for iPhone
    borderTopWidth: 1,
    gap: 12,
  },
  directionsButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 14,
    gap: 8,
  },
  directionsButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: DARK,
  },
  addButton: {
    width: 52,
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
