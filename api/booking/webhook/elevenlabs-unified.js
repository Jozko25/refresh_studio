import axios from 'axios';

// Bookio service configuration
const BOOKIO_FACILITY_ID = process.env.BOOKIO_FACILITY_ID || '16052';
const WIDGET_API = 'https://services.bookio.com/widget/api';

const headers = {
  'Content-Type': 'application/json',
  'Accept': 'application/json'
};

// Helper functions
function formatDateForAPI(date) {
  const [day, month, year] = date.split('.');
  return `${day}.${month}.${year}`;
}

function formatDateForSlovakTTS(date) {
  const [day, month, year] = date.split('.');
  const dayNum = parseInt(day);
  const monthNum = parseInt(month);
  const yearNum = parseInt(year);
  
  // Slovak month names in genitive case (for dates)
  const months = [
    '', 'januára', 'februára', 'marca', 'apríla', 'mája', 'júna',
    'júla', 'augusta', 'septembra', 'októbra', 'novembra', 'decembra'
  ];
  
  // Format: "osemnásteho augusta dvetisícdvadsaťpäť"
  return `${dayNum}. ${months[monthNum]} ${yearNum}`;
}

// NEW: Enhanced date validation and parsing
function parseAndValidateDate(dateInput) {
  const today = new Date();
  let targetDate;
  
  if (dateInput.includes('.')) {
    // DD.MM.YYYY format
    const [day, month, year] = dateInput.split('.');
    targetDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  } else {
    // Handle natural language
    const lowerInput = dateInput.toLowerCase();
    
    if (lowerInput.includes('dnes') || lowerInput.includes('today')) {
      targetDate = new Date();
    } else if (lowerInput.includes('zajtra') || lowerInput.includes('tomorrow')) {
      targetDate = new Date();
      targetDate.setDate(today.getDate() + 1);
    } else if (lowerInput.includes('budúci týždeň') || lowerInput.includes('next week')) {
      targetDate = new Date();
      targetDate.setDate(today.getDate() + 7);
    } else if (lowerInput.includes('pondelok') || lowerInput.includes('monday')) {
      targetDate = getNextWeekday(today, 1);
    } else if (lowerInput.includes('utorok') || lowerInput.includes('tuesday')) {
      targetDate = getNextWeekday(today, 2);
    } else if (lowerInput.includes('streda') || lowerInput.includes('wednesday')) {
      targetDate = getNextWeekday(today, 3);
    } else if (lowerInput.includes('štvrtok') || lowerInput.includes('thursday')) {
      targetDate = getNextWeekday(today, 4);
    } else if (lowerInput.includes('piatok') || lowerInput.includes('friday')) {
      targetDate = getNextWeekday(today, 5);
    } else if (lowerInput.includes('sobota') || lowerInput.includes('saturday')) {
      targetDate = getNextWeekday(today, 6);
    } else if (lowerInput.includes('nedeľa') || lowerInput.includes('sunday')) {
      targetDate = getNextWeekday(today, 0);
    } else {
      return { isValid: false, error: "Neplatný formát dátumu. Použite DD.MM.YYYY alebo 'dnes', 'zajtra', 'pondelok', atď." };
    }
  }
  
  // Validate date is not in the past
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const targetStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
  
  if (targetStart < todayStart) {
    return { 
      isValid: false, 
      error: "Nemôžem rezervovať termín v minulosti. Prosím, vyberte dátum od dneška.",
      date: null
    };
  }
  
  // Format for API
  const formattedDate = targetDate.toLocaleDateString('sk-SK', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).replace(/\s/g, '');
  
  return { 
    isValid: true, 
    date: formattedDate,
    displayDate: formatDateForSlovakTTS(formattedDate)
  };
}

// NEW: Helper function to get next weekday
function getNextWeekday(date, targetDay) {
  const today = new Date(date);
  const currentDay = today.getDay();
  let daysUntilTarget = targetDay - currentDay;
  if (daysUntilTarget <= 0) daysUntilTarget += 7;
  
  const result = new Date(today);
  result.setDate(today.getDate() + daysUntilTarget);
  return result;
}

// NEW: Time filtering by period
function filterTimesByPeriod(times, period) {
  if (!times || !times.all) return null;
  
  const filtered = times.all.filter(slot => {
    const timeStr = slot.id;
    const hour = parseInt(timeStr.split(':')[0]);
    
    switch (period.toLowerCase()) {
      case 'ráno':
      case 'dopoludnie':
      case 'morning':
        return hour >= 6 && hour < 12;
      case 'poludnie':
      case 'noon':
        return hour >= 11 && hour <= 13;
      case 'popoludnie':
      case 'afternoon':
        return hour >= 12 && hour < 18;
      case 'večer':
      case 'evening':
        return hour >= 18 && hour <= 22;
      default:
        return true;
    }
  });
  
  return { ...times, all: filtered };
}

// NEW: Find earlier slots
async function findEarlierSlots(serviceId, workerId, date, requestedTime) {
  try {
    const times = await getAllowedTimes(serviceId, workerId, date);
    if (!times || !times.all) return null;
    
    const requestedHour = parseInt(requestedTime.split(':')[0]);
    const requestedMinute = parseInt(requestedTime.split(':')[1] || '0');
    const requestedTotalMinutes = requestedHour * 60 + requestedMinute;
    
    const earlierSlots = times.all.filter(slot => {
      const slotHour = parseInt(slot.id.split(':')[0]);
      const slotMinute = parseInt(slot.id.split(':')[1] || '0');
      const slotTotalMinutes = slotHour * 60 + slotMinute;
      return slotTotalMinutes < requestedTotalMinutes;
    });
    
    return earlierSlots.slice(-2); // Return last 2 earlier slots
  } catch (error) {
    console.error('Error finding earlier slots:', error);
    return null;
  }
}

// NEW: Get service information
function getServiceInfo() {
  return {
    success: true,
    services: [
      {
        id: 130113,
        name: "Refresh Studio Service",
        description: "Profesionálne wellness a relaxačné služby",
        duration: "10 minút",
        workerId: 31576,
        facilities: "Moderné vybavenie v relaxačnom prostredí"
      }
    ],
    facility: {
      id: BOOKIO_FACILITY_ID,
      name: "Refresh Studio",
      address: "Ihrisková 4, Bratislava-Rača",
      description: "Wellness a relaxačné centrum s profesionálnymi službami"
    }
  };
}

function formatTimeForDisplay(timeSlot, lang = 'sk') {
  const time = timeSlot.nameSuffix || timeSlot.name || timeSlot.id;
  if (lang === 'sk') {
    if (time.includes('AM') || time.includes('PM')) {
      const [timePart, period] = time.split(' ');
      const [hour, minute] = timePart.split(':');
      let hourNum = parseInt(hour);
      
      if (period === 'PM' && hourNum !== 12) hourNum += 12;
      if (period === 'AM' && hourNum === 12) hourNum = 0;
      
      const displayHour = hourNum.toString().padStart(2, '0');
      const displayMinute = minute || '00';
      
      if (hourNum < 12) {
        return `${displayHour}:${displayMinute} dopoludnie`;
      } else if (hourNum === 12) {
        return `${displayHour}:${displayMinute} v poludnie`;
      } else {
        return `${displayHour}:${displayMinute} poobede`;
      }
    }
    return time;
  }
  return time;
}

async function getAllowedTimes(serviceId = 130113, workerId = 31576, date) {
  try {
    const dateOnly = date.split(' ')[0];
    const dateWithTime = `${dateOnly} 00:00`;
    const payload = {
      serviceId: parseInt(serviceId),
      workerId: parseInt(workerId),
      addons: [],
      count: 1,
      participantsCount: 0,
      date: dateWithTime,
      lang: 'en'
    };

    const response = await axios.post(`${WIDGET_API}/allowedTimes?lang=en`, payload, { headers });
    return response.data?.data?.times || null;
  } catch (error) {
    console.error('Error fetching allowed times:', error.message);
    return null;
  }
}

async function getSmartSlotRecommendations(serviceId = 130113, workerId = 31576, date, startIndex = 0) {
  try {
    const times = await getAllowedTimes(serviceId, workerId, date);
    if (!times || !times.all || times.all.length === 0) {
      return null;
    }
    
    const availableSlots = times.all.slice(startIndex, startIndex + 2);
    return {
      date: date.split(' ')[0],
      slots: availableSlots.map(slot => ({
        time: slot.id,
        display: formatTimeForDisplay(slot, 'sk')
      })),
      totalSlots: times.all.length,
      hasMore: times.all.length > startIndex + 2,
      allSlots: times.all
    };
  } catch (error) {
    console.error('Error getting smart recommendations:', error.message);
    return null;
  }
}

async function getSoonestAvailable(serviceId = 130113, workerId = 31576, daysToCheck = 30) {
  try {
    const today = new Date();
    
    for (let i = 0; i < daysToCheck; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() + i);
      
      const dateStr = checkDate.toLocaleDateString('sk-SK', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }).replace(/\s/g, '');
      
      const dateWithTime = `${dateStr} 00:00`;
      const smartSlots = await getSmartSlotRecommendations(serviceId, workerId, dateWithTime, 0);
      
      if (smartSlots && smartSlots.slots.length > 0) {
        return {
          date: dateStr,
          slots: smartSlots.slots,
          hasMore: smartSlots.hasMore,
          totalSlots: smartSlots.totalSlots,
          allSlots: smartSlots.allSlots
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error finding soonest available:', error.message);
    return null;
  }
}

async function bookAppointment(serviceId = 130113, workerId = 31576, date, time, customerInfo) {
  try {
    const dateOnly = date.split(' ')[0];
    const payload = {
      serviceId: parseInt(serviceId),
      termId: null,
      workerId: parseInt(workerId),
      date: dateOnly,
      hour: time,
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

    const endpoint = `${WIDGET_API}/createReservation?lang=en`;
    const response = await axios.post(endpoint, payload, { headers });

    if (response.data?.data?.success) {
      return { 
        success: true, 
        booking: response.data.data, 
        order: response.data.data.order 
      };
    } else {
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
      details: error.response?.data 
    };
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    return;
  }

  try {
    const { 
      action, 
      date, 
      time, 
      customer, 
      phone, 
      appointment_date, 
      previous_time,
      time_period,
      requested_time
    } = req.body;

    switch (action) {
      case 'get_available_times':
        if (!date) {
          return res.status(400).json({
            response: "Pre kontrolu dostupnosti je potrebné zadať dátum.",
            success: false,
            error: "Date is required"
          });
        }

        // NEW: Enhanced date validation
        const dateValidation = parseAndValidateDate(date);
        if (!dateValidation.isValid) {
          return res.json({
            response: dateValidation.error,
            success: false,
            timestamp: new Date().toISOString()
          });
        }

        const isFollowUp = previous_time && previous_time !== "";
        const startIndex = isFollowUp ? 2 : 0;
        
        let smartSlots = await getSmartSlotRecommendations(130113, 31576, dateValidation.date, startIndex);
        
        // NEW: Filter by time period if specified
        if (time_period && smartSlots) {
          const times = await getAllowedTimes(130113, 31576, dateValidation.date);
          const filteredTimes = filterTimesByPeriod(times, time_period);
          if (filteredTimes && filteredTimes.all.length > 0) {
            smartSlots = {
              ...smartSlots,
              slots: filteredTimes.all.slice(startIndex, startIndex + 2).map(slot => ({
                time: slot.id,
                display: formatTimeForDisplay(slot, 'sk')
              })),
              totalSlots: filteredTimes.all.length
            };
          }
        }
        
        if (!smartSlots || smartSlots.slots.length === 0) {
          const noMoreMsg = isFollowUp ? 
            `Na ${dateValidation.displayDate} už nemám ďalšie termíny.` :
            time_period ? 
            `Na ${dateValidation.displayDate} nie sú dostupné žiadne termíny ${time_period}.` :
            `Na dátum ${dateValidation.displayDate} nie sú dostupné žiadne termíny.`;
          
          return res.json({
            response: noMoreMsg,
            success: true,
            availableTimes: [],
            timestamp: new Date().toISOString()
          });
        }

        const timeDescriptions = smartSlots.slots.map(slot => slot.display);
        
        let response;
        if (isFollowUp) {
          if (timeDescriptions.length === 1) {
            response = smartSlots.hasMore ? 
              `Mám ešte o ${timeDescriptions[0]}. Vyhovuje?` :
              `Posledný termín je o ${timeDescriptions[0]}. Vyhovuje?`;
          } else {
            response = smartSlots.hasMore ?
              `Mám ešte o ${timeDescriptions[0]} alebo ${timeDescriptions[1]}. Vyhovuje niečo?` :
              `Posledné termíny sú o ${timeDescriptions[0]} alebo ${timeDescriptions[1]}. Vyhovuje niečo?`;
          }
        } else {
          response = timeDescriptions.length === 1 
            ? `Dostupný je termín o ${timeDescriptions[0]}.`
            : timeDescriptions.length === 2
            ? `Dostupné sú termíny o ${timeDescriptions[0]} a ${timeDescriptions[1]}.`
            : `Dostupné sú termíny o ${timeDescriptions.slice(0, -1).join(', ')} a ${timeDescriptions[timeDescriptions.length - 1]}.`;
        }

        return res.json({
          response,
          success: true,
          availableTimes: smartSlots.slots,
          hasMore: smartSlots.hasMore,
          isFollowUp: isFollowUp,
          timestamp: new Date().toISOString(),
          source: "elevenlabs"
        });

      case 'get_soonest_available':
        const soonest = await getSoonestAvailable();
        
        if (!soonest) {
          return res.json({
            response: "V najbližších dňoch nie sú dostupné žiadne termíny.",
            success: true,
            timestamp: new Date().toISOString()
          });
        }

        const formattedDate = formatDateForSlovakTTS(soonest.date);
        const timeOptions = soonest.slots.map(slot => slot.display);
        
        let soonestResponse;
        if (timeOptions.length === 1) {
          soonestResponse = `Najbližší termín je ${formattedDate} o ${timeOptions[0]}. Vyhovuje?`;
        } else {
          soonestResponse = `Najbližší termín je ${formattedDate} o ${timeOptions[0]} alebo ${timeOptions[1]}. Ktorý vyhovuje?`;
        }

        return res.json({
          response: soonestResponse,
          success: true,
          appointment: {
            date: soonest.date,
            availableSlots: soonest.slots,
            hasMore: soonest.hasMore,
            totalSlots: soonest.totalSlots
          },
          timestamp: new Date().toISOString(),
          source: "elevenlabs"
        });

      // NEW: Get earlier slots
      case 'get_earlier_times':
        if (!date || !requested_time) {
          return res.status(400).json({
            response: "Pre vyhľadanie skorších termínov potrebujem dátum a požadovaný čas.",
            success: false,
            error: "Date and requested time are required"
          });
        }

        const earlierDateValidation = parseAndValidateDate(date);
        if (!earlierDateValidation.isValid) {
          return res.json({
            response: earlierDateValidation.error,
            success: false,
            timestamp: new Date().toISOString()
          });
        }

        const earlierSlots = await findEarlierSlots(130113, 31576, earlierDateValidation.date, requested_time);
        
        if (!earlierSlots || earlierSlots.length === 0) {
          return res.json({
            response: `Pred ${requested_time} na ${earlierDateValidation.displayDate} nie sú dostupné žiadne skoršie termíny.`,
            success: true,
            availableTimes: [],
            timestamp: new Date().toISOString()
          });
        }

        const earlierDescriptions = earlierSlots.map(slot => formatTimeForDisplay(slot, 'sk'));
        const earlierResponse = earlierDescriptions.length === 1 
          ? `Skorší termín je o ${earlierDescriptions[0]}.`
          : `Skoršie termíny sú o ${earlierDescriptions.join(' a ')}.`;

        return res.json({
          response: earlierResponse,
          success: true,
          availableTimes: earlierSlots.map(slot => ({
            time: slot.id,
            display: formatTimeForDisplay(slot, 'sk')
          })),
          timestamp: new Date().toISOString(),
          source: "elevenlabs"
        });

      // NEW: Get service information
      case 'get_services':
        const serviceInfo = getServiceInfo();
        return res.json({
          response: `Ponúkame profesionálne wellness služby v Refresh Studio na adrese ${serviceInfo.facility.address}. Služba trvá ${serviceInfo.services[0].duration} v modernom a relaxačnom prostredí.`,
          success: true,
          services: serviceInfo.services,
          facility: serviceInfo.facility,
          timestamp: new Date().toISOString(),
          source: "elevenlabs"
        });

      case 'book_appointment':
        if (!date || !time || !customer) {
          return res.status(400).json({
            response: "Pre rezerváciu je potrebné zadať dátum, čas a údaje zákazníka.",
            success: false,
            error: "Date, time, and customer info are required"
          });
        }

        let customerData;
        try {
          customerData = typeof customer === 'string' ? JSON.parse(customer) : customer;
        } catch (e) {
          return res.status(400).json({
            response: "Neplatné údaje zákazníka.",
            success: false,
            error: "Invalid customer data format"
          });
        }

        const bookingResult = await bookAppointment(130113, 31576, date, time, customerData);

        if (bookingResult.success) {
          const order = bookingResult.order;
          return res.json({
            response: `Rezervácia bola úspešne vytvorená na ${order.date} o ${order.time} pre ${order.name}. Číslo objednávky: ${order.orderId}. Potvrdenie bolo odoslané na email ${order.email}.`,
            success: true,
            booking: bookingResult.booking,
            order: order,
            timestamp: new Date().toISOString()
          });
        } else {
          return res.json({
            response: `Rezervácia sa nepodarila: ${bookingResult.error}`,
            success: false,
            error: bookingResult.error,
            details: bookingResult.details,
            timestamp: new Date().toISOString()
          });
        }

      case 'cancel_appointment':
        return res.json({
          response: `Pre zrušenie rezervácie použite prosím odkaz v potvrdzujúcom e-maile alebo nás kontaktujte priamo. Zrušenie cez telefón nie je možné z bezpečnostných dôvodov.`,
          success: true,
          instructions: "Use email cancellation link or contact directly",
          phone: phone,
          timestamp: new Date().toISOString()
        });

      default:
        return res.status(400).json({
          response: "Neplatná akcia. Dostupné akcie: get_available_times, get_soonest_available, get_earlier_times, get_services, book_appointment, cancel_appointment",
          success: false,
          error: "Invalid action"
        });
    }
  } catch (error) {
    console.error('Unified webhook error:', error);
    return res.status(500).json({
      response: "Nastala chyba pri spracovaní požiadavky.",
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}