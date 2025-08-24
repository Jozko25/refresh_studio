import BookioDirectService from '../../src/services/bookioDirectService.js';

describe('BookioDirectService', () => {
  test('should be importable', () => {
    expect(BookioDirectService).toBeDefined();
  });

  test('should have required methods', () => {
    expect(typeof BookioDirectService.searchServices).toBe('function');
    expect(typeof BookioDirectService.getAvailableTimesAndDays).toBe('function');
    expect(typeof BookioDirectService.getAllowedTimes).toBe('function');
    expect(typeof BookioDirectService.getAllowedDays).toBe('function');
    expect(typeof BookioDirectService.getWorkers).toBe('function');
  });

  test('should have proper configuration', () => {
    expect(BookioDirectService.baseURL).toContain('bookio.com');
  });
});