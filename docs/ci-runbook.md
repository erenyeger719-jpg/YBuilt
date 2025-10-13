# CI Runbook

## Local Development Commands

### Building the Project
```bash
npm run build
```
This compiles TypeScript and bundles the server using esbuild.

### Running Tests

#### Unit Tests
```bash
npm run test:unit
```
Runs isolated unit tests for utilities and helpers.

#### Integration Tests
```bash
TEST_PORT=5001 npm run test:integration
```
Runs full end-to-end integration tests with server startup.

#### All Tests
```bash
npm test
```
Runs both unit and integration tests in sequence.

### Linting and Type Checking

#### Lint
```bash
npm run lint          # Check for linting errors
npm run lint:fix      # Auto-fix linting errors
```

#### Type Check
```bash
npm run typecheck
```
Runs TypeScript compiler in check-only mode (no output files).

## Docker Commands

### Build Docker Image
```bash
npm run docker:build
# or
docker build -t ybuilt:local .
```

### Run Tests in Docker
```bash
npm run docker:up
# or
docker-compose -f docker-compose.ci.yml up --build --abort-on-container-exit
```

This starts the app container and runs tests in isolation.

## CI Workflow Explanation

The CI pipeline consists of several jobs:

### 1. Lint and Type Check
- Runs on Node.js 18 and 20 (matrix)
- Executes `npm run lint` and `npm run typecheck`
- Catches syntax and type errors early

### 2. Build
- Compiles the application
- Uploads build artifacts for later jobs

### 3. Unit Tests
- Runs isolated unit tests
- Fast feedback for utility functions

### 4. Integration Tests
- Starts test server on port 5001
- Runs end-to-end tests
- Uploads logs on failure

### 5. Security Audit
- Runs `npm audit --audit-level=moderate`
- Checks for known vulnerabilities

## Troubleshooting Common Issues

### Port Already in Use
If tests fail with "port already in use":
```bash
lsof -ti:5001 | xargs kill
# or
npx kill-port 5001
```

### Path Validation Errors
If you see "Forbidden path" errors:
- Check for path traversal attempts (.., backslashes)
- Ensure files are within the workspace directory
- Review symlink targets (must point inside workspace)

### Atomic Write Failures
If atomic writes fail:
- Check disk space: `df -h`
- Verify directory permissions
- Check USE_ATOMIC_FSYNC environment variable

### Test Timeouts
For slow environments, increase server startup timeout:
```bash
STARTUP_TIMEOUT=30000 npm test
```

### Docker Build Issues
If Docker build fails:
- Clear Docker cache: `docker system prune -a`
- Check .dockerignore is not excluding required files
- Verify multi-stage build copies dist/ correctly

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| NODE_ENV | development | Environment mode |
| PORT | 5000 | Server port |
| TEST_PORT | 5001 | Port for test server |
| LOG_LEVEL | INFO | Logging level (DEBUG, INFO, WARN, ERROR) |
| LOG_FORMAT | text | Log format (text or json) |
| USE_ATOMIC_FSYNC | true | Enable parent dir fsync in atomic writes |
| RAZORPAY_MODE | mock | Razorpay mode (mock or live) |

## Continuous Integration

### On Push/PR
1. All jobs run automatically
2. Must pass before merge
3. Artifacts uploaded on failure

### Security Scans
- Weekly Dependabot PRs for dependencies
- npm audit on every push
- Secret scanning (regex-based)

### Manual Workflows
Run specific tests manually:
```bash
# Just lint
npm run lint

# Just typecheck  
npm run typecheck

# Just build
npm run build
```

## Best Practices

1. **Run tests before pushing**: `npm test`
2. **Fix lint errors**: `npm run lint:fix`
3. **Check types**: `npm run typecheck`
4. **Test in Docker locally**: `npm run docker:up`
5. **Review CI logs** if tests fail in CI but pass locally
