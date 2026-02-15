/**
 * Edit Post Screen
 * Allows users to edit their post's caption, sport types, tricks, and visibility
 */

import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type FeedPost, getPost, updatePost } from '@/lib/api/feed';
import { SPORT_TYPES, VISIBILITY_OPTIONS } from '@/lib/api/upload';
import { useThemeContext } from '@/lib/providers/ThemeProvider';

const YELLOW = '#FCF150';
const DARK = '#1a1a1a';

export default function EditPostScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const { theme, colors } = useThemeContext();

  const [post, setPost] = useState<FeedPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [caption, setCaption] = useState('');
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [tricks, setTricks] = useState<string[]>([]);
  const [trickInput, setTrickInput] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'homies' | 'private'>('public');

  useEffect(() => {
    const fetchPost = async () => {
      if (!postId) return;

      try {
        const postData = await getPost(postId);
        if (postData) {
          setPost(postData);
          setCaption(postData.caption || '');
          setSelectedSports(postData.sportTypes || []);
          setTricks(postData.tricks || []);
          setVisibility(postData.visibility || 'public');
        }
      } catch (_error) {
        Alert.alert('Error', 'Failed to load post');
      } finally {
        setLoading(false);
      }
    };

    fetchPost();
  }, [postId]);

  const toggleSport = (sportValue: string) => {
    if (selectedSports.includes(sportValue)) {
      setSelectedSports(selectedSports.filter((s) => s !== sportValue));
    } else {
      setSelectedSports([...selectedSports, sportValue]);
    }
  };

  const handleAddTrick = () => {
    const trimmed = trickInput.trim();
    if (trimmed && !tricks.includes(trimmed)) {
      setTricks([...tricks, trimmed]);
      setTrickInput('');
    }
  };

  const handleRemoveTrick = (trick: string) => {
    setTricks(tricks.filter((t) => t !== trick));
  };

  const handleSave = async () => {
    if (!postId) return;

    if (selectedSports.length === 0) {
      Alert.alert('Required', 'Please select at least one sport type');
      return;
    }

    setSaving(true);

    try {
      const updated = await updatePost(postId, {
        caption,
        sportTypes: selectedSports,
        tricks,
        visibility,
      });

      if (updated) {
        Alert.alert('Success', 'Post updated successfully', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        Alert.alert('Error', 'Failed to update post');
      }
    } catch (_error) {
      Alert.alert('Error', 'Failed to update post');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
        edges={['top']}
      >
        <View style={styles.header}>
          <Pressable
            style={[styles.headerButton, { backgroundColor: theme.surface }]}
            onPress={() => router.back()}
          >
            <Ionicons name="close" size={24} color={theme.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Edit Post</Text>
          <View style={styles.headerButton} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={YELLOW} />
        </View>
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.background }]}
        edges={['top']}
      >
        <View style={styles.header}>
          <Pressable
            style={[styles.headerButton, { backgroundColor: theme.surface }]}
            onPress={() => router.back()}
          >
            <Ionicons name="close" size={24} color={theme.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Edit Post</Text>
          <View style={styles.headerButton} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={theme.textSecondary} />
          <Text style={[styles.errorText, { color: theme.text }]}>Post not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const thumbnailUrl = post.thumbnailUrl || post.imageUrls?.[0];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            style={[styles.headerButton, { backgroundColor: theme.surface }]}
            onPress={() => router.back()}
            disabled={saving}
          >
            <Ionicons name="close" size={24} color={theme.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Edit Post</Text>
          <Pressable
            style={[styles.saveButton, { backgroundColor: colors.primary }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={DARK} />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </Pressable>
        </View>

        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Post Preview */}
          <View style={styles.previewContainer}>
            {thumbnailUrl ? (
              <Image
                source={{ uri: thumbnailUrl }}
                style={styles.previewImage}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.previewImage, styles.previewPlaceholder]}>
                <Ionicons name="image" size={32} color={theme.textSecondary} />
              </View>
            )}
            {post.mediaType === 'video' && (
              <View style={styles.videoIndicator}>
                <Ionicons name="play" size={16} color="#fff" />
              </View>
            )}
          </View>

          {/* Caption */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Caption</Text>
            <TextInput
              style={[styles.captionInput, { backgroundColor: theme.surface, color: theme.text }]}
              placeholder="What trick is this? Add some context..."
              placeholderTextColor={theme.textSecondary}
              value={caption}
              onChangeText={setCaption}
              multiline
              maxLength={500}
              editable={!saving}
            />
            <Text style={[styles.charCount, { color: theme.textSecondary }]}>
              {caption.length}/500
            </Text>
          </View>

          {/* Sport Types */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Sport Type <Text style={{ color: '#ef4444' }}>*</Text>
            </Text>
            <View style={styles.chipContainer}>
              {SPORT_TYPES.map((sport) => (
                <Pressable
                  key={sport.value}
                  style={[
                    styles.chip,
                    { backgroundColor: theme.surface },
                    selectedSports.includes(sport.value) && styles.chipSelected,
                  ]}
                  onPress={() => toggleSport(sport.value)}
                  disabled={saving}
                >
                  {selectedSports.includes(sport.value) && (
                    <Ionicons name="checkmark" size={14} color={DARK} style={{ marginRight: 4 }} />
                  )}
                  <Text
                    style={[
                      styles.chipText,
                      { color: theme.text },
                      selectedSports.includes(sport.value) && styles.chipTextSelected,
                    ]}
                  >
                    {sport.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Tag Tricks */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Tag Tricks</Text>
            <View style={styles.trickInputRow}>
              <TextInput
                style={[styles.trickInput, { backgroundColor: theme.surface, color: theme.text }]}
                placeholder="e.g., Kickflip, Backside 360"
                placeholderTextColor={theme.textSecondary}
                value={trickInput}
                onChangeText={setTrickInput}
                onSubmitEditing={handleAddTrick}
                returnKeyType="done"
                editable={!saving}
              />
              <Pressable
                style={[styles.addTrickButton, { backgroundColor: theme.surface }]}
                onPress={handleAddTrick}
                disabled={saving}
              >
                <Ionicons name="add" size={24} color={theme.text} />
              </Pressable>
            </View>
            {tricks.length > 0 && (
              <View style={styles.tricksContainer}>
                {tricks.map((trick) => (
                  <View key={trick} style={styles.trickTag}>
                    <Text style={styles.trickTagText}>{trick}</Text>
                    {!saving && (
                      <Pressable onPress={() => handleRemoveTrick(trick)}>
                        <Ionicons name="close" size={14} color={YELLOW} />
                      </Pressable>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Visibility */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Who can see this?</Text>
            <View style={styles.visibilityContainer}>
              {VISIBILITY_OPTIONS.map((option) => (
                <Pressable
                  key={option.value}
                  style={[
                    styles.visibilityOption,
                    { backgroundColor: theme.surface },
                    visibility === option.value && styles.visibilitySelected,
                  ]}
                  onPress={() => setVisibility(option.value as typeof visibility)}
                  disabled={saving}
                >
                  <Ionicons
                    name={option.icon}
                    size={24}
                    color={visibility === option.value ? YELLOW : theme.textSecondary}
                  />
                  <Text
                    style={[
                      styles.visibilityText,
                      { color: theme.text },
                      visibility === option.value && styles.visibilityTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  saveButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    minWidth: 70,
    alignItems: 'center',
  },
  saveButtonText: {
    color: DARK,
    fontSize: 15,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  previewContainer: {
    width: 120,
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    alignSelf: 'center',
    marginBottom: 24,
  },
  previewImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1a1a1a',
  },
  previewPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 4,
    padding: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  captionInput: {
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  chipSelected: {
    backgroundColor: YELLOW,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  chipTextSelected: {
    color: DARK,
  },
  trickInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  trickInput: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
  },
  addTrickButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tricksContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  trickTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: `${YELLOW}30`,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  trickTagText: {
    color: YELLOW,
    fontSize: 14,
    fontWeight: '500',
  },
  visibilityContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  visibilityOption: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  visibilitySelected: {
    borderWidth: 2,
    borderColor: YELLOW,
    backgroundColor: `${YELLOW}15`,
  },
  visibilityText: {
    fontSize: 13,
    fontWeight: '500',
  },
  visibilityTextSelected: {
    color: YELLOW,
  },
});
