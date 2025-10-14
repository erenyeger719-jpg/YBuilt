#!/bin/bash

# Backend Brain MVP Test Runner
# This script runs all unit tests for the backend endpoints

set -e

echo "🧪 Backend Brain MVP Test Suite"
echo "================================"
echo ""

# Check if tsx is available
if ! command -v tsx &> /dev/null; then
    echo "❌ Error: tsx is not installed"
    echo "Install it with: npm install -g tsx"
    exit 1
fi

# Check if server is running
echo "🔍 Checking if server is running..."
SERVER_URL="${TEST_BASE_URL:-http://localhost:5000}"

if curl -s "${SERVER_URL}/api/status" > /dev/null 2>&1; then
    echo "✅ Server is running at ${SERVER_URL}"
else
    echo "⚠️  Warning: Server may not be running at ${SERVER_URL}"
    echo "   Start the server with: npm run dev"
    echo ""
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo ""
echo "🚀 Running tests..."
echo ""

# Run all tests
tsx tests/run-all.ts

# Exit with the same code as the test runner
exit $?
