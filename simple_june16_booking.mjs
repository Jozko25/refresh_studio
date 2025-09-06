/**
 * Simple booking for June 16, 2026 using the working INTEGRATED_BOOKING_SYSTEM format
 * This uses the proven format that just worked successfully
 */

import bookioAuthService from './src/services/BookioAuthService.js';
import https from 'https';

const FACILITY_SLUG = 'refresh-laserove-a-esteticke-studio-zu0yxr5l';

async function createJune16Booking() {
    console.log('🎯 CREATING BOOKING FOR JUNE 16, 2026');
    console.log('=====================================');
    console.log('📅 Date: Tuesday, June 16, 2026');
    console.log('⏰ Time: 14:00 - 15:00');
    console.log('💉 Service: HydraFillic');
    console.log('');

    try {
        // Initialize authentication
        await bookioAuthService.initialize();
        console.log('✅ Authentication ready');

        // Get authentication cookie
        const cookieHeader = await bookioAuthService.getCookieHeader();
        console.log('✅ Got session cookie');

        // Use the exact working booking format from INTEGRATED_BOOKING_SYSTEM
        const bookingData = {
            event: {
                type: 0,
                service: { value: 63975 }, // HydraFillic service
                count: 0,
                dateFrom: "16.06.2026",  // Using the working date format
                dateTo: "16.06.2026",
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
                name: "June 16 Test Booking",
                phone: "+421901234567",
                selectedCountry: "sk",
                email: "test.june16@refresh.sk",
                price: 145,
                customerNote: "Test booking for June 16, 2026",
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
            facility: FACILITY_SLUG
        };

        console.log('📤 Sending booking request...');

        // Make the request using exact working headers
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
                'Referer': `https://services.bookio.com/client-admin/${FACILITY_SLUG}/schedule`,
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-origin'
            }
        };

        const result = await new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let data = '';
                
                console.log(`📍 API Response Status: ${res.statusCode}`);
                
                // Check for session refresh
                if (res.headers['set-cookie']) {
                    console.log('🔄 Server sent new session cookies (auto-refresh detected)');
                }
                
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
        if (result.status === 200) {
            console.log('✅ BOOKING CREATED SUCCESSFULLY!');
            console.log('-----------------------------------');
            console.log('📅 Date: Tuesday, June 16, 2026');
            console.log('⏰ Time: 14:00 - 15:00');
            console.log('👤 Customer: June 16 Test Booking');
            console.log('📧 Email: test.june16@refresh.sk');
            console.log('💰 Price: 145€');
            console.log('-----------------------------------');
            
            if (result.data && result.data.data) {
                console.log('Status:', result.data.data.success ? 'Success' : 'Check response');
                console.log('Response:', JSON.stringify(result.data, null, 2));
            }
        } else {
            console.log(`❌ BOOKING FAILED - Status: ${result.status}`);
            if (typeof result.data === 'string' && result.data.includes('Internal error')) {
                console.log('   Server returned 500 Internal Error');
            } else {
                console.log('Response:', JSON.stringify(result.data, null, 2));
            }
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

createJune16Booking();