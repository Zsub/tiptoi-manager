import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Flat config, required from ESLint 9 onwards. Kept as `.mjs` rather than
// `.js` deliberately: package.json has no `"type": "module"` (adding one would
// break src/theme/SVG/generate.cjs's siblings), and `.mjs` lets this
// file use ESM without that.
export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'public/sw.js'] },
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

      // eslint-plugin-react-hooks 7 bundles the React Compiler rule set, which
      // is far stricter than the rules-of-hooks/exhaustive-deps pair this
      // project was linting against under v4. It reports 11 real findings
      // across the context providers and Tooltip. Those are behavioural fixes
      // that deserve their own change with their own verification, not a
      // ride-along in a dependency bump - so they stay off here and are
      // tracked separately.
      'react-hooks/set-state-in-effect': 0,
      'react-hooks/refs': 0,
      'react-hooks/immutability': 0,
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
