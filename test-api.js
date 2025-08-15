import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_BASE = 'http://localhost:3000/api/booking';
const BOOKIO_API = 'https://services.bookio.com/widget/api';

// Test the Bookio API directly first
async function testBookioDirectly() {
  console.log('🧪 Testing Bookio API directly...');
  
  try {
    const payload = {
      serviceId: 130113,
      workerId: 31576,
      addons: [],
      count: 1,
      participantsCount: 0
    };

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/plain, */*',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
      'Origin': 'https://services.bookio.com',
      'Referer': 'https://services.bookio.com/16052/widget',
      'X-Requested-With': 'XMLHttpRequest'
    };

    const response = await axios.post(`${BOOKIO_API}/allowedDays?lang=en`, payload, { headers });
    console.log('✅ Direct Bookio API call successful');
    console.log('📊 Allowed days response:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Direct Bookio API call failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    return false;
  }
}

// Test our API endpoints
async function testOurAPI() {
  console.log('\\n🧪 Testing our API endpoints...');
  
  const tests = [
    {
      name: 'Health Check',
      method: 'GET',
      url: 'http://localhost:3000/health'
    },
    {
      name: 'Get Services',
      method: 'GET',
      url: `${API_BASE}/services`
    },
    {
      name: 'Get Allowed Days',
      method: 'POST',
      url: `${API_BASE}/allowed-days`,
      data: {
        serviceId: 130113,
        workerId: 31576,
        count: 1,
        participantsCount: 0,
        addons: []
      }
    },
    {
      name: 'Get Allowed Times',
      method: 'POST',
      url: `${API_BASE}/allowed-times`,
      data: {
        serviceId: 130113,
        workerId: 31576,
        date: "15.08.2025 10:22",
        count: 1,
        participantsCount: 0,
        addons: []
      }
    },
    {
      name: 'Soonest Available (Webhook)',
      method: 'POST',
      url: `${API_BASE}/webhook/soonest-available`,
      data: {
        serviceId: 130113,
        workerId: 31576,
        daysToCheck: 7,
        source: 'test-script'
      }
    }
  ];

  for (const test of tests) {
    try {
      console.log(`\\n🔄 Testing: ${test.name}`);
      
      let response;
      if (test.method === 'GET') {
        response = await axios.get(test.url);
      } else {
        response = await axios.post(test.url, test.data);
      }
      
      console.log(`✅ ${test.name} - Status: ${response.status}`);
      console.log('📊 Response:', JSON.stringify(response.data, null, 2));
      
    } catch (error) {
      console.error(`❌ ${test.name} failed:`, error.message);
      if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Data:', error.response.data);
      }
    }
  }
}

// Main test function
async function runTests() {
  console.log('🚀 Starting API tests...\\n');
  
  // Test direct Bookio API first
  const bookioWorking = await testBookioDirectly();
  
  if (bookioWorking) {
    console.log('\\n✅ Bookio API is accessible, proceeding with our API tests...');
    
    // Wait a moment for server to be ready
    console.log('\\n⏳ Waiting for server to start (please start with: npm run dev)...');
    
    // Test our API after a delay
    setTimeout(async () => {
      await testOurAPI();
      console.log('\\n🎉 Testing complete!');
    }, 2000);
    
  } else {
    console.log('\\n❌ Bookio API is not accessible. Check network connection or API endpoints.');
  }
}

runTests().catch(console.error);
