# Package.json Scripts Patch

## Scripts to Add
Add these scripts to the "scripts" section of package.json:

```json
"lint": "eslint . --ext .ts,.js,.tsx",
"lint:fix": "eslint . --ext .ts,.js,.tsx --fix",
"typecheck": "tsc -p tsconfig.json --noEmit",
"test:unit": "node test/run-unit-tests.cjs",
"test:integration": "TEST_PORT=5001 node test/run-all-tests.cjs",
"test:e2e": "playwright test",
"test": "npm run test:unit && npm run test:integration",
"coverage": "nyc --reporter=lcov --reporter=text npm run test:unit",
"docker:build": "docker build -t ybuilt:local .",
"docker:push": "docker build -t ghcr.io/OWNER/REPO:${GIT_SHA:-local} . && docker push ghcr.io/OWNER/REPO:${GIT_SHA:-local}",
"release": "semantic-release",
"mutation": "stryker run"
```

## Git Command to Apply
Manual edit required - add scripts to package.json "scripts" section
