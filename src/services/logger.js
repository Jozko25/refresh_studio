import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../database/connection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Production Logger for REFRESH Studio
 * Comprehensive logging with structured data and file rotation
 */
class Logger {
    constructor() {
        this.logDir = path.join(__dirname, '../../logs');
        this.currentLogFile = null;
        this.logLevel = process.env.LOG_LEVEL || 'info';
        this.dbInitialized = false;
        
        // Log levels (higher number = more verbose)
        this.levels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3
        };
        
        this.currentLevel = this.levels[this.logLevel] || 2;
        
        // Initialize log directory and database
        this.initLogDirectory();
        this.initDatabase();
    }

    /**
     * Initialize database connection
     */
    async initDatabase() {
        try {
            await db.initialize();
            this.dbInitialized = true;
            console.log('✅ Logger database connection initialized');
        } catch (error) {
            console.error('❌ Logger database initialization failed:', error.message);
            this.dbInitialized = false;
        }
    }
    
    /**
     * Initialize logging directory
     */
    async initLogDirectory() {
        try {
            await fs.mkdir(this.logDir, { recursive: true });
            this.currentLogFile = path.join(this.logDir, `refresh-booking-${this.getDateString()}.log`);
        } catch (error) {
            console.error('Failed to initialize log directory:', error.message);
        }
    }
    
    /**
     * Get date string for log file names
     */
    getDateString() {
        const now = new Date();
        return now.toISOString().split('T')[0]; // YYYY-MM-DD
    }
    
    /**
     * Get timestamp string
     */
    getTimestamp() {
        return new Date().toISOString();
    }
    
    /**
     * Write log entry to file AND database
     */
    async writeLog(level, category, message, data = {}) {
        if (this.levels[level] > this.currentLevel) {
            return; // Skip if below current log level
        }
        
        const logEntry = {
            timestamp: this.getTimestamp(),
            level: level.toUpperCase(),
            category,
            message,
            data,
            pid: process.pid
        };
        
        const logLine = JSON.stringify(logEntry) + '\n';
        
        try {
            // Write to file (existing functionality)
            const currentDate = this.getDateString();
            const expectedFile = path.join(this.logDir, `refresh-booking-${currentDate}.log`);
            
            if (this.currentLogFile !== expectedFile) {
                this.currentLogFile = expectedFile;
            }
            
            await fs.appendFile(this.currentLogFile, logLine);
            
            // Write to database and return result
            let dbResult = null;
            if (this.dbInitialized) {
                try {
                    dbResult = await db.insertLog(
                        level,
                        category,
                        message,
                        data.facility || null,
                        data,
                        data.userEmail || null
                    );
                } catch (dbError) {
                    console.error('❌ Failed to write to database:', dbError.message);
                    // Continue - don't fail the entire log operation if DB is down
                }
            }
            
            // Also log to console in development
            if (process.env.NODE_ENV !== 'production') {
                const consoleMsg = `[${logEntry.timestamp}] ${logEntry.level} [${category}] ${message}`;
                console.log(consoleMsg);
                if (Object.keys(data).length > 0) {
                    console.log('Data:', data);
                }
            }
            
            return dbResult;
            
        } catch (error) {
            console.error('Failed to write log:', error.message);
            return null;
        }
    }
    
    /**
     * Log authentication events
     */
    async logAuth(event, details = {}) {
        await this.writeLog('info', 'AUTH', `Authentication ${event}`, {
            event,
            environment: details.environment,
            user: details.username,
            facility: details.facility,
            ...details
        });
    }
    
    /**
     * Log booking events with detailed database entry
     */
    async logBooking(event, bookingData = {}) {
        const level = event === 'success' ? 'info' : 'error';
        
        // Write to main log
        const logResult = await this.writeLog(level, 'BOOKING', `Booking ${event}`, {
            event,
            service: bookingData.serviceName,
            date: bookingData.date,
            time: bookingData.timeFrom,
            customer: bookingData.customerName,
            phone: bookingData.customerPhone,
            email: bookingData.customerEmail,
            price: bookingData.price,
            worker: bookingData.worker?.label,
            facility: bookingData.facility,
            ...bookingData
        });
        
        // Write detailed booking event to database
        if (this.dbInitialized && logResult) {
            try {
                await db.insertBookingEvent(logResult.id, {
                    eventType: event,
                    facility: bookingData.facility,
                    serviceId: bookingData.serviceId,
                    serviceName: bookingData.serviceName,
                    customerName: bookingData.customerName,
                    customerEmail: bookingData.customerEmail,
                    customerPhone: bookingData.customerPhone,
                    bookingDate: bookingData.date,
                    bookingTimeFrom: bookingData.timeFrom,
                    bookingTimeTo: bookingData.timeTo,
                    price: bookingData.price,
                    workerName: bookingData.worker?.label,
                    bookingId: bookingData.bookingId,
                    errorMessage: bookingData.errorMessage
                });
            } catch (dbError) {
                console.error('❌ Failed to write booking event to database:', dbError.message);
            }
        }
    }
    
    /**
     * Log scheduler events
     */
    async logScheduler(event, details = {}) {
        const level = event.includes('error') || event.includes('failed') ? 'error' : 'info';
        await this.writeLog(level, 'SCHEDULER', `Scheduler ${event}`, {
            event,
            refreshInterval: details.refreshInterval,
            nextRefresh: details.nextRefresh,
            ...details
        });
    }
    
    /**
     * Log API events
     */
    async logAPI(event, details = {}) {
        const level = details.status >= 400 ? 'error' : 'info';
        await this.writeLog(level, 'API', `API ${event}`, {
            event,
            endpoint: details.endpoint,
            status: details.status,
            method: details.method,
            duration: details.duration,
            ...details
        });
    }
    
    /**
     * Log system events
     */
    async logSystem(event, details = {}) {
        const level = event.includes('error') || event.includes('failed') ? 'error' : 'info';
        await this.writeLog(level, 'SYSTEM', `System ${event}`, {
            event,
            ...details
        });
    }
    
    /**
     * Log errors with stack trace
     */
    async logError(message, error, category = 'ERROR') {
        await this.writeLog('error', category, message, {
            error: error.message,
            stack: error.stack,
            name: error.name
        });
    }
    
    /**
     * Get recent logs
     */
    async getRecentLogs(lines = 100, category = null) {
        try {
            if (!this.currentLogFile) {
                return [];
            }
            
            const content = await fs.readFile(this.currentLogFile, 'utf8');
            const allLines = content.trim().split('\n').filter(line => line);
            
            // Parse and filter lines
            let logs = allLines.map(line => {
                try {
                    return JSON.parse(line);
                } catch {
                    return null;
                }
            }).filter(log => log);
            
            // Filter by category if specified
            if (category) {
                logs = logs.filter(log => log.category === category);
            }
            
            // Return most recent lines
            return logs.slice(-lines);
            
        } catch (error) {
            console.error('Failed to read logs:', error.message);
            return [];
        }
    }
    
    /**
     * Clean old log files (keep last 30 days)
     */
    async cleanOldLogs() {
        try {
            const files = await fs.readdir(this.logDir);
            const logFiles = files.filter(file => file.startsWith('refresh-booking-') && file.endsWith('.log'));
            
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - 30);
            
            for (const file of logFiles) {
                const dateMatch = file.match(/refresh-booking-(\\d{4}-\\d{2}-\\d{2})\\.log/);
                if (dateMatch) {
                    const fileDate = new Date(dateMatch[1]);
                    if (fileDate < cutoffDate) {
                        await fs.unlink(path.join(this.logDir, file));
                        console.log(`Cleaned old log file: ${file}`);
                    }
                }
            }
        } catch (error) {
            console.error('Failed to clean old logs:', error.message);
        }
    }
    
    /**
     * Get log statistics
     */
    async getLogStats() {
        try {
            const logs = await this.getRecentLogs(1000);
            
            const stats = {
                total: logs.length,
                byLevel: {},
                byCategory: {},
                recentErrors: logs.filter(log => log.level === 'ERROR').slice(-10),
                timespan: logs.length > 0 ? {
                    from: logs[0].timestamp,
                    to: logs[logs.length - 1].timestamp
                } : null
            };
            
            // Count by level
            logs.forEach(log => {
                stats.byLevel[log.level] = (stats.byLevel[log.level] || 0) + 1;
                stats.byCategory[log.category] = (stats.byCategory[log.category] || 0) + 1;
            });
            
            return stats;
            
        } catch (error) {
            console.error('Failed to get log stats:', error.message);
            return {};
        }
    }
}

export default new Logger();