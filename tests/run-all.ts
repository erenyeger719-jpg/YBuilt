#!/usr/bin/env tsx

import { run } from 'node:test';
import { spec as specReporter } from 'node:test/reporters';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface TestResult {
  pass: number;
  fail: number;
  skip: number;
  todo: number;
  duration: number;
}

async function runTests() {
  console.log('\n🧪 Running Backend Brain MVP Tests\n');
  console.log('=' .repeat(60));
  
  // CLEANUP: Delete data/db.json before running tests to ensure clean state
  const dbPath = join(__dirname, '..', 'data', 'db.json');
  
  try {
    if (await fs.access(dbPath).then(() => true).catch(() => false)) {
      await fs.unlink(dbPath);
      console.log('✅ Deleted data/db.json');
    }
    
    // Note: The server will auto-create an empty database on next request
    // Wait for any pending operations to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
  } catch (err) {
    console.warn('⚠️  Warning: Could not delete data/db.json:', err);
  }
  
  const testFiles = [
    join(__dirname, 'auth.test.ts'),
    join(__dirname, 'projects.test.ts'),
    join(__dirname, 'execute.test.ts'),
  ];

  const results: TestResult = {
    pass: 0,
    fail: 0,
    skip: 0,
    todo: 0,
    duration: 0,
  };

  const startTime = Date.now();

  try {
    const stream = run({
      files: testFiles,
      concurrency: 1,
      timeout: 30000,
    });

    stream.on('test:pass', () => {
      results.pass++;
    });

    stream.on('test:fail', () => {
      results.fail++;
    });

    stream.on('test:skip', () => {
      results.skip++;
    });

    stream.on('test:todo', () => {
      results.todo++;
    });

    stream.compose(new specReporter()).pipe(process.stdout);

    await new Promise<void>((resolve, reject) => {
      stream.on('end', resolve);
      stream.on('error', reject);
    });

    results.duration = Date.now() - startTime;

    console.log('\n' + '='.repeat(60));
    console.log('\n📊 Test Summary:');
    console.log(`   ✅ Passed: ${results.pass}`);
    console.log(`   ❌ Failed: ${results.fail}`);
    console.log(`   ⏭️  Skipped: ${results.skip}`);
    console.log(`   📝 Todo: ${results.todo}`);
    console.log(`   ⏱️  Duration: ${results.duration}ms`);
    console.log('\n' + '='.repeat(60) + '\n');

    const resultsFile = join(__dirname, 'test-results.json');
    await fs.writeFile(resultsFile, JSON.stringify(results, null, 2));
    console.log(`📄 Results exported to: ${resultsFile}\n`);

    process.exit(results.fail > 0 ? 1 : 0);
  } catch (error) {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}

export { runTests, TestResult };
