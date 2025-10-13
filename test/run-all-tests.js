const { spawn } = require('child_process');

const tests = [
  { name: 'JobId Roundtrip', command: 'node', args: ['test/jobid-roundtrip.test.js'] },
  { name: 'Library to Workspace', command: 'node', args: ['test/library-to-workspace.test.js'] },
  { name: 'Security Path Traversal', command: 'node', args: ['test/security-path-traversal.test.cjs'] },
  { name: 'Upload Sanitization', command: 'node', args: ['test/upload-sanitization.test.cjs'] },
  { name: 'E2E Publish Flow', command: 'node', args: ['test/e2e-publish.test.js'] }
];

async function runTest(test) {
  return new Promise((resolve, reject) => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Running: ${test.name}`);
    console.log('='.repeat(60));
    
    const proc = spawn(test.command, test.args, { stdio: 'inherit' });
    
    proc.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${test.name} passed\n`);
        resolve();
      } else {
        console.log(`❌ ${test.name} failed with code ${code}\n`);
        reject(new Error(`${test.name} failed`));
      }
    });
    
    proc.on('error', (err) => {
      console.error(`❌ Failed to start ${test.name}:`, err);
      reject(err);
    });
  });
}

async function runAllTests() {
  console.log('\n🧪 Running YBUILT QA Test Suite...\n');
  
  let passed = 0;
  let failed = 0;
  const failedTests = [];
  
  for (const test of tests) {
    try {
      await runTest(test);
      passed++;
    } catch (error) {
      failed++;
      failedTests.push(test.name);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('Test Summary');
  console.log('='.repeat(60));
  console.log(`Total: ${tests.length} | Passed: ${passed} | Failed: ${failed}`);
  
  if (failedTests.length > 0) {
    console.log('\nFailed tests:');
    failedTests.forEach(name => console.log(`  ❌ ${name}`));
    console.log('\n❌ Test suite failed!');
    process.exit(1);
  } else {
    console.log('\n✅ All QA tests passed!');
    process.exit(0);
  }
}

runAllTests();
