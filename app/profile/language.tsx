/**
 * Language Settings Screen
 * UI language selection: System default + 13 supported locales
 *
 * - Each language is shown in its own language ("Español", "日本語", …)
 * - Selection applies instantly and is persisted via languageStore
 * - RTL note: Arabic text renders RTL, but full RTL layout is a later phase
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, SettingsDivider } from '@/components/ui';
import { LANGUAGE_OPTIONS, type LanguagePreference } from '@/lib/i18n/languages';
import { useThemeContext } from '@/lib/providers/ThemeProvider';
import { useLanguageStore } from '@/lib/stores/languageStore';

interface LanguageRowProps {
  label: string;
  description: string;
  isSelected: boolean;
  onPress: () => void;
}

function LanguageRow({ label, description, isSelected, onPress }: LanguageRowProps) {
  const { theme, colors } = useThemeContext();

  return (
    <Pressable style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]} onPress={onPress}>
      <View style={styles.rowContent}>
        <View style={styles.rowText}>
          <Text style={[styles.rowLabel, { color: isSelected ? colors.primary : theme.text }]}>
            {label}
          </Text>
          <Text style={[styles.rowDescription, { color: theme.textSecondary }]}>{description}</Text>
        </View>
        {isSelected && <Ionicons name="checkmark-circle" size={22} color={colors.primary} />}
      </View>
    </Pressable>
  );
}

export default function LanguageScreen() {
  const { theme, colors } = useThemeContext();
  const { t } = useTranslation();
  const { preference, setPreference } = useLanguageStore();

  const handleSelect = (next: LanguagePreference) => {
    setPreference(next);
  };

  const currentLabel =
    preference === 'system'
      ? t('language.systemDefault')
      : (LANGUAGE_OPTIONS.find((option) => option.code === preference)?.nativeName ?? preference);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>{t('language.title')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Current Language Display */}
        <View style={styles.currentSection}>
          <View style={[styles.currentBadge, { backgroundColor: `${colors.primary}20` }]}>
            <Ionicons name="language" size={32} color={colors.primary} />
          </View>
          <Text style={[styles.currentLabel, { color: theme.textSecondary }]}>
            {t('language.current')}
          </Text>
          <Text style={[styles.currentValue, { color: theme.text }]}>{currentLabel}</Text>
        </View>

        {/* Info Card */}
        <View style={styles.cardWrapper}>
          <Card padding="lg">
            <View style={styles.infoContent}>
              <Ionicons name="information-circle-outline" size={24} color={theme.textSecondary} />
              <Text style={[styles.infoText, { color: theme.textSecondary }]}>
                {t('language.info')}
              </Text>
            </View>
          </Card>
        </View>

        {/* System Default */}
        <LanguageRow
          label={t('language.systemDefault')}
          description={t('language.systemDefaultDescription')}
          isSelected={preference === 'system'}
          onPress={() => handleSelect('system')}
        />
        <SettingsDivider />

        {/* Languages — each shown in its own language (autonym) */}
        {LANGUAGE_OPTIONS.map((option, index) => (
          <View key={option.code}>
            <LanguageRow
              label={option.nativeName}
              description={option.englishName}
              isSelected={preference === option.code}
              onPress={() => handleSelect(option.code)}
            />
            {index < LANGUAGE_OPTIONS.length - 1 && <SettingsDivider />}
          </View>
        ))}
      </ScrollView>
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
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  currentSection: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  currentBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  currentLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  currentValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  cardWrapper: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  infoContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  row: {
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  rowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowText: {
    flex: 1,
    marginRight: 12,
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  rowDescription: {
    fontSize: 13,
    marginTop: 2,
  },
});
