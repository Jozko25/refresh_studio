import https from 'https';
import logger from './src/services/logger.js';

/**
 * Book at PEZINOK facility using the exact cookie from browser
 */

async function bookPezinokWithBrowserCookie() {
    console.log('🏥 Booking at PEZINOK facility with browser cookie...');
    
    try {
        // Use the exact cookie from your browser session
        const browserCookie = 'bses-0=Pa9RgfSIm3B1quRYAv5CDJ3MrRrH8BHhK1TUSgk0O0gLX7nvcwltY17ROr0QuHqGtAuePTMK9aaCCrF7USfZ1wVIxtpMu2DXtY1ILOzMXc91oScxJtldKs3a4s9rY4VhfqLkrwh+M0WlpxFSHbRPw1jMxLCHPhstrwr9lh9j2aDIh1S30QOjtZE+JYV4lg/LF46QEgTMTCsp7Udt6QY1GMzYehiirECN4JOR01YUwReYxl1sdR0fTs83YbVa6oXkHFDyKAxuy9CUllh0f7HdTP0ym6PJf8DNHRTwGuo5OeylOO+qwVuyNKZQ0X1AAMJ9YlYIDUU0UbDsUUre/dgsbbP3nqK0h+QFL+5P4G0o8AqXGpNZNuGcEwmEiCotD3RYHcjTSJcyZT1BQR8G9hECYj0zZWUyJudpOULdDSsuTqLs4DbYwZ9mmo0HQ5nGFAI1I0cOBT369h72Ll16MVmKBmDzOYpbXpy1XyCMZG5CaxSv2uMNTxMGIQNV17qZxDhn';
        
        console.log('✅ Using browser cookie');
        
        // Booking data for Pezinok
        const bookingData = {
            event: {
                type: 0,
                service: {
                    value: 59805  // Service ID - you may need to update this
                },
                count: 0,
                dateFrom: "25.06.2026",  // June 25, 2026
                dateTo: "25.06.2026",
                timeFrom: "14:00",
                timeTo: "15:00",
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
                name: "Test Pezinok Claude",
                phone: "+421900999888",
                selectedCountry: "sk",
                email: "test.pezinok.claude@test.sk",
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
            facility: "refresh-laserove-a-esteticke-studio"  // PEZINOK facility
        };
        
        // Make booking request using exact browser headers
        const requestOptions = {
            hostname: 'services.bookio.com',
            path: '/client-admin/api/schedule/event/save',
            method: 'POST',
            headers: {
                'accept': 'application/json, text/plain, */*',
                'accept-language': 'en-US,en;q=0.9,sk;q=0.8',
                'content-type': 'application/json',
                'cookie': browserCookie,
                'origin': 'https://services.bookio.com',
                'referer': 'https://services.bookio.com/client-admin/refresh-laserove-a-esteticke-studio/schedule',
                'sec-ch-ua': '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"macOS"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-origin',
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
                'x-requested-with': 'XMLHttpRequest'
            }
        };
        
        console.log('📤 Sending booking request to Pezinok...');
        console.log('📅 Date: June 25, 2026');
        console.log('⏰ Time: 14:00-15:00');
        
        const result = await new Promise((resolve, reject) => {
            const req = https.request(requestOptions, (res) => {
                let data = '';
                
                // Collect response headers
                console.log('📥 Response status:', res.statusCode);
                console.log('📥 Response headers:', res.headers);
                
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        resolve({ 
                            ...parsed, 
                            statusCode: res.statusCode,
                            headers: res.headers 
                        });
                    } catch (e) {
                        resolve({ 
                            raw: data, 
                            statusCode: res.statusCode,
                            headers: res.headers 
                        });
                    }
                });
            });
            
            req.on('error', reject);
            req.write(JSON.stringify(bookingData));
            req.end();
        });
        
        console.log('\n📅 Booking result:', JSON.stringify(result, null, 2));
        
        if (result.statusCode === 200 || result.success) {
            console.log('\n✅ BOOKING SUCCESSFUL AT PEZINOK!');
            console.log('📍 Facility: REFRESH Pezinok');
            console.log('📅 Date: June 25, 2026');
            console.log('⏰ Time: 14:00-15:00');
            console.log('👤 Name: Test Pezinok Claude');
            console.log('📧 Email: test.pezinok.claude@test.sk');
            
            await logger.logBooking('success', {
                facility: 'pezinok',
                date: '25.06.2026',
                time: '14:00-15:00',
                ...result
            });
        } else {
            console.log('\n❌ Booking failed');
            if (result.notAuthorized) {
                console.log('⚠️  Authorization issue - may need fresh cookie or facility switch');
            }
            
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
bookPezinokWithBrowserCookie().then(result => {
    console.log('\n✨ Done!');
    process.exit(0);
}).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});