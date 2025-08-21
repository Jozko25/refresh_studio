import request from 'supertest';
import express from 'express';
import bookingRoutes from '../../src/routes/booking.js';
import BookioService from '../../src/services/bookioService.js';
import {
  mockServices,
  mockAllowedDays,
  mockAllowedTimes,
  mockBookingSuccess,
  mockCustomerInfo
} from '../fixtures/bookioResponses.js';

jest.mock('../../src/services/bookioService.js');

const app = express();
app.use(express.json());
app.use('/api/booking', bookingRoutes);

describe('Booking Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/booking/services', () => {
    test('should return services successfully', async () => {
      BookioService.getServices.mockResolvedValue({
        success: true,
        services: mockServices.services
      });

      const response = await request(app)
        .get('/api/booking/services')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.services).toEqual(mockServices.services);
      expect(response.body.timestamp).toBeDefined();
    });

    test('should handle service error', async () => {
      BookioService.getServices.mockResolvedValue({
        success: false,
        error: 'Service unavailable'
      });

      const response = await request(app)
        .get('/api/booking/services')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Service unavailable');
    });

    test('should handle service exception', async () => {
      BookioService.getServices.mockRejectedValue(new Error('Network error'));

      const response = await request(app)
        .get('/api/booking/services')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Internal server error');
    });
  });

  describe('POST /api/booking/allowed-days', () => {
    test('should return allowed days with default parameters', async () => {
      BookioService.getAllowedDays.mockResolvedValue({
        success: true,
        data: mockAllowedDays.data,
        raw: mockAllowedDays
      });

      const response = await request(app)
        .post('/api/booking/allowed-days')
        .send({})
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockAllowedDays.data);
      expect(BookioService.getAllowedDays).toHaveBeenCalledWith(130113, 31576, undefined, undefined, undefined);
    });

    test('should accept custom parameters', async () => {
      BookioService.getAllowedDays.mockResolvedValue({
        success: true,
        data: mockAllowedDays.data
      });

      await request(app)
        .post('/api/booking/allowed-days')
        .send({
          serviceId: 123,
          workerId: 456,
          count: 2,
          participantsCount: 1,
          addons: ['test']
        })
        .expect(200);

      expect(BookioService.getAllowedDays).toHaveBeenCalledWith(123, 456, 2, 1, ['test']);
    });
  });

  describe('POST /api/booking/allowed-times', () => {
    test('should return allowed times', async () => {
      BookioService.getAllowedTimes.mockResolvedValue({
        success: true,
        data: mockAllowedTimes.data,
        times: mockAllowedTimes.data.times,
        raw: mockAllowedTimes
      });

      const response = await request(app)
        .post('/api/booking/allowed-times')
        .send({
          date: '15.08.2025 10:22'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockAllowedTimes.data);
      expect(response.body.times).toEqual(mockAllowedTimes.data.times);
    });

    test('should require date parameter', async () => {
      const response = await request(app)
        .post('/api/booking/allowed-times')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('date is required');
    });

    test('should use default parameters when not provided', async () => {
      BookioService.getAllowedTimes.mockResolvedValue({
        success: true,
        data: mockAllowedTimes.data,
        times: mockAllowedTimes.data.times
      });

      await request(app)
        .post('/api/booking/allowed-times')
        .send({
          date: '15.08.2025 10:22'
        })
        .expect(200);

      expect(BookioService.getAllowedTimes).toHaveBeenCalledWith(
        130113, '15.08.2025 10:22', 31576, undefined, undefined, undefined
      );
    });
  });

  describe('POST /api/booking/soonest-available', () => {
    test('should return soonest available appointment', async () => {
      const mockSoonestAvailable = {
        success: true,
        soonestAvailable: {
          date: '15.08.2025 10:22',
          firstTime: { id: '09:00', name: '09:10' },
          serviceId: 130113,
          workerId: 31576
        }
      };

      BookioService.getSoonestAvailable.mockResolvedValue(mockSoonestAvailable);

      const response = await request(app)
        .post('/api/booking/soonest-available')
        .send({})
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.soonestAvailable).toEqual(mockSoonestAvailable.soonestAvailable);
    });

    test('should handle no available appointments', async () => {
      BookioService.getSoonestAvailable.mockResolvedValue({
        success: false,
        error: 'No appointments available',
        allowedDays: []
      });

      const response = await request(app)
        .post('/api/booking/soonest-available')
        .send({})
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('No appointments available');
    });
  });

  describe('GET /api/booking/next-available-all', () => {
    test('should return next available for all services', async () => {
      const mockResult = {
        success: true,
        data: {
          130113: {
            service: { id: 130113 },
            success: true,
            soonestAvailable: {}
          }
        }
      };

      BookioService.getNextAvailableForAllServices.mockResolvedValue(mockResult);

      const response = await request(app)
        .get('/api/booking/next-available-all')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.daysChecked).toBe(7);
      expect(BookioService.getNextAvailableForAllServices).toHaveBeenCalledWith(7);
    });

    test('should accept custom days parameter', async () => {
      BookioService.getNextAvailableForAllServices.mockResolvedValue({
        success: true,
        data: {}
      });

      await request(app)
        .get('/api/booking/next-available-all?days=14')
        .expect(200);

      expect(BookioService.getNextAvailableForAllServices).toHaveBeenCalledWith(14);
    });
  });

  describe('POST /api/booking/webhook/soonest-available', () => {
    test('should return webhook response for soonest available', async () => {
      const mockSoonestAvailable = {
        success: true,
        soonestAvailable: {
          date: '15.08.2025',
          day: 15,
          month: 8,
          year: 2025,
          firstTime: { id: '09:00', name: '09:10' },
          allTimes: [],
          morningTimes: [],
          afternoonTimes: [],
          serviceId: 130113,
          workerId: 31576
        }
      };

      BookioService.getSoonestAvailable.mockResolvedValue(mockSoonestAvailable);

      const response = await request(app)
        .post('/api/booking/webhook/soonest-available')
        .send({ source: 'test' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Soonest available appointment found');
      expect(response.body.appointment).toBeDefined();
      expect(response.body.source).toBe('test');
    });
  });

  describe('POST /api/booking/webhook/elevenlabs-available-times', () => {
    test('should return Slovak response for available times', async () => {
      BookioService.getAllowedTimes.mockResolvedValue({
        success: true,
        times: {
          mornings: { data: [{ id: '09:00', name: '09:10' }] },
          afternoon: { data: [{ id: '14:00', name: '14:10' }] }
        }
      });

      const response = await request(app)
        .post('/api/booking/webhook/elevenlabs-available-times')
        .send({ date: '15.08.2025' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.response).toContain('Dostupné sú termíny');
    });

    test('should handle no available times', async () => {
      BookioService.getAllowedTimes.mockResolvedValue({
        success: true,
        times: { all: [] }
      });

      const response = await request(app)
        .post('/api/booking/webhook/elevenlabs-available-times')
        .send({ date: '15.08.2025' })
        .expect(200);

      expect(response.body.success).toBe(false);
      expect(response.body.response).toContain('nie sú dostupné žiadne termíny');
    });

    test('should get soonest available when no date provided', async () => {
      BookioService.getSoonestAvailable.mockResolvedValue({
        success: true,
        soonestAvailable: {
          allTimes: [{ id: '09:00', name: '09:10' }]
        }
      });

      const response = await request(app)
        .post('/api/booking/webhook/elevenlabs-available-times')
        .send({})
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(BookioService.getSoonestAvailable).toHaveBeenCalledWith(130113, 31576, 7);
    });
  });

  describe('POST /api/booking/webhook/elevenlabs-soonest-available', () => {
    test('should return Slovak response for soonest available', async () => {
      const mockSoonestAvailable = {
        success: true,
        soonestAvailable: {
          year: 2025,
          month: 8,
          day: 15,
          firstTime: { id: '09:00', name: '09:10' }
        }
      };

      BookioService.getSoonestAvailable.mockResolvedValue(mockSoonestAvailable);

      const response = await request(app)
        .post('/api/booking/webhook/elevenlabs-soonest-available')
        .send({})
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.response).toContain('Najbližší dostupný termín');
      expect(response.body.appointment).toBeDefined();
    });

    test('should handle no available appointments', async () => {
      BookioService.getSoonestAvailable.mockResolvedValue({
        success: false,
        error: 'No appointments available'
      });

      const response = await request(app)
        .post('/api/booking/webhook/elevenlabs-soonest-available')
        .send({ daysToCheck: 5 })
        .expect(200);

      expect(response.body.success).toBe(false);
      expect(response.body.response).toContain('v najbližších 5 dňoch');
    });
  });

  describe('POST /api/booking/book-appointment', () => {
    test('should book appointment successfully', async () => {
      BookioService.validateBookingData.mockReturnValue({
        isValid: true,
        errors: []
      });

      BookioService.checkSlotAvailability.mockResolvedValue({
        available: true,
        slot: { id: '09:00', name: '09:10' }
      });

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
          customer: mockCustomerInfo
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Appointment booked successfully');
      expect(response.body.booking).toBeDefined();
      expect(response.body.appointment).toBeDefined();
    });

    test('should handle validation errors', async () => {
      BookioService.validateBookingData.mockReturnValue({
        isValid: false,
        errors: ['Customer first name is required']
      });

      const response = await request(app)
        .post('/api/booking/book-appointment')
        .send({
          date: '15.08.2025 10:22',
          time: '09:00',
          customer: { lastName: 'Doe' }
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toContain('Customer first name is required');
    });

    test('should handle unavailable time slot', async () => {
      BookioService.validateBookingData.mockReturnValue({
        isValid: true,
        errors: []
      });

      BookioService.checkSlotAvailability.mockResolvedValue({
        available: false,
        reason: 'Time slot is full'
      });

      const response = await request(app)
        .post('/api/booking/book-appointment')
        .send({
          date: '15.08.2025 10:22',
          time: '09:00',
          customer: mockCustomerInfo
        })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Time slot no longer available');
      expect(response.body.reason).toBe('Time slot is full');
    });

    test('should handle booking failure', async () => {
      BookioService.validateBookingData.mockReturnValue({
        isValid: true,
        errors: []
      });

      BookioService.checkSlotAvailability.mockResolvedValue({
        available: true
      });

      BookioService.bookAppointment.mockResolvedValue({
        success: false,
        error: 'Booking failed',
        details: 'Server error'
      });

      const response = await request(app)
        .post('/api/booking/book-appointment')
        .send({
          date: '15.08.2025 10:22',
          time: '09:00',
          customer: mockCustomerInfo
        })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Booking failed');
      expect(response.body.details).toBe('Server error');
    });
  });

  describe('POST /api/booking/webhook/elevenlabs-book-appointment', () => {
    test('should book appointment and return Slovak confirmation', async () => {
      BookioService.validateBookingData.mockReturnValue({
        isValid: true,
        errors: []
      });

      BookioService.checkSlotAvailability.mockResolvedValue({
        available: true
      });

      BookioService.bookAppointment.mockResolvedValue({
        success: true,
        booking: { id: 123 }
      });

      const response = await request(app)
        .post('/api/booking/webhook/elevenlabs-book-appointment')
        .send({
          date: '15.08.2025',
          time: '09:00',
          customer: {
            firstName: 'Mária',
            lastName: 'Nová',
            email: 'maria@test.sk'
          }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.response).toContain('Perfektne!');
      expect(response.body.response).toContain('Mária Nová');
      expect(response.body.appointment).toBeDefined();
    });

    test('should handle validation errors in Slovak', async () => {
      BookioService.validateBookingData.mockReturnValue({
        isValid: false,
        errors: ['Customer first name is required']
      });

      const response = await request(app)
        .post('/api/booking/webhook/elevenlabs-book-appointment')
        .send({
          date: '15.08.2025',
          time: '09:00',
          customer: { lastName: 'Doe' }
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.response).toContain('Ľutujem');
      expect(response.body.response).toContain('údaje nie sú kompletné');
    });

    test('should handle unavailable slots in Slovak', async () => {
      BookioService.validateBookingData.mockReturnValue({
        isValid: true,
        errors: []
      });

      BookioService.checkSlotAvailability.mockResolvedValue({
        available: false,
        reason: 'Slot is full'
      });

      const response = await request(app)
        .post('/api/booking/webhook/elevenlabs-book-appointment')
        .send({
          date: '15.08.2025',
          time: '09:00',
          customer: mockCustomerInfo
        })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.response).toContain('zvolený termín už nie je dostupný');
    });
  });

  describe('POST /api/booking/check-availability', () => {
    test('should check availability successfully', async () => {
      BookioService.checkSlotAvailability.mockResolvedValue({
        available: true,
        reason: 'Available',
        slot: { id: '09:00', name: '09:10' }
      });

      const response = await request(app)
        .post('/api/booking/check-availability')
        .send({
          date: '15.08.2025 10:22',
          time: '09:00'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.available).toBe(true);
      expect(response.body.slot).toBeDefined();
    });

    test('should require date and time parameters', async () => {
      const response = await request(app)
        .post('/api/booking/check-availability')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Date and time are required');
    });

    test('should handle service exceptions', async () => {
      BookioService.checkSlotAvailability.mockRejectedValue(new Error('Service error'));

      const response = await request(app)
        .post('/api/booking/check-availability')
        .send({
          date: '15.08.2025 10:22',
          time: '09:00'
        })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Internal server error');
    });
  });

  describe('POST /api/booking/webhook/elevenlabs-unified', () => {
    test('should handle get_available_times action', async () => {
      BookioService.getAllowedTimes.mockResolvedValue({
        success: true,
        times: {
          all: [
            { id: '09:00', name: '09:10', nameSuffix: '09:10 AM' },
            { id: '14:00', name: '14:10', nameSuffix: '14:10 PM' }
          ]
        }
      });

      const response = await request(app)
        .post('/api/booking/webhook/elevenlabs-unified')
        .send({
          action: 'get_available_times',
          date: '15.08.2025'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.response).toContain('Dostupné termíny na 15.08.2025');
      expect(response.body.available_times).toHaveLength(2);
    });

    test('should filter by preferred time for morning slots', async () => {
      BookioService.getAllowedTimes.mockResolvedValue({
        success: true,
        times: {
          all: [
            { id: '09:00', name: '09:10', nameSuffix: '09:10 AM' },
            { id: '14:00', name: '14:10', nameSuffix: '14:10 PM' }
          ]
        }
      });

      const response = await request(app)
        .post('/api/booking/webhook/elevenlabs-unified')
        .send({
          action: 'get_available_times',
          date: '15.08.2025',
          preferred_time: 'morning'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.available_times).toHaveLength(1);
      expect(response.body.available_times[0].id).toBe('09:00');
    });

    test('should handle find_closest_slot action', async () => {
      BookioService.getAllowedTimes.mockResolvedValueOnce({
        success: true,
        times: {
          all: [{ id: '09:00', name: '09:10', nameSuffix: '09:10 AM' }]
        }
      });

      const response = await request(app)
        .post('/api/booking/webhook/elevenlabs-unified')
        .send({
          action: 'find_closest_slot'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.response).toContain('Najbližší dostupný termín');
      expect(response.body.soonest_slot).toBeDefined();
    });

    test('should handle book_appointment action', async () => {
      BookioService.bookAppointment.mockResolvedValue({
        success: true,
        booking: { id: 123 }
      });

      const response = await request(app)
        .post('/api/booking/webhook/elevenlabs-unified')
        .send({
          action: 'book_appointment',
          date: '15.08.2025',
          time: '09:00',
          phone: '+421910123456',
          customer: 'Ján Novák'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.response).toContain('Perfektne!');
      expect(response.body.response).toContain('Ján Novák');
    });

    test('should handle booking failure', async () => {
      BookioService.bookAppointment.mockResolvedValue({
        success: false,
        error: 'Slot not available'
      });

      const response = await request(app)
        .post('/api/booking/webhook/elevenlabs-unified')
        .send({
          action: 'book_appointment',
          date: '15.08.2025',
          time: '09:00',
          phone: '+421910123456',
          customer: 'Ján Novák'
        })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.response).toContain('už nie je dostupný');
    });

    test('should require date for get_available_times', async () => {
      const response = await request(app)
        .post('/api/booking/webhook/elevenlabs-unified')
        .send({
          action: 'get_available_times'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.response).toContain('potrebujem dátum');
    });

    test('should handle unknown action', async () => {
      const response = await request(app)
        .post('/api/booking/webhook/elevenlabs-unified')
        .send({
          action: 'unknown_action'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.response).toContain('nerozumiem tejto požiadavke');
      expect(response.body.error).toBe('Unknown action: unknown_action');
    });

    test('should handle get_more_slots action', async () => {
      BookioService.getAllowedTimes.mockResolvedValue({
        success: true,
        times: {
          all: Array.from({ length: 10 }, (_, i) => ({
            id: `${9 + i}:00`,
            name: `${9 + i}:10`,
            nameSuffix: `${9 + i}:10 AM`
          }))
        }
      });

      const response = await request(app)
        .post('/api/booking/webhook/elevenlabs-unified')
        .send({
          action: 'get_more_slots',
          date: '15.08.2025',
          current_count: 5
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.response).toContain('Ďalšie dostupné termíny');
      expect(response.body.additional_times).toHaveLength(5);
      expect(response.body.current_total_shown).toBe(10);
    });

    test('should handle no more slots available', async () => {
      BookioService.getAllowedTimes.mockResolvedValue({
        success: true,
        times: {
          all: Array.from({ length: 3 }, (_, i) => ({
            id: `${9 + i}:00`,
            name: `${9 + i}:10`
          }))
        }
      });

      const response = await request(app)
        .post('/api/booking/webhook/elevenlabs-unified')
        .send({
          action: 'get_more_slots',
          date: '15.08.2025',
          current_count: 5
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.response).toContain('To sú všetky dostupné termíny');
      expect(response.body.no_more_slots).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle internal server errors gracefully', async () => {
      BookioService.getServices.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/booking/services')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Internal server error');
      expect(response.body.timestamp).toBeDefined();
    });

    test('should handle malformed JSON requests', async () => {
      const response = await request(app)
        .post('/api/booking/allowed-days')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);

      expect(response.body).toBeDefined();
    });

    test('should handle missing Content-Type header', async () => {
      const response = await request(app)
        .post('/api/booking/allowed-days')
        .send('test data')
        .expect(400);

      expect(response.body).toBeDefined();
    });
  });
});