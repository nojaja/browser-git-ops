module.exports = {
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'json'],
  testMatch: ['<rootDir>/test/unit/**/*.test.ts'],
  verbose: true,
  collectCoverage: true,
  collectCoverageFrom: ['src/**/*.ts'],
  coveragePathIgnorePatterns: ['<rootDir>/src/git/gitlabAdapter.ts'],
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.json'
      }
    ]
  },
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json',
      useESM: true
    }
  },
  // Treat TypeScript files as ESM so dynamic import() resolves ESM-only packages
  extensionsToTreatAsEsm: ['.ts'],
  // coverage threshold to enforce 80% global minimum
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.(ts|js)$': '$1'
  },
  // Ensure IndexedDB shim is available before modules load: load fake-indexeddb first,
  // then the wrapper that patches open() behavior. Also run per-test setup after env.
  setupFiles: [
    'fake-indexeddb/auto',
    '<rootDir>/test/setupIndexedDB.cjs',
    '<rootDir>/test/setupOpfs.ts'
  ]
}
