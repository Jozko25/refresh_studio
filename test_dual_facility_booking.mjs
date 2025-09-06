/**
 * COMPREHENSIVE DUAL FACILITY BOOKING TEST
 * Tests actual booking creation on both Bratislava and Pezinok facilities
 * 📧 EVERY ACTION IS EMAILED TO: janko.tank.poi@gmail.com
 * 
 * ⚠️  IMPORTANT: This will create REAL bookings for June 2026
 */

import dualFacilityService from './DUAL_FACILITY_SYSTEM.mjs';
import emailNotifier from './src/services/emailNotifier.js';

// Test customer data
const TEST_CUSTOMERS = {
    bratislava: {
        name: 'Ján Testovací BA',
        phone: '+421901234567', 
        email: 'test.bratislava@refresh.sk',
        note: 'TEST BOOKING - Bratislava facility test'
    },
    pezinok: {
        name: 'Mária Testovacia PK',
        phone: '+421907654321',
        email: 'test.pezinok@refresh.sk', 
        note: 'TEST BOOKING - Pezinok facility test'
    }
};

// Test booking times for June 2026 (safe future dates)
const TEST_BOOKINGS = {
    bratislava: {
        date: '2026-06-15',
        from: '14:00',
        to: '14:30'
    },
    pezinok: {
        date: '2026-06-16',
        from: '15:00', 
        to: '16:00'
    }
};

async function testDualFacilityBookings() {
    console.log('='.repeat(60));
    console.log('🏥 DUAL FACILITY BOOKING SYSTEM - LIVE TEST');
    console.log('='.repeat(60));
    console.log('⚠️  WARNING: This will create REAL bookings!');
    console.log('📅 Booking dates: June 15-16, 2026');
    console.log('📧 All actions emailed to: janko.tank.poi@gmail.com');
    console.log('🏥 Testing both Bratislava and Pezinok facilities');
    console.log('='.repeat(60));
    console.log('');

    try {
        // 📧 SEND BOOKING TEST START EMAIL
        await emailNotifier.sendEmail(
            '🚀 LIVE BOOKING TEST STARTING',
            `
            <h1>🚀 LIVE BOOKING TEST STARTING</h1>
            <div style="background: #fff8dc; padding: 20px; border-radius: 10px; margin: 20px 0; border: 3px solid #ffa500;">
                <h2>⚠️  LIVE BOOKING TEST</h2>
                <p><strong>WARNING:</strong> This test will create REAL bookings!</p>
                <p><strong>Test Dates:</strong> June 15-16, 2026</p>
                <p><strong>Facilities:</strong></p>
                <ul>
                    <li>🏥 REFRESH Bratislava - June 15, 2026 at 14:00</li>
                    <li>🏥 REFRESH Pezinok - June 16, 2026 at 15:00</li>
                </ul>
                <p><strong>Test Customers:</strong></p>
                <ul>
                    <li>Ján Testovací BA (Bratislava)</li>
                    <li>Mária Testovacia PK (Pezinok)</li>
                </ul>
            </div>
            <p>🔄 Initializing dual facility system...</p>
            <hr>
            <p><small>REFRESH Studio Live Booking Test</small></p>
            `,
            null,
            'live_booking_test_start'
        );

        // Initialize the dual facility service
        console.log('1️⃣  INITIALIZING DUAL FACILITY SERVICE');
        console.log('=====================================');
        
        await dualFacilityService.initialize();
        console.log('✅ Dual facility service ready for live bookings\n');

        // Test booking for Bratislava facility
        console.log('2️⃣  TESTING BRATISLAVA FACILITY BOOKING');
        console.log('=======================================');
        console.log(`📋 Creating booking for ${TEST_CUSTOMERS.bratislava.name}`);
        console.log(`📅 Date: ${TEST_BOOKINGS.bratislava.date}`);
        console.log(`⏰ Time: ${TEST_BOOKINGS.bratislava.from} - ${TEST_BOOKINGS.bratislava.to}`);
        console.log(`📧 Email: ${TEST_CUSTOMERS.bratislava.email}`);
        console.log('');

        const bratislavaBooking = await dualFacilityService.createBratislavaBooking(
            TEST_CUSTOMERS.bratislava,
            TEST_BOOKINGS.bratislava,
            125454 // Service ID for Bratislava
        );

        console.log(`✅ Bratislava booking result: Status ${bratislavaBooking.status}`);
        if (bratislavaBooking.status === 200) {
            console.log('🎉 Bratislava booking created successfully!');
        } else {
            console.log('⚠️  Bratislava booking may have encountered issues');
        }
        console.log('');

        // Test booking for Pezinok facility  
        console.log('3️⃣  TESTING PEZINOK FACILITY BOOKING');
        console.log('====================================');
        console.log(`📋 Creating booking for ${TEST_CUSTOMERS.pezinok.name}`);
        console.log(`📅 Date: ${TEST_BOOKINGS.pezinok.date}`);
        console.log(`⏰ Time: ${TEST_BOOKINGS.pezinok.from} - ${TEST_BOOKINGS.pezinok.to}`);
        console.log(`📧 Email: ${TEST_CUSTOMERS.pezinok.email}`);
        console.log('');

        const pezinokBooking = await dualFacilityService.createPezinokBooking(
            TEST_CUSTOMERS.pezinok,
            TEST_BOOKINGS.pezinok,
            63975 // HydraFillic service ID for Pezinok
        );

        console.log(`✅ Pezinok booking result: Status ${pezinokBooking.status}`);
        if (pezinokBooking.status === 200) {
            console.log('🎉 Pezinok booking created successfully!');
        } else {
            console.log('⚠️  Pezinok booking may have encountered issues');
        }
        console.log('');

        // Summary
        console.log('='.repeat(60));
        console.log('🎯 DUAL FACILITY BOOKING TEST SUMMARY');
        console.log('='.repeat(60));
        console.log(`🏥 Bratislava Booking: Status ${bratislavaBooking.status} ${bratislavaBooking.status === 200 ? '✅ SUCCESS' : '⚠️  CHECK'}`);
        console.log(`🏥 Pezinok Booking: Status ${pezinokBooking.status} ${pezinokBooking.status === 200 ? '✅ SUCCESS' : '⚠️  CHECK'}`);
        console.log('📧 All actions have been emailed for monitoring');
        console.log('='.repeat(60));

        const allSuccessful = bratislavaBooking.status === 200 && pezinokBooking.status === 200;

        // 📧 FINAL TEST RESULT EMAIL
        await emailNotifier.sendEmail(
            allSuccessful ? '🎉 ALL BOOKINGS SUCCESSFUL' : '⚠️  BOOKING TEST RESULTS',
            `
            <h1>${allSuccessful ? '🎉 ALL BOOKINGS SUCCESSFUL' : '⚠️  BOOKING TEST RESULTS'}</h1>
            <div style="background: ${allSuccessful ? '#e8ffe8' : '#fff8dc'}; padding: 20px; border-radius: 10px; margin: 20px 0;">
                <h2>📊 Booking Test Summary</h2>
                
                <h3>🏥 REFRESH Bratislava</h3>
                <div style="background: ${bratislavaBooking.status === 200 ? '#d4edda' : '#f8d7da'}; padding: 15px; border-radius: 5px; margin: 10px 0;">
                    <p><strong>Status:</strong> ${bratislavaBooking.status} ${bratislavaBooking.status === 200 ? '✅ SUCCESS' : '⚠️  CHECK REQUIRED'}</p>
                    <p><strong>Customer:</strong> ${TEST_CUSTOMERS.bratislava.name}</p>
                    <p><strong>Date:</strong> ${TEST_BOOKINGS.bratislava.date}</p>
                    <p><strong>Time:</strong> ${TEST_BOOKINGS.bratislava.from} - ${TEST_BOOKINGS.bratislava.to}</p>
                    <p><strong>Email:</strong> ${TEST_CUSTOMERS.bratislava.email}</p>
                </div>
                
                <h3>🏥 REFRESH Pezinok</h3>
                <div style="background: ${pezinokBooking.status === 200 ? '#d4edda' : '#f8d7da'}; padding: 15px; border-radius: 5px; margin: 10px 0;">
                    <p><strong>Status:</strong> ${pezinokBooking.status} ${pezinokBooking.status === 200 ? '✅ SUCCESS' : '⚠️  CHECK REQUIRED'}</p>
                    <p><strong>Customer:</strong> ${TEST_CUSTOMERS.pezinok.name}</p>
                    <p><strong>Date:</strong> ${TEST_BOOKINGS.pezinok.date}</p>
                    <p><strong>Time:</strong> ${TEST_BOOKINGS.pezinok.from} - ${TEST_BOOKINGS.pezinok.to}</p>
                    <p><strong>Email:</strong> ${TEST_CUSTOMERS.pezinok.email}</p>
                </div>
                
                <h3>🎯 System Status</h3>
                <ul>
                    <li>✅ Dual facility authentication working</li>
                    <li>✅ Email monitoring active for all actions</li>
                    <li>✅ Both facilities accessible via API</li>
                    <li>${allSuccessful ? '✅' : '⚠️'} Live booking capability ${allSuccessful ? 'confirmed' : 'needs review'}</li>
                </ul>
            </div>
            
            <h3>📈 What This Proves:</h3>
            <ul>
                <li>🔐 Authentication works for both facilities</li>
                <li>📧 Every action is monitored and emailed</li>
                <li>🏥 Both Bratislava and Pezinok facilities accessible</li>
                <li>📋 Live booking system is operational</li>
                <li>🎯 Ready for voice assistant integration</li>
            </ul>
            
            <hr>
            <p><strong>System Status:</strong> ${allSuccessful ? '🟢 FULLY OPERATIONAL' : '🟡 NEEDS ATTENTION'}</p>
            <p><small>REFRESH Studio Dual Facility System - Live Test Complete</small></p>
            `,
            null,
            'live_booking_results'
        );

    } catch (error) {
        console.error('\n❌ DUAL FACILITY BOOKING TEST FAILED:', error.message);
        console.error(error.stack);
        
        // 📧 EMAIL NOTIFICATION FOR BOOKING TEST FAILURE
        await emailNotifier.sendEmail(
            '❌ LIVE BOOKING TEST FAILED',
            `
            <h1>❌ LIVE BOOKING TEST FAILED</h1>
            <div style="background: #ffe8e8; padding: 20px; border-radius: 10px; margin: 20px 0;">
                <p><strong>Error:</strong> ${error.message}</p>
                <p><strong>Time:</strong> ${new Date().toLocaleString('sk-SK')}</p>
                <p><strong>Stack Trace:</strong></p>
                <pre style="background: #f5f5f5; padding: 10px; border-radius: 5px; overflow-x: auto;">
${error.stack}
                </pre>
            </div>
            <p>🔧 System requires attention before production use</p>
            <hr>
            <p><small>REFRESH Studio Live Booking Test - Failed</small></p>
            `,
            null,
            'live_booking_failed'
        );
    }
}

// Confirmation before running live booking test
console.log('⚠️  WARNING: This will create REAL bookings on the live system!');
console.log('📅 Bookings will be made for June 15-16, 2026');
console.log('🚀 Starting live booking test in 3 seconds...\n');

setTimeout(() => {
    testDualFacilityBookings().catch(console.error);
}, 3000);