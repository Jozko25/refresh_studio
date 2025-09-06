import { RefreshBookingService } from './INTEGRATED_BOOKING_SYSTEM.mjs';

async function testWednesdayBooking() {
    console.log('🗓️ WEDNESDAY JUNE 17, 2026 BOOKING TEST');
    console.log('=======================================\n');
    
    const bookingService = new RefreshBookingService();
    
    const customerData = {
        name: 'Test Customer Wednesday',
        phone: '+421905123456',
        email: 'test.wed@refresh.sk'
    };
    
    const bookingTime = {
        date: '17.06.2026', // Wednesday June 17, 2026
        from: '14:00',
        to: '14:10'
    };
    
    console.log('📋 Booking Details:');
    console.log(`   Service: Laser Hair Removal`);
    console.log(`   Date: ${bookingTime.date} (Wednesday)`);
    console.log(`   Time: ${bookingTime.from} - ${bookingTime.to}`);
    console.log(`   Customer: ${customerData.name}`);
    console.log(`   Phone: ${customerData.phone}`);
    console.log(`   Email: ${customerData.email}\n`);
    
    try {
        const result = await bookingService.createLaserBooking(customerData, bookingTime);
        
        if (result) {
            console.log('🎉 WEDNESDAY BOOKING SUCCESSFUL!');
            console.log('================================');
        } else {
            console.log('❌ Wednesday booking failed');
        }
        
    } catch (error) {
        console.error('❌ Error during Wednesday booking:', error.message);
    }
}

testWednesdayBooking().catch(console.error);