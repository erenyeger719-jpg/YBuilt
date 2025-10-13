#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('Running unit tests...\n');

// List of unit test files
const unitTests = [
  'test/unit-atomic-write.test.cjs',
  'test/unit-symlink-protection.test.cjs'
];

let totalPassed = 0;
let totalFailed = 0;

async function runTest(testFile) {
  return new Promise((resolve, reject) => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Running: ${testFile}`);
    console.log('='.repeat(60));
    
    const child = spawn('node', [testFile], { 
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        totalPassed++;
        resolve();
      } else {
        totalFailed++;
        reject(new Error(`${testFile} failed with code ${code}`));
      }
    });
  });
}

async function runAllTests() {
  for (const testFile of unitTests) {
    try {
      await runTest(testFile);
    } catch (err) {
      console.error(`\n❌ ${err.message}`);
    }
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log('Unit Test Summary');
  console.log('='.repeat(60));
  console.log(`Total Passed: ${totalPassed}`);
  console.log(`Total Failed: ${totalFailed}`);
  console.log('='.repeat(60));
  
  process.exit(totalFailed > 0 ? 1 : 0);
}

runAllTests().catch(err => {
  console.error('Fatal error running unit tests:', err);
  process.exit(1);
});
