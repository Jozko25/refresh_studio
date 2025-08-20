import express from 'express';
import bookioService from '../services/bookioService.js';

const router = express.Router();

/**
 * GET /api/booking/services
 * Get all available services
 */
router.get('/services', async (req, res) => {
  try {
    const result = await bookioService.getServices();
    
    if (result.success) {
      res.json({
        success: true,
        services: result.services,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/booking/allowed-days
 * Get allowed days for a service
 * Body: { serviceId?: number, workerId?: number, count?: number, participantsCount?: number, addons?: array }
 */
router.post('/allowed-days', async (req, res) => {
  try {
    const { serviceId = 130113, workerId = 31576, count, participantsCount, addons } = req.body;

    const result = await bookioService.getAllowedDays(serviceId, workerId, count, participantsCount, addons);
    
    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        raw: result.raw,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        details: result.details,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/booking/allowed-times
 * Get allowed times for a service and date
 * Body: { serviceId?: number, date: string, workerId?: number, count?: number, participantsCount?: number, addons?: array }
 */
router.post('/allowed-times', async (req, res) => {
  try {
    const { serviceId = 130113, date, workerId = 31576, count, participantsCount, addons } = req.body;
    
    if (!date) {
      return res.status(400).json({
        success: false,
        error: 'date is required (format: "15.08.2025 10:22")',
        timestamp: new Date().toISOString()
      });
    }

    const result = await bookioService.getAllowedTimes(serviceId, date, workerId, count, participantsCount, addons);
    
    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        times: result.times,
        raw: result.raw,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        details: result.details,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/booking/soonest-available
 * Get the soonest available appointment
 * Body: { serviceId?: number, workerId?: number, daysToCheck?: number }
 */
router.post('/soonest-available', async (req, res) => {
  try {
    const { serviceId = 130113, workerId = 31576, daysToCheck = 30 } = req.body;

    const result = await bookioService.getSoonestAvailable(serviceId, workerId, daysToCheck);
    
    if (result.success) {
      res.json({
        success: true,
        soonestAvailable: result.soonestAvailable,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(404).json({
        success: false,
        error: result.error,
        allowedDays: result.allowedDays,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/booking/next-available-all
 * Get next available appointments for all services
 * Query: ?days=7
 */
router.get('/next-available-all', async (req, res) => {
  try {
    const daysToCheck = parseInt(req.query.days) || 7;

    const result = await bookioService.getNextAvailableForAllServices(daysToCheck);
    
    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        daysChecked: daysToCheck,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /webhook/soonest-available
 * Webhook endpoint for external services
 * Responds with soonest available appointment time
 */
router.post('/webhook/soonest-available', async (req, res) => {
  try {
    const { serviceId = 130113, workerId = 31576, daysToCheck = 30, source } = req.body;
    
    console.log(`📥 Webhook received from ${source || 'unknown'} for soonest available appointment`);
    console.log(`🔍 Parameters: serviceId=${serviceId}, workerId=${workerId}, daysToCheck=${daysToCheck}`);
    
    const result = await bookioService.getSoonestAvailable(serviceId, workerId, daysToCheck);
    
    if (result.success) {
      const response = {
        success: true,
        message: 'Soonest available appointment found',
        appointment: {
          date: result.soonestAvailable.date,
          day: result.soonestAvailable.day,
          month: result.soonestAvailable.month,
          year: result.soonestAvailable.year,
          firstAvailableTime: result.soonestAvailable.firstTime,
          allAvailableTimes: result.soonestAvailable.allTimes,
          morningTimes: result.soonestAvailable.morningTimes,
          afternoonTimes: result.soonestAvailable.afternoonTimes,
          serviceId: result.soonestAvailable.serviceId,
          workerId: result.soonestAvailable.workerId
        },
        timestamp: new Date().toISOString(),
        source: source || 'webhook'
      };
      
      console.log(`✅ Webhook response: Found appointment on ${result.soonestAvailable.date} at ${result.soonestAvailable.firstTime.name}`);
      res.json(response);
    } else {
      const response = {
        success: false,
        message: 'No available appointments found',
        error: result.error,
        allowedDays: result.allowedDays,
        timestamp: new Date().toISOString(),
        source: source || 'webhook'
      };
      
      console.log(`❌ Webhook response: ${result.error}`);
      res.status(404).json(response);
    }
  } catch (error) {
    console.error('Webhook error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /webhook/elevenlabs-available-times
 * ElevenLabs compatible endpoint - returns Slovak language response with max 3 times
 */
router.post('/webhook/elevenlabs-available-times', async (req, res) => {
  try {
    const { serviceId = 130113, workerId = 31576, date, maxTimes = 3, source } = req.body;
    
    console.log(`📥 ElevenLabs webhook received from ${source || 'unknown'}`);
    
    let timesResult;
    
    if (date) {
      // Get times for specific date
      timesResult = await bookioService.getAllowedTimes(serviceId, date, workerId);
    } else {
      // Get soonest available
      const soonestResult = await bookioService.getSoonestAvailable(serviceId, workerId, 7);
      if (soonestResult.success) {
        timesResult = {
          success: true,
          times: {
            all: soonestResult.soonestAvailable.allTimes
          }
        };
      } else {
        return res.json({
          response: "Ľutujem, ale momentálne nie sú dostupné žiadne termíny na rezerváciu.",
          success: false,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    if (timesResult.success && timesResult.times) {
      // Combine morning and afternoon times and take first 3
      const morningTimes = timesResult.times.mornings?.data || [];
      const afternoonTimes = timesResult.times.afternoon?.data || [];
      const allTimes = [...morningTimes, ...afternoonTimes];
      
      if (allTimes.length > 0) {
        const availableTimes = allTimes.slice(0, maxTimes);
        
        // Format times in Slovak using the END TIME (name field) which matches the widget display
        const timeStrings = availableTimes.map(time => {
          // The 'name' field contains the end time that matches the widget (e.g., "12:10", "12:25")
          const endTime = time.name;
          const [hours, minutes] = endTime.split(':');
          const hour24 = parseInt(hours);
          
          // Convert to Slovak format
          const hour12 = hour24 > 12 ? hour24 - 12 : hour24;
          const period = hour24 >= 12 ? 'poobede' : 'dopoludnia';
          
          if (hour24 === 12) {
            return `12:${minutes} v poludnie`;
          } else if (hour24 === 0) {
            return `12:${minutes} o polnoci`;
          } else {
            return `${hour12}:${minutes} ${period}`;
          }
        });
        
        // Create Slovak response
        let response;
        if (timeStrings.length === 1) {
          response = `Dostupný je termín o ${timeStrings[0]}.`;
        } else if (timeStrings.length === 2) {
          response = `Dostupné sú termíny o ${timeStrings[0]} a ${timeStrings[1]}.`;
        } else {
          const lastTime = timeStrings.pop();
          response = `Dostupné sú termíny o ${timeStrings.join(', ')} a ${lastTime}.`;
        }
        
        console.log(`✅ ElevenLabs response: ${response}`);
        
        res.json({
          response: response,
          success: true,
          availableTimes: availableTimes.map(t => ({
            time: t.id,
            display: t.name
          })),
          timestamp: new Date().toISOString(),
          source: source || 'elevenlabs'
        });
        
      } else {
        const response = "Ľutujem, ale na požadovaný dátum nie sú dostupné žiadne termíny.";
        console.log(`❌ ElevenLabs response: ${response}`);
        
        res.json({
          response: response,
          success: false,
          timestamp: new Date().toISOString(),
          source: source || 'elevenlabs'
        });
      }
    } else {
      const response = "Ľutujem, ale na požadovaný dátum nie sú dostupné žiadne termíny.";
      console.log(`❌ ElevenLabs response: ${response}`);
      
      res.json({
        response: response,
        success: false,
        timestamp: new Date().toISOString(),
        source: source || 'elevenlabs'
      });
    }
    
  } catch (error) {
    console.error('ElevenLabs webhook error:', error.message);
    res.status(500).json({
      response: "Ľutujem, vyskytla sa technická chyba. Skúste to prosím neskôr.",
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /webhook/elevenlabs-soonest-available
 * ElevenLabs compatible endpoint - returns Slovak response for soonest available
 */
router.post('/webhook/elevenlabs-soonest-available', async (req, res) => {
  try {
    const { serviceId = 130113, workerId = 31576, daysToCheck = 7, source } = req.body;
    
    console.log(`📥 ElevenLabs soonest available webhook from ${source || 'unknown'}`);
    
    const result = await bookioService.getSoonestAvailable(serviceId, workerId, daysToCheck);
    
    if (result.success) {
      const appointment = result.soonestAvailable;
      const firstTime = appointment.firstTime;
      
      // Format date in Slovak
      const date = new Date(appointment.year, appointment.month - 1, appointment.day);
      const dayNames = ['nedeľa', 'pondelok', 'utorok', 'streda', 'štvrtok', 'piatok', 'sobota'];
      const monthNames = ['január', 'február', 'marec', 'apríl', 'máj', 'jún', 
                         'júl', 'august', 'september', 'október', 'november', 'december'];
      
      const dayName = dayNames[date.getDay()];
      const monthName = monthNames[date.getMonth()];
      
      // Format time in Slovak
      const [hours, minutes] = firstTime.id.split(':');
      const hour24 = parseInt(hours);
      const hour12 = hour24 > 12 ? hour24 - 12 : hour24;
      const period = hour24 >= 12 ? 'poobede' : 'dopoludnia';
      
      let timeStr;
      if (hour24 === 12) {
        timeStr = `12:${minutes} v poludnie`;
      } else if (hour24 === 0) {
        timeStr = `12:${minutes} o polnoci`;
      } else {
        timeStr = `${hour12}:${minutes} ${period}`;
      }
      
      const response = `Najbližší dostupný termín je v ${dayName} ${appointment.day}. ${monthName} o ${timeStr}.`;
      
      console.log(`✅ ElevenLabs soonest response: ${response}`);
      
      res.json({
        response: response,
        success: true,
        appointment: {
          date: `${appointment.day}. ${monthName} ${appointment.year}`,
          time: timeStr,
          dayName: dayName
        },
        timestamp: new Date().toISOString(),
        source: source || 'elevenlabs'
      });
      
    } else {
      const response = `Ľutujem, ale v najbližších ${daysToCheck} dňoch nie sú dostupné žiadne termíny na rezerváciu.`;
      console.log(`❌ ElevenLabs soonest response: ${response}`);
      
      res.json({
        response: response,
        success: false,
        daysChecked: daysToCheck,
        timestamp: new Date().toISOString(),
        source: source || 'elevenlabs'
      });
    }
    
  } catch (error) {
    console.error('ElevenLabs soonest webhook error:', error.message);
    res.status(500).json({
      response: "Ľutujem, vyskytla sa technická chyba. Skúste to prosím neskôr.",
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/booking/book-appointment
 * Book an appointment with customer details
 * Body: { serviceId?, workerId?, date, time, customer: { firstName, lastName, email, phone?, note? } }
 */
router.post('/book-appointment', async (req, res) => {
  try {
    const { 
      serviceId = 130113, 
      workerId = 31576, 
      date, 
      time, 
      customer,
      source 
    } = req.body;
    
    console.log(`📥 Booking request from ${source || 'unknown'}`);
    
    // Validate input data
    const validation = bookioService.validateBookingData(serviceId, workerId, date, time, customer);
    
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validation.errors,
        timestamp: new Date().toISOString()
      });
    }
    
    // Check if the time slot is still available
    const availability = await bookioService.checkSlotAvailability(serviceId, workerId, date, time);
    
    if (!availability.available) {
      return res.status(409).json({
        success: false,
        error: 'Time slot no longer available',
        reason: availability.reason,
        timestamp: new Date().toISOString()
      });
    }
    
    // Attempt to book the appointment
    const result = await bookioService.bookAppointment(serviceId, workerId, date, time, customer);
    
    if (result.success) {
      console.log(`✅ Booking successful for ${customer.firstName} ${customer.lastName}`);
      
      res.json({
        success: true,
        message: 'Appointment booked successfully',
        booking: result.booking,
        appointment: {
          serviceId: serviceId,
          workerId: workerId,
          date: date,
          time: time,
          customer: {
            name: `${customer.firstName} ${customer.lastName}`,
            email: customer.email,
            phone: customer.phone
          }
        },
        timestamp: new Date().toISOString(),
        source: source || 'api'
      });
    } else {
      console.log(`❌ Booking failed: ${result.error}`);
      
      res.status(500).json({
        success: false,
        error: result.error,
        details: result.details,
        attempted: result.attempted,
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error('Booking endpoint error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/booking/webhook/elevenlabs-book-appointment
 * ElevenLabs compatible booking endpoint - returns Slovak confirmation
 */
router.post('/webhook/elevenlabs-book-appointment', async (req, res) => {
  try {
    const { 
      serviceId = 130113, 
      workerId = 31576, 
      date, 
      time, 
      customer,
      source 
    } = req.body;
    
    console.log(`📥 ElevenLabs booking request from ${source || 'unknown'}`);
    
    // Validate input data
    const validation = bookioService.validateBookingData(serviceId, workerId, date, time, customer);
    
    if (!validation.isValid) {
      const response = `Ľutujem, ale zadané údaje nie sú kompletné. ${validation.errors.join(', ')}.`;
      return res.status(400).json({
        response: response,
        success: false,
        errors: validation.errors,
        timestamp: new Date().toISOString()
      });
    }
    
    // Check availability first
    const availability = await bookioService.checkSlotAvailability(serviceId, workerId, date, time);
    
    if (!availability.available) {
      const response = `Ľutujem, ale zvolený termín už nie je dostupný. ${availability.reason}.`;
      return res.status(409).json({
        response: response,
        success: false,
        timestamp: new Date().toISOString()
      });
    }
    
    // Attempt booking
    const result = await bookioService.bookAppointment(serviceId, workerId, date, time, customer);
    
    if (result.success) {
      // Format date and time in Slovak
      const [day, month, year] = date.split('.');
      const monthNames = ['január', 'február', 'marec', 'apríl', 'máj', 'jún', 
                         'júl', 'august', 'september', 'október', 'november', 'december'];
      const monthName = monthNames[parseInt(month) - 1];
      
      // Format time
      const [hours, minutes] = time.split(':');
      const hour24 = parseInt(hours);
      const hour12 = hour24 > 12 ? hour24 - 12 : hour24;
      const period = hour24 >= 12 ? 'poobede' : 'dopoludnia';
      
      let timeStr;
      if (hour24 === 12) {
        timeStr = `12:${minutes} v poludnie`;
      } else if (hour24 === 0) {
        timeStr = `12:${minutes} o polnoci`;
      } else {
        timeStr = `${hour12}:${minutes} ${period}`;
      }
      
      const response = `Perfektne! Váš termín na ${parseInt(day)}. ${monthName} o ${timeStr} bol úspešne rezervovaný pre ${customer.firstName} ${customer.lastName}.`;
      
      console.log(`✅ ElevenLabs booking response: ${response}`);
      
      res.json({
        response: response,
        success: true,
        appointment: {
          date: `${parseInt(day)}. ${monthName} ${year}`,
          time: timeStr,
          customer: `${customer.firstName} ${customer.lastName}`,
          email: customer.email
        },
        timestamp: new Date().toISOString(),
        source: source || 'elevenlabs'
      });
    } else {
      const response = `Ľutujem, ale rezervácia sa nepodarila. ${result.error}. Skúste to prosím neskôr.`;
      
      console.log(`❌ ElevenLabs booking response: ${response}`);
      
      res.status(500).json({
        response: response,
        success: false,
        error: result.error,
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error('ElevenLabs booking error:', error.message);
    res.status(500).json({
      response: "Ľutujem, vyskytla sa technická chyba pri rezervácii. Skúste to prosím neskôr.",
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/booking/check-availability
 * Check if a specific time slot is available
 */
router.post('/check-availability', async (req, res) => {
  try {
    const { serviceId = 130113, workerId = 31576, date, time } = req.body;
    
    if (!date || !time) {
      return res.status(400).json({
        success: false,
        error: 'Date and time are required',
        timestamp: new Date().toISOString()
      });
    }
    
    const result = await bookioService.checkSlotAvailability(serviceId, workerId, date, time);
    
    res.json({
      success: true,
      available: result.available,
      reason: result.reason,
      slot: result.slot,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/booking/webhook/elevenlabs-unified
 * Unified ElevenLabs webhook endpoint for all booking operations
 */
router.post('/webhook/elevenlabs-unified', async (req, res) => {
  try {
    const { 
      action, 
      date, 
      time, 
      customer, 
      customer_name,
      phone, 
      appointment_date,
      // Enhanced validation parameters
      patient_name,
      patient_surname, 
      full_patient_name,
      date_time,
      preferred_time,
      appointment_type,
      current_count,
      // Rescheduling parameters
      old_date,
      old_time,
      new_date,
      new_time,
      new_date_time,
    } = req.body;
    
    console.log(`📥 ElevenLabs enhanced request - Action: ${action}`);
    console.log(`🔍 Validation params: phone=${phone}, patient_name=${patient_name}, patient_surname=${patient_surname}`);
    
    // Enhanced phone validation
    const validatePhone = (phoneNumber) => {
      if (!phoneNumber) return { valid: false, message: "Telefónne číslo je povinné." };
      const phonePattern = /^\+421[0-9]{9}$/;
      if (!phonePattern.test(phoneNumber)) {
        return { valid: false, message: "Prosím, zadajte platné slovenské telefónne číslo (+421XXXXXXXXX)." };
      }
      return { valid: true, message: "Telefónne číslo je platné." };
    };
    
    // Enhanced customer validation
    const validateCustomerData = (customerData, phone) => {
      const errors = [];
      if (!customerData?.firstName && !patient_name) errors.push("krstné meno");
      if (!customerData?.lastName && !patient_surname) errors.push("priezvisko");
      if (!customerData?.phone && !phone) errors.push("telefón");
      
      // Cross-validate names if provided
      if (patient_name && patient_surname && full_patient_name) {
        const expectedFullName = `${patient_name} ${patient_surname}`;
        if (full_patient_name !== expectedFullName) {
          errors.push("meno a priezvisko sa nezhodujú");
        }
      }
      
      return {
        valid: errors.length === 0,
        errors: errors,
        message: errors.length === 0 ? "Údaje sú platné" : `Pre rezerváciu potrebujem: ${errors.join(', ')}.`
      };
    };
    
    switch (action) {
      case 'get_available_slots':
      case 'get_available_times':
        if (!date) {
          return res.status(400).json({
            response: "Ľutujem, potrebujem dátum pre kontrolu dostupnosti.",
            success: false,
            timestamp: new Date().toISOString()
          });
        }
        
        console.log(`🔍 Getting available times for ${date}, preferred_time: ${preferred_time}`);
        const timesResult = await bookioService.getAllowedTimes(130113, `${date} 10:00`, 31576);
        
        if (!timesResult.success || !timesResult.times?.all?.length) {
          return res.json({
            response: `Na ${date} bohužiaľ nemáme žiadne voľné termíny. Skúste prosím iný deň.`,
            success: false,
            timestamp: new Date().toISOString()
          });
        }
        
        let availableTimes = timesResult.times.all || [];
        
        // Filter by preferred time if specified
        if (preferred_time === 'morning') {
          availableTimes = availableTimes.filter(slot => {
            const hour = parseInt(slot.id.split(':')[0]);
            return hour < 12;
          });
        } else if (preferred_time === 'afternoon') {
          availableTimes = availableTimes.filter(slot => {
            const hour = parseInt(slot.id.split(':')[0]);
            return hour >= 12;
          });
        }
        
        // Limit to 5 slots for initial display
        const displayTimes = availableTimes.slice(0, 5);
        const hasMore = availableTimes.length > 5;
        
        const timesList = displayTimes.map(slot => {
          const endTime = slot.nameSuffix || slot.name;
          return endTime.replace(' AM', ' dopoludnia').replace(' PM', ' poobede');
        }).join(', ');
        
        let response = `Dostupné termíny na ${date}: ${timesList}.`;
        if (hasMore) {
          response += ` Mám ešte ďalšie termíny, ak potrebujete.`;
        }
        
        return res.json({
          response: response,
          success: true,
          available_times: displayTimes,
          has_more: hasMore,
          total_available: availableTimes.length,
          timestamp: new Date().toISOString()
        });
        
      case 'find_closest_slot':
      case 'get_soonest_available':
        // Check next 14 days for available slots
        const today = new Date();
        
        for (let i = 0; i < 14; i++) {
          const checkDate = new Date(today);
          checkDate.setDate(today.getDate() + i);
          const displayDate = checkDate.toLocaleDateString('sk-SK'); // DD.MM.YYYY
          
          const dayResult = await bookioService.getAllowedTimes(130113, `${displayDate} 10:00`, 31576);
          
          if (dayResult.success && dayResult.times?.all?.length > 0) {
            const firstAvailable = dayResult.times.all[0];
            
            // Format date to Slovak
            const dayName = checkDate.toLocaleDateString('sk-SK', { weekday: 'long' });
            const monthName = checkDate.toLocaleDateString('sk-SK', { month: 'long' });
            const dayNum = checkDate.getDate();
            
            // Convert time format
            const displayTime = (firstAvailable.nameSuffix || firstAvailable.name).replace(' AM', ' dopoludnia').replace(' PM', ' poobede');
            
            return res.json({
              response: `Najbližší dostupný termín je v ${dayName} ${dayNum}. ${monthName} o ${displayTime}.`,
              success: true,
              soonest_slot: {
                date: displayDate,
                time: firstAvailable.id,
                display_time: displayTime,
                slot: firstAvailable
              },
              timestamp: new Date().toISOString()
            });
          }
        }
        
        return res.json({
          response: "V najbližších 14 dňoch nemáme žiadne voľné termíny. Kontaktujte nás prosím priamo.",
          success: false,
          timestamp: new Date().toISOString()
        });
        
      case 'book_appointment':
        if (!date || !time || !phone) {
          return res.status(400).json({
            response: "Ľutujem, potrebujem dátum, čas a telefónne číslo pre rezerváciu.",
            success: false,
            timestamp: new Date().toISOString()
          });
        }
        
        // Handle name parsing - support both formats
        let firstName = 'Customer';
        let lastName = 'Name';
        
        // Check for full name in any format
        const fullName = full_patient_name || customer_name || customer || req.body.name || `${patient_name || ''} ${patient_surname || ''}`.trim();
        
        if (fullName && fullName !== ' ') {
          const nameParts = fullName.split(' ').filter(part => part.length > 0);
          firstName = nameParts[0] || 'Customer';
          lastName = nameParts.slice(1).join(' ') || 'Name';
        }
        
        const customerData = {
          firstName: firstName,
          lastName: lastName,
          email: 'customer@bookio.com',
          phone: phone,
          note: `AI rezervácia - ${firstName} ${lastName}`
        };
        
        console.log(`🔍 Booking for: ${firstName} ${lastName}, ${phone}`);
        
        // Check availability first
        const availability = await bookioService.checkSlotAvailability(130113, 31576, `${date} 10:00`, time);
        
        if (!availability.available) {
          return res.status(409).json({
            response: `Ľutujem, ale zvolený termín ${time} na ${date} už nie je dostupný. ${availability.reason}.`,
            success: false,
            timestamp: new Date().toISOString()
          });
        }
        
        // Attempt booking
        const bookingResult = await bookioService.bookAppointment(130113, 31576, `${date} 10:00`, time, customerData);
        
        if (bookingResult.success) {
          const [day, month, year] = date.split('.');
          const formattedTime = time.replace(':', ':');
          
          return res.json({
            response: `Perfektne! Váš termín na ${day}. ${month}. ${year} o ${formattedTime} bol úspešne rezervovaný pre ${customerData.firstName} ${customerData.lastName}.`,
            success: true,
            appointment: {
              date: date,
              time: time,
              customer: `${customerData.firstName} ${customerData.lastName}`,
              email: customerData.email,
              phone: customerData.phone
            },
            order_id: bookingResult.booking?.order?.orderId,
            timestamp: new Date().toISOString(),
            source: "elevenlabs"
          });
        } else {
          return res.status(500).json({
            response: `Ľutujem, rezervácia sa nepodarila. ${bookingResult.error}`,
            success: false,
            timestamp: new Date().toISOString()
          });
        }
        
      case 'cancel_appointment':
        const phoneValidation = validatePhone(phone);
        if (!phoneValidation.valid) {
          return res.status(400).json({
            response: phoneValidation.message,
            success: false,
            timestamp: new Date().toISOString()
          });
        }
        
        // Enhanced customer identity validation for cancellation
        const customerValidation = validateCustomerData(customer, phone);
        if (!customerValidation.valid) {
          return res.status(400).json({
            response: `Pre zrušenie rezervácie potrebujem kompletné údaje: ${customerValidation.message}`,
            success: false,
            timestamp: new Date().toISOString()
          });
        }
        
        // For now, since we don't have direct cancellation API access,
        // provide instructions with enhanced validation feedback
        return res.json({
          response: `Rezervácia pre ${full_patient_name || `${patient_name} ${patient_surname}`} na telefónnom čísle ${phone}${appointment_date ? ` na dátum ${appointment_date}` : ''} bude zrušená. Použite prosím odkaz v potvrdzujúcom e-maile alebo nás kontaktujte priamo.`,
          success: true,
          instructions: "Use email cancellation link or contact directly",
          validated_customer: {
            phone: phone,
            name: full_patient_name || `${patient_name} ${patient_surname}`,
            appointment_date: appointment_date
          },
          timestamp: new Date().toISOString()
        });
        
      case 'reschedule_appointment':
        // Validate old appointment details
        if (!old_date || !old_time || !phone) {
          return res.status(400).json({
            response: "Pre presunutie termínu potrebujem pôvodný dátum, čas a telefónne číslo.",
            success: false,
            timestamp: new Date().toISOString()
          });
        }
        
        // Validate new appointment details
        if (!new_date || !new_time) {
          return res.status(400).json({
            response: "Pre presunutie termínu potrebujem nový dátum a čas.",
            success: false,
            timestamp: new Date().toISOString()
          });
        }
        
        // Enhanced phone and customer validation
        const reschedulePhoneValidation = validatePhone(phone);
        if (!reschedulePhoneValidation.valid) {
          return res.status(400).json({
            response: reschedulePhoneValidation.message,
            success: false,
            timestamp: new Date().toISOString()
          });
        }
        
        const rescheduleCustomerValidation = validateCustomerData(customer, phone);
        if (!rescheduleCustomerValidation.valid) {
          return res.status(400).json({
            response: `Pre presunutie termínu potrebujem kompletné údaje: ${rescheduleCustomerValidation.message}`,
            success: false,
            timestamp: new Date().toISOString()
          });
        }
        
        // Check availability of new slot
        const newSlotAvailability = await bookioService.checkSlotAvailability(130113, 31576, `${new_date} 10:00`, new_time);
        
        if (!newSlotAvailability.available) {
          return res.status(409).json({
            response: `Ľutujem, ale nový termín ${new_time} na ${new_date} už nie je dostupný. ${newSlotAvailability.reason}.`,
            success: false,
            timestamp: new Date().toISOString()
          });
        }
        
        // For now, provide instructions since we don't have direct rescheduling API
        const oldDateFormatted = old_date.split('-').reverse().join('.');
        const newDateFormatted = new_date.split('-').reverse().join('.');
        
        return res.json({
          response: `Termín pre ${full_patient_name || `${patient_name} ${patient_surname}`} bude presunutý z ${oldDateFormatted} ${old_time} na ${newDateFormatted} ${new_time}. Nový termín je dostupný. Kontaktujte nás prosím pre potvrdenie presunutia.`,
          success: true,
          reschedule_details: {
            customer: full_patient_name || `${patient_name} ${patient_surname}`,
            phone: phone,
            old_appointment: {
              date: oldDateFormatted,
              time: old_time
            },
            new_appointment: {
              date: newDateFormatted,
              time: new_time,
              available: true
            }
          },
          timestamp: new Date().toISOString()
        });
        
      case 'get_more_slots':
        if (!date) {
          return res.status(400).json({
            response: "Pre zobrazenie ďalších termínov potrebujem dátum.",
            success: false,
            timestamp: new Date().toISOString()
          });
        }
        
        // Handle missing current_count parameter
        const currentCount = current_count || 0;
        
        const moreTimesResult = await bookioService.getAllowedTimes(130113, `${date} 10:00`, 31576);
        
        if (!moreTimesResult.success || !moreTimesResult.times?.all?.length) {
          return res.json({
            response: `Na ${date} už nemám žiadne ďalšie voľné termíny.`,
            success: false,
            timestamp: new Date().toISOString()
          });
        }
        
        let allAvailableSlots = moreTimesResult.times.all || [];
        
        // Filter by preferred time if specified
        if (preferred_time === 'morning') {
          allAvailableSlots = allAvailableSlots.filter(slot => {
            const hour = parseInt(slot.id.split(':')[0]);
            return hour < 12;
          });
        } else if (preferred_time === 'afternoon') {
          allAvailableSlots = allAvailableSlots.filter(slot => {
            const hour = parseInt(slot.id.split(':')[0]);
            return hour >= 12;
          });
        }
        
        // Skip already shown slots using current_count
        const skipCount = currentCount || 5;
        const moreSlots = allAvailableSlots.slice(skipCount, skipCount + 5);
        const hasMoreSlots = allAvailableSlots.length > skipCount + 5;
        
        if (moreSlots.length === 0) {
          return res.json({
            response: `To sú všetky dostupné termíny na ${date}.`,
            success: true,
            no_more_slots: true,
            total_available: allAvailableSlots.length,
            timestamp: new Date().toISOString()
          });
        }
        
        const moreSlotsStrings = moreSlots.map(slot => {
          const endTime = slot.nameSuffix || slot.name;
          return endTime.replace(' AM', ' dopoludnia').replace(' PM', ' poobede');
        }).join(', ');
        
        let moreResponse = `Ďalšie dostupné termíny na ${date}: ${moreSlotsStrings}.`;
        if (hasMoreSlots) {
          moreResponse += ` Mám ešte ďalšie termíny, ak potrebujete.`;
        }
        
        return res.json({
          response: moreResponse,
          success: true,
          additional_times: moreSlots,
          has_more: hasMoreSlots,
          current_total_shown: skipCount + moreSlots.length,
          total_available: allAvailableSlots.length,
          timestamp: new Date().toISOString()
        });
        
      default:
        return res.status(400).json({
          response: "Ľutujem, nerozumiem tejto požiadavke. Môžete to prosím zopakovať?",
          success: false,
          error: `Unknown action: ${action}`,
          timestamp: new Date().toISOString()
        });
    }
    
  } catch (error) {
    console.error('Error in unified ElevenLabs webhook:', error.message);
    res.status(500).json({
      response: "Ľutujem, vyskytla sa technická chyba. Skúste to prosím neskôr alebo nás kontaktujte priamo.",
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
