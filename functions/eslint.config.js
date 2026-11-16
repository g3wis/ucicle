import comments from '@eslint-community/eslint-plugin-eslint-comments/configs';
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import importX from 'eslint-plugin-import-x';
import tseslint from 'typescript-eslint';

export default defineConfig(
    { ignores: ['build/'] },
    js.configs.recommended,
    comments.recommended,
    tseslint.configs.recommended,
    importX.flatConfigs.typescript,
    {
        // Replaces eslint-comments/no-unused-disable, which ESLint now handles natively.
        linterOptions: { reportUnusedDisableDirectives: 'error' },
    },
    {
        files: ['**/*.ts'],
        languageOptions: {
            parserOptions: {
                project: './tsconfig.json',
                tsconfigRootDir: import.meta.dirname,
            },
        },
        settings: {
            // Resolve imports with Node's algorithm, as eslint-plugin-import's "typescript" preset did.
            'import-x/resolver-next': [importX.createNodeResolver()],
        },
        rules: {
            'semi': 'error',
            'eol-last': 'error',
            'quotes': ['error', 'single'],
            'object-curly-spacing': ['error', 'always'],
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            '@eslint-community/eslint-comments/disable-enable-pair': [
                'error',
                { allowWholeFile: true },
            ],
            'import-x/order': [
                'error',
                { 'newlines-between': 'always', alphabetize: { order: 'asc' } },
            ],
            'sort-imports': [
                'error',
                { ignoreDeclarationSort: true, ignoreCase: true },
            ],
        },
    },
);
