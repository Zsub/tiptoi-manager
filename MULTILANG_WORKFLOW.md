# Multi-language tiptoi-manager — implementation workflow

Goal: UI stays **English**; the user picks which **catalog languages** to download; search works
across every downloaded language; `.gme` download offers a language choice; the list can be filtered
by availability in a given language.

## The key insight (from reversing the official manager)

- The catalog `product.id` is **language-specific** — DE and NL product-id ranges are fully disjoint
  (0 overlap between 342 DE and 77 NL products).
- The stable cross-language key is **`gameFile.id`**, which `tttool` confirms *is* the tiptoi
  **Product ID** burned into the `.gme`.
- Verified with tttool on game id 64: DE and NL `.gme` files share Product ID, OID range
  (3300–10300), disabled-OID set, register model and audio-table size. Only the audio and the
  language tag differ → **a German book will play Dutch audio**.
- Valid locales: `de_DE fr_FR nl_NL it_IT ru_RU en_GB`. A bare code such as `nl` returns
  **HTTP 200 with an empty body** (not a 404), which is why the earlier Dutch attempt looked broken.

⇒ Everything in this feature is built on a **merged index keyed by `gameFile.id`**.

---

## Pipeline

Each task: **implement → review (different agent) → commit (different agent)**. Models are chosen per
task complexity. Commits stay small but logically coherent.

Integration branch: `feat/multi-language` (off `main` @ `f2a667e`).

### Task F — Foundation (serial, main worktree, model: opus)
Must land first: the tree currently **does not compile**, and the uncommitted work-in-progress lives
in the main worktree (worktrees branch from commits, so this cannot be parallelised).

1. **Fix the broken build** — 6 TS errors, incl. the deleted `export default HeaderNav`,
   `setCatalogLanguage` missing from the context type, and the `Catalog` typing in `gmeFilesDB.ts`.
2. **Fix the locale bug** — `nl` → `nl_NL`; validate against the 6 known locales.
3. **Fix the IndexedDB v1→v2 migration** — `upgrade()` unconditionally re-creates
   `IDB_STORE_FILES`, which throws for existing users.
4. **Language model** — `LANGUAGES` constant (6 locales, English display names) + types.
5. **Multi-catalog fetching** — fetch/cache one catalog per selected language, per-language state.
6. **Merged index** — `Map<gameFileId, { byLang: Record<locale, {product, gameFile}> }>`; expose the
   new context API that Tasks A/B/C consume.

→ review (opus) → commit (haiku), ~3 small commits.

### Tasks A/B/C — parallel, each in its own git worktree (model: sonnet)
Branch from `feat/multi-language` **after Task F lands**. File ownership is disjoint by design so the
three can run concurrently without conflicts.

| Task | Scope | Owns |
|---|---|---|
| **A** | Sortable multi-select of catalog languages; order defines the *primary* language used for titles/images; persisted | `HeaderNav.tsx` + new `LanguageSelect` component/CSS |
| **B** | Search matches a title in **any** downloaded language; filter by availability in a chosen language | `FileFinder.tsx`, `FileFinderForm.tsx` + CSS |
| **C** | Download-time language choice (only languages where that `gameFile.id` exists) | `FileFinderProduct.tsx`, `FileFinderInstall.tsx` + CSS |

→ each reviewed (sonnet) → committed (haiku) on its own branch → merged back into
`feat/multi-language`.

---

## Context API contract (Task F publishes, A/B/C consume)

Agreed up front so the parallel tasks can code against a stable surface:

```ts
type Locale = 'de_DE' | 'fr_FR' | 'nl_NL' | 'it_IT' | 'ru_RU' | 'en_GB';

interface LocalisedEntry { product: Product; gameFile: GameFile; locale: Locale; }

interface MergedProduct {
  gameFileId: string;                        // the tiptoi Product ID — the cross-language key
  byLang: Partial<Record<Locale, LocalisedEntry>>;
  primary: LocalisedEntry;                   // entry for the first selected language that has it
  availableIn: Locale[];                     // which languages offer this title
  allNames: string[];                        // every localised title — powers cross-language search
}

useCatalog(): {
  selectedLanguages: Locale[];               // ordered; [0] is primary
  setSelectedLanguages(l: Locale[]): void;
  stateByLang: Record<Locale, STATE>;
  mergedProducts: MergedProduct[];
  productCategories: string[];
  gmeFilesIndices: Record<string, number>;   // preserved for existing callers
}
```

### Task L — Lint debt cleanup (queued: runs AFTER A/B/C merge, model: sonnet)
`npm run lint` was **already red at `main`** — 26 problems (19 errors, 7 warnings), none introduced by
this feature. Cleaned up as its own pass so the feature commits stay reviewable.

**Deliberately sequenced last, not parallel with A/B/C.** Most of the debt is `Function`-as-a-type on
theme component props (`Button`, `FieldSelect`, `FieldCheckbox`, `FieldInput`, `FieldRadio`,
`ShadowBox`, `PortalBox`, `ContentModal`, `CloseButton`). Tightening those signatures while three
agents are concurrently writing new call-sites against them would surface as type errors at merge
time, in a worktree nobody owns. Cheaper to land once the consumers exist.

Scope (14 files):
| Finding | Count | Files |
|---|---|---|
| `Don't use Function as a type` | 8 | `src/theme/**` (Button, CloseButton, ContentModal, FieldInput, FieldRadio, FieldSelect, PortalBox, ShadowBox) |
| `no-async-promise-executor` | 4 | `src/utils/fileSystem.ts` — real bug class: rejections thrown after `await` are swallowed |
| `react-hooks/exhaustive-deps` | 6 | `Tooltip.tsx` (4, incl. two ref-in-cleanup), `Pen.tsx`, `MyTiptoisContext.tsx` |
| unused vars | 2 | `Button.tsx` (`fontWeight`), `FieldCheckbox.tsx` (`type`) |
| unused import | 1 | `vite.config.ts` (`fs`) |

Plus, safe to include because L runs after every feature branch has merged:
- `catalog/types.ts` — `Array<Object>` on `bestsellers` (these are product-id strings → `Array<string>`)

One finding is **folded into the owning task instead**, since that file is actively rewritten there:
- `FileFinderInstall.tsx` — 2 × `no-extra-boolean-cast` + 1 missing-deps warning → **Task C**

`fileSystem.ts` is the only item with behavioural risk (it backs pen writes) — treat it as the
careful part of the pass and keep the promise semantics identical.

## Rules for every agent
- UI copy stays **English**; do not add translations for new UI.
- `npx tsc --noEmit` and `npm run lint` must pass before hand-off.
- Do not reformat untouched code; match existing style (prettier config in `package.json`).
- Do not commit `API.md` / `explore_api.js` (untracked research scratch).
- Never weaken the locale allow-list — a bare `nl` silently yields an empty catalog.
