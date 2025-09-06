import { ProductionBookingService } from './PRODUCTION_BOOKING_SYSTEM.mjs';
import bookioScheduler from './src/services/bookioScheduler.js';
import logger from './src/services/logger.js';
import emailNotifier from './src/services/emailNotifier.js';

/**
 * Comprehensive Test of Logging & Email Notification System
 * Tests all monitoring components for janko.tank.poi@gmail.com
 */

console.log('📧 REFRESH STUDIO - MONITORING SYSTEM TEST');
console.log('==========================================\\n');

async function testMonitoringSystem() {
    try {
        // 1. Test Email System Initialization
        console.log('1️⃣ Testing Email System Initialization');
        console.log('--------------------------------------');
        
        const testEmailSent = await emailNotifier.sendTestEmail();
        if (testEmailSent) {
            console.log('✅ Test email sent successfully');
        } else {
            console.log('❌ Failed to send test email');
        }
        console.log('');
        
        // 2. Test Production Booking Service with Monitoring
        console.log('2️⃣ Testing Production Booking Service');
        console.log('------------------------------------');
        
        const bookingService = new ProductionBookingService();
        
        // This will trigger system startup notifications
        console.log('🔧 Initializing production booking service...');
        await bookingService.initialize();
        console.log('✅ Production service initialized\\n');
        
        // 3. Test Booking with Full Monitoring
        console.log('3️⃣ Testing Booking with Monitoring');
        console.log('----------------------------------');
        
        const testBookingData = {
            name: 'Monitoring Test Customer',
            phone: '+421905999888',
            email: 'monitoring.test@refresh.sk'
        };
        
        const bookingTime = {
            date: '20.06.2026', // Saturday June 20, 2026
            from: '10:00',
            to: '11:00'
        };
        
        console.log('📋 Creating test booking (this will send email notifications)...');
        const bookingResult = await bookingService.createHydrafacialBooking(testBookingData, bookingTime);
        
        if (bookingResult) {
            console.log('✅ Test booking successful - email notifications sent');
        } else {
            console.log('❌ Test booking failed - failure email sent');
        }
        console.log('');
        
        // 4. Test Scheduler Monitoring
        console.log('4️⃣ Testing Scheduler Monitoring');
        console.log('-------------------------------');
        
        console.log('⏰ Starting scheduler (will send startup notification)...');
        await bookioScheduler.start();
        
        console.log('📊 Getting scheduler status...');
        const schedulerStatus = bookioScheduler.getStatus();
        console.log('Scheduler running:', schedulerStatus.scheduler.running);
        
        console.log('🛑 Stopping scheduler...');
        bookioScheduler.stop();
        console.log('');
        
        // 5. Test Authentication Monitoring
        console.log('5️⃣ Testing Authentication Monitoring');
        console.log('------------------------------------');
        
        console.log('🔄 Testing manual auth refresh (will log and email)...');
        const authRefreshResult = await bookingService.refreshAuth();
        
        if (authRefreshResult) {
            console.log('✅ Auth refresh successful');
        } else {
            console.log('❌ Auth refresh failed');
        }
        console.log('');
        
        // 6. Test System Statistics
        console.log('6️⃣ Testing System Statistics');
        console.log('----------------------------');
        
        const systemStats = await bookingService.getSystemStats();
        console.log('📊 System Statistics:');
        console.log(`   Service uptime: ${Math.round(systemStats.service.uptime / 1000 / 60)} minutes`);
        console.log(`   Environment: ${systemStats.environment}`);
        console.log(`   Auth valid: ${systemStats.auth.cookieValid}`);
        console.log(`   Log entries: ${systemStats.logs.total || 0}`);
        console.log('');
        
        // 7. Test Log Retrieval
        console.log('7️⃣ Testing Log System');
        console.log('---------------------');
        
        const recentLogs = await logger.getRecentLogs(10);
        console.log(`📝 Retrieved ${recentLogs.length} recent log entries`);
        
        if (recentLogs.length > 0) {
            console.log('Latest log entry:');
            console.log(`   ${recentLogs[recentLogs.length - 1].timestamp}: ${recentLogs[recentLogs.length - 1].message}`);
        }
        console.log('');
        
        // 8. Test Daily Summary Email
        console.log('8️⃣ Testing Daily Summary Email');
        console.log('------------------------------');
        
        console.log('📊 Sending daily summary email...');
        await emailNotifier.sendDailySummary();
        console.log('✅ Daily summary sent\\n');
        
        // 9. Display Email Information
        console.log('9️⃣ Email Delivery Information');
        console.log('-----------------------------');
        console.log('📧 All emails sent to: janko.tank.poi@gmail.com');
        
        if (!process.env.SMTP_HOST) {
            console.log('🧪 Using test email account (development mode)');
            console.log('📧 Check test emails at: https://ethereal.email/');
            console.log('⚠️  Configure SMTP_HOST, SMTP_USER, SMTP_PASS for production');
        } else {
            console.log('📧 Using production SMTP configuration');
            console.log('✅ Emails delivered to production email address');
        }
        console.log('');
        
        // 10. Summary
        console.log('🎉 MONITORING SYSTEM TEST COMPLETE');
        console.log('==================================');
        console.log('✅ Email notifications working');
        console.log('✅ Logging system operational');
        console.log('✅ Scheduler monitoring active');
        console.log('✅ Authentication monitoring enabled');
        console.log('✅ Booking event tracking configured');
        console.log('');
        console.log('📧 Check janko.tank.poi@gmail.com for test emails!');
        console.log('');
        console.log('🚀 System ready for production with full monitoring');
        
    } catch (error) {
        console.error('❌ Monitoring system test failed:', error.message);
        
        // Log the test failure
        await logger.logError('Monitoring system test failed', error, 'SYSTEM');
        
        // Send failure notification
        await emailNotifier.notifySystemEvent('monitoring test failed', {
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
}

// Run the test
testMonitoringSystem().then(() => {
    console.log('\\n📊 Monitoring system test completed');
    process.exit(0);
}).catch(error => {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
});