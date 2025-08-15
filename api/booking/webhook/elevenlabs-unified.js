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
    // Add time component as Bookio API expects it
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
      }).replace(/\s/g, ''); // Remove spaces from Slovak locale
      
      // Add time component for API call
      const dateWithTime = `${dateStr} 00:00`;
      const times = await getAllowedTimes(serviceId, workerId, dateWithTime);
      
      if (times && times.all && times.all.length > 0) {
        const firstSlot = times.all[0];
        return {
          date: dateStr,
          time: firstSlot.id,
          display: formatTimeForDisplay(firstSlot, 'sk'),
          slot: firstSlot
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
  // Enable CORS
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
    const { action, date, time, customer, phone, appointment_date } = req.body;

    switch (action) {
      case 'get_available_times':
        if (!date) {
          return res.status(400).json({
            response: "Pre kontrolu dostupnosti je potrebné zadať dátum.",
            success: false,
            error: "Date is required"
          });
        }

        const times = await getAllowedTimes(130113, 31576, date);
        
        if (!times || !times.all || times.all.length === 0) {
          const formattedDate = formatDateForSlovakTTS(date);
          return res.json({
            response: `Na dátum ${formattedDate} nie sú dostupné žiadne termíny.`,
            success: true,
            availableTimes: [],
            timestamp: new Date().toISOString()
          });
        }

        const limitedTimes = times.all.slice(0, 3);
        const timeDescriptions = limitedTimes.map(slot => formatTimeForDisplay(slot, 'sk'));
        
        const response = timeDescriptions.length === 1 
          ? `Dostupný je termín o ${timeDescriptions[0]}.`
          : timeDescriptions.length === 2
          ? `Dostupné sú termíny o ${timeDescriptions[0]} a ${timeDescriptions[1]}.`
          : `Dostupné sú termíny o ${timeDescriptions.slice(0, -1).join(', ')} a ${timeDescriptions[timeDescriptions.length - 1]}.`;

        return res.json({
          response,
          success: true,
          availableTimes: limitedTimes.map(slot => ({
            time: slot.id,
            display: formatTimeForDisplay(slot, 'sk')
          })),
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
        return res.json({
          response: `Najbližší dostupný termín je ${formattedDate} o ${soonest.display}.`,
          success: true,
          appointment: {
            date: soonest.date,
            time: soonest.time,
            display: soonest.display
          },
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
          response: `Pre zrušenie rezervácie na telefónnom čísle ${phone} použite prosím odkaz v potvrdzujúcom e-maile alebo nás kontaktujte priamo.`,
          success: true,
          instructions: "Use email cancellation link or contact directly",
          phone: phone,
          appointment_date: appointment_date,
          timestamp: new Date().toISOString()
        });

      default:
        return res.status(400).json({
          response: "Neplatná akcia. Dostupné akcie: get_available_times, get_soonest_available, book_appointment, cancel_appointment",
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
