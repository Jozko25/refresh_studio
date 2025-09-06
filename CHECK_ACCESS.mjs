import bookioAuthService from './src/services/bookioAuthService.js';
import https from 'https';

async function checkFacilityAccess() {
    console.log('🔍 CHECKING FACILITY ACCESS');
    console.log('===========================\n');
    
    try {
        // Initialize auth
        await bookioAuthService.initialize();
        const cookieHeader = await bookioAuthService.getCookieHeader();
        
        console.log('✅ Authentication successful\n');
        
        // Try different facility endpoints to see which ones work
        const facilities = [
            'ai-recepcia-zll65ixf',
            'refresh-laserove-a-esteticke-studio',
            'refresh-laserove-a-esteticke-studio-zu0yxr5l'
        ];
        
        for (const facility of facilities) {
            console.log(`🏢 Testing facility: ${facility}`);
            
            try {
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
                    console.log(`   ✅ AUTHORIZED - Found ${result.data.data.length} services`);
                    
                    // Show first few services
                    if (result.data.data.length > 0) {
                        console.log(`   📋 Sample services:`);
                        result.data.data.slice(0, 3).forEach(service => {
                            console.log(`      - ${service.label}`);
                        });
                    }
                } else if (result.data && result.data.notAuthorized) {
                    console.log(`   ❌ NOT AUTHORIZED`);
                } else {
                    console.log(`   ⚠️  Status ${result.status}: ${JSON.stringify(result.data).substring(0, 100)}`);
                }
                
            } catch (error) {
                console.log(`   ❌ ERROR: ${error.message}`);
            }
            
            console.log('');
        }
        
        await bookioAuthService.closeBrowser();
        
    } catch (error) {
        console.error('❌ Failed to check access:', error.message);
    }
}

checkFacilityAccess().catch(console.error);