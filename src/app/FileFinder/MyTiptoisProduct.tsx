import { Button, Tooltip } from '@theme';
import React from 'react';

import { MergedProduct } from '@app/catalog/CatalogContext.tsx';
import { useDirHandle, usePenFiles } from '@app/FilesContext.tsx';
import { SavedProduct } from '@app/storage/gmeFilesDB.ts';

import LanguageFlags from '@app/FileFinder/LanguageFlags.tsx';
import cn from '@utils/classnames.ts';
import { writeFile } from '@utils/fileSystem.ts';
import { stringToBlob } from '@utils/functions.ts';

import styles from './MyTiptoisProduct.module.css';

const MyTiptoisProduct: React.FC<{
  className?: string;
  product: SavedProduct;
  merged?: MergedProduct;
}> = ({ className = '', product, merged }) => {
  const { files } = usePenFiles();
  const tooltipRef = React.useRef<HTMLButtonElement>(null);
  const [dirHandle] = useDirHandle();
  const [pending, setPending] = React.useState<boolean>(false);
  const { reloadFiles } = usePenFiles();

  const alreadyInstalled = React.useMemo<boolean>(() => {
    if (!product.audioFile) {
      return false;
    }
    const parts = product.audioFile.url.split('/');
    const gameFileName = parts[parts.length - 1];
    const installedFiles = files.reduce<Array<string>>(
      (acc, file) => [...acc, encodeURI(file.name)],
      []
    );
    return installedFiles.indexOf(gameFileName) !== -1;
  }, [product.audioFile, files]);

  const write = async () => {
    if (!dirHandle) return;
    setPending(true);
    const blob = stringToBlob(product.audioFile.fileContent);
    writeFile(dirHandle, product.audioFile.fileName, blob)
      .then(() => reloadFiles())
      .catch(() =>
        alert('something went wrong. Please close the modal and try again')
      )
      .finally(() => setPending(false));
  };

  return (
    <div className={cn(className, styles.root)}>
      {product.images.length !== 0 && (
        <div className={styles.imgWrapper}>
          <img
            className={styles.img}
            src={product.images[product.images.length - 1].url}
            alt={product.name}
            loading="lazy"
          />
          {merged && <LanguageFlags locales={merged.availableIn} />}
        </div>
      )}
      <p className={styles.title}>{product.name}</p>
      {!dirHandle && (
        <Tooltip tooltipRef={tooltipRef} maxWidth={300}>
          Please connect your pen to install files.
        </Tooltip>
      )}
      <span ref={tooltipRef} className={styles.installWrapper}>
        <Button
          className={styles.install}
          icon="save"
          size="small"
          onClick={() => write()}
          loading={pending}
          disabled={alreadyInstalled || !dirHandle || pending}
        >
          {alreadyInstalled ? 'Installed' : 'Install'}
        </Button>
      </span>
    </div>
  );
};

export default MyTiptoisProduct;
