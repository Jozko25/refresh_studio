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
     * Refresh session by automating browser interaction
     */
    async refreshSession() {
        console.log('🚀 Starting automated session refresh...');
        
        let browser;
        try {
            // Launch Chrome in headless mode
            browser = await puppeteer.launch({
                headless: 'new',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--disable-blink-features=AutomationControlled'
                ]
            });

            const page = await browser.newPage();
            
            // Set realistic user agent
            await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            
            // Navigate to the widget page
            const widgetUrl = 'https://services.bookio.com/refresh-laserove-a-esteticke-studio-zu0yxr5l/widget?lang=sk';
            console.log(`📍 Navigating to ${widgetUrl}`);
            
            await page.goto(widgetUrl, { 
                waitUntil: 'networkidle0',
                timeout: 60000 
            });

            console.log('⏳ Page loaded, intercepting responses to capture cookies...');
            
            // Intercept responses to capture Set-Cookie headers
            let capturedCookie = null;
            
            page.on('response', (response) => {
                const url = response.url();
                if (url.includes('/allowedTimes')) {
                    const setCookieHeaders = response.headers()['set-cookie'] || '';
                    if (setCookieHeaders.includes('bses-0=')) {
                        const match = setCookieHeaders.match(/bses-0=([^;]+)/);
                        if (match) {
                            capturedCookie = match[1];
                            console.log('🎯 Captured session cookie from response!');
                        }
                    }
                }
            });
            
            // Make the key API call that generates/refreshes the session cookie
            const cookieResponse = await page.evaluate(async () => {
                try {
                    // First get services to establish session context
                    const servicesRes = await fetch('/widget/api/services?lang=sk', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            facility: 'refresh-laserove-a-esteticke-studio-zu0yxr5l',
                            categoryId: null,
                            lang: 'sk'
                        })
                    });
                    
                    if (!servicesRes.ok) {
                        throw new Error(`Services API failed: ${servicesRes.status}`);
                    }
                    
                    // Wait a bit
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    // Make allowedTimes call to trigger session cookie refresh
                    const timesRes = await fetch('/widget/api/allowedTimes?lang=sk', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            serviceId: 127325,
                            workerId: -1,
                            date: '22.09.2025 00:00',
                            lang: 'sk',
                            count: 1,
                            participantsCount: 0,
                            addons: []
                        })
                    });
                    
                    return { 
                        success: true, 
                        servicesStatus: servicesRes.status,
                        timesStatus: timesRes.status 
                    };
                } catch (error) {
                    return { success: false, error: error.message };
                }
            });
            
            console.log('🔄 API calls result:', cookieResponse);
            
            // Wait for response interception
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Use captured cookie if we got one
            if (capturedCookie) {
                console.log('✅ Using captured cookie from response headers');
                this.sessionCookie = capturedCookie;
            } else {
                console.log('⚠️ No cookie captured from response, checking page cookies...');
                
                // Get all cookies after API calls
                const cookies = await page.cookies();
                console.log(`🍪 Found ${cookies.length} cookies after API calls`);
                
                // Find the session cookie
                const sessionCookie = cookies.find(c => c.name === 'bses-0');
                
                if (!sessionCookie) {
                    console.log('⚠️ Session cookie not found, available cookies:');
                    cookies.forEach(cookie => {
                        console.log(`  - ${cookie.name}: ${cookie.value.substring(0, 30)}...`);
                    });
                    
                    // Try to find any bses-* cookie
                    const anyBsesCookie = cookies.find(c => c.name.startsWith('bses-'));
                    if (anyBsesCookie) {
                        console.log(`🔍 Using ${anyBsesCookie.name} instead`);
                        this.sessionCookie = anyBsesCookie.value;
                    } else {
                        throw new Error('No session cookie found');
                    }
                } else {
                    this.sessionCookie = sessionCookie.value;
                }
            }

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
            console.log('💡 To get a valid session:');
            console.log('   1. Open https://services.bookio.com/refresh-laserove-a-esteticke-studio-zu0yxr5l/widget?lang=sk');
            console.log('   2. Open DevTools → Application → Cookies');
            console.log('   3. Copy the bses-0 cookie value');
            console.log('   4. POST to /api/session/set with the cookie');
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