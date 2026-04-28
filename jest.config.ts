import type { Config } from 'jest';

const jestConfig: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  clearMocks: true,
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^@poposerver/lib$': '<rootDir>/lib/index.ts',
    '^@poposerver/lib/(.*)$': '<rootDir>/lib/$1',
    '^apps/(.*)$': '<rootDir>/apps/$1',
  },
};

export default jestConfig;
