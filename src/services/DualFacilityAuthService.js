import { chromium } from 'playwright';
import config from '../../config/bookio-config.js';
import tokenStorage from './tokenStorage.js';
import logger from './logger.js';
import emailNotifier from './emailNotifier.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Dual Facility Bookio Authentication Service
 * Supports both Bratislava and Pezinok facilities with automatic facility switching
 */
class DualFacilityAuthService {
    constructor() {
        this.browser = null;
        this.context = null;
        this.page = null;
        
        // Facility configurations (corrected)
        this.facilities = {
            bratislava: {
                slug: 'refresh-laserove-a-esteticke-studio-zu0yxr5l',
                name: 'REFRESH Bratislava',
                referer: 'https://services.bookio.com/client-admin/refresh-laserove-a-esteticke-studio-zu0yxr5l/schedule',
                tokenFile: 'jurkovicova_jana_gmail_com_Production_refresh-laserove-a-esteticke-studio-zu0yxr5l'
            },
            pezinok: {
                slug: 'refresh-laserove-a-esteticke-studio',
                name: 'REFRESH Pezinok', 
                referer: 'https://services.bookio.com/client-admin/refresh-laserove-a-esteticke-studio/schedule',
                tokenFile: 'jurkovicova_jana_gmail_com_Production_refresh-laserove-a-esteticke-studio'
            }
        };
        
        // Cookie storage per facility
        this.cookies = {
            bratislava: { cookie: null, expiry: null, lastRefresh: null },
            pezinok: { cookie: null, expiry: null, lastRefresh: null }
        };
        
        // State tracking
        this.isInitialized = false;
        this.isRefreshing = { bratislava: false, pezinok: false };
        
        // Configuration from bookio-config.js
        this.config = config;
        this.authURL = config.authURL;
        this.username = config.auth.username;
        this.password = config.auth.password;
        this.cookieName = config.auth.cookieName;
        this.refreshInterval = config.auth.cookieRefreshInterval;
        this.cookieMaxAge = config.auth.cookieMaxAge;
        
        // Browser settings
        this.browserSettings = config.browser;
    }

    /**
     * Initialize the dual facility authentication service
     */
    async initialize() {
        if (this.isInitialized) {
            console.log('✅ Dual facility auth service already initialized');
            return true;
        }

        try {
            console.log(`🔐 Initializing Dual Facility Bookio Auth Service (${this.config.name} environment)`);
            
            // Check for required credentials
            if (!this.username || !this.password) {
                throw new Error(`Missing credentials for ${this.config.name} environment. Please set ${this.config.name.toUpperCase()}_USERNAME and ${this.config.name.toUpperCase()}_PASSWORD in .env`);
            }
            
            // 📧 EMAIL NOTIFICATION - AUTH INITIALIZATION
            await emailNotifier.sendEmail(
                '🔐 AUTH SYSTEM INITIALIZING',
                `
                <h2>🔐 Authentication System Initializing</h2>
                <div style="background: #f0f8ff; padding: 15px; border-radius: 5px; margin: 10px 0;">
                    <p><strong>Time:</strong> ${new Date().toLocaleString('sk-SK')}</p>
                    <p><strong>Environment:</strong> ${this.config.name}</p>
                    <p><strong>User:</strong> ${this.username}</p>
                    <p><strong>Facilities:</strong></p>
                    <ul>
                        <li>🏥 ${this.facilities.bratislava.name}</li>
                        <li>🏥 ${this.facilities.pezinok.name}</li>
                    </ul>
                </div>
                <p>🔄 Checking existing tokens...</p>
                <hr>
                <p><small>REFRESH Studio Authentication</small></p>
                `,
                null,
                'auth_init'
            );
            
            // Try to load existing valid cookies for both facilities
            for (const [location, facility] of Object.entries(this.facilities)) {
                const existingTokenRecord = await tokenStorage.getToken(
                    this.username,
                    this.config.name,
                    facility.slug
                );
                
                if (existingTokenRecord && this.isCookieValid(existingTokenRecord)) {
                    console.log(`✅ Loaded valid cookie for ${facility.name}`);
                    this.cookies[location].cookie = existingTokenRecord.cookie;
                    this.cookies[location].expiry = new Date(existingTokenRecord.expiry);
                    this.cookies[location].lastRefresh = new Date(existingTokenRecord.refreshTime);
                    
                    await logger.logAuth('cookie_loaded', {
                        environment: this.config.name,
                        username: this.username,
                        facility: facility.slug,
                        location: location,
                        expiry: existingTokenRecord.expiry
                    });
                }
            }
            
            this.isInitialized = true;
            
            // 📧 EMAIL NOTIFICATION - AUTH INITIALIZED
            const validCookies = Object.entries(this.cookies)
                .filter(([loc, data]) => data.cookie)
                .map(([loc, data]) => this.facilities[loc].name);
            
            await emailNotifier.sendEmail(
                '✅ AUTH SYSTEM READY',
                `
                <h2>✅ Authentication System Ready</h2>
                <div style="background: #e8ffe8; padding: 15px; border-radius: 5px; margin: 10px 0;">
                    <p><strong>Status:</strong> Initialized Successfully</p>
                    <p><strong>Valid Cookies:</strong> ${validCookies.length > 0 ? validCookies.join(', ') : 'None (will login on demand)'}</p>
                    <p><strong>Ready for:</strong> All search, schedule, and booking operations</p>
                </div>
                <hr>
                <p><small>REFRESH Studio Authentication</small></p>
                `,
                null,
                'auth_ready'
            );
            
            return true;
            
        } catch (error) {
            console.error('❌ Failed to initialize dual facility auth service:', error.message);
            
            // 📧 EMAIL NOTIFICATION - AUTH ERROR
            await emailNotifier.sendEmail(
                '❌ AUTH SYSTEM FAILED',
                `
                <h2>❌ Authentication System Failed</h2>
                <div style="background: #ffe8e8; padding: 15px; border-radius: 5px; margin: 10px 0;">
                    <p><strong>Error:</strong> ${error.message}</p>
                    <p><strong>Time:</strong> ${new Date().toLocaleString('sk-SK')}</p>
                </div>
                <hr>
                <p><small>REFRESH Studio Authentication</small></p>
                `,
                null,
                'auth_error'
            );
            
            this.isInitialized = false;
            throw error;
        }
    }

    /**
     * Perform login for a specific facility
     */
    async performLogin(location) {
        const facility = this.facilities[location];
        if (!facility) {
            throw new Error(`Unknown facility location: ${location}`);
        }
        
        try {
            console.log(`🌐 Performing login for ${facility.name}...`);
            
            // 📧 EMAIL NOTIFICATION - LOGIN START
            await emailNotifier.sendEmail(
                `🔑 LOGIN STARTING - ${facility.name}`,
                `
                <h2>🔑 Login Starting - ${facility.name}</h2>
                <div style="background: #fff8dc; padding: 15px; border-radius: 5px; margin: 10px 0;">
                    <p><strong>Facility:</strong> ${facility.name}</p>
                    <p><strong>User:</strong> ${this.username}</p>
                    <p><strong>Time:</strong> ${new Date().toLocaleString('sk-SK')}</p>
                </div>
                <p>🔄 Opening browser and navigating to login page...</p>
                <hr>
                <p><small>REFRESH Studio Authentication</small></p>
                `,
                null,
                'login_start'
            );
            
            // Launch browser
            this.browser = await chromium.launch({
                headless: this.browserSettings.headless,
                slowMo: this.browserSettings.slowMo,
                devtools: this.browserSettings.devtools,
                args: [
                    '--disable-blink-features=AutomationControlled',
                    '--disable-features=IsolateOrigins,site-per-process',
                    '--no-sandbox',
                    '--disable-setuid-sandbox'
                ]
            });
            
            this.context = await this.browser.newContext({
                viewport: { width: 1920, height: 1080 },
                locale: 'sk-SK',
                timezoneId: 'Europe/Bratislava'
            });
            
            this.page = await this.context.newPage();
            
            // Navigate to login page
            console.log(`📍 Navigating to: ${this.authURL}`);
            await this.page.goto(this.authURL, { 
                waitUntil: 'networkidle',
                timeout: 30000 
            });
            
            // Wait for login form
            await this.page.waitForSelector('input[type="email"], input[type="text"], input[name="username"], input[name="email"]', {
                timeout: 10000
            });
            
            console.log('📝 Filling login credentials');
            
            // Find and fill username field
            const usernameSelectors = [
                'input[type="email"]',
                'input[name="username"]',
                'input[name="email"]',
                'input[type="text"]:first-of-type'
            ];
            
            for (const selector of usernameSelectors) {
                try {
                    const field = await this.page.$(selector);
                    if (field) {
                        await field.fill(this.username);
                        console.log(`✅ Filled username with selector: ${selector}`);
                        break;
                    }
                } catch (e) {
                    continue;
                }
            }
            
            // Find and fill password field
            await this.page.fill('input[type="password"]', this.password);
            console.log('✅ Filled password');
            
            // Submit form
            const submitSelectors = [
                'button[type="submit"]',
                'input[type="submit"]',
                'button:has-text("Prihlásiť")',
                'button:has-text("Login")',
                'button:has-text("Sign in")'
            ];
            
            let submitted = false;
            for (const selector of submitSelectors) {
                try {
                    const button = await this.page.$(selector);
                    if (button) {
                        await button.click();
                        console.log(`✅ Clicked submit with selector: ${selector}`);
                        submitted = true;
                        break;
                    }
                } catch (e) {
                    continue;
                }
            }
            
            if (!submitted) {
                // Try pressing Enter as fallback
                await this.page.keyboard.press('Enter');
                console.log('✅ Submitted with Enter key');
            }
            
            // Wait for navigation or cookie to appear
            await this.page.waitForLoadState('networkidle', { timeout: 15000 });
            
            // Extract cookies
            console.log('🍪 Extracting authentication cookie');
            const cookies = await this.context.cookies();
            
            // Find the bses-0 cookie
            const authCookie = cookies.find(c => c.name === this.cookieName);
            
            if (!authCookie) {
                // Try to wait a bit more and check again
                await this.page.waitForTimeout(3000);
                const retriedCookies = await this.context.cookies();
                const retriedAuthCookie = retriedCookies.find(c => c.name === this.cookieName);
                
                if (!retriedAuthCookie) {
                    throw new Error(`Authentication cookie "${this.cookieName}" not found after login`);
                }
                
                this.cookies[location].cookie = retriedAuthCookie;
            } else {
                this.cookies[location].cookie = authCookie;
            }
            
            console.log(`✅ Successfully extracted ${this.cookieName} cookie for ${facility.name}`);
            
            // Calculate expiry
            const now = Date.now();
            this.cookies[location].expiry = new Date(now + this.cookieMaxAge);
            this.cookies[location].lastRefresh = new Date(now);
            
            // Store cookie using token storage
            await tokenStorage.storeToken({
                username: this.username,
                environment: this.config.name,
                facility: facility.slug,
                cookie: this.cookies[location].cookie,
                expiry: this.cookies[location].expiry.toISOString(),
                refreshTime: this.cookies[location].lastRefresh.toISOString()
            });
            
            await logger.logAuth('login_success', {
                environment: this.config.name,
                username: this.username,
                facility: facility.slug,
                location: location,
                expiry: this.cookies[location].expiry.toISOString()
            });
            
            // 📧 EMAIL NOTIFICATION - LOGIN SUCCESS
            await emailNotifier.sendEmail(
                `✅ LOGIN SUCCESS - ${facility.name}`,
                `
                <h2>✅ Login Success - ${facility.name}</h2>
                <div style="background: #e8ffe8; padding: 15px; border-radius: 5px; margin: 10px 0;">
                    <p><strong>Facility:</strong> ${facility.name}</p>
                    <p><strong>User:</strong> ${this.username}</p>
                    <p><strong>Cookie Expiry:</strong> ${this.cookies[location].expiry.toLocaleString('sk-SK')}</p>
                    <p><strong>Status:</strong> Ready for API calls</p>
                </div>
                <hr>
                <p><small>REFRESH Studio Authentication</small></p>
                `,
                null,
                'login_success'
            );
            
            // Close browser
            await this.closeBrowser();
            
            return this.cookies[location].cookie;
            
        } catch (error) {
            console.error(`❌ Login failed for ${facility.name}:`, error.message);
            
            await logger.logError(`Login failed for ${facility.name}`, error, 'AUTH');
            
            // 📧 EMAIL NOTIFICATION - LOGIN FAILED
            await emailNotifier.sendEmail(
                `❌ LOGIN FAILED - ${facility.name}`,
                `
                <h2>❌ Login Failed - ${facility.name}</h2>
                <div style="background: #ffe8e8; padding: 15px; border-radius: 5px; margin: 10px 0;">
                    <p><strong>Facility:</strong> ${facility.name}</p>
                    <p><strong>User:</strong> ${this.username}</p>
                    <p><strong>Error:</strong> ${error.message}</p>
                    <p><strong>Time:</strong> ${new Date().toLocaleString('sk-SK')}</p>
                </div>
                <hr>
                <p><small>REFRESH Studio Authentication</small></p>
                `,
                null,
                'login_failed'
            );
            
            await this.closeBrowser();
            throw error;
        }
    }

    /**
     * Get cookie for specific facility
     */
    async getCookie(location) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        
        const facility = this.facilities[location];
        if (!facility) {
            throw new Error(`Unknown facility location: ${location}`);
        }
        
        // Check if cookie needs refresh
        if (this.shouldRefresh(location)) {
            console.log(`🔄 Cookie needs refresh for ${facility.name}`);
            await this.refreshCookie(location);
        }
        
        if (!this.cookies[location].cookie) {
            throw new Error(`No valid authentication cookie available for ${facility.name}`);
        }
        
        return this.cookies[location].cookie;
    }

    /**
     * Get cookie as header format for specific facility
     */
    async getCookieHeader(location) {
        const cookie = await this.getCookie(location);
        return `${cookie.name}=${cookie.value}`;
    }

    /**
     * Refresh authentication cookie for specific facility
     */
    async refreshCookie(location) {
        if (this.isRefreshing[location]) {
            console.log(`⏳ Refresh already in progress for ${this.facilities[location].name}, waiting...`);
            while (this.isRefreshing[location]) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            return this.cookies[location].cookie;
        }
        
        try {
            this.isRefreshing[location] = true;
            console.log(`🔄 Refreshing authentication cookie for ${this.facilities[location].name}`);
            
            await this.performLogin(location);
            
            console.log(`✅ Cookie refreshed successfully for ${this.facilities[location].name}`);
            return this.cookies[location].cookie;
            
        } catch (error) {
            console.error(`❌ Failed to refresh cookie for ${this.facilities[location].name}:`, error.message);
            throw error;
        } finally {
            this.isRefreshing[location] = false;
        }
    }

    /**
     * Check if cookie should be refreshed for specific facility
     */
    shouldRefresh(location) {
        const cookieData = this.cookies[location];
        if (!cookieData.cookie || !cookieData.expiry) {
            return true;
        }
        
        const now = Date.now();
        const expiry = cookieData.expiry.getTime();
        const bufferTime = 60 * 60 * 1000; // 1 hour buffer
        
        return (expiry - now) < bufferTime;
    }

    /**
     * Check if cookie is valid
     */
    isCookieValid(cookieData) {
        if (!cookieData || !cookieData.expiry) {
            return false;
        }
        
        const expiry = new Date(cookieData.expiry).getTime();
        const now = Date.now();
        const bufferTime = 60 * 60 * 1000; // 1 hour buffer
        
        return (expiry - now) > bufferTime;
    }

    /**
     * Close browser
     */
    async closeBrowser() {
        try {
            if (this.page) {
                await this.page.close();
                this.page = null;
            }
            if (this.context) {
                await this.context.close();
                this.context = null;
            }
            if (this.browser) {
                await this.browser.close();
                this.browser = null;
            }
        } catch (error) {
            console.error('⚠️ Error closing browser:', error.message);
        }
    }

    /**
     * Get authentication status for all facilities
     */
    getStatus() {
        const status = {
            initialized: this.isInitialized,
            environment: this.config.name,
            facilities: {}
        };
        
        for (const [location, facility] of Object.entries(this.facilities)) {
            const cookieData = this.cookies[location];
            status.facilities[location] = {
                name: facility.name,
                slug: facility.slug,
                hasCookie: !!cookieData.cookie,
                cookieValid: cookieData.cookie && !this.shouldRefresh(location),
                lastRefresh: cookieData.lastRefresh,
                nextRefresh: cookieData.expiry ? new Date(cookieData.expiry.getTime() - 60 * 60 * 1000) : null,
                isRefreshing: this.isRefreshing[location]
            };
        }
        
        return status;
    }

    /**
     * Force re-authentication for specific facility
     */
    async forceRefresh(location) {
        const facility = this.facilities[location];
        if (!facility) {
            throw new Error(`Unknown facility location: ${location}`);
        }
        
        console.log(`🔄 Forcing authentication refresh for ${facility.name}`);
        this.cookies[location].cookie = null;
        this.cookies[location].expiry = null;
        return await this.refreshCookie(location);
    }

    /**
     * Force re-authentication for all facilities
     */
    async forceRefreshAll() {
        console.log('🔄 Forcing authentication refresh for all facilities');
        
        const results = {};
        for (const location of Object.keys(this.facilities)) {
            try {
                results[location] = await this.forceRefresh(location);
            } catch (error) {
                results[location] = { error: error.message };
            }
        }
        
        return results;
    }
}

export default new DualFacilityAuthService();