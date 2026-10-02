import { flagEmoji } from '@app/catalog/languages.ts';
import { Locale } from '@app/catalog/languages.ts';

import styles from './LanguageFlags.module.css';

/** Render a row of small flag emojis, right-aligned in the top corner. */
const LanguageFlags: React.FC<{ locales: Array<Locale> }> = ({ locales }) => {
  if (locales.length === 0) return null;
  return (
    <div className={styles.flags}>
      {locales.map((locale) => (
        <span key={locale} className={styles.flag} title={locale}>
          {flagEmoji(locale)}
        </span>
      ))}
    </div>
  );
};

export default LanguageFlags;
