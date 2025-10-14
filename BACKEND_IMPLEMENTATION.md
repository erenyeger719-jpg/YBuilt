# Backend Implementation - YBUILT Platform 10x

## 🎯 Overview

Complete backend infrastructure implementation for YBUILT AI website builder, featuring:
- **JWT Authentication** with bcrypt password hashing
- **Real-time Chat** via Socket.IO (AI assistant, collaboration, support)
- **Code Execution Engine** (sandboxed with security warnings)
- **Project Collaboration** with role-based access control
- **Version Control** with commit history
- **Production-Ready Logging** with Morgan + centralized error handling
- **Rate Limiting** (100 req/min per IP)

## 🏗️ Architecture

### Database Schema Extensions
Extended in-memory storage with JSON persistence:

#### New Tables
1. **users** - User accounts with JWT authentication
   - id, username, email, passwordHash, displayName, avatarUrl
   - Indexes: username, email

2. **chat_messages** - Real-time chat messages
   - id, userId, projectId, mode (ai/collaboration/support), content, metadata
   - Indexes: projectId, userId

3. **code_executions** - Code execution history
   - id, userId, projectId, language, code, output, error, status
   - Indexes: projectId, userId

4. **project_collaborators** - Project access control
   - id, projectId, userId, role (owner/editor/viewer), invitedBy
   - Indexes: projectId, userId

5. **project_commits** - Version control history
   - id, projectId, userId, message, changes, parentCommitId
   - Indexes: projectId

### API Endpoints

#### Authentication (`/api/auth`)
- `POST /register` - User registration (bcrypt hashing)
- `POST /login` - JWT token generation (7-day expiry)
- `GET /me` - Get current user profile

#### Chat (`/api/chat`)
- `GET /:projectId/messages` - Get chat history (paginated)
- `POST /:projectId/messages` - Send message (REST fallback)
- `WebSocket /socket.io` - Real-time chat events

#### Code Execution (`/api/execute`)
- `POST /` - Execute code (disabled by default)
  - **⚠️ Security**: Requires `ENABLE_CODE_EXECUTION=true`
  - Supports: JavaScript, Python, TypeScript, Bash
  - Timeouts: 5s, Max output: 10KB
  - **NOT PRODUCTION-READY** without containerization

#### Project Management (`/api/projects`)
- `GET /:projectId/collaborators` - List collaborators
- `POST /:projectId/collaborators` - Add collaborator (owner/editor only)
- `DELETE /:projectId/collaborators/:userId` - Remove collaborator (owner only)
- `GET /:projectId/commits` - Get commit history
- `POST /:projectId/commits` - Create commit (owner/editor only)
- `GET /user/:userId` - Get user's projects (owned + collaborations)

### Security Implementation

#### Fixed Critical Issues (Architect Review)
1. **Project Authorization** ✅
   - All mutation endpoints verify ownership/collaborator role
   - Prevents unauthorized access to project data
   - Proper 403 responses for forbidden actions

2. **Code Execution Sandboxing** ✅
   - Disabled by default (`ENABLE_CODE_EXECUTION=false`)
   - Comprehensive security warnings in code and docs
   - Clear guidance on production requirements:
     - Container-based execution (Docker, Podman)
     - VM isolation (Firecracker, gVisor)
     - Remote execution (AWS Lambda, Cloud Functions)
     - Dedicated sandbox (E2B, Replit Code Execution API)

#### Authentication & Authorization
- JWT tokens with 7-day expiration
- bcrypt password hashing (10 rounds)
- Auth middleware for protected routes
- Role-based access control (owner/editor/viewer)

#### Rate Limiting
- In-memory store with automatic cleanup
- 100 requests/minute per IP
- Standard rate limit headers (X-RateLimit-*)
- Retry-After header on 429 responses

#### Input Validation
- Zod schemas for all request bodies
- Type-safe validation from shared schema
- Comprehensive error messages

## 🔧 Technical Stack

### Dependencies
- `bcrypt` - Password hashing
- `jsonwebtoken` - JWT authentication
- `socket.io` - Real-time WebSocket communication
- `morgan` - HTTP request logging
- `better-sqlite3` - JSON file persistence

### Middleware
- `server/middleware/auth.ts` - JWT authentication
- `server/middleware/rateLimiter.ts` - Rate limiting
- Morgan HTTP logging (combined/dev modes)
- Centralized error handling with context

### Services
- `server/services/codeExecution.ts` - Code execution engine
- `server/socket.ts` - Socket.IO event handlers
- `server/storage.ts` - Extended storage interface

## 🚀 Environment Configuration

```bash
# JWT Configuration
SESSION_SECRET=your-secret-key-min-32-chars
JWT_EXPIRATION=7d

# Code Execution (⚠️ SECURITY WARNING)
ENABLE_CODE_EXECUTION=false  # Set to true ONLY in development
CODE_EXECUTION_TIMEOUT=5000
CODE_EXECUTION_MAX_OUTPUT=10000

# Chat Configuration
CHAT_HISTORY_LIMIT=100
CHAT_MESSAGE_MAX_LENGTH=5000
```

## 📊 Observability

### Logging
- **Morgan**: HTTP request/response logging
  - Production: `combined` format
  - Development: `dev` format
  - Skips: `/assets`, `/src` paths
  - Streams to centralized logger

- **Centralized Logger**: LOG_LEVEL support (DEBUG/INFO/WARN/ERROR)
  - Error logging with context (userId, request body, stack trace)
  - Production-safe error responses (no stack in 500 errors)

### Metrics
- Job queue depth
- Processing status
- Success/failure rates
- Execution time tracking

## 🔐 Security Considerations

### Production Checklist
- [ ] Enable HTTPS/TLS
- [ ] Rotate JWT secrets regularly
- [ ] Implement proper code execution sandboxing
- [ ] Add request body size limits
- [ ] Configure CORS properly
- [ ] Set up distributed rate limiting (Redis)
- [ ] Add CSRF protection
- [ ] Implement audit logging
- [ ] Set up database backups
- [ ] Configure proper SECRET_KEY_BASE

### Known Limitations
1. **Code Execution**: NOT sandboxed, poses RCE risk
   - Requires containerization for production
   - Currently disabled by default

2. **Rate Limiting**: In-memory (not distributed)
   - Use Redis for multi-instance deployments

3. **Storage**: JSON files (not suitable for high traffic)
   - Migrate to PostgreSQL/MySQL for production

## 🧪 Testing

### Manual Testing
```bash
# Start server
npm run dev

# Test authentication
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@example.com","password":"password123"}'

# Test chat (requires auth token)
curl http://localhost:5000/api/chat/PROJECT_ID/messages \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Socket.IO Testing
```javascript
// Frontend
import { io } from 'socket.io-client';

const socket = io();
socket.emit('join_project', { projectId: 'xxx', mode: 'ai' });
socket.on('chat_message', (data) => console.log(data));
```

## 📝 Implementation Notes

### Design Decisions
1. **In-Memory Storage**: JSON persistence for development
   - Simple, no external dependencies
   - Easy to debug and inspect
   - Not suitable for production at scale

2. **JWT vs Sessions**: Chose JWT for stateless auth
   - Easier to scale horizontally
   - Works well with frontend SPA
   - Token expiration handles security

3. **Socket.IO + REST**: Dual approach for chat
   - WebSocket for real-time updates
   - REST endpoints as fallback
   - Better reliability across networks

4. **Code Execution Disabled**: Security-first approach
   - Prevents accidental production deployment
   - Forces conscious decision to enable
   - Clear warnings about requirements

### Future Enhancements
- [ ] PostgreSQL migration with Drizzle ORM
- [ ] Redis for distributed rate limiting
- [ ] Proper code execution sandbox (containers)
- [ ] Webhook system for third-party integrations
- [ ] GraphQL API for complex queries
- [ ] SSE for build streaming (already implemented for build trace)

## 🔗 Related Files

### Core Implementation
- `server/index.ts` - Main server with middleware stack
- `server/routes.ts` - Route registration
- `server/storage.ts` - Extended storage interface
- `shared/schema.ts` - Database schema + Zod validators

### Routes
- `server/routes/auth.ts` - Authentication endpoints
- `server/routes/chat.ts` - Chat REST endpoints
- `server/routes/execute.ts` - Code execution endpoint
- `server/routes/projects.ts` - Project management endpoints

### Middleware & Services
- `server/middleware/auth.ts` - JWT authentication
- `server/middleware/rateLimiter.ts` - Rate limiting
- `server/services/codeExecution.ts` - Code execution engine
- `server/socket.ts` - Socket.IO handlers

### Configuration
- `.env.example` - Environment variables template
- `BACKEND_IMPLEMENTATION.md` - This documentation

## 📄 License & Credits

Part of YBUILT Platform 10x infrastructure.
See main README.md for full credits and license information.
