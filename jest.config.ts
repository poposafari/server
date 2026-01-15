import type { Config } from 'jest';

const jestConfig: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  clearMocks: true,
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^@poposerver/shared$': '<rootDir>/shared/index.ts',
    '^@poposerver/shared/(.*)$': '<rootDir>/shared/$1',
    '^apps/(.*)$': '<rootDir>/apps/$1',
  },
};

export default jestConfig;
