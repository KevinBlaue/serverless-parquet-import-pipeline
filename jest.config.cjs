/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  snapshotSerializers: ['<rootDir>/cdk/snapshotSerializer.cjs'],
  roots: ['<rootDir>/cdk'],
  testPathIgnorePatterns: ['/dist/'],
  collectCoverageFrom: ['cdk/lib/**/*.ts', '!cdk/bin/**', '!**/*.spec.ts'],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
