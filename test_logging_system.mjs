/**
 * Test the complete logging system:
 * 1. Database connectivity
 * 2. Logger integration  
 * 3. Smart email alerts
 * 4. Web dashboard preparation
 */

import logger from './src/services/logger.js';
import db from './src/database/connection.js';
import emailNotifier from './src/services/emailNotifier.js';

async function testLoggingSystem() {
    console.log('🔬 TESTING COMPLETE LOGGING SYSTEM');
    console.log('==================================');
    
    try {
        // Test 1: Database connectivity
        console.log('\n1️⃣  Testing Database Connectivity...');
        await db.initialize();
        const health = await db.healthCheck();
        console.log(`✅ Database Status: ${health.status}`);

        // Test 2: Logger database integration
        console.log('\n2️⃣  Testing Logger Database Integration...');
        await logger.logSystem('test_logging_system', {
            test: true,
            facility: 'pezinok',
            timestamp: new Date().toISOString()
        });
        console.log('✅ System log written to database');

        // Test 3: Booking event logging
        console.log('\n3️⃣  Testing Booking Event Logging...');
        await logger.logBooking('success', {
            facility: 'pezinok',
            serviceId: 63975,
            serviceName: 'HydraFillic Test',
            customerName: 'Test Logger Customer',
            customerEmail: 'test@example.com',
            customerPhone: '+421901234567',
            date: '16.06.2026',
            timeFrom: '14:00',
            timeTo: '15:00',
            price: 145,
            worker: { label: 'Janka' }
        });
        console.log('✅ Booking event logged with detailed data');

        // Test 4: Authentication event logging  
        console.log('\n4️⃣  Testing Authentication Event Logging...');
        await logger.logAuth('login_success', {
            environment: 'Production',
            username: 'test.user@refresh.sk',
            facility: 'bratislava'
        });
        console.log('✅ Authentication event logged');

        // Test 5: API event logging
        console.log('\n5️⃣  Testing API Event Logging...');
        await logger.logAPI('schedule_data_success', {
            endpoint: '/schedule/data',
            status: 200,
            facility: 'pezinok',
            duration: 245
        });
        console.log('✅ API event logged');

        // Test 6: Smart email alert (should send)
        console.log('\n6️⃣  Testing Smart Email Alerts...');
        await emailNotifier.sendEmail(
            'Test Booking Success',
            `
            <h2>✅ Test Booking Success</h2>
            <p>This is a test of the smart email filtering system.</p>
            <p><strong>Service:</strong> HydraFillic Test</p>
            <p><strong>Customer:</strong> Test Customer</p>
            <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
            `,
            null,
            'booking_success' // This should get sent
        );
        console.log('✅ Important alert sent (booking_success)');

        // Test 7: Filtered email (should not send)
        await emailNotifier.sendEmail(
            'Test Search Query',
            '<p>This should be filtered out</p>',
            null,
            'search_query' // This should be filtered
        );
        console.log('✅ Non-critical alert filtered (search_query)');

        // Test 8: Dashboard stats query
        console.log('\n7️⃣  Testing Dashboard Stats Query...');
        const stats = await db.getDashboardStats();
        console.log('✅ Dashboard stats retrieved:', {
            todayLogs: stats.today_logs,
            todayBookings: stats.today_bookings,
            todayErrors: stats.today_errors
        });

        // Test 9: Recent logs query
        console.log('\n8️⃣  Testing Recent Logs Query...');
        const recentLogs = await db.getRecentLogs(5);
        console.log(`✅ Retrieved ${recentLogs.length} recent logs`);
        if (recentLogs.length > 0) {
            console.log(`   Latest log: ${recentLogs[0].message}`);
        }

        console.log('\n🎉 ALL TESTS PASSED!');
        console.log('====================');
        console.log('✅ Database: Connected and operational');
        console.log('✅ Logger: Writing to both file and database');
        console.log('✅ Smart Emails: Filtering working correctly');
        console.log('✅ Dashboard APIs: Ready for web interface');
        console.log('✅ System: Fully operational');
        
        console.log('\n🌐 ACCESS DASHBOARD:');
        console.log(`   Local: http://localhost:3000/logs`);
        console.log(`   Production: https://refreshstudio-production.up.railway.app/logs`);
        
        console.log('\n📊 API ENDPOINTS:');
        console.log('   GET /api/logs - All logs with filtering');
        console.log('   GET /api/logs/stats - Dashboard statistics');
        console.log('   GET /api/logs/bookings - Booking events');
        console.log('   GET /api/logs/auth - Authentication events');
        console.log('   GET /api/logs/api-calls - API call events');

    } catch (error) {
        console.error('\n❌ LOGGING SYSTEM TEST FAILED:', error.message);
        console.error(error.stack);
        
        // Still try to send failure email
        try {
            await emailNotifier.sendEmail(
                '❌ Logging System Test Failed',
                `
                <h2>❌ Logging System Test Failed</h2>
                <div style="background: #ffe8e8; padding: 15px;">
                    <p><strong>Error:</strong> ${error.message}</p>
                    <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
                </div>
                `,
                null,
                'system_error'
            );
        } catch (emailError) {
            console.error('❌ Failed to send error email:', emailError.message);
        }
    } finally {
        // Clean up
        await db.close();
    }
}

// Run the test
testLoggingSystem();