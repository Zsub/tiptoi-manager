import { Badge, FieldCheckbox, Loader } from '@theme';
import React from 'react';

import { STATE, useCatalog } from '@app/catalog/CatalogContext.tsx';
import { LANGUAGES, Locale } from '@app/catalog/languages.ts';

import cn from '@utils/classnames';

import styles from './LanguageSelect.module.css';

const labelFor = (code: Locale): string =>
  LANGUAGES.find((language) => language.code === code)?.label || code;

/**
 * Lets the user pick which catalog languages to download and in which order.
 * The app UI itself stays English - this only controls the catalog data:
 * index 0 of `selectedLanguages` is the primary language, used elsewhere to
 * decide which title and image are shown for each product.
 */
const LanguageSelect: React.FC<{ className?: string }> = ({
  className = '',
}) => {
  const { selectedLanguages, setSelectedLanguages, stateByLang } =
    useCatalog();

  const addLanguage = (code: Locale) => {
    if (selectedLanguages.includes(code)) return;
    setSelectedLanguages([...selectedLanguages, code]);
  };

  const removeLanguage = (code: Locale) => {
    // The selection must never become empty - block removing the last one.
    if (selectedLanguages.length <= 1) return;
    setSelectedLanguages(selectedLanguages.filter((lang) => lang !== code));
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= selectedLanguages.length) return;
    const next = [...selectedLanguages];
    [next[index], next[target]] = [next[target], next[index]];
    setSelectedLanguages(next);
  };

  return (
    <div className={cn(className, styles.root)}>
      <p className={styles.hint}>
        The first language in the order below is the primary language: it
        supplies the title and image shown for each product.
      </p>

      <ol className={styles.selected}>
        {selectedLanguages.map((code, index) => {
          const state = stateByLang[code];
          const label = labelFor(code);
          return (
            <li className={styles.selectedItem} key={code}>
              <span className={styles.selectedLabel}>{label}</span>
              {index === 0 && (
                <Badge
                  className={styles.badge}
                  text="Primary"
                  type="success"
                />
              )}
              {state === STATE.LOADING && (
                <span className={styles.stateLoader}>
                  <Loader />
                </span>
              )}
              {state === STATE.ERROR && (
                <Badge className={styles.badge} text="Error" type="error" />
              )}
              <span className={styles.order}>
                <button
                  type="button"
                  className={styles.orderButton}
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label={`Move ${label} up`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className={styles.orderButton}
                  onClick={() => move(index, 1)}
                  disabled={index === selectedLanguages.length - 1}
                  aria-label={`Move ${label} down`}
                >
                  ↓
                </button>
              </span>
            </li>
          );
        })}
      </ol>

      <ul className={styles.available}>
        {LANGUAGES.map(({ code, label, available }) => {
          const checked = selectedLanguages.includes(code);
          // Disabled either because the catalog does not exist (en_GB), or
          // because unchecking it would leave the selection empty.
          const disabled = !available || (checked && selectedLanguages.length <= 1);
          return (
            <li className={styles.availableItem} key={code}>
              <FieldCheckbox
                className={styles.checkbox}
                id={`catalog-language-${code}`}
                name={`catalog-language-${code}`}
                value={code}
                checked={checked}
                disabled={disabled}
                onChange={() =>
                  checked ? removeLanguage(code) : addLanguage(code)
                }
                label={available ? label : `${label} (unavailable)`}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default LanguageSelect;
