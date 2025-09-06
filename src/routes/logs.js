import express from 'express';
import db from '../database/connection.js';

const router = express.Router();

/**
 * API Routes for REFRESH Studio Logs
 * Provides web dashboard access to all logging data
 */

/**
 * GET /api/logs - Get logs with filtering
 */
router.get('/', async (req, res) => {
    try {
        const {
            limit = 50,
            level,
            category,
            facility,
            from,
            to,
            page = 1
        } = req.query;

        const filters = {};
        if (level) filters.level = level;
        if (category) filters.category = category;
        if (facility) filters.facility = facility;
        if (from) filters.from = from;
        if (to) filters.to = to;

        const offset = (parseInt(page) - 1) * parseInt(limit);
        const logs = await db.getRecentLogs(parseInt(limit), filters);

        // Get total count for pagination
        let countQuery = 'SELECT COUNT(*) as total FROM logs WHERE 1=1';
        const countParams = [];
        let paramCount = 0;

        if (filters.level) {
            paramCount++;
            countQuery += ` AND level = $${paramCount}`;
            countParams.push(filters.level);
        }
        if (filters.category) {
            paramCount++;
            countQuery += ` AND category = $${paramCount}`;
            countParams.push(filters.category);
        }
        if (filters.facility) {
            paramCount++;
            countQuery += ` AND facility = $${paramCount}`;
            countParams.push(filters.facility);
        }

        const countResult = await db.query(countQuery, countParams);
        const totalLogs = parseInt(countResult.rows[0].total);

        res.json({
            success: true,
            data: logs,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: totalLogs,
                pages: Math.ceil(totalLogs / parseInt(limit))
            },
            filters
        });
    } catch (error) {
        console.error('❌ Error getting logs:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve logs',
            message: error.message
        });
    }
});

/**
 * GET /api/logs/stats - Get dashboard statistics
 */
router.get('/stats', async (req, res) => {
    try {
        const stats = await db.getDashboardStats();
        
        // Additional stats queries
        const facilitiesQuery = `
            SELECT facility, COUNT(*) as count 
            FROM logs 
            WHERE facility IS NOT NULL 
            GROUP BY facility 
            ORDER BY count DESC
        `;
        const facilitiesResult = await db.query(facilitiesQuery);
        
        const recentErrorsQuery = `
            SELECT message, timestamp, facility, data
            FROM logs 
            WHERE level = 'error' 
            ORDER BY timestamp DESC 
            LIMIT 5
        `;
        const recentErrorsResult = await db.query(recentErrorsQuery);

        res.json({
            success: true,
            data: {
                ...stats,
                facilities: facilitiesResult.rows,
                recentErrors: recentErrorsResult.rows
            }
        });
    } catch (error) {
        console.error('❌ Error getting dashboard stats:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve dashboard statistics',
            message: error.message
        });
    }
});

/**
 * GET /api/logs/bookings - Get booking events
 */
router.get('/bookings', async (req, res) => {
    try {
        const { limit = 20, facility, status } = req.query;

        let query = `
            SELECT be.*, l.timestamp, l.message, l.level
            FROM booking_events be
            JOIN logs l ON be.log_id = l.id
            WHERE 1=1
        `;
        const params = [];
        let paramCount = 0;

        if (facility) {
            paramCount++;
            query += ` AND be.facility = $${paramCount}`;
            params.push(facility);
        }

        if (status) {
            paramCount++;
            query += ` AND be.event_type = $${paramCount}`;
            params.push(status);
        }

        query += ` ORDER BY be.created_at DESC LIMIT $${paramCount + 1}`;
        params.push(parseInt(limit));

        const result = await db.query(query, params);

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('❌ Error getting booking events:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve booking events',
            message: error.message
        });
    }
});

/**
 * GET /api/logs/auth - Get authentication events
 */
router.get('/auth', async (req, res) => {
    try {
        const { limit = 20, facility } = req.query;

        let query = `
            SELECT ae.*, l.timestamp, l.message, l.level
            FROM auth_events ae
            JOIN logs l ON ae.log_id = l.id
            WHERE 1=1
        `;
        const params = [];
        let paramCount = 0;

        if (facility) {
            paramCount++;
            query += ` AND ae.facility = $${paramCount}`;
            params.push(facility);
        }

        query += ` ORDER BY ae.created_at DESC LIMIT $${paramCount + 1}`;
        params.push(parseInt(limit));

        const result = await db.query(query, params);

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('❌ Error getting auth events:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve auth events',
            message: error.message
        });
    }
});

/**
 * GET /api/logs/api-calls - Get API call events
 */
router.get('/api-calls', async (req, res) => {
    try {
        const { limit = 20, facility, endpoint } = req.query;

        let query = `
            SELECT api.*, l.timestamp, l.message, l.level
            FROM api_events api
            JOIN logs l ON api.log_id = l.id
            WHERE 1=1
        `;
        const params = [];
        let paramCount = 0;

        if (facility) {
            paramCount++;
            query += ` AND api.facility = $${paramCount}`;
            params.push(facility);
        }

        if (endpoint) {
            paramCount++;
            query += ` AND api.endpoint LIKE $${paramCount}`;
            params.push(`%${endpoint}%`);
        }

        query += ` ORDER BY api.created_at DESC LIMIT $${paramCount + 1}`;
        params.push(parseInt(limit));

        const result = await db.query(query, params);

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('❌ Error getting API events:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve API events',
            message: error.message
        });
    }
});

/**
 * GET /api/logs/search - Search logs by message content
 */
router.get('/search', async (req, res) => {
    try {
        const { q, limit = 20 } = req.query;

        if (!q) {
            return res.status(400).json({
                success: false,
                error: 'Search query (q) is required'
            });
        }

        const query = `
            SELECT * FROM logs 
            WHERE message ILIKE $1 OR data::text ILIKE $1
            ORDER BY timestamp DESC 
            LIMIT $2
        `;

        const result = await db.query(query, [`%${q}%`, parseInt(limit)]);

        res.json({
            success: true,
            data: result.rows,
            query: q
        });
    } catch (error) {
        console.error('❌ Error searching logs:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to search logs',
            message: error.message
        });
    }
});

/**
 * POST /api/logs - Add new log entry (for external services)
 */
router.post('/', async (req, res) => {
    try {
        const { level, category, message, facility, data, userEmail } = req.body;

        if (!level || !category || !message) {
            return res.status(400).json({
                success: false,
                error: 'level, category, and message are required'
            });
        }

        const result = await db.insertLog(level, category, message, facility, data, userEmail);

        res.status(201).json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('❌ Error creating log entry:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to create log entry',
            message: error.message
        });
    }
});

/**
 * GET /api/logs/health - Health check endpoint
 */
router.get('/health', async (req, res) => {
    try {
        const health = await db.healthCheck();
        
        // Also check if tables exist
        const tablesResult = await db.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        `);
        
        res.json({
            success: true,
            health,
            tables: tablesResult.rows.map(r => r.table_name),
            tableCount: tablesResult.rows.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Health check failed',
            message: error.message
        });
    }
});

/**
 * GET /api/logs/debug - Debug database connection (production only)
 */
router.get('/debug', async (req, res) => {
    try {
        const debug = {
            hasDatabase: !!process.env.DATABASE_URL,
            nodeEnv: process.env.NODE_ENV,
            databaseUrlPrefix: process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 20) + '...' : 'MISSING',
            pgVariables: {
                PGHOST: process.env.PGHOST,
                PGPORT: process.env.PGPORT,
                PGDATABASE: process.env.PGDATABASE,
                PGUSER: process.env.PGUSER,
                PGPASSWORD: process.env.PGPASSWORD ? '***set***' : 'MISSING'
            },
            timestamp: new Date().toISOString()
        };
        
        res.json({
            success: true,
            debug
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Debug failed',
            message: error.message
        });
    }
});

/**
 * POST /api/logs/init-schema - Initialize database schema manually
 */
router.post('/init-schema', async (req, res) => {
    try {
        console.log('🔧 Manual schema initialization requested');
        await db.initializeSchema();
        
        // Check what tables were created
        const tablesResult = await db.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        `);
        
        res.json({
            success: true,
            message: 'Database schema initialized successfully',
            tables: tablesResult.rows.map(r => r.table_name),
            tableCount: tablesResult.rows.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Manual schema init failed:', error.message);
        res.status(500).json({
            success: false,
            error: 'Schema initialization failed',
            message: error.message
        });
    }
});

export default router;