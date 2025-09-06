import bookioAuthService from './src/services/bookioAuthService.js';
import https from 'https';

async function testNewCredentials() {
    console.log('🔐 TESTING NEW REFRESH CREDENTIALS');
    console.log('===================================\n');
    
    try {
        // Force fresh login (ignore cached tokens)
        console.log('🔄 Forcing fresh authentication...');
        await bookioAuthService.forceRefresh();
        
        const cookieHeader = await bookioAuthService.getCookieHeader();
        console.log('✅ Fresh authentication successful\n');
        
        // Test the REFRESH facility
        const facility = 'refresh-laserove-a-esteticke-studio-zu0yxr5l';
        console.log(`🏢 Testing REFRESH facility: ${facility}`);
        
        const testData = { "facility": facility };
        const postData = JSON.stringify(testData);
        
        const result = await new Promise((resolve, reject) => {
            const options = {
                hostname: 'services.bookio.com',
                port: 443,
                path: `/client-admin/api/schedule/services`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData),
                    'Cookie': cookieHeader,
                    'Accept': 'application/json, text/plain, */*',
                    'X-Requested-With': 'XMLHttpRequest',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                }
            };
            
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    console.log(`📍 Response Status: ${res.statusCode}`);
                    try {
                        const json = JSON.parse(data);
                        resolve({ status: res.statusCode, data: json });
                    } catch (e) {
                        resolve({ status: res.statusCode, data: data });
                    }
                });
            });
            
            req.on('error', reject);
            req.write(postData);
            req.end();
        });
        
        if (result.status === 200 && result.data && result.data.data) {
            console.log(`🎉 SUCCESS! REFRESH facility access confirmed`);
            console.log(`📊 Found ${result.data.data.length} services available\n`);
            
            // Show hydrafacial services
            const hydrafacialServices = result.data.data.filter(s => 
                s.label.toLowerCase().includes('hydra')
            );
            
            if (hydrafacialServices.length > 0) {
                console.log('💧 Hydrafacial Services Available:');
                hydrafacialServices.forEach(service => {
                    console.log(`   • ${service.label} (ID: ${service.id}) - ${service.price}€`);
                });
                console.log('');
            }
            
            console.log('✅ Ready for production booking!');
            
        } else if (result.data && result.data.notAuthorized) {
            console.log('❌ Still not authorized - credentials may be incorrect');
        } else {
            console.log(`⚠️ Unexpected response: ${JSON.stringify(result.data).substring(0, 200)}`);
        }
        
        await bookioAuthService.closeBrowser();
        
    } catch (error) {
        console.error('❌ Authentication failed:', error.message);
        await bookioAuthService.closeBrowser();
    }
}

testNewCredentials().catch(console.error);