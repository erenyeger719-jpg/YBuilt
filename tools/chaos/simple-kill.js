#!/usr/bin/env node

/**
 * Simple Chaos Tool
 * 
 * Spawns a child process, waits, then kills it to test resilience
 * Only runs in CI with manual approval
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const TARGET_COMMAND = process.env.CHAOS_TARGET || 'npm run dev';
const KILL_DELAY = parseInt(process.env.CHAOS_KILL_DELAY || '10000', 10); // ms
const SIGNAL = process.env.CHAOS_SIGNAL || 'SIGTERM';
const OUTPUT_DIR = 'artifacts';
const REPORT_FILE = path.join(OUTPUT_DIR, 'chaos-report.json');

// Safety checks
if (process.env.NODE_ENV === 'production') {
  console.error('❌ ERROR: Chaos testing is disabled in production');
  process.exit(1);
}

if (!process.env.CI && !process.env.CHAOS_ENABLED) {
  console.error('❌ ERROR: Chaos testing requires CI=true or CHAOS_ENABLED=true');
  console.error('📝 To enable locally: CHAOS_ENABLED=true node tools/chaos/simple-kill.js');
  process.exit(1);
}

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

console.log('☠️  Simple Chaos Tool v1.0');
console.log(`🎯 Target command: ${TARGET_COMMAND}`);
console.log(`⏱️  Kill delay: ${KILL_DELAY}ms`);
console.log(`⚡ Signal: ${SIGNAL}`);
console.log('');

const report = {
  timestamp: new Date().toISOString(),
  config: {
    targetCommand: TARGET_COMMAND,
    killDelay: KILL_DELAY,
    signal: SIGNAL
  },
  events: [],
  result: null
};

/**
 * Log event
 */
function logEvent(type, message, data = {}) {
  const event = {
    timestamp: new Date().toISOString(),
    type,
    message,
    ...data
  };
  
  report.events.push(event);
  console.log(`[${type.toUpperCase()}] ${message}`);
  
  if (Object.keys(data).length > 0) {
    console.log('   ', JSON.stringify(data, null, 2).replace(/\n/g, '\n    '));
  }
}

/**
 * Main chaos test
 */
async function runChaosTest() {
  logEvent('start', 'Starting chaos test');
  
  // Parse command
  const [cmd, ...args] = TARGET_COMMAND.split(' ');
  
  // Spawn target process
  logEvent('spawn', `Spawning process: ${cmd} ${args.join(' ')}`);
  
  const child = spawn(cmd, args, {
    stdio: 'pipe',
    shell: true
  });
  
  let stdout = '';
  let stderr = '';
  
  child.stdout.on('data', (data) => {
    stdout += data.toString();
  });
  
  child.stderr.on('data', (data) => {
    stderr += data.toString();
  });
  
  child.on('error', (error) => {
    logEvent('error', 'Process error', { error: error.message });
  });
  
  child.on('exit', (code, signal) => {
    logEvent('exit', 'Process exited', { code, signal });
    
    report.result = {
      exitCode: code,
      exitSignal: signal,
      stdoutLines: stdout.split('\n').length,
      stderrLines: stderr.split('\n').length,
      killedByUs: signal === SIGNAL
    };
  });
  
  // Wait for process to start
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  if (child.killed) {
    logEvent('early-exit', 'Process exited before kill delay');
  } else {
    logEvent('wait', `Waiting ${KILL_DELAY}ms before killing process`);
    
    // Wait for kill delay
    await new Promise(resolve => setTimeout(resolve, KILL_DELAY));
    
    // Kill the process
    logEvent('kill', `Sending ${SIGNAL} to process`, { pid: child.pid });
    
    try {
      child.kill(SIGNAL);
    } catch (error) {
      logEvent('kill-error', 'Failed to kill process', { error: error.message });
    }
    
    // Wait for process to die
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Force kill if still alive
    if (!child.killed) {
      logEvent('force-kill', 'Process did not die, sending SIGKILL');
      child.kill('SIGKILL');
    }
  }
  
  // Write report
  report.stdout = stdout;
  report.stderr = stderr;
  
  fs.writeFileSync(
    REPORT_FILE,
    JSON.stringify(report, null, 2)
  );
  
  logEvent('complete', 'Chaos test complete', {
    reportFile: REPORT_FILE,
    eventsCount: report.events.length
  });
  
  // Summary
  console.log('\n📊 Chaos Test Summary:');
  console.log(`   Process killed: ${report.result?.killedByUs ? 'Yes' : 'No'}`);
  console.log(`   Exit code: ${report.result?.exitCode || 'N/A'}`);
  console.log(`   Exit signal: ${report.result?.exitSignal || 'N/A'}`);
  console.log(`   Events logged: ${report.events.length}`);
  console.log(`   Report: ${REPORT_FILE}`);
  
  // Exit
  process.exit(0);
}

// Run
runChaosTest().catch(error => {
  console.error('💥 Chaos test error:', error);
  
  report.result = {
    error: error.message,
    stack: error.stack
  };
  
  fs.writeFileSync(
    REPORT_FILE,
    JSON.stringify(report, null, 2)
  );
  
  process.exit(1);
});
