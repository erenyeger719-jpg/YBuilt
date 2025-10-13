const { validateAndResolvePath } = require('../server/utils/paths.js');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');

async function runTests() {
  console.log('Running symlink protection tests...\n');
  
  let tempDir;
  let workspaceDir;
  let outsideDir;
  let passed = 0;
  let failed = 0;
  
  try {
    // Setup: Create temporary directories
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'symlink-test-'));
    workspaceDir = path.join(tempDir, 'workspace');
    outsideDir = path.join(tempDir, 'outside');
    
    await fs.mkdir(workspaceDir, { recursive: true });
    await fs.mkdir(outsideDir, { recursive: true });
    
    // Create a legitimate file inside workspace
    const legitFile = path.join(workspaceDir, 'legit.txt');
    await fs.writeFile(legitFile, 'legitimate content');
    
    // Create a file outside workspace
    const outsideFile = path.join(outsideDir, 'secret.txt');
    await fs.writeFile(outsideFile, 'secret data');
    
    // Test 1: Symlink inside workspace pointing outside → should throw 403
    console.log('Test 1: Symlink pointing outside workspace...');
    try {
      const symlinkPath = path.join(workspaceDir, 'evil-link');
      await fs.symlink(outsideFile, symlinkPath);
      
      try {
        await validateAndResolvePath(workspaceDir, 'evil-link');
        console.log('  ❌ FAILED: Should have thrown 403 error');
        failed++;
      } catch (err) {
        if (err.code === 403) {
          console.log('  ✅ PASSED: Correctly rejected symlink escape');
          passed++;
        } else {
          console.log(`  ❌ FAILED: Wrong error code: ${err.code}`);
          failed++;
        }
      }
    } catch (setupErr) {
      console.log(`  ⚠️  SKIPPED: Could not create symlink: ${setupErr.message}`);
    }
    
    // Test 2: Symlink to legitimate file inside workspace → should succeed
    console.log('\nTest 2: Symlink to legitimate file inside workspace...');
    try {
      const goodSymlink = path.join(workspaceDir, 'good-link');
      await fs.symlink(legitFile, goodSymlink);
      
      const resolved = await validateAndResolvePath(workspaceDir, 'good-link');
      if (resolved && resolved.includes('legit.txt')) {
        console.log('  ✅ PASSED: Accepted legitimate symlink');
        passed++;
      } else {
        console.log('  ❌ FAILED: Did not resolve correctly');
        failed++;
      }
    } catch (err) {
      console.log(`  ❌ FAILED: ${err.message}`);
      failed++;
    }
    
    // Test 3: Non-existent file (normal case) → should succeed
    console.log('\nTest 3: Non-existent file (normal case)...');
    try {
      const resolved = await validateAndResolvePath(workspaceDir, 'newfile.txt');
      if (resolved && resolved.includes('newfile.txt')) {
        console.log('  ✅ PASSED: Accepted non-existent file');
        passed++;
      } else {
        console.log('  ❌ FAILED: Did not resolve correctly');
        failed++;
      }
    } catch (err) {
      console.log(`  ❌ FAILED: ${err.message}`);
      failed++;
    }
    
  } catch (err) {
    console.error('Test setup failed:', err);
    process.exit(1);
  } finally {
    // Cleanup
    if (tempDir) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (cleanupErr) {
        console.error('Cleanup failed:', cleanupErr.message);
      }
    }
  }
  
  // Summary
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Symlink Protection Tests Complete`);
  console.log(`Passed: ${passed}, Failed: ${failed}`);
  console.log('='.repeat(50));
  
  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('\n✅ All symlink protection tests passed!');
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
