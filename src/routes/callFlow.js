import express from 'express';
import CallFlowService from '../services/callFlowService.js';

const router = express.Router();

/**
 * GET /api/call/services-overview
 * Initial call - what services do you offer?
 * Returns 3 most popular service categories
 */
router.get('/services-overview', async (req, res) => {
    try {
        const result = await CallFlowService.getServiceOverview();
        
        res.json({
            ...result,
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
 * GET /api/call/more-services
 * Client asks: "Tell me more services"
 * Query params: ?offset=3&limit=3
 */
router.get('/more-services', async (req, res) => {
    try {
        const { offset = 0, limit = 3 } = req.query;
        
        const result = await CallFlowService.getMoreCategories(
            parseInt(offset),
            parseInt(limit)
        );
        
        res.json({
            ...result,
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
 * GET /api/call/search/:searchTerm
 * Client says: "I want hydrafacial" or "Do you have laser treatment?"
 */
router.get('/search/:searchTerm', async (req, res) => {
    try {
        const { searchTerm } = req.params;
        
        const result = await CallFlowService.searchServices(searchTerm);
        
        res.json({
            ...result,
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
 * GET /api/call/booking-info/:serviceId
 * Client found service, wants to book - get complete info
 * Query params: ?workerId=-1
 */
router.get('/booking-info/:serviceId', async (req, res) => {
    try {
        const { serviceId } = req.params;
        const { workerId = -1 } = req.query;
        
        const result = await CallFlowService.getBookingInfo(serviceId, workerId);
        
        res.json({
            ...result,
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
 * POST /api/call/check-availability
 * Check specific date/time or get alternatives
 * Body: { serviceId, workerId?, date?, time? }
 */
router.post('/check-availability', async (req, res) => {
    try {
        const { serviceId, workerId = -1, date, time } = req.body;

        if (!serviceId) {
            return res.status(400).json({
                success: false,
                error: 'serviceId is required',
                timestamp: new Date().toISOString()
            });
        }

        let result;

        if (date && time) {
            // Check specific slot
            const checkDate = new Date(date);
            const dateStr = CallFlowService.formatDateForAPI(checkDate);
            
            const response = await axios.post(`${CallFlowService.baseURL}/allowedTimes`, {
                serviceId: parseInt(serviceId),
                workerId: parseInt(workerId),
                date: dateStr,
                count: 1,
                participantsCount: 0,
                addons: [],
                lang: 'sk'
            }, { headers: CallFlowService.headers });

            const times = response.data.data?.times?.all || [];
            const isAvailable = times.some(slot => slot.id === time);

            result = {
                success: true,
                serviceId: serviceId,
                workerId: workerId,
                requested: { date: date, time: time },
                available: isAvailable,
                alternatives: isAvailable ? [] : times.slice(0, 3).map(slot => slot.id),
                message: isAvailable ? 
                    `Termín ${date} o ${time} je dostupný` :
                    `Termín ${date} o ${time} nie je dostupný`
            };
        } else {
            // Get general availability
            result = await CallFlowService.getBookingInfo(serviceId, workerId);
        }
        
        res.json({
            ...result,
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
 * GET /api/call/quick-response/:intent
 * Handle common client intents quickly
 * Intents: opening-hours, location, prices, popular-services
 */
router.get('/quick-response/:intent', async (req, res) => {
    try {
        const { intent } = req.params;
        
        const quickResponses = {
            'opening-hours': {
                success: true,
                intent: 'opening-hours',
                response: 'Otvorené sme pondelok až piatok od 9:00 do 17:00, s obedňajšou prestávkou 12:00-13:00.',
                details: {
                    weekdays: '9:00-12:00, 13:00-17:00',
                    weekend: 'Zatvorené'
                }
            },
            'location': {
                success: true,
                intent: 'location',
                response: 'Nachádzame sa na Lazaretskej 13 v Bratislave.',
                details: {
                    address: 'Lazaretská 13, Bratislava',
                    transport: 'MHD zastávka Špitálska'
                }
            },
            'prices': {
                success: true,
                intent: 'prices',
                response: 'Ceny sa líšia podľa služby. Hydrafacial od 65€, laserová epilácia od 24€, pleťové ošetrenia od 40€.'
            },
            'popular-services': {
                success: true,
                intent: 'popular-services',
                response: 'Naše najobľúbenejšie služby sú Hydrafacial, laserová epilácia a pleťové ošetrenia.'
            }
        };

        const response = quickResponses[intent] || {
            success: false,
            intent: intent,
            error: 'Unknown intent'
        };

        res.json({
            ...response,
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

export default router;