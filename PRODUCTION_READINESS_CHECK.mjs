import bookioAuthService from './src/services/bookioAuthService.js';
import bookioScheduler from './src/services/bookioScheduler.js';
import config from './config/bookio-config.js';

/**
 * Production Readiness Check for REFRESH Studio Booking System
 * Verifies all systems are operational for live production use
 */

console.log('🏥 REFRESH STUDIO - PRODUCTION READINESS CHECK');
console.log('==============================================\n');

async function checkProductionReadiness() {
    const results = {
        authentication: false,
        scheduling: false,
        tokenRefresh: false,
        bookingAPI: false,
        overallReady: false
    };
    
    try {
        // 1. Check Authentication System
        console.log('1️⃣ AUTHENTICATION SYSTEM CHECK');
        console.log('------------------------------');
        
        console.log('🔐 Testing authentication with REFRESH credentials...');
        await bookioAuthService.initialize();
        
        const authStatus = bookioAuthService.getStatus();
        console.log('✅ Authentication Status:', {
            environment: authStatus.environment,
            cookieValid: authStatus.cookieValid,
            lastRefresh: authStatus.lastRefresh
        });
        
        if (authStatus.cookieValid) {
            results.authentication = true;
            console.log('✅ Authentication system operational\n');
        } else {
            console.log('❌ Authentication system failed\n');
            return results;
        }
        
        // 2. Check Token Refresh Configuration  
        console.log('2️⃣ TOKEN REFRESH CONFIGURATION');
        console.log('-------------------------------');
        
        console.log('📋 Current configuration:');
        console.log(`   Environment: ${config.name}`);
        console.log(`   Cookie Max Age: ${config.auth.cookieMaxAge / 1000 / 60 / 60} hours`);
        console.log(`   Refresh Interval: ${config.auth.cookieRefreshInterval / 1000 / 60 / 60} hours`);
        console.log(`   Refresh Buffer: 1 hour before expiry`);
        
        // Test refresh logic
        console.log('\\n🧪 Testing refresh logic...');
        const shouldRefresh = bookioAuthService.shouldRefresh();
        console.log(`   Should refresh now: ${shouldRefresh}`);
        
        if (config.auth.cookieMaxAge === 12 * 60 * 60 * 1000) {
            results.tokenRefresh = true;
            console.log('✅ Token refresh configured for 12-hour cycle\n');
        } else {
            console.log('⚠️ Token refresh not configured for 12-hour cycle\n');
        }
        
        // 3. Check Scheduler System
        console.log('3️⃣ SCHEDULER SYSTEM CHECK');
        console.log('-------------------------');
        
        console.log('⏰ Starting scheduler for production test...');
        await bookioScheduler.start();
        
        const schedulerStatus = bookioScheduler.getStatus();
        console.log('📊 Scheduler Status:', {
            running: schedulerStatus.scheduler.running,
            refreshInterval: `${schedulerStatus.scheduler.refreshInterval / 1000 / 60 / 60} hours`
        });
        
        if (schedulerStatus.scheduler.running) {
            results.scheduling = true;
            console.log('✅ Scheduler system operational');
            
            // Stop scheduler after test
            bookioScheduler.stop();
            console.log('🛑 Scheduler stopped (test mode)\n');
        } else {
            console.log('❌ Scheduler system failed\n');
        }
        
        // 4. Check Booking API
        console.log('4️⃣ BOOKING API TEST');
        console.log('-------------------');
        
        console.log('📤 Testing API connectivity...');
        
        // Test with a simple request (without creating actual booking)
        const testData = { facility: config.facility };
        const cookieHeader = await bookioAuthService.getCookieHeader();
        
        // Test API access with services endpoint
        const https = await import('https');
        const testResult = await new Promise((resolve) => {
            const postData = JSON.stringify(testData);
            const options = {
                hostname: 'services.bookio.com',
                port: 443,
                path: '/client-admin/api/schedule/services',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData),
                    'Cookie': cookieHeader,
                    'Accept': 'application/json, text/plain, */*',
                    'X-Requested-With': 'XMLHttpRequest'
                }
            };
            
            const req = https.default.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        resolve({ status: res.statusCode, data: json });
                    } catch (e) {
                        resolve({ status: res.statusCode, data: data });
                    }
                });
            });
            
            req.on('error', () => resolve({ status: 0, data: null }));
            req.write(postData);
            req.end();
        });
        
        if (testResult.status === 200 && testResult.data && testResult.data.data) {
            results.bookingAPI = true;
            console.log(`✅ API connectivity confirmed - ${testResult.data.data.length} services available`);
        } else {
            console.log(`❌ API connectivity failed - Status: ${testResult.status}`);
        }
        
        // 5. Overall Readiness Assessment
        console.log('\\n5️⃣ OVERALL READINESS ASSESSMENT');
        console.log('=================================');
        
        results.overallReady = results.authentication && 
                              results.scheduling && 
                              results.tokenRefresh && 
                              results.bookingAPI;
        
        console.log('📊 System Check Results:');
        console.log(`   ✅ Authentication: ${results.authentication ? 'PASS' : 'FAIL'}`);
        console.log(`   ✅ Token Refresh: ${results.tokenRefresh ? 'PASS' : 'FAIL'}`);
        console.log(`   ✅ Scheduler: ${results.scheduling ? 'PASS' : 'FAIL'}`);
        console.log(`   ✅ Booking API: ${results.bookingAPI ? 'PASS' : 'FAIL'}`);
        
        if (results.overallReady) {
            console.log('\\n🎉 SYSTEM IS PRODUCTION READY! 🚀');
            console.log('=================================');
            console.log('✅ All systems operational');
            console.log('✅ 12-hour token refresh cycle configured');
            console.log('✅ Automatic refresh with 1-hour buffer');
            console.log('✅ REFRESH facility access confirmed');
            console.log('✅ Ready for voice agent integration');
        } else {
            console.log('\\n⚠️ SYSTEM NOT READY FOR PRODUCTION');
            console.log('===================================');
            console.log('❌ Some systems failed checks');
            console.log('🔧 Fix issues before deploying');
        }
        
        // 6. Production Setup Instructions
        if (results.overallReady) {
            console.log('\\n📋 PRODUCTION DEPLOYMENT STEPS:');
            console.log('1. Start scheduler: await bookioScheduler.start()');
            console.log('2. Monitor logs for refresh cycles');
            console.log('3. Set up monitoring/alerts for auth failures');
            console.log('4. Deploy voice agent with booking integration');
        }
        
    } catch (error) {
        console.error('❌ Production readiness check failed:', error.message);
    } finally {
        // Cleanup
        await bookioAuthService.closeBrowser().catch(() => {});
    }
    
    return results;
}

// Run the check
checkProductionReadiness().then(results => {
    console.log('\\n📊 Final Results:', results);
    process.exit(results.overallReady ? 0 : 1);
}).catch(console.error);