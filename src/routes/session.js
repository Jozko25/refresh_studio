import express from 'express';
import bookioSessionManager from '../services/bookioSessionManager.js';

const router = express.Router();

/**
 * GET /api/session/status
 * Check current session status
 */
router.get('/status', async (req, res) => {
    try {
        const cookie = await bookioSessionManager.getSessionCookie();
        res.json({
            success: true,
            hasSession: !!cookie,
            cookieLength: cookie ? cookie.length : 0,
            cookiePreview: cookie ? cookie.substring(0, 50) + '...' : null
        });
    } catch (error) {
        res.json({
            success: false,
            hasSession: false,
            error: error.message
        });
    }
});

/**
 * POST /api/session/refresh
 * Force refresh the session
 */
router.post('/refresh', async (req, res) => {
    try {
        console.log('🔄 Manual session refresh requested');
        const cookie = await bookioSessionManager.refreshSession();
        
        res.json({
            success: true,
            message: 'Session refreshed successfully',
            cookieLength: cookie.length,
            cookiePreview: cookie.substring(0, 50) + '...'
        });
    } catch (error) {
        console.error('❌ Session refresh failed:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/session/set
 * Manually set session cookie (for testing)
 */
router.post('/set', async (req, res) => {
    const { cookie, hoursValid = 12 } = req.body;
    
    if (!cookie) {
        return res.status(400).json({
            success: false,
            error: 'Cookie is required'
        });
    }
    
    try {
        await bookioSessionManager.setSessionCookie(cookie, hoursValid);
        res.json({
            success: true,
            message: 'Session cookie set successfully',
            expiresInHours: hoursValid
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * DELETE /api/session
 * Clear the session
 */
router.delete('/', async (req, res) => {
    try {
        await bookioSessionManager.clearSession();
        res.json({
            success: true,
            message: 'Session cleared'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;