// Basic test to ensure Jest configuration works
describe('Test Suite Setup', () => {
    test('should pass basic test', () => {
        expect(1 + 1).toBe(2);
    });
    
    test('should have test environment set', () => {
        expect(process.env.NODE_ENV).toBe('test');
    });
});