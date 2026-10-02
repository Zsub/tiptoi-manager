import { Button, ContentModal, Tooltip } from '@theme';
import React from 'react';

import { LANGUAGES, Locale } from '@app/catalog/languages.ts';
import { MergedProduct } from '@app/catalog/CatalogContext.tsx';
import { GameFile, Product } from '@app/catalog/types.ts';
import { useDirHandle, usePenFiles } from '@app/FilesContext.tsx';
import { SavedProduct } from '@app/storage/gmeFilesDB.ts';
import { useGmeFileStore } from '@app/storage/StorageContext.tsx';

import LanguageFlags from '@app/FileFinder/LanguageFlags.tsx';
import cn from '@utils/classnames.ts';
import { writeFile } from '@utils/fileSystem.ts';
import { blobToString, stringToBlob } from '@utils/functions.ts';
import { API_BASE } from '@utils/api/constants.ts';

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
  const { setFile } = useGmeFileStore();
  const [switchLocale, setSwitchLocale] = React.useState<Locale | null>(null);
  const [switchPending, setSwitchPending] = React.useState<boolean>(false);
  const [switchDownloaded, setSwitchDownloaded] = React.useState<Blob | null>(null);
  const switchRequestIdRef = React.useRef(0);

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

  const installedLocale = React.useMemo<Locale | null>(() => {
    if (!merged || !product.audioFile?.fileName) return null;
    const installedName = product.audioFile.fileName;
    for (const locale of merged.availableIn) {
      const gf = merged.byLang[locale]?.gameFile;
      if (gf && gf.fileName === installedName) return locale;
    }
    return null;
  }, [merged, product.audioFile?.fileName]);

  const downloadSwitchFile = React.useCallback(
    async (file: GameFile, prod: Product) => {
      const requestId = ++switchRequestIdRef.current;
      setSwitchDownloaded(null);
      setSwitchPending(true);
      try {
        const res = await fetch(
          `${API_BASE}getFile.php?url=${encodeURI(file.url)}`
        );
        const blob = await res.blob();
        if (switchRequestIdRef.current !== requestId) return;
        const content = await blobToString(blob);
        if (switchRequestIdRef.current !== requestId) return;
        await setFile(prod.id, {
          name: prod.name,
          images: prod.images,
          audioFile: {
            fileName: file.fileName,
            fileContent: content,
            url: file.url,
            version: file.version,
          },
        });
        if (switchRequestIdRef.current !== requestId) return;
        setSwitchDownloaded(blob);
      } catch (e) {
        console.error(e);
        if (switchRequestIdRef.current === requestId) {
          alert('File could not be downloaded');
        }
      } finally {
        if (switchRequestIdRef.current === requestId) {
          setSwitchPending(false);
        }
      }
    },
    []
  );

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
        {merged && merged.availableIn.length > 1 && (
          <span style={{ display: 'block', marginTop: '0.5rem', textAlign: 'center' }}>
            <Button
              className={styles.switchLang}
              icon="download"
              size="small"
              onClick={() => {
                const other = merged.availableIn.find(l => l !== installedLocale);
                if (other) setSwitchLocale(other);
              }}
              disabled={!dirHandle}
            >
              {installedLocale
                ? `Switch (${LANGUAGES.find(l => l.code === installedLocale)?.label ?? ''})`
                : 'Switch language'}
            </Button>
          </span>
        )}
      </span>
      {switchLocale && merged && (
        <ContentModal
          title={`Switch to ${LANGUAGES.find(l => l.code === switchLocale)?.label ?? ''}`}
          onClose={() => { setSwitchLocale(null); setSwitchDownloaded(null); }}
          full={false}
          preventClose={switchPending}
        >
          <div style={{ marginTop: '1rem' }}>
            {switchDownloaded ? (
              <>
                <p>File downloaded. Click Install to write it to your pen.</p>
                <div style={{ textAlign: 'center' }}>
                  <Button
                    onClick={() => {
                      const gf = merged.byLang[switchLocale!]?.gameFile;
                      if (!gf || !dirHandle) return;
                      setSwitchPending(true);
                      writeFile(dirHandle, gf.fileName, switchDownloaded)
                        .then(() => {
                          reloadFiles();
                          setSwitchLocale(null);
                          setSwitchDownloaded(null);
                        })
                        .catch(() =>
                          alert('something went wrong. Please close the modal and try again')
                        )
                        .finally(() => setSwitchPending(false));
                    }}
                    icon="save"
                    loading={switchPending}
                    disabled={!dirHandle}
                  >
                    Install
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p>Please wait while we download the new language file.</p>
                <div style={{ textAlign: 'center' }}>
                  <Button
                    onClick={() => {
                      const entry = merged.byLang[switchLocale!];
                      if (entry?.gameFile) {
                        downloadSwitchFile(entry.gameFile, entry.product);
                      }
                    }}
                    icon="download"
                    loading={switchPending}
                  >
                    {`Download ${LANGUAGES.find(l => l.code === switchLocale)?.label ?? ''}`}
                  </Button>
                </div>
              </>
            )}
          </div>
        </ContentModal>
      )}
    </div>
  );
};

export default MyTiptoisProduct;
