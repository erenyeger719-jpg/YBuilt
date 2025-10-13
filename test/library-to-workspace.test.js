import assert from 'assert';

async function testLibraryToWorkspace() {
  const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
  
  // Test 1: Create job and save as draft
  console.log('Test 1: Creating job and saving draft...');
  const generateRes = await fetch(`${BASE_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: 'test portfolio website', userId: 'test-user' })
  });
  
  assert.strictEqual(generateRes.status, 200, 'Generate endpoint should return 200');
  const { jobId } = await generateRes.json();
  assert.ok(jobId, 'Job ID should be returned');
  console.log(`✓ Job created with ID: ${jobId}`);
  
  // Wait for job completion
  console.log('Waiting for job completion...');
  let job;
  for (let i = 0; i < 30; i++) {
    const jobRes = await fetch(`${BASE_URL}/api/jobs/${jobId}`);
    job = await jobRes.json();
    console.log(`  Job status: ${job.status}`);
    
    if (job.status === 'ready_for_finalization' || job.status === 'completed') {
      break;
    }
    
    await new Promise(r => setTimeout(r, 1000));
  }
  
  assert.ok(
    job.status === 'ready_for_finalization' || job.status === 'completed',
    'Job should reach ready_for_finalization or completed status'
  );
  console.log('✓ Job completed successfully');
  
  // Create draft in library
  console.log('\nTest 1b: Creating draft in library...');
  const createDraftRes = await fetch(`${BASE_URL}/api/drafts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jobId,
      userId: 'test-user',
      title: 'Test Draft',
      description: 'Test portfolio website',
      theme: 'monochrome',
      heroText: 'Welcome to my portfolio'
    })
  });
  
  assert.strictEqual(createDraftRes.status, 200, 'Draft creation should return 200');
  const draftData = await createDraftRes.json();
  assert.ok(draftData.draftId, 'Draft ID should be returned');
  console.log(`✓ Draft created with ID: ${draftData.draftId}`);
  
  // Test 2: Select draft to open workspace
  console.log('\nTest 2: Selecting draft for workspace...');
  const selectRes = await fetch(`${BASE_URL}/api/jobs/${jobId}/select`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      draftEdits: {
        title: 'Test Draft',
        description: 'Test portfolio website',
        theme: 'monochrome',
        heroText: 'Welcome to my portfolio'
      }
    })
  });
  
  const selectData = await selectRes.json();
  console.log(`  Select response status: ${selectData.status || 'success'}`);
  
  // Should be ready or pending
  assert.ok(
    selectData.status === 'success' || selectData.status === 'pending' || selectData.ok === true,
    'Select should return success, pending, or ok:true'
  );
  
  // If pending, wait and retry
  if (selectData.status === 'pending') {
    console.log(`  Workspace pending, retrying after ${selectData.retryAfter}ms...`);
    await new Promise(r => setTimeout(r, selectData.retryAfter || 1000));
    
    // Retry select
    const retryRes = await fetch(`${BASE_URL}/api/jobs/${jobId}/select`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        draftEdits: {
          title: 'Test Draft',
          description: 'Test portfolio website',
          theme: 'monochrome',
          heroText: 'Welcome to my portfolio'
        }
      })
    });
    const retryData = await retryRes.json();
    assert.ok(
      retryData.status === 'success' || retryData.ok === true,
      'Retry should succeed'
    );
  }
  
  console.log('✓ Workspace selected successfully');
  
  // Test 3: Verify workspace files accessible
  console.log('\nTest 3: Accessing workspace files...');
  let filesRes = await fetch(`${BASE_URL}/api/workspace/${jobId}/files`);
  
  // Handle 202 Accepted (workspace not ready yet)
  if (filesRes.status === 202) {
    console.log('  Workspace not ready, waiting...');
    const waitData = await filesRes.json();
    await new Promise(r => setTimeout(r, waitData.retryAfter || 1000));
    
    // Retry
    filesRes = await fetch(`${BASE_URL}/api/workspace/${jobId}/files`);
  }
  
  assert.strictEqual(filesRes.status, 200, 'Workspace files endpoint should return 200');
  
  const filesData = await filesRes.json();
  assert.ok(filesData.files, 'Response should contain files array');
  assert.ok(Array.isArray(filesData.files), 'Files should be an array');
  
  // Check that index.html exists in files
  const hasIndexHtml = filesData.files.some(f => f.path === 'index.html' || f.path.includes('index.html'));
  assert.ok(hasIndexHtml, 'Files should include index.html');
  console.log(`✓ Found ${filesData.files.length} file(s) in workspace`);
  
  // Test 4: Load file content
  console.log('\nTest 4: Loading file content...');
  const indexFile = filesData.files.find(f => f.path === 'index.html');
  assert.ok(indexFile, 'index.html should exist in files');
  assert.ok(indexFile.content, 'index.html should have content');
  assert.ok(indexFile.content.length > 0, 'Content should not be empty');
  
  const isValidHtml = 
    indexFile.content.includes('<!DOCTYPE html>') || 
    indexFile.content.includes('<html') ||
    indexFile.content.includes('<HTML');
  
  assert.ok(isValidHtml, 'Content should be valid HTML');
  console.log(`✓ Loaded index.html (${indexFile.content.length} bytes)`);
  
  console.log('\n✅ All library-to-workspace tests passed!');
}

// Run the test
testLibraryToWorkspace().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
