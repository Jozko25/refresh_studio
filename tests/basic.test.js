// Basic functionality tests to verify test setup

describe('Basic Test Setup', () => {
  test('should run basic test successfully', () => {
    expect(1 + 1).toBe(2);
  });

  test('should have test environment set', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });

  test('should have test port configured', () => {
    expect(process.env.PORT).toBe('3001');
  });

  test('should support async operations', async () => {
    const promise = Promise.resolve('test');
    const result = await promise;
    expect(result).toBe('test');
  });

  test('should support jest mocking', () => {
    const mockFn = jest.fn();
    mockFn('test');
    expect(mockFn).toHaveBeenCalledWith('test');
  });
});

// Test the fixtures
describe('Test Fixtures', () => {
  test('should load test fixtures', async () => {
    const { mockServices } = await import('./fixtures/bookioResponses.js');
    
    expect(mockServices.success).toBe(true);
    expect(mockServices.services).toHaveLength(1);
    expect(mockServices.services[0].id).toBe(130113);
  });
});

// Test axios mocking
describe('Axios Mocking', () => {
  test('should mock axios successfully', async () => {
    const axios = await import('axios');
    jest.mock('axios');
    
    const mockedAxios = axios.default;
    mockedAxios.post = jest.fn().mockResolvedValue({
      data: { success: true, message: 'mocked response' }
    });
    
    const response = await mockedAxios.post('/test', {});
    expect(response.data.success).toBe(true);
  });
});