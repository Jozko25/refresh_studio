import https from 'https';
import readline from 'readline';

// Latest session token
const SESSION_TOKEN = 'Pa9RgfSIm3B1quRYAv5CDJ3MrRrH8BHh6X9vvrdo2aQU0QAFVLC0/V7ROr0QuHqGtAuePTMK9aaCCrF7USfZ1wVIxtpMu2DXtY1ILOzMXc91oScxJtldKs3a4s9rY4VhfqLkrwh+M0WlpxFSHbRPw1jMxLCHPhstrwr9lh9j2aDIh1S30QOjtZE+JYV4lg/LF46QEgTMTCsp7Udt6QY1GMzYehiirECN4JOR01YUwReYxl1sdR0fTs83YbVa6oXkHFDyKAxuy9CUllh0f7HdTP0ym6PJf8DNHRTwGuo5OeylOO+qwVuyNKZQ0X1AAMJ9YlYIDUU0UbDsUUre/dgsbbP3nqK0h+QFL+5P4G0o8AqXGpNZNuGcEwmEiCotD3RYHcjTSJcyZT1BQR8G9hECYj0zZWUyJudpOULdDSsuTqLs4DbYwZ9mmo0HQ5nGFAI1I0cOBT369h72Ll16MVmKBmDzOYpbXpy1XyCMZG5CaxSv2uMNTxMGIQNV17qZxDhn';

const FACILITY_SLUG = 'refresh-laserove-a-esteticke-studio-zu0yxr5l';

// Service IDs from our analysis
const SERVICES = {
    hydrafacial: {
        id: 63975,
        name: 'HydraFillic with PEP9™',
        price: 145,
        duration: 60
    },
    laser: {
        id: 60230,
        name: 'Laserová epilácia',
        price: 15,
        duration: 10
    }
};

// Workers
const WORKERS = {
    janka: {
        id: "u_18204",
        value: 18204,
        label: "Janka",
        title: "Janka",
        color: "#ab47bc",
        capacity: 1,
        businessHours: [
            {"dow": [2], "start": "09:00", "end": "16:00"},
            {"dow": [6], "start": "08:00", "end": "14:00"},
            {"dow": [0], "start": "09:00", "end": "11:30"},
            {"dow": [4], "start": "09:00", "end": "16:00"},
            {"dow": [3], "start": "09:00", "end": "15:00"},
            {"dow": [5], "start": "09:00", "end": "15:00"}
        ]
    },
    veronika: {
        id: "u_30224",
        value: 30224,
        label: "Veronika",
        title: "Veronika",
        color: "#8d6e63",
        capacity: 1
    }
};

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

// Create a test booking for November
async function createTestBooking() {
    console.log('================================================');
    console.log('🚀 REFRESH STUDIO - TEST BOOKING FOR JUNE 2026');
    console.log('================================================\n');
    
    console.log('⚠️  PRODUCTION SYSTEM - BE CAREFUL!');
    console.log('📅 Test Period: June 15, 2026 (Far future to avoid conflicts)\n');
    
    // Test booking data
    const bookingData = {
        event: {
            type: 0,
            service: {
                value: SERVICES.hydrafacial.id  // Hydrafacial service
            },
            count: 0,
            dateFrom: "15.06.2026",  // June 15, 2026 - Far future date
            dateTo: "15.06.2026",
            timeFrom: "10:00",
            timeTo: "11:00",  // 60 minute duration
            repeat: {
                repeatReservation: false,
                repeatDays: [false, false, false, false, false, false, false],
                selectedInterval: {
                    label: "Weekly",
                    value: 1
                },
                selectedRepeatDateTo: null
            },
            duration: SERVICES.hydrafacial.duration,
            timeBefore: 0,
            timeAfter: 0,
            name: "Test Future Customer 2026",
            phone: "+421900111222",
            selectedCountry: "sk",
            email: "test.future.2026@refresh.sk",
            price: SERVICES.hydrafacial.price,
            resObjects: [WORKERS.janka],  // Assign to Janka
            autoConfirmCustomer: null,
            width: 1728,
            height: 1117,
            allowedMarketing: false
        },
        facility: FACILITY_SLUG
    };
    
    console.log('📋 BOOKING DETAILS:');
    console.log('-------------------');
    console.log(`Service: ${SERVICES.hydrafacial.name}`);
    console.log(`Date: ${bookingData.event.dateFrom}`);
    console.log(`Time: ${bookingData.event.timeFrom} - ${bookingData.event.timeTo}`);
    console.log(`Duration: ${bookingData.event.duration} minutes`);
    console.log(`Price: ${bookingData.event.price}€`);
    console.log(`Worker: ${WORKERS.janka.label}`);
    console.log(`Customer: ${bookingData.event.name}`);
    console.log(`Phone: ${bookingData.event.phone}`);
    console.log(`Email: ${bookingData.event.email}`);
    console.log('-------------------\n');
    
    // Create readline interface for confirmation
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    const confirm = await new Promise((resolve) => {
        rl.question('⚠️  CREATE THIS TEST BOOKING? (yes/no): ', (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === 'yes');
        });
    });
    
    if (!confirm) {
        console.log('❌ Booking cancelled by user');
        return;
    }
    
    console.log('\n📤 Creating booking...\n');
    
    try {
        const response = await makeBookioRequest('/schedule/event/save', bookingData);
        
        if (response && response.id) {
            console.log('✅ BOOKING CREATED SUCCESSFULLY!');
            console.log('-----------------------------------');
            console.log(`Booking ID: ${response.id}`);
            console.log(`Status: ${response.status || 'Confirmed'}`);
            console.log('-----------------------------------\n');
            
            console.log('📝 IMPORTANT: Save this booking ID for cancellation if needed');
            console.log(`Cancellation command: DELETE /schedule/event/${response.id}`);
        } else if (response && response.error) {
            console.log('❌ Booking failed:', response.error);
            console.log('Full response:', JSON.stringify(response, null, 2));
        } else {
            console.log('📦 Response:', JSON.stringify(response, null, 2));
        }
    } catch (error) {
        console.error('❌ Error creating booking:', error.message);
    }
    
    console.log('\n================================================');
    console.log('✅ TEST COMPLETE');
    console.log('================================================');
}

// Helper function to check availability first
async function checkAvailability() {
    console.log('🔍 Checking availability for June 15, 2026...\n');
    
    const calendarPayload = {
        from: "2026-06-14T00:00:00.000Z",
        to: "2026-06-16T23:59:59.000Z",
        facility: FACILITY_SLUG
    };
    
    const calendar = await makeBookioRequest('/schedule/data', calendarPayload);
    
    console.log('📅 Calendar data retrieved');
    console.log('Available for booking on June 15, 2026\n');
}

// Main execution
async function main() {
    console.clear();
    
    // First check availability
    await checkAvailability();
    
    // Then create booking
    await createTestBooking();
}

// Run the script
main().catch(console.error);