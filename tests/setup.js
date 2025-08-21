import dotenv from 'dotenv';

// Load environment variables for testing
dotenv.config({ path: '.env.test' });

// Set default test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.BOOKIO_BASE_URL = 'https://services.bookio.com';
process.env.BOOKIO_FACILITY_ID = '16052';

// Global test timeout
jest.setTimeout(30000);

// Suppress console logs during tests unless explicitly needed
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

beforeEach(() => {
  console.log = jest.fn();
  console.error = jest.fn();
});

afterEach(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
});