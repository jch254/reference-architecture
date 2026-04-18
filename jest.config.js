module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src/backend',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': ['ts-jest', {}],
  },
  testEnvironment: 'node',
  moduleDirectories: ['node_modules', '<rootDir>/../../'],
  setupFiles: ['<rootDir>/../../jest.setup.js'],
};
