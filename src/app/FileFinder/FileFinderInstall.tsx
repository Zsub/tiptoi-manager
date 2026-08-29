import { Button, ButtonGroup, ContentModal, FieldRadio, Tooltip } from '@theme';
import React from 'react';

import { useDirHandle, usePenFiles } from '@app/FilesContext.tsx';
import { MergedProduct } from '@app/catalog/CatalogContext.tsx';
import { LANGUAGES, Locale } from '@app/catalog/languages.ts';
import { GameFile, Product } from '@app/catalog/types.ts';
import { useGmeFileStore } from '@app/storage/StorageContext.tsx';

import { API_BASE } from '@utils/api/constants.ts';
import { writeFile } from '@utils/fileSystem.ts';
import { blobToString } from '@utils/functions.ts';

import styles from './FileFinderInstall.module.css';

const languageLabel = (locale: Locale): string =>
  LANGUAGES.find(({ code }) => code === locale)?.label ?? locale;

/** Locales, in `merged.availableIn` order, that actually ship a game file. */
const downloadableLanguages = (merged: MergedProduct): Array<Locale> =>
  merged.availableIn.filter((locale) =>
    Boolean(merged.byLang[locale]?.gameFile)
  );

const FileFinderInstall: React.FC<{
  onClose: () => void;
  merged: MergedProduct;
}> = ({ onClose, merged }) => {
  const [dirHandle] = useDirHandle();
  const { files, reloadFiles } = usePenFiles();
  const { setFile } = useGmeFileStore();
  const [pending, setPending] = React.useState<boolean>(false);
  const [done, setDone] = React.useState<boolean>(false);
  const [downloaded, setDownloaded] = React.useState<Blob>(null);
  const tooltipRef = React.useRef<HTMLButtonElement>(null);

  const languages = React.useMemo(
    () => downloadableLanguages(merged),
    [merged]
  );

  const [selectedLocale, setSelectedLocale] = React.useState<Locale>(() =>
    merged.byLang[merged.primary.locale]?.gameFile
      ? merged.primary.locale
      : languages[0]
  );

  const entry = merged.byLang[selectedLocale] ?? merged.primary;
  const product = entry.product;
  const gameFile = entry.gameFile;

  const alreadyInstalled = React.useMemo<boolean>(() => {
    if (!gameFile) return false;
    const gameFileName = gameFile.url.split('/').pop();
    return files.some((file) => encodeURI(file.name) === gameFileName);
  }, [gameFile, files]);

  // Context functions such as `setFile` are re-created on every render of
  // their provider, so closing over the live value directly - rather than
  // through a ref - would make the callback below (and the effect that
  // depends on it) re-run far more often than the language actually changes.
  const setFileRef = React.useRef(setFile);
  // eslint-disable-next-line react-hooks/refs -- deliberate mirror, see comment above: through an effect the ref would lag a render and re-fire the download
  setFileRef.current = setFile;

  // Bumped on every download attempt so a response that lands after the user
  // has since switched language can recognise itself as stale and bail out,
  // instead of racing the newer request and overwriting its result.
  const requestIdRef = React.useRef(0);

  const downloadFile = React.useCallback(
    async (file: GameFile, prod: Product) => {
      const requestId = ++requestIdRef.current;
      setDownloaded(null);
      setDone(false);
      setPending(true);
      try {
        const res = await fetch(
          `${API_BASE}api/getFile.php?url=${encodeURI(file.url)}`
        );
        const blob = await res.blob();
        const text = await blobToString(blob);
        if (requestIdRef.current !== requestId) return;
        await setFileRef.current(prod.id, {
          name: prod.name,
          images: prod.images,
          audioFile: {
            fileName: file.fileName,
            fileContent: text,
            url: file.url,
            version: file.version,
          },
        });
        if (requestIdRef.current !== requestId) return;
        setDownloaded(blob);
      } catch (e) {
        console.error(e);
        if (requestIdRef.current === requestId) {
          alert('File could not be downloaded');
        }
      } finally {
        if (requestIdRef.current === requestId) {
          setPending(false);
        }
      }
    },
    []
  );

  // Picking a language must invalidate the in-flight/previous download and
  // disable the Install button in the SAME commit as the selection change.
  // Doing this only in the effect below would leave a render in between where
  // `gameFile`/`product` already point at the new language but `downloaded`
  // (and therefore the enabled Install button) still reflects the old one.
  const selectLocale = (locale: Locale) => {
    requestIdRef.current += 1;
    setSelectedLocale(locale);
    setDownloaded(null);
    setDone(false);
    setPending(true);
  };

  React.useEffect(() => {
    if (!gameFile) return;
    if (alreadyInstalled) {
      // Discard any still in-flight download for a previously selected
      // language - it can no longer be allowed to overwrite this state.
      requestIdRef.current += 1;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resets install state when the selected language changes; needs catalog data to exercise, so left as-is rather than rewritten unverified
      setPending(false);
      setDownloaded(null);
      setDone(true);
      return;
    }
    void downloadFile(gameFile, product);
    // `gameFile`/`product` already change whenever `selectedLocale` does (both
    // are looked up from `merged.byLang` by it), so listing them - rather
    // than `selectedLocale` itself - is what the effect actually reacts to.
  }, [gameFile, product, alreadyInstalled, downloadFile]);

  const write = () => {
    setPending(true);
    writeFile(dirHandle, gameFile.fileName, downloaded)
      .then(() => {
        setDone(true);
        reloadFiles();
      })
      .catch(() =>
        alert('something went wrong. Please close the modal and try again')
      )
      .finally(() => setPending(false));
  };

  return (
    <ContentModal
      title="Install"
      onClose={onClose}
      full={false}
      preventClose={pending}
    >
      <div className={styles.root}>
        {languages.length > 1 && (
          <div className={styles.languages}>
            <p className={styles.languagesHint}>
              The pen recognises a book by a code inside the audio file, not by
              its language - installing another language here makes this same
              physical book speak that language instead.
            </p>
            <div className={styles.languageOptions}>
              {languages.map((locale) => (
                <FieldRadio
                  key={locale}
                  className={styles.languageOption}
                  name="ffi-language"
                  id={`ffi-language-${locale}`}
                  value={locale}
                  label={languageLabel(locale)}
                  checked={selectedLocale === locale}
                  onChange={() => selectLocale(locale)}
                />
              ))}
            </div>
          </div>
        )}
        {done ? (
          <p>
            The audio file has been installed successfully. You can now close
            the app and disconnect the pen.
          </p>
        ) : (
          <React.Fragment>
            <p>
              Please wait a minute so we can download and prepare the file.
              After that you will be abe to install it.
            </p>
            <ButtonGroup align="center">
              {!dirHandle && (
                <Tooltip tooltipRef={tooltipRef} maxWidth={300}>
                  Please connect your pen to install files.
                </Tooltip>
              )}
              <span
                ref={tooltipRef}
                style={{ display: 'inline-block', marginBottom: '1rem' }}
              >
                <Button
                  onClick={() => write()}
                  icon="save"
                  loading={pending}
                  disabled={!downloaded || !dirHandle}
                >
                  Install
                </Button>
              </span>
            </ButtonGroup>
          </React.Fragment>
        )}
      </div>
    </ContentModal>
  );
};

export default FileFinderInstall;
