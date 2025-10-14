#!/usr/bin/env node

/**
 * Verify that package-lock.json is in sync with package.json
 * Exit non-zero if mismatch detected
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.join(__dirname, '..');
const packageJsonPath = path.join(rootDir, 'package.json');
const lockfilePath = path.join(rootDir, 'package-lock.json');

console.log('🔍 Verifying lockfile integrity...');

// Check if files exist
if (!fs.existsSync(packageJsonPath)) {
  console.error('❌ package.json not found');
  process.exit(1);
}

if (!fs.existsSync(lockfilePath)) {
  console.error('❌ package-lock.json not found');
  console.error('💡 Run: npm install');
  process.exit(1);
}

try {
  // Read package files
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const lockfile = JSON.parse(fs.readFileSync(lockfilePath, 'utf8'));

  // Verify lockfile version matches package.json
  if (packageJson.version !== lockfile.version) {
    console.error('❌ Version mismatch between package.json and package-lock.json');
    console.error(`   package.json: ${packageJson.version}`);
    console.error(`   lockfile: ${lockfile.version}`);
    process.exit(1);
  }

  // Verify lockfile name matches package.json
  if (packageJson.name !== lockfile.name) {
    console.error('❌ Name mismatch between package.json and package-lock.json');
    console.error(`   package.json: ${packageJson.name}`);
    console.error(`   lockfile: ${lockfile.name}`);
    process.exit(1);
  }

  // Run npm ci --dry-run to detect any inconsistencies
  console.log('🔄 Running npm ci --dry-run to verify consistency...');
  try {
    execSync('npm ci --dry-run --prefer-offline', {
      cwd: rootDir,
      stdio: 'pipe',
      encoding: 'utf8'
    });
  } catch (error) {
    console.error('❌ npm ci --dry-run failed');
    console.error(error.message);
    console.error('💡 Remediation: npm install && git add package-lock.json');
    process.exit(1);
  }

  console.log('✅ Lockfile verification passed');
  process.exit(0);

} catch (error) {
  console.error('❌ Lockfile verification failed:', error.message);
  console.error('💡 Remediation: rm -rf node_modules package-lock.json && npm install');
  process.exit(1);
}
