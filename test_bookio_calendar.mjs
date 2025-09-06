import https from 'https';

// Latest session token from network requests
const SESSION_TOKEN = 'Pa9RgfSIm3B1quRYAv5CDJ3MrRrH8BHhINRHejy2MAq19XCviiUXbl7ROr0QuHqGtAuePTMK9aaCCrF7USfZ1wVIxtpMu2DXtY1ILOzMXc91oScxJtldKs3a4s9rY4VhfqLkrwh+M0WlpxFSHbRPw1jMxLCHPhstrwr9lh9j2aDIh1S30QOjtZE+JYV4lg/LF46QEgTMTCsp7Udt6QY1GMzYehiirECN4JOR01YUwReYxl1sdR0fTs83YbVa6oXkHFDyKAxuy9CUllh0f7HdTP0ym6PJf8DNHRTwGuo5OeylOO+qwVuyNKZQ0X1AAMJ9YlYIDUU0UbDsUUre/dgsbbP3nqK0h+QFL+5P4G0o8AqXGpNZNuGcEwmEiCotD3RYHcjTSJcyZT1BQR8G9hECYj0zZWUyJudpOULdDSsuTqLs4DbYwZ9mmo0HQ5nGFAI1I0cOBT369h72Ll16MVmKBmDzOYpbXpy1XyCMZG5CaxSv2uMNTxMGIQNV17qZxDhn';

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
            
            console.log(`📍 Status: ${res.statusCode}`);
            
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

async function testCalendarEndpoints() {
    console.log('==========================================');
    console.log('🗓️  TESTING BOOKIO CALENDAR API - READ ONLY');
    console.log('==========================================\n');

    try {
        // Test 1: Get schedule options and settings
        console.log('1️⃣  FETCHING SCHEDULE OPTIONS');
        console.log('--------------------------------');
        
        const optionsPayload = {
            "params": {"_gl": "1*19yxvtt*_up*MQ..*_ga*MTQ2NDY4MDI0LjE3NTcxNDcyMTQ.*_ga_HDW4XF3X6V*czE3NTcxNDcyMTEkbzEkZzEkdDE3NTcxNDcyMTQkajU3JGwwJGgxNjcxOTIzNzQz*_ga_VVZ1TSR02C*czE3NTcxNDcyMTEkbzEkZzEkdDE3NTcxNDcyMTQkajU3JGwwJGgxNzU3NjY4ODcx"},
            "facility": FACILITY_SLUG
        };
        
        const options = await makeBookioRequest('/schedule/options', optionsPayload);
        
        if (options) {
            console.log('✅ Schedule options received');
            if (options.scheduleSettings) {
                console.log(`   ⏰ Time interval: ${options.scheduleSettings.minutesInterval} minutes`);
                console.log(`   🕐 Opening hours:`, options.scheduleSettings.openingHours);
            }
            console.log('\n');
        }

        // Test 2: Get resource objects (workers)
        console.log('2️⃣  FETCHING RESOURCE OBJECTS (WORKERS)');
        console.log('------------------------------------------');
        
        const resPayload = {
            "facility": FACILITY_SLUG
        };
        
        const resources = await makeBookioRequest('/schedule/res-objects', resPayload);
        
        if (resources && resources.data) {
            console.log(`✅ Found ${resources.data.length} resource objects\n`);
            console.log('👥 Workers:');
            resources.data.forEach(res => {
                if (res.label) {
                    console.log(`   • ${res.label} (ID: ${res.id})`);
                }
            });
            console.log('\n');
        }

        // Test 3: Get calendar data for November 23-29
        console.log('3️⃣  FETCHING CALENDAR DATA FOR NOVEMBER 23-29');
        console.log('------------------------------------------------');
        
        const calendarPayload = {
            "from": "2025-11-23T00:00:00.000Z",
            "to": "2025-11-29T23:59:59.000Z",
            "facility": FACILITY_SLUG
        };
        
        console.log('📅 Date range: Nov 23-29, 2025');
        
        const calendar = await makeBookioRequest('/schedule/data', calendarPayload);
        
        if (calendar) {
            console.log('✅ Calendar data received\n');
            
            // Check if it's an array (events) or object with events
            if (Array.isArray(calendar)) {
                console.log(`📌 Found ${calendar.length} calendar events`);
                
                // Sample first few events
                if (calendar.length > 0) {
                    console.log('\n📋 Sample events:');
                    calendar.slice(0, 5).forEach(event => {
                        console.log(`   • ${event.title || event.name || 'Event'}`);
                        if (event.start) console.log(`     Start: ${event.start}`);
                        if (event.resourceId) console.log(`     Worker: ${event.resourceId}`);
                    });
                }
            } else if (calendar.events) {
                console.log(`📌 Found ${calendar.events.length} calendar events`);
            } else {
                console.log('📦 Response structure:', Object.keys(calendar).slice(0, 10));
            }
        }

        console.log('\n');
        
        // Test 4: Check availability for specific service
        console.log('4️⃣  CHECKING HYDRAFACIAL AVAILABILITY');
        console.log('----------------------------------------');
        
        // Use hydrafacial service ID from previous test
        const hydrafacialId = 63975;
        
        const availabilityPayload = {
            "from": "2025-11-23T00:00:00.000Z",
            "to": "2025-11-29T23:59:59.000Z",
            "facility": FACILITY_SLUG,
            "serviceId": hydrafacialId
        };
        
        const availability = await makeBookioRequest('/schedule/data', availabilityPayload);
        
        if (availability) {
            console.log('✅ Availability data received');
            if (Array.isArray(availability)) {
                const available = availability.filter(slot => !slot.reserved);
                console.log(`   🟢 Available slots: ${available.length}`);
                console.log(`   🔴 Reserved slots: ${availability.length - available.length}`);
            }
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }

    console.log('\n==========================================');
    console.log('✅ CALENDAR TEST COMPLETE - NO BOOKINGS MADE');
    console.log('==========================================');
}

// Run the test
testCalendarEndpoints();