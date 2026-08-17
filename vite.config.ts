import { fileURLToPath, URL } from 'node:url'

import { defineConfig, lazyPlugins } from 'vite-plus'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'

// CodeBuddy (VSCode core) terminal injects VSCODE_CWD, which makes unocss
// preset-icons' getEnvFlags() misdetect a VSCode environment and skip the local
// node-loader (falling back to a CDN loader that fails offline). Clear this
// variable before build/dev so icons load from local node_modules.
delete process.env.VSCODE_CWD

// https://vite.dev/config/
export default defineConfig({
  staged: {
    // public/vditor is third-party static assets (incl. non-standard JS data
    // files like mathjax); its formatting/checking is maintained by the
    // copy-vditor script and excluded from lint-staged.
    // Use a negated glob only: in lint-staged, '*' still matches public/** and
    // would trigger formatting failures.
    '!public/**': 'vp check --fix',
  },
  fmt: {
    semi: false,
    singleQuote: true,
  },
  lint: {
    plugins: ['eslint', 'typescript', 'unicorn', 'oxc', 'vue'],
    categories: {
      correctness: 'error',
    },
    env: {
      browser: true,
      builtin: true,
    },
    ignorePatterns: ['**/dist/**', '**/dist-ssr/**', '**/coverage/**', '**/public/**'],
    rules: {
      'no-array-constructor': 'error',
      'typescript/ban-ts-comment': 'error',
      'typescript/no-empty-object-type': 'error',
      'typescript/no-explicit-any': 'error',
      'typescript/no-namespace': 'error',
      'typescript/no-require-imports': 'error',
      'typescript/no-unnecessary-type-constraint': 'error',
      'typescript/no-unsafe-function-type': 'error',
      'vite-plus/prefer-vite-plus-imports': 'error',
    },
    overrides: [
      {
        files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts', '**/*.vue'],
        rules: {
          'constructor-super': 'off',
          'getter-return': 'off',
          'no-class-assign': 'off',
          'no-const-assign': 'off',
          'no-dupe-class-members': 'off',
          'no-dupe-keys': 'off',
          'no-func-assign': 'off',
          'no-import-assign': 'off',
          'no-new-native-nonconstructor': 'off',
          'no-obj-calls': 'off',
          'no-redeclare': 'off',
          'no-setter-return': 'off',
          'no-this-before-super': 'off',
          'no-undef': 'off',
          'no-unreachable': 'off',
          'no-unsafe-negation': 'off',
          'no-var': 'error',
          'no-with': 'off',
          'prefer-const': 'error',
          'prefer-rest-params': 'error',
          'prefer-spread': 'error',
        },
      },
    ],
    options: {
      typeAware: true,
      typeCheck: true,
    },
    jsPlugins: [
      {
        name: 'vite-plus',
        specifier: 'vite-plus/oxlint-plugin',
      },
    ],
  },
  // Deployed to GitHub Pages under the /kanban/ subpath
  base: '/kanban/',
  // dist/vditor contains many static assets; emptying outDir would trigger the
  // local bulk-delete safety guard (the codebuddy host forces
  // CODEBUG_TOOL_CALL_ID into every command), so skip emptying to avoid
  // blocking the build.
  build: {
    emptyOutDir: false,
  },
  plugins: lazyPlugins(() => [UnoCSS(), vue()]),
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
