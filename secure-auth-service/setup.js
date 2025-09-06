import CryptoJS from 'crypto-js';
import fs from 'fs/promises';
import readline from 'readline';
import crypto from 'crypto';

/**
 * Secure Setup Script for Auth Service
 * Encrypts credentials and generates secure keys
 */

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

async function setup() {
    console.log('🔒 SECURE AUTH SERVICE SETUP\n');
    console.log('This script will help you securely configure the auth service.\n');
    
    try {
        // Generate master key if needed
        console.log('Step 1: Master Key');
        const generateNew = await question('Generate new master key? (y/n): ');
        
        let masterKey;
        if (generateNew.toLowerCase() === 'y') {
            masterKey = crypto.randomBytes(32).toString('hex');
            console.log('\n⚠️  IMPORTANT: Save this master key securely!');
            console.log(`MASTER_KEY=${masterKey}\n`);
        } else {
            masterKey = await question('Enter your master key: ');
        }
        
        // Get credentials
        console.log('\nStep 2: Bookio Credentials');
        const username = await question('Enter Bookio username: ');
        const password = await question('Enter Bookio password: ');
        
        // Encrypt credentials
        const encryptedUsername = CryptoJS.AES.encrypt(username, masterKey).toString();
        const encryptedPassword = CryptoJS.AES.encrypt(password, masterKey).toString();
        
        // Generate API key
        console.log('\nStep 3: API Security');
        const apiKey = crypto.randomBytes(32).toString('hex');
        console.log(`Generated API Key: ${apiKey}`);
        
        // Get Railway URL
        console.log('\nStep 4: Railway Configuration');
        const railwayUrl = await question('Enter Railway app URL (or press Enter for default): ');
        const finalUrl = railwayUrl || 'https://refreshstudio-production.up.railway.app';
        
        // Create .env file
        const envContent = `# SECURITY CONFIGURATION
MASTER_KEY=${masterKey}
API_KEY=${apiKey}
SERVICE_PORT=3001

# ENCRYPTED CREDENTIALS (encrypted with master key)
ENCRYPTED_USERNAME=${encryptedUsername}
ENCRYPTED_PASSWORD=${encryptedPassword}

# RAILWAY CONFIGURATION
RAILWAY_API_URL=${finalUrl}/api/auth/update-cookie
RAILWAY_API_KEY=${apiKey}

# SECURITY SETTINGS
ALLOWED_IPS=127.0.0.1
MAX_REQUESTS_PER_HOUR=10
ENABLE_AUDIT_LOG=true

# REFRESH SCHEDULE (in hours)
REFRESH_INTERVAL_HOURS=11

# EMAIL ALERTS
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=janko.tank.poi@gmail.com
SMTP_PASS=zhtvdvqsqfavktzb
ALERT_EMAIL=janko.tank.poi@gmail.com

# FACILITIES
FACILITY_BRATISLAVA=refresh-laserove-a-esteticke-studio-zu0yxr5l
FACILITY_PEZINOK=refresh-laserove-a-esteticke-studio
`;
        
        await fs.writeFile('.env', envContent);
        
        console.log('\n✅ Setup complete!');
        console.log('\n📋 Next steps:');
        console.log('1. Add this API key to Railway environment variables:');
        console.log(`   AUTH_SERVICE_API_KEY=${apiKey}`);
        console.log('2. Run: npm install');
        console.log('3. Run: npm start');
        console.log('\n⚠️  IMPORTANT SECURITY NOTES:');
        console.log('- Keep .env file secure and never commit it');
        console.log('- Store master key in a password manager');
        console.log('- Run this service on a secure machine');
        console.log('- Use VPN or firewall to restrict access');
        
    } catch (error) {
        console.error('❌ Setup failed:', error);
    } finally {
        rl.close();
    }
}

setup();