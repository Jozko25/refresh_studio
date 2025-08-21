import express from 'express';
import VoiceBookingService from '../services/voiceBookingService.js';

const router = express.Router();

/**
 * GET /api/voice/soonest/:serviceId
 * Find the soonest available slot for a service
 * Query params: ?workerId=X&startDate=YYYY-MM-DD
 */
router.get('/soonest/:serviceId', async (req, res) => {
    try {
        const { serviceId } = req.params;
        const { workerId = -1, startDate } = req.query;

        const result = await VoiceBookingService.findSoonestSlot(
            serviceId, 
            workerId, 
            startDate
        );

        if (result.success) {
            res.json({
                success: true,
                ...result,
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error,
                voiceResponse: result.voiceResponse,
                timestamp: new Date().toISOString()
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            voiceResponse: 'Nastala chyba servera. Skúste to znovu.',
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * POST /api/voice/check-slot
 * Check if a specific time slot is available
 * Body: { serviceId, workerId, date: "YYYY-MM-DD", time: "HH:MM" }
 */
router.post('/check-slot', async (req, res) => {
    try {
        const { serviceId, workerId = -1, date, time } = req.body;

        if (!serviceId || !date || !time) {
            return res.status(400).json({
                success: false,
                error: 'serviceId, date, and time are required',
                voiceResponse: 'Chýbajú povinné údaje pre kontrolu termínu.',
                timestamp: new Date().toISOString()
            });
        }

        const result = await VoiceBookingService.checkDesiredSlot(
            serviceId,
            workerId,
            date,
            time
        );

        res.json({
            success: true,
            ...result,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            voiceResponse: 'Nastala chyba pri kontrole termínu.',
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * GET /api/voice/availability/:serviceId
 * Get comprehensive availability for voice interaction
 * Query params: ?workerId=X&date=YYYY-MM-DD
 */
router.get('/availability/:serviceId', async (req, res) => {
    try {
        const { serviceId } = req.params;
        const { workerId = -1, date } = req.query;

        const result = await VoiceBookingService.getVoiceAvailability(
            serviceId,
            workerId,
            date
        );

        if (result.success) {
            res.json({
                success: true,
                ...result,
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error,
                voiceResponse: result.voiceResponse,
                timestamp: new Date().toISOString()
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            voiceResponse: 'Nastala chyba pri načítavaní dostupnosti.',
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * GET /api/voice/search/:serviceName
 * Search for a service by name (voice-friendly)
 */
router.get('/search/:serviceName', async (req, res) => {
    try {
        const { serviceName } = req.params;

        const result = await VoiceBookingService.findServiceByName(serviceName);

        res.json({
            success: true,
            ...result,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            voiceResponse: 'Nastala chyba pri hľadaní služby.',
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * POST /api/voice/quick-check
 * Quick voice query - handles natural language requests
 * Body: { query: "natural language query", serviceId?, workerId?, date?, time? }
 */
router.post('/quick-check', async (req, res) => {
    try {
        const { query, serviceId, workerId = -1, date, time } = req.body;

        let result;

        // Determine query type based on keywords
        if (query.toLowerCase().includes('najrýchlejší') || query.toLowerCase().includes('najbližší')) {
            result = await VoiceBookingService.findSoonestSlot(serviceId, workerId, date);
        } else if (time && date) {
            result = await VoiceBookingService.checkDesiredSlot(serviceId, workerId, date, time);
        } else if (serviceId) {
            result = await VoiceBookingService.getVoiceAvailability(serviceId, workerId, date);
        } else {
            result = {
                success: false,
                voiceResponse: 'Nerozumiem vašej požiadavke. Skúste byť konkrétnejší.'
            };
        }

        res.json({
            success: true,
            query: query,
            ...result,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            voiceResponse: 'Nastala chyba pri spracovaní požiadavky.',
            timestamp: new Date().toISOString()
        });
    }
});

export default router;