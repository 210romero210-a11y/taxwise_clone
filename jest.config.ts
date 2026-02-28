import type { Config } from 'jest';

const config: Config = {
    preset: 'ts-jest/presets/js-with-ts',
    testEnvironment: 'node',
    moduleDirectories: ['node_modules', '<rootDir>/'],
    testMatch: ['**/__tests__/**/*.test.ts', '**/?(*.)+(spec|test).ts'],
    transformIgnorePatterns: [
        'node_modules/(?!(convex-test|convex)/)'
    ],
};

export default config;
