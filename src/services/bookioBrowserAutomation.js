import { chromium } from 'playwright';
import { faker } from '@faker-js/faker';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

/**
 * Bookio Browser Automation Service
 * Uses Playwright with persistent browser context to simulate real user
 */
class BookioBrowserAutomation {
    constructor() {
        this.widgetURL = 'https://services.bookio.com/ai-recepcia-zll65ixf/widget';
        this.userDataDir = path.join(os.homedir(), '.bookio-browser-profile');
        this.browser = null;
        this.context = null;
        this.page = null;
    }

    /**
     * Initialize browser with persistent profile
     */
    async initBrowser(options = {}) {
        try {
            console.log('🌐 Launching browser with persistent profile...');
            
            // Ensure user data directory exists
            await fs.mkdir(this.userDataDir, { recursive: true });

            // Launch browser with real user profile
            this.context = await chromium.launchPersistentContext(this.userDataDir, {
                headless: false, // Run in headed mode to appear more real
                viewport: { width: 1920, height: 1080 },
                locale: 'sk-SK',
                timezoneId: 'Europe/Bratislava',
                permissions: ['geolocation'],
                colorScheme: 'light',
                deviceScaleFactor: 1,
                ...options,
                args: [
                    '--disable-blink-features=AutomationControlled',
                    '--disable-features=IsolateOrigins,site-per-process',
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-infobars',
                    '--window-size=1920,1080',
                    '--start-maximized',
                    '--disable-web-security',
                    '--disable-dev-shm-usage',
                    '--no-first-run',
                    '--disable-gpu'
                ],
                // Use real Chrome executable if available
                executablePath: process.platform === 'darwin' 
                    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
                    : undefined
            });

            console.log('✅ Browser launched with persistent profile');
            return true;

        } catch (error) {
            console.error('❌ Failed to launch browser:', error);
            return false;
        }
    }

    /**
     * Simulate human-like typing
     */
    async humanType(element, text) {
        for (const char of text) {
            await element.type(char, { 
                delay: faker.number.int({ min: 50, max: 200 }) 
            });
            
            // Occasionally pause like a human would
            if (Math.random() < 0.1) {
                await this.wait(faker.number.int({ min: 300, max: 800 }));
            }
        }
    }

    /**
     * Simulate human-like mouse movement and click
     */
    async humanClick(page, selector) {
        const element = await page.$(selector);
        if (!element) return false;

        const box = await element.boundingBox();
        if (!box) return false;

        // Move mouse to element with some randomness
        const x = box.x + box.width / 2 + faker.number.int({ min: -5, max: 5 });
        const y = box.y + box.height / 2 + faker.number.int({ min: -5, max: 5 });

        // Simulate mouse movement
        await page.mouse.move(x, y, { steps: faker.number.int({ min: 5, max: 15 }) });
        await this.wait(faker.number.int({ min: 100, max: 300 }));
        
        // Click
        await page.mouse.click(x, y);
        return true;
    }

    /**
     * Random wait to simulate human behavior
     */
    async wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Complete booking process with human-like behavior
     */
    async completeBooking(bookingData) {
        try {
            const {
                serviceId,
                date,
                time,
                firstName,
                lastName,
                email,
                phone,
                note = ""
            } = bookingData;

            console.log('🤖 Starting automated booking process...');

            // Create new page
            this.page = await this.context.newPage();

            // Add some random browser activity first (to build history)
            console.log('📱 Building browser history...');
            await this.page.goto('https://www.google.com');
            await this.wait(faker.number.int({ min: 1000, max: 2000 }));
            
            // Navigate to widget
            console.log('📍 Navigating to booking widget...');
            await this.page.goto(this.widgetURL, { 
                waitUntil: 'networkidle',
                timeout: 60000 
            });

            // Wait for page to fully load
            await this.wait(faker.number.int({ min: 3000, max: 5000 }));

            // Scroll around a bit like a human would
            await this.page.evaluate(() => {
                window.scrollTo(0, 300);
            });
            await this.wait(faker.number.int({ min: 1000, max: 2000 }));
            await this.page.evaluate(() => {
                window.scrollTo(0, 0);
            });

            console.log('🔍 Looking for service selection...');
            
            // Step 1: Select service (you'll need to adapt selectors based on actual page)
            // This is where you'd implement the actual form filling logic
            // For now, this is a template showing the approach

            // Wait for service list to load
            await this.page.waitForSelector('[data-testid="service-list"], .service-item, button[class*="service"]', {
                timeout: 30000
            });

            // Find and click the service
            const serviceSelector = `[data-service-id="${serviceId}"], button:has-text("${serviceId}")`;
            const serviceClicked = await this.humanClick(this.page, serviceSelector);
            
            if (!serviceClicked) {
                console.log('⚠️ Service not found, trying alternative selectors...');
                // Try alternative approaches
            }

            await this.wait(faker.number.int({ min: 2000, max: 3000 }));

            // Step 2: Select date
            console.log('📅 Selecting date...');
            // Implementation depends on actual calendar widget

            // Step 3: Select time
            console.log('⏰ Selecting time...');
            // Implementation depends on actual time picker

            // Step 4: Fill personal information
            console.log('👤 Filling personal information...');
            
            const firstNameInput = await this.page.$('input[name="firstName"], input[placeholder*="Meno"]');
            if (firstNameInput) {
                await this.humanType(firstNameInput, firstName);
            }

            await this.wait(faker.number.int({ min: 500, max: 1000 }));

            const lastNameInput = await this.page.$('input[name="lastName"], input[placeholder*="Priezvisko"]');
            if (lastNameInput) {
                await this.humanType(lastNameInput, lastName);
            }

            await this.wait(faker.number.int({ min: 500, max: 1000 }));

            const emailInput = await this.page.$('input[name="email"], input[type="email"]');
            if (emailInput) {
                await this.humanType(emailInput, email);
            }

            await this.wait(faker.number.int({ min: 500, max: 1000 }));

            const phoneInput = await this.page.$('input[name="phone"], input[type="tel"]');
            if (phoneInput) {
                await this.humanType(phoneInput, phone);
            }

            // Step 5: Handle Turnstile
            console.log('🔐 Waiting for Turnstile to appear...');
            
            // Check if Turnstile iframe appears
            const turnstileFrame = await this.page.waitForSelector('iframe[src*="challenges.cloudflare.com"], iframe[title*="Turnstile"]', {
                timeout: 10000
            }).catch(() => null);

            if (turnstileFrame) {
                console.log('⏳ Turnstile detected, waiting for automatic verification...');
                
                // Turnstile often auto-verifies for real browsers
                // Wait for it to complete
                await this.page.waitForFunction(
                    () => {
                        const input = document.querySelector('input[name="cf-turnstile-response"]');
                        return input && input.value && input.value.length > 100;
                    },
                    { timeout: 30000 }
                );
                
                console.log('✅ Turnstile verified!');
            }

            // Step 6: Submit booking
            console.log('🚀 Submitting booking...');
            
            const submitButton = await this.page.$('button[type="submit"], button:has-text("Rezervovať"), button:has-text("Potvrdiť")');
            if (submitButton) {
                await this.humanClick(this.page, 'button[type="submit"]');
            }

            // Wait for confirmation
            await this.page.waitForSelector('.success-message, .confirmation, [data-testid="booking-success"]', {
                timeout: 30000
            });

            console.log('✅ Booking completed successfully!');

            // Extract confirmation details
            const confirmationText = await this.page.textContent('body');
            
            return {
                success: true,
                message: 'Booking completed',
                confirmation: confirmationText.substring(0, 500) // First 500 chars
            };

        } catch (error) {
            console.error('❌ Booking automation failed:', error);
            
            // Take screenshot for debugging
            if (this.page) {
                const screenshotPath = path.join(os.tmpdir(), `booking-error-${Date.now()}.png`);
                await this.page.screenshot({ path: screenshotPath, fullPage: true });
                console.log(`📸 Screenshot saved: ${screenshotPath}`);
            }

            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Close browser
     */
    async close() {
        if (this.page) await this.page.close();
        if (this.context) await this.context.close();
    }

    /**
     * Keep session alive by periodic activity
     */
    async keepAlive() {
        if (!this.page) return;

        // Move mouse randomly
        const x = faker.number.int({ min: 100, max: 1000 });
        const y = faker.number.int({ min: 100, max: 500 });
        await this.page.mouse.move(x, y);

        // Occasionally scroll
        if (Math.random() < 0.3) {
            await this.page.evaluate(() => {
                window.scrollBy(0, Math.random() * 200 - 100);
            });
        }
    }
}

export default BookioBrowserAutomation;