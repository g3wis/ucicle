module.exports = {
  env: {
    browser: true,
    es2021: true,
  },
  root: true,
  extends: [
    'plugin:react/recommended',
    'airbnb-base',
    'airbnb-typescript',
    'plugin:compat/recommended',
    'plugin:jsx-a11y/recommended',
    // à décommenter pour voir l'usage des fonctions un peu exotiques
    // => par contre on ne peut pas laisser ce plugin tout le temps
    // => car il ne tient ni compte des polyfill, ni des navigateurs configurés dans browserslist
    // 'plugin:typescript-compat/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 12,
    sourceType: 'module',
    project: './tsconfig.eslint.json'
  },
  plugins: [
    'react',
    '@typescript-eslint'
  ],
  settings: {
    react: {
      version: "detect",
    },
    polyfills: [
      'AbortController',
      'PromiseConstructor.allSettled',
      // these methods are not present in IE 11, but this browser is not supported, so we consider them polyfilled
      'Promise.catch',
      'Promise.then',
      'Promise.finally',
      'PromiseConstructor.resolve',
      'String.startsWith',
      'Array.includes',
      'ArrayConstructor.from',
      'ObjectConstructor.values',
      'Map.values',
      'Map.keys',
    ]
  },
  rules: {
    'linebreak-style': 'off',
    // SQL is written in tagged templates: a query line is never cut to fit.
    'max-len': ['error', { code: 120, ignoreTemplateLiterals: true }],
    'react/require-default-props': 0,
    'import/no-absolute-path': 'off',
    'function-paren-newline': 'off',
    'no-restricted-syntax': [
      'error',
      {
        selector: 'ForInStatement',
        message: 'for..in loops iterate over the entire prototype chain, which is virtually never what you want. Use Object.{keys,values,entries}, and iterate over the resulting array.',
      },
      {
        selector: 'LabeledStatement',
        message: 'Labels are a form of GOTO; using them makes code confusing and hard to maintain and understand.',
      },
      {
        selector: 'WithStatement',
        message: '`with` is disallowed in strict mode because it makes code impossible to predict and optimize.',
      },
    ],
    // Named exports keep content and helper modules greppable and tree-shakable.
    'import/prefer-default-export': 'off',
    '@typescript-eslint/ban-ts-comment': 'error',
    '@typescript-eslint/no-explicit-any': 2,
    '@typescript-eslint/no-use-before-define': ['error', {
      'functions': false,
    }],
  },
  overrides: [
    {
      // Content files hold the site's sentences: a sentence is never cut to fit a line.
      files: ['src/content/**/*.ts'],
      rules: {
        'max-len': ['error', { code: 120, ignoreStrings: true, ignoreTemplateLiterals: true }],
        // French typography: no-break spaces inside « » and before : ; ! ? in sentences.
        'no-irregular-whitespace': ['error', { skipStrings: true, skipTemplates: true }],
      },
    },
  ],
};
