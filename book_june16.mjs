/**
 * Direct booking for June 16, 2026 using proven format
 * Based on the working booking structure from previous tests
 */

import dualFacilityAuthService from './src/services/DualFacilityAuthService.js';
import https from 'https';
import emailNotifier from './src/services/emailNotifier.js';

async function bookJune16() {
    console.log('🎯 BOOKING FOR TUESDAY JUNE 16, 2026');
    console.log('=====================================');
    console.log('🏥 Facility: REFRESH Pezinok');
    console.log('📅 Date: June 16, 2026');
    console.log('⏰ Time: 10:00 - 11:00');
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
            '🚀 JUNE 16 BOOKING STARTING',
            `
            <h2>🚀 Creating Booking for June 16, 2026</h2>
            <div style="background: #e8f4ff; padding: 15px; border-radius: 5px;">
                <p><strong>Facility:</strong> REFRESH Pezinok</p>
                <p><strong>Date:</strong> Tuesday, June 16, 2026</p>
                <p><strong>Time:</strong> 10:00 - 11:00</p>
                <p><strong>Service:</strong> HydraFillic (63975)</p>
                <p><strong>Customer:</strong> Booking Test</p>
            </div>
            <p>🔄 Processing booking request...</p>
            `,
            null,
            'june16_booking_start'
        );

        // Booking data using the exact format that worked before
        const bookingData = {
            event: {
                type: 0,
                service: { value: 63975 },
                count: 0,
                dateFrom: "2026-06-16",
                dateTo: "2026-06-16",
                timeFrom: "10:00",
                timeTo: "11:00",
                repeat: {
                    repeatReservation: false,
                    repeatDays: [false, false, false, false, false, false, false],
                    selectedInterval: { label: "Weekly", value: 1 },
                    selectedRepeatDateTo: null
                },
                duration: 60,
                timeBefore: 0,
                timeAfter: 0,
                name: "Booking Test June 16",
                phone: "+421901234567",
                selectedCountry: "sk",
                email: "test.june16@example.com",
                price: 145,
                customerNote: "Test booking for June 16, 2026 - Hydrafacial",
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

        console.log('🚀 Sending booking request...');

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
        console.log('📊 BOOKING RESULT:');
        console.log(`   Status: ${result.status}`);

        if (result.status === 200) {
            console.log('🎉 SUCCESS! Booking created for June 16, 2026');
            
            if (result.data && result.data.data) {
                console.log(`   ✅ Server Response: ${result.data.data.success ? 'SUCCESS' : 'CHECK RESPONSE'}`);
                if (result.data.data.reservationId) {
                    console.log(`   📋 Reservation ID: ${result.data.data.reservationId}`);
                }
            }

            // 📧 Success email
            await emailNotifier.sendEmail(
                '🎉 JUNE 16 BOOKING SUCCESS',
                `
                <h2>🎉 Booking Created Successfully!</h2>
                <div style="background: #e8ffe8; padding: 15px; border-radius: 5px;">
                    <h3>✅ BOOKING CONFIRMED</h3>
                    <p><strong>Date:</strong> Tuesday, June 16, 2026</p>
                    <p><strong>Time:</strong> 10:00 - 11:00</p>
                    <p><strong>Service:</strong> HydraFillic</p>
                    <p><strong>Price:</strong> 145€</p>
                    <p><strong>Customer:</strong> Booking Test June 16</p>
                    <p><strong>Email:</strong> test.june16@example.com</p>
                    <p><strong>Phone:</strong> +421901234567</p>
                </div>
                <p><strong>Server Status:</strong> ${result.status}</p>
                <p><strong>Response:</strong> ${JSON.stringify(result.data, null, 2)}</p>
                `,
                null,
                'june16_booking_success'
            );

        } else {
            console.log(`⚠️  Booking returned status ${result.status}`);
            console.log('   Response:', JSON.stringify(result.data, null, 2).substring(0, 500));

            // 📧 Failure email
            await emailNotifier.sendEmail(
                `❌ JUNE 16 BOOKING FAILED - Status ${result.status}`,
                `
                <h2>❌ Booking Failed</h2>
                <div style="background: #ffe8e8; padding: 15px; border-radius: 5px;">
                    <p><strong>Status:</strong> ${result.status}</p>
                    <p><strong>Date Attempted:</strong> June 16, 2026</p>
                    <p><strong>Error:</strong> Server returned ${result.status}</p>
                </div>
                <p><strong>Response:</strong></p>
                <pre style="background: #f5f5f5; padding: 10px;">${JSON.stringify(result.data, null, 2).substring(0, 1000)}</pre>
                `,
                null,
                'june16_booking_failed'
            );
        }

        console.log('');
        console.log('📧 Email notification sent');
        console.log('=====================================');

    } catch (error) {
        console.error('❌ Error:', error.message);
        
        // 📧 Error email
        await emailNotifier.sendEmail(
            '❌ JUNE 16 BOOKING ERROR',
            `
            <h2>❌ Booking Error</h2>
            <div style="background: #ffe8e8; padding: 15px; border-radius: 5px;">
                <p><strong>Error:</strong> ${error.message}</p>
                <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
            </div>
            `,
            null,
            'june16_booking_error'
        );
    }
}

bookJune16();