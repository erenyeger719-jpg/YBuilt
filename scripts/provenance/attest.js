#!/usr/bin/env node

/**
 * Provenance Attestation Generator
 * Creates SLSA-inspired provenance metadata for build artifacts
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

// Parse CLI arguments
const args = process.argv.slice(2);
const artifactPath = args.find(a => a.startsWith('--artifact'))?.split('=')[1] || 'dist/';
const outputPath = args.find(a => a.startsWith('--out'))?.split('=')[1] || 'artifacts/provenance.json';
const shouldSign = process.env.GPG_SIGN === 'true';

console.log('📜 Generating provenance attestation...');

// Helper functions
function exec(cmd, fallback = 'unknown') {
  try {
    return execSync(cmd, { encoding: 'utf8' }).trim();
  } catch {
    return fallback;
  }
}

function hashFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

function hashDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) return null;
  
  const files = [];
  function walk(dir) {
    const items = fs.readdirSync(dir);
    items.forEach(item => {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
      } else {
        files.push(fullPath);
      }
    });
  }
  
  walk(dirPath);
  files.sort();
  
  const hash = crypto.createHash('sha256');
  files.forEach(file => {
    const content = fs.readFileSync(file);
    hash.update(content);
  });
  
  return hash.digest('hex');
}

// Collect build metadata
const gitSha = exec('git rev-parse HEAD', 'unknown');
const gitBranch = exec('git rev-parse --abbrev-ref HEAD', 'unknown');
const gitRemote = exec('git config --get remote.origin.url', 'unknown');
const gitCommitMessage = exec('git log -1 --pretty=%B', 'unknown');
const gitCommitter = exec('git log -1 --pretty=format:"%an <%ae>"', 'unknown');
const gitTimestamp = exec('git log -1 --pretty=format:"%aI"', new Date().toISOString());

const sbomPath = 'artifacts/sbom.json';
const sbomHash = hashFile(sbomPath) || hashFile('artifacts/sbom.sha256')?.trim();

// Calculate artifact hash
const artifactHash = fs.statSync(artifactPath).isDirectory()
  ? hashDirectory(artifactPath)
  : hashFile(artifactPath);

// Build provenance document
const provenance = {
  _type: 'https://in-toto.io/Statement/v0.1',
  subject: [
    {
      name: path.basename(artifactPath),
      digest: {
        sha256: artifactHash
      }
    }
  ],
  predicateType: 'https://slsa.dev/provenance/v0.2',
  predicate: {
    builder: {
      id: 'ybuilt-ci@v1'
    },
    buildType: 'https://ybuilt.dev/ci/build/v1',
    invocation: {
      configSource: {
        uri: gitRemote,
        digest: {
          sha1: gitSha
        },
        entryPoint: process.env.GITHUB_WORKFLOW || 'local-build'
      },
      parameters: {
        branch: gitBranch,
        commitMessage: gitCommitMessage,
        committer: gitCommitter
      },
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        ci: process.env.CI === 'true',
        github: !!process.env.GITHUB_ACTIONS
      }
    },
    buildConfig: {
      steps: [
        { command: 'npm ci' },
        { command: 'npm run build' },
        { command: 'npm run sbom' }
      ]
    },
    metadata: {
      buildInvocationId: process.env.GITHUB_RUN_ID || `local-${Date.now()}`,
      buildStartedOn: new Date().toISOString(),
      buildFinishedOn: new Date().toISOString(),
      completeness: {
        parameters: true,
        environment: true,
        materials: true
      },
      reproducible: true
    },
    materials: [
      {
        uri: gitRemote,
        digest: {
          sha1: gitSha,
          gitCommit: gitSha
        }
      }
    ]
  },
  ybuilt: {
    version: '1.0.0',
    sbom: {
      uri: sbomPath,
      digest: {
        sha256: sbomHash
      }
    },
    git: {
      sha: gitSha,
      branch: gitBranch,
      remote: gitRemote,
      commit: {
        message: gitCommitMessage,
        author: gitCommitter,
        timestamp: gitTimestamp
      }
    },
    build: {
      timestamp: new Date().toISOString(),
      runner: process.env.GITHUB_ACTIONS ? 'github-actions' : 'local',
      runId: process.env.GITHUB_RUN_ID || null,
      jobId: process.env.GITHUB_JOB || null
    }
  }
};

// Ensure output directory exists
const outputDir = path.dirname(outputPath);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Write provenance
fs.writeFileSync(outputPath, JSON.stringify(provenance, null, 2));
console.log('✅ Provenance attestation generated');
console.log(`📁 Output: ${outputPath}`);
console.log(`🔐 Artifact SHA256: ${artifactHash}`);
console.log(`📦 SBOM SHA256: ${sbomHash || 'not found'}`);
console.log(`🌳 Git SHA: ${gitSha}`);

// Optional: Sign the provenance
if (shouldSign && process.env.GPG_PRIVATE_KEY) {
  try {
    console.log('\n🔐 Signing provenance with GPG...');
    
    // Import key
    execSync(`echo "${process.env.GPG_PRIVATE_KEY}" | gpg --batch --import`, {
      stdio: 'pipe'
    });
    
    // Sign
    const signaturePath = `${outputPath}.sig`;
    execSync(`gpg --armor --output "${signaturePath}" --detach-sign "${outputPath}"`);
    
    console.log(`✅ Provenance signed: ${signaturePath}`);
  } catch (err) {
    console.error('⚠️  Warning: Failed to sign provenance:', err.message);
  }
}

console.log('\n✅ Provenance attestation complete');
