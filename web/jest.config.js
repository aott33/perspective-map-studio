/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    testEnvironment: 'node',
    roots: ['<rootDir>/typescript'],
    testMatch: ['**/__tests__/**/*.test.ts'],
    transform: {
        // .tsx too: the style preview (a React component) is unit tested with react-dom/server (epic 3 entry 1).
        '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }]
    }
};
