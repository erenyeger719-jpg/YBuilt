const assert = require('assert');

async function testE2EPublish() {
  const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
  
  console.log('=== E2E Publish Flow Test ===\n');
  
  try {
    // Step 1: Generate website
    console.log('Step 1: Generating website...');
    const generateRes = await fetch(`${BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        prompt: 'E2E test portfolio website',
        userId: 'demo'
      })
    });
    
    if (!generateRes.ok) {
      throw new Error(`Generate failed: ${generateRes.status}`);
    }
    
    const { jobId } = await generateRes.json();
    console.log(`✅ Job created: ${jobId}`);
    
    // Step 2: Wait for job completion
    console.log('\nStep 2: Waiting for job completion...');
    let job;
    let attempts = 0;
    const maxAttempts = 30;
    
    for (let i = 0; i < maxAttempts; i++) {
      attempts++;
      const jobRes = await fetch(`${BASE_URL}/api/jobs/${jobId}`);
      job = await jobRes.json();
      
      if (job.status === 'ready_for_finalization') {
        console.log(`✅ Job completed after ${attempts} seconds`);
        break;
      } else if (job.status === 'failed') {
        throw new Error(`Job failed: ${job.error}`);
      }
      
      await new Promise(r => setTimeout(r, 1000));
    }
    
    assert.strictEqual(job.status, 'ready_for_finalization', 'Job should be ready for finalization');
    
    // Step 3: Save as draft
    console.log('\nStep 3: Saving draft...');
    const draftRes = await fetch(`${BASE_URL}/api/jobs/${jobId}/save-draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        userId: 'demo',
        name: 'E2E Test Draft'
      })
    });
    
    assert.strictEqual(draftRes.status, 200, 'Draft should be saved successfully');
    console.log('✅ Draft saved');
    
    // Step 4: Open workspace (select)
    console.log('\nStep 4: Opening workspace...');
    const selectRes = await fetch(`${BASE_URL}/api/jobs/${jobId}/select`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'demo' })
    });
    
    const selectData = await selectRes.json();
    console.log(`✅ Workspace opened: ${selectData.status}`);
    
    // Step 5: Check user credits
    console.log('\nStep 5: Checking user credits...');
    const planRes = await fetch(`${BASE_URL}/api/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'demo' })
    });
    
    const planData = await planRes.json();
    console.log(`✅ User has ${planData.credits} credits`);
    
    // Step 6: Simulate payment if needed
    if (planData.credits < 1) {
      console.log('\nStep 6: Simulating payment...');
      const paymentRes = await fetch(`${BASE_URL}/api/payments/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'demo',
          amount: 799,
          orderId: `test_${Date.now()}`
        })
      });
      
      const paymentData = await paymentRes.json();
      assert.strictEqual(paymentData.success, true, 'Payment should succeed');
      console.log(`✅ Payment simulated: ${paymentData.credits} credits added`);
    }
    
    // Step 7: Publish
    console.log('\nStep 7: Publishing website...');
    const publishRes = await fetch(`${BASE_URL}/api/jobs/${jobId}/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'demo' })
    });
    
    const publishData = await publishRes.json();
    assert.ok(publishData.url, 'Published URL should be returned');
    console.log(`✅ Published: ${publishData.url}`);
    
    // Step 8: Check metrics
    console.log('\nStep 8: Checking metrics...');
    const metricsRes = await fetch(`${BASE_URL}/api/metrics`);
    const metrics = await metricsRes.json();
    
    assert.ok(metrics.jobs.total > 0, 'Should have processed jobs');
    console.log(`✅ Metrics: ${metrics.jobs.total} total jobs, ${metrics.jobs.successful} successful, avg time: ${metrics.jobs.avgTime}ms`);
    
    console.log('\n✅ All E2E publish tests passed!');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Test failed:', err.message);
    process.exit(1);
  }
}

testE2EPublish();
