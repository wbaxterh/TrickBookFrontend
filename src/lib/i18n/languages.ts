/**
 * Supported UI Languages
 * Single source of truth for the app's launch locales.
 *
 * Adding a locale = add its code here, add its option below, and create
 * `src/locales/<code>/common.json` (then register it in `@/lib/i18n`).
 */

export const SUPPORTED_LOCALES = [
  'en',
  'es',
  'pt-BR',
  'fr',
  'de',
  'it',
  'zh-CN',
  'zh-TW',
  'ja',
  'ko',
  'hi',
  'ar',
  'ru',
] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/** 'system' = follow the device locale (resolved at runtime, falls back to en) */
export type LanguagePreference = SupportedLocale | 'system';

export interface LanguageOption {
  code: SupportedLocale;
  /** Autonym — always displayed in its own language, never translated */
  nativeName: string;
  /** English reference name (shown as a secondary label) */
  englishName: string;
  /** Right-to-left script. Full RTL layout support is a later phase. */
  isRTL: boolean;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'en', nativeName: 'English', englishName: 'English', isRTL: false },
  { code: 'es', nativeName: 'Español', englishName: 'Spanish', isRTL: false },
  {
    code: 'pt-BR',
    nativeName: 'Português (Brasil)',
    englishName: 'Portuguese (Brazil)',
    isRTL: false,
  },
  { code: 'fr', nativeName: 'Français', englishName: 'French', isRTL: false },
  { code: 'de', nativeName: 'Deutsch', englishName: 'German', isRTL: false },
  { code: 'it', nativeName: 'Italiano', englishName: 'Italian', isRTL: false },
  { code: 'zh-CN', nativeName: '简体中文', englishName: 'Chinese (Simplified)', isRTL: false },
  { code: 'zh-TW', nativeName: '繁體中文', englishName: 'Chinese (Traditional)', isRTL: false },
  { code: 'ja', nativeName: '日本語', englishName: 'Japanese', isRTL: false },
  { code: 'ko', nativeName: '한국어', englishName: 'Korean', isRTL: false },
  { code: 'hi', nativeName: 'हिन्दी', englishName: 'Hindi', isRTL: false },
  { code: 'ar', nativeName: 'العربية', englishName: 'Arabic', isRTL: true },
  { code: 'ru', nativeName: 'Русский', englishName: 'Russian', isRTL: false },
];

export function isSupportedLocale(value: string): value is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function isRTLLocale(locale: SupportedLocale): boolean {
  return LANGUAGE_OPTIONS.some((option) => option.code === locale && option.isRTL);
}

/**
 * Map an arbitrary BCP-47 tag (e.g. "pt-PT", "zh-Hant-HK", "es-MX") to the
 * closest supported locale, or null if the language isn't supported at all.
 */
export function matchSupportedLocale(languageTag: string): SupportedLocale | null {
  const exact = SUPPORTED_LOCALES.find(
    (locale) => locale.toLowerCase() === languageTag.toLowerCase(),
  );
  if (exact) return exact;

  const parts = languageTag.split('-');
  const language = parts[0]?.toLowerCase();
  if (!language) return null;

  // Chinese needs script/region to pick Simplified vs Traditional
  if (language === 'zh') {
    if (parts.some((part) => /^(hant|tw|hk|mo)$/i.test(part))) return 'zh-TW';
    return 'zh-CN';
  }

  // Any Portuguese variant maps to our only Portuguese locale
  if (language === 'pt') return 'pt-BR';

  return SUPPORTED_LOCALES.find((locale) => locale.toLowerCase() === language) ?? null;
}
