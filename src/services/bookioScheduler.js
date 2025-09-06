import bookioAuthService from './bookioAuthService.js';
import config from '../../config/bookio-config.js';
import logger from './logger.js';
import emailNotifier from './emailNotifier.js';

/**
 * Bookio Scheduler Service
 * Handles automatic cookie refresh and scheduling
 */
class BookioScheduler {
    constructor() {
        this.refreshTimer = null;
        this.isRunning = false;
        this.refreshInterval = config.auth.cookieRefreshInterval || 11 * 60 * 60 * 1000; // 11 hours default
        this.refreshHistory = [];
        this.maxHistorySize = 100;
        
        // Statistics
        this.stats = {
            totalRefreshes: 0,
            successfulRefreshes: 0,
            failedRefreshes: 0,
            lastSuccess: null,
            lastFailure: null,
            startTime: null
        };
    }

    /**
     * Start the scheduler
     */
    async start() {
        if (this.isRunning) {
            console.log('⚠️ Scheduler already running');
            return false;
        }

        try {
            console.log(`⏰ Starting Bookio Auth Scheduler (${config.name} environment)`);
            console.log(`   Refresh interval: ${this.refreshInterval / 1000 / 60} minutes`);
            
            // Log scheduler startup
            await logger.logScheduler('starting', {
                environment: config.name,
                refreshInterval: this.refreshInterval,
                pid: process.pid
            });
            
            // Initialize auth service first
            await bookioAuthService.initialize();
            
            // Set up refresh timer
            this.setupRefreshTimer();
            
            this.isRunning = true;
            this.stats.startTime = new Date();
            
            console.log('✅ Scheduler started successfully');
            
            // Log initial status
            const status = bookioAuthService.getStatus();
            console.log(`📊 Initial status:`, {
                cookieValid: status.cookieValid,
                lastRefresh: status.lastRefresh,
                nextRefresh: status.nextRefresh
            });
            
            // Log successful startup
            await logger.logScheduler('started', {
                environment: config.name,
                refreshInterval: this.refreshInterval,
                nextRefresh: status.nextRefresh
            });
            
            // Send startup notification
            await emailNotifier.notifySchedulerEvent('started', {
                refreshInterval: this.refreshInterval,
                nextRefresh: status.nextRefresh
            });
            
            return true;
            
        } catch (error) {
            console.error('❌ Failed to start scheduler:', error.message);
            this.isRunning = false;
            
            // Log startup failure
            await logger.logError('Scheduler startup failed', error, 'SCHEDULER');
            
            await emailNotifier.notifySchedulerEvent('startup failed', {
                error: error.message,
                environment: config.name
            });
            
            throw error;
        }
    }

    /**
     * Stop the scheduler
     */
    stop() {
        if (!this.isRunning) {
            console.log('⚠️ Scheduler not running');
            return false;
        }
        
        console.log('🛑 Stopping scheduler');
        
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = null;
        }
        
        this.isRunning = false;
        
        console.log('✅ Scheduler stopped');
        return true;
    }

    /**
     * Set up refresh timer
     */
    setupRefreshTimer() {
        // Clear existing timer
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
        }
        
        // Calculate next refresh time
        const status = bookioAuthService.getStatus();
        let nextRefreshIn;
        
        if (status.nextRefresh) {
            // Use the calculated next refresh time
            nextRefreshIn = Math.max(0, new Date(status.nextRefresh).getTime() - Date.now());
        } else {
            // Default to refresh interval
            nextRefreshIn = this.refreshInterval;
        }
        
        // Ensure minimum delay
        nextRefreshIn = Math.max(60000, nextRefreshIn); // Minimum 1 minute
        
        console.log(`⏱️ Next refresh scheduled in ${Math.round(nextRefreshIn / 1000 / 60)} minutes`);
        
        // Set up timer
        this.refreshTimer = setTimeout(async () => {
            await this.performScheduledRefresh();
        }, nextRefreshIn);
    }

    /**
     * Perform scheduled refresh
     */
    async performScheduledRefresh() {
        console.log('🔄 Performing scheduled cookie refresh');
        
        const refreshStart = Date.now();
        const refreshEntry = {
            timestamp: new Date(),
            success: false,
            duration: 0,
            error: null
        };
        
        try {
            // Perform refresh
            await bookioAuthService.refreshCookie();
            
            // Update statistics
            refreshEntry.success = true;
            refreshEntry.duration = Date.now() - refreshStart;
            
            this.stats.totalRefreshes++;
            this.stats.successfulRefreshes++;
            this.stats.lastSuccess = new Date();
            
            console.log(`✅ Scheduled refresh completed in ${refreshEntry.duration}ms`);
            
            // Log successful refresh
            await logger.logScheduler('refresh_completed', {
                duration: refreshEntry.duration,
                totalRefreshes: this.stats.totalRefreshes,
                successRate: `${(this.stats.successfulRefreshes / this.stats.totalRefreshes * 100).toFixed(2)}%`
            });
            
        } catch (error) {
            // Update statistics
            refreshEntry.error = error.message;
            refreshEntry.duration = Date.now() - refreshStart;
            
            this.stats.totalRefreshes++;
            this.stats.failedRefreshes++;
            this.stats.lastFailure = new Date();
            
            console.error(`❌ Scheduled refresh failed: ${error.message}`);
            
            // Log refresh failure
            await logger.logError('Scheduled refresh failed', error, 'SCHEDULER');
            
            await logger.logScheduler('refresh_failed', {
                duration: refreshEntry.duration,
                error: error.message,
                failedRefreshes: this.stats.failedRefreshes,
                totalRefreshes: this.stats.totalRefreshes
            });
            
            // Send email for refresh failures
            await emailNotifier.notifySchedulerEvent('refresh failed', {
                error: error.message,
                duration: refreshEntry.duration,
                stats: {
                    totalRefreshes: this.stats.totalRefreshes,
                    failedRefreshes: this.stats.failedRefreshes,
                    successRate: `${(this.stats.successfulRefreshes / this.stats.totalRefreshes * 100).toFixed(2)}%`
                }
            });
            
            // Retry logic
            if (this.shouldRetry()) {
                console.log('🔄 Scheduling retry in 5 minutes');
                
                await logger.logScheduler('scheduling_retry', {
                    retryDelay: 5 * 60 * 1000,
                    attemptNumber: this.stats.failedRefreshes
                });
                
                setTimeout(async () => {
                    await this.performScheduledRefresh();
                }, 5 * 60 * 1000); // Retry in 5 minutes
                return;
            } else {
                // Too many failures - send critical alert
                await emailNotifier.notifySchedulerEvent('multiple failures', {
                    error: 'Too many refresh failures - manual intervention required',
                    stats: {
                        totalRefreshes: this.stats.totalRefreshes,
                        failedRefreshes: this.stats.failedRefreshes,
                        recentFailures: this.refreshHistory.slice(-5).filter(e => !e.success).length
                    }
                });
            }
        }
        
        // Add to history
        this.refreshHistory.push(refreshEntry);
        if (this.refreshHistory.length > this.maxHistorySize) {
            this.refreshHistory.shift();
        }
        
        // Schedule next refresh
        if (this.isRunning) {
            this.setupRefreshTimer();
        }
    }

    /**
     * Check if should retry after failure
     */
    shouldRetry() {
        // Get recent failures
        const recentFailures = this.refreshHistory
            .slice(-5)
            .filter(entry => !entry.success);
        
        // Don't retry if too many recent failures
        return recentFailures.length < 3;
    }

    /**
     * Force immediate refresh
     */
    async forceRefresh() {
        console.log('🔄 Forcing immediate refresh');
        
        try {
            await bookioAuthService.forceRefresh();
            
            // Reset timer for next scheduled refresh
            if (this.isRunning) {
                this.setupRefreshTimer();
            }
            
            return true;
            
        } catch (error) {
            console.error('❌ Force refresh failed:', error.message);
            throw error;
        }
    }

    /**
     * Get scheduler status
     */
    getStatus() {
        const authStatus = bookioAuthService.getStatus();
        
        return {
            scheduler: {
                running: this.isRunning,
                refreshInterval: this.refreshInterval,
                stats: this.stats,
                recentRefreshes: this.refreshHistory.slice(-10)
            },
            auth: authStatus
        };
    }

    /**
     * Get statistics
     */
    getStatistics() {
        const uptime = this.stats.startTime 
            ? Date.now() - this.stats.startTime.getTime() 
            : 0;
        
        const successRate = this.stats.totalRefreshes > 0
            ? (this.stats.successfulRefreshes / this.stats.totalRefreshes * 100).toFixed(2)
            : 0;
        
        return {
            uptime: Math.round(uptime / 1000 / 60), // minutes
            totalRefreshes: this.stats.totalRefreshes,
            successfulRefreshes: this.stats.successfulRefreshes,
            failedRefreshes: this.stats.failedRefreshes,
            successRate: `${successRate}%`,
            lastSuccess: this.stats.lastSuccess,
            lastFailure: this.stats.lastFailure,
            environment: config.name
        };
    }

    /**
     * Set custom refresh interval
     */
    setRefreshInterval(intervalMs) {
        if (intervalMs < 60000) {
            throw new Error('Refresh interval must be at least 1 minute');
        }
        
        console.log(`⏰ Updating refresh interval to ${intervalMs / 1000 / 60} minutes`);
        this.refreshInterval = intervalMs;
        
        // Reset timer if running
        if (this.isRunning) {
            this.setupRefreshTimer();
        }
    }
}

export default new BookioScheduler();