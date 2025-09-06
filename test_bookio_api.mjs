import https from 'https';

// Session token from the provided network request
const SESSION_TOKEN = 'Pa9RgfSIm3B1quRYAv5CDJ3MrRrH8BHhvL57AWFqjBJGWJlFz5tP+V7ROr0QuHqGtAuePTMK9aaCCrF7USfZ1wVIxtpMu2DXtY1ILOzMXc91oScxJtldKs3a4s9rY4VhfqLkrwh+M0WlpxFSHbRPw1jMxLCHPhstrwr9lh9j2aDIh1S30QOjtZE+JYV4lg/LF46QEgTMTCsp7Udt6QY1GMzYehiirECN4JOR01YUwReYxl1sdR0fTs83YbVa6oXkHFDyKAxuy9CUllh0f7HdTP0ym6PJf8DNHRTwGuo5OeylOO+qwVuyNKZQ0X1AAMJ9YlYIDUU0UbDsUUre/dgsbbP3nqK0h+QFL+5P4G0o8AqXGpNZNuGcEwmEiCotD3RYHcjTSJcyZT1BQR8G9hECYj0zZWUyJudpOULdDSsuTqLs4DbYwZ9mmo0HQ5nGFAI1I0cOBT369h72Ll16MVmKBmDzOYpbXpy1XyCMZG5CaxSv2uMNTxMGIQNV17qZxDhn';

// Function to make API request
function makeBookioRequest(path, data) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(data);
        
        const options = {
            hostname: 'services.bookio.com',
            port: 443,
            path: `/client-admin/api${path}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                'Cookie': `bses-0=${SESSION_TOKEN}`,
                'Accept': 'application/json, text/plain, */*',
                'X-Requested-With': 'XMLHttpRequest',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Origin': 'https://services.bookio.com',
                'Referer': 'https://services.bookio.com/client-admin/refresh-laserove-a-esteticke-studio-zu0yxr5l/schedule'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            
            console.log(`Status Code: ${res.statusCode}`);
            console.log('Response Headers:', res.headers);
            
            // Check for token refresh
            if (res.headers['set-cookie']) {
                const cookies = res.headers['set-cookie'];
                cookies.forEach(cookie => {
                    if (cookie.startsWith('bses-0=')) {
                        console.log('🔄 TOKEN REFRESH DETECTED');
                        console.log('New token in Set-Cookie header');
                    }
                });
            }

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json);
                } catch (e) {
                    resolve(data);
                }
            });
        });

        req.on('error', (e) => {
            reject(e);
        });

        req.write(postData);
        req.end();
    });
}

async function testBookioAPI() {
    console.log('====================================');
    console.log('TESTING BOOKIO API - READ ONLY');
    console.log('====================================\n');

    try {
        // Test 1: Fetch services
        console.log('1. FETCHING SERVICES LIST...');
        console.log('----------------------------');
        
        const servicesPayload = {
            "facilityId": null,
            "categoryId": null,
            "page": 0
        };
        
        const services = await makeBookioRequest('/schedule/services', servicesPayload);
        
        if (services && services.content) {
            console.log(`✅ Successfully fetched ${services.content.length} services`);
            console.log('\nFirst 5 services:');
            services.content.slice(0, 5).forEach(service => {
                console.log(`  - ${service.name || service.title} (ID: ${service.id})`);
            });
        } else if (services && services.error) {
            console.log('❌ Error fetching services:', services.error);
        } else {
            console.log('Response:', JSON.stringify(services, null, 2).substring(0, 500));
        }

        console.log('\n');
        
        // Test 2: Check slots for November 23
        console.log('2. CHECKING SLOTS FOR NOVEMBER 23, 2025...');
        console.log('-------------------------------------------');
        
        const slotsPayload = {
            "date": "2025-11-23",
            "facilityId": null,
            "serviceId": null
        };
        
        const slots = await makeBookioRequest('/schedule/slots', slotsPayload);
        
        if (slots && slots.slots) {
            console.log(`✅ Successfully fetched slots for November 23`);
            console.log(`Available slots: ${slots.slots.length}`);
        } else if (slots && slots.error) {
            console.log('❌ Error fetching slots:', slots.error);
        } else {
            console.log('Response:', JSON.stringify(slots, null, 2).substring(0, 500));
        }

        console.log('\n');
        
        // Test 3: Get facilities/locations
        console.log('3. FETCHING FACILITIES...');
        console.log('-------------------------');
        
        const facilitiesPayload = {};
        
        const facilities = await makeBookioRequest('/facilities', facilitiesPayload);
        
        if (facilities) {
            console.log('Response:', JSON.stringify(facilities, null, 2).substring(0, 500));
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
    }

    console.log('\n====================================');
    console.log('TEST COMPLETE - NO BOOKINGS CREATED');
    console.log('====================================');
}

// Run the test
testBookioAPI();