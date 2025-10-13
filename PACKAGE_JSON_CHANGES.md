# Required package.json Changes

## Context
The test infrastructure requires `tsx` dependency and `qa`/`test` scripts to be properly configured in package.json for CI readiness. This document outlines the required changes.

## Dependencies

### Check if tsx is installed
The `tsx` package is already installed in this project. You can verify by checking:
```bash
npm list tsx
```

If not installed, add tsx to devDependencies:
```json
{
  "devDependencies": {
    "tsx": "^4.20.5"
  }
}
```

## Scripts

Add test and qa scripts to package.json:
```json
{
  "scripts": {
    "start": "node server/index.js",
    "dev": "NODE_ENV=development tsx server/index.ts",
    "test": "node test/run-all-tests.cjs",
    "qa": "node test/run-all-tests.cjs"
  }
}
```

### Script Descriptions
- `test`: Runs the complete test suite with server lifecycle management
- `qa`: Alias for `test` - runs all quality assurance tests
- Both scripts execute `test/run-all-tests.cjs` which orchestrates:
  - Server startup on TEST_PORT (default: 5001)
  - Sequential test execution
  - Proper server shutdown

## Installation

After updating package.json, run:
```bash
npm install
```

## Verification

Test the qa script:
```bash
npm run qa
```

Expected output:
- Server starts on test port
- All tests run sequentially
- Server stops cleanly
- Exit code 0 for success

## Environment Variables

The test suite supports these environment variables:
- `TEST_PORT` - Port for test server (default: 5001)
- `NODE_ENV=test` - Test mode
- `LOG_LEVEL` - DEBUG|INFO|WARN|ERROR (for controlling log verbosity)

## Related Files

See `test/README.md` for detailed test infrastructure documentation.
