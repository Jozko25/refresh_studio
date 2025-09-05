// Jest setup file
// This file runs before each test suite

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.BOOKIO_ENV = 'test';

// Mock console methods in test environment to reduce noise
if (process.env.NODE_ENV === 'test') {
    global.console = {
        ...console,
        // Keep error and warn for debugging
        error: jest.fn(),
        warn: jest.fn(),
        // Mock info and log to reduce test output noise
        info: jest.fn(),
        log: jest.fn(),
    };
}