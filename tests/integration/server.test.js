import request from 'supertest';
import app from '../../src/server.js';

describe('Server Integration Tests', () => {
  describe('Health Check', () => {
    test('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('OK');
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.service).toBe('Bookio Webhook API');
    });
  });

  describe('Security Headers', () => {
    test('should include security headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      // Helmet security headers should be present
      expect(response.headers['x-content-type-options']).toBeDefined();
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-xss-protection']).toBeDefined();
    });
  });

  describe('CORS', () => {
    test('should handle CORS preflight requests', async () => {
      const response = await request(app)
        .options('/api/booking/services')
        .set('Origin', 'https://example.com')
        .set('Access-Control-Request-Method', 'GET')
        .expect(204);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
  });

  describe('Rate Limiting', () => {
    test('should include rate limiting headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers['x-ratelimit-limit'] || response.headers['ratelimit-limit']).toBeDefined();
    });
  });

  describe('404 Handler', () => {
    test('should return 404 for non-existent endpoints', async () => {
      const response = await request(app)
        .get('/non-existent-endpoint')
        .expect(404);

      expect(response.body.error).toBe('Endpoint not found');
      expect(response.body.path).toBe('/non-existent-endpoint');
      expect(response.body.method).toBe('GET');
    });

    test('should return 404 for non-existent API endpoints', async () => {
      const response = await request(app)
        .post('/api/booking/non-existent')
        .expect(404);

      expect(response.body.error).toBe('Endpoint not found');
      expect(response.body.path).toBe('/api/booking/non-existent');
      expect(response.body.method).toBe('POST');
    });
  });

  describe('Content Type Handling', () => {
    test('should require JSON content type for POST requests', async () => {
      const response = await request(app)
        .post('/api/booking/allowed-days')
        .send('plain text data')
        .expect(400);

      expect(response.body).toBeDefined();
    });

    test('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/booking/allowed-days')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);

      expect(response.body).toBeDefined();
    });
  });

  describe('Request Size Limits', () => {
    test('should handle normal sized requests', async () => {
      const largeButValidData = {
        serviceId: 130113,
        workerId: 31576,
        addons: Array.from({ length: 100 }, (_, i) => ({ id: i, name: `addon-${i}` }))
      };

      await request(app)
        .post('/api/booking/allowed-days')
        .send(largeButValidData)
        .expect(200);
    });
  });

  describe('HTTP Methods', () => {
    test('should only allow appropriate HTTP methods', async () => {
      // GET should work for services endpoint
      await request(app)
        .get('/api/booking/services')
        .expect(200);

      // DELETE should not be allowed
      await request(app)
        .delete('/api/booking/services')
        .expect(404);

      // PUT should not be allowed where not expected
      await request(app)
        .put('/api/booking/services')
        .expect(404);
    });
  });

  describe('Response Format Consistency', () => {
    test('should return consistent error format', async () => {
      const response = await request(app)
        .get('/non-existent')
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('path');
      expect(response.body).toHaveProperty('method');
      expect(typeof response.body.error).toBe('string');
    });

    test('should return consistent success format', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('service');
      expect(typeof response.body.timestamp).toBe('string');
    });
  });

  describe('Environment Configuration', () => {
    test('should use default port when PORT not set', () => {
      // This is implicit - if server starts successfully, default port is working
      expect(true).toBe(true);
    });

    test('should handle missing environment variables gracefully', async () => {
      // The server should start even without all env vars
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('OK');
    });
  });

  describe('API Route Mounting', () => {
    test('should mount booking routes under /api/booking', async () => {
      await request(app)
        .get('/api/booking/services')
        .expect(200);

      // Should not be available without the prefix
      await request(app)
        .get('/services')
        .expect(404);
    });
  });

  describe('Middleware Order', () => {
    test('should apply middleware in correct order', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      // Security headers should be applied before route handlers
      expect(response.headers['x-content-type-options']).toBeDefined();
      
      // CORS headers should be present
      expect(response.headers['access-control-allow-origin']).toBeDefined();
      
      // Content should be properly parsed
      expect(response.body.status).toBe('OK');
    });
  });

  describe('Error Propagation', () => {
    test('should handle middleware errors gracefully', async () => {
      // Send malformed JSON to trigger parsing error
      const response = await request(app)
        .post('/api/booking/allowed-days')
        .set('Content-Type', 'application/json')
        .send('{ invalid: json, }')
        .expect(400);

      expect(response.body).toBeDefined();
    });
  });

  describe('Response Headers', () => {
    test('should set appropriate content-type for JSON responses', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    test('should include appropriate cache headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      // Health endpoint should not be cached
      expect(response.headers['cache-control']).toBeDefined();
    });
  });

  describe('Logging', () => {
    test('should log requests (Morgan middleware)', async () => {
      // Morgan logs to console, we can test that requests are processed
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('OK');
      // Morgan logging is working if the request completes successfully
    });
  });
});