import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Flat config, required from ESLint 9 onwards. Kept as `.mjs` for
// explicitness: package.json declares `"type": "module"` (the one CommonJS
// script in the repo was renamed to `generate.cjs` when that landed, so a
// plain `.js` name here is unambiguous) — but `.mjs` states the module
// format without relying on the package.json setting.
export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'public/sw.js', '.worktrees'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // `configs.recommended` is still the legacy eslintrc shape; the flat
  // versions live one level down under `configs.flat`.
  reactHooks.configs.flat.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: { 'react-refresh': reactRefresh },
    rules: {
      // Carried over verbatim from the previous .eslintrc.cjs.
      'react-refresh/only-export-components': 0,
      '@typescript-eslint/ban-ts-comment': 0,
      '@typescript-eslint/no-explicit-any': 0,

      // `cond && doThing()` as a statement is used consistently throughout
      // this codebase. typescript-eslint 8 added no-unused-expressions to its
      // recommended set; allow the short-circuit form rather than rewriting
      // every call site, while still catching genuinely dead expressions.
      '@typescript-eslint/no-unused-expressions': [
        'error',
        { allowShortCircuit: true, allowTernary: true },
      ],

      // The React Compiler rules that eslint-plugin-react-hooks 7 bundles are
      // ON. They were switched off wholesale during the ESLint 10 upgrade
      // (8a26e9d) because they reported 11 findings at once; those have since
      // been worked through. Three were fixed outright, and the rest carry
      // per-site eslint-disable comments explaining why the existing code is
      // deliberate. Leaving the rules enabled is the point: new violations get
      // caught, rather than hiding behind a blanket off switch.
    },
  },
  {
    // Node scripts and config files, not browser code.
    files: ['*.config.{js,ts,mjs,cjs}', 'src/theme/SVG/generate.cjs'],
    languageOptions: { globals: globals.node },
    rules: {
      // generate.cjs is a CommonJS script run by node directly, not bundled.
      '@typescript-eslint/no-require-imports': 0,
    },
  }
);
