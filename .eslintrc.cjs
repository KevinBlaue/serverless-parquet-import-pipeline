module.exports = {
  root: true,
  env: {
    es2022: true,
    node: true,
  },
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'script',
  },
  extends: ['eslint:recommended', 'prettier'],
  ignorePatterns: ['**/.turbo/', '**/cdk.out/', '**/coverage/', '**/dist/', '**/node_modules/'],
  overrides: [
    {
      files: ['**/*.ts'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        project: './tsconfig.json',
        sourceType: 'module',
      },
      plugins: ['@typescript-eslint'],
      extends: [
        'plugin:@typescript-eslint/recommended',
        'plugin:@typescript-eslint/recommended-requiring-type-checking',
      ],
      rules: {
        '@typescript-eslint/consistent-type-imports': 'error',
        '@typescript-eslint/explicit-function-return-type': 'error',
        '@typescript-eslint/no-explicit-any': 'error',
        '@typescript-eslint/no-floating-promises': 'error',
      },
    },
    {
      files: ['**/*.spec.ts'],
      env: { jest: true },
    },
  ],
};
