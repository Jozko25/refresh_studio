import https from 'https';

// Session token from the provided network request (updated)
const SESSION_TOKEN = 'Pa9RgfSIm3B1quRYAv5CDJ3MrRrH8BHhweoz19TA45r3owgfBM14KV7ROr0QuHqGtAuePTMK9aaCCrF7USfZ1wVIxtpMu2DXtY1ILOzMXc91oScxJtldKs3a4s9rY4VhfqLkrwh+M0WlpxFSHbRPw1jMxLCHPhstrwr9lh9j2aDIh1S30QOjtZE+JYV4lg/LF46QEgTMTCsp7Udt6QY1GMzYehiirECN4JOR01YUwReYxl1sdR0fTs83YbVa6oXkHFDyKAxuy9CUllh0f7HdTP0ym6PJf8DNHRTwGuo5OeylOO+qwVuyNKZQ0X1AAMJ9YlYIDUU0UbDsUUre/dgsbbP3nqK0h+QFL+5P4G0o8AqXGpNZNuGcEwmEiCotD3RYHcjTSJcyZT1BQR8G9hECYj0zZWUyJudpOULdDSsuTqLs4DbYwZ9mmo0HQ5nGFAI1I0cOBT369h72Ll16MVmKBmDzOYpbXpy1XyCMZG5CaxSv2uMNTxMGIQNV17qZxDhn';

const FACILITY_SLUG = 'refresh-laserove-a-esteticke-studio-zu0yxr5l';

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

        const req = https.request(options, (res) => {
            let data = '';
            
            console.log(`\n📍 Status Code: ${res.statusCode}`);
            
            // Check for token refresh
            if (res.headers['set-cookie']) {
                const cookies = res.headers['set-cookie'];
                cookies.forEach(cookie => {
                    if (cookie.startsWith('bses-0=') && !cookie.includes('Max-Age=0')) {
                        console.log('🔄 TOKEN REFRESH DETECTED - Session renewed');
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
                    // If not JSON, return as-is
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
    console.log('🔬 TESTING BOOKIO API - READ ONLY');
    console.log('====================================');
    console.log(`📌 Facility: ${FACILITY_SLUG}`);
    console.log(`🔑 Session: ${SESSION_TOKEN.substring(0, 50)}...`);
    console.log('====================================\n');

    try {
        // Test 1: Fetch services with correct payload
        console.log('1️⃣  FETCHING SERVICES LIST');
        console.log('----------------------------');
        
        const servicesPayload = {
            "facility": FACILITY_SLUG
        };
        
        console.log('📤 Request payload:', JSON.stringify(servicesPayload));
        
        const services = await makeBookioRequest('/schedule/services', servicesPayload);
        
        if (Array.isArray(services)) {
            console.log(`✅ Successfully fetched ${services.length} services\n`);
            console.log('📋 First 10 services:');
            services.slice(0, 10).forEach((service, idx) => {
                console.log(`   ${idx + 1}. ${service.name || service.title} (ID: ${service.id})`);
                if (service.price) {
                    console.log(`      💰 Price: ${service.price} €`);
                }
                if (service.duration) {
                    console.log(`      ⏱️  Duration: ${service.duration} min`);
                }
            });
        } else if (services && typeof services === 'object') {
            console.log('📦 Response structure:', Object.keys(services));
            if (services.content) {
                console.log(`✅ Found ${services.content.length} services in 'content' field`);
            }
            console.log('\n📄 Sample response:', JSON.stringify(services, null, 2).substring(0, 500));
        } else {
            console.log('❌ Unexpected response format');
            console.log('Response:', JSON.stringify(services, null, 2).substring(0, 500));
        }

        console.log('\n');
        
        // Test 2: Check calendar/schedule data
        console.log('2️⃣  FETCHING SCHEDULE DATA');
        console.log('----------------------------');
        
        const schedulePayload = {
            "facility": FACILITY_SLUG,
            "date": "2025-11-23"
        };
        
        console.log('📤 Request payload:', JSON.stringify(schedulePayload));
        
        const schedule = await makeBookioRequest('/schedule/calendar', schedulePayload);
        
        if (schedule) {
            console.log('📅 Schedule response received');
            if (typeof schedule === 'object') {
                console.log('📦 Response structure:', Object.keys(schedule));
            }
            console.log('\n📄 Sample response:', JSON.stringify(schedule, null, 2).substring(0, 500));
        }

        console.log('\n');
        
        // Test 3: Get workers/staff
        console.log('3️⃣  FETCHING WORKERS/STAFF');
        console.log('----------------------------');
        
        const workersPayload = {
            "facility": FACILITY_SLUG
        };
        
        console.log('📤 Request payload:', JSON.stringify(workersPayload));
        
        const workers = await makeBookioRequest('/schedule/workers', workersPayload);
        
        if (Array.isArray(workers)) {
            console.log(`✅ Successfully fetched ${workers.length} workers\n`);
            console.log('👥 Staff members:');
            workers.forEach((worker, idx) => {
                console.log(`   ${idx + 1}. ${worker.name || worker.firstName} ${worker.lastName || ''}`);
            });
        } else if (workers && typeof workers === 'object') {
            console.log('📦 Response structure:', Object.keys(workers));
            console.log('\n📄 Sample response:', JSON.stringify(workers, null, 2).substring(0, 500));
        }

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error(error.stack);
    }

    console.log('\n====================================');
    console.log('✅ TEST COMPLETE - NO BOOKINGS MADE');
    console.log('====================================');
}

// Run the test
testBookioAPI();