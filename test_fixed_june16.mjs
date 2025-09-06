/**
 * Test the fixed dual facility system for June 16, 2026
 * Now using the correct DD.MM.YYYY date format
 */

import dualFacilityService from './DUAL_FACILITY_SYSTEM.mjs';

async function testFixedBooking() {
    console.log('🎯 TESTING FIXED JUNE 16 BOOKING');
    console.log('=================================');
    console.log('📅 Date: Tuesday, June 16, 2026');
    console.log('⏰ Time: 16:00 - 17:00');
    console.log('🏥 Facility: Pezinok');
    console.log('💉 Service: HydraFillic');
    console.log('');

    try {
        // Customer data
        const customer = {
            name: 'Test Fixed Booking',
            phone: '+421901234567',
            email: 'test.fixed@refresh.sk',
            note: 'Test booking with fixed date format'
        };

        // Booking time (the system will convert 2026-06-16 to 16.06.2026)
        const bookingTime = {
            date: '2026-06-16',
            from: '16:00',
            to: '17:00'
        };

        console.log('🚀 Creating booking with fixed system...');

        const result = await dualFacilityService.createPezinokBooking(
            customer,
            bookingTime,
            63975 // HydraFillic service
        );

        console.log('');
        console.log('📊 RESULT:');
        console.log(`   Status: ${result.status}`);

        if (result.status === 200) {
            console.log('🎉 SUCCESS! Fixed booking system works');
            console.log('✅ The date format fix resolved the 500 error');
            if (result.data && result.data.data) {
                console.log(`   Server Response: ${result.data.data.success ? 'SUCCESS' : 'CHECK'}`);
            }
        } else {
            console.log(`❌ Still getting status ${result.status}`);
            if (result.data) {
                console.log('Response:', JSON.stringify(result.data, null, 2));
            }
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testFixedBooking();