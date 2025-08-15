/**
 * Global error handling middleware
 */
export const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Default error
  let error = {
    success: false,
    error: 'Internal Server Error',
    timestamp: new Date().toISOString()
  };

  // Validation errors
  if (err.name === 'ValidationError') {
    error.error = 'Validation Error';
    error.details = err.message;
    return res.status(400).json(error);
  }

  // Axios errors (API calls to Bookio)
  if (err.isAxiosError) {
    error.error = 'External API Error';
    error.details = err.response?.data || err.message;
    const statusCode = err.response?.status || 500;
    return res.status(statusCode).json(error);
  }

  // JSON parsing errors
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    error.error = 'Invalid JSON';
    error.details = 'Request body contains invalid JSON';
    return res.status(400).json(error);
  }

  // Default 500 error
  if (process.env.NODE_ENV === 'development') {
    error.details = err.message;
    error.stack = err.stack;
  }

  res.status(500).json(error);
};

export default errorHandler;
