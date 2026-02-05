/**
 * Spot Detail Screen
 * Shows detailed info about a specific spot
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  Dimensions,
  StyleSheet,
  Linking,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeContext } from '@/lib/providers/ThemeProvider';
import { getSpotById, Spot } from '@/lib/api/spots';
import { SpotMap, SpotReviewsList } from '@/components/spots';
import { ShareToHomieModal } from '@/components/share';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const YELLOW = '#FCF150';
const DARK = '#1a1a1a';

export default function SpotDetailScreen() {
  const { spotId } = useLocalSearchParams<{ spotId: string }>();
  const { theme, colors, isDark } = useThemeContext();
  const [isFavorite, setIsFavorite] = useState(false);
  const [spot, setSpot] = useState<Spot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareModalVisible, setShareModalVisible] = useState(false);

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
    } catch (err) {
      console.error('Failed to load spot:', err);
      setError('Failed to load spot');
    } finally {
      setLoading(false);
    }
  }, [spotId]);

  useEffect(() => {
    loadSpot();
  }, [loadSpot]);

  // Parse tags into features array
  const getFeatures = (): string[] => {
    if (!spot?.tags) return [];
    // Tags might be comma-separated or already an array
    if (typeof spot.tags === 'string') {
      return spot.tags.split(',').map(t => t.trim()).filter(Boolean);
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
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={YELLOW} />
        </View>
      </SafeAreaView>
    );
  }

  // Error or not found state
  if (error || !spot) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
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
          {spot.imageURL ? (
            <Image source={{ uri: spot.imageURL }} style={styles.headerImage} resizeMode="cover" />
          ) : (
            <View style={[styles.imagePlaceholder, { backgroundColor: theme.surface }]}>
              <Ionicons name={getCategoryIcon(category)} size={64} color={theme.textSecondary} />
            </View>
          )}

          {/* Gradient overlay for better button visibility */}
          <View style={styles.imageOverlay} />

          {/* Back button */}
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </Pressable>

          {/* Action buttons */}
          <View style={styles.headerActions}>
            <Pressable
              style={styles.actionButton}
              onPress={() => setIsFavorite(!isFavorite)}
            >
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

        {/* Content */}
        <View style={styles.content}>
          {/* Title & Rating Row */}
          <View style={styles.titleRow}>
            <View style={styles.titleContainer}>
              <Text style={[styles.title, { color: theme.text }]}>{spot.name}</Text>
              <Text style={[styles.address, { color: theme.textSecondary }]}>{fullAddress}</Text>
            </View>
            {spot.rating !== undefined && spot.rating > 0 && (
              <View style={[styles.ratingBadge, { backgroundColor: isDark ? '#2a2a2a' : '#f5f5f5' }]}>
                <Ionicons name="star" size={18} color={YELLOW} />
                <Text style={[styles.ratingText, { color: theme.text }]}>{spot.rating.toFixed(1)}</Text>
              </View>
            )}
          </View>

          {/* Quick Stats */}
          <View style={[styles.statsCard, { backgroundColor: theme.surface }]}>
            {spot.distance !== undefined && (
              <>
                <View style={styles.statItem}>
                  <View style={[styles.statIconContainer, { backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0' }]}>
                    <Ionicons name="navigate-outline" size={18} color={YELLOW} />
                  </View>
                  <View>
                    <Text style={[styles.statValue, { color: theme.text }]}>{spot.distance.toFixed(1)} mi</Text>
                    <Text style={[styles.statLabel, { color: theme.textSecondary }]}>away</Text>
                  </View>
                </View>
                <View style={styles.statDivider} />
              </>
            )}

            {spot.reviewCount !== undefined && spot.reviewCount > 0 && (
              <>
                <View style={styles.statItem}>
                  <View style={[styles.statIconContainer, { backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0' }]}>
                    <Ionicons name="chatbubble-outline" size={18} color={YELLOW} />
                  </View>
                  <View>
                    <Text style={[styles.statValue, { color: theme.text }]}>{spot.reviewCount}</Text>
                    <Text style={[styles.statLabel, { color: theme.textSecondary }]}>reviews</Text>
                  </View>
                </View>
                <View style={styles.statDivider} />
              </>
            )}

            {/* Sport Types */}
            {spot.sportTypes && spot.sportTypes.length > 0 && (
              <View style={styles.statItem}>
                <View style={[styles.statIconContainer, { backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0' }]}>
                  <Ionicons name="bicycle-outline" size={18} color={YELLOW} />
                </View>
                <View>
                  <Text style={[styles.statValue, { color: theme.text }]}>{spot.sportTypes.length}</Text>
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
                <View style={[styles.mapPlaceholder, { backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0' }]}>
                  <Ionicons name="map" size={48} color={theme.textSecondary} />
                  <Text style={[styles.mapPlaceholderText, { color: theme.textSecondary }]}>
                    Location not available
                  </Text>
                </View>
              )}

              {/* Address row */}
              <View style={[styles.addressRow, { marginTop: 16 }]}>
                <View style={[styles.addressIcon, { backgroundColor: isDark ? '#2a2a2a' : '#f5f5f5' }]}>
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
      <View style={[styles.bottomBar, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
        <Pressable
          style={[styles.directionsButton, { backgroundColor: YELLOW }]}
          onPress={handleGetDirections}
        >
          <Ionicons name="navigate" size={20} color={DARK} />
          <Text style={styles.directionsButtonText}>Get Directions</Text>
        </Pressable>

        <Pressable
          style={[styles.addButton, { borderColor: theme.border }]}
          onPress={() => {
            // TODO: Add to spotlist
          }}
        >
          <Ionicons name="bookmark-outline" size={22} color={theme.text} />
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
            thumbnailUrl: spot.imageURL,
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

  // Content
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
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
