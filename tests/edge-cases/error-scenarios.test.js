import request from 'supertest';
import express from 'express';
import bookingRoutes from '../../src/routes/booking.js';
import BookioService from '../../src/services/bookioService.js';

const app = express();
app.use(express.json());
app.use('/api/booking', bookingRoutes);

jest.mock('../../src/services/bookioService.js');

describe('Error Scenarios and Edge Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Service Failure Scenarios', () => {
    test('should handle complete service outage', async () => {
      BookioService.getServices.mockRejectedValue(new Error('ECONNREFUSED'));

      const response = await request(app)
        .get('/api/booking/services')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Internal server error');
    });

    test('should handle partial service degradation', async () => {
      BookioService.getAllowedDays.mockResolvedValue({
        success: true,
        data: { allowedDays: [15, 16, 17] }
      });

      // First call succeeds, second fails
      BookioService.getAllowedTimes
        .mockResolvedValueOnce({ success: false, error: 'Service degraded' })
        .mockResolvedValueOnce({ success: true, times: { all: [] } });

      const response = await request(app)
        .post('/api/booking/soonest-available')
        .send({});

      expect(response.status).toBeOneOf([200, 404, 500]);
    });

    test('should handle corrupted API responses', async () => {
      BookioService.getAllowedDays.mockResolvedValue({
        // Missing required fields
        success: true
        // data field missing
      });

      const response = await request(app)
        .post('/api/booking/allowed-days')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeUndefined();
    });

    test('should handle malformed service responses', async () => {
      BookioService.getAllowedTimes.mockResolvedValue({
        success: true,
        times: {
          all: [
            { /* missing required fields */ },
            { id: null, name: '', nameSuffix: undefined },
            { id: 'invalid-time', name: 'Invalid Name' }
          ]
        }
      });

      const response = await request(app)
        .post('/api/booking/allowed-times')
        .send({ date: '15.08.2025 10:22' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.times).toBeDefined();
    });
  });

  describe('Database/Storage Failures', () => {
    test('should handle database connection failures', async () => {
      const dbError = new Error('connect ECONNREFUSED 127.0.0.1:5432');
      dbError.code = 'ECONNREFUSED';
      
      BookioService.bookAppointment.mockRejectedValue(dbError);
      BookioService.validateBookingData.mockReturnValue({ isValid: true, errors: [] });
      BookioService.checkSlotAvailability.mockResolvedValue({ available: true });

      const response = await request(app)
        .post('/api/booking/book-appointment')
        .send({
          date: '15.08.2025 10:22',
          time: '09:00',
          customer: {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@test.com',
            phone: '+421910123456'
          }
        })
        .expect(500);

      expect(response.body.success).toBe(false);
    });

    test('should handle transaction rollback scenarios', async () => {
      BookioService.validateBookingData.mockReturnValue({ isValid: true, errors: [] });
      BookioService.checkSlotAvailability.mockResolvedValue({ available: true });
      
      // Simulate booking that appears to succeed but then fails
      BookioService.bookAppointment.mockResolvedValue({
        success: false,
        error: 'Transaction rolled back',
        details: 'Database consistency check failed'
      });

      const response = await request(app)
        .post('/api/booking/book-appointment')
        .send({
          date: '15.08.2025 10:22',
          time: '09:00',
          customer: {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@test.com',
            phone: '+421910123456'
          }
        })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Transaction rolled back');
    });
  });

  describe('Memory and Resource Exhaustion', () => {
    test('should handle out of memory scenarios gracefully', async () => {
      const memoryError = new Error('JavaScript heap out of memory');
      memoryError.code = 'ERR_OUT_OF_MEMORY';
      
      BookioService.getNextAvailableForAllServices.mockRejectedValue(memoryError);

      const response = await request(app)
        .get('/api/booking/next-available-all')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Internal server error');
    });

    test('should handle file descriptor exhaustion', async () => {
      const fdError = new Error('EMFILE: too many open files');
      fdError.code = 'EMFILE';
      
      BookioService.getAllowedDays.mockRejectedValue(fdError);

      const response = await request(app)
        .post('/api/booking/allowed-days')
        .send({})
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Third-party Service Failures', () => {
    test('should handle Bookio API authentication failures', async () => {
      const authError = new Error('Unauthorized');
      authError.response = { status: 401, data: { error: 'Invalid API key' } };
      
      BookioService.getAllowedTimes.mockRejectedValue(authError);

      const response = await request(app)
        .post('/api/booking/allowed-times')
        .send({ date: '15.08.2025 10:22' })
        .expect(500);

      expect(response.body.success).toBe(false);
    });

    test('should handle Bookio API rate limiting', async () => {
      const rateLimitError = new Error('Too Many Requests');
      rateLimitError.response = { 
        status: 429, 
        data: { error: 'Rate limit exceeded' },
        headers: { 'retry-after': '60' }
      };
      
      BookioService.getAllowedDays.mockRejectedValue(rateLimitError);

      const response = await request(app)
        .post('/api/booking/allowed-days')
        .send({})
        .expect(500);

      expect(response.body.success).toBe(false);
    });

    test('should handle Bookio API maintenance mode', async () => {
      const maintenanceError = new Error('Service Unavailable');
      maintenanceError.response = { 
        status: 503, 
        data: { error: 'Service under maintenance' }
      };
      
      BookioService.bookAppointment.mockRejectedValue(maintenanceError);
      BookioService.validateBookingData.mockReturnValue({ isValid: true, errors: [] });
      BookioService.checkSlotAvailability.mockResolvedValue({ available: true });

      const response = await request(app)
        .post('/api/booking/book-appointment')
        .send({
          date: '15.08.2025 10:22',
          time: '09:00',
          customer: {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@test.com',
            phone: '+421910123456'
          }
        })
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Data Corruption Scenarios', () => {
    test('should handle corrupted time slot data', async () => {
      BookioService.getAllowedTimes.mockResolvedValue({
        success: true,
        times: {
          all: [
            { id: '09:00', name: null, nameSuffix: '' },
            { id: '', name: '09:10', nameSuffix: '09:10 AM' },
            null,
            undefined,
            { /* completely empty object */ }
          ]
        }
      });

      const response = await request(app)
        .post('/api/booking/webhook/elevenlabs-available-times')
        .send({ date: '15.08.2025' })
        .expect(200);

      expect(response.body).toHaveProperty('success');
    });

    test('should handle corrupted customer data during booking', async () => {
      BookioService.validateBookingData.mockReturnValue({ isValid: true, errors: [] });
      BookioService.checkSlotAvailability.mockResolvedValue({ available: true });
      
      // Simulate data getting corrupted between validation and booking
      BookioService.bookAppointment.mockImplementation((serviceId, workerId, date, time, customer) => {
        // Simulate corrupted customer object
        const corruptedCustomer = JSON.parse(JSON.stringify(customer));
        corruptedCustomer.firstName = null;
        corruptedCustomer.email = '';
        
        return Promise.resolve({
          success: false,
          error: 'Invalid customer data',
          attempted: { serviceId, workerId, date, time, customer: corruptedCustomer }
        });
      });

      const response = await request(app)
        .post('/api/booking/book-appointment')
        .send({
          date: '15.08.2025 10:22',
          time: '09:00',
          customer: {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@test.com',
            phone: '+421910123456'
          }
        })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.attempted).toBeDefined();
    });
  });

  describe('Race Condition Edge Cases', () => {
    test('should handle slot becoming unavailable between check and booking', async () => {
      BookioService.validateBookingData.mockReturnValue({ isValid: true, errors: [] });
      
      let checkCount = 0;
      BookioService.checkSlotAvailability.mockImplementation(() => {
        checkCount++;
        return Promise.resolve({ 
          available: checkCount === 1, // Available on first check, unavailable on subsequent
          reason: checkCount === 1 ? 'Available' : 'Slot was just booked'
        });
      });

      BookioService.bookAppointment.mockResolvedValue({
        success: false,
        error: 'Slot no longer available',
        details: 'Another booking was processed simultaneously'
      });

      const response = await request(app)
        .post('/api/booking/book-appointment')
        .send({
          date: '15.08.2025 10:22',
          time: '09:00',
          customer: {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@test.com',
            phone: '+421910123456'
          }
        })
        .expect(500);

      expect(response.body.success).toBe(false);
    });

    test('should handle concurrent bookings for same slot', async () => {
      BookioService.validateBookingData.mockReturnValue({ isValid: true, errors: [] });
      BookioService.checkSlotAvailability.mockResolvedValue({ available: true });
      
      let bookingCount = 0;
      BookioService.bookAppointment.mockImplementation(() => {
        bookingCount++;
        return Promise.resolve({
          success: bookingCount === 1, // Only first booking succeeds
          error: bookingCount > 1 ? 'Slot already booked' : null,
          booking: bookingCount === 1 ? { id: 123 } : null
        });
      });

      const bookingData = {
        date: '15.08.2025 10:22',
        time: '09:00',
        customer: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@test.com',
          phone: '+421910123456'
        }
      };

      const requests = [
        request(app).post('/api/booking/book-appointment').send(bookingData),
        request(app).post('/api/booking/book-appointment').send({
          ...bookingData,
          customer: { ...bookingData.customer, firstName: 'Jane' }
        })
      ];

      const responses = await Promise.all(requests);
      
      const successfulBookings = responses.filter(r => r.body.success).length;
      expect(successfulBookings).toBe(1);
    });
  });

  describe('Timeout and Latency Issues', () => {
    test('should handle slow API responses', async () => {
      BookioService.getAllowedDays.mockImplementation(() => 
        new Promise(resolve => {
          setTimeout(() => {
            resolve({ success: true, data: { allowedDays: [15, 16] } });
          }, 2000);
        })
      );

      const response = await request(app)
        .post('/api/booking/allowed-days')
        .send({})
        .timeout(3000);

      expect(response.status).toBe(200);
    }, 4000);

    test('should handle cascading timeouts', async () => {
      BookioService.getAllowedDays.mockImplementation(() => 
        Promise.reject(new Error('ETIMEDOUT'))
      );
      
      BookioService.getAllowedTimes.mockImplementation(() => 
        Promise.reject(new Error('ETIMEDOUT'))
      );

      const response = await request(app)
        .post('/api/booking/soonest-available')
        .send({});

      expect([404, 500]).toContain(response.status); // Can be 404 (not found) or 500 (timeout error)
      expect(response.body.success).toBe(false);
    });
  });

  describe('Edge Cases in Slovak Language Processing', () => {
    test('should handle special Slovak characters in responses', async () => {
      BookioService.getAllowedTimes.mockResolvedValue({
        success: true,
        times: {
          all: [
            { id: '09:00', name: '09:10', nameSuffix: '09:10 AM' }
          ]
        }
      });

      const response = await request(app)
        .post('/api/booking/webhook/elevenlabs-available-times')
        .send({ date: '15.08.2025' });

      // Should contain either available message or no available message in Slovak
      expect(response.body.response).toMatch(/(Dostupný|nie sú dostupné|žiadne termíny)/);
      expect(response.body.response).toMatch(/[ľščťžýáíéóúň]/); // Slovak characters
    });

    test('should handle time formatting edge cases in Slovak', async () => {
      BookioService.getSoonestAvailable.mockResolvedValue({
        success: true,
        soonestAvailable: {
          year: 2025,
          month: 8,
          day: 15,
          firstTime: { id: '00:00', name: '00:10' } // Midnight
        }
      });

      const response = await request(app)
        .post('/api/booking/webhook/elevenlabs-soonest-available')
        .send({});

      expect(response.body.response).toContain('o polnoci');
    });

    test('should handle noon time formatting in Slovak', async () => {
      BookioService.getSoonestAvailable.mockResolvedValue({
        success: true,
        soonestAvailable: {
          year: 2025,
          month: 8,
          day: 15,
          firstTime: { id: '12:00', name: '12:10' } // Noon
        }
      });

      const response = await request(app)
        .post('/api/booking/webhook/elevenlabs-soonest-available')
        .send({});

      expect(response.body.response).toContain('v poludnie');
    });
  });

  describe('Complex Booking Flow Edge Cases', () => {
    test('should handle partial booking completion', async () => {
      BookioService.validateBookingData.mockReturnValue({ isValid: true, errors: [] });
      BookioService.checkSlotAvailability.mockResolvedValue({ available: true });
      
      // Booking starts but fails midway
      BookioService.bookAppointment.mockResolvedValue({
        success: false,
        error: 'Partial completion',
        details: 'Payment processing failed but slot was reserved',
        attempted: {
          serviceId: 130113,
          workerId: 31576,
          date: '15.08.2025',
          time: '09:00'
        }
      });

      const response = await request(app)
        .post('/api/booking/book-appointment')
        .send({
          date: '15.08.2025 10:22',
          time: '09:00',
          customer: {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@test.com',
            phone: '+421910123456'
          }
        })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.attempted).toBeDefined();
    });

    test('should handle booking with missing optional fields', async () => {
      BookioService.validateBookingData.mockReturnValue({ isValid: true, errors: [] });
      BookioService.checkSlotAvailability.mockResolvedValue({ available: true });
      BookioService.bookAppointment.mockResolvedValue({ 
        success: true, 
        booking: { id: 123 },
        order: { confirmationNumber: 'ABC123' }
      });

      const response = await request(app)
        .post('/api/booking/book-appointment')
        .send({
          date: '15.08.2025 10:22',
          time: '09:00',
          customer: {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@test.com'
            // phone is missing
            // note is missing
          }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.appointment.customer.phone).toBeUndefined();
    });
  });
});