import https from 'https';
import bookioAuthService from './src/services/bookioAuthService.js';
import config from './config/bookio-config.js';
import logger from './src/services/logger.js';
import emailNotifier from './src/services/emailNotifier.js';

/**
 * Production REFRESH Booking System with Full Logging & Email Notifications
 * Sends alerts to janko.tank.poi@gmail.com for all events
 */

const FACILITY_SLUG = 'refresh-laserove-a-esteticke-studio-zu0yxr5l';

// Service IDs
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
 * Enhanced API request with logging and error tracking
 */
async function makeAuthenticatedRequest(path, data, bookingDetails = {}) {
    const startTime = Date.now();
    
    try {
        // Log API request start
        await logger.logAPI('request_start', {
            endpoint: path,
            method: 'POST',
            facility: FACILITY_SLUG,
            service: bookingDetails.serviceName,
            customer: bookingDetails.customerName
        });
        
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

        return new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let responseData = '';
                
                console.log(`📍 API Response Status: ${res.statusCode}`);
                
                if (res.headers['set-cookie']) {
                    console.log('🔄 Server sent new session cookies (auto-refresh detected)');
                }
                
                res.on('data', (chunk) => {
                    responseData += chunk;
                });

                res.on('end', async () => {
                    const duration = Date.now() - startTime;
                    
                    try {
                        const json = JSON.parse(responseData);
                        
                        // Log API response
                        await logger.logAPI('request_complete', {
                            endpoint: path,
                            status: res.statusCode,
                            duration,
                            success: res.statusCode === 200,
                            responseSize: responseData.length
                        });
                        
                        resolve({ status: res.statusCode, data: json });
                    } catch (e) {
                        await logger.logAPI('response_parse_error', {
                            endpoint: path,
                            status: res.statusCode,
                            duration,
                            error: e.message
                        });
                        resolve({ status: res.statusCode, data: responseData });
                    }
                });
            });

            req.on('error', async (e) => {
                const duration = Date.now() - startTime;
                
                await logger.logAPI('request_error', {
                    endpoint: path,
                    duration,
                    error: e.message
                });
                
                reject(e);
            });

            req.write(postData);
            req.end();
        });
        
    } catch (error) {
        const duration = Date.now() - startTime;
        
        await logger.logError('API request failed', error, 'API');
        await logger.logAPI('request_failed', {
            endpoint: path,
            duration,
            error: error.message
        });
        
        throw error;
    }
}

/**
 * Create a booking with full logging and notifications
 */
async function createBooking(bookingDetails) {
    console.log('🏥 REFRESH STUDIO - PRODUCTION BOOKING SYSTEM');
    console.log('=============================================\n');
    
    // Log booking attempt
    await logger.logBooking('attempt', bookingDetails);
    
    // Initialize authentication service
    console.log('🔧 Initializing authentication service...');
    try {
        await bookioAuthService.initialize();
        console.log('✅ Authentication service ready\n');
        
        await logger.logAuth('initialized', {
            environment: config.name,
            facility: FACILITY_SLUG,
            username: config.auth.username
        });
        
    } catch (error) {
        console.error('❌ Authentication initialization failed:', error.message);
        
        await logger.logAuth('initialization_failed', {
            error: error.message,
            environment: config.name
        });
        
        await emailNotifier.notifyAuthEvent('initialization failed', {
            environment: config.name,
            username: config.auth.username,
            facility: FACILITY_SLUG,
            error: error.message
        });
        
        return null;
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
    console.log('-------------------\\n');
    
    try {
        console.log('📤 Creating booking with authenticated request...\\n');
        
        const response = await makeAuthenticatedRequest('/schedule/event/save', bookingPayload, bookingDetails);
        
        if (response.status === 200) {
            if (response.data && response.data.data && response.data.data.success) {
                console.log('✅ BOOKING CREATED SUCCESSFULLY!');
                console.log('-----------------------------------');
                console.log(`Status: ${response.data.data.success ? 'Success' : 'Failed'}`);
                console.log(`Response:`, JSON.stringify(response.data, null, 2));
                console.log('-----------------------------------\\n');
                
                // Log successful booking
                await logger.logBooking('success', bookingDetails);
                
                // Send email notification
                await emailNotifier.notifyBookingEvent('success', bookingDetails);
                
                return response.data;
            } else if (response.data && response.data.error) {
                console.log('❌ Booking failed:', response.data.error);
                
                const errorDetails = { ...bookingDetails, error: response.data.error };
                await logger.logBooking('failed', errorDetails);
                await emailNotifier.notifyBookingEvent('failed', errorDetails);
                
                return null;
            } else {
                console.log('📦 Unexpected response:', JSON.stringify(response.data, null, 2));
                
                const unexpectedDetails = { 
                    ...bookingDetails, 
                    error: 'Unexpected API response',
                    responseData: response.data 
                };
                await logger.logBooking('unexpected_response', unexpectedDetails);
                await emailNotifier.notifyBookingEvent('unexpected response', unexpectedDetails);
                
                return response.data;
            }
        } else {
            console.log(`❌ HTTP Error ${response.status}`);
            console.log('Response:', response.data);
            
            const httpErrorDetails = {
                ...bookingDetails,
                error: `HTTP ${response.status}`,
                responseData: response.data
            };
            
            await logger.logBooking('http_error', httpErrorDetails);
            await emailNotifier.notifyBookingEvent('HTTP error', httpErrorDetails);
            
            return null;
        }
        
    } catch (error) {
        console.error('❌ Error creating booking:', error.message);
        
        // Log error
        await logger.logError('Booking creation failed', error, 'BOOKING');
        
        const errorDetails = { ...bookingDetails, error: error.message };
        await emailNotifier.notifyBookingEvent('error', errorDetails);
        
        // Try to refresh auth and retry once
        if (error.message.includes('401') || error.message.includes('authentication')) {
            console.log('🔄 Authentication might be expired, refreshing...');
            try {
                await bookioAuthService.forceRefresh();
                console.log('🔄 Retrying booking with fresh authentication...');
                
                await logger.logAuth('refresh_retry', {
                    environment: config.name,
                    username: config.auth.username,
                    reason: 'booking_401_error'
                });
                
                const retryResponse = await makeAuthenticatedRequest('/schedule/event/save', bookingPayload, bookingDetails);
                
                if (retryResponse.status === 200 && retryResponse.data?.data?.success) {
                    await logger.logBooking('retry_success', bookingDetails);
                    await emailNotifier.notifyBookingEvent('retry success', bookingDetails);
                } else {
                    await logger.logBooking('retry_failed', { ...bookingDetails, error: 'Retry also failed' });
                    await emailNotifier.notifyBookingEvent('retry failed', { ...bookingDetails, error: 'Retry also failed' });
                }
                
                return retryResponse.data;
            } catch (retryError) {
                console.error('❌ Retry also failed:', retryError.message);
                
                await logger.logError('Booking retry failed', retryError, 'BOOKING');
                await emailNotifier.notifyBookingEvent('retry error', { 
                    ...bookingDetails, 
                    error: retryError.message 
                });
                
                return null;
            }
        }
        
        return null;
    }
}

/**
 * Production Booking Service with monitoring
 */
export class ProductionBookingService {
    constructor() {
        this.initialized = false;
        this.startupTime = new Date();
    }
    
    async initialize() {
        if (!this.initialized) {
            await logger.logSystem('service_initializing', {
                startupTime: this.startupTime,
                environment: config.name
            });
            
            await bookioAuthService.initialize();
            
            // Send startup notification
            await emailNotifier.notifySystemStartup();
            
            this.initialized = true;
            
            await logger.logSystem('service_initialized', {
                startupTime: this.startupTime,
                environment: config.name
            });
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
            worker: WORKERS.janka,
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
            worker: WORKERS.janka,
            customerName: customerData.name,
            customerPhone: customerData.phone,
            customerEmail: customerData.email
        });
    }
    
    async getAuthStatus() {
        return bookioAuthService.getStatus();
    }
    
    async refreshAuth() {
        const result = await bookioAuthService.forceRefresh();
        
        await logger.logAuth('manual_refresh', {
            environment: config.name,
            username: config.auth.username,
            success: !!result
        });
        
        return result;
    }
    
    async getSystemStats() {
        const authStatus = this.getAuthStatus();
        const logStats = await logger.getLogStats();
        
        return {
            service: {
                initialized: this.initialized,
                startupTime: this.startupTime,
                uptime: Date.now() - this.startupTime.getTime()
            },
            auth: authStatus,
            logs: logStats,
            environment: config.name
        };
    }
}

export default new ProductionBookingService();