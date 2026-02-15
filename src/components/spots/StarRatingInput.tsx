/**
 * StarRatingInput Component
 * Interactive star rating selector and display
 */

import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, getThemeColors } from '@/constants/colors';
import { useThemeContext } from '@/lib/providers/ThemeProvider';

interface StarRatingInputProps {
  rating: number;
  onRatingChange?: (rating: number) => void;
  size?: number;
  readonly?: boolean;
  showLabel?: boolean;
}

export function StarRatingInput({
  rating,
  onRatingChange,
  size = 24,
  readonly = false,
  showLabel = false,
}: StarRatingInputProps) {
  const { isDark } = useThemeContext();
  const theme = getThemeColors(isDark);

  const handlePress = (star: number) => {
    if (!readonly && onRatingChange) {
      onRatingChange(star);
    }
  };

  const renderStar = (star: number) => {
    const filled = star <= rating;
    const halfFilled = !filled && star - 0.5 <= rating;

    return (
      <TouchableOpacity
        key={star}
        onPress={() => handlePress(star)}
        disabled={readonly}
        style={styles.star}
        activeOpacity={readonly ? 1 : 0.7}
      >
        <Ionicons
          name={filled ? 'star' : halfFilled ? 'star-half' : 'star-outline'}
          size={size}
          color={filled || halfFilled ? colors.primary : theme.textTertiary}
        />
      </TouchableOpacity>
    );
  };

  const getRatingLabel = () => {
    if (rating === 0) return 'Tap to rate';
    if (rating === 1) return 'Poor';
    if (rating === 2) return 'Fair';
    if (rating === 3) return 'Good';
    if (rating === 4) return 'Great';
    if (rating === 5) return 'Excellent';
    return '';
  };

  return (
    <View style={styles.container}>
      <View style={styles.starsContainer}>{[1, 2, 3, 4, 5].map(renderStar)}</View>
      {showLabel && (
        <Text style={[styles.label, { color: theme.textSecondary }]}>{getRatingLabel()}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  star: {
    padding: 2,
  },
  label: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '500',
  },
});

export default StarRatingInput;
