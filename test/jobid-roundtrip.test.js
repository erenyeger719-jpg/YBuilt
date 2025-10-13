import assert from 'assert';
import fs from 'fs/promises';
import path from 'path';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const JOBS_FILE = path.join(process.cwd(), 'data', 'jobs.json');

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

// Helper function to read jobs.json
async function getJobFromStorage(jobId) {
  try {
    const jobsData = await fs.readFile(JOBS_FILE, 'utf-8');
    const jobs = JSON.parse(jobsData);
    return jobs[jobId];
  } catch (error) {
    throw new Error(`Failed to read jobs.json: ${error.message}`);
  }
}

// Test 1: Verify POST /api/generate returns full 36-character UUID
async function testJobIdLength() {
  console.log('🔑 Testing jobId UUID length...');
  
  const { response, data } = await apiRequest('/api/generate', {
    method: 'POST',
    body: JSON.stringify({
      userId: 'test-user-uuid',
      prompt: 'Test UUID roundtrip integrity',
    }),
  });
  
  assert.strictEqual(response.status, 200, 'Generation should return 200');
  assert.ok(data.jobId, 'Should return a jobId');
  
  // Verify UUID is exactly 36 characters
  assert.strictEqual(data.jobId.length, 36, 
    `jobId should be exactly 36 characters, got ${data.jobId.length}: ${data.jobId}`);
  
  // Verify UUID format (8-4-4-4-12 pattern)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  assert.ok(uuidRegex.test(data.jobId), 
    `jobId should match UUID format: ${data.jobId}`);
  
  console.log(`✅ Returned jobId: ${data.jobId} (length: ${data.jobId.length})`);
  
  return data.jobId;
}

// Test 2: Verify returned jobId matches entry in data/jobs.json
async function testJobIdStorageMatch(jobId) {
  console.log('\n💾 Testing jobId matches storage...');
  
  // Small delay to ensure file is written
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const storedJob = await getJobFromStorage(jobId);
  
  assert.ok(storedJob, `Job ${jobId} should exist in jobs.json`);
  assert.strictEqual(storedJob.id, jobId, 
    `Stored job.id (${storedJob.id}) should match returned jobId (${jobId})`);
  assert.strictEqual(storedJob.id.length, 36, 
    `Stored job.id should be 36 characters, got ${storedJob.id.length}`);
  
  console.log(`✅ Storage verification:`);
  console.log(`   Returned jobId: ${jobId}`);
  console.log(`   Stored job.id:  ${storedJob.id}`);
  console.log(`   Match: ${jobId === storedJob.id ? '✓' : '✗'}`);
  
  return storedJob;
}

// Test 3: Verify GET /api/jobs/:jobId successfully retrieves the job
async function testJobRetrieval(jobId) {
  console.log('\n🔍 Testing job retrieval...');
  
  const { response, data } = await apiRequest(`/api/jobs/${jobId}`);
  
  assert.strictEqual(response.status, 200, 
    `GET /api/jobs/${jobId} should return 200, got ${response.status}`);
  assert.ok(data.id, 'Retrieved job should have an id');
  assert.strictEqual(data.id, jobId, 
    `Retrieved job.id (${data.id}) should match requested jobId (${jobId})`);
  assert.strictEqual(data.id.length, 36, 
    `Retrieved job.id should be 36 characters, got ${data.id.length}`);
  
  console.log(`✅ Job retrieval successful:`);
  console.log(`   Requested: ${jobId}`);
  console.log(`   Retrieved: ${data.id}`);
  console.log(`   Match: ${jobId === data.id ? '✓' : '✗'}`);
  
  return data;
}

// Test 4: Verify no truncation with multiple rapid requests
async function testMultipleJobCreations() {
  console.log('\n🔄 Testing multiple job creations for consistency...');
  
  const jobIds = [];
  const numTests = 5;
  
  for (let i = 0; i < numTests; i++) {
    const { response, data } = await apiRequest('/api/generate', {
      method: 'POST',
      body: JSON.stringify({
        userId: 'test-user-multi',
        prompt: `Test prompt ${i + 1}`,
      }),
    });
    
    assert.strictEqual(response.status, 200, `Request ${i + 1} should return 200`);
    assert.strictEqual(data.jobId.length, 36, 
      `Request ${i + 1}: jobId should be 36 characters, got ${data.jobId.length}: ${data.jobId}`);
    
    jobIds.push(data.jobId);
  }
  
  // Verify all UUIDs are unique
  const uniqueJobIds = new Set(jobIds);
  assert.strictEqual(uniqueJobIds.size, numTests, 
    'All generated jobIds should be unique');
  
  console.log(`✅ Created ${numTests} jobs, all with 36-character UUIDs:`);
  jobIds.forEach((id, i) => {
    console.log(`   ${i + 1}. ${id} (length: ${id.length})`);
  });
  
  return jobIds;
}

// Main test runner
async function runTests() {
  console.log('🧪 Starting jobId Roundtrip Test Suite\n');
  console.log('=' .repeat(60));
  
  try {
    // Test 1: Verify UUID length in response
    const jobId = await testJobIdLength();
    
    // Test 2: Verify UUID matches storage
    const storedJob = await testJobIdStorageMatch(jobId);
    
    // Test 3: Verify job retrieval
    const retrievedJob = await testJobRetrieval(jobId);
    
    // Test 4: Multiple creations
    const multipleJobIds = await testMultipleJobCreations();
    
    console.log('\n' + '=' .repeat(60));
    console.log('✅ All tests passed!\n');
    
    // Summary
    console.log('📊 Test Summary:');
    console.log(`   ✓ UUID length validation: PASS`);
    console.log(`   ✓ Storage match validation: PASS`);
    console.log(`   ✓ Job retrieval validation: PASS`);
    console.log(`   ✓ Multiple creation test: PASS (${multipleJobIds.length} jobs)`);
    console.log(`\n🎉 jobId roundtrip integrity verified!`);
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
runTests();
