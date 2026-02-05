/**
 * Register Screen
 * New account creation with profile setup
 */

import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Link, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemeContext } from '@/lib/providers/ThemeProvider';
import { useAuthStore } from '@/lib/stores/authStore';
import { Button, IconButton, Card } from '@/components/ui';

const SPORTS = [
  { id: 'skateboard', emoji: '🛹', label: 'Skateboard' },
  { id: 'snowboard', emoji: '🏂', label: 'Snowboard' },
  { id: 'bmx', emoji: '🚲', label: 'BMX' },
  { id: 'scooter', emoji: '🛴', label: 'Scooter' },
  { id: 'rollerblade', emoji: '⛸️', label: 'Rollerblade' },
  { id: 'surfing', emoji: '🏄', label: 'Surfing' },
];

export default function RegisterScreen() {
  const { theme, colors } = useThemeContext();
  const { register, isLoading: authLoading } = useAuthStore();
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [localLoading, setLocalLoading] = useState(false);

  const isLoading = authLoading || localLoading;

  const toggleSport = (sportId: string) => {
    setSelectedSports((prev) =>
      prev.includes(sportId)
        ? prev.filter((id) => id !== sportId)
        : [...prev, sportId]
    );
  };

  const handleNext = () => {
    if (step === 1) {
      if (!name.trim()) {
        Alert.alert('Error', 'Please enter your name');
        return;
      }
      if (!email.trim()) {
        Alert.alert('Error', 'Please enter your email');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!password) {
        Alert.alert('Error', 'Please enter a password');
        return;
      }
      if (password !== confirmPassword) {
        Alert.alert('Error', 'Passwords do not match');
        return;
      }
      if (password.length < 5) {
        Alert.alert('Error', 'Password must be at least 5 characters');
        return;
      }
      setStep(3);
    }
  };

  const handleRegister = async () => {
    if (selectedSports.length === 0) {
      Alert.alert('Error', 'Please select at least one sport');
      return;
    }

    setLocalLoading(true);
    try {
      await register({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        sports: selectedSports,
      });
      // AuthGate will handle navigation when isAuthenticated changes
    } catch (error: any) {
      Alert.alert('Registration Failed', error.message || 'Failed to create account');
    } finally {
      setLocalLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <>
            <View style={styles.header}>
              <Text style={[styles.title, { color: theme.text }]}>
                Create account
              </Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                Let's get you started with TrickBook
              </Text>
            </View>

            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>
                  Name
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
                  placeholder="What should we call you?"
                  placeholderTextColor={theme.textTertiary}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  editable={!isLoading}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>
                  Email
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
                  placeholder="Enter your email"
                  placeholderTextColor={theme.textTertiary}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                />
              </View>
            </View>
          </>
        );

      case 2:
        return (
          <>
            <View style={styles.header}>
              <Text style={[styles.title, { color: theme.text }]}>
                Set password
              </Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                Make it secure, at least 5 characters
              </Text>
            </View>

            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>
                  Password
                </Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={[
                      styles.input,
                      styles.passwordInput,
                      {
                        backgroundColor: theme.surface,
                        color: theme.text,
                        borderColor: theme.border,
                      },
                    ]}
                    placeholder="Enter password"
                    placeholderTextColor={theme.textTertiary}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    editable={!isLoading}
                  />
                  <Pressable
                    style={styles.passwordToggle}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off' : 'eye'}
                      size={24}
                      color={theme.textSecondary}
                    />
                  </Pressable>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>
                  Confirm Password
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
                  placeholder="Confirm password"
                  placeholderTextColor={theme.textTertiary}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPassword}
                  editable={!isLoading}
                />
              </View>
            </View>
          </>
        );

      case 3:
        return (
          <>
            <View style={styles.header}>
              <Text style={[styles.title, { color: theme.text }]}>
                Pick your sports
              </Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                Select all that apply
              </Text>
            </View>

            <View style={styles.sportsGrid}>
              {SPORTS.map((sport) => {
                const isSelected = selectedSports.includes(sport.id);
                return (
                  <Pressable
                    key={sport.id}
                    style={[
                      styles.sportCard,
                      {
                        backgroundColor: isSelected
                          ? colors.primary + '20'
                          : theme.surface,
                        borderColor: isSelected ? colors.primary : theme.border,
                      },
                    ]}
                    onPress={() => toggleSport(sport.id)}
                    disabled={isLoading}
                  >
                    <Text style={styles.sportEmoji}>{sport.emoji}</Text>
                    <Text
                      style={[
                        styles.sportLabel,
                        { color: isSelected ? colors.primary : theme.text },
                      ]}
                    >
                      {sport.label}
                    </Text>
                    {isSelected && (
                      <View style={[styles.checkmark, { backgroundColor: colors.primary }]}>
                        <Ionicons name="checkmark" size={12} color="#000000" />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
      edges={['top', 'bottom']}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back Button */}
          <IconButton
            icon="arrow-back"
            variant="secondary"
            onPress={() => (step > 1 ? setStep(step - 1) : router.back())}
            style={styles.backButton}
          />

          {/* Progress Indicator */}
          <View style={styles.progressContainer}>
            {[1, 2, 3].map((s) => (
              <View
                key={s}
                style={[
                  styles.progressBar,
                  {
                    backgroundColor: s <= step ? colors.primary : theme.border,
                  },
                ]}
              />
            ))}
          </View>

          {/* Step Content */}
          {renderStepContent()}

          {/* Continue/Submit Button */}
          <View style={styles.buttonContainer}>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              loading={isLoading}
              onPress={step < 3 ? handleNext : handleRegister}
              disabled={isLoading}
            >
              {step < 3 ? 'Continue' : 'Create Account'}
            </Button>
          </View>

          {/* Sign In Link */}
          {step === 1 && (
            <View style={styles.signInContainer}>
              <Text style={[styles.signInText, { color: theme.textSecondary }]}>
                Already have an account?{' '}
              </Text>
              <Link href="/(auth)/login" asChild>
                <Pressable>
                  <Text style={[styles.signInLink, { color: colors.primary }]}>
                    Sign in
                  </Text>
                </Pressable>
              </Link>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
  },
  backButton: {
    marginBottom: 16,
  },
  progressContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 32,
  },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
  form: {
    marginBottom: 24,
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
    height: 56,
    paddingHorizontal: 16,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
  },
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 50,
  },
  passwordToggle: {
    position: 'absolute',
    right: 16,
    top: 16,
  },
  sportsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  sportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    position: 'relative',
  },
  sportEmoji: {
    fontSize: 20,
    marginRight: 8,
  },
  sportLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  checkmark: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonContainer: {
    marginTop: 8,
  },
  signInContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
  },
  signInText: {
    fontSize: 14,
  },
  signInLink: {
    fontSize: 14,
    fontWeight: '600',
  },
});
