#!/bin/bash

# Comprehensive test runner script for Bookio Webhook API

set -e

echo "🧪 Bookio Webhook API Test Suite"
echo "================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${2}${1}${NC}"
}

# Function to run tests with proper error handling
run_test() {
    local test_name="$1"
    local test_command="$2"
    
    print_status "Running: $test_name" $BLUE
    
    if eval "$test_command"; then
        print_status "✅ $test_name: PASSED" $GREEN
        return 0
    else
        print_status "❌ $test_name: FAILED" $RED
        return 1
    fi
}

# Check if node modules are installed
if [ ! -d "node_modules" ]; then
    print_status "Installing dependencies..." $YELLOW
    npm install
fi

# Track test results
total_tests=0
passed_tests=0

echo ""
print_status "🏃 Starting Test Execution" $BLUE
echo ""

# 1. Unit Tests
echo "1. Unit Tests (Services & Middleware)"
echo "------------------------------------"
if run_test "Unit Tests" "npm run test:unit"; then
    ((passed_tests++))
fi
((total_tests++))
echo ""

# 2. Integration Tests  
echo "2. Integration Tests (API Endpoints)"
echo "-----------------------------------"
if run_test "Integration Tests" "npm run test:integration"; then
    ((passed_tests++))
fi
((total_tests++))
echo ""

# 3. Edge Case Tests
echo "3. Edge Case & Error Handling Tests"
echo "-----------------------------------"
if run_test "Edge Case Tests" "npm run test:edge"; then
    ((passed_tests++))
fi
((total_tests++))
echo ""

# 4. Full Test Suite with Coverage
echo "4. Complete Test Suite with Coverage"
echo "------------------------------------"
if run_test "Full Test Suite" "npm run test:coverage"; then
    ((passed_tests++))
fi
((total_tests++))
echo ""

# 5. Lint Check (placeholder)
echo "5. Code Quality Check"
echo "--------------------"
if run_test "Linting" "npm run lint"; then
    ((passed_tests++))
fi
((total_tests++))
echo ""

# Summary
echo "📊 Test Summary"
echo "==============="
echo "Total Test Suites: $total_tests"
echo "Passed: $passed_tests"
echo "Failed: $((total_tests - passed_tests))"

if [ $passed_tests -eq $total_tests ]; then
    print_status "🎉 All tests passed!" $GREEN
    exit 0
else
    print_status "⚠️  Some tests failed. Check the output above for details." $YELLOW
    exit 1
fi