import translate from 'google-translate-api-x';

export type SupportedLocale = 'en' | 'si' | 'ta';

const LOCALE_MAP: Record<SupportedLocale, string> = {
  en: 'en',
  si: 'si',
  ta: 'ta',
};

const LOCALE_NAMES: Record<SupportedLocale, string> = {
  en: 'English',
  si: 'සිංහල (Sinhala)',
  ta: 'தமிழ் (Tamil)',
};

export function getLocaleName(locale: SupportedLocale): string {
  return LOCALE_NAMES[locale] || locale;
}

/**
 * Translate text from source language to target language.
 * Uses google-translate-api-x — a free, no-API-key-needed solution
 * that provides Google Translate quality at zero cost.
 */
export async function translateText(
  text: string,
  targetLocale: SupportedLocale,
  sourceLocale?: SupportedLocale
): Promise<string> {
  try {
    if (!text || text.trim().length === 0) return text;
    
    const target = LOCALE_MAP[targetLocale];
    const source = sourceLocale ? LOCALE_MAP[sourceLocale] : undefined;

    const result = await translate(text, {
      from: source || 'auto',
      to: target,
    });

    return result.text;
  } catch (error) {
    console.error('[TRANSLATE_ERROR]', error);
    // Graceful fallback: return original text if translation fails
    return text;
  }
}

/**
 * Detect the language of a given text.
 */
export async function detectLanguage(text: string): Promise<SupportedLocale | null> {
  try {
    if (!text || text.trim().length === 0) return null;
    
    const result = await translate(text, { to: 'en' });
    const detected = result.from?.language?.iso;
    
    if (detected === 'si') return 'si';
    if (detected === 'ta') return 'ta';
    if (detected === 'en') return 'en';
    
    return null;
  } catch (error) {
    console.error('[DETECT_LANG_ERROR]', error);
    return null;
  }
}

/**
 * Translate multiple fields at once (e.g., title + content + excerpt).
 * Returns an object with the same keys but translated values.
 */
export async function translateFields(
  fields: Record<string, string | null | undefined>,
  targetLocale: SupportedLocale,
  sourceLocale?: SupportedLocale
): Promise<Record<string, string>> {
  const entries = Object.entries(fields).filter(
    ([, value]) => value != null && value.trim().length > 0
  );

  const translations = await Promise.all(
    entries.map(async ([key, value]) => {
      const translated = await translateText(value!, targetLocale, sourceLocale);
      return [key, translated] as [string, string];
    })
  );

  return Object.fromEntries(translations);
}
