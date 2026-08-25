import Cookies from 'cookies-ts';
import React from 'react';

import { useLocalStorage } from '@app/storage/StorageContext.tsx';
import {
  getCatalog,
  setCatalog as setCatalogDB,
} from '@app/storage/gmeFilesDB.ts';

import { apiGet } from '@utils/api/apiFetch.ts';
import { API_BASE } from '@utils/api/constants.ts';

import { COOKIE_NAME } from '../../intl/constants.ts';
import { getLanguageISO } from '../../intl/functions.ts';
import {
  DEFAULT_LOCALE,
  LANGUAGES,
  Locale,
  isAvailableLocale,
} from './languages.ts';
import { Catalog, GameFile, Product, ProductI } from './types.ts';

export enum STATE {
  IDLE = 'idle',
  LOADING = 'loading',
  ERROR = 'error',
  SUCCESS = 'success',
}

export const SELECTED_LANGUAGES_STORAGE_KEY = 'catalog-languages';

const catalogStorageKey = (locale: Locale): string => `catalog_${locale}`;

const cookies = new Cookies();

/**
 * First run only: seed the catalog language from the UI language cookie, so a
 * French user does not silently get the German catalog. `IntlContext` only
 * applies that cookie in an effect, so it is read directly here - by the time
 * the context reports it, this initialiser has already run. Once the user has
 * picked languages themselves, the persisted choice wins.
 */
const initialLocale = (): Locale => {
  try {
    const cookie = cookies.get(COOKIE_NAME);
    const iso = getLanguageISO(cookie || '');
    return isAvailableLocale(iso) ? iso : DEFAULT_LOCALE;
  } catch (e) {
    return DEFAULT_LOCALE;
  }
};

/**
 * One product as it exists in one specific catalog language. `gameFile` is the
 * highest-version game file of that product, or `null` when the product ships
 * without one (those products are listed but cannot be installed).
 */
export interface LocalisedEntry {
  product: Product;
  gameFile: GameFile | null;
  locale: Locale;
}

/**
 * A product together with its counterparts in the other loaded languages.
 *
 * `gameFile.id` is the only key that survives across languages (`product.id`
 * is language specific), but it is NOT unique within a language: it behaves as
 * a product-FAMILY id, so e.g. `68` covers a dozen distinct "Wissen & Quizzen"
 * titles. Cross-linking is therefore only done for ids that resolve to exactly
 * one product in every loaded locale; everything else stays separate so that
 * no product can ever disappear from the list.
 */
export interface MergedProduct {
  /**
   * Unique within one `mergedProducts` result, and safe as a React list key.
   *
   * NOT stable across loads: a game file id only becomes known-ambiguous once
   * the locale that proves the collision has loaded, so an entry can split
   * (`gf:45` -> `de_DE:32911`) when a further language arrives. Never persist
   * this key or use it as a cross-session identifier.
   */
  key: string;
  /** Family/series id. `null` when the product has no game file at all. */
  gameFileId: string | null;
  /** `true` when `gameFileId` maps to more than one product in any locale. */
  ambiguous: boolean;
  byLang: Partial<Record<Locale, LocalisedEntry>>;
  /** Entry of the first selected language that carries this product. */
  primary: LocalisedEntry;
  /** Ordered consistently with `selectedLanguages`. */
  availableIn: Array<Locale>;
  /** Every localised title - powers cross-language search. */
  allNames: Array<string>;
}

interface CatalogContextValue {
  state: STATE;
  stateByLang: Record<Locale, STATE>;
  selectedLanguages: Array<Locale>;
  setSelectedLanguages: (languages: Array<Locale>) => void;
  mergedProducts: Array<MergedProduct>;
  /**
   * Resolves an installed `.gme` file to the products shipping it, in ANY
   * loaded language. A list, because some files genuinely belong to several
   * distinct products at once (`WissenManage.gme` ships with a dozen
   * "Wissen & Quizzen" titles). Callers must handle more than one match;
   * `[0]` is a best guess (primary language first), not an identification.
   */
  productByGmeFileName: Record<string, Array<MergedProduct>>;
  productCategories: Array<string>;
  gmeFilesIndices: Record<string, number>;
  products: Array<ProductI>;
}

const idleStateByLang = (): Record<Locale, STATE> =>
  LANGUAGES.reduce(
    (acc, { code }) => ({ ...acc, [code]: STATE.IDLE }),
    {} as Record<Locale, STATE>
  );

/**
 * The single chokepoint for every locale that reaches state: it drops unknown
 * codes, de-duplicates, and - importantly - drops locales that have no catalog
 * behind them (see `AVAILABLE_LANGUAGES`). A selection persisted before a
 * locale was marked unavailable is therefore healed on restore.
 */
const sanitizeLocales = (languages: Array<string>): Array<Locale> => {
  const valid = languages.filter(
    (language, index): language is Locale =>
      typeof language === 'string' &&
      isAvailableLocale(language) &&
      languages.indexOf(language) === index
  );
  return valid.length === 0 ? [DEFAULT_LOCALE] : valid;
};

/**
 * The one game file that represents a product: the highest version, the same
 * convention `FileFinderInstall` uses. Exactly one file per product keeps
 * every product to exactly one `MergedProduct`.
 */
const representativeGameFile = (product: Product): GameFile | null => {
  const files = (product.gameFiles || []).filter((file) => Boolean(file));
  if (files.length === 0) return null;
  return [...files].sort((a, b) => (a.version > b.version ? -1 : 1))[0];
};

/**
 * Collects every game file id that is claimed by more than one product within
 * a single locale. Such ids are family/series ids rather than product ids and
 * must never be used to link products across languages.
 */
const collectAmbiguousGameFileIds = (
  locales: Array<Locale>,
  catalogs: Partial<Record<Locale, Catalog>>
): Set<string> => {
  const ambiguous = new Set<string>();
  locales.forEach((locale) => {
    const catalog = catalogs[locale];
    if (!catalog) return;
    const productsPerId = new Map<string, number>();
    (catalog.products || []).forEach((product) => {
      // Every id of the product counts, not just the representative one -
      // a collision on any of them makes the id unsafe to link on.
      const ids = new Set(
        (product.gameFiles || [])
          .filter((file) => file && file.id)
          .map((file) => file.id)
      );
      ids.forEach((id) => {
        const count = (productsPerId.get(id) || 0) + 1;
        productsPerId.set(id, count);
        if (count > 1) ambiguous.add(id);
      });
    });
  });
  return ambiguous;
};

/**
 * A locale on the allow-list can still answer with an empty or product-less
 * payload - `en_GB` currently does exactly that (HTTP 200, zero bytes). Such a
 * response must never be cached, otherwise the empty catalog is served from
 * IndexedDB forever, since there is no cache expiry.
 */
const isUsableCatalog = (catalog: Catalog): boolean =>
  Boolean(catalog) &&
  Array.isArray(catalog.products) &&
  catalog.products.length > 0;

const CatalogContext = React.createContext<CatalogContextValue>({
  state: STATE.IDLE,
  stateByLang: idleStateByLang(),
  selectedLanguages: [DEFAULT_LOCALE],
  setSelectedLanguages: () => undefined,
  mergedProducts: [],
  productByGmeFileName: {},
  productCategories: [],
  gmeFilesIndices: {},
  products: [],
});

export const CatalogContextProvider: React.FC<{
  children: React.ReactElement;
}> = ({ children }) => {
  const { setLocalItem, getLocalItem } = useLocalStorage();

  const [catalogs, setCatalogs] = React.useState<Partial<Record<Locale, Catalog>>>(
    {}
  );
  const [stateByLang, setStateByLang] = React.useState<Record<Locale, STATE>>(
    idleStateByLang
  );
  const [selectedLanguages, setSelectedLanguagesState] = React.useState<
    Array<Locale>
  >(() => {
    try {
      const stored = getLocalItem(SELECTED_LANGUAGES_STORAGE_KEY);
      if (!stored) return [initialLocale()];
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return [initialLocale()];
      // A persisted choice always wins over the UI language.
      const persisted = parsed.filter(
        (language: unknown): language is Locale =>
          typeof language === 'string' && isAvailableLocale(language)
      );
      return persisted.length === 0
        ? [initialLocale()]
        : sanitizeLocales(persisted);
    } catch (e) {
      return [initialLocale()];
    }
  });

  const setSelectedLanguages = (languages: Array<Locale>) => {
    const next = sanitizeLocales(languages);
    setSelectedLanguagesState(next);
    // Persisting must never break the selection itself (localStorage throws
    // when the quota is exhausted or storage is blocked).
    setLocalItem(SELECTED_LANGUAGES_STORAGE_KEY, JSON.stringify(next)).catch(
      () => undefined
    );
  };

  /**
   * Before this version whole catalogs were cached in localStorage under
   * `catalog-{locale}`. They now live in IndexedDB, but the old entries stay
   * behind - roughly 1.5 MB of a ~5 MB quota per language - and would starve
   * every other localStorage write, including the language selection above.
   */
  React.useEffect(() => {
    LANGUAGES.forEach(({ code }) => {
      try {
        window.localStorage.removeItem(`catalog-${code}`);
      } catch (e) {
        // Storage disabled - nothing to clean up.
      }
    });
  }, []);

  /** Locales a load has already been started for, to avoid double fetches. */
  const requestedLanguages = React.useRef<Array<Locale>>([]);

  const loadCatalog = async (locale: Locale) => {
    setStateByLang((current) => ({ ...current, [locale]: STATE.LOADING }));
    try {
      const cached = await getCatalog(catalogStorageKey(locale));
      // An unusable cache entry (written before this guard existed) is treated
      // as a miss so it can heal itself on the next load.
      if (isUsableCatalog(cached)) {
        setCatalogs((current) => ({ ...current, [locale]: cached }));
        setStateByLang((current) => ({ ...current, [locale]: STATE.SUCCESS }));
        return;
      }
      const catalog = await apiGet<Catalog>(
        `${API_BASE}api/getCatalog.php?language=${locale}`
      );
      if (!isUsableCatalog(catalog)) {
        throw new Error(`empty catalog for ${locale}`);
      }
      await setCatalogDB(catalogStorageKey(locale), catalog);
      setCatalogs((current) => ({ ...current, [locale]: catalog }));
      setStateByLang((current) => ({ ...current, [locale]: STATE.SUCCESS }));
    } catch (e) {
      requestedLanguages.current = requestedLanguages.current.filter(
        (requested) => requested !== locale
      );
      setStateByLang((current) => ({ ...current, [locale]: STATE.ERROR }));
    }
  };

  React.useEffect(() => {
    selectedLanguages.forEach((locale) => {
      if (requestedLanguages.current.includes(locale)) return;
      requestedLanguages.current = [...requestedLanguages.current, locale];
      loadCatalog(locale);
    });
  }, [selectedLanguages]);

  const state: STATE = React.useMemo(() => {
    const states = selectedLanguages.map((locale) => stateByLang[locale]);
    if (states.length === 0) return STATE.IDLE;
    if (states.some((current) => current === STATE.LOADING))
      return STATE.LOADING;
    // SUCCESS and ERROR both outrank IDLE: a language that never started must
    // not mask a finished one, otherwise a failure next to an idle language
    // would leave the UI spinning forever.
    if (states.some((current) => current === STATE.SUCCESS))
      return STATE.SUCCESS;
    if (states.some((current) => current === STATE.ERROR)) return STATE.ERROR;
    return STATE.IDLE;
  }, [selectedLanguages, stateByLang]);

  const mergedProducts: Array<MergedProduct> = React.useMemo(() => {
    const ambiguousIds = collectAmbiguousGameFileIds(
      selectedLanguages,
      catalogs
    );
    const merged = new Map<string, MergedProduct>();

    // Iterating in `selectedLanguages` order keeps `primary` and
    // `availableIn` aligned with the user's language priority.
    selectedLanguages.forEach((locale) => {
      const catalog = catalogs[locale];
      if (!catalog) return;
      (catalog.products || []).forEach((product) => {
        const gameFile = representativeGameFile(product);
        const gameFileId = gameFile ? gameFile.id : null;
        const ambiguous = Boolean(gameFileId) && ambiguousIds.has(gameFileId);
        const entry: LocalisedEntry = { product, gameFile, locale };

        // Only a game file id that resolves to exactly one product in every
        // loaded locale is safe to link on. Anything else - an ambiguous
        // family id, or no game file at all - stays a standalone entry, which
        // is what guarantees that no product is ever dropped.
        const linkable = Boolean(gameFileId) && !ambiguous;
        const key = linkable ? `gf:${gameFileId}` : `${locale}:${product.id}`;

        const existing = merged.get(key);
        if (!existing) {
          merged.set(key, {
            key,
            gameFileId,
            ambiguous,
            byLang: { [locale]: entry },
            primary: entry,
            availableIn: [locale],
            allNames: product.name ? [product.name] : [],
          });
          return;
        }

        existing.byLang[locale] = entry;
        existing.availableIn.push(locale);
        if (product.name && !existing.allNames.includes(product.name)) {
          existing.allNames.push(product.name);
        }
      });
    });

    return Array.from(merged.values());
  }, [catalogs, selectedLanguages]);

  /**
   * Installed pen files are language specific, so resolving one must look at
   * every loaded language - not just the primary one. Both the URL basename
   * (percent-encoded, as it appears on the server) and the raw `fileName` are
   * registered because the file system reports the decoded name.
   *
   * The value is a LIST because one `.gme` genuinely belongs to several
   * distinct retail products at once - `WissenManage.gme` ships with a dozen
   * "Wissen & Quizzen" titles, `Spielfiguren_Pferde.gme` with three Reit-Sets.
   * No registration order can fix that, so callers must handle >1 match;
   * `[0]` is a best guess (primary language first), never an identification.
   */
  const productByGmeFileName: Record<string, Array<MergedProduct>> =
    React.useMemo(() => {
      const map: Record<string, Array<MergedProduct>> = {};
      const register = (name: string, merged: MergedProduct) => {
        const bucket = map[name] || (map[name] = []);
        // The encoded basename and the raw fileName often coincide, so the
        // same product would otherwise be listed twice in one bucket.
        if (!bucket.some((candidate) => candidate.key === merged.key)) {
          bucket.push(merged);
        }
      };
      mergedProducts.forEach((merged) => {
        Object.values(merged.byLang).forEach((entry) => {
          (entry.product.gameFiles || []).forEach((gameFile) => {
            if (!gameFile) return;
            const fromUrl = gameFile.url ? gameFile.url.split('/').pop() : null;
            if (fromUrl) register(fromUrl, merged);
            if (gameFile.fileName) register(gameFile.fileName, merged);
          });
        });
      });
      return map;
    }, [mergedProducts]);

  const primaryLanguage: Locale = selectedLanguages[0] || DEFAULT_LOCALE;

  const products: Array<ProductI> = React.useMemo(
    () => catalogs[primaryLanguage]?.products || [],
    [catalogs, primaryLanguage]
  );

  // Categories are localised strings, so they only come from the primary
  // language - mixing languages would produce duplicate looking filters.
  const productCategories: Array<string> = React.useMemo(
    () =>
      products
        .reduce((acc, product) => [...acc, ...(product.categories || [])], [])
        .reduce(
          (acc, category) =>
            acc.includes(category) ? acc : [...acc, category],
          []
        ),
    [products]
  );

  const gmeFilesIndices: Record<string, number> = React.useMemo(
    () =>
      products.reduce(
        (acc, product, index) => ({
          ...acc,
          ...(product.gameFiles || []).reduce(
            (acc, file) => ({ ...acc, [file.url.split('/').pop()]: index }),
            {}
          ),
        }),
        {}
      ),
    [products]
  );

  return (
    <CatalogContext.Provider
      value={{
        state,
        stateByLang,
        selectedLanguages,
        setSelectedLanguages,
        mergedProducts,
        productByGmeFileName,
        productCategories,
        gmeFilesIndices,
        products,
      }}
    >
      {children}
    </CatalogContext.Provider>
  );
};

export const useCatalog = () => React.useContext(CatalogContext);
