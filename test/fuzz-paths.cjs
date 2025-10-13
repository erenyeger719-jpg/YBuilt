const fc = require('fast-check');
const { validateAndResolvePath } = require('../server/utils/paths.js');
const path = require('path');
const os = require('os');

const workspaceDir = path.join(os.tmpdir(), 'fuzz-workspace');

const pathArbitrary = fc.oneof(
  fc.string(),
  fc.array(fc.string(), { minLength: 1, maxLength: 10 }).map(parts => parts.join('/')),
  fc.constantFrom('../', './', '..\\', '.\\', '%2e%2e/', '..../', 'C:\\'),
  fc.string().map(s => s + '\x00'),
  fc.hexaString().map(s => '%' + s)
);

console.log('Starting path validation fuzzing...');

fc.assert(
  fc.property(pathArbitrary, (inputPath) => {
    try {
      const result = validateAndResolvePath(workspaceDir, inputPath);
      // If successful, must be within workspace
      if (!result.startsWith(workspaceDir)) {
        throw new Error(`Path escaped workspace: ${result}`);
      }
      return true;
    } catch (error) {
      // Expected errors should have proper codes
      if (error.code !== 400 && error.code !== 403) {
        console.error(`Unexpected error for input "${inputPath}":`, error);
        return false;
      }
      return true;
    }
  }),
  { numRuns: 1000, seed: 42 }
);

console.log('✅ Fuzzing completed successfully');
