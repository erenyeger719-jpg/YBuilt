# Backend Brain MVP Implementation Documentation

## Table of Contents
1. [Overview](#overview)
2. [API Endpoints](#api-endpoints)
3. [Environment Variables](#environment-variables)
4. [Running Locally](#running-locally)
5. [Testing](#testing)
6. [Security Considerations](#security-considerations)
7. [Known Limitations](#known-limitations)
8. [Database Schema](#database-schema)
9. [Architecture Decisions](#architecture-decisions)
10. [Future Improvements](#future-improvements)

---

## 1. Overview

The **Backend Brain MVP** is a lightweight backend implementation for the YBuilt platform, providing core functionality for user authentication, project management, AI chat assistance, and code execution.

### Key Features Implemented

- **User Authentication**: JWT-based authentication with bcrypt password hashing
- **Project Management**: Create, read, update projects with collaboration support
- **AI Chat Integration**: Chat endpoints for AI assistant, collaboration, and support
- **Code Execution**: Sandboxed JavaScript execution using vm2 (with security warnings)
- **Version Control**: Project commits and version tracking
- **Collaboration**: Multi-user project collaboration with role-based access

### Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                   Express Server                │
│  ┌──────────────────────────────────────────┐  │
│  │         Middleware Stack                 │  │
│  │  • Helmet (Security Headers)             │  │
│  │  • CORS                                   │  │
│  │  • Rate Limiting (500 req/min global)    │  │
│  │  • Request ID & Logging                  │  │
│  │  • JWT Authentication                    │  │
│  └──────────────────────────────────────────┘  │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │         Modular Routes                   │  │
│  │  • /api/auth    (Authentication)         │  │
│  │  • /api/projects (Project Management)    │  │
│  │  • /api/chat    (Chat & AI Assistant)    │  │
│  │  • /api/execute (Code Execution)         │  │
│  └──────────────────────────────────────────┘  │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │         Storage Layer                    │  │
│  │  • LowDB (JSON file database)            │  │
│  │  • Atomic file writes                    │  │
│  │  • In-memory caching                     │  │
│  └──────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

**Tech Stack:**
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: LowDB (file-based JSON)
- **Authentication**: JWT + bcrypt
- **Code Execution**: vm2 (⚠️ deprecated, see limitations)
- **Validation**: Zod schemas

---

## 2. API Endpoints

### Authentication Endpoints

#### `POST /api/auth/register`
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response (201 Created):**
```json
{
  "user": {
    "id": 1,
    "email": "user@example.com"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**
- `400` - Invalid email format or password too short (< 6 chars)
- `409` - Email already exists
- `500` - Internal server error

**Rate Limit:** 30 requests/minute per IP

---

#### `POST /api/auth/login`
Authenticate existing user.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response (200 OK):**
```json
{
  "user": {
    "id": 1,
    "email": "user@example.com"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**
- `400` - Missing email or password
- `401` - Invalid credentials
- `500` - Internal server error

**Rate Limit:** 30 requests/minute per IP

---

### Project Endpoints

#### `POST /api/projects`
Create a new project.

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "prompt": "Build a todo app with React",
  "templateId": "react-starter" // optional
}
```

**Response (201 Created):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "1",
  "prompt": "Build a todo app with React",
  "status": "created",
  "createdAt": "2025-10-14T12:00:00.000Z"
}
```

---

#### `GET /api/projects`
Get all projects for authenticated user.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "projects": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "userId": "1",
      "prompt": "Build a todo app with React",
      "status": "completed",
      "createdAt": "2025-10-14T12:00:00.000Z",
      "updatedAt": "2025-10-14T12:05:00.000Z"
    }
  ]
}
```

---

#### `GET /api/projects/:projectId/collaborators`
Get all collaborators for a project.

**Response (200 OK):**
```json
{
  "collaborators": [
    {
      "id": "collab-1",
      "projectId": "550e8400-e29b-41d4-a716-446655440000",
      "userId": "2",
      "role": "editor",
      "addedAt": "2025-10-14T12:00:00.000Z"
    }
  ]
}
```

---

#### `POST /api/projects/:projectId/collaborators`
Add a collaborator to a project.

**Request Body:**
```json
{
  "userId": "2",
  "role": "editor" // "owner" | "editor" | "viewer"
}
```

**Response (201 Created):**
```json
{
  "collaborator": {
    "id": "collab-1",
    "projectId": "550e8400-e29b-41d4-a716-446655440000",
    "userId": "2",
    "role": "editor",
    "addedAt": "2025-10-14T12:00:00.000Z"
  }
}
```

---

#### `DELETE /api/projects/:projectId/collaborators/:userId`
Remove a collaborator from a project.

**Response (200 OK):**
```json
{
  "message": "Collaborator removed successfully"
}
```

---

#### `POST /api/projects/:projectId/commits`
Create a new commit (version snapshot).

**Request Body:**
```json
{
  "message": "Initial commit",
  "changes": {
    "files": [...],
    "diff": {...}
  },
  "parentCommitId": "parent-commit-id" // optional
}
```

**Response (201 Created):**
```json
{
  "commit": {
    "id": "commit-1",
    "projectId": "550e8400-e29b-41d4-a716-446655440000",
    "userId": "1",
    "message": "Initial commit",
    "createdAt": "2025-10-14T12:00:00.000Z"
  }
}
```

---

#### `GET /api/projects/:projectId/commits`
Get commit history for a project.

**Query Parameters:**
- `limit` (optional, default: 50) - Number of commits to return

**Response (200 OK):**
```json
{
  "commits": [
    {
      "id": "commit-1",
      "projectId": "550e8400-e29b-41d4-a716-446655440000",
      "userId": "1",
      "message": "Initial commit",
      "parentCommitId": null,
      "createdAt": "2025-10-14T12:00:00.000Z"
    }
  ]
}
```

---

### Chat Endpoints

#### `POST /api/chat/messages`
Send a chat message (REST fallback for WebSocket).

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "projectId": "550e8400-e29b-41d4-a716-446655440000", // optional
  "content": "How do I add authentication?",
  "type": "ai-assistant", // "ai-assistant" | "collaboration" | "support"
  "ticketId": "ticket-123" // optional, for support messages
}
```

**Response (201 Created):**
```json
{
  "userMessage": {
    "id": "msg-1",
    "userId": "1",
    "projectId": "550e8400-e29b-41d4-a716-446655440000",
    "role": "user",
    "content": "How do I add authentication?",
    "createdAt": "2025-10-14T12:00:00.000Z"
  },
  "aiResponse": {
    "id": "msg-2",
    "userId": "1",
    "role": "assistant",
    "content": "I understand you want to: \"How do I add authentication?\". How can I help you build that?",
    "createdAt": "2025-10-14T12:00:01.000Z"
  }
}
```

**Rate Limit:** 60 requests/minute per IP

---

#### `GET /api/chat/history`
Get chat history for the authenticated user.

**Query Parameters:**
- `projectId` (optional) - Filter by project
- `limit` (optional, default: 100) - Number of messages to return

**Response (200 OK):**
```json
{
  "messages": [
    {
      "id": "msg-1",
      "userId": "1",
      "projectId": "550e8400-e29b-41d4-a716-446655440000",
      "role": "user",
      "content": "How do I add authentication?",
      "createdAt": "2025-10-14T12:00:00.000Z"
    }
  ]
}
```

---

#### `DELETE /api/chat/messages/:messageId`
Delete a chat message.

**Response (200 OK):**
```json
{
  "message": "Message deleted successfully"
}
```

---

### Code Execution Endpoints

#### `POST /api/execute`
Execute code in a sandboxed environment.

**⚠️ Security Warning**: Code execution uses vm2 which is deprecated and has security vulnerabilities. Only enable in development with `ENABLE_CODE_EXECUTION=true`.

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "language": "javascript",
  "code": "console.log('Hello, World!');",
  "projectId": "550e8400-e29b-41d4-a716-446655440000" // optional
}
```

**Response (200 OK):**
```json
{
  "executionId": "exec-1",
  "stdout": "Hello, World!\n",
  "stderr": "",
  "exitCode": 0,
  "executionTimeMs": 45,
  "status": "completed"
}
```

**Error Response (execution disabled):**
```json
{
  "executionId": "exec-1",
  "stdout": "",
  "stderr": "Code execution is disabled for security reasons. Enable with ENABLE_CODE_EXECUTION=true (requires proper sandboxing in production)",
  "exitCode": 1,
  "executionTimeMs": 0,
  "status": "error",
  "error": "Code execution disabled"
}
```

**Rate Limit:** 30 requests/minute per IP

---

#### `GET /api/execute/languages`
Get list of supported programming languages.

**Response (200 OK):**
```json
{
  "languages": ["javascript", "typescript", "python", "bash"]
}
```

---

#### `GET /api/execute/history`
Get code execution history.

**Query Parameters:**
- `projectId` (optional) - Filter by project
- `limit` (optional, default: 50) - Number of executions to return

**Response (200 OK):**
```json
{
  "executions": [
    {
      "id": "exec-1",
      "userId": "1",
      "projectId": "550e8400-e29b-41d4-a716-446655440000",
      "language": "javascript",
      "code": "console.log('Hello, World!');",
      "stdout": "Hello, World!\n",
      "stderr": "",
      "exitCode": 0,
      "executionTimeMs": 45,
      "status": "completed",
      "createdAt": "2025-10-14T12:00:00.000Z"
    }
  ]
}
```

---

#### `GET /api/execute/:executionId`
Get execution details.

**Response (200 OK):**
```json
{
  "execution": {
    "id": "exec-1",
    "userId": "1",
    "projectId": "550e8400-e29b-41d4-a716-446655440000",
    "language": "javascript",
    "code": "console.log('Hello, World!');",
    "stdout": "Hello, World!\n",
    "stderr": "",
    "exitCode": 0,
    "executionTimeMs": 45,
    "status": "completed",
    "createdAt": "2025-10-14T12:00:00.000Z"
  }
}
```

---

## 3. Environment Variables

### Required Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `JWT_SECRET` | Secret key for JWT token signing | `replace_me` | ✅ Yes (production) |
| `DATABASE_FILE` | Path to LowDB database file | `./data/db.json` | No |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `5000` |
| `NODE_ENV` | Environment mode | `development` |
| `JWT_EXPIRES_IN` | JWT token expiration | `7d` |
| `LOG_LEVEL` | Logging level (DEBUG, INFO, WARN, ERROR) | `INFO` |
| `LOG_FILE` | Log file path | `./logs/app.log` |

### Code Execution Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ENABLE_CODE_EXECUTION` | **⚠️ Enable code execution (NOT for production)** | `false` |
| `CODE_EXECUTION_TIMEOUT` | Execution timeout (ms) | `5000` |
| `CODE_EXECUTION_MAX_OUTPUT` | Max output size (bytes) | `10000` |
| `EXECUTION_TIMEOUT_MS` | VM2 timeout (ms) | `3000` |
| `MAX_CODE_OUTPUT` | VM2 max output (bytes) | `65536` |

### Rate Limiting Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | `900000` (15 min) |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | `100` |

### Chat Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CHAT_HISTORY_LIMIT` | Default chat history limit | `100` |
| `CHAT_MESSAGE_MAX_LENGTH` | Max message length | `5000` |

### OpenAI Integration (Optional)

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key for AI chat | - |

### Payment Integration (Optional - Mock Mode Default)

| Variable | Description | Default |
|----------|-------------|---------|
| `RAZORPAY_MODE` | Payment mode (mock/live) | `mock` |
| `RAZORPAY_KEY_ID` | Razorpay key ID | - |
| `RAZORPAY_KEY_SECRET` | Razorpay secret | - |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay webhook secret | - |

---

## 4. Running Locally

### Prerequisites

- **Node.js**: v20.x or higher
- **npm**: v10.x or higher
- **TypeScript**: Installed globally or via project dependencies

### Installation Steps

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd ybuilt
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Create data directory:**
   ```bash
   mkdir -p data
   ```

5. **Start the development server:**
   ```bash
   npm run dev
   ```

   The server will start on `http://localhost:5000` (or next available port).

### Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| Development | `npm run dev` | Start server with hot reload |
| Production Build | `npm run build` | Build for production |
| Production Start | `npm start` | Run production build |
| Type Check | `npm run check` | Run TypeScript type checking |
| Database Push | `npm run db:push` | Push database schema (Drizzle) |

### Environment Configuration

**Development (.env):**
```bash
NODE_ENV=development
PORT=5000
JWT_SECRET=your-dev-secret-key
DATABASE_FILE=./data/db.json
ENABLE_CODE_EXECUTION=false  # ⚠️ Only enable for trusted development
LOG_LEVEL=DEBUG
```

**Production (.env):**
```bash
NODE_ENV=production
PORT=5000
JWT_SECRET=your-strong-production-secret  # MUST be changed!
DATABASE_FILE=/var/data/db.json
ENABLE_CODE_EXECUTION=false  # ⚠️ NEVER enable in production
LOG_LEVEL=INFO
```

---

## 5. Testing

### Test Overview

The Backend Brain MVP includes comprehensive unit tests covering all major endpoints:

- **Total Tests**: 34 tests across 3 test suites (~808 lines)
- **Test Coverage**: Authentication, Projects, Code Execution
- **Test Files**: 
  - `tests/auth.test.ts` - Authentication tests
  - `tests/projects.test.ts` - Project management tests
  - `tests/execute.test.ts` - Code execution tests

### Running Tests

#### Run All Tests

```bash
tsx tests/run-all.ts
```

Or use the shell script:

```bash
./tests/run-tests.sh
```

#### Run Individual Test Suites

```bash
# Authentication tests only
tsx --test tests/auth.test.ts

# Project tests only
tsx --test tests/projects.test.ts

# Code execution tests only
tsx --test tests/execute.test.ts
```

### Test Coverage

#### Authentication Tests (`auth.test.ts`)
- ✅ Valid registration with email/password
- ✅ Invalid email format validation (400)
- ✅ Password length validation (< 6 chars = 400)
- ✅ Duplicate email prevention (409)
- ✅ JWT token payload verification (sub, email)
- ✅ Valid login with correct credentials
- ✅ Invalid password rejection (401)
- ✅ Non-existent email rejection (401)
- ✅ Token validation and parsing

#### Project Tests (`projects.test.ts`)
- ✅ Create project with authentication
- ✅ Authentication requirement enforcement (401)
- ✅ Get user's projects
- ✅ Access control (cannot access other users' projects - 403)
- ✅ Get specific project by ID
- ✅ Non-existent project handling (404)
- ✅ Add collaborator to project
- ✅ Get project collaborators
- ✅ Remove collaborator from project
- ✅ Collaboration permission enforcement (403 for non-owners)
- ✅ Create commit (version snapshot)
- ✅ Get commit history

#### Code Execution Tests (`execute.test.ts`)
- ✅ Execute simple JavaScript code
- ✅ Capture stdout output
- ✅ Timeout enforcement
- ✅ Unsupported language handling (400)
- ✅ Output size limit enforcement
- ✅ Authentication requirement (401)
- ✅ Get supported languages list
- ✅ Get execution history
- ✅ Get specific execution details
- ✅ Non-existent execution handling (404)

### CI/CD Integration

The tests are designed to run in CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Start server
  run: npm run dev &
  
- name: Wait for server
  run: sleep 5

- name: Run tests
  run: tsx tests/run-all.ts
  env:
    ENABLE_CODE_EXECUTION: 'true'
    TEST_BASE_URL: 'http://localhost:5000'
```

### Test Configuration

**Environment Variables for Testing:**
```bash
TEST_BASE_URL=http://localhost:5000  # Base URL for API
JWT_SECRET=your-secret-key           # JWT secret for verification
ENABLE_CODE_EXECUTION=true           # Enable actual code execution
CODE_EXECUTION_TIMEOUT=5000          # Execution timeout
CODE_EXECUTION_MAX_OUTPUT=10000      # Max output size
```

### Test Results

Test results are exported to `tests/test-results.json`:

```json
{
  "pass": 34,
  "fail": 0,
  "skip": 0,
  "todo": 0,
  "duration": 3500
}
```

---

## 6. Security Considerations

### JWT Authentication

**Implementation:**
- Tokens signed with HS256 algorithm
- Payload includes: `sub` (user ID) and `email`
- Default expiration: 7 days
- Token format: `Authorization: Bearer <token>`

**Security Best Practices:**
```typescript
// ✅ DO: Use strong, random secrets
JWT_SECRET=<64-character-random-string>

// ❌ DON'T: Use default or weak secrets
JWT_SECRET=replace_me  // NEVER in production!
```

**Token Storage:**
- Frontend: Store in memory or secure HttpOnly cookies
- Never expose tokens in URLs or localStorage (XSS risk)
- Implement token refresh mechanism for long-lived sessions

### Password Security

- **Hashing**: bcrypt with salt rounds (10)
- **Minimum Length**: 6 characters (enforced)
- **Validation**: Email format validation with regex

```typescript
// Password hashing (server/routes/auth.ts)
const password_hash = await bcrypt.hash(password, 10);

// Password verification
const isValid = await bcrypt.compare(password, user.password_hash);
```

### Rate Limiting

**Global Rate Limiter:**
- **Limit**: 500 requests per minute per IP
- **Window**: 60 seconds (sliding window)
- **Headers**: `X-RateLimit-*` for client tracking

**Endpoint-Specific Rate Limiters:**
- `/api/auth/*`: 30 req/min per IP
- `/api/execute/*`: 30 req/min per IP
- `/api/chat/*`: 60 req/min per IP

```typescript
// Rate limit response
{
  "error": "Too many requests",
  "retryAfter": "45s"
}
```

### Code Execution Security

**⚠️ CRITICAL SECURITY WARNING:**

The code execution feature uses **vm2**, which is **DEPRECATED** and has **known security vulnerabilities**:

1. **CVE-2023-37466**: Sandbox escape vulnerability
2. **CVE-2023-32314**: Prototype pollution
3. **CVE-2023-29199**: Remote code execution

**Current Protections (INSUFFICIENT for production):**
- Pattern-based filtering (easily bypassed)
- Timeout limits (5 seconds default)
- Output size limits (10KB default)
- Restricted environment variables
- Sandboxed execution with vm2

**Pattern Blocking:**
```typescript
// Blocked patterns (can be bypassed!)
- rm -rf commands
- Fork bombs
- eval() and exec()
- child_process, subprocess
- File system operations
```

**Production Recommendations:**

**DO NOT USE** code execution in production without proper sandboxing:

1. **Use isolated-vm** (vm2 replacement):
   ```bash
   npm install isolated-vm
   ```

2. **Use containerization**:
   - Docker with security profiles
   - gVisor for additional isolation
   - Resource limits (CPU, memory, network)

3. **Use remote execution services**:
   - AWS Lambda
   - Google Cloud Functions
   - Replit Code Execution API
   - E2B (code execution API)

4. **Environment controls**:
   ```bash
   # NEVER enable in production
   ENABLE_CODE_EXECUTION=false
   ```

### Input Validation

All endpoints use **Zod schemas** for validation:

```typescript
// Example: Create project validation
const createProjectSchema = z.object({
  prompt: z.string().min(1).max(5000),
  templateId: z.string().optional(),
});

// Validation in route
const validatedData = createProjectSchema.parse(req.body);
```

**Validation Error Response:**
```json
{
  "error": "Validation failed",
  "details": [
    {
      "path": ["prompt"],
      "message": "String must contain at least 1 character(s)"
    }
  ]
}
```

### Security Headers (Helmet)

Automatically applied security headers:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security` (HSTS)
- `Content-Security-Policy` (CSP)

### CORS Configuration

```typescript
// server/index.ts
app.use(cors()); // Configure for production!
```

**Production CORS:**
```typescript
app.use(cors({
  origin: ['https://yourdomain.com'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));
```

### Production Deployment Checklist

- [ ] Change `JWT_SECRET` to strong random value
- [ ] Disable code execution (`ENABLE_CODE_EXECUTION=false`)
- [ ] Configure proper CORS origins
- [ ] Use HTTPS/TLS for all connections
- [ ] Enable production logging (avoid debug logs)
- [ ] Set up database backups
- [ ] Implement rate limiting per user (not just IP)
- [ ] Add API key authentication for sensitive endpoints
- [ ] Monitor and alert on suspicious activity
- [ ] Regular security audits and dependency updates

---

## 7. Known Limitations

### 1. vm2 is Deprecated and Vulnerable

**Issue:**
- vm2 package is no longer maintained (deprecated June 2023)
- Multiple critical CVEs with no fixes planned
- **Sandbox escape vulnerabilities** allow arbitrary code execution

**Impact:**
- JavaScript code execution is **NOT SAFE** for untrusted code
- Attackers can escape sandbox and access host system
- Pattern-based filtering is easily bypassed

**Mitigation:**
- Code execution is **disabled by default** (`ENABLE_CODE_EXECUTION=false`)
- Only enable in trusted development environments
- **NEVER enable in production**

**Migration Path:**
```bash
# Replace vm2 with isolated-vm
npm uninstall vm2
npm install isolated-vm

# Or use remote execution service
npm install @e2b/sdk  # E2B code execution
```

### 2. File-Based JSON Database (LowDB)

**Issue:**
- Not suitable for production scale (>1000 users)
- No query optimization or indexing
- Race condition risks with concurrent writes
- No built-in replication or failover

**Impact:**
- Performance degrades with data growth
- Single point of failure
- Limited to single-server deployment
- Atomic writes help but don't solve concurrency

**Mitigation (Current):**
- Atomic file writes prevent corruption
- In-memory caching for frequently accessed data
- Regular file backups

**Production Alternatives:**
```bash
# PostgreSQL with Drizzle ORM (recommended)
npm install pg drizzle-orm

# MongoDB with Mongoose
npm install mongodb mongoose

# Redis for caching + PostgreSQL for persistence
npm install redis ioredis
```

### 3. Limited Language Support in Code Execution

**Issue:**
- vm2 only supports JavaScript execution
- Other languages (Python, TypeScript, Bash) use `child_process`
- Different execution paths create inconsistent security posture

**Impact:**
- JavaScript: vm2 sandbox (deprecated, vulnerable)
- Python/Bash: Direct `spawn()` with minimal protection
- No unified security model across languages

**Recommendation:**
Use consistent execution environment for all languages:
- Container-based: Docker with language-specific images
- Remote service: Same API for all languages

### 4. No WebSocket Support for Real-Time Features

**Issue:**
- Chat uses REST polling instead of WebSocket
- No real-time collaboration features
- Higher latency and bandwidth usage

**Impact:**
- Delayed message delivery
- Inefficient for real-time features (collaborative editing)
- Higher server load from polling

**Future Enhancement:**
```typescript
// Add Socket.IO for WebSocket support
import { Server } from 'socket.io';

const io = new Server(server, {
  cors: { origin: '*' }
});

// Real-time chat
io.on('connection', (socket) => {
  socket.on('chat:message', (msg) => {
    io.emit('chat:message', msg);
  });
});
```

### 5. Basic Rate Limiting (IP-Based Only)

**Issue:**
- Rate limiting only by IP address
- Shared IPs (NAT, VPNs) can block legitimate users
- Authenticated users not tracked separately

**Impact:**
- False positives for users behind corporate proxies
- Attackers can bypass with rotating IPs
- No per-user quota enforcement

**Enhancement:**
```typescript
// Rate limit by user ID (authenticated) or IP (anonymous)
const identifier = req.user?.id || req.ip;
```

### 6. No Database Migrations

**Issue:**
- Schema changes require manual file updates
- No version control for database structure
- Risk of data loss during schema changes

**Recommendation:**
Implement migrations with Drizzle Kit or similar:
```bash
npm install drizzle-kit
npx drizzle-kit generate:pg
npx drizzle-kit migrate
```

---

## 8. Database Schema

The Backend Brain MVP uses **LowDB** (file-based JSON database) with the following schema:

### Users Table

**File:** `data/db.json`

```typescript
interface DbUser {
  id: number;              // Primary key
  email: string;           // Unique, indexed
  password_hash: string;   // bcrypt hashed password
  created_at: number;      // Timestamp (ms)
}
```

**Example:**
```json
{
  "users": [
    {
      "id": 1,
      "email": "user@example.com",
      "password_hash": "$2b$10$...",
      "created_at": 1697299200000
    }
  ]
}
```

### Projects Table

**File:** `data/db.json`

```typescript
interface DbProject {
  id: number;              // Primary key
  name: string;            // Project name
  content: string;         // Project content/code
  user_id: number | null;  // Foreign key to users.id
  created_at: number;      // Timestamp (ms)
  updated_at: number;      // Timestamp (ms)
}
```

**Example:**
```json
{
  "projects": [
    {
      "id": 1,
      "name": "Todo App",
      "content": "{ \"files\": [...] }",
      "user_id": 1,
      "created_at": 1697299200000,
      "updated_at": 1697299200000
    }
  ]
}
```

### Chats Table

**File:** `data/db.json`

```typescript
interface DbChat {
  id: number;              // Primary key
  user_id: number | null;  // Foreign key to users.id
  message: string;         // Chat message content
  created_at: number;      // Timestamp (ms)
}
```

**Example:**
```json
{
  "chats": [
    {
      "id": 1,
      "user_id": 1,
      "message": "How do I add authentication?",
      "created_at": 1697299200000
    }
  ]
}
```

### Extended Schema (MemStorage)

The in-memory storage layer extends the database with additional entities:

#### Chat Messages
```typescript
interface ChatMessage {
  id: string;              // UUID
  userId: string;          // User ID
  projectId: string | null;// Optional project context
  role: 'user' | 'assistant' | 'system';
  content: string;         // Message content
  metadata: {
    type: 'ai-assistant' | 'collaboration' | 'support';
    ticketId?: string;
  };
  createdAt: Date;
}
```

#### Code Executions
```typescript
interface CodeExecution {
  id: string;              // UUID
  userId: string;          // User ID
  projectId: string | null;// Optional project context
  language: string;        // Programming language
  code: string;            // Source code
  stdout: string;          // Standard output
  stderr: string;          // Error output
  exitCode: number | null; // Exit code
  executionTimeMs: number; // Execution time
  status: 'completed' | 'timeout' | 'error';
  createdAt: Date;
}
```

#### Project Collaborators
```typescript
interface ProjectCollaborator {
  id: string;              // UUID
  projectId: string;       // Project ID
  userId: string;          // User ID
  role: 'owner' | 'editor' | 'viewer';
  addedAt: Date;
}
```

#### Project Commits
```typescript
interface ProjectCommit {
  id: string;              // UUID
  projectId: string;       // Project ID
  userId: string;          // User ID
  message: string;         // Commit message
  changes: {               // Code changes
    files: any[];
    diff: any;
  };
  parentCommitId: string | null; // Parent commit
  createdAt: Date;
}
```

### Data Files Structure

```
data/
├── db.json              # Main database (users, projects, chats)
├── jobs.json            # Job/project records
├── builds.json          # Build records
├── versions.json        # Version snapshots
├── billing.json         # Invoices and billing
├── settings/            # User settings
│   └── {userId}.json
├── library/             # User drafts
│   └── {userId}/
│       └── drafts/
│           └── {draftId}.json
└── support/             # Support tickets
    └── tickets.json
```

---

## 9. Architecture Decisions

### Why LowDB?

**Chosen for MVP development:**

✅ **Pros:**
- Zero configuration (no database server)
- Perfect for prototyping and development
- Type-safe with TypeScript
- Built-in JSON schema validation
- Atomic writes prevent corruption
- Easy to inspect (human-readable JSON)
- Minimal dependencies

❌ **Cons:**
- Not suitable for production scale
- No query optimization
- Single-server limitation
- No built-in replication
- Performance degrades with size

**Decision Rationale:**
- Rapid MVP development without DB setup
- Easy local testing and debugging
- Simple deployment for demos
- Planned migration to PostgreSQL for production

### Modular Route Structure

**Architecture:**
```typescript
// server/index.ts
app.use('/api/auth', authRoutes(db));
app.use('/api/projects', projectsRoutes(db));
app.use('/api/chat', chatRoutes(db));
app.use('/api/execute', executeRoutes(db));
```

**Benefits:**
1. **Separation of Concerns**: Each route file handles one domain
2. **Testability**: Routes can be tested in isolation
3. **Maintainability**: Easy to locate and update specific features
4. **Scalability**: Routes can be extracted to microservices
5. **Team Collaboration**: Parallel development without conflicts

**Example Route Module:**
```typescript
// server/routes/auth.ts
export default function authRoutes(db: Database) {
  const router = Router();
  
  router.post('/register', async (req, res) => {
    // Registration logic
  });
  
  router.post('/login', async (req, res) => {
    // Login logic
  });
  
  return router;
}
```

### JWT vs Sessions

**Chose JWT for:**

✅ **Stateless Authentication:**
- No server-side session storage required
- Scales horizontally without session sharing
- Works across multiple servers/services

✅ **Mobile-Friendly:**
- No cookies required (works with mobile apps)
- Token can be stored in app memory
- Easy to integrate with native apps

✅ **API-First Design:**
- Standard for modern REST APIs
- Easy to validate in middleware
- Cross-domain support

**Trade-offs:**
- Cannot revoke tokens before expiration
- Larger payload than session IDs
- Need refresh token mechanism for long sessions

**Implementation:**
```typescript
// Generate token
const token = jwt.sign(
  { sub: userId, email },
  JWT_SECRET,
  { expiresIn: '7d' }
);

// Verify token
const payload = jwt.verify(token, JWT_SECRET);
req.user = { id: payload.sub, email: payload.email };
```

### Middleware Stack Explanation

**Order matters** in Express middleware:

```typescript
// 1. Security headers (first line of defense)
app.use(helmet());

// 2. CORS (before body parsing)
app.use(cors());

// 3. Raw body for webhooks (specific routes)
app.use('/webhooks/razorpay', express.raw({ type: 'application/json' }));

// 4. Body parsing (after raw body capture)
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// 5. Request ID (for tracing)
app.use(requestIdMiddleware);

// 6. Logging (after request ID)
app.use(requestLogger);
app.use(morgan('combined'));

// 7. Rate limiting (after logging)
app.use(rateLimiter);

// 8. Routes
app.use('/api/auth', authRoutes(db));

// 9. Error handling (last)
app.use(errorHandler);
```

**Rationale:**
1. Security headers must be set before any response
2. CORS must validate before processing body
3. Webhook signatures need raw body
4. Request ID enables distributed tracing
5. Rate limiting after logging for audit trail
6. Error handler catches all route errors

### Storage Layer Abstraction

**Interface-Based Design:**
```typescript
export interface IStorage {
  createUser(user: InsertUser): Promise<User>;
  getUser(id: string): Promise<User | undefined>;
  createJob(job: InsertJob): Promise<Job>;
  // ... more methods
}

export class MemStorage implements IStorage {
  // Implementation with LowDB
}
```

**Benefits:**
1. **Easy Migration**: Swap implementations without changing routes
2. **Testing**: Mock storage for unit tests
3. **Type Safety**: TypeScript ensures contract compliance
4. **Future-Proof**: Add PostgreSQL/MongoDB without refactoring

**Migration Example:**
```typescript
// Current: File-based storage
const storage = new MemStorage();

// Future: PostgreSQL storage
const storage = new PostgresStorage();

// Routes remain unchanged!
```

---

## 10. Future Improvements

### 1. Migrate from vm2 to isolated-vm

**Priority:** 🔴 Critical

**Issue:** vm2 is deprecated with unfixed security vulnerabilities

**Solution:**
```bash
npm uninstall vm2
npm install isolated-vm
```

**Implementation:**
```typescript
// server/services/isolatedVmExecutor.ts
import ivm from 'isolated-vm';

export async function executeJavaScript(code: string) {
  const isolate = new ivm.Isolate({ memoryLimit: 128 });
  const context = await isolate.createContext();
  
  const jail = context.global;
  await jail.set('global', jail.derefInto());
  
  const result = await context.eval(code, { timeout: 5000 });
  
  isolate.dispose();
  return result;
}
```

**Benefits:**
- True isolation (separate V8 isolate)
- Memory limits per execution
- No sandbox escape vulnerabilities
- Actively maintained

### 2. Upgrade to PostgreSQL

**Priority:** 🟡 High

**Current Issues with LowDB:**
- No indexing or query optimization
- No concurrent write handling
- Single point of failure
- Limited to single server

**Migration Plan:**

1. **Install dependencies:**
   ```bash
   npm install pg drizzle-orm
   npm install -D drizzle-kit
   ```

2. **Define schema:**
   ```typescript
   // server/schema.ts
   import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
   
   export const users = pgTable('users', {
     id: serial('id').primaryKey(),
     email: text('email').unique().notNull(),
     passwordHash: text('password_hash').notNull(),
     createdAt: timestamp('created_at').defaultNow(),
   });
   ```

3. **Create storage implementation:**
   ```typescript
   export class PostgresStorage implements IStorage {
     constructor(private db: PostgresDb) {}
     
     async createUser(user: InsertUser): Promise<User> {
       const [newUser] = await this.db
         .insert(users)
         .values(user)
         .returning();
       return newUser;
     }
   }
   ```

4. **Update routes:**
   ```typescript
   // No changes needed! Interface abstraction works
   const storage = new PostgresStorage(db);
   ```

**Benefits:**
- ACID transactions
- Indexing and query optimization
- Concurrent writes
- Replication and failover
- Scales to millions of records

### 3. Add WebSocket Support

**Priority:** 🟡 High

**Use Cases:**
- Real-time chat
- Live collaboration
- Build progress updates
- Notifications

**Implementation with Socket.IO:**

```bash
npm install socket.io
```

```typescript
// server/websocket.ts
import { Server } from 'socket.io';

export function setupWebSocket(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: { origin: '*' }
  });
  
  // Authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    const user = verifyToken(token);
    socket.data.user = user;
    next();
  });
  
  // Real-time chat
  io.on('connection', (socket) => {
    socket.on('chat:send', async (message) => {
      const saved = await storage.createChatMessage({
        userId: socket.data.user.id,
        content: message.content,
        role: 'user',
      });
      
      // Broadcast to all clients
      io.emit('chat:message', saved);
    });
    
    // Join project room
    socket.on('project:join', (projectId) => {
      socket.join(`project:${projectId}`);
    });
    
    // Collaborative editing
    socket.on('code:update', (data) => {
      socket.to(`project:${data.projectId}`).emit('code:update', data);
    });
  });
}
```

**Client Integration:**
```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000', {
  auth: { token: userToken }
});

socket.on('chat:message', (message) => {
  // Update UI with new message
});

socket.emit('chat:send', { content: 'Hello!' });
```

### 4. Enhanced Code Execution Sandboxing

**Priority:** 🔴 Critical

**Options:**

#### Option A: Container-based Execution
```typescript
// Using Docker SDK
import Docker from 'dockerode';

export async function executeInDocker(code: string, language: string) {
  const docker = new Docker();
  
  const container = await docker.createContainer({
    Image: `${language}:latest`,
    Cmd: ['node', '-e', code],
    HostConfig: {
      Memory: 512 * 1024 * 1024,  // 512MB limit
      NanoCpus: 1 * 1e9,          // 1 CPU
      NetworkMode: 'none',        // No network
    },
  });
  
  await container.start();
  const stream = await container.logs({
    stdout: true,
    stderr: true,
  });
  
  // Clean up
  await container.stop();
  await container.remove();
  
  return parseOutput(stream);
}
```

#### Option B: Remote Execution Service
```typescript
// Using E2B (e2b.dev)
import { Sandbox } from '@e2b/sdk';

export async function executeWithE2B(code: string, language: string) {
  const sandbox = await Sandbox.create({
    template: language,
  });
  
  const result = await sandbox.run(code, {
    timeout: 5000,
  });
  
  await sandbox.close();
  
  return {
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
  };
}
```

### 5. Implement Caching Layer

**Priority:** 🟢 Medium

**Use Redis for:**
- Session storage
- Chat history caching
- Rate limit counters
- API response caching

```bash
npm install redis
```

```typescript
// server/cache.ts
import { createClient } from 'redis';

export const redis = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

await redis.connect();

// Cache chat messages
await redis.setEx(
  `chat:${userId}`,
  3600,  // 1 hour TTL
  JSON.stringify(messages)
);

// Rate limiting with Redis
const key = `ratelimit:${userId}`;
const count = await redis.incr(key);
if (count === 1) {
  await redis.expire(key, 60);  // 1 minute window
}
if (count > 100) {
  throw new Error('Rate limit exceeded');
}
```

### 6. Add Observability and Monitoring

**Priority:** 🟢 Medium

**Implement:**
- Structured logging (Winston, Pino)
- Metrics (Prometheus)
- Distributed tracing (OpenTelemetry)
- Error tracking (Sentry)

```bash
npm install @sentry/node prom-client winston
```

```typescript
// server/monitoring.ts
import * as Sentry from '@sentry/node';
import { register, Counter, Histogram } from 'prom-client';

// Error tracking
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
});

// Metrics
const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests',
  labelNames: ['method', 'route', 'status'],
});

const httpRequestTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status'],
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

### 7. API Versioning

**Priority:** 🟢 Low

**Implement versioned routes:**
```typescript
// server/index.ts
app.use('/api/v1/auth', authRoutesV1(db));
app.use('/api/v2/auth', authRoutesV2(db));

// Default to latest
app.use('/api/auth', authRoutesV2(db));
```

**Or use header-based versioning:**
```typescript
app.use((req, res, next) => {
  const version = req.headers['api-version'] || 'v2';
  req.apiVersion = version;
  next();
});
```

### 8. GraphQL API

**Priority:** 🟢 Low

**Complement REST with GraphQL:**
```bash
npm install apollo-server-express graphql
```

```typescript
import { ApolloServer } from 'apollo-server-express';

const typeDefs = `
  type User {
    id: ID!
    email: String!
    projects: [Project!]!
  }
  
  type Project {
    id: ID!
    prompt: String!
    status: String!
  }
  
  type Query {
    me: User
    project(id: ID!): Project
  }
  
  type Mutation {
    createProject(prompt: String!): Project!
  }
`;

const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: ({ req }) => ({ user: req.user }),
});

await server.start();
server.applyMiddleware({ app });
```

---

## Appendix

### Related Documentation

- [Tests README](../tests/README.md) - Comprehensive testing guide
- [.env.example](../.env.example) - Environment variable template
- [API Routes](../server/routes/) - Route implementations

### Quick Reference

**Start Development:**
```bash
npm run dev
```

**Run Tests:**
```bash
tsx tests/run-all.ts
```

**Check Security:**
```bash
# Audit dependencies
npm audit

# Check for outdated packages
npm outdated
```

**Database Backup:**
```bash
# Backup LowDB files
tar -czf backup-$(date +%Y%m%d).tar.gz data/
```

---

## Support

For issues or questions:
1. Check [Known Limitations](#7-known-limitations)
2. Review [Security Considerations](#6-security-considerations)
3. Run tests to verify setup: `tsx tests/run-all.ts`
4. Check logs at `./logs/app.log` (if configured)

---

**Last Updated:** October 2025  
**Version:** 1.0.0 (MVP)  
**Status:** ⚠️ Development Only - Not Production Ready
