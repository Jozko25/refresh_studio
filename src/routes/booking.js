import express from 'express';
import BookioDirectService from '../services/bookioDirectService.js';
import BookioTurnstileService from '../services/bookioTurnstileService.js';
import BookioSessionService from '../services/bookioSessionService.js';
import BookioBrowserAutomation from '../services/bookioBrowserAutomation.js';
import EmailService from '../services/emailService.js';
import bookioApiClient from '../services/bookioApiClient.js';

const router = express.Router();

/**
 * POST /api/booking/create
 * Create an actual booking/reservation
 */
router.post('/create', async (req, res) => {
    try {
        const {
            serviceId,
            workerId,
            date,
            hour,
            firstName,
            lastName,
            email,
            phone,
            note = "",
            acceptTerms = true
        } = req.body;

        // Validate required fields
        const requiredFields = ['serviceId', 'date', 'hour', 'firstName', 'lastName', 'email'];
        const missingFields = requiredFields.filter(field => !req.body[field]);
        
        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields',
                missingFields
            });
        }

        console.log('📅 Creating reservation:', {
            serviceId,
            workerId,
            date,
            hour,
            name: `${firstName} ${lastName}`,
            email
        });

        // If no worker specified, get first available worker
        let finalWorkerId = workerId;
        if (!finalWorkerId || finalWorkerId === -1) {
            const workers = await BookioDirectService.getWorkers(serviceId);
            if (workers && workers.length > 0) {
                const realWorkers = workers.filter(w => w.workerId !== -1);
                finalWorkerId = realWorkers.length > 0 ? realWorkers[0].workerId : workers[0].workerId;
                console.log(`👤 Selected worker: ${finalWorkerId}`);
            }
        }

        // Create reservation using Turnstile service
        const result = await BookioTurnstileService.createReservationWithToken({
            serviceId,
            workerId: finalWorkerId || 31576, // Default worker ID
            date,
            hour,
            firstName,
            lastName,
            email,
            phone,
            note,
            acceptTerms
        });

        // Send email notification for booking attempt
        const bookingData = req.body;
        await EmailService.sendBookingNotification(bookingData, result, '/api/booking/create');

        if (result.success) {
            return res.json({
                success: true,
                message: 'Rezervácia bola úspešne vytvorená',
                order: result.order,
                method: result.method,
                email_sent: true
            });
        } else {
            return res.status(400).json({
                success: false,
                message: result.message || 'Rezervácia sa nepodarila',
                errors: result.errors,
                email_sent: true
            });
        }

    } catch (error) {
        console.error('❌ Booking creation error:', error);
        
        // Send email notification for error
        const errorResult = {
            success: false,
            message: 'System error occurred',
            error: error.message,
            stack: error.stack
        };
        await EmailService.sendBookingNotification(req.body, errorResult, '/api/booking/create');
        
        return res.status(500).json({
            success: false,
            message: 'Nastala chyba pri vytváraní rezervácie',
            error: error.message,
            email_sent: true
        });
    }
});

/**
 * POST /api/booking/create-auth
 * Create booking using authenticated admin API (new system)
 */
router.post('/create-auth', async (req, res) => {
    try {
        const {
            serviceId,
            workerId,
            date,
            time,
            duration,
            firstName,
            lastName,
            email,
            phone,
            price,
            note = ""
        } = req.body;

        // Validate required fields
        const requiredFields = ['serviceId', 'date', 'time', 'firstName', 'lastName', 'email'];
        const missingFields = requiredFields.filter(field => !req.body[field]);
        
        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields',
                missingFields
            });
        }

        console.log('📅 Creating authenticated booking:', {
            serviceId,
            workerId,
            date,
            time,
            name: `${firstName} ${lastName}`,
            email
        });

        // Prepare booking data for admin API
        const bookingData = {
            serviceId: parseInt(serviceId),
            workerId: workerId || 31576, // Default worker
            date: date, // Format: DD.MM.YYYY
            time: time, // Format: HH:mm
            duration: duration || 40,
            firstName,
            lastName,
            email,
            phone,
            price: price || 0,
            workerName: 'AI Recepcia',
            workerColor: '#26a69a'
        };

        // Create booking using authenticated admin API
        const result = await bookioApiClient.createBooking(bookingData);

        // Send email notification
        await EmailService.sendBookingNotification(req.body, result, '/api/booking/create-auth');

        if (result.success) {
            return res.json({
                success: true,
                message: 'Rezervácia bola úspešne vytvorená cez admin API',
                bookingId: result.bookingId,
                data: result.data,
                method: 'authenticated_admin_api',
                email_sent: true
            });
        } else {
            return res.status(400).json({
                success: false,
                message: result.error || 'Rezervácia sa nepodarila',
                errors: result.errors,
                details: result.details,
                method: 'authenticated_admin_api',
                email_sent: true
            });
        }

    } catch (error) {
        console.error('❌ Authenticated booking error:', error);
        
        // Send email notification for error
        const errorResult = {
            success: false,
            message: 'System error in authenticated booking',
            error: error.message,
            stack: error.stack
        };
        await EmailService.sendBookingNotification(req.body, errorResult, '/api/booking/create-auth');
        
        return res.status(500).json({
            success: false,
            message: 'Nastala chyba pri vytváraní rezervácie cez admin API',
            error: error.message,
            email_sent: true
        });
    }
});

/**
 * POST /api/booking/test-email
 * Test email notification system
 */
router.post('/test-email', async (req, res) => {
    try {
        console.log('📧 Testing email notification system...');
        
        const emailSent = await EmailService.sendTestEmail();
        
        if (emailSent) {
            return res.json({
                success: true,
                message: 'Test email sent successfully',
                notification_email: 'janko.tank.poi@gmail.com'
            });
        } else {
            return res.status(400).json({
                success: false,
                message: 'Failed to send test email'
            });
        }
    } catch (error) {
        console.error('❌ Email test error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error testing email',
            error: error.message
        });
    }
});

/**
 * POST /api/booking/test-token
 * Test if we can get a valid Turnstile token
 */
router.post('/test-token', async (req, res) => {
    try {
        console.log('🎫 Testing Turnstile token fetching...');
        
        const token = await BookioTurnstileService.getTurnstileToken();
        
        if (token) {
            return res.json({
                success: true,
                message: 'Token successfully obtained',
                tokenLength: token.length,
                tokenPrefix: token.substring(0, 50) + '...'
            });
        } else {
            return res.status(400).json({
                success: false,
                message: 'Failed to obtain Turnstile token'
            });
        }
    } catch (error) {
        console.error('❌ Token test error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error testing token',
            error: error.message
        });
    }
});

/**
 * POST /api/booking/check-availability
 * Check if a specific time slot is available
 */
router.post('/check-availability', async (req, res) => {
    try {
        const { serviceId, workerId, date } = req.body;

        if (!serviceId || !date) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: serviceId and date'
            });
        }

        // Get allowed times for the specific date
        const timesData = await BookioDirectService.getAllowedTimes(
            serviceId,
            workerId || -1,
            date
        );

        if (timesData && timesData.times && timesData.times.all) {
            return res.json({
                success: true,
                available: true,
                date,
                times: timesData.times.all.map(t => ({
                    time: t.name,
                    value: t.value
                })),
                totalSlots: timesData.times.all.length
            });
        } else {
            return res.json({
                success: true,
                available: false,
                date,
                message: 'No available slots on this date'
            });
        }

    } catch (error) {
        console.error('❌ Availability check error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error checking availability',
            error: error.message
        });
    }
});

/**
 * GET /api/booking/soonest/:serviceId
 * Find the soonest available booking slot for a service
 */
router.get('/soonest/:serviceId', async (req, res) => {
    try {
        const { serviceId } = req.params;
        const { workerId } = req.query;

        const result = await BookioDirectService.getAvailableTimesAndDays(
            serviceId,
            workerId || -1,
            3 // Check up to 3 months ahead
        );

        return res.json(result);

    } catch (error) {
        console.error('❌ Soonest slot error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error finding soonest slot',
            error: error.message
        });
    }
});

/**
 * POST /api/booking/browser-automation
 * Create booking using browser automation
 */
router.post('/browser-automation', async (req, res) => {
    try {
        const {
            serviceId,
            date,
            time,
            firstName,
            lastName,
            email,
            phone,
            note = ""
        } = req.body;

        // Validate required fields
        const requiredFields = ['serviceId', 'date', 'time', 'firstName', 'lastName', 'email'];
        const missingFields = requiredFields.filter(field => !req.body[field]);
        
        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields',
                missingFields
            });
        }

        console.log('🤖 Starting browser automation for booking...');

        const automation = new BookioBrowserAutomation();
        
        // Initialize browser
        const initialized = await automation.initBrowser();
        if (!initialized) {
            return res.status(500).json({
                success: false,
                message: 'Failed to initialize browser automation'
            });
        }

        // Complete booking
        const result = await automation.completeBooking({
            serviceId,
            date,
            time,
            firstName,
            lastName,
            email,
            phone,
            note
        });

        // Close browser
        await automation.close();

        if (result.success) {
            return res.json({
                success: true,
                message: 'Booking completed via browser automation',
                confirmation: result.confirmation
            });
        } else {
            return res.status(400).json({
                success: false,
                message: 'Browser automation failed',
                error: result.error
            });
        }

    } catch (error) {
        console.error('❌ Browser automation error:', error);
        return res.status(500).json({
            success: false,
            message: 'Browser automation error',
            error: error.message
        });
    }
});

/**
 * POST /api/booking/create-direct
 * Attempt to create booking without Turnstile token
 */
router.post('/create-direct', async (req, res) => {
    try {
        const {
            serviceId,
            workerId,
            date,
            hour,
            firstName,
            lastName,
            email,
            phone,
            note = "",
            acceptTerms = true
        } = req.body;

        // Validate required fields
        const requiredFields = ['serviceId', 'date', 'hour', 'firstName', 'lastName', 'email'];
        const missingFields = requiredFields.filter(field => !req.body[field]);
        
        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields',
                missingFields
            });
        }

        console.log('📅 Attempting direct reservation (no Turnstile):', {
            serviceId,
            workerId,
            date,
            hour,
            name: `${firstName} ${lastName}`,
            email
        });

        // Attempt direct booking without token
        const result = await BookioSessionService.createReservationDirect({
            serviceId,
            workerId,
            date,
            hour,
            firstName,
            lastName,
            email,
            phone,
            note,
            acceptTerms
        });

        if (result.success) {
            return res.json({
                success: true,
                message: 'Rezervácia bola úspešne vytvorená',
                order: result.order,
                method: result.method
            });
        } else if (result.requiresTurnstile) {
            return res.status(403).json({
                success: false,
                requiresTurnstile: true,
                message: 'Turnstile verification is required and cannot be bypassed',
                details: result.error
            });
        } else {
            return res.status(400).json({
                success: false,
                message: result.message || 'Rezervácia sa nepodarila',
                response: result.response,
                error: result.error
            });
        }

    } catch (error) {
        console.error('❌ Direct booking error:', error);
        return res.status(500).json({
            success: false,
            message: 'Nastala chyba pri vytváraní rezervácie',
            error: error.message
        });
    }
});

export default router;