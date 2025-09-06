import nodemailer from 'nodemailer';
import logger from './logger.js';

/**
 * Email Notification Service for REFRESH Studio
 * Sends alerts for all critical events to janko.tank.poi@gmail.com
 */
class EmailNotifier {
    constructor() {
        this.adminEmail = 'janko.tank.poi@gmail.com';
        this.fromEmail = 'refresh-studio@noreply.com';
        this.transporter = null;
        this.isEnabled = true;
        this.lastEmailTimes = new Map(); // Rate limiting
        this.minEmailInterval = 5 * 60 * 1000; // 5 minutes minimum between same type
        
        this.initializeTransporter();
    }
    
    /**
     * Initialize email transporter
     */
    async initializeTransporter() {
        try {
            // For production, you'll want to configure with your SMTP settings
            // For now, creating a test account for demonstration
            if (process.env.SMTP_HOST && process.env.SMTP_USER) {
                // Production SMTP configuration
                this.transporter = nodemailer.createTransport({
                    host: process.env.SMTP_HOST,
                    port: process.env.SMTP_PORT || 587,
                    secure: process.env.SMTP_SECURE === 'true',
                    auth: {
                        user: process.env.SMTP_USER,
                        pass: process.env.SMTP_PASS
                    }
                });
            } else {
                // Development: Create test account
                const testAccount = await nodemailer.createTestAccount();
                this.transporter = nodemailer.createTransport({
                    host: 'smtp.ethereal.email',
                    port: 587,
                    secure: false,
                    auth: {
                        user: testAccount.user,
                        pass: testAccount.pass
                    }
                });
                console.log('📧 Email notifications using test account:', testAccount.user);
                console.log('📧 View emails at: https://ethereal.email/');
            }
            
            // Verify connection
            await this.transporter.verify();
            logger.logSystem('email_transporter_ready', { 
                adminEmail: this.adminEmail,
                testMode: !process.env.SMTP_HOST 
            });
            
        } catch (error) {
            console.error('❌ Failed to initialize email transporter:', error.message);
            this.isEnabled = false;
            logger.logError('Failed to initialize email transporter', error, 'EMAIL');
        }
    }
    
    /**
     * Check rate limiting for email type
     */
    shouldSendEmail(emailType) {
        const lastSent = this.lastEmailTimes.get(emailType);
        const now = Date.now();
        
        if (lastSent && (now - lastSent) < this.minEmailInterval) {
            return false; // Rate limited
        }
        
        this.lastEmailTimes.set(emailType, now);
        return true;
    }
    
    /**
     * Send email notification
     */
    async sendEmail(subject, htmlContent, textContent = null, emailType = 'general') {
        if (!this.isEnabled || !this.transporter) {
            logger.logSystem('email_disabled', { subject, emailType });
            return false;
        }
        
        // Check rate limiting
        if (!this.shouldSendEmail(emailType)) {
            logger.logSystem('email_rate_limited', { subject, emailType });
            return false;
        }
        
        try {
            const mailOptions = {
                from: `"REFRESH Studio Monitor" <${this.fromEmail}>`,
                to: this.adminEmail,
                subject: `[REFRESH Studio] ${subject}`,
                html: htmlContent,
                text: textContent || this.stripHtml(htmlContent)
            };
            
            const info = await this.transporter.sendMail(mailOptions);
            
            logger.logSystem('email_sent', {
                emailType,
                subject,
                messageId: info.messageId,
                to: this.adminEmail,
                previewUrl: nodemailer.getTestMessageUrl(info) || null
            });
            
            console.log('📧 Email sent:', subject);
            if (nodemailer.getTestMessageUrl(info)) {
                console.log('📧 Preview URL:', nodemailer.getTestMessageUrl(info));
            }
            
            return true;
            
        } catch (error) {
            logger.logError('Failed to send email', error, 'EMAIL');
            console.error('❌ Failed to send email:', error.message);
            return false;
        }
    }
    
    /**
     * Strip HTML tags for text version
     */
    stripHtml(html) {
        return html.replace(/<[^>]*>/g, '').replace(/\\s+/g, ' ').trim();
    }
    
    /**
     * Format timestamp for emails
     */
    formatTimestamp(date = new Date()) {
        return date.toLocaleString('sk-SK', {
            timeZone: 'Europe/Bratislava',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }
    
    /**
     * Send authentication event notification
     */
    async notifyAuthEvent(event, details = {}) {
        const timestamp = this.formatTimestamp();
        const isError = event.includes('failed') || event.includes('error');
        const emoji = isError ? '🚨' : '🔐';
        
        const subject = `${emoji} Authentication ${event}`;
        
        const html = `
            <h2>${emoji} REFRESH Studio Authentication Event</h2>
            <div style="background: ${isError ? '#fee' : '#efe'}; padding: 15px; border-radius: 5px; margin: 10px 0;">
                <h3>Event: ${event}</h3>
                <p><strong>Time:</strong> ${timestamp}</p>
                <p><strong>Environment:</strong> ${details.environment || 'Unknown'}</p>
                <p><strong>User:</strong> ${details.username || 'Unknown'}</p>
                <p><strong>Facility:</strong> ${details.facility || 'Unknown'}</p>
                ${details.error ? `<p><strong>Error:</strong> ${details.error}</p>` : ''}
            </div>
            
            ${isError ? '<p style="color: red;"><strong>⚠️ This requires immediate attention!</strong></p>' : ''}
            
            <hr>
            <p><small>REFRESH Studio Monitoring System</small></p>
        `;
        
        await this.sendEmail(subject, html, null, 'auth');
    }
    
    /**
     * Send booking event notification
     */
    async notifyBookingEvent(event, bookingData = {}) {
        const timestamp = this.formatTimestamp();
        const isSuccess = event === 'success';
        const emoji = isSuccess ? '✅' : '❌';
        
        const subject = `${emoji} Booking ${event}`;
        
        const html = `
            <h2>${emoji} REFRESH Studio Booking Event</h2>
            <div style="background: ${isSuccess ? '#efe' : '#fee'}; padding: 15px; border-radius: 5px; margin: 10px 0;">
                <h3>Booking ${event}</h3>
                <p><strong>Time:</strong> ${timestamp}</p>
                <p><strong>Service:</strong> ${bookingData.serviceName || 'Unknown'}</p>
                <p><strong>Date:</strong> ${bookingData.date || 'Unknown'}</p>
                <p><strong>Time Slot:</strong> ${bookingData.timeFrom || 'Unknown'} - ${bookingData.timeTo || 'Unknown'}</p>
                <p><strong>Customer:</strong> ${bookingData.customerName || 'Unknown'}</p>
                <p><strong>Phone:</strong> ${bookingData.customerPhone || 'Unknown'}</p>
                <p><strong>Email:</strong> ${bookingData.customerEmail || 'Unknown'}</p>
                <p><strong>Price:</strong> ${bookingData.price || 'Unknown'}€</p>
                <p><strong>Worker:</strong> ${bookingData.worker?.label || 'Unknown'}</p>
                ${bookingData.error ? `<p><strong>Error:</strong> ${bookingData.error}</p>` : ''}
            </div>
            
            ${!isSuccess ? '<p style="color: red;"><strong>⚠️ Booking failed - please investigate!</strong></p>' : ''}
            
            <hr>
            <p><small>REFRESH Studio Monitoring System</small></p>
        `;
        
        await this.sendEmail(subject, html, null, 'booking');
    }
    
    /**
     * Send scheduler event notification
     */
    async notifySchedulerEvent(event, details = {}) {
        const timestamp = this.formatTimestamp();
        const isError = event.includes('failed') || event.includes('error');
        const emoji = isError ? '🚨' : '⏰';
        
        // Only send emails for important scheduler events
        const importantEvents = ['started', 'stopped', 'failed', 'refresh_failed', 'multiple_failures'];
        if (!importantEvents.some(e => event.includes(e))) {
            return;
        }
        
        const subject = `${emoji} Scheduler ${event}`;
        
        const html = `
            <h2>${emoji} REFRESH Studio Scheduler Event</h2>
            <div style="background: ${isError ? '#fee' : '#e8f4ff'}; padding: 15px; border-radius: 5px; margin: 10px 0;">
                <h3>Scheduler ${event}</h3>
                <p><strong>Time:</strong> ${timestamp}</p>
                <p><strong>Refresh Interval:</strong> ${details.refreshInterval ? Math.round(details.refreshInterval / 1000 / 60 / 60) + ' hours' : 'Unknown'}</p>
                <p><strong>Next Refresh:</strong> ${details.nextRefresh || 'Unknown'}</p>
                ${details.error ? `<p><strong>Error:</strong> ${details.error}</p>` : ''}
                ${details.stats ? `<p><strong>Success Rate:</strong> ${details.stats.successRate || 'Unknown'}</p>` : ''}
            </div>
            
            ${isError ? '<p style="color: red;"><strong>⚠️ Scheduler issue detected - check system status!</strong></p>' : ''}
            
            <hr>
            <p><small>REFRESH Studio Monitoring System</small></p>
        `;
        
        await this.sendEmail(subject, html, null, 'scheduler');
    }
    
    /**
     * Send system startup notification
     */
    async notifySystemStartup() {
        const timestamp = this.formatTimestamp();
        
        const subject = '🚀 System Started';
        
        const html = `
            <h2>🚀 REFRESH Studio System Started</h2>
            <div style="background: #efe; padding: 15px; border-radius: 5px; margin: 10px 0;">
                <p><strong>Time:</strong> ${timestamp}</p>
                <p><strong>Environment:</strong> ${process.env.BOOKIO_ENV || 'Development'}</p>
                <p><strong>Node Version:</strong> ${process.version}</p>
                <p><strong>PID:</strong> ${process.pid}</p>
            </div>
            
            <p>✅ System is now operational and monitoring for events.</p>
            
            <hr>
            <p><small>REFRESH Studio Monitoring System</small></p>
        `;
        
        await this.sendEmail(subject, html, null, 'system');
    }
    
    /**
     * Send daily summary
     */
    async sendDailySummary() {
        try {
            const stats = await logger.getLogStats();
            const timestamp = this.formatTimestamp();
            
            const subject = '📊 Daily Summary';
            
            const html = `
                <h2>📊 REFRESH Studio Daily Summary</h2>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 10px 0;">
                    <p><strong>Date:</strong> ${timestamp}</p>
                    <p><strong>Total Events:</strong> ${stats.total || 0}</p>
                    
                    <h4>By Level:</h4>
                    <ul>
                        <li>Errors: ${stats.byLevel?.ERROR || 0}</li>
                        <li>Warnings: ${stats.byLevel?.WARN || 0}</li>
                        <li>Info: ${stats.byLevel?.INFO || 0}</li>
                    </ul>
                    
                    <h4>By Category:</h4>
                    <ul>
                        <li>Authentication: ${stats.byCategory?.AUTH || 0}</li>
                        <li>Bookings: ${stats.byCategory?.BOOKING || 0}</li>
                        <li>Scheduler: ${stats.byCategory?.SCHEDULER || 0}</li>
                        <li>API: ${stats.byCategory?.API || 0}</li>
                    </ul>
                </div>
                
                ${stats.recentErrors?.length > 0 ? `
                    <div style="background: #fee; padding: 15px; border-radius: 5px; margin: 10px 0;">
                        <h4>⚠️ Recent Errors (${stats.recentErrors.length}):</h4>
                        <ul>
                            ${stats.recentErrors.slice(-5).map(error => 
                                `<li>${error.timestamp}: ${error.message}</li>`
                            ).join('')}
                        </ul>
                    </div>
                ` : '<p>✅ No errors in the last 24 hours!</p>'}
                
                <hr>
                <p><small>REFRESH Studio Monitoring System</small></p>
            `;
            
            await this.sendEmail(subject, html, null, 'daily_summary');
            
        } catch (error) {
            logger.logError('Failed to send daily summary', error, 'EMAIL');
        }
    }
    
    /**
     * Test email functionality
     */
    async sendTestEmail() {
        const subject = '🧪 Test Email';
        const html = `
            <h2>🧪 REFRESH Studio Email Test</h2>
            <p>This is a test email to verify the notification system is working correctly.</p>
            <p><strong>Time:</strong> ${this.formatTimestamp()}</p>
            <p>If you received this email, the notification system is operational! ✅</p>
            <hr>
            <p><small>REFRESH Studio Monitoring System</small></p>
        `;
        
        return await this.sendEmail(subject, html, null, 'test');
    }
}

export default new EmailNotifier();