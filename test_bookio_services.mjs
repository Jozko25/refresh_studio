import https from 'https';

// Session token from the provided network request
const SESSION_TOKEN = 'Pa9RgfSIm3B1quRYAv5CDJ3MrRrH8BHhweoz19TA45r3owgfBM14KV7ROr0QuHqGtAuePTMK9aaCCrF7USfZ1wVIxtpMu2DXtY1ILOzMXc91oScxJtldKs3a4s9rY4VhfqLkrwh+M0WlpxFSHbRPw1jMxLCHPhstrwr9lh9j2aDIh1S30QOjtZE+JYV4lg/LF46QEgTMTCsp7Udt6QY1GMzYehiirECN4JOR01YUwReYxl1sdR0fTs83YbVa6oXkHFDyKAxuy9CUllh0f7HdTP0ym6PJf8DNHRTwGuo5OeylOO+qwVuyNKZQ0X1AAMJ9YlYIDUU0UbDsUUre/dgsbbP3nqK0h+QFL+5P4G0o8AqXGpNZNuGcEwmEiCotD3RYHcjTSJcyZT1BQR8G9hECYj0zZWUyJudpOULdDSsuTqLs4DbYwZ9mmo0HQ5nGFAI1I0cOBT369h72Ll16MVmKBmDzOYpbXpy1XyCMZG5CaxSv2uMNTxMGIQNV17qZxDhn';

const FACILITY_SLUG = 'refresh-laserove-a-esteticke-studio-zu0yxr5l';

// Function to make API request
function makeBookioRequest(path, data) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(data);
        
        const options = {
            hostname: 'services.bookio.com',
            port: 443,
            path: `/client-admin/api${path}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                'Cookie': `bses-0=${SESSION_TOKEN}`,
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9,sk;q=0.8',
                'X-Requested-With': 'XMLHttpRequest',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
                'Origin': 'https://services.bookio.com',
                'Referer': `https://services.bookio.com/client-admin/${FACILITY_SLUG}/schedule`,
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-origin'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            
            console.log(`📍 Status: ${res.statusCode}`);
            
            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json);
                } catch (e) {
                    resolve(data);
                }
            });
        });

        req.on('error', (e) => {
            reject(e);
        });

        req.write(postData);
        req.end();
    });
}

async function analyzeServices() {
    console.log('========================================');
    console.log('🔬 REFRESH STUDIO - SERVICE ANALYSIS');
    console.log('========================================\n');

    try {
        // Fetch all services
        console.log('📋 FETCHING ALL SERVICES...\n');
        
        const servicesPayload = {
            "facility": FACILITY_SLUG
        };
        
        const response = await makeBookioRequest('/schedule/services', servicesPayload);
        
        if (response && response.data) {
            const services = response.data;
            console.log(`✅ Found ${services.length} total services\n`);
            
            // Categorize services
            const hydrafacialServices = [];
            const laserServices = [];
            const skinServices = [];
            const otherServices = [];
            
            services.forEach(service => {
                const name = service.label || service.labelFull || '';
                const nameLower = name.toLowerCase();
                
                if (nameLower.includes('hydra') || nameLower.includes('facial')) {
                    hydrafacialServices.push(service);
                } else if (nameLower.includes('laser') || nameLower.includes('epilá')) {
                    laserServices.push(service);
                } else if (nameLower.includes('pleť') || nameLower.includes('skin') || nameLower.includes('tvár')) {
                    skinServices.push(service);
                } else {
                    otherServices.push(service);
                }
            });
            
            // Display categorized services
            console.log('💧 HYDRAFACIAL & FACIAL SERVICES:');
            console.log('----------------------------------');
            hydrafacialServices.slice(0, 10).forEach(s => {
                console.log(`ID: ${s.id} | ${s.label}`);
                console.log(`   💰 ${s.price}€ | ⏱️ ${s.duration} min | Worker: ${s.resObjects?.[0]?.label || 'Any'}\n`);
            });
            
            console.log('\n⚡ LASER SERVICES:');
            console.log('----------------------------------');
            laserServices.slice(0, 10).forEach(s => {
                console.log(`ID: ${s.id} | ${s.label}`);
                console.log(`   💰 ${s.price}€ | ⏱️ ${s.duration} min | Worker: ${s.resObjects?.[0]?.label || 'Any'}\n`);
            });
            
            console.log('\n🌸 SKIN TREATMENTS:');
            console.log('----------------------------------');
            skinServices.slice(0, 10).forEach(s => {
                console.log(`ID: ${s.id} | ${s.label}`);
                console.log(`   💰 ${s.price}€ | ⏱️ ${s.duration} min | Worker: ${s.resObjects?.[0]?.label || 'Any'}\n`);
            });
            
            // Find workers from services
            const workers = new Set();
            services.forEach(s => {
                if (s.resObjects && s.resObjects.length > 0) {
                    s.resObjects.forEach(obj => {
                        if (obj.label) workers.add(obj.label);
                    });
                }
            });
            
            console.log('\n👥 AVAILABLE STAFF:');
            console.log('----------------------------------');
            Array.from(workers).forEach(worker => {
                console.log(`• ${worker}`);
            });
            
            // Save service IDs for booking
            console.log('\n\n📌 KEY SERVICE IDs FOR TESTING:');
            console.log('----------------------------------');
            if (hydrafacialServices.length > 0) {
                console.log(`Hydrafacial Service ID: ${hydrafacialServices[0].id}`);
            }
            if (laserServices.length > 0) {
                console.log(`Laser Service ID: ${laserServices[0].id}`);
            }
            
            // Export for booking tests
            console.log('\n\n💾 SAVING SERVICE DATA...');
            const serviceData = {
                facility: FACILITY_SLUG,
                hydrafacial: hydrafacialServices[0] || null,
                laser: laserServices[0] || null,
                workers: Array.from(workers),
                totalServices: services.length
            };
            
            // Save to file for booking script
            await import('fs').then(fs => {
                fs.promises.writeFile(
                    'bookio_service_data.json',
                    JSON.stringify(serviceData, null, 2)
                );
            });
            
            console.log('✅ Service data saved to bookio_service_data.json');
            
        } else {
            console.log('❌ No services data received');
            console.log('Response:', JSON.stringify(response, null, 2).substring(0, 1000));
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }

    console.log('\n========================================');
    console.log('✅ ANALYSIS COMPLETE - NO CHANGES MADE');
    console.log('========================================');
}

// Run the analysis
analyzeServices();