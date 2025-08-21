import BookioService from '../../src/services/bookioService.js';
import request from 'supertest';
import express from 'express';
import bookingRoutes from '../../src/routes/booking.js';

const app = express();
app.use(express.json());
app.use('/api/booking', bookingRoutes);

jest.mock('../../src/services/bookioService.js');

describe('Edge Cases and Validation Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Input Validation Edge Cases', () => {
    test('should handle extremely long strings', async () => {
      const veryLongString = 'a'.repeat(10000);
      
      const response = await request(app)
        .post('/api/booking/webhook/elevenlabs-unified')
        .send({
          action: 'book_appointment',
          date: '15.08.2025',
          time: '09:00',
          phone: '+421910123456',
          customer: veryLongString
        });

      expect(response.status).toBeLessThan(500);
    });

    test('should handle special characters in input', async () => {
      const specialChars = '!@#$%^&*()_+{}[]|\\:";\'<>?,./ ñáéíóúü';
      
      const response = await request(app)
        .post('/api/booking/webhook/elevenlabs-unified')
        .send({
          action: 'book_appointment',
          date: '15.08.2025',
          time: '09:00',
          phone: '+421910123456',
          customer: specialChars
        });

      expect(response.status).toBeLessThan(500);
    });

    test('should handle Unicode characters', async () => {
      const unicodeString = '测试 こんにちは мир 🚀 ñáéíóú';
      
      const response = await request(app)
        .post('/api/booking/webhook/elevenlabs-unified')
        .send({
          action: 'book_appointment',
          date: '15.08.2025',
          time: '09:00',
          phone: '+421910123456',
          customer: unicodeString
        });

      expect(response.status).toBeLessThan(500);
    });

    test('should handle null and undefined values', async () => {
      const response = await request(app)
        .post('/api/booking/webhook/elevenlabs-unified')
        .send({
          action: 'book_appointment',
          date: null,
          time: undefined,
          phone: '',
          customer: null
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('should handle empty objects and arrays', async () => {
      const response = await request(app)
        .post('/api/booking/allowed-days')
        .send({
          serviceId: 130113,
          workerId: 31576,
          addons: [],
          count: 0,
          participantsCount: 0
        });

      expect(response.status).toBeLessThan(500);
    });

    test('should handle numeric edge cases', async () => {
      BookioService.getAllowedDays.mockResolvedValue({
        success: true,
        data: { allowedDays: [] }
      });

      const response = await request(app)
        .post('/api/booking/allowed-days')
        .send({
          serviceId: Number.MAX_SAFE_INTEGER,
          workerId: -1,
          count: 0,
          participantsCount: Number.MIN_SAFE_INTEGER
        });

      expect(response.status).toBeLessThan(500);
    });
  });

  describe('Date and Time Edge Cases', () => {
    test('should handle invalid date formats', () => {
      const invalidDates = [
        '32.13.2025 10:22',  // Invalid day and month
        '15.08.2025 25:99',  // Invalid time
        '15/08/2025 10:22',  // Wrong separator
        '2025-08-15 10:22',  // Wrong format
        'invalid-date',
        '',
        null
      ];

      invalidDates.forEach(date => {
        const validation = BookioService.validateBookingData(
          130113, 31576, date, '09:00',
          { firstName: 'John', lastName: 'Doe', email: 'john@test.com' }
        );

        // The validation should handle these gracefully
        expect(typeof validation).toBe('object');
        expect(validation.hasOwnProperty('isValid')).toBe(true);
      });
    });

    test('should handle edge date cases', () => {
      const edgeDates = [
        new Date(1970, 0, 1), // Unix epoch
        new Date(2038, 0, 19), // Year 2038 problem
        new Date(2000, 1, 29), // Leap year
        new Date(1900, 1, 28), // Non-leap year
        new Date(2025, 11, 31), // End of year
        new Date(2025, 0, 1)   // Start of year
      ];

      edgeDates.forEach(date => {
        const formatted = BookioService.formatDateForAPI(date);
        expect(formatted).toMatch(/^\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}$/);
      });
    });

    test('should handle timezone edge cases', () => {
      const originalTimezone = process.env.TZ;
      
      // Test different timezones
      const timezones = ['UTC', 'America/New_York', 'Europe/London', 'Asia/Tokyo'];
      
      timezones.forEach(tz => {
        process.env.TZ = tz;
        const date = new Date(2025, 7, 15, 10, 22);
        const formatted = BookioService.formatDateForAPI(date);
        expect(formatted).toMatch(/^\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}$/);
      });

      process.env.TZ = originalTimezone;
    });
  });

  describe('Phone Number Validation Edge Cases', () => {
    test('should handle various phone number formats', async () => {
      const phoneNumbers = [
        '+421910123456',     // Valid Slovak
        '+420123456789',     // Czech
        '+1234567890',       // US format
        '0910123456',        // Without country code
        '+421 910 123 456',  // With spaces
        '+421-910-123-456',  // With dashes
        '910123456',         // Minimal
        '',                  // Empty
        'not-a-phone',       // Invalid
        '123',              // Too short
        '+421' + '9'.repeat(20) // Too long
      ];

      for (const phone of phoneNumbers) {
        const response = await request(app)
          .post('/api/booking/webhook/elevenlabs-unified')
          .send({
            action: 'book_appointment',
            date: '15.08.2025',
            time: '09:00',
            phone: phone,
            customer: 'Test User'
          });

        expect(response.status).toBeLessThanOrEqual(500);
        expect(response.body).toHaveProperty('success');
      }
    });
  });

  describe('Email Validation Edge Cases', () => {
    test('should handle various email formats', () => {
      const emails = [
        'test@example.com',           // Valid
        'user.name@domain.co.uk',     // Valid with dots
        'test+tag@example.com',       // Valid with plus
        'test@sub.domain.com',        // Valid subdomain
        'invalid-email',              // No @
        '@domain.com',                // No local part
        'test@',                      // No domain
        'test@.com',                  // Invalid domain
        '',                           // Empty
        'a'.repeat(300) + '@test.com', // Very long
        'test@' + 'a'.repeat(300) + '.com' // Very long domain
      ];

      emails.forEach(email => {
        const validation = BookioService.validateBookingData(
          130113, 31576, '15.08.2025 10:22', '09:00',
          { firstName: 'John', lastName: 'Doe', email: email }
        );

        expect(typeof validation).toBe('object');
        expect(validation.hasOwnProperty('isValid')).toBe(true);
      });
    });
  });

  describe('Concurrent Request Handling', () => {
    test('should handle multiple simultaneous booking requests', async () => {
      BookioService.validateBookingData.mockReturnValue({ isValid: true, errors: [] });
      BookioService.checkSlotAvailability.mockResolvedValue({ available: true });
      BookioService.bookAppointment.mockResolvedValue({ success: true, booking: { id: 123 }});

      const requests = Array.from({ length: 10 }, (_, i) => 
        request(app)
          .post('/api/booking/book-appointment')
          .send({
            date: '15.08.2025 10:22',
            time: '09:00',
            customer: {
              firstName: `User${i}`,
              lastName: 'Test',
              email: `user${i}@test.com`,
              phone: `+42191012345${i}`
            }
          })
      );

      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.status).toBeLessThanOrEqual(500);
        expect(response.body).toHaveProperty('success');
      });
    });

    test('should handle race conditions in slot availability', async () => {
      let callCount = 0;
      BookioService.validateBookingData.mockReturnValue({ isValid: true, errors: [] });
      BookioService.checkSlotAvailability.mockImplementation(() => {
        callCount++;
        return Promise.resolve({ available: callCount === 1 }); // Only first call succeeds
      });
      BookioService.bookAppointment.mockImplementation(() => {
        return Promise.resolve({ success: callCount === 1 });
      });

      const requests = [
        request(app)
          .post('/api/booking/book-appointment')
          .send({
            date: '15.08.2025 10:22',
            time: '09:00',
            customer: {
              firstName: 'User1',
              lastName: 'Test',
              email: 'user1@test.com',
              phone: '+421910123451'
            }
          }),
        request(app)
          .post('/api/booking/book-appointment')
          .send({
            date: '15.08.2025 10:22',
            time: '09:00',
            customer: {
              firstName: 'User2',
              lastName: 'Test', 
              email: 'user2@test.com',
              phone: '+421910123452'
            }
          })
      ];

      const responses = await Promise.all(requests);
      
      const successCount = responses.filter(r => r.body.success).length;
      const conflictCount = responses.filter(r => r.status === 409).length;
      
      expect(successCount + conflictCount).toBe(2);
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    test('should handle large response payloads', async () => {
      const largeTimes = Array.from({ length: 1000 }, (_, i) => ({
        id: `${Math.floor(i/4) + 9}:${(i%4) * 15}`,
        name: `${Math.floor(i/4) + 9}:${(i%4) * 15 + 10}`,
        nameSuffix: `${Math.floor(i/4) + 9}:${(i%4) * 15 + 10} ${i < 500 ? 'AM' : 'PM'}`
      }));

      BookioService.getAllowedTimes.mockResolvedValue({
        success: true,
        times: { all: largeTimes }
      });

      const response = await request(app)
        .post('/api/booking/webhook/elevenlabs-available-times')
        .send({ date: '15.08.2025' });

      expect(response.status).toBeLessThan(500);
      expect(response.body).toHaveProperty('success');
    });

    test('should handle deeply nested objects', async () => {
      const deepObject = { level1: { level2: { level3: { level4: { level5: 'deep' } } } } };
      
      const response = await request(app)
        .post('/api/booking/allowed-days')
        .send({
          serviceId: 130113,
          workerId: 31576,
          customData: deepObject
        });

      expect(response.status).toBeLessThan(500);
    });
  });

  describe('Network and Timeout Edge Cases', () => {
    test('should handle service timeouts gracefully', async () => {
      BookioService.getAllowedDays.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 5000))
      );

      const response = await request(app)
        .post('/api/booking/allowed-days')
        .send({ serviceId: 130113, workerId: 31576 });

      // Should either succeed or fail gracefully, not hang
      expect(response.status).toBeDefined();
    }, 6000);

    test('should handle intermittent service failures', async () => {
      let callCount = 0;
      BookioService.getAllowedDays.mockImplementation(() => {
        callCount++;
        if (callCount % 2 === 0) {
          return Promise.reject(new Error('Service temporarily unavailable'));
        }
        return Promise.resolve({ success: true, data: { allowedDays: [15, 16] } });
      });

      const responses = await Promise.all([
        request(app).post('/api/booking/allowed-days').send({ serviceId: 130113, workerId: 31576 }),
        request(app).post('/api/booking/allowed-days').send({ serviceId: 130113, workerId: 31576 })
      ]);

      expect(responses[0].status).toBe(200);
      expect(responses[1].status).toBe(500);
    });
  });

  describe('Data Type Coercion Edge Cases', () => {
    test('should handle string numbers', async () => {
      BookioService.getAllowedDays.mockResolvedValue({
        success: true,
        data: { allowedDays: [] }
      });

      const response = await request(app)
        .post('/api/booking/allowed-days')
        .send({
          serviceId: '130113',  // String instead of number
          workerId: '31576',    // String instead of number
          count: '1',           // String instead of number
          participantsCount: '0' // String instead of number
        });

      expect(response.status).toBe(200);
      expect(BookioService.getAllowedDays).toHaveBeenCalledWith(130113, 31576, '1', '0', undefined);
    });

    test('should handle boolean values', async () => {
      const response = await request(app)
        .post('/api/booking/webhook/elevenlabs-unified')
        .send({
          action: 'book_appointment',
          date: true,
          time: false,
          phone: '+421910123456',
          customer: 'Test'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Boundary Value Testing', () => {
    test('should handle minimum and maximum values', async () => {
      const testCases = [
        { serviceId: 1, workerId: 1 },
        { serviceId: 999999999, workerId: 999999999 },
        { serviceId: 0, workerId: 0 },
        { serviceId: -1, workerId: -1 }
      ];

      for (const testCase of testCases) {
        BookioService.getAllowedDays.mockResolvedValue({
          success: true,
          data: { allowedDays: [] }
        });

        const response = await request(app)
          .post('/api/booking/allowed-days')
          .send(testCase);

        expect(response.status).toBeLessThan(500);
      }
    });

    test('should handle edge dates', async () => {
      const edgeDates = [
        '01.01.1970 00:00',  // Unix epoch start
        '31.12.9999 23:59',  // Far future
        '29.02.2024 12:00',  // Leap year
        '28.02.2023 12:00',  // Non-leap year
        '01.01.2025 00:00',  // Year boundary
        '31.12.2025 23:59'   // Year end
      ];

      for (const date of edgeDates) {
        BookioService.getAllowedTimes.mockResolvedValue({
          success: true,
          times: { all: [] }
        });

        const response = await request(app)
          .post('/api/booking/allowed-times')
          .send({ date });

        expect(response.status).toBeLessThan(500);
      }
    });
  });
});