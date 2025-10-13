# YBUILT E2E Test Suite

This directory contains comprehensive end-to-end (E2E) test scripts for YBUILT workspace features.

## Test Files

### 1. `generate.test.js`
Tests the basic AI generation flow including:
- Job creation via POST /api/generate
- Job status polling and transitions (queued → generating → ready_for_finalization)
- HTML preview file creation in `public/previews/{jobId}/index.html`
- Build trace creation in `data/jobs/{jobId}/build-trace.json`
- Error handling for invalid prompts
- Build trace API endpoint

### 2. `workflow.test.js`
Tests the complete workspace workflow including:
- Job creation and completion
- Workspace file operations:
  - List files (GET /api/workspace/:jobId/files)
  - Read file (GET /api/workspace/:jobId/file?path=...)
  - Create file (POST /api/workspace/:jobId/file)
  - Update file (PUT /api/workspace/:jobId/files/:filePath)
  - Delete file (DELETE /api/workspace/:jobId/file?path=...)
  - Upload file (POST /api/workspace/:jobId/upload)
- Build trace retrieval (GET /api/jobs/:jobId/build-trace)
- SSE streaming (GET /api/jobs/:jobId/build-trace/stream)
- Error handling for invalid jobIds and file paths

## Prerequisites

- Node.js 18+ (for native fetch API support)
- YBUILT application running on http://localhost:5000 (or custom BASE_URL)

## Running Tests

### Run individual test suites:

```bash
# Test basic generation flow
node test/generate.test.js

# Test complete workspace workflow
node test/workflow.test.js
```

### Run all tests:

```bash
# Run both test suites
node test/generate.test.js && node test/workflow.test.js
```

### Using custom base URL:

```bash
# Test against different environment
BASE_URL=http://localhost:3000 node test/generate.test.js
```

## Test Configuration

Both test files support the following environment variables:

- `BASE_URL` - Base URL of the YBUILT API (default: `http://localhost:5000`)

Example:
```bash
export BASE_URL=http://localhost:5000
node test/generate.test.js
```

## Test Output

The tests provide detailed console output with:
- ✅ Success indicators for passed tests
- ❌ Error indicators for failed tests
- 📝 Descriptive logging for each test step
- Test summaries and statistics

Example output:
```
🚀 Starting Generation E2E Tests

==================================================
📝 Testing POST /api/generate...
✅ Job created with ID: abc-123-def

🔄 Testing job status transitions...
   Status: queued
   Status: generating
   Status: ready_for_finalization
✅ Status transitions verified: queued → generating → ready_for_finalization

📄 Testing HTML file creation...
✅ HTML file created at: public/previews/abc-123-def/index.html
   File size: 2048 bytes

==================================================
✅ All generation tests passed!
==================================================
```

## Test Coverage

### Generation Tests
1. ✅ Job creation via API
2. ✅ Status transition monitoring
3. ✅ HTML preview file verification
4. ✅ Build trace file creation
5. ✅ Invalid prompt error handling
6. ✅ Build trace API endpoint

### Workflow Tests
1. ✅ Job creation and completion
2. ✅ File listing
3. ✅ File reading
4. ✅ File creation
5. ✅ File updating
6. ✅ File deletion
7. ✅ File upload (multipart form data)
8. ✅ Build trace retrieval
9. ✅ SSE streaming connection
10. ✅ Invalid jobId error handling
11. ✅ Invalid file path error handling

## Troubleshooting

### Tests fail with "fetch is not defined"
- Ensure you're using Node.js 18 or higher
- Run `node --version` to check your version

### Tests timeout
- Increase the TEST_TIMEOUT value in the test files (default: 30000ms)
- Ensure the YBUILT application is running and accessible

### Connection refused errors
- Verify the YBUILT application is running on the expected port
- Check the BASE_URL environment variable is set correctly

### File not found errors
- Ensure the YBUILT application has completed job processing
- Check file permissions in the `public/previews` and `data/jobs` directories

## Adding New Tests

To add new tests:

1. Create test functions following the naming convention: `testYourFeature()`
2. Use the provided helper functions:
   - `apiRequest(endpoint, options)` - Make API requests
   - `waitForCondition(conditionFn, timeout, interval)` - Wait for async conditions
3. Add assertions using Node.js `assert` module
4. Include descriptive console logging
5. Add the test to the `runTests()` function

Example:
```javascript
async function testNewFeature(jobId) {
  console.log('🔧 Testing new feature...');
  
  const { response, data } = await apiRequest(`/api/feature/${jobId}`);
  
  assert.strictEqual(response.status, 200, 'Should return 200');
  assert.ok(data.result, 'Should have result');
  
  console.log('✅ New feature test passed\n');
}
```

## CI/CD Integration

These tests can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run E2E Tests
  run: |
    npm run dev &
    sleep 5
    node test/generate.test.js
    node test/workflow.test.js
```

## Notes

- Tests create temporary files and jobs that are cleaned up automatically
- Each test suite is independent and can run in isolation
- Tests use the same storage backend as the application
- Build traces and logs are generated during test execution
