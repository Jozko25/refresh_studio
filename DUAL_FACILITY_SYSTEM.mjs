import https from 'https';
import dualFacilityAuthService from './src/services/DualFacilityAuthService.js';
import config from './config/bookio-config.js';
import logger from './src/services/logger.js';
import emailNotifier from './src/services/emailNotifier.js';

/**
 * DUAL FACILITY REFRESH BOOKING SYSTEM
 * Supports both Bratislava and Pezinok facilities
 * Sends email to janko.tank.poi@gmail.com for EVERY action
 */

const FACILITIES = {
    bratislava: {
        slug: 'refresh-laserove-a-esteticke-studio',
        name: 'REFRESH Bratislava',
        location: 'bratislava'
    },
    pezinok: {
        slug: 'refresh-laserove-a-esteticke-studio-zu0yxr5l', 
        name: 'REFRESH Pezinok',
        location: 'pezinok'
    }
};

// Services from both facilities
const SERVICES = {
    // Pezinok services
    pezinok: {
        hydrafacial: { id: 63975, name: 'HydraFillic with PEP9™', price: 145, duration: 60 },
        laser: { id: 60230, name: 'Laserová epilácia', price: 15, duration: 10 }
    },
    // Bratislava services (from your curl - service ID 125454)
    bratislava: {
        service_125454: { id: 125454, name: 'Service 125454', price: 72, duration: 30 }
    }
};

/**
 * Enhanced API request with comprehensive logging and email notifications
 */
async function makeAuthenticatedRequest(endpoint, data, facilitySlug, actionType = 'api_call') {
    const startTime = Date.now();
    const facility = config.getFacilityBySlug(facilitySlug) || Object.values(FACILITIES).find(f => f.slug === facilitySlug);
    
    try {
        // 📧 EMAIL NOTIFICATION FOR EVERY ACTION
        await emailNotifier.sendEmail(
            `🔍 ${actionType.toUpperCase()} - ${facility.name}`,
            `
            <h3>🏥 ${facility.name} - ${actionType.replace('_', ' ').toUpperCase()}</h3>
            <div style="background: #f0f8ff; padding: 15px; border-radius: 5px; margin: 10px 0;">
                <p><strong>Time:</strong> ${new Date().toLocaleString('sk-SK')}</p>
                <p><strong>Facility:</strong> ${facility.name}</p>
                <p><strong>Endpoint:</strong> ${endpoint}</p>
                <p><strong>Action:</strong> ${actionType}</p>
                <p><strong>Data:</strong> ${JSON.stringify(data, null, 2)}</p>
            </div>
            <hr>
            <p><small>REFRESH Studio Monitoring - All Actions Tracked</small></p>
            `,
            null,
            actionType
        );
        
        // Log the action
        await logger.logAPI(`${actionType}_start`, {
            endpoint,
            facility: facilitySlug,
            method: 'POST',
            actionType,
            data: data
        });
        
        // Get authentication for specific facility
        console.log(`🔐 Getting authentication cookie for ${facility.name}...`);
        const location = facility.location;
        const cookieHeader = await dualFacilityAuthService.getCookieHeader(location);
        
        const postData = JSON.stringify(data);
        
        const options = {
            hostname: 'services.bookio.com',
            port: 443,
            path: `/client-admin/api${endpoint}`,
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
                'Referer': `https://services.bookio.com/client-admin/${facilitySlug}/schedule`,
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-origin'
            }
        };

        return new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let responseData = '';
                
                console.log(`📍 API Response Status: ${res.statusCode}`);
                
                res.on('data', (chunk) => {
                    responseData += chunk;
                });

                res.on('end', async () => {
                    const duration = Date.now() - startTime;
                    
                    try {
                        const json = JSON.parse(responseData);
                        
                        // Log API response
                        await logger.logAPI(`${actionType}_complete`, {
                            endpoint,
                            facility: facilitySlug,
                            status: res.statusCode,
                            duration,
                            success: res.statusCode === 200,
                            responseSize: responseData.length
                        });
                        
                        // 📧 EMAIL SUCCESS NOTIFICATION
                        await emailNotifier.sendEmail(
                            `✅ ${actionType.toUpperCase()} Success - ${facility.name}`,
                            `
                            <h3>✅ ${facility.name} - ${actionType.replace('_', ' ').toUpperCase()} SUCCESS</h3>
                            <div style="background: #e8ffe8; padding: 15px; border-radius: 5px; margin: 10px 0;">
                                <p><strong>Status:</strong> ${res.statusCode}</p>
                                <p><strong>Duration:</strong> ${duration}ms</p>
                                <p><strong>Response Size:</strong> ${responseData.length} bytes</p>
                                <p><strong>Data Items:</strong> ${json.data ? (Array.isArray(json.data) ? json.data.length : 'Object') : 'N/A'}</p>
                            </div>
                            <hr>
                            <p><small>REFRESH Studio Monitoring</small></p>
                            `,
                            null,
                            `${actionType}_success`
                        );
                        
                        resolve({ status: res.statusCode, data: json });
                    } catch (e) {
                        await logger.logAPI(`${actionType}_parse_error`, {
                            endpoint,
                            facility: facilitySlug,
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
                
                await logger.logError(`API ${actionType} failed`, e, 'API');
                
                // 📧 EMAIL ERROR NOTIFICATION
                await emailNotifier.sendEmail(
                    `❌ ${actionType.toUpperCase()} Error - ${facility.name}`,
                    `
                    <h3>❌ ${facility.name} - ${actionType.replace('_', ' ').toUpperCase()} ERROR</h3>
                    <div style="background: #ffe8e8; padding: 15px; border-radius: 5px; margin: 10px 0;">
                        <p><strong>Error:</strong> ${e.message}</p>
                        <p><strong>Duration:</strong> ${duration}ms</p>
                        <p><strong>Endpoint:</strong> ${endpoint}</p>
                    </div>
                    <hr>
                    <p><small>REFRESH Studio Monitoring</small></p>
                    `,
                    null,
                    `${actionType}_error`
                );
                
                reject(e);
            });

            req.write(postData);
            req.end();
        });
        
    } catch (error) {
        const duration = Date.now() - startTime;
        
        await logger.logError(`API ${actionType} failed`, error, 'API');
        throw error;
    }
}

/**
 * Get schedule options for a facility - WITH EMAIL NOTIFICATION
 */
async function getScheduleOptions(facilitySlug) {
    console.log(`🔍 Getting schedule options for ${facilitySlug}...`);
    
    const data = {
        params: { "_gl": "tracking_params" },
        facility: facilitySlug
    };
    
    return await makeAuthenticatedRequest('/schedule/options', data, facilitySlug, 'schedule_options');
}

/**
 * Get available workers for a facility - WITH EMAIL NOTIFICATION
 */
async function getWorkers(facilitySlug) {
    console.log(`👥 Getting workers for ${facilitySlug}...`);
    
    const data = { facility: facilitySlug };
    
    return await makeAuthenticatedRequest('/schedule/res-objects', data, facilitySlug, 'get_workers');
}

/**
 * Get schedule data (calendar/availability) - WITH EMAIL NOTIFICATION
 */
async function getScheduleData(facilitySlug, fromDate, toDate) {
    console.log(`📅 Getting schedule data for ${facilitySlug} from ${fromDate} to ${toDate}...`);
    
    const data = {
        from: fromDate,
        to: toDate,
        facility: facilitySlug
    };
    
    return await makeAuthenticatedRequest('/schedule/data', data, facilitySlug, 'schedule_data');
}

/**
 * Search customers - WITH EMAIL NOTIFICATION
 */
async function searchCustomers(facilitySlug, field, query) {
    console.log(`🔍 Searching customers in ${facilitySlug} for ${field}: ${query}...`);
    
    const data = {
        field: field,
        query: query,
        facility: facilitySlug
    };
    
    return await makeAuthenticatedRequest('/schedule/customers', data, facilitySlug, 'customer_search');
}

/**
 * Create booking with comprehensive monitoring - WITH EMAIL NOTIFICATION
 */
async function createBooking(facilitySlug, bookingData) {
    const facility = Object.values(FACILITIES).find(f => f.slug === facilitySlug);
    
    console.log(`📋 Creating booking at ${facility.name}...`);
    
    // 📧 PRE-BOOKING EMAIL NOTIFICATION
    await emailNotifier.sendEmail(
        `📋 BOOKING ATTEMPT - ${facility.name}`,
        `
        <h2>📋 BOOKING ATTEMPT - ${facility.name}</h2>
        <div style="background: #fff8dc; padding: 15px; border-radius: 5px; margin: 10px 0;">
            <h3>Booking Details:</h3>
            <p><strong>Service ID:</strong> ${bookingData.event.service.value}</p>
            <p><strong>Date:</strong> ${bookingData.event.dateFrom}</p>
            <p><strong>Time:</strong> ${bookingData.event.timeFrom} - ${bookingData.event.timeTo}</p>
            <p><strong>Customer:</strong> ${bookingData.event.name}</p>
            <p><strong>Phone:</strong> ${bookingData.event.phone}</p>
            <p><strong>Email:</strong> ${bookingData.event.email}</p>
            <p><strong>Price:</strong> ${bookingData.event.price}€</p>
            <p><strong>Duration:</strong> ${bookingData.event.duration} min</p>
        </div>
        <p>🔄 Processing booking request...</p>
        <hr>
        <p><small>REFRESH Studio Live Monitoring</small></p>
        `,
        null,
        'booking_attempt'
    );
    
    const response = await makeAuthenticatedRequest('/schedule/event/save', bookingData, facilitySlug, 'create_booking');
    
    // 📧 BOOKING RESULT EMAIL NOTIFICATION
    if (response.status === 200 && response.data && response.data.data && response.data.data.success) {
        await emailNotifier.sendEmail(
            `🎉 BOOKING SUCCESS - ${facility.name}`,
            `
            <h2>🎉 BOOKING CREATED SUCCESSFULLY</h2>
            <div style="background: #e8ffe8; padding: 15px; border-radius: 5px; margin: 10px 0;">
                <h3>✅ Booking Confirmed at ${facility.name}</h3>
                <p><strong>Service ID:</strong> ${bookingData.event.service.value}</p>
                <p><strong>Date:</strong> ${bookingData.event.dateFrom}</p>
                <p><strong>Time:</strong> ${bookingData.event.timeFrom} - ${bookingData.event.timeTo}</p>
                <p><strong>Customer:</strong> ${bookingData.event.name}</p>
                <p><strong>Phone:</strong> ${bookingData.event.phone}</p>
                <p><strong>Email:</strong> ${bookingData.event.email}</p>
                <p><strong>Price:</strong> ${bookingData.event.price}€</p>
            </div>
            <p><strong>Response:</strong> ${JSON.stringify(response.data, null, 2)}</p>
            <hr>
            <p><small>REFRESH Studio Live Monitoring</small></p>
            `,
            null,
            'booking_success'
        );
    } else {
        await emailNotifier.sendEmail(
            `❌ BOOKING FAILED - ${facility.name}`,
            `
            <h2>❌ BOOKING FAILED</h2>
            <div style="background: #ffe8e8; padding: 15px; border-radius: 5px; margin: 10px 0;">
                <h3>❌ Booking Failed at ${facility.name}</h3>
                <p><strong>Status:</strong> ${response.status}</p>
                <p><strong>Error:</strong> ${response.data ? JSON.stringify(response.data) : 'Unknown error'}</p>
            </div>
            <hr>
            <p><small>REFRESH Studio Live Monitoring</small></p>
            `,
            null,
            'booking_failed'
        );
    }
    
    return response;
}

/**
 * Comprehensive dual-facility service
 */
export class DualFacilityBookingService {
    constructor() {
        this.initialized = false;
    }
    
    /**
     * Format date from YYYY-MM-DD to DD.MM.YYYY format required by Bookio
     */
    formatDate(dateString) {
        if (dateString.includes('.')) {
            return dateString; // Already in correct format
        }
        
        const parts = dateString.split('-');
        if (parts.length === 3) {
            return `${parts[2]}.${parts[1]}.${parts[0]}`;
        }
        
        return dateString; // Return as-is if format not recognized
    }
    
    async initialize() {
        if (!this.initialized) {
            await logger.logSystem('dual_facility_initializing', {
                facilities: Object.keys(FACILITIES),
                environment: config.name
            });
            
            await dualFacilityAuthService.initialize();
            
            // 📧 SYSTEM STARTUP EMAIL
            await emailNotifier.sendEmail(
                '🚀 DUAL FACILITY SYSTEM STARTED',
                `
                <h2>🚀 DUAL FACILITY SYSTEM STARTED</h2>
                <div style="background: #e8f4ff; padding: 15px; border-radius: 5px; margin: 10px 0;">
                    <p><strong>Time:</strong> ${new Date().toLocaleString('sk-SK')}</p>
                    <p><strong>Environment:</strong> ${config.name}</p>
                    <p><strong>Facilities:</strong></p>
                    <ul>
                        <li>✅ ${FACILITIES.bratislava.name} (${FACILITIES.bratislava.slug})</li>
                        <li>✅ ${FACILITIES.pezinok.name} (${FACILITIES.pezinok.slug})</li>
                    </ul>
                    <p><strong>Monitoring:</strong> ALL actions will be emailed</p>
                </div>
                <hr>
                <p><small>REFRESH Studio Dual Facility System</small></p>
                `,
                null,
                'system_startup'
            );
            
            this.initialized = true;
        }
    }
    
    // 📧 ALL METHODS BELOW SEND EMAIL NOTIFICATIONS
    
    async getScheduleOptions(location) {
        await this.initialize();
        const facility = FACILITIES[location];
        if (!facility) throw new Error(`Unknown location: ${location}`);
        
        return await getScheduleOptions(facility.slug);
    }
    
    async getWorkers(location) {
        await this.initialize();
        const facility = FACILITIES[location];
        if (!facility) throw new Error(`Unknown location: ${location}`);
        
        return await getWorkers(facility.slug);
    }
    
    async getScheduleData(location, fromDate, toDate) {
        await this.initialize();
        const facility = FACILITIES[location];
        if (!facility) throw new Error(`Unknown location: ${location}`);
        
        return await getScheduleData(facility.slug, fromDate, toDate);
    }
    
    async searchCustomers(location, field, query) {
        await this.initialize();
        const facility = FACILITIES[location];
        if (!facility) throw new Error(`Unknown location: ${location}`);
        
        return await searchCustomers(facility.slug, field, query);
    }
    
    async createBratislavaBooking(customerData, bookingTime, serviceId = 125454) {
        await this.initialize();
        
        const bookingData = {
            event: {
                type: 0,
                service: { value: serviceId },
                count: 0,
                dateFrom: this.formatDate(bookingTime.date),
                dateTo: this.formatDate(bookingTime.date),
                timeFrom: bookingTime.from,
                timeTo: bookingTime.to,
                repeat: {
                    repeatReservation: false,
                    repeatDays: [false, false, false, false, false, false, false],
                    selectedInterval: { label: "Weekly", value: 1 },
                    selectedRepeatDateTo: null
                },
                duration: 30,
                timeBefore: 0,
                timeAfter: 0,
                name: customerData.name,
                phone: customerData.phone,
                selectedCountry: "sk",
                email: customerData.email,
                price: 72,
                customerNote: customerData.note || "",
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
            facility: FACILITIES.bratislava.slug
        };
        
        return await createBooking(FACILITIES.bratislava.slug, bookingData);
    }
    
    async createPezinokBooking(customerData, bookingTime, serviceId = 63975) {
        await this.initialize();
        
        const service = serviceId === 63975 ? SERVICES.pezinok.hydrafacial : SERVICES.pezinok.laser;
        
        const bookingData = {
            event: {
                type: 0,
                service: { value: serviceId },
                count: 0,
                dateFrom: this.formatDate(bookingTime.date),
                dateTo: this.formatDate(bookingTime.date),
                timeFrom: bookingTime.from,
                timeTo: bookingTime.to,
                repeat: {
                    repeatReservation: false,
                    repeatDays: [false, false, false, false, false, false, false],
                    selectedInterval: { label: "Weekly", value: 1 },
                    selectedRepeatDateTo: null
                },
                duration: service.duration,
                timeBefore: 0,
                timeAfter: 0,
                name: customerData.name,
                phone: customerData.phone,
                selectedCountry: "sk",
                email: customerData.email,
                price: service.price,
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
            facility: FACILITIES.pezinok.slug
        };
        
        return await createBooking(FACILITIES.pezinok.slug, bookingData);
    }
}

export default new DualFacilityBookingService();