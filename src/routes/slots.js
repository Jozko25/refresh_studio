import express from 'express';
import SlotService from '../services/slotService.js';

const router = express.Router();

/**
 * GET /api/slots/soonest/:serviceId
 * Find the soonest available slot
 * Query params: ?workerId=X&maxDays=14
 */
router.get('/soonest/:serviceId', async (req, res) => {
    try {
        const { serviceId } = req.params;
        const { workerId = -1, maxDays = 14 } = req.query;

        const result = await SlotService.findSoonestSlot(
            serviceId, 
            parseInt(workerId),
            parseInt(maxDays)
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
 * POST /api/slots/check
 * Check if specific slot is available
 * Body: { serviceId, workerId, date: "YYYY-MM-DD", time: "HH:MM" }
 */
router.post('/check', async (req, res) => {
    try {
        const { serviceId, workerId = -1, date, time } = req.body;

        if (!serviceId || !date || !time) {
            return res.status(400).json({
                success: false,
                error: 'serviceId, date, and time are required',
                timestamp: new Date().toISOString()
            });
        }

        const result = await SlotService.checkSlot(
            serviceId,
            parseInt(workerId),
            date,
            time
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
 * POST /api/slots/available
 * Get all available slots for a date
 * Body: { serviceId, workerId, date: "YYYY-MM-DD" }
 */
router.post('/available', async (req, res) => {
    try {
        const { serviceId, workerId = -1, date } = req.body;

        if (!serviceId || !date) {
            return res.status(400).json({
                success: false,
                error: 'serviceId and date are required',
                timestamp: new Date().toISOString()
            });
        }

        const result = await SlotService.getAvailableSlots(
            serviceId,
            parseInt(workerId),
            date
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

export default router;