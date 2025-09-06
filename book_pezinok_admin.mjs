import https from 'https';
import bookioAuthService from './src/services/bookioAuthService.js';
import logger from './src/services/logger.js';

/**
 * Book at PEZINOK facility using client-admin API
 * Based on the actual booking curl from the browser
 */

async function bookPezinokAdmin() {
    console.log('🏥 Booking at PEZINOK facility via client-admin API...');
    
    try {
        // Get authentication cookie
        const cookie = await bookioAuthService.getCookie();
        if (!cookie) {
            throw new Error('Failed to get authentication cookie');
        }
        console.log('✅ Authentication successful');
        
        // Booking data matching the format from your curl
        const bookingData = {
            event: {
                type: 0,
                service: {
                    value: 59805  // Service ID for Pezinok
                },
                count: 0,
                dateFrom: "24.06.2026",
                dateTo: "24.06.2026",
                timeFrom: "15:00",
                timeTo: "16:00",
                repeat: {
                    repeatReservation: false,
                    repeatDays: [false, false, false, false, false, false, false],
                    selectedInterval: {
                        label: "Týždenne",
                        value: 1
                    },
                    selectedRepeatDateTo: null
                },
                duration: 60,
                timeBefore: 0,
                timeAfter: 10,
                name: "Test Pezinok Booking",
                phone: "+421900777888",
                selectedCountry: "sk",
                email: "test.pezinok@claude.ai",
                price: 100,
                resObjects: [{
                    id: "u_18204",
                    value: 18204,
                    label: "Janka",
                    title: "Janka",
                    color: "#ab47bc",
                    capacity: 1,
                    businessHours: [
                        {dow: [6], start: "08:00", end: "15:00"},
                        {dow: [4], start: "09:00", end: "19:00"},
                        {dow: [2], start: "09:00", end: "19:00"},
                        {dow: [1], start: "09:00", end: "19:00"},
                        {dow: [3], start: "09:30", end: "17:00"},
                        {dow: [5], start: "09:00", end: "19:00"}
                    ],
                    out: null
                }],
                autoConfirmCustomer: null,
                width: 1728,
                height: 1117,
                allowedMarketing: false
            },
            facility: "refresh-laserove-a-esteticke-studio"  // PEZINOK facility slug
        };
        
        // Make booking request to client-admin API
        const requestOptions = {
            hostname: 'services.bookio.com',
            path: '/client-admin/api/schedule/event/save',
            method: 'POST',
            headers: {
                'accept': 'application/json, text/plain, */*',
                'content-type': 'application/json',
                'Cookie': cookie,
                'origin': 'https://services.bookio.com',
                'referer': 'https://services.bookio.com/client-admin/refresh-laserove-a-esteticke-studio/schedule',
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
                'x-requested-with': 'XMLHttpRequest'
            }
        };
        
        console.log('📤 Sending booking request to Pezinok...');
        
        const result = await new Promise((resolve, reject) => {
            const req = https.request(requestOptions, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    console.log('📥 Response status:', res.statusCode);
                    try {
                        const parsed = JSON.parse(data);
                        resolve({ ...parsed, statusCode: res.statusCode });
                    } catch (e) {
                        resolve({ raw: data, statusCode: res.statusCode });
                    }
                });
            });
            
            req.on('error', reject);
            req.write(JSON.stringify(bookingData));
            req.end();
        });
        
        console.log('📅 Booking result:', JSON.stringify(result, null, 2));
        
        if (result.statusCode === 200 || result.success) {
            console.log('✅ BOOKING SUCCESSFUL AT PEZINOK!');
            console.log('📍 Facility: REFRESH Pezinok');
            console.log('📅 Date: 24.06.2026');
            console.log('⏰ Time: 15:00-16:00');
            
            await logger.logBooking('success', {
                facility: 'pezinok',
                date: '24.06.2026',
                time: '15:00-16:00',
                ...result
            });
        } else {
            console.log('❌ Booking failed:', result);
            await logger.logBooking('failed', {
                facility: 'pezinok',
                error: result
            });
        }
        
        return result;
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        await logger.logError('Pezinok booking failed', error);
        return { success: false, error: error.message };
    }
}

// Run the booking
bookPezinokAdmin().then(result => {
    console.log('\n✨ Done!');
    process.exit(0);
}).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});