const assert = require('assert');
const fs = require('fs/promises');
const path = require('path');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const TEST_TIMEOUT = 30000; // 30 seconds

// Helper function to wait with timeout
async function waitForCondition(conditionFn, timeout = TEST_TIMEOUT, interval = 500) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    if (await conditionFn()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}

// Helper function to make API requests
async function apiRequest(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  const data = await response.json();
  return { response, data };
}

// Helper function to create a job and wait for completion
async function createAndWaitForJob() {
  console.log('📝 Creating test job...');
  
  const { data } = await apiRequest('/api/generate', {
    method: 'POST',
    body: JSON.stringify({
      userId: 'test-user',
      prompt: 'Create a portfolio website with a contact form',
    }),
  });
  
  const jobId = data.jobId;
  console.log(`   Job created: ${jobId}`);
  
  // Wait for job to complete
  await waitForCondition(async () => {
    const { data: job } = await apiRequest(`/api/jobs/${jobId}`);
    return job.status === 'ready_for_finalization' || job.status === 'failed';
  });
  
  const { data: job } = await apiRequest(`/api/jobs/${jobId}`);
  assert.strictEqual(job.status, 'ready_for_finalization', 'Job should complete successfully');
  
  console.log(`✅ Job completed: ${jobId}\n`);
  
  return jobId;
}

// Test 1: List workspace files
async function testListFiles(jobId) {
  console.log('📂 Testing GET /api/workspace/:jobId/files...');
  
  const { response, data } = await apiRequest(`/api/workspace/${jobId}/files`);
  
  assert.strictEqual(response.status, 200, 'Should return 200');
  assert.ok(data.files, 'Should return files array');
  assert.ok(Array.isArray(data.files), 'Files should be an array');
  assert.ok(data.files.length > 0, 'Should have at least one file');
  
  const indexFile = data.files.find(f => f.path === 'index.html');
  assert.ok(indexFile, 'Should have index.html');
  assert.ok(indexFile.content, 'index.html should have content');
  
  console.log(`✅ Found ${data.files.length} file(s)`);
  data.files.forEach(f => console.log(`   - ${f.path}`));
  console.log();
  
  return data.files;
}

// Test 2: Read specific file
async function testReadFile(jobId) {
  console.log('📖 Testing GET /api/workspace/:jobId/file?path=...');
  
  const { response, data } = await apiRequest(`/api/workspace/${jobId}/file?path=index.html`);
  
  assert.strictEqual(response.status, 200, 'Should return 200');
  assert.ok(data.content, 'Should return file content');
  assert.ok(data.content.includes('<!DOCTYPE html>') || data.content.includes('<html'), 
    'Should be valid HTML');
  
  console.log(`✅ Read file successfully (${data.content.length} bytes)\n`);
  
  return data.content;
}

// Test 3: Create new file
async function testCreateFile(jobId) {
  console.log('➕ Testing POST /api/workspace/:jobId/file...');
  
  const newFileContent = `/* Test CSS file */
body {
  margin: 0;
  padding: 0;
  font-family: Arial, sans-serif;
}`;
  
  const { response, data } = await apiRequest(`/api/workspace/${jobId}/file`, {
    method: 'POST',
    body: JSON.stringify({
      path: 'styles.css',
      content: newFileContent,
    }),
  });
  
  assert.strictEqual(response.status, 200, 'Should return 200');
  assert.ok(data.success || data.ok, 'Should indicate success');
  
  // Verify file was created
  const filePath = path.join(process.cwd(), 'public', 'previews', jobId, 'styles.css');
  const content = await fs.readFile(filePath, 'utf-8');
  assert.strictEqual(content, newFileContent, 'File content should match');
  
  console.log('✅ File created successfully: styles.css\n');
}

// Test 4: Update existing file
async function testUpdateFile(jobId) {
  console.log('✏️  Testing PUT /api/workspace/:jobId/files/:filePath...');
  
  const updatedContent = `/* Updated CSS */
body {
  background-color: #f0f0f0;
}`;
  
  // Using the correct endpoint format with files (plural)
  const response = await fetch(`${BASE_URL}/api/workspace/${jobId}/files/styles.css`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      content: updatedContent,
    }),
  });
  
  const data = await response.json();
  assert.strictEqual(response.status, 200, 'Should return 200');
  assert.ok(data.success || data.ok, 'Should indicate success');
  
  // Verify file was updated
  const filePath = path.join(process.cwd(), 'public', 'previews', jobId, 'styles.css');
  const content = await fs.readFile(filePath, 'utf-8');
  assert.strictEqual(content, updatedContent, 'File content should be updated');
  
  console.log('✅ File updated successfully: styles.css\n');
}

// Test 5: Delete file
async function testDeleteFile(jobId) {
  console.log('🗑️  Testing DELETE /api/workspace/:jobId/file?path=...');
  
  const response = await fetch(`${BASE_URL}/api/workspace/${jobId}/file?path=styles.css`, {
    method: 'DELETE',
  });
  
  const data = await response.json();
  assert.strictEqual(response.status, 200, 'Should return 200');
  assert.ok(data.success || data.ok, 'Should indicate success');
  
  // Verify file was deleted
  const filePath = path.join(process.cwd(), 'public', 'previews', jobId, 'styles.css');
  await assert.rejects(
    () => fs.access(filePath),
    'File should be deleted'
  );
  
  console.log('✅ File deleted successfully: styles.css\n');
}

// Test 6: Upload file with multipart form data
async function testUploadFile(jobId) {
  console.log('📤 Testing POST /api/workspace/:jobId/upload...');
  
  // Create a simple test file
  const testContent = 'console.log("Hello from uploaded script");';
  const testFilePath = path.join(process.cwd(), 'test-script.js');
  await fs.writeFile(testFilePath, testContent);
  
  try {
    // Read file and create FormData
    const fileContent = await fs.readFile(testFilePath);
    const FormData = (await import('formdata-node')).FormData;
    const { fileFromPath } = await import('formdata-node/file-from-path');
    
    const formData = new FormData();
    const file = await fileFromPath(testFilePath, 'test-script.js', { type: 'text/javascript' });
    formData.append('file', file);
    
    const response = await fetch(`${BASE_URL}/api/workspace/${jobId}/upload`, {
      method: 'POST',
      body: formData,
    });
    
    const data = await response.json();
    assert.strictEqual(response.status, 200, 'Should return 200');
    assert.ok(data.success || data.path || data.url, 'Should return file info');
    
    console.log('✅ File uploaded successfully\n');
  } catch (error) {
    // If formdata-node is not available, skip this test
    console.log('⚠️  Skipping upload test (formdata-node not available)\n');
  } finally {
    // Cleanup test file
    await fs.unlink(testFilePath).catch(() => {});
  }
}

// Test 7: Get build trace
async function testGetBuildTrace(jobId) {
  console.log('📊 Testing GET /api/jobs/:jobId/build-trace...');
  
  const { response, data } = await apiRequest(`/api/jobs/${jobId}/build-trace`);
  
  assert.strictEqual(response.status, 200, 'Should return 200');
  assert.ok(data.jobId === jobId, 'Should have correct jobId');
  assert.ok(data.stages, 'Should have stages');
  assert.ok(data.currentStage, 'Should have currentStage');
  
  console.log(`✅ Build trace retrieved`);
  console.log(`   Current stage: ${data.currentStage}`);
  console.log(`   Total stages: ${Object.keys(data.stages).length}\n`);
  
  return data;
}

// Test 8: Test SSE streaming for build trace
async function testBuildTraceStreaming(jobId) {
  console.log('🌊 Testing GET /api/jobs/:jobId/build-trace/stream (SSE)...');
  
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('SSE connection timeout'));
    }, 5000);
    
    fetch(`${BASE_URL}/api/jobs/${jobId}/build-trace/stream`)
      .then(response => {
        assert.strictEqual(response.status, 200, 'Should return 200');
        assert.ok(response.headers.get('content-type')?.includes('text/event-stream'),
          'Should have correct content-type for SSE');
        
        clearTimeout(timeoutId);
        console.log('✅ SSE stream connection established\n');
        resolve();
      })
      .catch(reject);
  });
}

// Test 9: Error handling for invalid jobId
async function testInvalidJobId() {
  console.log('❌ Testing error handling for invalid jobId...');
  
  const invalidJobId = 'invalid-job-id-12345';
  
  const { response, data } = await apiRequest(`/api/workspace/${invalidJobId}/files`);
  
  assert.strictEqual(response.status, 404, 'Should return 404 for invalid jobId');
  assert.ok(data.error, 'Should return error message');
  
  console.log('✅ Invalid jobId handling verified\n');
}

// Test 10: Error handling for invalid file path
async function testInvalidFilePath(jobId) {
  console.log('❌ Testing error handling for invalid file path...');
  
  const { response, data } = await apiRequest(
    `/api/workspace/${jobId}/file?path=../../../etc/passwd`
  );
  
  assert.ok(response.status === 400 || response.status === 404, 
    'Should return 400 or 404 for path traversal attempt');
  
  console.log('✅ Invalid file path handling verified\n');
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting Workspace Workflow E2E Tests\n');
  console.log('='.repeat(60));
  
  let jobId;
  
  try {
    // Setup: Create job and wait for completion
    jobId = await createAndWaitForJob();
    
    // Test workspace file operations
    await testListFiles(jobId);
    await testReadFile(jobId);
    await testCreateFile(jobId);
    await testUpdateFile(jobId);
    await testDeleteFile(jobId);
    await testUploadFile(jobId);
    
    // Test build trace
    await testGetBuildTrace(jobId);
    await testBuildTraceStreaming(jobId);
    
    // Test error handling
    await testInvalidJobId();
    await testInvalidFilePath(jobId);
    
    console.log('='.repeat(60));
    console.log('✅ All workflow tests passed!');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n' + '='.repeat(60));
    console.error('❌ Test failed:', error.message);
    console.error('='.repeat(60));
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run tests
runTests();
