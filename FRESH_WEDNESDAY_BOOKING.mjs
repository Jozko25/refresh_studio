import { RefreshBookingService } from './INTEGRATED_BOOKING_SYSTEM.mjs';

async function freshWednesdayBooking() {
    console.log('🗓️ FRESH WEDNESDAY JUNE 17, 2026 BOOKING');
    console.log('========================================\n');
    
    const bookingService = new RefreshBookingService();
    
    // Force fresh authentication
    console.log('🔄 Forcing fresh authentication...');
    await bookingService.refreshAuth();
    
    const customerData = {
        name: 'Fresh Wednesday Customer',
        phone: '+421905654321',
        email: 'fresh.wed@refresh.sk'
    };
    
    const bookingTime = {
        date: '17.06.2026', // Wednesday June 17, 2026
        from: '15:30',
        to: '16:30'
    };
    
    console.log('\n📋 Fresh Booking Details:');
    console.log(`   Service: HydraFacial`);
    console.log(`   Date: ${bookingTime.date} (Wednesday)`);
    console.log(`   Time: ${bookingTime.from} - ${bookingTime.to}`);
    console.log(`   Customer: ${customerData.name}`);
    console.log(`   Phone: ${customerData.phone}`);
    console.log(`   Email: ${customerData.email}\n`);
    
    try {
        const result = await bookingService.createHydrafacialBooking(customerData, bookingTime);
        
        if (result) {
            console.log('🎉 FRESH WEDNESDAY BOOKING SUCCESSFUL!');
            console.log('====================================');
        } else {
            console.log('❌ Fresh Wednesday booking failed');
        }
        
    } catch (error) {
        console.error('❌ Error during fresh Wednesday booking:', error.message);
    }
}

freshWednesdayBooking().catch(console.error);