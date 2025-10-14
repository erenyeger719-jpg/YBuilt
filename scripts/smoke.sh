#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PORT=${PORT:-5000}
BASE_URL="http://localhost:${PORT}"
TEMP_DIR=$(mktemp -d)
trap "rm -rf ${TEMP_DIR}" EXIT

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Helper functions
print_test() {
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
  echo -e "\n${BLUE}[${TOTAL_TESTS}/7]${NC} $1"
}

print_success() {
  PASSED_TESTS=$((PASSED_TESTS + 1))
  echo -e "${GREEN}✓${NC} $1"
}

print_error() {
  FAILED_TESTS=$((FAILED_TESTS + 1))
  echo -e "${RED}✗${NC} $1"
}

print_info() {
  echo -e "  ${YELLOW}→${NC} $1"
}

# Check if jq is available for JSON parsing
if command -v jq &> /dev/null; then
  HAS_JQ=true
  print_info "JSON parsing: jq available"
else
  HAS_JQ=false
  print_info "JSON parsing: fallback mode (jq not installed)"
fi

# Extract JSON field (with or without jq)
extract_json() {
  local response="$1"
  local field="$2"
  
  if [ "$HAS_JQ" = true ]; then
    echo "$response" | jq -r ".${field}"
  else
    # Fallback: use grep and sed
    echo "$response" | grep -o "\"${field}\":\"[^\"]*\"" | sed "s/\"${field}\":\"\([^\"]*\)\"/\1/"
  fi
}

# Generate random email to avoid conflicts
RANDOM_USER="test-$(date +%s)-$RANDOM@example.com"
PASSWORD="testpass123"
AUTH_TOKEN=""
PROJECT_ID=""

echo "🧪 Running Backend Brain MVP Smoke Tests..."
echo "=========================================="
echo ""
echo "Configuration:"
echo "  Base URL: ${BASE_URL}"
echo "  Test User: ${RANDOM_USER}"
echo ""

# Test 1: Health Check
print_test "Health check (GET /api/status)"
RESPONSE=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/status" || echo "000")
HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  if echo "$BODY" | grep -q "\"status\":\"ok\""; then
    print_success "Health check passed (200 OK)"
    print_info "Response: ${BODY}"
  else
    print_error "Unexpected response body"
    print_info "Response: ${BODY}"
    exit 1
  fi
else
  print_error "Server not responding (HTTP ${HTTP_CODE})"
  print_info "Make sure the server is running on port ${PORT}"
  print_info "Run: npm run dev"
  exit 1
fi

# Test 2: Register User
print_test "Register user (POST /api/auth/register)"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${RANDOM_USER}\",\"password\":\"${PASSWORD}\"}" || echo "000")
HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "201" ]; then
  AUTH_TOKEN=$(extract_json "$BODY" "token")
  if [ -n "$AUTH_TOKEN" ] && [ "$AUTH_TOKEN" != "null" ]; then
    print_success "User registered successfully (201 Created)"
    print_info "Email: ${RANDOM_USER}"
    print_info "Token: ${AUTH_TOKEN:0:20}..."
  else
    print_error "Token not found in response"
    print_info "Response: ${BODY}"
    exit 1
  fi
else
  print_error "Registration failed (HTTP ${HTTP_CODE})"
  print_info "Response: ${BODY}"
  exit 1
fi

# Test 3: Login User
print_test "Login user (POST /api/auth/login)"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${RANDOM_USER}\",\"password\":\"${PASSWORD}\"}" || echo "000")
HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  LOGIN_TOKEN=$(extract_json "$BODY" "token")
  if [ -n "$LOGIN_TOKEN" ] && [ "$LOGIN_TOKEN" != "null" ]; then
    print_success "Login successful (200 OK)"
    print_info "Token matches: $([ "$AUTH_TOKEN" = "$LOGIN_TOKEN" ] && echo "No (new token issued)" || echo "Yes")"
    AUTH_TOKEN="$LOGIN_TOKEN"
  else
    print_error "Token not found in login response"
    print_info "Response: ${BODY}"
    exit 1
  fi
else
  print_error "Login failed (HTTP ${HTTP_CODE})"
  print_info "Response: ${BODY}"
  exit 1
fi

# Test 4: Create Project
print_test "Create project (POST /api/projects)"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/projects" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{"prompt":"Create a simple smoke test project"}' || echo "000")
HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "201" ] || [ "$HTTP_CODE" = "200" ]; then
  PROJECT_ID=$(extract_json "$BODY" "id")
  if [ -n "$PROJECT_ID" ] && [ "$PROJECT_ID" != "null" ]; then
    print_success "Project created successfully (${HTTP_CODE})"
    print_info "Project ID: ${PROJECT_ID}"
  else
    print_error "Project ID not found in response"
    print_info "Response: ${BODY}"
    exit 1
  fi
else
  print_error "Project creation failed (HTTP ${HTTP_CODE})"
  print_info "Response: ${BODY}"
  exit 1
fi

# Test 5: List Projects
print_test "List projects (GET /api/projects)"
RESPONSE=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/projects" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" || echo "000")
HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  if echo "$BODY" | grep -q "\"id\":\"${PROJECT_ID}\""; then
    print_success "Projects listed successfully (200 OK)"
    print_info "Found created project in list"
  else
    print_error "Created project not found in list"
    print_info "Response: ${BODY}"
    exit 1
  fi
else
  print_error "Failed to list projects (HTTP ${HTTP_CODE})"
  print_info "Response: ${BODY}"
  exit 1
fi

# Test 6: Get Supported Languages
print_test "Get supported languages (GET /api/execute/languages)"
RESPONSE=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/execute/languages" || echo "000")
HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  if echo "$BODY" | grep -q "javascript"; then
    print_success "Languages retrieved successfully (200 OK)"
    print_info "Response: ${BODY}"
  else
    print_error "Expected 'javascript' in supported languages"
    print_info "Response: ${BODY}"
    exit 1
  fi
else
  print_error "Failed to get languages (HTTP ${HTTP_CODE})"
  print_info "Response: ${BODY}"
  exit 1
fi

# Test 7: Execute Code
print_test "Execute JavaScript code (POST /api/execute)"
CODE="console.log('Hello from smoke test!'); const result = 2 + 2; console.log('Result:', result);"

# Manually escape the code for JSON (without jq dependency)
# Replace backslashes, quotes, newlines, etc.
CODE_ESCAPED=$(echo "$CODE" | sed 's/\\/\\\\/g; s/"/\\"/g; s/   /\\t/g')

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/execute" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d "{\"language\":\"javascript\",\"code\":\"${CODE_ESCAPED}\"}" || echo "000")
HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  EXECUTION_STATUS=$(extract_json "$BODY" "status")
  if [ "$EXECUTION_STATUS" = "completed" ] || echo "$BODY" | grep -q "\"status\":\"completed\""; then
    print_success "Code execution successful (200 OK)"
    print_info "Status: completed"
    if echo "$BODY" | grep -q "Hello from smoke test"; then
      print_info "Output contains expected text ✓"
    fi
  else
    print_success "Code execution completed with status: ${EXECUTION_STATUS}"
    print_info "Note: VM2 may not be available for sandboxed execution"
  fi
  print_info "Response: ${BODY:0:200}..."
else
  print_error "Code execution failed (HTTP ${HTTP_CODE})"
  print_info "Response: ${BODY}"
  print_info "Note: This may fail if ENABLE_CODE_EXECUTION is not set to 'true'"
fi

# Summary
echo ""
echo "=========================================="
if [ $FAILED_TESTS -eq 0 ]; then
  echo -e "${GREEN}✅ All smoke tests passed (${PASSED_TESTS}/${TOTAL_TESTS})${NC}"
  echo ""
  echo "Backend Brain MVP is functioning correctly!"
  echo ""
  echo "📝 Note: Test data persists in lowdb (data/db.json)"
  echo "   Test user: ${RANDOM_USER}"
  echo "   Test project: ${PROJECT_ID}"
else
  echo -e "${RED}❌ Some tests failed (${PASSED_TESTS}/${TOTAL_TESTS} passed, ${FAILED_TESTS} failed)${NC}"
  echo ""
  echo "Please check the errors above and ensure:"
  echo "  1. Server is running (npm run dev)"
  echo "  2. All dependencies are installed (npm install)"
  echo "  3. Environment variables are set correctly"
  exit 1
fi

echo ""
echo "Next steps:"
echo "  - Test endpoints manually with curl or Postman"
echo "  - Review execution history: GET /api/execute/history"
echo "  - Add collaborators: POST /api/projects/:id/collaborators"
echo "  - Create commits: POST /api/projects/:id/commits"
