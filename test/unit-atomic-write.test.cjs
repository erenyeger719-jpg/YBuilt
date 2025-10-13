const assert = require('assert');
const fs = require('fs/promises');
const path = require('path');
const { atomicWriteFile } = require('../server/utils/atomicWrite.js');

(async () => {
  const testDir = '/tmp/atomic-test';
  await fs.mkdir(testDir, { recursive: true });
  
  const testFile = path.join(testDir, 'test.txt');
  
  // Test 1: Write string
  await atomicWriteFile(testFile, 'hello world');
  const content = await fs.readFile(testFile, 'utf8');
  assert.strictEqual(content, 'hello world');
  console.log('✅ Writes string correctly');
  
  // Test 2: Write object (JSON)
  await atomicWriteFile(testFile, { foo: 'bar' });
  const json = JSON.parse(await fs.readFile(testFile, 'utf8'));
  assert.deepStrictEqual(json, { foo: 'bar' });
  console.log('✅ Writes JSON correctly');
  
  // Test 3: No temp files remain
  const files = await fs.readdir(testDir);
  const tmpFiles = files.filter(f => f.startsWith('.tmp-'));
  assert.strictEqual(tmpFiles.length, 0);
  console.log('✅ No temp files remain');
  
  // Cleanup
  await fs.rm(testDir, { recursive: true });
  
  console.log('All atomic write tests passed!');
})();
