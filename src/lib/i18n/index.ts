/**
 * i18n Setup
 * Initializes i18next + react-i18next with all bundled locales.
 *
 * - Device locale is detected via expo-localization on startup
 * - English is the source language and the fallback for missing keys
 * - The user's explicit choice is persisted by `@/lib/stores/languageStore`
 *   (loaded in the root layout, which re-applies it over the device default)
 *
 * NOTE (RTL): Arabic strings render RTL automatically, but the app does NOT
 * flip layout direction (I18nManager.forceRTL) yet — full RTL support is a
 * later phase of the localization work.
 */

import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ar from '@/locales/ar/common.json';
import de from '@/locales/de/common.json';
import en from '@/locales/en/common.json';
import es from '@/locales/es/common.json';
import fr from '@/locales/fr/common.json';
import hi from '@/locales/hi/common.json';
import it from '@/locales/it/common.json';
import ja from '@/locales/ja/common.json';
import ko from '@/locales/ko/common.json';
import ptBR from '@/locales/pt-BR/common.json';
import ru from '@/locales/ru/common.json';
import zhCN from '@/locales/zh-CN/common.json';
import zhTW from '@/locales/zh-TW/common.json';
import { matchSupportedLocale, type SupportedLocale } from './languages';

export const resources = {
  en: { common: en },
  es: { common: es },
  'pt-BR': { common: ptBR },
  fr: { common: fr },
  de: { common: de },
  it: { common: it },
  'zh-CN': { common: zhCN },
  'zh-TW': { common: zhTW },
  ja: { common: ja },
  ko: { common: ko },
  hi: { common: hi },
  ar: { common: ar },
  ru: { common: ru },
} satisfies Record<SupportedLocale, { common: typeof en }>;

/**
 * Resolve the device's preferred locale to a supported one.
 * Walks the user's ordered language list and falls back to English.
 */
export function resolveDeviceLocale(): SupportedLocale {
  for (const deviceLocale of getLocales()) {
    const tag = deviceLocale.languageTag;
    if (!tag) continue;
    const match = matchSupportedLocale(tag);
    if (match) return match;
  }
  return 'en';
}

i18n.use(initReactI18next).init({
  resources,
  lng: resolveDeviceLocale(),
  fallbackLng: 'en',
  defaultNS: 'common',
  ns: ['common'],
  // Locale codes are exact keys of `resources`; don't strip regions (pt-BR etc.)
  load: 'currentOnly',
  interpolation: {
    // React already escapes rendered strings
    escapeValue: false,
  },
  returnNull: false,
});

export default i18n;
