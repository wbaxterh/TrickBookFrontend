/**
 * AddReviewModal Component
 * Modal for creating or editing a spot review
 */

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, getThemeColors } from '@/constants/colors';
import { createSpotReview, type SpotReview, updateSpotReview } from '@/lib/api/spotReviews';
import { useThemeContext } from '@/lib/providers/ThemeProvider';
import { StarRatingInput } from './StarRatingInput';

interface AddReviewModalProps {
  visible: boolean;
  onClose: () => void;
  spotId: string;
  spotName: string;
  existingReview?: SpotReview;
  onReviewSubmitted: (review: SpotReview) => void;
}

const MAX_CONTENT_LENGTH = 1000;

export function AddReviewModal({
  visible,
  onClose,
  spotId,
  spotName,
  existingReview,
  onReviewSubmitted,
}: AddReviewModalProps) {
  const { isDark } = useThemeContext();
  const theme = getThemeColors(isDark);

  const [rating, setRating] = useState(existingReview?.rating || 0);
  const [content, setContent] = useState(existingReview?.content || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = !!existingReview;

  useEffect(() => {
    if (existingReview) {
      setRating(existingReview.rating);
      setContent(existingReview.content || '');
    } else {
      setRating(0);
      setContent('');
    }
  }, [existingReview]);

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert('Rating Required', 'Please select a star rating.');
      return;
    }

    setIsSubmitting(true);

    try {
      let review: SpotReview | null;

      if (isEditing && existingReview) {
        review = await updateSpotReview(existingReview._id, {
          rating,
          content: content.trim(),
        });
      } else {
        review = await createSpotReview({
          spotId,
          rating,
          content: content.trim(),
        });
      }

      if (review) {
        onReviewSubmitted(review);
        onClose();
      } else {
        Alert.alert('Error', 'Failed to submit review. Please try again.');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit review.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (rating !== (existingReview?.rating || 0) || content !== (existingReview?.content || '')) {
      Alert.alert(
        'Discard Changes?',
        'You have unsaved changes. Are you sure you want to discard them?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: onClose },
        ],
      );
    } else {
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.container, { backgroundColor: theme.background }]}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.text }]}>
            {isEditing ? 'Edit Review' : 'Write a Review'}
          </Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          {/* Spot Name */}
          <Text style={[styles.spotName, { color: theme.text }]}>{spotName}</Text>

          {/* Star Rating */}
          <View style={styles.ratingSection}>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Your Rating</Text>
            <StarRatingInput rating={rating} onRatingChange={setRating} size={40} showLabel />
          </View>

          {/* Review Content */}
          <View style={styles.contentSection}>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
              Your Review (optional)
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
              placeholder="Share your experience at this spot..."
              placeholderTextColor={theme.textTertiary}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              value={content}
              onChangeText={setContent}
              maxLength={MAX_CONTENT_LENGTH}
            />
            <Text style={[styles.charCount, { color: theme.textTertiary }]}>
              {content.length}/{MAX_CONTENT_LENGTH}
            </Text>
          </View>
        </ScrollView>

        {/* Submit Button */}
        <View style={[styles.footer, { borderTopColor: theme.border }]}>
          <TouchableOpacity
            style={[
              styles.submitButton,
              { backgroundColor: rating > 0 ? colors.primary : theme.surfaceElevated },
            ]}
            onPress={handleSubmit}
            disabled={isSubmitting || rating === 0}
          >
            {isSubmitting ? (
              <ActivityIndicator color={colors.primaryText} />
            ) : (
              <Text
                style={[
                  styles.submitText,
                  { color: rating > 0 ? colors.primaryText : theme.textTertiary },
                ]}
              >
                {isEditing ? 'Update Review' : 'Submit Review'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
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
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  spotName: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 24,
  },
  ratingSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 12,
  },
  contentSection: {
    marginBottom: 20,
  },
  textInput: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    fontSize: 16,
    minHeight: 150,
  },
  charCount: {
    textAlign: 'right',
    marginTop: 8,
    fontSize: 12,
  },
  footer: {
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
  },
  submitButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitText: {
    fontSize: 17,
    fontWeight: '600',
  },
});

export default AddReviewModal;
