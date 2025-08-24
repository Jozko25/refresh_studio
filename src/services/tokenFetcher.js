import puppeteer from 'puppeteer';

/**
 * Minimal Token Fetcher
 * Only fetches Turnstile tokens, doesn't do full booking automation
 */
class TokenFetcher {
    constructor() {
        this.widgetURL = 'https://services.bookio.com/ai-recepcia-zll65ixf/widget';
    }

    /**
     * Get a fresh Turnstile token using minimal browser automation
     */
    async getFreshTurnstileToken() {
        let browser = null;
        
        try {
            console.log('🎫 Launching browser for token...');
            
            browser = await puppeteer.launch({
                headless: 'new',
                executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor'
                ],
                timeout: 30000
            });

            const page = await browser.newPage();
            
            // Set user agent
            await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36');
            
            console.log('📍 Loading widget page...');
            await page.goto(this.widgetURL, { 
                waitUntil: 'domcontentloaded',
                timeout: 30000 
            });

            console.log('⏳ Debugging page content...');
            
            // Debug: Check what's actually on the page
            const pageContent = await page.evaluate(() => {
                return {
                    title: document.title,
                    url: window.location.href,
                    hasIframes: document.querySelectorAll('iframe').length,
                    iframeSources: Array.from(document.querySelectorAll('iframe')).map(f => f.src),
                    hasTurnstileInput: !!document.querySelector('input[name="cf-turnstile-response"]'),
                    hasTurnstileDiv: !!document.querySelector('div[id*="turnstile"]') || !!document.querySelector('div[class*="turnstile"]'),
                    allInputs: Array.from(document.querySelectorAll('input')).map(i => ({name: i.name, type: i.type, value: i.value?.length || 0}))
                };
            });
            
            console.log('📊 Page debug info:', JSON.stringify(pageContent, null, 2));
            
            // Wait longer and try different selectors
            await new Promise(resolve => setTimeout(resolve, 10000));
            
            console.log('🔍 Looking for token with multiple strategies...');
            
            // Strategy 1: Wait for any iframe (Turnstile loads in iframe)
            try {
                await page.waitForSelector('iframe', { timeout: 20000 });
                console.log('📦 Found iframe(s)');
                await page.waitForTimeout(5000);
            } catch (e) {
                console.log('⚠️ No iframes found');
            }
            
            // Strategy 2: Try multiple token input selectors
            const tokenSelectors = [
                'input[name="cf-turnstile-response"]',
                'input[name*="turnstile"]',
                'input[type="hidden"]'
            ];
            
            let token = null;
            for (const selector of tokenSelectors) {
                console.log(`🔍 Trying selector: ${selector}`);
                
                try {
                    await page.waitForSelector(selector, { timeout: 10000 });
                    
                    token = await page.evaluate((sel) => {
                        const input = document.querySelector(sel);
                        return input ? input.value : null;
                    }, selector);
                    
                    if (token && token.length > 100) {
                        console.log(`✅ Found token with selector ${selector}: ${token.length} chars`);
                        break;
                    }
                } catch (e) {
                    console.log(`❌ Selector ${selector} failed: ${e.message}`);
                }
            }
            
            if (!token) {
                // Final attempt: manual wait and check
                console.log('🕒 Final attempt: waiting 15 seconds...');
                await new Promise(resolve => setTimeout(resolve, 15000));
                
                token = await page.evaluate(() => {
                    const tokenInput = document.querySelector('input[name="cf-turnstile-response"]');
                    return tokenInput ? tokenInput.value : null;
                });
            }

            await browser.close();

            if (token && token.length > 1000) {
                console.log(`✅ Fresh token obtained: ${token.length} chars`);
                return token;
            } else {
                console.log('❌ Invalid token received');
                return null;
            }

        } catch (error) {
            console.error('❌ Error fetching token:', error.message);
            if (browser) {
                await browser.close();
            }
            return null;
        }
    }
}

export default new TokenFetcher();