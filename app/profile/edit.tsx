/**
 * Edit Profile Screen
 * Full profile editor matching website settings
 *
 * Sections:
 * - Profile Picture (upload or icon)
 * - Basic Info (name, email, nickname, rider style, motto)
 * - Sports (multi-select)
 * - Rider Details (fun optional fields)
 */

import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { Avatar, Button } from '@/components/ui';
import { useThemeContext } from '@/lib/providers/ThemeProvider';
import { useAuthStore } from '@/lib/stores/authStore';

// Sport categories matching website
const SPORT_CATEGORIES = [
  { id: 'skateboarding', name: 'Skateboarding', emoji: '🛹' },
  { id: 'snowboarding', name: 'Snowboarding', emoji: '🏂' },
  { id: 'skiing', name: 'Skiing', emoji: '⛷️' },
  { id: 'bmx', name: 'BMX', emoji: '🚴' },
  { id: 'mtb', name: 'Mountain Biking', emoji: '🚵' },
  { id: 'scooter', name: 'Scooter', emoji: '🛴' },
  { id: 'surfing', name: 'Surfing', emoji: '🏄' },
  { id: 'wakeboarding', name: 'Wakeboarding', emoji: '🌊' },
  { id: 'rollerblading', name: 'Rollerblading', emoji: '🛼' },
];

// Avatar icons matching website
const DEFAULT_AVATARS = [
  { id: 'skater1', emoji: '🛹', bg: '#EAB308' }, // yellow-500
  { id: 'snowboarder', emoji: '🏂', bg: '#3B82F6' }, // blue-500
  { id: 'fire', emoji: '🔥', bg: '#F97316' }, // orange-500
  { id: 'lightning', emoji: '⚡', bg: '#A855F7' }, // purple-500
  { id: 'skull', emoji: '💀', bg: '#374151' }, // gray-700
  { id: 'alien', emoji: '👽', bg: '#22C55E' }, // green-500
  { id: 'robot', emoji: '🤖', bg: '#06B6D4' }, // cyan-500
  { id: 'devil', emoji: '😈', bg: '#EF4444' }, // red-500
  { id: 'cool', emoji: '😎', bg: '#6366F1' }, // indigo-500
  { id: 'crown', emoji: '👑', bg: '#F59E0B' }, // amber-500
  { id: 'rocket', emoji: '🚀', bg: '#EC4899' }, // pink-500
  { id: 'ghost', emoji: '👻', bg: '#64748B' }, // slate-500
];

// Rider styles matching website
const RIDER_STYLES = [
  'Freestyle',
  'Street',
  'Vert',
  'Park',
  'Downhill',
  'Flatground',
  'Technical',
  'Flow',
  'All-Mountain',
  'Backcountry',
];

interface RiderProfile {
  nickname?: string;
  age?: string;
  nationality?: string;
  riderStyle?: string;
  motto?: string;
  sickestTrick?: string;
  alternateSport?: string;
  greatestStrength?: string;
  greatestWeakness?: string;
  dreamDate?: string;
  favoriteMovie?: string;
  favoriteMusic?: string;
  favoriteReading?: string;
  favoriteCourse?: string;
  otherHobbies?: string;
  avatarType?: 'icon' | 'upload';
  avatarIcon?: { id: string; emoji: string; bg: string } | null;
}

export default function EditProfileScreen() {
  const { theme, colors } = useThemeContext();
  const { user, updateUser } = useAuthStore();

  // Basic info
  const [name, setName] = useState(user?.name || '');
  const [selectedSports, setSelectedSports] = useState<string[]>(user?.sports || []);
  const [imageUri, setImageUri] = useState(user?.imageUri || '');

  // Rider profile
  const [riderProfile, setRiderProfile] = useState<RiderProfile>({
    nickname: user?.riderProfile?.nickname || '',
    age: user?.riderProfile?.age || '',
    nationality: user?.riderProfile?.nationality || '',
    riderStyle: user?.riderProfile?.riderStyle || '',
    motto: user?.riderProfile?.motto || '',
    sickestTrick: user?.riderProfile?.sickestTrick || '',
    alternateSport: user?.riderProfile?.alternateSport || '',
    greatestStrength: user?.riderProfile?.greatestStrength || '',
    greatestWeakness: user?.riderProfile?.greatestWeakness || '',
    dreamDate: user?.riderProfile?.dreamDate || '',
    favoriteMovie: user?.riderProfile?.favoriteMovie || '',
    favoriteMusic: user?.riderProfile?.favoriteMusic || '',
    favoriteReading: user?.riderProfile?.favoriteReading || '',
    favoriteCourse: user?.riderProfile?.favoriteCourse || '',
    otherHobbies: user?.riderProfile?.otherHobbies || '',
    avatarType: user?.riderProfile?.avatarType || 'icon',
    avatarIcon: user?.riderProfile?.avatarIcon || DEFAULT_AVATARS[0],
  });

  const [isLoading, setIsLoading] = useState(false);
  const [showStylePicker, setShowStylePicker] = useState(false);

  const updateRiderField = (field: keyof RiderProfile, value: string) => {
    setRiderProfile((prev) => ({ ...prev, [field]: value }));
  };

  const toggleSport = (sportId: string) => {
    setSelectedSports((prev) =>
      prev.includes(sportId) ? prev.filter((id) => id !== sportId) : [...prev, sportId],
    );
  };

  const handleSelectIcon = (icon: (typeof DEFAULT_AVATARS)[0]) => {
    setRiderProfile((prev) => ({
      ...prev,
      avatarType: 'icon',
      avatarIcon: icon,
    }));
    setImageUri('');
  };

  const handlePickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Please allow access to your photos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setRiderProfile((prev) => ({
        ...prev,
        avatarType: 'upload',
        avatarIcon: null,
      }));
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }

    if (selectedSports.length === 0) {
      Alert.alert('Error', 'Please select at least one sport');
      return;
    }

    setIsLoading(true);
    try {
      // TODO: API call to update profile with image upload
      updateUser({
        name: name.trim(),
        sports: selectedSports,
        imageUri: imageUri,
        riderProfile: riderProfile,
      });

      Alert.alert('Success', 'Profile updated!', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  // Get current avatar display
  const currentAvatar =
    riderProfile.avatarType === 'upload' && imageUri
      ? { imageUri }
      : riderProfile.avatarIcon
        ? { emoji: riderProfile.avatarIcon.emoji, backgroundColor: riderProfile.avatarIcon.bg }
        : { emoji: '🛹' };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={[styles.closeButton, { backgroundColor: theme.surface }]}
          onPress={() => router.back()}
          hitSlop={8}
        >
          <Ionicons name="close" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Edit Profile</Text>
        <Pressable
          style={[
            styles.saveButton,
            { backgroundColor: colors.primary, opacity: isLoading ? 0.7 : 1 },
          ]}
          onPress={handleSave}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Profile Picture Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Profile Picture</Text>
            <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
              Upload a photo or choose an icon
            </Text>

            <View style={styles.avatarSection}>
              <Avatar
                size="xl"
                imageUri={currentAvatar.imageUri}
                emoji={currentAvatar.emoji}
                backgroundColor={currentAvatar.backgroundColor}
              />

              <View style={styles.avatarActions}>
                <Pressable
                  style={[styles.uploadButton, { backgroundColor: theme.surface }]}
                  onPress={handlePickImage}
                >
                  <Ionicons name="camera-outline" size={18} color={theme.text} />
                  <Text style={[styles.uploadButtonText, { color: theme.text }]}>Upload Photo</Text>
                </Pressable>

                <View style={styles.iconGrid}>
                  {DEFAULT_AVATARS.map((avatar) => (
                    <Pressable
                      key={avatar.id}
                      style={[
                        styles.iconOption,
                        { backgroundColor: avatar.bg },
                        riderProfile.avatarIcon?.id === avatar.id &&
                          riderProfile.avatarType === 'icon' && {
                            borderWidth: 2,
                            borderColor: colors.primary,
                          },
                      ]}
                      onPress={() => handleSelectIcon(avatar)}
                    >
                      <Text style={styles.iconEmoji}>{avatar.emoji}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
          </View>

          {/* Basic Info Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Basic Info</Text>

            {/* Name */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Name</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.surface,
                    color: theme.text,
                    borderColor: theme.border,
                  },
                ]}
                placeholder="Your name"
                placeholderTextColor={theme.textSecondary}
                value={name}
                onChangeText={setName}
              />
            </View>

            {/* Email (read-only) */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Email</Text>
              <View
                style={[
                  styles.input,
                  styles.inputDisabled,
                  {
                    backgroundColor: theme.surfaceElevated,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Text style={{ color: theme.textSecondary }}>
                  {user?.email || 'email@example.com'}
                </Text>
              </View>
              <Text style={[styles.hint, { color: theme.textSecondary }]}>
                Email cannot be changed
              </Text>
            </View>

            {/* Nickname & Rider Style row */}
            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.flex1]}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Nickname</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.surface,
                      color: theme.text,
                      borderColor: theme.border,
                    },
                  ]}
                  placeholder='"The Kid"'
                  placeholderTextColor={theme.textSecondary}
                  value={riderProfile.nickname}
                  onChangeText={(v) => updateRiderField('nickname', v)}
                />
              </View>

              <View style={[styles.inputGroup, styles.flex1]}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Rider Style</Text>
                <Pressable
                  style={[
                    styles.input,
                    styles.selectInput,
                    {
                      backgroundColor: theme.surface,
                      borderColor: theme.border,
                    },
                  ]}
                  onPress={() => setShowStylePicker(!showStylePicker)}
                >
                  <Text
                    style={{
                      color: riderProfile.riderStyle ? theme.text : theme.textSecondary,
                    }}
                  >
                    {riderProfile.riderStyle || 'Select style...'}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color={theme.textSecondary} />
                </Pressable>
              </View>
            </View>

            {/* Style Picker Dropdown */}
            {showStylePicker && (
              <View
                style={[
                  styles.pickerDropdown,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
              >
                {RIDER_STYLES.map((style) => (
                  <Pressable
                    key={style}
                    style={[
                      styles.pickerOption,
                      riderProfile.riderStyle === style && {
                        backgroundColor: `${colors.primary}20`,
                      },
                    ]}
                    onPress={() => {
                      updateRiderField('riderStyle', style);
                      setShowStylePicker(false);
                    }}
                  >
                    <Text
                      style={{
                        color: riderProfile.riderStyle === style ? colors.primary : theme.text,
                      }}
                    >
                      {style}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            {/* Motto */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Motto</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.surface,
                    color: theme.text,
                    borderColor: theme.border,
                  },
                ]}
                placeholder='"Try anything once"'
                placeholderTextColor={theme.textSecondary}
                value={riderProfile.motto}
                onChangeText={(v) => updateRiderField('motto', v)}
              />
            </View>
          </View>

          {/* Sports Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Sports</Text>
            <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
              Select all the sports you ride
            </Text>

            <View style={styles.sportsGrid}>
              {SPORT_CATEGORIES.map((sport) => {
                const isSelected = selectedSports.includes(sport.id);
                return (
                  <Pressable
                    key={sport.id}
                    style={[
                      styles.sportOption,
                      {
                        backgroundColor: isSelected ? `${colors.primary}20` : theme.surface,
                        borderColor: isSelected ? colors.primary : theme.border,
                      },
                    ]}
                    onPress={() => toggleSport(sport.id)}
                  >
                    <Text style={styles.sportEmoji}>{sport.emoji}</Text>
                    <Text
                      style={[
                        styles.sportName,
                        { color: isSelected ? colors.primary : theme.text },
                      ]}
                    >
                      {sport.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Rider Details Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Rider Details</Text>
            <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
              Optional fun stuff for your profile
            </Text>

            {/* Age & Nationality */}
            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.flex1]}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Age</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.surface,
                      color: theme.text,
                      borderColor: theme.border,
                    },
                  ]}
                  placeholder="25"
                  placeholderTextColor={theme.textSecondary}
                  value={riderProfile.age}
                  onChangeText={(v) => updateRiderField('age', v)}
                  keyboardType="number-pad"
                />
              </View>

              <View style={[styles.inputGroup, styles.flex1]}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Nationality</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.surface,
                      color: theme.text,
                      borderColor: theme.border,
                    },
                  ]}
                  placeholder="USA"
                  placeholderTextColor={theme.textSecondary}
                  value={riderProfile.nationality}
                  onChangeText={(v) => updateRiderField('nationality', v)}
                />
              </View>
            </View>

            {/* Sickest Trick & Alternate Sport */}
            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.flex1]}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Sickest Trick</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.surface,
                      color: theme.text,
                      borderColor: theme.border,
                    },
                  ]}
                  placeholder="360 flip"
                  placeholderTextColor={theme.textSecondary}
                  value={riderProfile.sickestTrick}
                  onChangeText={(v) => updateRiderField('sickestTrick', v)}
                />
              </View>

              <View style={[styles.inputGroup, styles.flex1]}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Alternate Sport</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.surface,
                      color: theme.text,
                      borderColor: theme.border,
                    },
                  ]}
                  placeholder="Basketball"
                  placeholderTextColor={theme.textSecondary}
                  value={riderProfile.alternateSport}
                  onChangeText={(v) => updateRiderField('alternateSport', v)}
                />
              </View>
            </View>

            {/* Greatest Strength & Weakness */}
            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.flex1]}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>
                  Greatest Strength
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.surface,
                      color: theme.text,
                      borderColor: theme.border,
                    },
                  ]}
                  placeholder="Consistency"
                  placeholderTextColor={theme.textSecondary}
                  value={riderProfile.greatestStrength}
                  onChangeText={(v) => updateRiderField('greatestStrength', v)}
                />
              </View>

              <View style={[styles.inputGroup, styles.flex1]}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>
                  Greatest Weakness
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.surface,
                      color: theme.text,
                      borderColor: theme.border,
                    },
                  ]}
                  placeholder="Rails"
                  placeholderTextColor={theme.textSecondary}
                  value={riderProfile.greatestWeakness}
                  onChangeText={(v) => updateRiderField('greatestWeakness', v)}
                />
              </View>
            </View>

            {/* Dream Date & Favorite Movie */}
            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.flex1]}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Dream Date</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.surface,
                      color: theme.text,
                      borderColor: theme.border,
                    },
                  ]}
                  placeholder="Emma Watson"
                  placeholderTextColor={theme.textSecondary}
                  value={riderProfile.dreamDate}
                  onChangeText={(v) => updateRiderField('dreamDate', v)}
                />
              </View>

              <View style={[styles.inputGroup, styles.flex1]}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Favorite Movie</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.surface,
                      color: theme.text,
                      borderColor: theme.border,
                    },
                  ]}
                  placeholder="Donnie Darko"
                  placeholderTextColor={theme.textSecondary}
                  value={riderProfile.favoriteMovie}
                  onChangeText={(v) => updateRiderField('favoriteMovie', v)}
                />
              </View>
            </View>

            {/* Favorite Music & Reading */}
            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.flex1]}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Favorite Music</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.surface,
                      color: theme.text,
                      borderColor: theme.border,
                    },
                  ]}
                  placeholder="Indie rock"
                  placeholderTextColor={theme.textSecondary}
                  value={riderProfile.favoriteMusic}
                  onChangeText={(v) => updateRiderField('favoriteMusic', v)}
                />
              </View>

              <View style={[styles.inputGroup, styles.flex1]}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Favorite Reading</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.surface,
                      color: theme.text,
                      borderColor: theme.border,
                    },
                  ]}
                  placeholder="Harry Potter"
                  placeholderTextColor={theme.textSecondary}
                  value={riderProfile.favoriteReading}
                  onChangeText={(v) => updateRiderField('favoriteReading', v)}
                />
              </View>
            </View>

            {/* Favorite Spot & Other Hobbies */}
            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.flex1]}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Favorite Spot</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.surface,
                      color: theme.text,
                      borderColor: theme.border,
                    },
                  ]}
                  placeholder="My backyard"
                  placeholderTextColor={theme.textSecondary}
                  value={riderProfile.favoriteCourse}
                  onChangeText={(v) => updateRiderField('favoriteCourse', v)}
                />
              </View>

              <View style={[styles.inputGroup, styles.flex1]}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Other Hobbies</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.surface,
                      color: theme.text,
                      borderColor: theme.border,
                    },
                  ]}
                  placeholder="Writing"
                  placeholderTextColor={theme.textSecondary}
                  value={riderProfile.otherHobbies}
                  onChangeText={(v) => updateRiderField('otherHobbies', v)}
                />
              </View>
            </View>
          </View>

          {/* Bottom Save Button */}
          <View style={styles.bottomButton}>
            <Button
              variant="primary"
              fullWidth
              icon="save-outline"
              onPress={handleSave}
              disabled={isLoading}
            >
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </View>
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
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveButtonText: {
    color: '#000',
    fontWeight: '600',
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  avatarSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 20,
  },
  avatarActions: {
    flex: 1,
    gap: 12,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  uploadButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  iconOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconEmoji: {
    fontSize: 18,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    height: 52,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
    justifyContent: 'center',
  },
  inputDisabled: {
    opacity: 0.6,
  },
  selectInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hint: {
    fontSize: 12,
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  flex1: {
    flex: 1,
  },
  pickerDropdown: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    overflow: 'hidden',
  },
  pickerOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sportsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sportOption: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    minWidth: 100,
  },
  sportEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  sportName: {
    fontSize: 12,
    fontWeight: '500',
  },
  bottomButton: {
    paddingHorizontal: 20,
    paddingTop: 32,
  },
});
