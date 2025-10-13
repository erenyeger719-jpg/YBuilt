const { startServer, waitForServer, stopServer } = require('./harness.cjs');
const { execSync } = require('child_process');
const PORT = process.env.TEST_PORT || 5001;
const base = `http://localhost:${PORT}`;

(async () => {
  const server = startServer({ NODE_ENV: 'test', PORT: PORT });
  try {
    await waitForServer(`${base}/health`, 15000).catch(() => waitForServer(`${base}/api/metrics`, 15000));
    console.log('Server started; running tests...');
    // run tests in sequence; fail fast and stop server on failure
    const testList = [
      'node test/jobid-roundtrip.test.cjs',
      'node test/library-to-workspace.test.cjs',
      'node test/security-path-traversal.test.cjs',
      'node test/upload-sanitization.test.cjs',
      'node test/e2e-publish.test.cjs'
    ];
    for (const t of testList) {
      console.log('Running', t);
      execSync(t, { stdio: 'inherit', env: { ...process.env, TEST_PORT: PORT } });
    }
    console.log('ALL TESTS PASSED');
    process.exitCode = 0;
  } catch (err) {
    console.error('TESTS FAILED', err && err.message);
    process.exitCode = 2;
  } finally {
    await stopServer(server);
  }
})();
