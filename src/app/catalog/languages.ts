/**
 * The catalog API (`getCatalog.php?language={locale}`) only accepts these
 * six full locale codes. A bare or unknown code (e.g. `nl`) answers with
 * HTTP 200 and an EMPTY body, which makes `apiFetch` fail while parsing the
 * JSON - so an invalid locale fails silently. Always validate against this
 * allow-list before building a catalog request.
 */
export type Locale = 'de_DE' | 'fr_FR' | 'nl_NL' | 'it_IT' | 'ru_RU' | 'en_GB';

/**
 * `available: false` means the locale is accepted by the API but currently has
 * no catalog behind it. `en_GB` answers HTTP 200 with a zero-byte body, so it
 * cannot be distinguished by the allow-list above - it has to be gated in the
 * UI (verified against the live API on 2026-08-25: de_DE 343 products,
 * fr_FR 82, nl_NL 77, it_IT 23, ru_RU 12, en_GB 0 bytes).
 *
 * `en_GB` is deliberately kept in the union and in `isLocale`: it is a
 * legitimate API locale that upstream may populate later, and a persisted
 * selection containing it must still parse rather than be treated as corrupt.
 */
export const LANGUAGES: ReadonlyArray<{
  code: Locale;
  label: string;
  available: boolean;
}> = [
  { code: 'de_DE', label: 'German', available: true },
  { code: 'fr_FR', label: 'French', available: true },
  { code: 'nl_NL', label: 'Dutch', available: true },
  { code: 'it_IT', label: 'Italian', available: true },
  { code: 'ru_RU', label: 'Russian', available: true },
  { code: 'en_GB', label: 'English', available: false },
];

/** The only locales that should ever be selectable in the UI. */
export const AVAILABLE_LANGUAGES = LANGUAGES.filter(
  ({ available }) => available
);

export const DEFAULT_LOCALE: Locale = 'de_DE';

export const isLocale = (x: string): x is Locale =>
  LANGUAGES.some(({ code }) => code === x);

/** A locale that is both known AND actually has a catalog behind it. */
export const isAvailableLocale = (x: string): x is Locale =>
  LANGUAGES.some(({ code, available }) => code === x && available);

/** Locale → Unicode region flag emoji. Only the 6 catalog locales are listed. */
const LOCALE_FLAG_MAP: Record<Locale, string> = {
  de_DE: '🇩🇪',
  fr_FR: '🇫🇷',
  nl_NL: '🇳🇱',
  it_IT: '🇮🇹',
  ru_RU: '🇷🇺',
  en_GB: '🇬🇧',
};

export const flagEmoji = (locale: Locale): string =>
  LOCALE_FLAG_MAP[locale] || '';
