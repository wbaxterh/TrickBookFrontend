/**
 * SpotReviewsList Component
 * Displays reviews section with rating summary and review list
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, getThemeColors } from '@/constants/colors';
import { useThemeContext } from '@/lib/providers/ThemeProvider';
import { useAuthStore } from '@/lib/stores/authStore';
import {
  SpotReview,
  SpotReviewsResponse,
  getSpotReviews,
  toggleReviewHelpful,
  deleteSpotReview,
} from '@/lib/api/spotReviews';
import { StarRatingInput } from './StarRatingInput';
import { ReviewCard } from './ReviewCard';
import { AddReviewModal } from './AddReviewModal';

interface SpotReviewsListProps {
  spotId: string;
  spotName: string;
  spotRating?: number;
  reviewCount?: number;
}

export function SpotReviewsList({
  spotId,
  spotName,
  spotRating,
  reviewCount = 0,
}: SpotReviewsListProps) {
  const { isDark } = useThemeContext();
  const theme = getThemeColors(isDark);
  const { user, isAuthenticated } = useAuthStore();

  const [reviewsData, setReviewsData] = useState<SpotReviewsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingReview, setEditingReview] = useState<SpotReview | undefined>();

  const fetchReviews = useCallback(async (page: number = 1, append: boolean = false) => {
    try {
      const data = await getSpotReviews(spotId, { page, limit: 20 });
      if (append && reviewsData) {
        setReviewsData({
          ...data,
          reviews: [...reviewsData.reviews, ...data.reviews],
        });
      } else {
        setReviewsData(data);
      }
    } catch (error) {
      console.error('Error fetching reviews:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [spotId, reviewsData]);

  useEffect(() => {
    fetchReviews();
  }, [spotId]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchReviews(1, false);
  }, [fetchReviews]);

  const handleLoadMore = useCallback(() => {
    if (
      loadingMore ||
      !reviewsData ||
      !reviewsData.pagination.hasMore
    ) {
      return;
    }
    setLoadingMore(true);
    fetchReviews(reviewsData.pagination.page + 1, true);
  }, [loadingMore, reviewsData, fetchReviews]);

  const handleAddReview = () => {
    if (!isAuthenticated) {
      Alert.alert(
        'Sign In Required',
        'You need to be signed in to write a review.',
        [{ text: 'OK' }]
      );
      return;
    }
    setEditingReview(undefined);
    setShowAddModal(true);
  };

  const handleEditReview = (review: SpotReview) => {
    setEditingReview(review);
    setShowAddModal(true);
  };

  const handleDeleteReview = async (reviewId: string) => {
    Alert.alert(
      'Delete Review',
      'Are you sure you want to delete this review?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await deleteSpotReview(reviewId);
            if (success) {
              handleRefresh();
            } else {
              Alert.alert('Error', 'Failed to delete review.');
            }
          },
        },
      ]
    );
  };

  const handleHelpful = async (reviewId: string) => {
    const result = await toggleReviewHelpful(reviewId);
    if (result && reviewsData) {
      const updatedReviews = reviewsData.reviews.map((r) =>
        r._id === reviewId ? { ...r, helpfulCount: result.helpfulCount } : r
      );
      setReviewsData({ ...reviewsData, reviews: updatedReviews });
    }
  };

  const handleReviewSubmitted = (review: SpotReview) => {
    handleRefresh();
  };

  const renderRatingSummary = () => {
    const distribution = reviewsData?.ratingDistribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const total = Object.values(distribution).reduce((sum, count) => sum + count, 0);
    const avgRating = spotRating || (reviewsData && reviewsData.reviews.length > 0
      ? reviewsData.reviews.reduce((sum, r) => sum + r.rating, 0) / reviewsData.reviews.length
      : 0);

    return (
      <View style={[styles.summaryCard, { backgroundColor: theme.surface }]}>
        <View style={styles.summaryLeft}>
          <Text style={[styles.avgRating, { color: theme.text }]}>
            {avgRating.toFixed(1)}
          </Text>
          <StarRatingInput rating={avgRating} readonly size={16} />
          <Text style={[styles.totalReviews, { color: theme.textSecondary }]}>
            {total} {total === 1 ? 'review' : 'reviews'}
          </Text>
        </View>
        <View style={styles.summaryRight}>
          {[5, 4, 3, 2, 1].map((star) => {
            const count = distribution[star as keyof typeof distribution] || 0;
            const percentage = total > 0 ? (count / total) * 100 : 0;
            return (
              <View key={star} style={styles.barRow}>
                <Text style={[styles.barLabel, { color: theme.textSecondary }]}>
                  {star}
                </Text>
                <View style={[styles.barBackground, { backgroundColor: theme.surfaceElevated }]}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${percentage}%`, backgroundColor: colors.primary },
                    ]}
                  />
                </View>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  const renderHeader = () => (
    <View>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          Reviews
        </Text>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: colors.primary }]}
          onPress={handleAddReview}
        >
          <Ionicons name="add" size={20} color={colors.primaryText} />
          <Text style={[styles.addButtonText, { color: colors.primaryText }]}>
            Write a Review
          </Text>
        </TouchableOpacity>
      </View>
      {renderRatingSummary()}
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="chatbubble-outline" size={48} color={theme.textTertiary} />
      <Text style={[styles.emptyTitle, { color: theme.text }]}>
        No Reviews Yet
      </Text>
      <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
        Be the first to share your experience at this spot!
      </Text>
    </View>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderHeader()}

      {reviewsData && reviewsData.reviews.length > 0 ? (
        <FlatList
          data={reviewsData.reviews}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <ReviewCard
              review={item}
              onHelpfulPress={handleHelpful}
              currentUserId={user?.id}
              onEditPress={handleEditReview}
              onDeletePress={handleDeleteReview}
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          scrollEnabled={false}
          style={styles.reviewsList}
        />
      ) : (
        renderEmptyState()
      )}

      <AddReviewModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        spotId={spotId}
        spotName={spotName}
        existingReview={editingReview}
        onReviewSubmitted={handleReviewSubmitted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 24,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  summaryCard: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  summaryLeft: {
    alignItems: 'center',
    paddingRight: 20,
    borderRightWidth: 1,
    borderRightColor: 'rgba(128, 128, 128, 0.2)',
    minWidth: 80,
  },
  avgRating: {
    fontSize: 40,
    fontWeight: '700',
    marginBottom: 4,
  },
  totalReviews: {
    fontSize: 12,
    marginTop: 8,
  },
  summaryRight: {
    flex: 1,
    paddingLeft: 20,
    justifyContent: 'center',
    gap: 6,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  barLabel: {
    width: 12,
    fontSize: 12,
    textAlign: 'right',
  },
  barBackground: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  reviewsList: {
    marginTop: 8,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 20,
  },
  loadingFooter: {
    paddingVertical: 20,
  },
});

export default SpotReviewsList;
