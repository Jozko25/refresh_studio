import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';

/**
 * Manages Bookio session cookies for authenticated API access
 */
class BookioSessionManager {
    constructor() {
        this.sessionFile = path.join(process.cwd(), 'data', 'bookio-session.json');
        this.sessionCookie = null;
        this.sessionExpiry = null;
    }

    /**
     * Get current session cookie if valid
     */
    async getSessionCookie() {
        // First check in-memory cache
        if (this.sessionCookie && this.sessionExpiry && new Date() < this.sessionExpiry) {
            console.log('📦 Using cached session cookie');
            return this.sessionCookie;
        }

        // Try to load from file
        try {
            const data = await fs.readFile(this.sessionFile, 'utf8');
            const session = JSON.parse(data);
            
            if (session.cookie && session.expiry && new Date(session.expiry) > new Date()) {
                console.log('📂 Loaded session from file, expires:', new Date(session.expiry).toISOString());
                this.sessionCookie = session.cookie;
                this.sessionExpiry = new Date(session.expiry);
                return this.sessionCookie;
            }
        } catch (error) {
            console.log('⚠️ No valid session file found');
        }

        // No valid session, need to refresh
        console.log('🔄 Session expired or missing, refreshing...');
        return await this.refreshSession();
    }

    /**
     * Refresh session by opening Chrome and getting the cookie
     */
    async refreshSession() {
        console.log('🚀 Starting automated Chrome session refresh...');
        
        let browser;
        try {
            // Launch Chrome in headless mode
            browser = await puppeteer.launch({
                headless: 'new', // Use new headless mode for better compatibility
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--disable-blink-features=AutomationControlled',
                    '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                ],
                defaultViewport: null
            });

            const page = await browser.newPage();
            
            // Set user agent to appear more like a real browser
            await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            
            // Add some browser APIs that are often checked
            await page.evaluateOnNewDocument(() => {
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => false,
                });
            });
            
            // Navigate to the widget page
            const widgetUrl = 'https://services.bookio.com/refresh-laserove-a-esteticke-studio-zu0yxr5l/widget?lang=sk';
            console.log(`📍 Navigating to ${widgetUrl}`);
            
            await page.goto(widgetUrl, { 
                waitUntil: 'domcontentloaded',
                timeout: 60000 
            });

            console.log('⏳ Page loaded, triggering session creation...');
            
            // Make an API request from the page context to trigger session creation
            const response = await page.evaluate(async () => {
                try {
                    const res = await fetch('/widget/api/services?lang=sk', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            facility: 'refresh-laserove-a-esteticke-studio-zu0yxr5l',
                            categoryId: null,
                            lang: 'sk'
                        })
                    });
                    return { success: true, status: res.status };
                } catch (error) {
                    return { success: false, error: error.message };
                }
            });
            
            console.log('🔄 API request result:', response);
            
            // Wait for cookies to be set
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Get all cookies after API request
            const cookies = await page.cookies();
            console.log(`🍪 Found ${cookies.length} cookies after API request`);
            console.log('🍪 Cookie names:', cookies.map(c => c.name).join(', '));
            
            // Find the session cookie (might be bses-0 or bses-[number])
            const sessionCookie = cookies.find(c => c.name.startsWith('bses-'));
            
            if (!sessionCookie) {
                console.log('⚠️ Session cookie still not found, checking all cookies...');
                cookies.forEach(cookie => {
                    console.log(`  - ${cookie.name}: ${cookie.value.substring(0, 30)}...`);
                });
                throw new Error('Session cookie not found after API request');
            }
            
            this.sessionCookie = sessionCookie.value;

            console.log('✅ Got session cookie:', this.sessionCookie.substring(0, 50) + '...');

            // Store the cookie with 12-hour expiry
            const expiry = new Date();
            expiry.setHours(expiry.getHours() + 12);
            this.sessionExpiry = expiry;

            // Save to file
            await this.saveSession();

            return this.sessionCookie;

        } catch (error) {
            console.error('❌ Failed to refresh session:', error.message);
            throw error;
        } finally {
            if (browser) {
                console.log('🔒 Closing browser');
                await browser.close();
            }
        }
    }

    /**
     * Save session to file
     */
    async saveSession() {
        try {
            // Ensure data directory exists
            const dataDir = path.dirname(this.sessionFile);
            await fs.mkdir(dataDir, { recursive: true });

            const sessionData = {
                cookie: this.sessionCookie,
                expiry: this.sessionExpiry.toISOString(),
                created: new Date().toISOString()
            };

            await fs.writeFile(this.sessionFile, JSON.stringify(sessionData, null, 2));
            console.log('💾 Session saved to file');
        } catch (error) {
            console.error('❌ Failed to save session:', error.message);
        }
    }

    /**
     * Manually set session cookie (for testing)
     */
    async setSessionCookie(cookie, hoursValid = 12) {
        this.sessionCookie = cookie;
        this.sessionExpiry = new Date();
        this.sessionExpiry.setHours(this.sessionExpiry.getHours() + hoursValid);
        
        await this.saveSession();
        console.log(`✅ Session manually set, expires: ${this.sessionExpiry.toISOString()}`);
    }

    /**
     * Clear session
     */
    async clearSession() {
        this.sessionCookie = null;
        this.sessionExpiry = null;
        
        try {
            await fs.unlink(this.sessionFile);
            console.log('🗑️ Session cleared');
        } catch (error) {
            // File might not exist
        }
    }
}

// Export singleton instance
export default new BookioSessionManager();