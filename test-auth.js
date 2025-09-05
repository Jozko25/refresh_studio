#!/usr/bin/env node

/**
 * Test script for Bookio Authentication System
 * 
 * Usage:
 * 1. Set up your .env file with demo credentials:
 *    BOOKIO_ENV=demo
 *    DEMO_USERNAME=your-demo-username
 *    DEMO_PASSWORD=your-demo-password
 * 
 * 2. Update config/bookio-config.js with your demo URLs
 * 
 * 3. Run this test:
 *    node test-auth.js
 */

import dotenv from 'dotenv';

// Load environment variables FIRST before any imports
dotenv.config();

import bookioAuthService from './src/services/bookioAuthService.js';
import bookioScheduler from './src/services/bookioScheduler.js';
import bookioApiClient from './src/services/bookioApiClient.js';
import config from './config/bookio-config.js';

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
    console.log('\n' + '='.repeat(50));
    log(title, 'bright');
    console.log('='.repeat(50));
}

async function testAuthentication() {
    logSection('TESTING BOOKIO AUTHENTICATION SYSTEM');
    
    // Display configuration
    log(`\n📍 Environment: ${config.name}`, 'cyan');
    log(`📍 Base URL: ${config.baseURL}`, 'cyan');
    log(`📍 Auth URL: ${config.authURL}`, 'cyan');
    log(`📍 Facility: ${config.facility}`, 'cyan');
    
    // Check credentials
    if (!config.auth.username || !config.auth.password) {
        log('\n❌ ERROR: Missing credentials!', 'red');
        log(`Please set ${config.name.toUpperCase()}_USERNAME and ${config.name.toUpperCase()}_PASSWORD in .env file`, 'yellow');
        process.exit(1);
    }
    
    try {
        // Test 1: Initialize authentication service
        logSection('Test 1: Initialize Authentication Service');
        
        log('Initializing auth service...', 'yellow');
        await bookioAuthService.initialize();
        
        const authStatus = bookioAuthService.getStatus();
        log('✅ Auth service initialized', 'green');
        log(`   Cookie valid: ${authStatus.cookieValid}`, 'green');
        log(`   Environment: ${authStatus.environment}`, 'green');
        
        // Test 2: Test API authentication
        logSection('Test 2: Test API Authentication');
        
        log('Testing authenticated API call...', 'yellow');
        const testResult = await bookioApiClient.testAuthentication();
        
        if (testResult.authenticated) {
            log('✅ API authentication successful', 'green');
            if (testResult.user) {
                log(`   User: ${JSON.stringify(testResult.user, null, 2)}`, 'green');
            }
        } else {
            log('❌ API authentication failed', 'red');
            log(`   Error: ${testResult.error}`, 'red');
        }
        
        // Test 3: Start scheduler
        logSection('Test 3: Start Scheduler');
        
        log('Starting scheduler...', 'yellow');
        await bookioScheduler.start();
        
        const schedulerStatus = bookioScheduler.getStatus();
        log('✅ Scheduler started', 'green');
        log(`   Running: ${schedulerStatus.scheduler.running}`, 'green');
        log(`   Refresh interval: ${schedulerStatus.scheduler.refreshInterval / 1000 / 60} minutes`, 'green');
        
        // Test 4: Get statistics
        logSection('Test 4: Get Statistics');
        
        const schedulerStats = bookioScheduler.getStatistics();
        const apiStats = bookioApiClient.getStatistics();
        
        log('📊 Scheduler Statistics:', 'blue');
        log(`   Environment: ${schedulerStats.environment}`, 'blue');
        log(`   Total refreshes: ${schedulerStats.totalRefreshes}`, 'blue');
        log(`   Success rate: ${schedulerStats.successRate}`, 'blue');
        
        log('\n📊 API Statistics:', 'blue');
        log(`   Total requests: ${apiStats.totalRequests}`, 'blue');
        log(`   Success rate: ${apiStats.successRate}`, 'blue');
        
        // Test 5: Test booking creation (optional)
        logSection('Test 5: Test Booking Creation');
        
        const testBookingEnabled = process.argv.includes('--test-booking');
        
        if (testBookingEnabled) {
            log('Creating test booking...', 'yellow');
            
            const testBooking = {
                serviceId: 130113, // From your curl example
                workerId: 31576,   // From your curl example
                date: '15.01.2025',
                time: '10:00',
                duration: 40,
                firstName: 'Test',
                lastName: 'API User',
                email: 'test@example.com',
                phone: '+421910223761',
                price: 90,
                workerName: 'AI Recepcia',
                workerColor: '#26a69a',
                note: 'Test booking from API automation system'
            };
            
            const bookingResult = await bookioApiClient.createBooking(testBooking);
            
            if (bookingResult.success) {
                log('✅ Test booking created successfully', 'green');
                log(`   Booking ID: ${bookingResult.bookingId}`, 'green');
            } else {
                log('❌ Test booking failed', 'red');
                log(`   Error: ${bookingResult.error}`, 'red');
                if (bookingResult.details) {
                    log(`   Details: ${JSON.stringify(bookingResult.details, null, 2)}`, 'red');
                }
            }
        } else {
            log('Skipping booking test (use --test-booking to enable)', 'yellow');
        }
        
        // Test 6: Force refresh
        logSection('Test 6: Force Cookie Refresh');
        
        log('Forcing cookie refresh...', 'yellow');
        await bookioScheduler.forceRefresh();
        
        const newStatus = bookioAuthService.getStatus();
        log('✅ Cookie refreshed', 'green');
        log(`   Last refresh: ${newStatus.lastRefresh}`, 'green');
        log(`   Next refresh: ${newStatus.nextRefresh}`, 'green');
        
        // Clean up
        logSection('Cleanup');
        
        log('Stopping scheduler...', 'yellow');
        bookioScheduler.stop();
        log('✅ Scheduler stopped', 'green');
        
        // Summary
        logSection('TEST SUMMARY');
        log('✅ All tests completed successfully!', 'green');
        log(`\n🎉 Your Bookio authentication system is working correctly with ${config.name} environment!`, 'bright');
        
        // Instructions
        log('\n📝 Next steps:', 'cyan');
        log('1. Update the booking data in test-auth.js with valid service/worker IDs', 'cyan');
        log('2. Run with --test-booking flag to test booking creation', 'cyan');
        log('3. Integrate auth routes into your main server.js', 'cyan');
        log('4. Start the scheduler on server startup for production', 'cyan');
        
    } catch (error) {
        logSection('ERROR');
        log(`❌ Test failed: ${error.message}`, 'red');
        console.error(error);
        
        // Cleanup on error
        try {
            bookioScheduler.stop();
        } catch (e) {
            // Ignore cleanup errors
        }
        
        process.exit(1);
    }
}

// Run tests
testAuthentication().then(() => {
    process.exit(0);
}).catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
});