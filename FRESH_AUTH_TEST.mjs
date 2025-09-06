import { chromium } from 'playwright';

async function testManualLogin() {
    console.log('🔐 MANUAL REFRESH CREDENTIALS TEST');
    console.log('==================================\n');
    
    const browser = await chromium.launch({
        headless: false,  // Show browser to see what happens
        slowMo: 1000      // Slow down to observe
    });
    
    try {
        const context = await browser.newContext({
            viewport: { width: 1920, height: 1080 }
        });
        
        const page = await context.newPage();
        
        console.log('🌐 Navigating to Bookio login...');
        await page.goto('https://services.bookio.com/auth/login');
        
        console.log('📝 Filling REFRESH credentials...');
        
        // Fill credentials from .env
        await page.fill('input[name="username"]', 'jurkovicova.jana@gmail.com');
        await page.fill('input[type="password"]', 'Jurkovicova1');
        
        console.log('🔄 Submitting login...');
        await page.click('input[type="submit"]');
        
        // Wait for navigation
        await page.waitForLoadState('networkidle', { timeout: 15000 });
        
        console.log('🍪 Checking cookies...');
        const cookies = await context.cookies();
        const bsesCookie = cookies.find(c => c.name === 'bses-0');
        
        if (bsesCookie) {
            console.log('✅ Successfully got bses-0 cookie');
            console.log(`   Cookie value: ${bsesCookie.value.substring(0, 50)}...`);
            
            // Test access to REFRESH facility
            console.log('\\n🏢 Testing REFRESH facility access...');
            
            await page.goto('https://services.bookio.com/client-admin/refresh-laserove-a-esteticke-studio-zu0yxr5l/schedule');
            await page.waitForLoadState('networkidle', { timeout: 10000 });
            
            const currentUrl = page.url();
            console.log(`📍 Current URL: ${currentUrl}`);
            
            if (currentUrl.includes('refresh-laserove-a-esteticke-studio-zu0yxr5l')) {
                console.log('🎉 SUCCESS! Access to REFRESH facility confirmed!');
                console.log('✅ Credentials are working correctly');
            } else {
                console.log('❌ No access to REFRESH facility');
                console.log('⚠️  User may not have admin rights for this facility');
            }
            
        } else {
            console.log('❌ No bses-0 cookie found after login');
            console.log('⚠️  Login may have failed');
        }
        
        console.log('\\n⏸️  Browser will stay open for 10 seconds for inspection...');
        await page.waitForTimeout(10000);
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    } finally {
        await browser.close();
    }
}

testManualLogin().catch(console.error);