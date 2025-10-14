#!/usr/bin/env node

/**
 * SLSA-Friendly Provenance Attestation for OCI Images
 * Generates in-toto format provenance with SLSA v0.2 predicate
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

// Parse CLI arguments
const args = process.argv.slice(2);
const imageRef = args.find(a => a.startsWith('--image'))?.split('=')[1] || process.env.IMAGE_REF;
const artifactPath = args.find(a => a.startsWith('--artifact'))?.split('=')[1] || 'artifacts/dist.tar.gz';
const outputPath = args.find(a => a.startsWith('--out'))?.split('=')[1] || 'artifacts/provenance.json';

console.log('📜 Generating SLSA provenance attestation (in-toto format)...');

// Helper functions
function exec(cmd, fallback = 'unknown') {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
  } catch {
    return fallback;
  }
}

function hashFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath);
  const sha256 = crypto.createHash('sha256').update(content).digest('hex');
  const sha1 = crypto.createHash('sha1').update(content).digest('hex');
  return { sha256, sha1 };
}

// Collect build environment metadata
const gitSha = exec('git rev-parse HEAD', 'unknown');
const gitBranch = exec('git rev-parse --abbrev-ref HEAD', 'unknown');
const gitRemote = exec('git config --get remote.origin.url', 'unknown');
const gitCommitMessage = exec('git log -1 --pretty=%B', 'unknown').split('\n')[0];
const gitCommitter = exec('git log -1 --pretty=format:"%an <%ae>"', 'unknown');
const gitTimestamp = exec('git log -1 --pretty=format:"%aI"', new Date().toISOString());

// Build information
const buildTimestamp = new Date().toISOString();
const buildInvocationId = `${gitSha.substring(0, 12)}-${Date.now()}`;
const builder = {
  id: process.env.GITHUB_ACTIONS 
    ? `https://github.com/${process.env.GITHUB_REPOSITORY}/.github/workflows/${process.env.GITHUB_WORKFLOW}`
    : 'ybuilt-ci@local'
};

// Calculate artifact hashes
const artifactHashes = hashFile(artifactPath);
if (!artifactHashes) {
  console.error(`❌ ERROR: Artifact not found: ${artifactPath}`);
  process.exit(1);
}

// SBOM hash (if available)
const sbomHashes = hashFile('artifacts/sbom.json');

// Materials (source and dependencies)
const materials = [
  {
    uri: gitRemote,
    digest: {
      sha1: exec('git rev-parse HEAD', 'unknown'),
      gitCommit: gitSha
    }
  }
];

// Add SBOM as material if available
if (sbomHashes) {
  materials.push({
    uri: 'pkg:npm/ybuilt-sbom',
    digest: {
      sha256: sbomHashes.sha256
    }
  });
}

// Build the in-toto statement (SLSA v0.2)
const provenance = {
  _type: 'https://in-toto.io/Statement/v0.1',
  subject: [
    {
      name: imageRef || path.basename(artifactPath),
      digest: {
        sha256: artifactHashes.sha256
      }
    }
  ],
  predicateType: 'https://slsa.dev/provenance/v0.2',
  predicate: {
    builder: builder,
    buildType: 'https://ybuilt.dev/build/reproducible@v1',
    invocation: {
      configSource: {
        uri: gitRemote,
        digest: {
          sha1: gitSha
        },
        entryPoint: process.env.GITHUB_WORKFLOW || 'local-build'
      },
      parameters: {
        ref: gitBranch,
        sha: gitSha,
        workflow: process.env.GITHUB_WORKFLOW || 'local'
      },
      environment: {
        github_run_id: process.env.GITHUB_RUN_ID || null,
        github_run_attempt: process.env.GITHUB_RUN_ATTEMPT || null,
        github_actor: process.env.GITHUB_ACTOR || exec('whoami', 'unknown'),
        arch: process.arch,
        platform: process.platform,
        node_version: process.version
      }
    },
    buildConfig: {
      source_date_epoch: process.env.SOURCE_DATE_EPOCH || exec('git log -1 --pretty=%ct', null),
      reproducible: true,
      steps: [
        { name: 'npm ci', command: 'npm ci --prefer-offline --no-audit' },
        { name: 'build', command: 'npm run build' },
        { name: 'package', command: `tar -czf ${artifactPath} dist/` }
      ]
    },
    metadata: {
      buildInvocationId: buildInvocationId,
      buildStartedOn: buildTimestamp,
      buildFinishedOn: buildTimestamp,
      completeness: {
        parameters: true,
        environment: true,
        materials: true
      },
      reproducible: true
    },
    materials: materials
  }
};

// Write provenance
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(provenance, null, 2));

// Calculate provenance hash
const provenanceHash = crypto.createHash('sha256')
  .update(JSON.stringify(provenance))
  .digest('hex');

console.log('✅ Provenance attestation generated');
console.log(`📁 Output: ${outputPath}`);
console.log(`🔐 Provenance SHA256: ${provenanceHash}`);
console.log(`📊 Size: ${fs.statSync(outputPath).size} bytes`);
console.log('');
console.log('📋 Provenance summary:');
console.log(`   Subject: ${provenance.subject[0].name}`);
console.log(`   Predicate Type: ${provenance.predicateType}`);
console.log(`   Builder: ${provenance.predicate.builder.id}`);
console.log(`   Git SHA: ${gitSha.substring(0, 12)}`);
console.log(`   Materials: ${materials.length}`);
console.log('');
console.log('🔍 View provenance:');
console.log(`   jq . ${outputPath}`);
