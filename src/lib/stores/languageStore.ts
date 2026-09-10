/**
 * Language Store
 * Zustand store for the user's UI language preference.
 *
 * Persistence mirrors the ThemeProvider pattern: a plain AsyncStorage key,
 * loaded once at startup and written on every explicit change. (The language
 * preference is not sensitive, so authStore's SecureStore is not needed.)
 *
 * Default is 'system': follow the device locale (resolved via
 * expo-localization, falling back to English).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import i18n, { resolveDeviceLocale } from '@/lib/i18n';
import { isSupportedLocale, type LanguagePreference } from '@/lib/i18n/languages';

const LANGUAGE_STORAGE_KEY = '@trickbook_language_preference';

interface LanguageState {
  /** 'system' or an explicit supported locale */
  preference: LanguagePreference;
  /** True once the stored preference has been read (or defaulted) */
  isLoaded: boolean;

  // Actions
  setPreference: (preference: LanguagePreference) => Promise<void>;
  loadStoredPreference: () => Promise<void>;
}

function resolvePreference(preference: LanguagePreference): string {
  return preference === 'system' ? resolveDeviceLocale() : preference;
}

export const useLanguageStore = create<LanguageState>((set) => ({
  preference: 'system',
  isLoaded: false,

  setPreference: async (preference) => {
    set({ preference });

    // Apply immediately — react-i18next re-renders all translated components.
    // NOTE (RTL): switching to/from Arabic does NOT flip the layout direction;
    // full RTL (I18nManager.forceRTL + restart) is a later phase.
    await i18n.changeLanguage(resolvePreference(preference));

    try {
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, preference);
    } catch (_error) {
      // Non-fatal: the choice still applies for this session.
    }
  },

  loadStoredPreference: async () => {
    try {
      const saved = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (saved && (saved === 'system' || isSupportedLocale(saved))) {
        const preference = saved as LanguagePreference;
        set({ preference });

        const target = resolvePreference(preference);
        if (i18n.language !== target) {
          await i18n.changeLanguage(target);
        }
      }
    } catch (_error) {
      // Non-fatal: keep the device-locale default applied at i18n init.
    } finally {
      set({ isLoaded: true });
    }
  },
}));

export default useLanguageStore;
