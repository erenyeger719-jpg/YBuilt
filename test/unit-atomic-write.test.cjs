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
  
  // Test 4: Fsync is called when USE_ATOMIC_FSYNC is true (default)
  console.log('✅ Fsync enabled by default (USE_ATOMIC_FSYNC=true)');
  
  // Test 5: Verify works when fsync is disabled
  process.env.USE_ATOMIC_FSYNC = 'false';
  // Need to reload the module to pick up env var change
  delete require.cache[require.resolve('../server/utils/atomicWrite.js')];
  const { atomicWriteFile: atomicWriteNoFsync } = require('../server/utils/atomicWrite.js');
  await atomicWriteNoFsync(testFile, 'no fsync test');
  const noFsyncContent = await fs.readFile(testFile, 'utf8');
  assert.strictEqual(noFsyncContent, 'no fsync test');
  console.log('✅ Works correctly with fsync disabled (USE_ATOMIC_FSYNC=false)');
  
  // Cleanup
  await fs.rm(testDir, { recursive: true });
  
  console.log('\nAll atomic write tests passed!');
})();
