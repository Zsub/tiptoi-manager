import { Loader, Notification } from '@theme';
import React from 'react';
import { useIntl } from 'react-intl';

import FileFinderForm, {
  ANY_LANGUAGE,
} from '@app/FileFinder/FileFinderForm.tsx';
import FileFinderProduct from '@app/FileFinder/FileFinderProduct.tsx';
import {
  STATE as CATALOG_STATE,
  MergedProduct,
  useCatalog,
} from '@app/catalog/CatalogContext.tsx';
import { Locale } from '@app/catalog/languages.ts';

import cn from '@utils/classnames.ts';
import useOnline from '@utils/useOnline.ts';

import styles from './FileFinder.module.css';

/**
 * Case- AND accent-insensitive: `normalize('NFD')` splits a Latin base
 * letter from its diacritic so the combining marks (U+0300-U+036F) can be
 * stripped. Cyrillic titles (`ru_RU`) have no such combining marks, so they
 * pass through unchanged - `toLowerCase()` alone already case-folds them.
 */
const normalizeForSearch = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const FileFinder: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [searchTerm, setSearchTerm] = React.useState<string>('');
  const [languageFilter, setLanguageFilter] = React.useState<
    Locale | typeof ANY_LANGUAGE
  >(ANY_LANGUAGE);
  const { state, mergedProducts, productCategories, selectedLanguages } =
    useCatalog();
  const [checkedCategories, setCheckedCategories] =
    React.useState<Array<string>>(productCategories);
  const online = useOnline();

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs checked categories to the catalog; needs catalog data to exercise, so left as-is rather than rewritten unverified
    setCheckedCategories(productCategories);
  }, [productCategories]);

  // If the language the filter is set to gets deselected in the header, fall
  // back to "any" - otherwise `availableIn.includes(languageFilter)` would
  // never match again and the list would silently show zero products.
  React.useEffect(() => {
    if (
      languageFilter !== ANY_LANGUAGE &&
      !selectedLanguages.includes(languageFilter)
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resets the filter when its language is deselected; see comment above
      setLanguageFilter(ANY_LANGUAGE);
    }
  }, [selectedLanguages, languageFilter]);

  const { formatMessage } = useIntl();

  const results = React.useMemo<Array<MergedProduct>>(() => {
    const normalizedSearch = normalizeForSearch(searchTerm);
    return mergedProducts.filter((merged) => {
      const matchesCategory = merged.primary.product.categories.some((item) =>
        checkedCategories.includes(item)
      );
      // Search matches ANY localised title, not just the primary one - this
      // is what lets the German and Dutch title of the same product both
      // find it.
      const matchesSearch = merged.allNames.some((name) =>
        normalizeForSearch(name).includes(normalizedSearch)
      );
      const matchesLanguage =
        languageFilter === ANY_LANGUAGE ||
        merged.availableIn.includes(languageFilter);
      return matchesCategory && matchesSearch && matchesLanguage;
    });
  }, [mergedProducts, searchTerm, checkedCategories, languageFilter]);

  return (
    <div className={cn(className, styles.root)}>
      {online ? (
        <React.Fragment>
          <h2 className={styles.title}>
            {formatMessage({ id: 'filter.title' })}
          </h2>
          <FileFinderForm
            setSearchTerm={setSearchTerm}
            checkedCategories={checkedCategories}
            setCheckedCategories={setCheckedCategories}
            languageFilter={languageFilter}
            setLanguageFilter={setLanguageFilter}
          />
          <h2 className={cn(styles.title, styles.titleProducts)}>
            {formatMessage({ id: 'products.title' })}
          </h2>
          {state === CATALOG_STATE.LOADING || state === CATALOG_STATE.IDLE ? (
            <div className={styles.loaderContainer}>
              <Loader className={styles.loader} />
            </div>
          ) : state === CATALOG_STATE.ERROR ? (
            <Notification type="error" className={styles.error}>
              {formatMessage({ id: '_error' })}
            </Notification>
          ) : results.length === 0 ? (
            <p className={styles.empty}>No products match your search.</p>
          ) : (
            <div className={styles.list}>
              {results.map((merged) => (
                <FileFinderProduct
                  className={styles.listItem}
                  merged={merged}
                  key={merged.key}
                />
              ))}
            </div>
          )}
        </React.Fragment>
      ) : (
        <Notification type="message">
          {formatMessage({ id: 'products.offline' })}
        </Notification>
      )}
    </div>
  );
};

export default FileFinder;
