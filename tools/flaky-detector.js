#!/usr/bin/env node

/**
 * Flaky Test Detector
 * 
 * Wraps test runner, retries failing tests, and produces flakiness report
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const MAX_RETRIES = 2;
const TEST_COMMAND = process.env.TEST_COMMAND || 'node test/run-all-tests.cjs';
const OUTPUT_DIR = 'artifacts';
const REPORT_FILE = path.join(OUTPUT_DIR, 'flaky-report.json');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Test result tracking
const results = {
  timestamp: new Date().toISOString(),
  totalRuns: 0,
  flakyTests: [],
  consistentFailures: [],
  consistentPasses: [],
  summary: {
    totalTests: 0,
    flakyCount: 0,
    consistentFailureCount: 0,
    flakinessRate: 0
  }
};

console.log('🔍 Flaky Test Detector v1.0');
console.log(`📋 Test command: ${TEST_COMMAND}`);
console.log(`🔄 Max retries: ${MAX_RETRIES}`);
console.log('');

/**
 * Run test suite
 */
function runTests(attemptNumber) {
  console.log(`\n🧪 Test run #${attemptNumber}...`);
  
  try {
    const output = execSync(TEST_COMMAND, {
      encoding: 'utf8',
      stdio: 'pipe'
    });
    
    return {
      success: true,
      output,
      exitCode: 0
    };
  } catch (error) {
    return {
      success: false,
      output: error.stdout || error.stderr || error.message,
      exitCode: error.status || 1
    };
  }
}

/**
 * Extract test names from output (basic parser)
 */
function extractTestNames(output) {
  const tests = [];
  
  // Try to extract test names from various formats
  const patterns = [
    /✓\s+(.+?)(?:\n|$)/g,           // Mocha/Jest style pass
    /✗\s+(.+?)(?:\n|$)/g,           // Mocha/Jest style fail
    /PASS\s+(.+?)(?:\n|$)/g,        // Jest pass
    /FAIL\s+(.+?)(?:\n|$)/g,        // Jest fail
    /ok\s+\d+\s+(.+?)(?:\n|$)/g,    // TAP style
    /not ok\s+\d+\s+(.+?)(?:\n|$)/g // TAP style fail
  ];
  
  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(output)) !== null) {
      tests.push(match[1].trim());
    }
  });
  
  return [...new Set(tests)]; // Deduplicate
}

/**
 * Analyze test results across runs
 */
function analyzeResults(runs) {
  const testOccurrences = {};
  
  runs.forEach((run, index) => {
    const tests = extractTestNames(run.output);
    
    tests.forEach(test => {
      if (!testOccurrences[test]) {
        testOccurrences[test] = {
          name: test,
          runs: [],
          passCount: 0,
          failCount: 0
        };
      }
      
      const passed = run.success;
      testOccurrences[test].runs.push({
        attemptNumber: index + 1,
        passed
      });
      
      if (passed) {
        testOccurrences[test].passCount++;
      } else {
        testOccurrences[test].failCount++;
      }
    });
  });
  
  return testOccurrences;
}

/**
 * Main execution
 */
async function main() {
  const runs = [];
  
  // Initial run
  const initialRun = runTests(1);
  runs.push(initialRun);
  results.totalRuns++;
  
  if (initialRun.success) {
    console.log('✅ Initial test run passed');
    
    // Still do retries to check for flakiness
    for (let i = 2; i <= MAX_RETRIES + 1; i++) {
      const run = runTests(i);
      runs.push(run);
      results.totalRuns++;
      
      if (!run.success) {
        console.log(`⚠️  Test run #${i} failed (flakiness detected)`);
      }
    }
  } else {
    console.log('❌ Initial test run failed');
    
    // Retry failed tests
    for (let i = 2; i <= MAX_RETRIES + 1; i++) {
      const run = runTests(i);
      runs.push(run);
      results.totalRuns++;
      
      if (run.success) {
        console.log(`✅ Test run #${i} passed (flakiness detected)`);
      }
    }
  }
  
  // Analyze results
  const testAnalysis = analyzeResults(runs);
  const testNames = Object.keys(testAnalysis);
  
  results.summary.totalTests = testNames.length;
  
  testNames.forEach(testName => {
    const test = testAnalysis[testName];
    const totalRuns = test.runs.length;
    const passRate = test.passCount / totalRuns;
    
    if (passRate > 0 && passRate < 1) {
      // Flaky test (sometimes passes, sometimes fails)
      results.flakyTests.push({
        name: testName,
        runs: test.runs,
        passCount: test.passCount,
        failCount: test.failCount,
        passRate,
        flakinessScore: 1 - Math.abs(passRate - 0.5) * 2 // Higher score = more flaky (50% pass rate = max flaky)
      });
      results.summary.flakyCount++;
    } else if (passRate === 0) {
      // Consistent failure
      results.consistentFailures.push({
        name: testName,
        runs: test.runs
      });
      results.summary.consistentFailureCount++;
    } else {
      // Consistent pass
      results.consistentPasses.push({
        name: testName,
        runs: test.runs
      });
    }
  });
  
  // Calculate flakiness rate
  results.summary.flakinessRate = results.summary.totalTests > 0
    ? results.summary.flakyCount / results.summary.totalTests
    : 0;
  
  // Sort flaky tests by flakiness score
  results.flakyTests.sort((a, b) => b.flakinessScore - a.flakinessScore);
  
  // Write report
  fs.writeFileSync(
    REPORT_FILE,
    JSON.stringify(results, null, 2)
  );
  
  // Display summary
  console.log('\n📊 Flakiness Report Summary:');
  console.log(`   Total test runs: ${results.totalRuns}`);
  console.log(`   Total unique tests: ${results.summary.totalTests}`);
  console.log(`   Flaky tests: ${results.summary.flakyCount}`);
  console.log(`   Consistent failures: ${results.summary.consistentFailureCount}`);
  console.log(`   Consistent passes: ${results.consistentPasses.length}`);
  console.log(`   Flakiness rate: ${(results.summary.flakinessRate * 100).toFixed(1)}%`);
  
  if (results.flakyTests.length > 0) {
    console.log('\n⚠️  Flaky tests detected:');
    results.flakyTests.forEach((test, i) => {
      console.log(`   ${i + 1}. ${test.name}`);
      console.log(`      Pass rate: ${(test.passRate * 100).toFixed(1)}% (${test.passCount}/${test.runs.length})`);
      console.log(`      Flakiness score: ${test.flakinessScore.toFixed(2)}`);
    });
  }
  
  if (results.consistentFailures.length > 0) {
    console.log('\n❌ Consistent failures:');
    results.consistentFailures.forEach((test, i) => {
      console.log(`   ${i + 1}. ${test.name}`);
    });
  }
  
  console.log(`\n📁 Full report: ${REPORT_FILE}`);
  
  // Exit with appropriate code
  if (results.summary.consistentFailureCount > 0) {
    console.log('\n❌ Exiting with error due to consistent failures');
    process.exit(1);
  } else if (results.summary.flakyCount > 0) {
    console.log('\n⚠️  Exiting with warning due to flaky tests');
    process.exit(2); // Warning exit code
  } else {
    console.log('\n✅ No flaky tests detected');
    process.exit(0);
  }
}

// Run
main().catch(error => {
  console.error('💥 Flaky detector error:', error);
  process.exit(1);
});
