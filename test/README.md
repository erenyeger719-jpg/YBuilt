# Test Infrastructure

## Setup Requirements

Before running tests, ensure package.json is properly configured:

1. **Required Dependencies**: Verify `tsx` is installed in devDependencies
2. **Required Scripts**: Ensure `test` and `qa` scripts are configured
3. See `PACKAGE_JSON_CHANGES.md` for detailed setup instructions

## Running Tests

### Full test suite (with server management):
```bash
npm run qa
# or
TEST_PORT=5001 node test/run-all-tests.cjs
```

### Individual tests:
```bash
node test/jobid-roundtrip.test.cjs
node test/security-path-traversal.test.cjs
node test/upload-sanitization.test.cjs
```

## Environment Variables
- `TEST_PORT` - Port for test server (default: 5001)
- `NODE_ENV=test` - Test mode
- `LOG_LEVEL` - DEBUG|INFO|WARN|ERROR

## Test Harness
- `test/harness.cjs` - Start/stop/wait utilities
- `test/run-all-tests.cjs` - Orchestrates all tests with server lifecycle
- `test/upload-helper.cjs` - Multipart upload helper

## Server Lifecycle
1. Start server on TEST_PORT
2. Wait for /health or /api/metrics
3. Run tests sequentially
4. Stop server (SIGINT → SIGKILL after 3s)

## Test Files
- jobid-roundtrip.test.cjs - UUID persistence
- library-to-workspace.test.cjs - Draft→Workspace flow
- security-path-traversal.test.cjs - Path security
- upload-sanitization.test.cjs - File upload security
- e2e-publish.test.cjs - Full publish pipeline
