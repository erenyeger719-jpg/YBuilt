const { spawn } = require('child_process');
const fetch = require('node-fetch');

function startServer(env = {}) {
  const child = spawn('npx', ['tsx', 'server/index.ts'], {
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  child.stdout.on('data', d => process.stdout.write(`[server] ${d}`));
  child.stderr.on('data', d => process.stderr.write(`[server-err] ${d}`));
  return child;
}

async function waitForServer(url, timeout = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(url);
      if (res && (res.status === 200 || res.status === 204 || res.ok)) return;
    } catch (e) {}
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error('Server did not start in time at ' + url);
}

function stopServer(child) {
  return new Promise((resolve) => {
    if (!child || child.killed) return resolve();
    child.on('exit', () => resolve());
    child.kill('SIGINT');
    setTimeout(() => { try { child.kill('SIGKILL'); } catch(e){}; resolve(); }, 3000);
  });
}

module.exports = { startServer, waitForServer, stopServer };
