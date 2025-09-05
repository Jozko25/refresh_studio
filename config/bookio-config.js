/**
 * Bookio Configuration File
 * Switch between demo and production environments easily
 */

import dotenv from 'dotenv';
dotenv.config();

// Set this to 'demo' for testing or 'production' for live
const ENVIRONMENT = process.env.BOOKIO_ENV || 'demo';

const environments = {
    demo: {
        // Demo/Testing Environment (using production URLs for testing)
        name: 'Demo',
        baseURL: 'https://services.bookio.com',
        authURL: 'https://services.bookio.com/auth/login',
        apiBaseURL: 'https://services.bookio.com',
        widgetPath: '/ai-recepcia-zll65ixf/widget',
        facility: 'ai-recepcia-zll65ixf',
        
        // API Endpoints
        endpoints: {
            // Widget endpoints (has fingerprint protection)
            createReservation: '/widget/api/createReservation',
            facilityConfig: '/widget/api/facilityConfiguration',
            categories: '/widget/api/categories',
            services: '/widget/api/services',
            workers: '/widget/api/workers',
            allowedDays: '/widget/api/allowedDays',
            allowedTimes: '/widget/api/allowedTimes',
            
            // Admin endpoints (requires authentication)
            adminBooking: '/client-admin/api/schedule/event/save',
            customerLookup: '/client-admin/api/schedule/customers',
            reservationsCount: '/client-admin/api/facility/reservations-count',
            scheduleData: '/client-admin/api/schedule/data',
            userProfile: '/client-admin/api/user/profile'
        },
        
        // Authentication
        auth: {
            username: process.env.DEMO_USERNAME || '',  // Set in .env file
            password: process.env.DEMO_PASSWORD || '',  // Set in .env file
            cookieName: 'bses-0',
            cookieRefreshInterval: 11 * 60 * 60 * 1000,  // 11 hours
            cookieMaxAge: 12 * 60 * 60 * 1000  // 12 hours
        },
        
        // Browser automation settings
        browser: {
            headless: false,  // Show browser for demo debugging
            slowMo: 100,  // Slow down actions for debugging
            devtools: true  // Open devtools for debugging
        }
    },
    
    production: {
        // Production Environment
        name: 'Production',
        baseURL: 'https://services.bookio.com',
        authURL: 'https://services.bookio.com/auth/login',
        apiBaseURL: 'https://services.bookio.com',
        
        // Multiple facilities
        facilities: {
            bratislava: {
                name: 'Bratislava',
                facility: 'refresh-laserove-a-esteticke-studio',
                widgetPath: '/refresh-laserove-a-esteticke-studio/widget',
                widgetURL: 'https://services.bookio.com/refresh-laserove-a-esteticke-studio/widget?lang=sk'
            },
            pezinok: {
                name: 'Pezinok', 
                facility: 'refresh-laserove-a-esteticke-studio-zu0yxr5l',
                widgetPath: '/refresh-laserove-a-esteticke-studio-zu0yxr5l/widget',
                widgetURL: 'https://services.bookio.com/refresh-laserove-a-esteticke-studio-zu0yxr5l/widget?lang=sk'
            }
        },
        
        // Default facility (Bratislava)
        widgetPath: '/refresh-laserove-a-esteticke-studio/widget',
        facility: 'refresh-laserove-a-esteticke-studio',
        
        // API Endpoints
        endpoints: {
            // Widget endpoints (has fingerprint protection)
            createReservation: '/widget/api/createReservation',
            facilityConfig: '/widget/api/facilityConfiguration',
            categories: '/widget/api/categories',
            services: '/widget/api/services',
            workers: '/widget/api/workers',
            allowedDays: '/widget/api/allowedDays',
            allowedTimes: '/widget/api/allowedTimes',
            
            // Admin endpoints (requires authentication)
            adminBooking: '/client-admin/api/schedule/event/save',
            customerLookup: '/client-admin/api/schedule/customers',
            reservationsCount: '/client-admin/api/facility/reservations-count',
            scheduleData: '/client-admin/api/schedule/data',
            userProfile: '/client-admin/api/user/profile'
        },
        
        // Authentication
        auth: {
            username: process.env.PROD_USERNAME || '',  // Set in .env file
            password: process.env.PROD_PASSWORD || '',  // Set in .env file
            cookieName: 'bses-0',
            cookieRefreshInterval: 11 * 60 * 60 * 1000,  // 11 hours
            cookieMaxAge: 12 * 60 * 60 * 1000  // 12 hours
        },
        
        // Browser automation settings
        browser: {
            headless: true,  // Run headless in production
            slowMo: 0,  // No delays in production
            devtools: false  // No devtools in production
        }
    },
    
    staging: {
        // Staging Environment (optional)
        name: 'Staging',
        baseURL: 'https://staging.bookio.com',  // Replace with staging URL
        authURL: 'https://staging.bookio.com/auth/login',
        apiBaseURL: 'https://staging.bookio.com',
        widgetPath: '/staging-facility/widget',
        facility: 'staging-facility-id',
        
        // Copy endpoints structure from production
        endpoints: {
            createReservation: '/widget/api/createReservation',
            facilityConfig: '/widget/api/facilityConfiguration',
            categories: '/widget/api/categories',
            services: '/widget/api/services',
            workers: '/widget/api/workers',
            allowedDays: '/widget/api/allowedDays',
            allowedTimes: '/widget/api/allowedTimes',
            adminBooking: '/client-admin/api/schedule/event/save'
        },
        
        // Authentication
        auth: {
            username: process.env.STAGING_USERNAME || '',
            password: process.env.STAGING_PASSWORD || '',
            cookieName: 'bses-0',
            cookieRefreshInterval: 11 * 60 * 60 * 1000,
            cookieMaxAge: 12 * 60 * 60 * 1000
        },
        
        // Browser automation settings
        browser: {
            headless: true,
            slowMo: 0,
            devtools: false
        }
    }
};

// Get current configuration
const config = environments[ENVIRONMENT];

if (!config) {
    throw new Error(`Invalid BOOKIO_ENV: ${ENVIRONMENT}. Must be one of: ${Object.keys(environments).join(', ')}`);
}

// Add helper functions
config.getFullURL = (endpoint) => {
    return `${config.apiBaseURL}${config.endpoints[endpoint]}`;
};

config.getWidgetURL = (facilityKey = null) => {
    if (facilityKey && config.facilities && config.facilities[facilityKey]) {
        return config.facilities[facilityKey].widgetURL;
    }
    return `${config.baseURL}${config.widgetPath}`;
};

config.getFacilityConfig = (facilityKey) => {
    if (config.facilities && config.facilities[facilityKey]) {
        return config.facilities[facilityKey];
    }
    return {
        name: config.name,
        facility: config.facility,
        widgetPath: config.widgetPath,
        widgetURL: `${config.baseURL}${config.widgetPath}?lang=sk`
    };
};

config.getAllFacilities = () => {
    if (config.facilities) {
        return Object.keys(config.facilities).map(key => ({
            key,
            ...config.facilities[key]
        }));
    }
    return [{
        key: 'default',
        name: config.name,
        facility: config.facility,
        widgetPath: config.widgetPath,
        widgetURL: `${config.baseURL}${config.widgetPath}?lang=sk`
    }];
};

// Log current environment (only in development)
if (process.env.NODE_ENV !== 'production') {
    console.log(`🔧 Bookio Config: Using ${config.name} environment`);
    console.log(`   Base URL: ${config.baseURL}`);
    console.log(`   Facility: ${config.facility}`);
}

export default config;

// Named exports for convenience
export const {
    baseURL,
    authURL,
    apiBaseURL,
    widgetPath,
    facility,
    endpoints,
    auth,
    browser,
    getFullURL,
    getWidgetURL
} = config;