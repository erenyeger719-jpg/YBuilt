const assert = require('assert');
const { validateAndResolvePath } = require('../server/utils/paths.js');

console.log('Testing validateAndResolvePath...');

const workspace = '/tmp/test-workspace';

// Test 1: Reject backslash
try {
  validateAndResolvePath(workspace, 'foo\\bar');
  assert.fail('Should reject backslash');
} catch (e) {
  assert.strictEqual(e.code, 403);
  console.log('✅ Rejects backslash');
}

// Test 2: Reject percent
try {
  validateAndResolvePath(workspace, 'foo%2Fbar');
  assert.fail('Should reject percent');
} catch (e) {
  assert.strictEqual(e.code, 403);
  console.log('✅ Rejects percent sign');
}

// Test 3: Reject .. segment
try {
  validateAndResolvePath(workspace, '../etc/passwd');
  assert.fail('Should reject ..');
} catch (e) {
  assert.strictEqual(e.code, 403);
  console.log('✅ Rejects .. segment');
}

// Test 4: Accept valid path
const valid = validateAndResolvePath(workspace, 'foo/bar.txt');
assert.ok(valid.includes('foo/bar.txt'));
console.log('✅ Accepts valid path');

console.log('All path validation tests passed!');
