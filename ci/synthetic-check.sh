#!/bin/bash
set -euo pipefail

# Synthetic Check Script
# Performs health checks and basic endpoint validation

BASE_URL="${TEST_BASE_URL:-http://localhost:5001}"
TIMEOUT=5

echo "🔍 Running synthetic checks against $BASE_URL"

# Function to check endpoint
check_endpoint() {
    local endpoint=$1
    local expected_status=${2:-200}
    
    response=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "${BASE_URL}${endpoint}" || echo "000")
    
    if [ "$response" = "$expected_status" ] || [ "$response" = "304" ]; then
        echo "✅ ${endpoint}: HTTP $response"
        return 0
    else
        echo "❌ ${endpoint}: HTTP $response (expected $expected_status)"
        return 1
    fi
}

# Run checks
FAILED=0

check_endpoint "/api/status" 200 || FAILED=$((FAILED + 1))
check_endpoint "/api/metrics" 200 || FAILED=$((FAILED + 1))
check_endpoint "/api/me" 200 || FAILED=$((FAILED + 1))
check_endpoint "/api/settings" 200 || FAILED=$((FAILED + 1))

# Summary
if [ $FAILED -eq 0 ]; then
    echo "✅ All synthetic checks passed"
    exit 0
else
    echo "❌ $FAILED synthetic check(s) failed"
    exit 1
fi
