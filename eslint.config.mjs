// npm run lint (AUDITORIA.md REPO-01). Only rules that catch real bugs, no style rules: the game ships as classic
// scripts, so a typo, a variable used before its line runs or a local that hides the i18n helper `t` reaches players
// as a TypeError on one screen (FLT-01, SURF-01 and GAME-01 broke every mission in one commit).
import globals from 'globals';

// astro/no-shadow-t: a `t` declared where an outer scope already has one (the i18n helper). Core no-shadow would
// flag every name; only `t` has bitten us, and a `t` in a file without the helper is harmless.
const astro = {
  rules: {
    'no-shadow-t': {
      meta: { type: 'problem', schema: [], messages: { shadow: 'This "t" hides the outer t() (the i18n helper, line {{line}}): name it task, tSec, terrain...' } },
      create: context => ({
        'Program:exit'() {
          for (const scope of context.sourceCode.scopeManager.scopes) {
            const inner = scope.set.get('t');
            if (!inner?.defs.length) continue;
            for (let up = scope.upper; up; up = up.upper) {
              const outer = up.set.get('t');
              if (!outer?.defs.length) continue;
              context.report({ node: inner.defs[0].name, messageId: 'shadow', data: { line: outer.defs[0].name.loc.start.line } });
              break;
            }
          }
        },
      }),
    },
  },
};

const BUG_RULES = {
  'no-undef': 'error',
  'no-unused-private-class-members': 'error',
  'no-dupe-keys': 'error',
  'no-dupe-args': 'error',
  'no-dupe-else-if': 'error',
  'no-duplicate-case': 'error',
  'no-const-assign': 'error',
  'no-func-assign': 'error',
  'no-import-assign': 'error',
  'no-redeclare': 'error',
  'no-self-assign': 'error',
  'no-unreachable': 'error',
  'no-unsafe-finally': 'error',
  'no-unsafe-negation': 'error',
  'no-invalid-regexp': 'error',
  'no-compare-neg-zero': 'error',
  'use-isnan': 'error',
  'valid-typeof': 'error',
  'no-setter-return': 'error',
  'no-sparse-arrays': 'error',
  'getter-return': 'error',
  'for-direction': 'error',
  // A let/const read above its declaration in the same scope throws (temporal dead zone): FLT-01.
  'no-use-before-define': ['error', { functions: false, classes: false, variables: false }],
};

export default [
  { ignores: ['**/node_modules/**', 'index.models.js', 'index.terrain.*.js', 'assets/**', 'references/**'] },
  // The page: classic scripts that share window.ASTRO_* objects (index.html loads them in order).
  {
    files: ['web/**/*.js', 'multiplayer/client/**/*.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'script',
      globals: { ...globals.browser, i18next: 'readonly', RoomClient: 'readonly' },
    },
    plugins: { astro },
    rules: { ...BUG_RULES, 'astro/no-shadow-t': 'error' },
  },
  // Tools and the room server: Node ES modules.
  {
    files: ['**/*.mjs'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: { ...globals.node } },
    rules: BUG_RULES,
  },
  // Tools that run code inside a page (headless audits): their callbacks see browser globals too.
  {
    files: ['tools/web/**/*.mjs', 'tools/model-viewer/**/*.mjs', 'tools/modeling/portraits/**/*.mjs'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
];
