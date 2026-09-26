import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

const dexieOnlyInStore = {
  paths: [
    { name: 'dexie', message: 'Only src/store/ may import Dexie (PRD §7).' },
    { name: 'dexie-react-hooks', message: 'Only src/store/ may import Dexie (PRD §7).' },
  ],
};

export default defineConfig(
  { ignores: ['dist', 'coverage'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2022, globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'no-restricted-imports': ['error', dexieOnlyInStore],
    },
  },
  {
    files: ['src/store/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': 'off' },
  },
);
