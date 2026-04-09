// @ts-check
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import importX from 'eslint-plugin-import-x';
import packageJsonPlugin from 'eslint-plugin-package-json';

/**
 * @see https://eslint.org/docs/latest/use/configure/configuration-files
 */
export default defineConfig([
  // Global ignores
  {
    ignores: [
      'dist/',
      'node_modules/',
      'src/frontend/',
      'coverage/',
      'eslint.config.mjs',
    ],
  },

  // TypeScript configuration
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ['**/*.{ts,tsx}'],
  })),
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },

  // Package.json configuration
  {
    ...packageJsonPlugin.configs.recommended,
    rules: {
      ...packageJsonPlugin.configs.recommended.rules,
      'package-json/require-type': 'off',
    },
  },
]);
