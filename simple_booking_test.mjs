/**
 * Simple booking test for June 16, 2026
 * Testing Pezinok facility with realistic customer data
 */

import dualFacilityService from './DUAL_FACILITY_SYSTEM.mjs';

async function createJune16Booking() {
    console.log('🏥 Creating booking for Tuesday June 16, 2026 - Pezinok');
    console.log('='.repeat(50));
    
    try {
        // Initialize system
        await dualFacilityService.initialize();
        
        // Customer data for June 16 booking
        const customer = {
            name: 'Testovací Zákazník',
            phone: '+421901234567',
            email: 'test.customer@example.com',
            note: 'Hydrafacial booking test for June 16'
        };
        
        // Booking time for Tuesday June 16, 2026
        const bookingTime = {
            date: '2026-06-16',
            from: '10:00',
            to: '11:00'
        };
        
        console.log(`📅 Date: ${bookingTime.date}`);
        console.log(`⏰ Time: ${bookingTime.from} - ${bookingTime.to}`);
        console.log(`👤 Customer: ${customer.name}`);
        console.log(`📧 Email: ${customer.email}`);
        console.log('🚀 Creating booking...\n');
        
        // Create Pezinok booking (HydraFillic service)
        const result = await dualFacilityService.createPezinokBooking(
            customer,
            bookingTime,
            63975 // HydraFillic service ID
        );
        
        console.log(`✅ Booking result: Status ${result.status}`);
        
        if (result.status === 200) {
            console.log('🎉 SUCCESS! Booking created for June 16, 2026');
            if (result.data && result.data.data && result.data.data.success) {
                console.log('✅ Booking confirmed in system');
            }
        } else {
            console.log(`⚠️  Booking returned status ${result.status}`);
            if (result.data) {
                console.log('Response:', JSON.stringify(result.data, null, 2));
            }
        }
        
    } catch (error) {
        console.error('❌ Error creating booking:', error.message);
    }
}

createJune16Booking();