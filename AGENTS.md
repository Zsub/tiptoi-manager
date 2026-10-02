# AGENTS.md

Tiptoi Manager — a PWA for browsing and downloading Ravensburger Tiptoi
audio content (`.gme`) and installing it onto a Tiptoi pen connected as USB
mass storage. React 19 + Vite 8, CSS Modules, react-intl, idb.

## Platform constraints

### File System Access API — not available in (most) mobile browsers

The pen integration (connecting a pen folder, reading `.gme` files,
writing/deleting files) depends on the **File System Access API**:
`window.showDirectoryPicker()`, `FileSystemDirectoryHandle.values()`,
`getFileHandle()`, `createWritable()`, `removeEntry()` — see
`src/utils/fileSystem.ts`.

This API is **Chromium-only** and is **not available in mobile browsers**
such as iOS Safari or Firefox. Consequences to respect when working on this
repo:

- `src/App.tsx` feature-detects with `'showDirectoryPicker' in window` and
  replaces the **entire** main area (catalog included) with a
  `support.warning` notification in unsupported browsers. Don't rely on the
  pen pane or on that branch rendering in mobile/Safari/Firefox tests.
- Keep new file I/O in the `src/utils/fileSystem.ts` helpers and behind the
  same feature-detection gate, with a graceful fallback — never call raw
  File System Access APIs from components that may run in unsupported
  browsers.
- When testing, the supported target is a desktop Chromium browser
  (Chrome/Edge).

## Verification

- `npm run lint` runs with `--max-warnings 0` — keep it at zero warnings.
  Every `eslint-disable` must carry an inline `-- rationale`; the run uses
  `--report-unused-disable-directives`, so a stale exemption fails the lint.
- `npm run build` is `tsc && vite build`.
- The catalog API (`ttapiv2.ravensburger.com`) is typically unreachable from
  agent environments. Do **not** rewrite catalog/storage state logic that you
  cannot exercise — document the exemption with a comment instead (established
  decision, commit a984e65).
- Verify user-facing changes in a real desktop Chromium browser, not just
  type-checks.

## Multi-language catalog — invariants that are easy to break

Read `MULTILANG_WORKFLOW.md` before touching catalog code.

- The catalog API (`getCatalog.php?language={locale}`) accepts exactly six
  full locale codes. A bare or unknown code (e.g. `nl`) answers **HTTP 200
  with an empty body** — a silent failure, not a 404. Always validate with
  `isAvailableLocale` (`src/app/catalog/languages.ts`).
- `product.id` is language-specific. `gameFile.id` is the only cross-language
  key (the tiptoi Product ID burned into the `.gme`), but it behaves as a
  *family* id — one id can map to many products. Products are cross-merged
  (`MergedProduct`) only when the id resolves to exactly one product in every
  loaded locale.
- `MergedProduct.key` is **not stable across loads** (an entry can split once
  the locale that proves a collision arrives). Never persist it or use it as
  a cross-session identifier.
- `en_GB` is a legitimate API locale whose catalog is empty (200, zero bytes);
  it is gated by `available: false` in the UI and deliberately kept in the
  `Locale` union.
- The UI language (cookie, `src/intl/`) is separate from the catalog
  languages (localStorage `catalog-languages`; list order = primary-language
  precedence for titles/images).

## PHP API proxy (`api/`)

- Local: `npm run serve-php` (`php -S localhost:8000 -t api`); the production
  default is `https://tiptoi-manager.nico.dev/api/`; `VITE_API_BASE` overrides
  it (see `.env.example`).
- CORS is a **hardcoded origin allow-list** in each `.php` file
  (`https://localhost:4541`, `https://localhost:5173`, nico.dev). A default
  `npm run dev` (http, port 3000) is **not** CORS-allowed — local app + proxy
  needs the HTTPS dev server on 4541 (`SSL_KEY`/`SSL_CRT` in `.env`). The
  working combos are in `.claude/launch.json`.
- PHP 8.5 deprecation notices print *into the JSON body* under `php -S`
  (display_errors) and break every catalog parse — keep proxy output clean.
- `.gme` files run past 60 MB, so the proxy must stream them (`fpassthru`, no
  buffering). `ravensburger.cloud` 403s requests without a User-Agent; the URL
  allow-list accepts both `ravensburger.cloud` and `cdn.ravensburger.cloud`.
- ⚠️ `getCatalog.php` and `getToken.php` contain a **hardcoded OAuth client
  credential** for the Ravensburger API — never echo it in output, diffs, or
  logs.

## IndexedDB storage

- DB `tiptoi-manager` v2, stores `gme-files` + `catalog`
  (`src/app/storage/db.ts`). The guarded/idempotent `upgrade()` and the
  `blocked`/`blocking` handlers are load-bearing: a second tab still holding
  v1 open otherwise makes `openDB` never settle — `dbPromise` hangs forever
  and every catalog/file read silently stalls.
- Downloaded `.gme` files are stored base64 in IndexedDB; the Persistent
  Storage API (`navigator.storage`) drives the storage meter.

## Build tooling

- `src/theme/SVG/icons.ts` is **generated** by `src/theme/SVG/generate.cjs`.
  Add the SVG to `src/theme/SVG/icons/` and rerun the script — never
  hand-edit `icons.ts`.
- The `vite-plugin-svgr` config in `vite.config.ts`
  (`include: '**/*.svg'`, `exportType: 'default'`) is load-bearing. If it
  regresses, every icon silently renders as a data-URI string and React
  throws at runtime — nothing static catches it (`declare module '*.svg'` in
  `src/@types/global.d.ts` keeps tsc and ESLint green).
- `src/@types/global.d.ts` hand-declares `ImportMeta.env` on purpose. Do not
  add `vite/client` types — they re-type every `*.svg` import as a URL string
  and break the svgr setup.
- The package is ESM (`"type": "module"`). Node-only scripts are `.cjs`
  (e.g. `generate.cjs`); the ESLint flat config is `.mjs`.
- Prettier import order is enforced: `styles.css` → third-party → `@theme` →
  `@app/*` → `@utils/*` → `@store/*` → relative.
- Path aliases `@app/*`, `@utils/*`, `@theme` come from tsconfig `paths`
  (Vite 8 resolves them natively — there is no vite-tsconfig-paths plugin).
- PWA icons are committed under `public/fav/`; `@vite-pwa/assets-generator` is
  intentionally *not* a dependency (24 MB of sharp) — regenerate on demand
  with `npm run generate-pwa-assets` (npx).

## i18n

- UI copy is English via react-intl; user-facing strings go through
  `formatMessage`, not hardcoded literals.
- New message ids must be added to **all three** files in `src/intl/`
  (`en.json`, `de.json`, `fr.json`).
- Open debt: `de.json` has 0 keys (en 24, fr 15) — the German UI currently
  renders raw message ids.
- Open debt: a few user-facing strings are still hardcoded English instead of
  message ids ("Available in", "Any language", "Download", "Installed",
  "No products match your search.").

## App structure

- `index.html` must keep both the `#app` and `#shadowbox` divs —
  `#shadowbox` is the portal target for every modal and `PortalBox`
  dereferences it unguarded by design.
- Provider nesting in `App.tsx` (Intl → Storage → Catalog → Files →
  MyTiptois) is dependency-ordered; don't reorder casually.
- A pen folder is only accepted if it contains `tiptoi.ico`.

## Working conventions

- Commits are small, logically coherent, with rationale-heavy messages.
- Parallel feature work runs in git worktrees under `.worktrees/`
  (gitignored and excluded from lint); the multi-language feature's
  implement → review → commit pipeline with disjoint file ownership is
  documented in `MULTILANG_WORKFLOW.md`.
