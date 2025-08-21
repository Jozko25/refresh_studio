import { errorHandler } from '../../src/middleware/errorHandler.js';

describe('Error Handler Middleware', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockNext = jest.fn();
    console.error = jest.fn(); // Mock console.error
  });

  test('should handle generic errors', () => {
    const error = new Error('Test error');
    
    errorHandler(error, mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: 'Internal Server Error',
      timestamp: expect.any(String)
    });
    expect(console.error).toHaveBeenCalledWith('Error:', error);
  });

  test('should handle validation errors', () => {
    const error = new Error('Validation failed');
    error.name = 'ValidationError';
    
    errorHandler(error, mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: 'Validation Error',
      details: 'Validation failed',
      timestamp: expect.any(String)
    });
  });

  test('should handle axios errors with response', () => {
    const error = new Error('API Error');
    error.isAxiosError = true;
    error.response = { status: 404, data: { message: 'Not found' } };
    
    errorHandler(error, mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(404);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: 'External API Error',
      details: { message: 'Not found' },
      timestamp: expect.any(String)
    });
  });

  test('should handle axios errors without response', () => {
    const error = new Error('Network Error');
    error.isAxiosError = true;
    
    errorHandler(error, mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: 'External API Error',
      details: 'Network Error',
      timestamp: expect.any(String)
    });
  });

  test('should handle JSON parsing errors', () => {
    const error = new SyntaxError('Unexpected token');
    error.status = 400;
    error.body = 'invalid json';
    
    errorHandler(error, mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: 'Invalid JSON',
      details: 'Request body contains invalid JSON',
      timestamp: expect.any(String)
    });
  });

  test('should log error details', () => {
    const error = new Error('Test error');
    error.stack = 'Error stack trace';
    
    errorHandler(error, mockReq, mockRes, mockNext);

    expect(console.error).toHaveBeenCalledWith('Error:', error);
  });

  test('should include timestamp in response', () => {
    const error = new Error('Test error');
    
    errorHandler(error, mockReq, mockRes, mockNext);

    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
      })
    );
  });

  test('should always return success: false', () => {
    const error = new Error('Test error');
    
    errorHandler(error, mockReq, mockRes, mockNext);

    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false
      })
    );
  });

  test('should handle errors without message', () => {
    const error = {};
    
    errorHandler(error, mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: 'Internal Server Error',
      timestamp: expect.any(String)
    });
  });

  test('should include details in development mode', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    
    const error = new Error('Test error in dev');
    error.stack = 'Error: Test error\n    at test (file.js:1:1)';
    
    errorHandler(error, mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: 'Internal Server Error',
      details: 'Test error in dev',
      stack: 'Error: Test error\n    at test (file.js:1:1)',
      timestamp: expect.any(String)
    });

    process.env.NODE_ENV = originalNodeEnv;
  });
});