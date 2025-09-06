/**
 * Try booking for December 2024 (closer date) to test if the issue is date-related
 */

import dualFacilityAuthService from './src/services/DualFacilityAuthService.js';
import https from 'https';
import emailNotifier from './src/services/emailNotifier.js';

async function bookDecember() {
    console.log('🎯 TESTING BOOKING FOR DECEMBER 16, 2024');
    console.log('==========================================');
    console.log('🏥 Facility: REFRESH Pezinok');
    console.log('📅 Date: December 16, 2024');
    console.log('⏰ Time: 14:00 - 15:00');
    console.log('💉 Service: HydraFillic (ID: 63975)');
    console.log('');

    try {
        // Initialize auth service
        await dualFacilityAuthService.initialize();
        
        // Get auth cookie for Pezinok
        const cookieHeader = await dualFacilityAuthService.getCookieHeader('pezinok');
        console.log('✅ Authentication ready');

        // 📧 Send booking start email
        await emailNotifier.sendEmail(
            '🧪 DECEMBER BOOKING TEST',
            `
            <h2>🧪 Testing Booking for December 16, 2024</h2>
            <div style="background: #e8f4ff; padding: 15px; border-radius: 5px;">
                <p><strong>Purpose:</strong> Testing closer date to check if June 2026 is too far</p>
                <p><strong>Date:</strong> Monday, December 16, 2024</p>
                <p><strong>Time:</strong> 14:00 - 15:00</p>
                <p><strong>Service:</strong> HydraFillic (63975)</p>
            </div>
            <p>🔄 Testing booking with closer date...</p>
            `,
            null,
            'december_booking_test'
        );

        // Booking data for December 2024
        const bookingData = {
            event: {
                type: 0,
                service: { value: 63975 },
                count: 0,
                dateFrom: "2024-12-16",
                dateTo: "2024-12-16", 
                timeFrom: "14:00",
                timeTo: "15:00",
                repeat: {
                    repeatReservation: false,
                    repeatDays: [false, false, false, false, false, false, false],
                    selectedInterval: { label: "Weekly", value: 1 },
                    selectedRepeatDateTo: null
                },
                duration: 60,
                timeBefore: 0,
                timeAfter: 0,
                name: "Test December Booking",
                phone: "+421901234567",
                selectedCountry: "sk",
                email: "test.december@example.com",
                price: 145,
                customerNote: "Test booking for December 16, 2024",
                resObjects: [
                    {
                        id: "u_18204",
                        value: 18204,
                        label: "Janka",
                        title: "Janka",
                        color: "#ab47bc",
                        capacity: 1
                    }
                ],
                autoConfirmCustomer: null,
                width: 1728,
                height: 1117,
                allowedMarketing: false
            },
            facility: "refresh-laserove-a-esteticke-studio-zu0yxr5l"
        };

        // Make the booking request
        const postData = JSON.stringify(bookingData);
        
        const options = {
            hostname: 'services.bookio.com',
            port: 443,
            path: '/client-admin/api/schedule/event/save',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                'Cookie': cookieHeader,
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9,sk;q=0.8',
                'X-Requested-With': 'XMLHttpRequest',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
                'Origin': 'https://services.bookio.com',
                'Referer': 'https://services.bookio.com/client-admin/refresh-laserove-a-esteticke-studio-zu0yxr5l/schedule',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-origin'
            }
        };

        console.log('🚀 Sending December booking request...');

        const result = await new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let data = '';
                
                console.log(`📍 Status: ${res.statusCode}`);
                
                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        resolve({ status: res.statusCode, data: json });
                    } catch (e) {
                        resolve({ status: res.statusCode, data: data });
                    }
                });
            });

            req.on('error', (e) => {
                reject(e);
            });

            req.write(postData);
            req.end();
        });

        console.log('');
        console.log('📊 DECEMBER BOOKING RESULT:');
        console.log(`   Status: ${result.status}`);

        if (result.status === 200) {
            console.log('🎉 SUCCESS! December booking worked');
            console.log('   This means the system works but June 2026 might be too far ahead');
            
            // 📧 Success email
            await emailNotifier.sendEmail(
                '✅ DECEMBER BOOKING SUCCESS',
                `
                <h2>✅ December Booking Worked!</h2>
                <div style="background: #e8ffe8; padding: 15px; border-radius: 5px;">
                    <p><strong>Result:</strong> December 16, 2024 booking succeeded</p>
                    <p><strong>Conclusion:</strong> System works but June 2026 may be outside booking window</p>
                    <p><strong>Status:</strong> ${result.status}</p>
                </div>
                <p><strong>Response:</strong> ${JSON.stringify(result.data, null, 2)}</p>
                `,
                null,
                'december_booking_success'
            );

        } else {
            console.log(`❌ December booking also failed with status ${result.status}`);
            console.log('   This suggests a more fundamental issue');
            
            // 📧 Failure email  
            await emailNotifier.sendEmail(
                `❌ DECEMBER BOOKING FAILED - Status ${result.status}`,
                `
                <h2>❌ December Booking Also Failed</h2>
                <div style="background: #ffe8e8; padding: 15px; border-radius: 5px;">
                    <p><strong>Result:</strong> Both June 2026 and December 2024 failed</p>
                    <p><strong>Status:</strong> ${result.status}</p>
                    <p><strong>Issue:</strong> Likely authentication or data format problem</p>
                </div>
                <pre style="background: #f5f5f5; padding: 10px;">${JSON.stringify(result.data, null, 2).substring(0, 500)}</pre>
                `,
                null,
                'december_booking_failed'
            );
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        
        await emailNotifier.sendEmail(
            '❌ DECEMBER BOOKING ERROR',
            `
            <h2>❌ December Booking Error</h2>
            <p><strong>Error:</strong> ${error.message}</p>
            `,
            null,
            'december_booking_error'
        );
    }
}

bookDecember();