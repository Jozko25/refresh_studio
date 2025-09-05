import express from 'express';
import bookioAuthService from '../services/bookioAuthService.js';
import bookioScheduler from '../services/bookioScheduler.js';
import bookioApiClient from '../services/bookioApiClient.js';
import tokenStorage from '../services/tokenStorage.js';

const router = express.Router();

/**
 * Health check endpoint
 */
router.get('/health', (req, res) => {
    const authStatus = bookioAuthService.getStatus();
    const schedulerStatus = bookioScheduler.getStatus();
    
    const isHealthy = authStatus.initialized && authStatus.cookieValid;
    
    res.status(isHealthy ? 200 : 503).json({
        status: isHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        auth: {
            initialized: authStatus.initialized,
            hasCookie: authStatus.hasCookie,
            cookieValid: authStatus.cookieValid,
            environment: authStatus.environment
        },
        scheduler: {
            running: schedulerStatus.scheduler.running,
            lastRefresh: authStatus.lastRefresh,
            nextRefresh: authStatus.nextRefresh
        }
    });
});

/**
 * Get detailed status
 */
router.get('/status', (req, res) => {
    const status = bookioScheduler.getStatus();
    const apiStats = bookioApiClient.getStatistics();
    
    res.json({
        timestamp: new Date().toISOString(),
        auth: status.auth,
        scheduler: status.scheduler,
        api: apiStats
    });
});

/**
 * Get statistics
 */
router.get('/stats', (req, res) => {
    const schedulerStats = bookioScheduler.getStatistics();
    const apiStats = bookioApiClient.getStatistics();
    
    res.json({
        timestamp: new Date().toISOString(),
        scheduler: schedulerStats,
        api: apiStats
    });
});

/**
 * Initialize authentication
 */
router.post('/init', async (req, res) => {
    try {
        console.log('🔐 Initializing authentication service');
        
        // Initialize auth service
        await bookioAuthService.initialize();
        
        // Test authentication
        const testResult = await bookioApiClient.testAuthentication();
        
        res.json({
            success: true,
            message: 'Authentication initialized successfully',
            authenticated: testResult.authenticated,
            environment: bookioAuthService.getStatus().environment
        });
        
    } catch (error) {
        console.error('❌ Initialization failed:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Start scheduler
 */
router.post('/scheduler/start', async (req, res) => {
    try {
        const started = await bookioScheduler.start();
        
        if (started) {
            res.json({
                success: true,
                message: 'Scheduler started successfully',
                status: bookioScheduler.getStatus()
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'Scheduler already running'
            });
        }
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Stop scheduler
 */
router.post('/scheduler/stop', (req, res) => {
    const stopped = bookioScheduler.stop();
    
    if (stopped) {
        res.json({
            success: true,
            message: 'Scheduler stopped successfully'
        });
    } else {
        res.status(400).json({
            success: false,
            message: 'Scheduler not running'
        });
    }
});

/**
 * Force refresh authentication
 */
router.post('/refresh', async (req, res) => {
    try {
        console.log('🔄 Force refresh requested');
        
        await bookioScheduler.forceRefresh();
        
        // Test new authentication
        const testResult = await bookioApiClient.testAuthentication();
        
        res.json({
            success: true,
            message: 'Authentication refreshed successfully',
            authenticated: testResult.authenticated,
            status: bookioAuthService.getStatus()
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Test with invalid cookie (for verification)
 */
router.post('/test-invalid', async (req, res) => {
    try {
        // Make a direct request with fake cookie to prove our system works
        const axios = (await import('axios')).default;
        
        console.log('🧪 Testing with invalid/fake cookie...');
        
        const response = await axios.post(
            'https://services.bookio.com/client-admin/api/schedule/event/save',
            {
                event: {
                    type: 0,
                    service: { value: 130113 },
                    count: 0,
                    dateFrom: "25.01.2025",
                    dateTo: "25.01.2025", 
                    timeFrom: "10:00",
                    timeTo: "10:40",
                    duration: 40,
                    name: "Fake Cookie Test",
                    email: "fake@test.com"
                },
                facility: "ai-recepcia-zll65ixf"
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': 'bses-0=FAKE_INVALID_COOKIE_12345' // Fake cookie
                }
            }
        );
        
        res.json({
            success: false,
            message: 'This should not succeed',
            response: response.data
        });
        
    } catch (error) {
        // This should fail with 401/403
        res.json({
            success: true,
            message: 'Correctly failed with invalid cookie',
            error: error.response?.status || error.message,
            details: error.response?.data ? 'Got error page' : 'Network error'
        });
    }
});

/**
 * Test authentication
 */
router.get('/test', async (req, res) => {
    try {
        const result = await bookioApiClient.testAuthentication();
        
        res.json({
            success: result.success,
            authenticated: result.authenticated,
            user: result.user,
            environment: bookioAuthService.getStatus().environment
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Get current cookie (for debugging)
 */
router.get('/cookie', async (req, res) => {
    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({
            error: 'Not available in production'
        });
    }
    
    try {
        const cookie = await bookioAuthService.getCookie();
        const status = bookioAuthService.getStatus();
        
        res.json({
            hasCookie: !!cookie,
            cookieName: status.cookieName,
            environment: status.environment,
            valid: status.cookieValid,
            expires: status.nextRefresh
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Set custom refresh interval
 */
router.post('/scheduler/interval', (req, res) => {
    const { minutes } = req.body;
    
    if (!minutes || minutes < 1) {
        return res.status(400).json({
            error: 'Invalid interval. Minimum is 1 minute.'
        });
    }
    
    try {
        const intervalMs = minutes * 60 * 1000;
        bookioScheduler.setRefreshInterval(intervalMs);
        
        res.json({
            success: true,
            message: `Refresh interval set to ${minutes} minutes`,
            intervalMs: intervalMs
        });
        
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Create a test booking (demo only)
 */
router.post('/test-booking', async (req, res) => {
    // Only allow in non-production
    if (process.env.BOOKIO_ENV === 'production') {
        return res.status(403).json({
            error: 'Test bookings not allowed in production'
        });
    }
    
    try {
        const bookingData = req.body;
        
        // Add test defaults if not provided
        const testBooking = {
            serviceId: bookingData.serviceId || 1,
            workerId: bookingData.workerId || 1,
            date: bookingData.date || '01.01.2025',
            time: bookingData.time || '10:00',
            firstName: bookingData.firstName || 'Test',
            lastName: bookingData.lastName || 'User',
            email: bookingData.email || 'test@example.com',
            phone: bookingData.phone || '+421900000000',
            note: bookingData.note || 'Test booking from API',
            sendConfirmation: false
        };
        
        const result = await bookioApiClient.createBooking(testBooking);
        
        res.json(result);
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Get token storage statistics
 */
router.get('/tokens/stats', async (req, res) => {
    try {
        const stats = await tokenStorage.getStatistics();
        
        res.json({
            success: true,
            statistics: stats,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * List all stored tokens
 */
router.get('/tokens', async (req, res) => {
    try {
        const tokens = await tokenStorage.listTokens();
        
        res.json({
            success: true,
            tokens: tokens,
            count: tokens.length
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Find tokens by criteria
 */
router.post('/tokens/find', async (req, res) => {
    try {
        const criteria = req.body;
        const tokens = await tokenStorage.findTokens(criteria);
        
        res.json({
            success: true,
            tokens: tokens,
            count: tokens.length,
            criteria: criteria
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Test slot availability for production facilities
 */
router.get('/test-slots/:facility?', async (req, res) => {
    try {
        const { default: slotService } = await import('../services/slotService.js');
        const facilityKey = req.params.facility;
        
        if (facilityKey && !['bratislava', 'pezinok'].includes(facilityKey)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid facility. Use "bratislava" or "pezinok"'
            });
        }
        
        const result = await slotService.testFacilitySlots(facilityKey);
        
        res.json({
            success: result.success !== false,
            timestamp: new Date().toISOString(),
            ...result
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Get all services for a specific facility
 */
router.get('/services/:facility', async (req, res) => {
    try {
        const { default: slotService } = await import('../services/slotService.js');
        const facilityKey = req.params.facility;
        
        if (facilityKey && !['bratislava', 'pezinok'].includes(facilityKey)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid facility. Use "bratislava" or "pezinok"'
            });
        }
        
        const result = await slotService.getServicesForFacility(facilityKey);
        
        res.json({
            success: result.success !== false,
            timestamp: new Date().toISOString(),
            ...result
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Get categories for a specific facility
 */
router.get('/categories/:facility', async (req, res) => {
    try {
        const { default: slotService } = await import('../services/slotService.js');
        const facilityKey = req.params.facility;
        
        if (facilityKey && !['bratislava', 'pezinok'].includes(facilityKey)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid facility. Use "bratislava" or "pezinok"'
            });
        }
        
        const result = await slotService.getCategoriesForFacility(facilityKey);
        
        res.json({
            success: result.success !== false,
            timestamp: new Date().toISOString(),
            ...result
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Get services for all production facilities
 */
router.get('/services-all-facilities', async (req, res) => {
    try {
        const { default: slotService } = await import('../services/slotService.js');
        
        const bratislavaServices = await slotService.getServicesForFacility('bratislava');
        const pezinoServices = await slotService.getServicesForFacility('pezinok');
        
        res.json({
            success: true,
            timestamp: new Date().toISOString(),
            facilities: {
                bratislava: bratislavaServices,
                pezinok: pezinoServices
            }
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Test all production facilities
 */
router.get('/test-all-facilities', async (req, res) => {
    try {
        const { default: slotService } = await import('../services/slotService.js');
        
        const bratislavaTest = await slotService.testFacilitySlots('bratislava');
        const pezinoTest = await slotService.testFacilitySlots('pezinok');
        
        res.json({
            success: true,
            timestamp: new Date().toISOString(),
            facilities: {
                bratislava: bratislavaTest,
                pezinok: pezinoTest
            }
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Cleanup expired tokens
 */
router.post('/tokens/cleanup', async (req, res) => {
    try {
        const cleaned = await tokenStorage.cleanupExpiredTokens();
        
        res.json({
            success: true,
            message: `Cleaned up ${cleaned} expired tokens`,
            cleaned: cleaned
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;