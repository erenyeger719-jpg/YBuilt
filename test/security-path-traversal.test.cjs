const assert = require('assert');

async function testPathTraversal() {
  const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
  
  // Create test job
  const generateRes = await fetch(`${BASE_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: 'security test', userId: 'test-user' })
  });
  const { jobId } = await generateRes.json();
  
  // Wait for job
  for (let i = 0; i < 30; i++) {
    const jobRes = await fetch(`${BASE_URL}/api/jobs/${jobId}`);
    const job = await jobRes.json();
    if (job.status === 'ready_for_finalization') break;
    await new Promise(r => setTimeout(r, 1000));
  }
  
  // Test 1: Try to delete /etc/passwd via path traversal
  console.log('Test 1: Attempting ../../etc/passwd deletion...');
  const delRes1 = await fetch(`${BASE_URL}/api/workspace/${jobId}/file?path=../../etc/passwd`, {
    method: 'DELETE'
  });
  assert.strictEqual(delRes1.status, 403, 'Should block path traversal');
  
  // Test 2: Try to read /etc/passwd
  console.log('Test 2: Attempting ../../etc/passwd read...');
  const readRes1 = await fetch(`${BASE_URL}/api/workspace/${jobId}/file?path=../../etc/passwd`);
  assert.strictEqual(readRes1.status, 403, 'Should block path traversal read');
  
  // Test 3: Try various traversal patterns
  const traversalPatterns = [
    '../../../etc/passwd',
    '..\\..\\..\\windows\\system32\\config\\sam',
    '....//....//....//etc/passwd',
    '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd', // URL encoded
    '..%252f..%252f..%252fetc%252fpasswd', // Double encoded
  ];
  
  console.log('Test 3: Testing multiple traversal patterns...');
  for (const pattern of traversalPatterns) {
    const res = await fetch(`${BASE_URL}/api/workspace/${jobId}/file?path=${encodeURIComponent(pattern)}`);
    assert.strictEqual(res.status, 403, `Should block: ${pattern}`);
  }
  
  // Test 4: Try to delete index.html (protected)
  console.log('Test 4: Attempting index.html deletion...');
  const delRes2 = await fetch(`${BASE_URL}/api/workspace/${jobId}/file?path=index.html`, {
    method: 'DELETE'
  });
  assert.strictEqual(delRes2.status, 403, 'Should block index.html deletion');
  
  // Test 5: Try variations of index.html
  const indexVariations = [
    './index.html',
    'index.html',
    './././index.html',
  ];
  
  console.log('Test 5: Testing index.html variations...');
  for (const variation of indexVariations) {
    const res = await fetch(`${BASE_URL}/api/workspace/${jobId}/file?path=${variation}`, {
      method: 'DELETE'
    });
    assert.strictEqual(res.status, 403, `Should block: ${variation}`);
  }
  
  // Test 6: Valid operations should still work
  console.log('Test 6: Verifying legitimate operations work...');
  const createRes = await fetch(`${BASE_URL}/api/workspace/${jobId}/file`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: 'test.txt', content: 'test content' })
  });
  assert.strictEqual(createRes.status, 200, 'Should allow valid file creation');
  
  const deleteRes = await fetch(`${BASE_URL}/api/workspace/${jobId}/file?path=test.txt`, {
    method: 'DELETE'
  });
  assert.strictEqual(deleteRes.status, 200, 'Should allow valid file deletion');
  
  console.log('✅ All path traversal security tests passed!');
}

testPathTraversal().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
