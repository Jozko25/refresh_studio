import axios from 'axios';

class BookioService {
  constructor() {
    this.baseURL = process.env.BOOKIO_BASE_URL || 'https://services.bookio.com';
    this.facilityId = process.env.BOOKIO_FACILITY_ID || '16052';
    this.widgetAPI = `${this.baseURL}/widget/api`;
    
    // Common headers based on the browser request
    this.headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/plain, */*',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
      'Origin': this.baseURL,
      'Referer': `${this.baseURL}/${this.facilityId}/widget`,
      'X-Requested-With': 'XMLHttpRequest',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br, zstd'
    };
  }

  /**
   * Get all available services from the booking widget
   * This extracts service information from the widget page
   */
  async getServices() {
    try {
      // Updated with real service information from facility 16052
      return {
        success: true,
        services: [
          {
            id: 130113, // Real serviceId from the network requests
            name: "Service",
            workerId: 31576, // Real workerId from the network requests
            duration: 10, // Based on the response showing 10-minute appointments
            price: null, // Price not shown in the time response
            currency: "€"
          }
        ]
      };
    } catch (error) {
      console.error('Error fetching services:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get allowed days for a specific service
   */
  async getAllowedDays(serviceId = 130113, workerId = 31576, count = 1, participantsCount = 0, addons = []) {
    try {
      const payload = {
        serviceId: parseInt(serviceId),
        workerId: parseInt(workerId),
        addons,
        count,
        participantsCount
      };

      const response = await axios.post(`${this.widgetAPI}/allowedDays?lang=en`, payload, {
        headers: this.headers
      });

      return {
        success: true,
        data: response.data.data, // Extract the nested data object
        raw: response.data
      };
    } catch (error) {
      console.error('Error fetching allowed days:', error.message);
      return {
        success: false,
        error: error.message,
        details: error.response?.data || null
      };
    }
  }

  /**
   * Get allowed times for a specific service and date
   */
  async getAllowedTimes(serviceId = 130113, date, workerId = 31576, count = 1, participantsCount = 0, addons = []) {
    try {
      const payload = {
        serviceId: parseInt(serviceId),
        workerId: parseInt(workerId),
        addons,
        count,
        participantsCount,
        date, // Format: "15.08.2025 10:22"
        lang: 'en'
      };

      const response = await axios.post(`${this.widgetAPI}/allowedTimes?lang=en`, payload, {
        headers: this.headers
      });

      return {
        success: true,
        data: response.data.data, // Extract the nested data object
        times: response.data.data?.times, // Direct access to times object
        raw: response.data
      };
    } catch (error) {
      console.error('Error fetching allowed times:', error.message);
      return {
        success: false,
        error: error.message,
        details: error.response?.data || null
      };
    }
  }

  /**
   * Get the soonest available appointment time
   */
  async getSoonestAvailable(serviceId = 130113, workerId = 31576, daysToCheck = 30) {
    try {
      // First, try to get allowed days
      const allowedDaysResult = await this.getAllowedDays(serviceId, workerId);
      
      let allowedDays = [];
      let currentYear = new Date().getFullYear();
      let currentMonth = new Date().getMonth() + 1;
      
      if (allowedDaysResult.success && allowedDaysResult.data && allowedDaysResult.data.allowedDays) {
        // Use the API response if available
        const allowedDaysData = allowedDaysResult.data;
        allowedDays = allowedDaysData.allowedDays;
        currentYear = allowedDaysData.year || currentYear;
        currentMonth = allowedDaysData.month || currentMonth;
        console.log(`📅 Using API allowed days: ${allowedDays.length} days in ${currentMonth}/${currentYear}`);
      } else {
        // Fallback: check the next daysToCheck days manually
        console.log(`📅 Allowed days API returned null, falling back to checking next ${daysToCheck} days`);
        const today = new Date();
        for (let i = 0; i < daysToCheck; i++) {
          const checkDate = new Date(today);
          checkDate.setDate(today.getDate() + i);
          allowedDays.push(checkDate.getDate());
        }
        currentYear = today.getFullYear();
        currentMonth = today.getMonth() + 1;
      }

      // Check each day to find available times
      for (const day of allowedDays) {
        const checkDate = new Date(currentYear, currentMonth - 1, day, 10, 0); // Set to 10:00 AM
        const dateString = this.formatDateForAPI(checkDate);
        
        console.log(`🔍 Checking times for ${dateString}`);
        
        const timesResult = await this.getAllowedTimes(serviceId, dateString, workerId);
        
        if (timesResult.success && timesResult.times && timesResult.times.all && timesResult.times.all.length > 0) {
          const firstTime = timesResult.times.all[0];
          
          console.log(`✅ Found available times on ${dateString}, first slot: ${firstTime.name}`);
          
          return {
            success: true,
            soonestAvailable: {
              date: dateString,
              day: day,
              month: currentMonth,
              year: currentYear,
              firstTime: {
                id: firstTime.id,
                name: firstTime.name,
                nameSuffix: firstTime.nameSuffix
              },
              allTimes: timesResult.times.all,
              morningTimes: timesResult.times.mornings?.data || [],
              afternoonTimes: timesResult.times.afternoon?.data || [],
              serviceId: serviceId,
              workerId: workerId
            }
          };
        } else {
          console.log(`❌ No times available for ${dateString}`);
        }
      }

      return {
        success: false,
        error: `No available appointments found in the next ${allowedDays.length} days checked`,
        daysChecked: allowedDays.length
      };
    } catch (error) {
      console.error('Error finding soonest available:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Format date for Bookio API (DD.MM.YYYY HH:mm format)
   */
  formatDateForAPI(date) {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    return `${day}.${month}.${year} ${hours}:${minutes}`;
  }

  /**
   * Parse time slots from the API response
   */
  parseTimeSlots(timesData) {
    if (!timesData || !timesData.times) {
      return [];
    }

    const times = timesData.times;
    const allTimes = times.all || [];
    
    return allTimes.map(timeSlot => ({
      id: timeSlot.id,
      name: timeSlot.name,
      nameSuffix: timeSlot.nameSuffix,
      available: true,
      period: timeSlot.id < '12:00' ? 'morning' : 'afternoon'
    }));
  }

  /**
   * Get next available slots for multiple services
   */
  async getNextAvailableForAllServices(daysToCheck = 7) {
    try {
      const servicesResult = await this.getServices();
      
      if (!servicesResult.success) {
        return servicesResult;
      }

      const results = {};
      
      for (const service of servicesResult.services) {
        const soonestResult = await this.getSoonestAvailable(service.id, service.workerId, daysToCheck);
        results[service.id] = {
          service: service,
          ...soonestResult
        };
      }

      return {
        success: true,
        data: results
      };
    } catch (error) {
      console.error('Error getting next available for all services:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Book an appointment using the real Bookio API
   */
  async bookAppointment(serviceId = 130113, workerId = 31576, date, time, customerInfo) {
    try {
      // Convert date format from "15.08.2025 10:22" to "15.08.2025"
      const dateOnly = date.split(' ')[0];
      
      // Real Bookio API payload structure based on network inspection
      const payload = {
        serviceId: parseInt(serviceId),
        termId: null,
        workerId: parseInt(workerId),
        date: dateOnly, // Format: "15.08.2025"
        hour: time, // Format: "14:45"
        addons: [],
        cashGiftCard: null,
        count: 1,
        courseParticipants: [],
        firstService: {
          termId: parseInt(serviceId),
          count: null
        },
        height: 1080,
        items: null,
        lang: 'en',
        note: customerInfo.note || '',
        personalInfo: {
          subscribe: false,
          isBuyer: true,
          giftCard: {
            countOfUse: 1,
            id: 0
          },
          firstName: customerInfo.firstName,
          lastName: customerInfo.lastName,
          email: customerInfo.email,
          phone: customerInfo.phone || '+421910223761',
          acceptGenTerms: true,
          selectedCountry: 'sk'
        },
        priceLevels: null,
        requiredCustomersInfo: true,
        reservationSource: {
          source: "WIDGET_WEB",
          url: "",
          isZlavaDnaSource: false,
          code: "reservationSource.title.widget.web"
        },
        secondService: null,
        tags: [],
        thirdService: null,
        width: 1920,
        wlHash: null,
        _vrf: null,
        _vrfm: false
      };

      console.log(`📅 Booking appointment via real Bookio API:`, {
        service: serviceId,
        worker: workerId,
        date: dateOnly,
        time: time,
        customer: `${customerInfo.firstName} ${customerInfo.lastName}`,
        email: customerInfo.email
      });

      // Use the real Bookio booking endpoint
      const endpoint = `${this.widgetAPI}/createReservation?lang=en`;
      
      const response = await axios.post(endpoint, payload, {
        headers: this.headers
      });

      console.log(`✅ Booking API response:`, JSON.stringify(response.data, null, 2));
      
      if (response.data?.data?.success) {
        return {
          success: true,
          booking: response.data.data,
          order: response.data.data.order,
          endpoint: endpoint
        };
      } else {
        console.log(`❌ Booking validation errors:`, response.data?.data?.errors);
        return {
          success: false,
          error: 'Booking failed - API returned success: false',
          details: response.data?.data?.errors || response.data
        };
      }

    } catch (error) {
      console.error('Error booking appointment:', error.message);
      return {
        success: false,
        error: error.message,
        details: error.response?.data || null
      };
    }
  }

  /**
   * Validate booking data before submission
   */
  validateBookingData(serviceId, workerId, date, time, customerInfo) {
    const errors = [];

    if (!serviceId) errors.push('Service ID is required');
    if (!workerId) errors.push('Worker ID is required');
    if (!date) errors.push('Date is required');
    if (!time) errors.push('Time is required');
    
    if (!customerInfo) {
      errors.push('Customer information is required');
    } else {
      if (!customerInfo.firstName) errors.push('Customer first name is required');
      if (!customerInfo.lastName) errors.push('Customer last name is required');
      if (!customerInfo.email) errors.push('Customer email is required');
      
      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (customerInfo.email && !emailRegex.test(customerInfo.email)) {
        errors.push('Valid email address is required');
      }
    }

    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * Check if a specific time slot is still available before booking
   */
  async checkSlotAvailability(serviceId, workerId, date, time) {
    try {
      const timesResult = await this.getAllowedTimes(serviceId, date, workerId);
      
      if (!timesResult.success) {
        return { available: false, reason: 'Could not fetch available times' };
      }

      const allTimes = timesResult.times.all || [];
      const requestedSlot = allTimes.find(slot => slot.id === time);
      
      if (!requestedSlot) {
        return { available: false, reason: 'Requested time slot not available' };
      }

      return { available: true, slot: requestedSlot };
    } catch (error) {
      return { available: false, reason: error.message };
    }
  }
}

export default new BookioService();
