const assert = require('assert');
const path = require('path');
const FormData = require('form-data');

async function testUploadSanitization() {
  const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
  
  // Create test job
  const generateRes = await fetch(`${BASE_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: 'upload test', userId: 'test-user' })
  });
  const { jobId } = await generateRes.json();
  
  // Wait for job
  for (let i = 0; i < 30; i++) {
    const jobRes = await fetch(`${BASE_URL}/api/jobs/${jobId}`);
    const job = await jobRes.json();
    if (job.status === 'ready_for_finalization') break;
    await new Promise(r => setTimeout(r, 1000));
  }
  
  // Test 1: Upload file with path traversal in filename
  console.log('Test 1: Uploading file with ../../ in filename...');
  const form1 = new FormData();
  form1.append('file', Buffer.from('malicious'), { filename: '../../evil.txt' });
  
  const uploadRes1 = await fetch(`${BASE_URL}/api/workspace/${jobId}/upload`, {
    method: 'POST',
    body: form1,
    headers: form1.getHeaders()
  });
  
  // Should either sanitize filename or reject
  assert.ok(uploadRes1.status === 200 || uploadRes1.status === 400);
  
  if (uploadRes1.status === 200) {
    const data1 = await uploadRes1.json();
    // Filename should be sanitized (no ../)
    assert.ok(!data1.filename.includes('..'));
  }
  
  // Test 2: Upload file with absolute path
  console.log('Test 2: Uploading file with absolute path...');
  const form2 = new FormData();
  form2.append('file', Buffer.from('test'), { filename: '/etc/passwd' });
  
  const uploadRes2 = await fetch(`${BASE_URL}/api/workspace/${jobId}/upload`, {
    method: 'POST',
    body: form2,
    headers: form2.getHeaders()
  });
  
  assert.ok(uploadRes2.status === 200 || uploadRes2.status === 400);
  
  if (uploadRes2.status === 200) {
    const data2 = await uploadRes2.json();
    assert.ok(!data2.filename.startsWith('/'));
  }
  
  // Test 3: Upload with special characters
  console.log('Test 3: Uploading file with special characters...');
  const form3 = new FormData();
  form3.append('file', Buffer.from('test'), { filename: 'test<>:"|?*.txt' });
  
  const uploadRes3 = await fetch(`${BASE_URL}/api/workspace/${jobId}/upload`, {
    method: 'POST',
    body: form3,
    headers: form3.getHeaders()
  });
  
  // Should sanitize or accept
  assert.ok([200, 400].includes(uploadRes3.status));
  
  // Test 4: Valid upload should work
  console.log('Test 4: Uploading valid file...');
  const form4 = new FormData();
  form4.append('file', Buffer.from('valid content'), { filename: 'valid-file.txt' });
  
  const uploadRes4 = await fetch(`${BASE_URL}/api/workspace/${jobId}/upload`, {
    method: 'POST',
    body: form4,
    headers: form4.getHeaders()
  });
  
  assert.strictEqual(uploadRes4.status, 200);
  const data4 = await uploadRes4.json();
  assert.ok(data4.filename.includes('valid-file'));
  
  console.log('✅ All upload sanitization tests passed!');
}

testUploadSanitization().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
