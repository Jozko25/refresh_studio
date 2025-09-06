import pg from 'pg';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Database Connection Manager for REFRESH Studio Logging
 */
class DatabaseConnection {
    constructor() {
        this.pool = null;
        this.isConnected = false;
        this.retryCount = 0;
        this.maxRetries = 5;
        this.retryDelay = 2000; // 2 seconds
    }

    /**
     * Initialize database connection
     */
    async initialize() {
        try {
            console.log('🔌 Initializing database connection...');
            console.log('Database URL exists:', !!process.env.DATABASE_URL);
            console.log('NODE_ENV:', process.env.NODE_ENV);
            console.log('POSTGRES_USER:', process.env.POSTGRES_USER);
            console.log('POSTGRES_DB:', process.env.POSTGRES_DB);
            console.log('POSTGRES_PASSWORD exists:', !!process.env.POSTGRES_PASSWORD);
            
            // Remove DATABASE_URL requirement since Railway uses template variables
            
            // Create connection pool - try different approaches
            let poolConfig;
            
            if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('{{')) {
                // Use DATABASE_URL if it's properly resolved
                poolConfig = {
                    connectionString: process.env.DATABASE_URL,
                    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
                };
            } else if (process.env.PGHOST && process.env.PGUSER && process.env.PGPASSWORD && process.env.PGDATABASE) {
                // Build from individual PG variables
                poolConfig = {
                    host: process.env.PGHOST,
                    port: parseInt(process.env.PGPORT) || 5432,
                    user: process.env.PGUSER,
                    password: process.env.PGPASSWORD,
                    database: process.env.PGDATABASE,
                    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
                };
                console.log('🔧 Using individual PG environment variables');
            } else {
                // Build from Railway environment variables using internal networking
                // Try different possible variable names that Railway might use
                const dbHost = process.env.PGHOST || 'postgres.railway.internal';
                const dbPort = parseInt(process.env.PGPORT) || 5432;
                const dbUser = process.env.PGUSER || process.env.POSTGRES_USER || 'postgres';
                const dbPassword = process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD;
                const dbName = process.env.PGDATABASE || process.env.POSTGRES_DB || process.env.POSTGRES_DATABASE;
                
                if (!dbPassword || !dbName) {
                    throw new Error('Missing required database credentials');
                }
                
                poolConfig = {
                    host: dbHost,
                    port: dbPort,
                    user: dbUser,
                    password: dbPassword,
                    database: dbName,
                    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
                };
                console.log('🔧 Using Railway database configuration');
                console.log('Host:', dbHost);
                console.log('Port:', dbPort);
                console.log('Database:', dbName);
                console.log('User:', dbUser);
            }
            
            // Add common pool settings
            poolConfig.max = 10;
            poolConfig.idleTimeoutMillis = 30000;
            poolConfig.connectionTimeoutMillis = 10000;
            
            this.pool = new Pool(poolConfig);
            
            console.log('✅ Database pool created');

            // Test connection
            const client = await this.pool.connect();
            await client.query('SELECT NOW()');
            client.release();
            
            console.log('✅ Database connection established');
            this.isConnected = true;
            this.retryCount = 0;

            // Initialize schema
            await this.initializeSchema();
            
            return true;
        } catch (error) {
            console.error('❌ Database connection failed:', error.message);
            this.isConnected = false;
            
            // Retry logic
            if (this.retryCount < this.maxRetries) {
                this.retryCount++;
                console.log(`🔄 Retrying database connection (${this.retryCount}/${this.maxRetries}) in ${this.retryDelay}ms...`);
                
                await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                return await this.initialize();
            } else {
                throw new Error(`Database connection failed after ${this.maxRetries} attempts: ${error.message}`);
            }
        }
    }

    /**
     * Initialize database schema
     */
    async initializeSchema() {
        try {
            console.log('🏗️  Initializing database schema...');
            
            const schemaPath = path.join(__dirname, 'schema.sql');
            const schemaSQL = await fs.readFile(schemaPath, 'utf8');
            
            // Split SQL by statement and execute one by one for better error handling
            const statements = schemaSQL
                .split(';')
                .map(stmt => stmt.trim())
                .filter(stmt => stmt.length > 0);
            
            console.log(`📊 Executing ${statements.length} SQL statements...`);
            
            for (let i = 0; i < statements.length; i++) {
                const statement = statements[i] + ';';
                try {
                    await this.pool.query(statement);
                    console.log(`✅ Statement ${i + 1}/${statements.length} executed`);
                } catch (stmtError) {
                    // Log but don't fail on CREATE IF NOT EXISTS errors
                    if (stmtError.message.includes('already exists')) {
                        console.log(`⚠️  Statement ${i + 1}: Object already exists (ok)`);
                    } else {
                        console.error(`❌ Statement ${i + 1} failed:`, stmtError.message);
                        console.error(`Statement: ${statement.substring(0, 100)}...`);
                    }
                }
            }
            
            console.log('✅ Database schema initialization complete');
            
            // Test the schema by checking if tables exist
            const tablesResult = await this.pool.query(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public'
            `);
            
            console.log(`📋 Created tables: ${tablesResult.rows.map(r => r.table_name).join(', ')}`);
            
        } catch (error) {
            console.error('❌ Schema initialization failed:', error.message);
            console.error(error.stack);
            throw error;
        }
    }

    /**
     * Execute a query
     */
    async query(text, params = []) {
        if (!this.isConnected) {
            await this.initialize();
        }

        try {
            const result = await this.pool.query(text, params);
            return result;
        } catch (error) {
            console.error('❌ Database query failed:', error.message);
            console.error('Query:', text);
            console.error('Params:', params);
            throw error;
        }
    }

    /**
     * Insert log entry
     */
    async insertLog(level, category, message, facility = null, data = null, userEmail = null) {
        const query = `
            INSERT INTO logs (level, category, message, facility, data, user_email)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, timestamp
        `;
        
        const values = [
            level,
            category,
            message,
            facility,
            data ? JSON.stringify(data) : null,
            userEmail
        ];

        try {
            const result = await this.query(query, values);
            return result.rows[0];
        } catch (error) {
            console.error('❌ Failed to insert log:', error.message);
            throw error;
        }
    }

    /**
     * Insert booking event
     */
    async insertBookingEvent(logId, eventData) {
        const query = `
            INSERT INTO booking_events (
                log_id, event_type, facility, service_id, service_name,
                customer_name, customer_email, customer_phone,
                booking_date, booking_time_from, booking_time_to,
                price, worker_name, booking_id, error_message
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            RETURNING id
        `;

        const values = [
            logId,
            eventData.eventType,
            eventData.facility,
            eventData.serviceId,
            eventData.serviceName,
            eventData.customerName,
            eventData.customerEmail,
            eventData.customerPhone,
            eventData.bookingDate,
            eventData.bookingTimeFrom,
            eventData.bookingTimeTo,
            eventData.price,
            eventData.workerName,
            eventData.bookingId,
            eventData.errorMessage
        ];

        try {
            const result = await this.query(query, values);
            return result.rows[0];
        } catch (error) {
            console.error('❌ Failed to insert booking event:', error.message);
            throw error;
        }
    }

    /**
     * Insert auth event
     */
    async insertAuthEvent(logId, eventData) {
        const query = `
            INSERT INTO auth_events (
                log_id, event_type, facility, username, success, 
                error_message, token_expiry
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
        `;

        const values = [
            logId,
            eventData.eventType,
            eventData.facility,
            eventData.username,
            eventData.success,
            eventData.errorMessage,
            eventData.tokenExpiry
        ];

        try {
            const result = await this.query(query, values);
            return result.rows[0];
        } catch (error) {
            console.error('❌ Failed to insert auth event:', error.message);
            throw error;
        }
    }

    /**
     * Insert API event
     */
    async insertApiEvent(logId, eventData) {
        const query = `
            INSERT INTO api_events (
                log_id, event_type, facility, endpoint, method,
                status_code, duration_ms, request_data, response_size,
                success, error_message
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING id
        `;

        const values = [
            logId,
            eventData.eventType,
            eventData.facility,
            eventData.endpoint,
            eventData.method,
            eventData.statusCode,
            eventData.durationMs,
            eventData.requestData ? JSON.stringify(eventData.requestData) : null,
            eventData.responseSize,
            eventData.success,
            eventData.errorMessage
        ];

        try {
            const result = await this.query(query, values);
            return result.rows[0];
        } catch (error) {
            console.error('❌ Failed to insert API event:', error.message);
            throw error;
        }
    }

    /**
     * Get recent logs
     */
    async getRecentLogs(limit = 50, filters = {}) {
        let query = `
            SELECT l.*, 
                   be.event_type as booking_event_type,
                   be.customer_name,
                   ae.event_type as auth_event_type,
                   ae.username,
                   api.event_type as api_event_type,
                   api.endpoint
            FROM logs l
            LEFT JOIN booking_events be ON l.id = be.log_id
            LEFT JOIN auth_events ae ON l.id = ae.log_id
            LEFT JOIN api_events api ON l.id = api.log_id
            WHERE 1=1
        `;

        const params = [];
        let paramCount = 0;

        // Add filters
        if (filters.level) {
            paramCount++;
            query += ` AND l.level = $${paramCount}`;
            params.push(filters.level);
        }

        if (filters.category) {
            paramCount++;
            query += ` AND l.category = $${paramCount}`;
            params.push(filters.category);
        }

        if (filters.facility) {
            paramCount++;
            query += ` AND l.facility = $${paramCount}`;
            params.push(filters.facility);
        }

        if (filters.from) {
            paramCount++;
            query += ` AND l.timestamp >= $${paramCount}`;
            params.push(filters.from);
        }

        if (filters.to) {
            paramCount++;
            query += ` AND l.timestamp <= $${paramCount}`;
            params.push(filters.to);
        }

        query += ` ORDER BY l.timestamp DESC LIMIT $${paramCount + 1}`;
        params.push(limit);

        try {
            const result = await this.query(query, params);
            return result.rows;
        } catch (error) {
            console.error('❌ Failed to get recent logs:', error.message);
            throw error;
        }
    }

    /**
     * Get dashboard stats
     */
    async getDashboardStats() {
        try {
            const result = await this.query('SELECT * FROM dashboard_stats');
            return result.rows[0];
        } catch (error) {
            console.error('❌ Failed to get dashboard stats:', error.message);
            throw error;
        }
    }

    /**
     * Close connection pool
     */
    async close() {
        if (this.pool) {
            await this.pool.end();
            this.isConnected = false;
            console.log('🔌 Database connection closed');
        }
    }

    /**
     * Health check
     */
    async healthCheck() {
        try {
            await this.query('SELECT 1');
            return { status: 'healthy', connected: true };
        } catch (error) {
            return { status: 'unhealthy', connected: false, error: error.message };
        }
    }
}

// Export singleton instance
export default new DatabaseConnection();