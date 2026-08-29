import { Button } from '@theme';
import React from 'react';

import FileFinderInstall from '@app/FileFinder/FileFinderInstall.tsx';
import { usePenFiles } from '@app/FilesContext.tsx';
import { MergedProduct } from '@app/catalog/CatalogContext.tsx';
import { Locale } from '@app/catalog/languages.ts';

import cn from '@utils/classnames.ts';

import styles from './FileFinderProduct.module.css';

/** Locales, in `merged.availableIn` order, that actually ship a game file. */
const downloadableLanguages = (merged: MergedProduct): Array<Locale> =>
  merged.availableIn.filter((locale) =>
    Boolean(merged.byLang[locale]?.gameFile)
  );

const FileFinderProduct: React.FC<{
  className?: string;
  merged: MergedProduct;
}> = ({ className = '', merged }) => {
  const [showModal, setShowModal] = React.useState<boolean>(false);
  const { files } = usePenFiles();
  const product = merged.primary.product;

  const languages = React.useMemo(
    () => downloadableLanguages(merged),
    [merged]
  );

  const installedFileNames = React.useMemo<Array<string>>(
    () =>
      files.reduce<Array<string>>(
        (acc, file) => [...acc, encodeURI(file.name)],
        []
      ),
    [files]
  );

  // A product with more than one downloaded language only counts as
  // "Installed" once every one of those language files is on the pen -
  // otherwise the button would block the user from grabbing the language
  // they don't have yet, which defeats the point of the feature.
  const alreadyInstalled = React.useMemo<boolean>(() => {
    if (languages.length === 0) return false;
    return languages.every((locale) => {
      const gameFile = merged.byLang[locale]?.gameFile;
      if (!gameFile) return false;
      const gameFileName = gameFile.url.split('/').pop();
      return (
        Boolean(gameFileName) && installedFileNames.includes(gameFileName!)
      );
    });
  }, [languages, merged, installedFileNames]);

  return (
    <div className={cn(className, styles.root)}>
      {product.images.length !== 0 && (
        <img
          className={styles.img}
          src={product.images[product.images.length - 1].url}
          alt={product.name}
          loading="lazy"
        />
      )}
      {showModal && (
        <FileFinderInstall
          onClose={() => setShowModal(false)}
          merged={merged}
        />
      )}
      <p className={styles.title}>{product.name}</p>

      {languages.length > 0 && (
        <Button
          className={styles.download}
          icon="download"
          size="small"
          onClick={() => setShowModal(true)}
          disabled={alreadyInstalled}
        >
          {alreadyInstalled ? 'Installed' : 'Download'}
        </Button>
      )}
    </div>
  );
};

export default FileFinderProduct;
