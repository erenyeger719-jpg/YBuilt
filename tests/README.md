# Backend Brain MVP Tests

Comprehensive unit tests for the Backend Brain MVP endpoints covering authentication, projects, and code execution.

## Test Files

- **auth.test.ts** - Authentication endpoint tests (register, login, JWT validation)
- **projects.test.ts** - Project CRUD and collaboration tests
- **execute.test.ts** - Code execution endpoint tests

## Running Tests

### Run All Tests

```bash
tsx tests/run-all.ts
```

Or use the shell script:

```bash
./tests/run-tests.sh
```

### Run Individual Test Files

```bash
# Auth tests only
tsx --test tests/auth.test.ts

# Projects tests only
tsx --test tests/projects.test.ts

# Execute tests only
tsx --test tests/execute.test.ts
```

## Prerequisites

1. **Server must be running** on port 5000 (or set TEST_BASE_URL environment variable)
2. **Environment variables** (optional):
   - `TEST_BASE_URL` - Base URL for API (default: http://localhost:5000)
   - `JWT_SECRET` - JWT secret for token verification (default: 'your-secret-key')
   - `ENABLE_CODE_EXECUTION` - Set to 'true' to enable actual code execution tests
   - `CODE_EXECUTION_TIMEOUT` - Execution timeout in ms (default: 5000)
   - `CODE_EXECUTION_MAX_OUTPUT` - Max output size (default: 10000)

## Starting the Server for Tests

In a separate terminal:

```bash
npm run dev
```

Then run tests in another terminal.

## Test Database

Tests use temporary database files that are automatically cleaned up:
- `./data/test-auth-db.json`
- `./data/test-projects-db.json`
- `./data/test-execute-db.json`

## Test Results

Test results are exported to `tests/test-results.json` after each run with the following format:

```json
{
  "pass": 25,
  "fail": 0,
  "skip": 0,
  "todo": 0,
  "duration": 3500
}
```

## Test Coverage

### Authentication Tests (auth.test.ts)

- ✅ POST /api/auth/register - Valid registration
- ✅ POST /api/auth/register - Invalid email format (400)
- ✅ POST /api/auth/register - Password too short (400)
- ✅ POST /api/auth/register - Duplicate email (409)
- ✅ JWT token payload verification (sub and email)
- ✅ POST /api/auth/login - Valid credentials
- ✅ POST /api/auth/login - Wrong password (401)
- ✅ POST /api/auth/login - Non-existent email (401)
- ✅ Login token validation

### Project Tests (projects.test.ts)

- ✅ POST /api/jobs - Create project with auth
- ✅ POST /api/jobs - Requires authentication (401)
- ✅ GET /api/projects/user/:userId - Get user's projects
- ✅ GET /api/projects/user/:userId - Cannot access other user's projects (403)
- ✅ GET /api/jobs/:id - Get specific project
- ✅ GET /api/jobs/:id - Non-existent project (404)
- ✅ POST /api/projects/:id/collaborators - Add collaborator
- ✅ GET /api/projects/:id/collaborators - Get collaborators
- ✅ DELETE /api/projects/:id/collaborators/:userId - Remove collaborator
- ✅ Collaboration permission tests (403 for non-owners)
- ✅ POST /api/projects/:id/commits - Create commit
- ✅ GET /api/projects/:id/commits - Get commit history

### Code Execution Tests (execute.test.ts)

- ✅ POST /api/execute - Execute simple JavaScript
- ✅ POST /api/execute - Returns stdout with output
- ✅ POST /api/execute - Respects timeout
- ✅ POST /api/execute - Timeout enforcement
- ✅ POST /api/execute - Unsupported language (400)
- ✅ Output limit enforcement (MAX_CODE_OUTPUT)
- ✅ POST /api/execute - Requires authentication (401)
- ✅ GET /api/execute/languages - Get supported languages
- ✅ GET /api/execute/history - Get execution history
- ✅ GET /api/execute/history - Requires authentication (401)
- ✅ GET /api/execute/:id - Get execution details
- ✅ GET /api/execute/:id - Non-existent execution (404)

## CI/CD Integration

To run tests in CI/CD pipelines:

```yaml
# Example GitHub Actions
- name: Start server
  run: npm run dev &
  
- name: Wait for server
  run: sleep 5

- name: Run tests
  run: tsx tests/run-all.ts
  env:
    ENABLE_CODE_EXECUTION: 'true'
```

## Troubleshooting

**Tests failing with connection errors?**
- Ensure the server is running on the expected port
- Check TEST_BASE_URL environment variable

**Code execution tests failing?**
- Set `ENABLE_CODE_EXECUTION=true` to enable actual code execution
- Without this flag, execution tests verify the disabled state works correctly

**Database errors?**
- Ensure the `./data` directory exists and is writable
- Check that test database files can be created and deleted
