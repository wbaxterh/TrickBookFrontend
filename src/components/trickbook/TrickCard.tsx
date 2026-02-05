/**
 * TrickCard Component
 * Grid card for Trickipedia tricks
 *
 * Shows: thumbnail image, play button, name, difficulty, "Add to List" button
 */

import React from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeContext } from '@/lib/providers/ThemeProvider';
import { Trick, DIFFICULTY_COLORS, TrickDifficulty } from '@/types/trickbook';

interface TrickCardProps {
  trick: Trick;
  onPress?: () => void;
  onAddToList?: () => void;
}

export function TrickCard({ trick, onPress, onAddToList }: TrickCardProps) {
  const { theme, colors } = useThemeContext();

  const thumbnailUri = trick.images?.[0];
  const hasVideo = !!trick.videoUrl;
  const difficultyColor = DIFFICULTY_COLORS[trick.difficulty as TrickDifficulty] || theme.textSecondary;

  return (
    <Pressable
      style={[styles.container, { backgroundColor: theme.surface }]}
      onPress={onPress}
    >
      {/* Thumbnail */}
      <View style={styles.imageContainer}>
        {thumbnailUri ? (
          <Image
            source={{ uri: thumbnailUri }}
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.imagePlaceholder, { backgroundColor: theme.surfaceElevated }]}>
            <Ionicons name="videocam-outline" size={32} color={theme.textSecondary} />
          </View>
        )}

        {/* Play button overlay */}
        {(hasVideo || thumbnailUri) && (
          <View style={styles.playButton}>
            <View style={[styles.playButtonInner, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
              <Ionicons name="play" size={20} color="#FFFFFF" />
            </View>
          </View>
        )}
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
          {trick.name}
        </Text>
        <Text style={[styles.difficulty, { color: difficultyColor }]}>
          {trick.difficulty}
        </Text>

        {/* Add to List Button */}
        <Pressable
          style={[styles.addButton, { backgroundColor: colors.primary }]}
          onPress={(e) => {
            e.stopPropagation();
            onAddToList?.();
          }}
        >
          <Text style={styles.addButtonText}>Add to List</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
    flex: 1,
  },
  imageContainer: {
    position: 'relative',
    aspectRatio: 16 / 9,
    width: '100%',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 12,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  difficulty: {
    fontSize: 13,
    marginBottom: 10,
  },
  addButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '600',
  },
});

export default TrickCard;
