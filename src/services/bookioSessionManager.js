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
     * Refresh session by logging into Bookio widget
     */
    async refreshSession() {
        console.log('🚀 Starting Puppeteer session refresh...');
        
        let browser;
        try {
            browser = await puppeteer.launch({
                headless: 'new',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu'
                ]
            });

            const page = await browser.newPage();
            
            // Navigate to the widget page
            const widgetUrl = 'https://services.bookio.com/refresh-laserove-a-esteticke-studio-zu0yxr5l/widget?lang=sk';
            console.log(`📍 Navigating to ${widgetUrl}`);
            
            await page.goto(widgetUrl, { 
                waitUntil: 'networkidle2',
                timeout: 30000 
            });

            // Wait a bit for any dynamic content to load
            await page.waitForTimeout(3000);

            // Get all cookies
            const cookies = await page.cookies();
            
            // Find the session cookie
            const sessionCookie = cookies.find(c => c.name === 'bses-0');
            
            if (!sessionCookie) {
                throw new Error('Session cookie not found');
            }

            console.log('✅ Got session cookie:', sessionCookie.value.substring(0, 50) + '...');

            // Store the cookie with 12-hour expiry
            const expiry = new Date();
            expiry.setHours(expiry.getHours() + 12);

            this.sessionCookie = sessionCookie.value;
            this.sessionExpiry = expiry;

            // Save to file
            await this.saveSession();

            return this.sessionCookie;

        } catch (error) {
            console.error('❌ Failed to refresh session:', error.message);
            throw error;
        } finally {
            if (browser) {
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