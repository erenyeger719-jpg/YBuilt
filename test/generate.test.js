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

// Test 1: Basic job generation flow
async function testGeneration() {
  console.log('📝 Testing POST /api/generate...');
  
  const { response, data } = await apiRequest('/api/generate', {
    method: 'POST',
    body: JSON.stringify({
      userId: 'test-user',
      prompt: 'Create a simple landing page with a hero section',
    }),
  });
  
  assert.strictEqual(response.status, 200, 'Generation should return 200');
  assert.ok(data.jobId, 'Should return a jobId');
  assert.ok(data.status, 'Should return a status');
  
  console.log(`✅ Job created with ID: ${data.jobId}`);
  
  return data.jobId;
}

// Test 2: Poll job status and verify transitions
async function testJobStatusTransitions(jobId) {
  console.log('\n🔄 Testing job status transitions...');
  
  const expectedStatuses = ['queued', 'generating', 'ready_for_finalization'];
  const observedStatuses = new Set();
  
  await waitForCondition(async () => {
    const { data } = await apiRequest(`/api/jobs/${jobId}`);
    observedStatuses.add(data.status);
    
    console.log(`   Status: ${data.status}`);
    
    return data.status === 'ready_for_finalization' || data.status === 'failed';
  });
  
  const { data: finalJob } = await apiRequest(`/api/jobs/${jobId}`);
  
  assert.strictEqual(finalJob.status, 'ready_for_finalization', 
    'Job should reach ready_for_finalization status');
  
  // Verify we observed the expected status transitions
  for (const status of expectedStatuses) {
    assert.ok(observedStatuses.has(status), 
      `Should observe ${status} status`);
  }
  
  console.log('✅ Status transitions verified:', Array.from(observedStatuses).join(' → '));
  
  return finalJob;
}

// Test 3: Verify HTML preview file creation
async function testHTMLFileCreation(jobId, job) {
  console.log('\n📄 Testing HTML file creation...');
  
  assert.ok(job.result, 'Job should have a result URL');
  
  const previewPath = path.join(process.cwd(), 'public', 'previews', jobId, 'index.html');
  
  try {
    const htmlContent = await fs.readFile(previewPath, 'utf-8');
    assert.ok(htmlContent.length > 0, 'HTML file should have content');
    assert.ok(htmlContent.includes('<!DOCTYPE html>') || htmlContent.includes('<html'), 
      'HTML file should contain valid HTML');
    
    console.log(`✅ HTML file created at: ${previewPath}`);
    console.log(`   File size: ${htmlContent.length} bytes`);
  } catch (error) {
    throw new Error(`HTML file not found at ${previewPath}: ${error.message}`);
  }
}

// Test 4: Verify build trace creation
async function testBuildTraceCreation(jobId) {
  console.log('\n🔍 Testing build trace creation...');
  
  const tracePath = path.join(process.cwd(), 'data', 'jobs', jobId, 'build-trace.json');
  
  try {
    const traceContent = await fs.readFile(tracePath, 'utf-8');
    const trace = JSON.parse(traceContent);
    
    assert.ok(trace.jobId === jobId, 'Build trace should have correct jobId');
    assert.ok(trace.currentStage, 'Build trace should have currentStage');
    assert.ok(trace.stages, 'Build trace should have stages');
    
    const expectedStages = ['GENERATION', 'ASSEMBLY', 'LINT'];
    for (const stage of expectedStages) {
      assert.ok(trace.stages[stage], `Build trace should have ${stage} stage`);
      assert.ok(trace.stages[stage].logs, `${stage} should have logs`);
    }
    
    console.log(`✅ Build trace created at: ${tracePath}`);
    console.log(`   Current stage: ${trace.currentStage}`);
    console.log(`   Stages: ${Object.keys(trace.stages).join(', ')}`);
  } catch (error) {
    throw new Error(`Build trace not found at ${tracePath}: ${error.message}`);
  }
}

// Test 5: Error handling for invalid prompts
async function testInvalidPromptHandling() {
  console.log('\n❌ Testing error handling for invalid prompts...');
  
  // Test with missing prompt
  const { response: response1, data: data1 } = await apiRequest('/api/generate', {
    method: 'POST',
    body: JSON.stringify({
      userId: 'test-user',
    }),
  });
  
  assert.strictEqual(response1.status, 400, 'Should return 400 for missing prompt');
  assert.ok(data1.error, 'Should return error message');
  
  console.log('✅ Invalid prompt handling verified');
}

// Test 6: Get build trace via API
async function testBuildTraceAPI(jobId) {
  console.log('\n📊 Testing build trace API...');
  
  const { response, data } = await apiRequest(`/api/jobs/${jobId}/build-trace`);
  
  assert.strictEqual(response.status, 200, 'Should return 200 for build trace');
  assert.ok(data.jobId === jobId, 'Build trace should have correct jobId');
  assert.ok(data.stages, 'Build trace should have stages');
  
  console.log('✅ Build trace API verified');
  console.log(`   Retrieved ${Object.keys(data.stages).length} stages`);
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting Generation E2E Tests\n');
  console.log('='.repeat(50));
  
  let jobId;
  
  try {
    // Test 1: Create job
    jobId = await testGeneration();
    
    // Test 2: Monitor status transitions
    const job = await testJobStatusTransitions(jobId);
    
    // Test 3: Verify HTML file
    await testHTMLFileCreation(jobId, job);
    
    // Test 4: Verify build trace file
    await testBuildTraceCreation(jobId);
    
    // Test 5: Test invalid prompts
    await testInvalidPromptHandling();
    
    // Test 6: Test build trace API
    await testBuildTraceAPI(jobId);
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ All generation tests passed!');
    console.log('='.repeat(50));
    
  } catch (error) {
    console.error('\n' + '='.repeat(50));
    console.error('❌ Test failed:', error.message);
    console.error('='.repeat(50));
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run tests
runTests();
