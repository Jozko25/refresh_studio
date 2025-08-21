import axios from 'axios';
import BookioService from '../../src/services/bookioService.js';
import {
  mockServices,
  mockAllowedDays,
  mockAllowedTimes,
  mockBookingSuccess,
  mockBookingFailure,
  mockCustomerInfo,
  mockInvalidCustomerInfo,
  apiErrorResponse,
  networkError
} from '../fixtures/bookioResponses.js';

jest.mock('axios');
const mockedAxios = axios;

describe('BookioService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getServices', () => {
    test('should return hardcoded services successfully', async () => {
      const result = await BookioService.getServices();

      expect(result.success).toBe(true);
      expect(result.services).toHaveLength(1);
      expect(result.services[0]).toEqual({
        id: 130113,
        name: "Service",
        workerId: 31576,
        duration: 10,
        price: null,
        currency: "€"
      });
    });
  });

  describe('getAllowedDays', () => {
    test('should fetch allowed days successfully', async () => {
      mockedAxios.post.mockResolvedValue({
        data: mockAllowedDays
      });

      const result = await BookioService.getAllowedDays(130113, 31576);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockAllowedDays.data);
      expect(result.raw).toEqual(mockAllowedDays);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://services.bookio.com/widget/api/allowedDays?lang=en',
        {
          serviceId: 130113,
          workerId: 31576,
          addons: [],
          count: 1,
          participantsCount: 0
        },
        expect.any(Object)
      );
    });

    test('should handle API error', async () => {
      mockedAxios.post.mockRejectedValue(apiErrorResponse);

      const result = await BookioService.getAllowedDays();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Request failed with status code 500');
      expect(result.details).toEqual(apiErrorResponse.response.data);
    });

    test('should handle network error', async () => {
      mockedAxios.post.mockRejectedValue(networkError);

      const result = await BookioService.getAllowedDays();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network Error');
    });
  });

  describe('getAllowedTimes', () => {
    test('should fetch allowed times successfully', async () => {
      mockedAxios.post.mockResolvedValue({
        data: mockAllowedTimes
      });

      const result = await BookioService.getAllowedTimes(130113, '15.08.2025 10:22', 31576);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockAllowedTimes.data);
      expect(result.times).toEqual(mockAllowedTimes.data.times);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://services.bookio.com/widget/api/allowedTimes?lang=en',
        {
          serviceId: 130113,
          workerId: 31576,
          addons: [],
          count: 1,
          participantsCount: 0,
          date: '15.08.2025 10:22',
          lang: 'en'
        },
        expect.any(Object)
      );
    });

    test('should handle missing date parameter', async () => {
      mockedAxios.post.mockResolvedValue({
        data: mockAllowedTimes
      });

      const result = await BookioService.getAllowedTimes(130113, undefined, 31576);

      expect(result.success).toBe(true);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          date: undefined
        }),
        expect.any(Object)
      );
    });
  });

  describe('getSoonestAvailable', () => {
    test('should find soonest available appointment', async () => {
      // Mock allowed days call
      mockedAxios.post
        .mockResolvedValueOnce({ data: mockAllowedDays })
        .mockResolvedValueOnce({ data: mockAllowedTimes });

      const result = await BookioService.getSoonestAvailable(130113, 31576, 7);

      expect(result.success).toBe(true);
      expect(result.soonestAvailable).toBeDefined();
      expect(result.soonestAvailable.firstTime.id).toBe('09:00');
      expect(result.soonestAvailable.allTimes).toHaveLength(4);
      expect(result.soonestAvailable.serviceId).toBe(130113);
      expect(result.soonestAvailable.workerId).toBe(31576);
    });

    test('should handle no available days', async () => {
      mockedAxios.post.mockResolvedValue({
        data: { data: { allowedDays: [] } }
      });

      const result = await BookioService.getSoonestAvailable(130113, 31576, 7);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No available appointments found');
    });

    test('should fallback to manual date checking when API returns null', async () => {
      // Mock allowed days returning null data
      mockedAxios.post
        .mockResolvedValueOnce({ data: { data: null } })
        .mockResolvedValueOnce({ data: mockAllowedTimes });

      const result = await BookioService.getSoonestAvailable(130113, 31576, 3);

      expect(result.success).toBe(true);
      expect(result.soonestAvailable).toBeDefined();
    });
  });

  describe('formatDateForAPI', () => {
    test('should format date correctly', () => {
      const date = new Date(2025, 7, 15, 10, 22); // Month is 0-indexed
      const formatted = BookioService.formatDateForAPI(date);

      expect(formatted).toBe('15.08.2025 10:22');
    });

    test('should pad single digits', () => {
      const date = new Date(2025, 0, 5, 9, 5); // January 5th
      const formatted = BookioService.formatDateForAPI(date);

      expect(formatted).toBe('05.01.2025 09:05');
    });
  });

  describe('parseTimeSlots', () => {
    test('should parse time slots correctly', () => {
      const slots = BookioService.parseTimeSlots(mockAllowedTimes.data);

      expect(slots).toHaveLength(4);
      expect(slots[0]).toEqual({
        id: '09:00',
        name: '09:10',
        nameSuffix: '09:10 AM',
        available: true,
        period: 'morning'
      });
      expect(slots[2]).toEqual({
        id: '14:30',
        name: '14:40',
        nameSuffix: '14:40 PM',
        available: true,
        period: 'afternoon'
      });
    });

    test('should handle empty times data', () => {
      const slots = BookioService.parseTimeSlots(null);
      expect(slots).toEqual([]);

      const slotsEmpty = BookioService.parseTimeSlots({ times: null });
      expect(slotsEmpty).toEqual([]);
    });
  });

  describe('getNextAvailableForAllServices', () => {
    test('should get next available for all services', async () => {
      // Mock allowed days and times calls
      mockedAxios.post
        .mockResolvedValueOnce({ data: mockAllowedDays })
        .mockResolvedValueOnce({ data: mockAllowedTimes });

      const result = await BookioService.getNextAvailableForAllServices(7);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data[130113]).toBeDefined();
      expect(result.data[130113].service.id).toBe(130113);
    });
  });

  describe('validateBookingData', () => {
    test('should validate correct booking data', () => {
      const validation = BookioService.validateBookingData(
        130113,
        31576,
        '15.08.2025 10:22',
        '09:00',
        mockCustomerInfo
      );

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should catch missing required fields', () => {
      const validation = BookioService.validateBookingData(
        null,
        null,
        null,
        null,
        null
      );

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Service ID is required');
      expect(validation.errors).toContain('Worker ID is required');
      expect(validation.errors).toContain('Date is required');
      expect(validation.errors).toContain('Time is required');
      expect(validation.errors).toContain('Customer information is required');
    });

    test('should validate customer information fields', () => {
      const validation = BookioService.validateBookingData(
        130113,
        31576,
        '15.08.2025 10:22',
        '09:00',
        mockInvalidCustomerInfo
      );

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Customer first name is required');
      expect(validation.errors).toContain('Valid email address is required');
    });

    test('should validate email format', () => {
      const customerWithValidEmail = {
        ...mockInvalidCustomerInfo,
        firstName: 'John',
        email: 'john@example.com'
      };

      const validation = BookioService.validateBookingData(
        130113,
        31576,
        '15.08.2025 10:22',
        '09:00',
        customerWithValidEmail
      );

      expect(validation.isValid).toBe(true);
    });
  });

  describe('bookAppointment', () => {
    test('should book appointment successfully', async () => {
      mockedAxios.post.mockResolvedValue(mockBookingSuccess);

      const result = await BookioService.bookAppointment(
        130113,
        31576,
        '15.08.2025 10:22',
        '09:00',
        mockCustomerInfo
      );

      expect(result.success).toBe(true);
      expect(result.booking).toEqual(mockBookingSuccess.data);
      expect(result.order).toEqual(mockBookingSuccess.data.order);
      
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://services.bookio.com/widget/api/createReservation?lang=en',
        expect.objectContaining({
          serviceId: 130113,
          workerId: 31576,
          date: '15.08.2025',
          hour: '09:00',
          personalInfo: expect.objectContaining({
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
            phone: '+421910123456'
          })
        }),
        expect.any(Object)
      );
    });

    test('should handle booking failure from API', async () => {
      mockedAxios.post.mockResolvedValue(mockBookingFailure);

      const result = await BookioService.bookAppointment(
        130113,
        31576,
        '15.08.2025 10:22',
        '09:00',
        mockCustomerInfo
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Booking failed - API returned success: false');
      expect(result.details).toEqual(mockBookingFailure.data.errors);
    });

    test('should handle network errors during booking', async () => {
      mockedAxios.post.mockRejectedValue(networkError);

      const result = await BookioService.bookAppointment(
        130113,
        31576,
        '15.08.2025 10:22',
        '09:00',
        mockCustomerInfo
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network Error');
    });

    test('should correctly format date without time for booking payload', async () => {
      mockedAxios.post.mockResolvedValue(mockBookingSuccess);

      await BookioService.bookAppointment(
        130113,
        31576,
        '15.08.2025 10:22',
        '09:00',
        mockCustomerInfo
      );

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          date: '15.08.2025'  // Should strip the time part
        }),
        expect.any(Object)
      );
    });
  });

  describe('checkSlotAvailability', () => {
    test('should confirm slot is available', async () => {
      mockedAxios.post.mockResolvedValue({ data: mockAllowedTimes });

      const result = await BookioService.checkSlotAvailability(
        130113,
        31576,
        '15.08.2025 10:22',
        '09:00'
      );

      expect(result.available).toBe(true);
      expect(result.slot).toBeDefined();
      expect(result.slot.id).toBe('09:00');
    });

    test('should detect unavailable slot', async () => {
      mockedAxios.post.mockResolvedValue({ data: mockAllowedTimes });

      const result = await BookioService.checkSlotAvailability(
        130113,
        31576,
        '15.08.2025 10:22',
        '16:00'  // Not in the mock data
      );

      expect(result.available).toBe(false);
      expect(result.reason).toBe('Requested time slot not available');
    });

    test('should handle API errors when checking availability', async () => {
      mockedAxios.post.mockRejectedValue(networkError);

      const result = await BookioService.checkSlotAvailability(
        130113,
        31576,
        '15.08.2025 10:22',
        '09:00'
      );

      expect(result.available).toBe(false);
      expect(result.reason).toBe('Network Error');
    });

    test('should handle failed times fetch', async () => {
      mockedAxios.post.mockResolvedValue({ data: { success: false } });

      // Mock the getAllowedTimes to return failure
      const originalGetAllowedTimes = BookioService.getAllowedTimes;
      BookioService.getAllowedTimes = jest.fn().mockResolvedValue({
        success: false,
        error: 'API Error'
      });

      const result = await BookioService.checkSlotAvailability(
        130113,
        31576,
        '15.08.2025 10:22',
        '09:00'
      );

      expect(result.available).toBe(false);
      expect(result.reason).toBe('Could not fetch available times');

      // Restore original method
      BookioService.getAllowedTimes = originalGetAllowedTimes;
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle malformed API responses', async () => {
      mockedAxios.post.mockResolvedValue({ data: null });

      const result = await BookioService.getAllowedDays();

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });

    test('should handle undefined responses', async () => {
      mockedAxios.post.mockResolvedValue(undefined);

      const result = await BookioService.getAllowedTimes(130113, '15.08.2025 10:22');

      expect(result.success).toBe(true);
    });

    test('should handle very large days to check parameter', async () => {
      mockedAxios.post.mockResolvedValue({ data: { data: null } });

      const result = await BookioService.getSoonestAvailable(130113, 31576, 365);

      // Should fallback to manual checking
      expect(mockedAxios.post).toHaveBeenCalled();
    });

    test('should handle empty time slots arrays', async () => {
      const emptyTimesResponse = {
        data: {
          times: {
            all: [],
            mornings: { data: [] },
            afternoon: { data: [] }
          }
        }
      };

      mockedAxios.post
        .mockResolvedValueOnce({ data: mockAllowedDays })
        .mockResolvedValue({ data: emptyTimesResponse });

      const result = await BookioService.getSoonestAvailable(130113, 31576, 7);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No available appointments found');
    });
  });
});