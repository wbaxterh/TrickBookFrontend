/**
 * ReviewCard Component
 * Displays a single spot review with user info, rating, and helpful button
 */

import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, getThemeColors } from '@/constants/colors';
import { useThemeContext } from '@/lib/providers/ThemeProvider';
import { SpotReview } from '@/lib/api/spotReviews';
import { StarRatingInput } from './StarRatingInput';

interface ReviewCardProps {
  review: SpotReview;
  onHelpfulPress?: (reviewId: string) => void;
  isHelpfulLoading?: boolean;
  currentUserId?: string;
  onEditPress?: (review: SpotReview) => void;
  onDeletePress?: (reviewId: string) => void;
}

export function ReviewCard({
  review,
  onHelpfulPress,
  isHelpfulLoading,
  currentUserId,
  onEditPress,
  onDeletePress,
}: ReviewCardProps) {
  const { isDark } = useThemeContext();
  const theme = getThemeColors(isDark);

  const isOwner = currentUserId === review.userId;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return date.toLocaleDateString();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      {/* Header: User info and rating */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          {review.user?.imageUri ? (
            <Image source={{ uri: review.user.imageUri }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: theme.surfaceElevated }]}>
              <Ionicons name="person" size={16} color={theme.textSecondary} />
            </View>
          )}
          <View style={styles.userDetails}>
            <Text style={[styles.userName, { color: theme.text }]}>
              {review.user?.name || 'Anonymous'}
            </Text>
            <Text style={[styles.date, { color: theme.textTertiary }]}>
              {formatDate(review.createdAt)}
            </Text>
          </View>
        </View>
        <StarRatingInput rating={review.rating} readonly size={16} />
      </View>

      {/* Review Content */}
      {review.content ? (
        <Text style={[styles.content, { color: theme.text }]}>
          {review.content}
        </Text>
      ) : null}

      {/* Tags */}
      {review.tags && review.tags.length > 0 && (
        <View style={styles.tagsContainer}>
          {review.tags.map((tag, index) => (
            <View
              key={index}
              style={[styles.tag, { backgroundColor: colors.primary + '20' }]}
            >
              <Text style={[styles.tagText, { color: isDark ? colors.primary : theme.text }]}>
                {tag}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Footer: Helpful and actions */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.helpfulButton}
          onPress={() => onHelpfulPress?.(review._id)}
          disabled={isHelpfulLoading}
        >
          <Ionicons
            name="thumbs-up-outline"
            size={16}
            color={theme.textSecondary}
          />
          <Text style={[styles.helpfulText, { color: theme.textSecondary }]}>
            Helpful ({review.helpfulCount})
          </Text>
        </TouchableOpacity>

        {isOwner && (
          <View style={styles.ownerActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => onEditPress?.(review)}
            >
              <Ionicons name="pencil" size={16} color={theme.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => onDeletePress?.(review._id)}
            >
              <Ionicons name="trash-outline" size={16} color={colors.error} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userDetails: {
    marginLeft: 12,
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
  },
  date: {
    fontSize: 13,
    marginTop: 2,
  },
  content: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  helpfulButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  helpfulText: {
    fontSize: 13,
  },
  ownerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    padding: 4,
  },
});

export default ReviewCard;
