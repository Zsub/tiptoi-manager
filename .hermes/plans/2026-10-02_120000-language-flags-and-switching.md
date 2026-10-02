# Plan: Language flags on book cards + language switching on installed books

## Goal

Show per-book language availability as small flag badges on the product preview image, and let the user swap a book's installed `.gme` to a different language.

## Current context / assumptions

### What already exists (from the multi-language foundation work)

| File | What it does |
|---|---|
| `src/app/catalog/CatalogContext.tsx` | `MergedProduct` merges products across languages keyed by `gameFile.id`; exposes `availableIn: Locale[]`, `byLang: Partial<Record<Locale, LocalisedEntry>>`, `primary` |
| `src/app/catalog/LanguageSelect.tsx` | Users pick and reorder catalog languages via a modal in the header |
| `src/app/FileFinder/FileFinderInstall.tsx` | **Already has language choice** — a modal with radio buttons letting the user pick which language's `.gme` to download before installing |
| `src/app/FileFinder/FileFinderProduct.tsx` | Shows a "Download" button (opens the install modal) for products that have a game file |
| `src/app/FileFinder/MyTiptoisProduct.tsx` | Shows installed books from IndexedDB with an "Install" button |
| `src/app/Pen/PenFile.tsx` | Lists `.gme` files on the pen with a delete button |
| `src/app/catalog/languages.ts` | `Locale` type + `LANGUAGES` array with `{ code, label, available }` |
| `src/app/storage/gmeFilesDB.ts` | `SavedProduct` stores `{ name, images, audioFile: { fileName, fileContent, url, version } }` |

### What is NOT done yet

1. **No language flag indicators** on the product preview images in `FileFinderProduct.tsx` or `MyTiptoisProduct.tsx`.
2. **No way to switch languages** on an already-installed book — the user can only install fresh, not swap.
3. `MyTiptoisProduct.tsx` still uses the old `SavedProduct` model (single language, no `MergedProduct` awareness).

### Key constraints

- The tiptoi player identifies a book by the `gameFile.id` (Product ID) burned into the `.gme` — this is identical across all languages. So swapping languages is just replacing the `.gme` file on the pen with a different language's version.
- The user's explicit preference: **HTTP over Telnet** for receiver communication (not relevant here, but noted).
- UI copy stays **English** (per existing convention).
- The project uses CSS Modules (`.module.css`), not Tailwind or styled-components.
- No existing flag/SVG icons in the project — will use CSS-based country code badges (e.g. `DE`, `NL`, `FR`) styled as compact badges, or Unicode region indicator symbols (`🇩🇪`, `🇳🇱`, etc.). Unicode flags are simpler and require no new assets.

## Architecture / proposed approach

All three changes touch a small, well-defined set of components. The approach:

1. **Language flags on preview images**: Add a `LanguageFlags` overlay component (CSS `position: absolute` on the image container) in both `FileFinderProduct.tsx` and `MyTiptoisProduct.tsx`. It renders one small badge per language in `merged.availableIn` — using Unicode region flag emojis for compactness and zero new assets.

2. **Language switching on installed books**: Extend `MyTiptoisProduct.tsx` to accept a `merged: MergedProduct` prop (in addition to the existing `SavedProduct`), detect which language is currently installed (by matching the `SavedProduct.audioFile.fileName` against all `merged.byLang[locale].gameFile.fileName` values), and show a "Switch language" button that opens a modal with radio buttons for the other available languages. The new language's `.gme` downloads fresh (same flow as `FileFinderInstall.tsx`), then writes to the pen, replacing the old file.

3. **Wire `MyTiptois.tsx` to use `MergedProduct`**: The "My Tiptois" screen currently only knows about locally-saved products (IndexedDB). To show flags and offer switching, it needs the merged cross-language context too. This means the product list in `MyTiptois.tsx` must resolve each installed product to its `MergedProduct` using `productByGmeFileName` from the catalog context.

### Decision: Unicode flags vs SVG flags

**Use Unicode region flag emojis** (e.g. `🇩🇪`, `🇳🇱`, `🇫🇷`, `🇮🇹`, `🇷🇺`, `🇬🇧`). Reasons:
- Zero new SVG assets to create or register.
- Render at text size, so they fit cleanly as tiny badges.
- Consistent across browsers (all modern browsers support them).
- The locale-to-flag mapping is just `code.slice(0,2).toUpperCase().replace(/_/g,'').match(/\p{Script_Extensions=Emoji}/u)` — or more simply, a hardcoded map since there are only 6 locales.

## Step-by-step tasks

### Task 1: Add Unicode flag helper to `languages.ts`

**File**: `src/app/catalog/languages.ts`

**What**: Add a `flagEmoji(locale: Locale): string` function and a `localeFlagMap` constant.

**Code** (append to the file):

```ts
/** Locale → Unicode region flag emoji. Only the 6 catalog locales are listed. */
const LOCALE_FLAG_MAP: Record<Locale, string> = {
  de_DE: '\uD83C\uDDE9\uD83C\uDDEA',  // 🇩🇪
  fr_FR: '\uD83C\uDDEB\uD83C\uDDF7',  // 🇫🇷
  nl_NL: '\uD83C\uDD33\uD83C\uDDF1',  // 🇳🇱
  it_IT: '\uD83C\uDDEE\uD83C\uDDF9',  // 🇮🇹
  ru_RU: '\uD83C\uDDF7\uD83C\uDDFA',  // 🇷🇺
  en_GB: '\uD83C\uDDEC\uD83C\uDDE7',  // 🇬🇧
};

export const flagEmoji = (locale: Locale): string =>
  LOCALE_FLAG_MAP[locale] || '';
```

**Verification**:
```bash
npx tsc --noEmit 2>&1 | grep -c "error"
# Expected: same count as before this change (0)
```

### Task 2: Language flag overlay component

**New file**: `src/app/FileFinder/LanguageFlags.tsx`

**What**: A small overlay component that renders flag emojis for an array of locales, positioned absolutely in the top-right corner of a container.

**Code**:

```tsx
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
```

**New file**: `src/app/FileFinder/LanguageFlags.module.css`

**Code**:

```css
.flags {
  position: absolute;
  top: 0.4rem;
  right: 0.4rem;
  display: flex;
  gap: 0.15rem;
  z-index: 2;
  background: rgba(0, 0, 0, 0.35);
  border-radius: 0.3rem;
  padding: 0.1rem 0.25rem;
}

.flag {
  font-size: 1rem;
  line-height: 1;
}
```

**Verification**:
```bash
npx tsc --noEmit 2>&1 | grep -c "error"
# Expected: 0 new errors
```

### Task 3: Add flags to `FileFinderProduct.tsx`

**File**: `src/app/FileFinder/FileFinderProduct.tsx`

**What**: Import `LanguageFlags` and render it as an overlay on the product image. The flags show `merged.availableIn` (the languages the book is available in, among the user's selected languages).

**Changes** (patch the imports and the JSX):

1. Add import near the top:
```tsx
import LanguageFlags from '@app/FileFinder/LanguageFlags.tsx';
```

2. In the JSX, wrap the `<img>` in a `relative` container and add the overlay:

**Before** (lines 59-66):
```tsx
{product.images.length !== 0 && (
  <img
    className={styles.img}
    src={product.images[product.images.length - 1].url}
    alt={product.name}
    loading="lazy"
  />
)}
```

**After**:
```tsx
{product.images.length !== 0 && (
  <div className={styles.imgWrapper}>
    <img
      className={styles.img}
      src={product.images[product.images.length - 1].url}
      alt={product.name}
      loading="lazy"
    />
    <LanguageFlags locales={languages} />
  </div>
)}
```

3. Add CSS to `FileFinderProduct.module.css` (append):

```css
.imgWrapper {
  position: relative;
}
```

**Verification**:
```bash
npx tsc --noEmit 2>&1 | grep -c "error"
# Expected: 0 new errors
```

### Task 4: Add language switching to `MyTiptoisProduct.tsx`

**File**: `src/app/FileFinder/MyTiptoisProduct.tsx`

**What**: This component currently only shows a single `SavedProduct` with an "Install" button. It needs to:
1. Accept an optional `merged: MergedProduct` prop (when available from the catalog context).
2. Detect which language is currently installed by matching the saved product's `audioFile.fileName` against all `merged.byLang[locale].gameFile.fileName` values.
3. Show a "Switch language" button (or "Change language") when the book has other language versions available.
4. Open a modal with radio buttons for the other available languages (reuse the same download+install flow as `FileFinderInstall.tsx`).

**Changes**:

1. Add imports:
```tsx
import { MergedProduct, useCatalog } from '@app/catalog/CatalogContext.tsx';
import { LANGUAGES, Locale, flagEmoji } from '@app/catalog/languages.ts';
import { ContentModal, FieldRadio, Button, ButtonGroup, Loader } from '@theme';
import { API_BASE } from '@utils/api/constants.ts';
import { writeFile } from '@utils/fileSystem.ts';
import { blobToString } from '@utils/functions.ts';
import { useGmeFileStore } from '@app/storage/StorageContext.tsx';
```

2. Update the component signature and add new state:

```tsx
const MyTiptoisProduct: React.FC<{
  className?: string;
  product: SavedProduct;
  merged?: MergedProduct;
}> = ({ className = '', product, merged }) => {
```

3. Add new state variables inside the component:
```tsx
const { setSelectedLanguages } = useCatalog();
const { setFile } = useGmeFileStore();
const [switching, setSwitching] = React.useState<boolean>(false);
const [switchLocale, setSwitchLocale] = React.useState<Locale | null>(null);
const [switchPending, setSwitchPending] = React.useState<boolean>(false);
const [switchDone, setSwitchDone] = React.useState<boolean>(false);
const [switchDownloaded, setSwitchDownloaded] = React.useState<Blob | null>(null);
```

4. Detect the currently installed language:
```tsx
const installedLocale = React.useMemo<Locale | null>(() => {
  if (!merged || !product.audioFile?.fileName) return null;
  const installedName = product.audioFile.fileName;
  for (const locale of merged.availableIn) {
    const gf = merged.byLang[locale]?.gameFile;
    if (gf && gf.fileName === installedName) return locale;
  }
  return null;
}, [merged, product.audioFile?.fileName]);
```

5. The download+install flow for switching (similar to `FileFinderInstall.tsx`):
```tsx
const switchRequestIdRef = React.useRef(0);

const downloadSwitchFile = React.useCallback(
  async (file: GameFile, prod: Product) => {
    const requestId = ++switchRequestIdRef.current;
    setSwitchDownloaded(null);
    setSwitchDone(false);
    setSwitchPending(true);
    try {
      const res = await fetch(
        `${API_BASE}getFile.php?url=${encodeURI(file.url)}`
      );
      const blob = await res.blob();
      if (switchRequestIdRef.current !== requestId) return;
      await setFile(prod.id, {
        name: prod.name,
        images: prod.images,
        audioFile: {
          fileName: file.fileName,
          fileContent: blobToString(blob), // note: will need async blobToString
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
```

6. The switch modal (render when `switchLocale` is set):
```tsx
{switchLocale && merged && (
  <ContentModal
    title={`Switch to ${LANGUAGES.find(l => l.code === switchLocale)?.label}`}
    onClose={() => { setSwitchLocale(null); setSwitchDownloaded(null); }}
    full={false}
    preventClose={switchPending}
  >
    <div>
      {switchDone ? (
        <p>Language switched successfully. You can now close the app and disconnect the pen.</p>
      ) : (
        <React.Fragment>
          <p>Please wait while we download the new language file.</p>
          <ButtonGroup align="center">
            <span>
              <Button
                onClick={() => {
                  const entry = merged.byLang[switchLocale!];
                  if (entry?.gameFile) {
                    downloadSwitchFile(entry.gameFile, entry.product);
                  }
                }}
                icon="save"
                loading={switchPending}
                disabled={!switchDownloaded || !dirHandle}
              >
                Install
              </Button>
            </span>
          </ButtonGroup>
        </React.Fragment>
      )}
    </div>
  </ContentModal>
)}
```

7. Add the "Switch language" button next to the existing install button (only when `merged` is provided and there are other language options):
```tsx
{merged && merged.availableIn.length > 1 && (
  <Button
    className={styles.switchLang}
    icon="download"
    size="small"
    onClick={() => {
      // Pick the first non-installed language
      const other = merged.availableIn.find(l => l !== installedLocale);
      if (other) setSwitchLocale(other);
    }}
    disabled={switching || !dirHandle}
  >
    {installedLocale
      ? `Switch (${LANGUAGES.find(l => l.code === installedLocale)?.label})`
      : 'Switch language'}
  </Button>
)}
```

8. Add CSS to `MyTiptoisProduct.module.css`:
```css
.switchLang {
  align-self: center;
  display: inline-block;
}
```

### Task 5: Wire `MyTiptois.tsx` to pass `merged` to each product

**File**: `src/app/FileFinder/MyTiptois.tsx`

**What**: The `MyTiptois` component currently renders `MyTiptoisProduct` with only the `product` prop. It needs to also look up each product's `MergedProduct` from the catalog context (via `productByGmeFileName`) and pass it as the `merged` prop.

**Changes**:

1. Add imports:
```tsx
import { useCatalog } from '@app/catalog/CatalogContext.tsx';
```

2. In the component, get the merged index:
```tsx
const { mergedProducts, productByGmeFileName } = useCatalog();
```

3. When rendering each product, look up its merged entry:
```tsx
{products.map((savedProduct) => {
  // Try to find a MergedProduct by matching the saved product's audioFile fileName
  // against the game file names in the merged index
  const mergedEntry = React.useMemo(() => {
    if (!savedProduct.audioFile?.fileName) return undefined;
    const bucket = productByGmeFileName[savedProduct.audioFile.fileName];
    if (!bucket || bucket.length === 0) return undefined;
    // Return the first match (primary language first)
    return bucket[0];
  }, [savedProduct.audioFile?.fileName, productByGmeFileName]);

  return (
    <MyTiptoisProduct
      product={savedProduct}
      merged={mergedEntry}
      key={savedProduct.name}
    />
  );
})}
```

### Task 6: Add flags to `MyTiptoisProduct.tsx` (installed books)

**File**: `src/app/FileFinder/MyTiptoisProduct.tsx`

**What**: Same as Task 3 but for the "My Tiptois" screen. When `merged` is provided, show the language flags overlay.

**Changes**:

1. Import `LanguageFlags`:
```tsx
import LanguageFlags from '@app/FileFinder/LanguageFlags.tsx';
```

2. Wrap the image in a relative container and add the overlay (same pattern as Task 3):
```tsx
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
```

3. Add CSS to `MyTiptoisProduct.module.css`:
```css
.imgWrapper {
  position: relative;
}
```

### Task 7: Verification — build and lint

**Command**:
```bash
npx tsc --noEmit 2>&1
npm run lint 2>&1
```

**Expected**: Both pass with zero errors and zero warnings. If there are pre-existing lint errors (from the original codebase), they should not have been introduced by this feature.

## Risks, tradeoffs, and open questions

### Risks

1. **Race condition on language switch**: When switching languages, the old `.gme` file is on the pen and the new one is being downloaded. If the user disconnects the pen mid-download, the old file remains (safe, but the switch is incomplete). The `preventClose={pending}` on the modal prevents accidental closure during download/install.

2. **`SavedProduct.audioFile.fileContent` is a `[base64Content, mimeType]` tuple** — the `downloadSwitchFile` callback uses `blobToString(blob)` which returns a string, not a tuple. Need to verify the exact type expected by `setFile` and convert accordingly. Looking at `gmeFilesDB.ts`, `SavedProduct.audioFile.fileContent` is `[base64Content, mimeType]` where `base64Content = string` and `mimeType = string`. The `FileFinderInstall.tsx` already handles this by passing `text` (a string) directly — so the tuple type must accept a plain string too. Double-check the type in `types.ts` / `gmeFilesDB.ts`.

3. **`productByGmeFileName` resolution is imperfect**: The current implementation registers both the URL basename and the raw `fileName`. If a product has multiple game files with the same basename across languages, the lookup could return the wrong merged entry. Mitigation: the lookup returns the first match (primary language first), which is the best guess. The `MergedProduct` type already documents this limitation.

### Tradeoffs

1. **Unicode flags vs SVG flags**: Unicode flags are simpler (no new assets) but can render inconsistently across OS/browser (some show a black silhouette, some a colored flag). SVG flags would be pixel-perfect but require creating 6 new SVG files and registering them in the icon system. Given the small number of locales and the fact this is a utility indicator (not the primary visual), Unicode is the pragmatic choice.

2. **Downloading on switch vs storing in IndexedDB**: The current design re-downloads the `.gme` file from the server when switching languages. This means:
   - **Pro**: Always gets the latest version; no storage bloat from keeping multiple language copies in IndexedDB.
   - **Con**: Requires an internet connection for every switch; slower UX than a local lookup.
   - **Alternative considered**: Store all language versions of a book in IndexedDB after the first download. This would require a schema change (`SavedProduct` → `SavedProductMultiLang`) and is significantly more complex. Defer to a future iteration if performance becomes a concern.

3. **"Switch language" button placement**: Currently planned next to the existing "Install" button. Alternative: put it in a dropdown/menu on hover. The simple button approach is more discoverable (no hidden UI) and fits the existing pattern of the "Download" button in `FileFinderProduct.tsx`.

### Open questions

1. **Should the "Switch language" button show the currently installed language as a label?** (e.g. "Switch (German → French)"). This adds clarity but also complexity. Initial version: show the current language in the button text (`Switch (German)`), user picks the new language in the modal.

2. **What happens to the `SavedProduct` in IndexedDB when switching languages?** The current `setFile` call overwrites the existing entry with the new language's data. This is correct — the IndexedDB entry represents "the installed version of this book", which is now the new language. The old language version is simply replaced.

3. **Should there be a visual indicator on the "My Tiptois" screen showing which language is installed?** The button text (`Switch (German)`) is one approach. An alternative is a small language badge next to the book title. Defer to the button text for now; can add a title badge later.
