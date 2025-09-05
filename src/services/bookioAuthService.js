import { chromium } from 'playwright';
import config from '../../config/bookio-config.js';
import tokenStorage from './tokenStorage.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Bookio Authentication Service
 * Handles login, cookie extraction, and session management
 */
class BookioAuthService {
    constructor() {
        this.browser = null;
        this.context = null;
        this.page = null;
        
        // Cookie storage
        this.currentCookie = null;
        this.cookieExpiry = null;
        
        // State tracking
        this.isInitialized = false;
        this.isRefreshing = false;
        this.lastRefreshTime = null;
        
        // Storage paths
        this.cookieStoragePath = path.join(__dirname, '../../data/auth-cookies.json');
        
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
     * Initialize the authentication service
     */
    async initialize() {
        if (this.isInitialized) {
            console.log('✅ Auth service already initialized');
            return true;
        }

        try {
            console.log(`🔐 Initializing Bookio Auth Service (${this.config.name} environment)`);
            
            // Check for required credentials
            if (!this.username || !this.password) {
                throw new Error(`Missing credentials for ${this.config.name} environment. Please set ${this.config.name.toUpperCase()}_USERNAME and ${this.config.name.toUpperCase()}_PASSWORD in .env`);
            }
            
            // Try to load existing valid cookie first
            const existingTokenRecord = await tokenStorage.getToken(
                this.username,
                this.config.name,
                this.config.facility
            );
            
            if (existingTokenRecord && this.isCookieValid(existingTokenRecord)) {
                console.log('✅ Loaded valid cookie from token storage');
                this.currentCookie = existingTokenRecord.cookie;
                this.cookieExpiry = new Date(existingTokenRecord.expiry);
                this.lastRefreshTime = new Date(existingTokenRecord.refreshTime);
                this.isInitialized = true;
                return true;
            }
            
            // No valid cookie, need to login
            console.log('🔄 No valid cookie found, performing fresh login');
            await this.performLogin();
            
            this.isInitialized = true;
            return true;
            
        } catch (error) {
            console.error('❌ Failed to initialize auth service:', error.message);
            this.isInitialized = false;
            throw error;
        }
    }

    /**
     * Perform login and extract cookie
     */
    async performLogin() {
        try {
            console.log(`🌐 Launching browser for ${this.config.name} login...`);
            
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
                
                this.currentCookie = retriedAuthCookie;
            } else {
                this.currentCookie = authCookie;
            }
            
            console.log(`✅ Successfully extracted ${this.cookieName} cookie`);
            
            // Calculate expiry
            const now = Date.now();
            this.cookieExpiry = new Date(now + this.cookieMaxAge);
            this.lastRefreshTime = new Date(now);
            
            // Store cookie using new storage system
            await tokenStorage.storeToken({
                username: this.username,
                environment: this.config.name,
                facility: this.config.facility,
                cookie: this.currentCookie,
                expiry: this.cookieExpiry.toISOString(),
                refreshTime: this.lastRefreshTime.toISOString()
            });
            
            // Close browser
            await this.closeBrowser();
            
            return this.currentCookie;
            
        } catch (error) {
            console.error('❌ Login failed:', error.message);
            await this.closeBrowser();
            throw error;
        }
    }

    /**
     * Get current valid cookie
     */
    async getCookie() {
        if (!this.isInitialized) {
            await this.initialize();
        }
        
        // Check if cookie needs refresh
        if (this.shouldRefresh()) {
            console.log('🔄 Cookie needs refresh');
            await this.refreshCookie();
        }
        
        if (!this.currentCookie) {
            throw new Error('No valid authentication cookie available');
        }
        
        return this.currentCookie;
    }

    /**
     * Get cookie as header format
     */
    async getCookieHeader() {
        const cookie = await this.getCookie();
        return `${cookie.name}=${cookie.value}`;
    }

    /**
     * Refresh authentication cookie
     */
    async refreshCookie() {
        if (this.isRefreshing) {
            console.log('⏳ Refresh already in progress, waiting...');
            while (this.isRefreshing) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            return this.currentCookie;
        }
        
        try {
            this.isRefreshing = true;
            console.log('🔄 Refreshing authentication cookie');
            
            await this.performLogin();
            
            console.log('✅ Cookie refreshed successfully');
            return this.currentCookie;
            
        } catch (error) {
            console.error('❌ Failed to refresh cookie:', error.message);
            throw error;
        } finally {
            this.isRefreshing = false;
        }
    }

    /**
     * Check if cookie should be refreshed
     */
    shouldRefresh() {
        if (!this.currentCookie || !this.cookieExpiry) {
            return true;
        }
        
        const now = Date.now();
        const expiry = this.cookieExpiry.getTime();
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
     * Store cookie to file
     */
    async storeCookie() {
        try {
            const cookieData = {
                cookie: this.currentCookie,
                expiry: this.cookieExpiry.toISOString(),
                refreshTime: this.lastRefreshTime.toISOString(),
                environment: this.config.name
            };
            
            // Ensure data directory exists
            const dataDir = path.dirname(this.cookieStoragePath);
            await fs.mkdir(dataDir, { recursive: true });
            
            // Write cookie data
            await fs.writeFile(
                this.cookieStoragePath,
                JSON.stringify(cookieData, null, 2),
                'utf8'
            );
            
            console.log('💾 Cookie stored successfully');
        } catch (error) {
            console.error('⚠️ Failed to store cookie:', error.message);
        }
    }

    /**
     * Load stored cookie from file
     */
    async loadStoredCookie() {
        try {
            const data = await fs.readFile(this.cookieStoragePath, 'utf8');
            const cookieData = JSON.parse(data);
            
            // Check if cookie is for current environment
            if (cookieData.environment !== this.config.name) {
                console.log(`⚠️ Stored cookie is for ${cookieData.environment}, current is ${this.config.name}`);
                return null;
            }
            
            return cookieData;
        } catch (error) {
            console.log('📭 No stored cookie found');
            return null;
        }
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
     * Get authentication status
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            hasCookie: !!this.currentCookie,
            cookieValid: this.currentCookie && !this.shouldRefresh(),
            lastRefresh: this.lastRefreshTime,
            nextRefresh: this.cookieExpiry ? new Date(this.cookieExpiry.getTime() - 60 * 60 * 1000) : null,
            environment: this.config.name,
            cookieName: this.cookieName
        };
    }

    /**
     * Force re-authentication
     */
    async forceRefresh() {
        console.log('🔄 Forcing authentication refresh');
        this.currentCookie = null;
        this.cookieExpiry = null;
        return await this.refreshCookie();
    }
}

export default new BookioAuthService();