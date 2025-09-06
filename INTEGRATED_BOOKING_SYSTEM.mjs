import https from 'https';
import bookioAuthService from './src/services/bookioAuthService.js';
import config from './config/bookio-config.js';

/**
 * Integrated REFRESH Booking System
 * Uses existing authentication service for seamless booking
 */

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

/**
 * Enhanced API request with automatic authentication
 */
async function makeAuthenticatedRequest(path, data) {
    return new Promise(async (resolve, reject) => {
        try {
            // Get fresh authentication cookie
            console.log('🔐 Getting authentication cookie...');
            const cookieHeader = await bookioAuthService.getCookieHeader();
            console.log('✅ Got valid session cookie');
            
            const postData = JSON.stringify(data);
            
            const options = {
                hostname: 'services.bookio.com',
                port: 443,
                path: `/client-admin/api${path}`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData),
                    'Cookie': cookieHeader,  // Use authenticated cookie
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
                let responseData = '';
                
                console.log(`📍 API Response Status: ${res.statusCode}`);
                
                // Monitor for token refresh in response
                if (res.headers['set-cookie']) {
                    console.log('🔄 Server sent new session cookies (auto-refresh detected)');
                }
                
                res.on('data', (chunk) => {
                    responseData += chunk;
                });

                res.on('end', () => {
                    try {
                        const json = JSON.parse(responseData);
                        resolve({ status: res.statusCode, data: json });
                    } catch (e) {
                        resolve({ status: res.statusCode, data: responseData });
                    }
                });
            });

            req.on('error', (e) => {
                reject(e);
            });

            req.write(postData);
            req.end();
            
        } catch (error) {
            console.error('❌ Authentication failed:', error.message);
            reject(error);
        }
    });
}

/**
 * Create a booking with full authentication
 */
async function createBooking(bookingDetails) {
    console.log('🏥 REFRESH STUDIO - AUTHENTICATED BOOKING SYSTEM');
    console.log('================================================\n');
    
    // Initialize authentication service
    console.log('🔧 Initializing authentication service...');
    try {
        await bookioAuthService.initialize();
        console.log('✅ Authentication service ready\n');
    } catch (error) {
        console.error('❌ Authentication initialization failed:', error.message);
        return;
    }
    
    // Show auth status
    const authStatus = bookioAuthService.getStatus();
    console.log('🔐 Authentication Status:');
    console.log(`   Environment: ${authStatus.environment}`);
    console.log(`   Cookie Valid: ${authStatus.cookieValid}`);
    console.log(`   Last Refresh: ${authStatus.lastRefresh}`);
    console.log('');
    
    // Build booking payload
    const bookingPayload = {
        event: {
            type: 0,
            service: {
                value: bookingDetails.serviceId
            },
            count: 0,
            dateFrom: bookingDetails.date,
            dateTo: bookingDetails.date,
            timeFrom: bookingDetails.timeFrom,
            timeTo: bookingDetails.timeTo,
            repeat: {
                repeatReservation: false,
                repeatDays: [false, false, false, false, false, false, false],
                selectedInterval: {
                    label: "Weekly",
                    value: 1
                },
                selectedRepeatDateTo: null
            },
            duration: bookingDetails.duration,
            timeBefore: 0,
            timeAfter: 0,
            name: bookingDetails.customerName,
            phone: bookingDetails.customerPhone,
            selectedCountry: "sk",
            email: bookingDetails.customerEmail,
            price: bookingDetails.price,
            resObjects: [bookingDetails.worker],
            autoConfirmCustomer: null,
            width: 1728,
            height: 1117,
            allowedMarketing: false
        },
        facility: FACILITY_SLUG
    };
    
    console.log('📋 BOOKING DETAILS:');
    console.log('-------------------');
    console.log(`Service: ${bookingDetails.serviceName}`);
    console.log(`Date: ${bookingDetails.date}`);
    console.log(`Time: ${bookingDetails.timeFrom} - ${bookingDetails.timeTo}`);
    console.log(`Duration: ${bookingDetails.duration} minutes`);
    console.log(`Price: ${bookingDetails.price}€`);
    console.log(`Worker: ${bookingDetails.worker.label}`);
    console.log(`Customer: ${bookingDetails.customerName}`);
    console.log(`Phone: ${bookingDetails.customerPhone}`);
    console.log(`Email: ${bookingDetails.customerEmail}`);
    console.log('-------------------\n');
    
    try {
        console.log('📤 Creating booking with authenticated request...\n');
        
        const response = await makeAuthenticatedRequest('/schedule/event/save', bookingPayload);
        
        if (response.status === 200) {
            if (response.data && response.data.data && response.data.data.success) {
                console.log('✅ BOOKING CREATED SUCCESSFULLY!');
                console.log('-----------------------------------');
                console.log(`Status: ${response.data.data.success ? 'Success' : 'Failed'}`);
                console.log(`Response:`, JSON.stringify(response.data, null, 2));
                console.log('-----------------------------------\n');
                return response.data;
            } else if (response.data && response.data.error) {
                console.log('❌ Booking failed:', response.data.error);
                return null;
            } else {
                console.log('📦 Unexpected response:', JSON.stringify(response.data, null, 2));
                return response.data;
            }
        } else {
            console.log(`❌ HTTP Error ${response.status}`);
            console.log('Response:', response.data);
            return null;
        }
        
    } catch (error) {
        console.error('❌ Error creating booking:', error.message);
        
        // Try to refresh auth and retry once
        if (error.message.includes('401') || error.message.includes('authentication')) {
            console.log('🔄 Authentication might be expired, refreshing...');
            try {
                await bookioAuthService.forceRefresh();
                console.log('🔄 Retrying booking with fresh authentication...');
                
                const retryResponse = await makeAuthenticatedRequest('/schedule/event/save', bookingPayload);
                return retryResponse.data;
            } catch (retryError) {
                console.error('❌ Retry also failed:', retryError.message);
                return null;
            }
        }
        
        return null;
    }
}

/**
 * Test booking function
 */
async function runTestBooking() {
    const testBooking = {
        serviceId: SERVICES.hydrafacial.id,
        serviceName: SERVICES.hydrafacial.name,
        date: "15.06.2026", // Far future date
        timeFrom: "10:00",
        timeTo: "11:00",
        duration: SERVICES.hydrafacial.duration,
        price: SERVICES.hydrafacial.price,
        worker: WORKERS.janka,
        customerName: "Test Authenticated Customer",
        customerPhone: "+421900888999",
        customerEmail: "test.auth@refresh.sk"
    };
    
    const result = await createBooking(testBooking);
    
    if (result) {
        console.log('🎉 Test booking completed successfully!');
    } else {
        console.log('⚠️ Test booking failed');
    }
    
    // Cleanup: close auth service
    await bookioAuthService.closeBrowser();
    
    return result;
}

/**
 * Booking service for external use
 */
export class RefreshBookingService {
    constructor() {
        this.initialized = false;
    }
    
    async initialize() {
        if (!this.initialized) {
            await bookioAuthService.initialize();
            this.initialized = true;
        }
    }
    
    async createHydrafacialBooking(customerData, bookingTime) {
        await this.initialize();
        
        return await createBooking({
            serviceId: SERVICES.hydrafacial.id,
            serviceName: SERVICES.hydrafacial.name,
            date: bookingTime.date,
            timeFrom: bookingTime.from,
            timeTo: bookingTime.to,
            duration: SERVICES.hydrafacial.duration,
            price: SERVICES.hydrafacial.price,
            worker: WORKERS.janka, // Default to Janka
            customerName: customerData.name,
            customerPhone: customerData.phone,
            customerEmail: customerData.email
        });
    }
    
    async createLaserBooking(customerData, bookingTime) {
        await this.initialize();
        
        return await createBooking({
            serviceId: SERVICES.laser.id,
            serviceName: SERVICES.laser.name,
            date: bookingTime.date,
            timeFrom: bookingTime.from,
            timeTo: bookingTime.to,
            duration: SERVICES.laser.duration,
            price: SERVICES.laser.price,
            worker: WORKERS.janka, // Default to Janka
            customerName: customerData.name,
            customerPhone: customerData.phone,
            customerEmail: customerData.email
        });
    }
    
    async getAuthStatus() {
        return bookioAuthService.getStatus();
    }
    
    async refreshAuth() {
        return await bookioAuthService.forceRefresh();
    }
}

// Run test if called directly
if (process.argv[1] && process.argv[1].endsWith('INTEGRATED_BOOKING_SYSTEM.mjs')) {
    runTestBooking().catch(console.error);
}

export default new RefreshBookingService();