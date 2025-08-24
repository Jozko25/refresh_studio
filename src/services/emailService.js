import nodemailer from 'nodemailer';

/**
 * Email Notification Service
 * Sends email notifications for booking attempts
 */
class EmailService {
    constructor() {
        this.notificationEmail = 'janko.tank.poi@gmail.com';
        this.initEmailService();
    }

    /**
     * Initialize email service
     */
    initEmailService() {
        try {
            // Debug environment variables
            console.log('📧 Email config debug:');
            console.log('EMAIL_USER:', process.env.EMAIL_USER || 'NOT SET');
            console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? `${process.env.EMAIL_PASS.substring(0, 4)}****` : 'NOT SET');
            
            this.emailTransporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.EMAIL_USER || 'janko.tank.poi@gmail.com',
                    pass: process.env.EMAIL_PASS || 'iuekpqukojprkeww'
                }
            });
            
            console.log('📧 Email service initialized with Gmail');
        } catch (error) {
            console.error('❌ Email service failed to initialize:', error);
            
            // Fallback to ethereal email for testing
            this.initTestEmailService();
        }
    }

    /**
     * Fallback test email service
     */
    async initTestEmailService() {
        try {
            const testAccount = await nodemailer.createTestAccount();
            
            this.emailTransporter = nodemailer.createTransport({
                host: 'smtp.ethereal.email',
                port: 587,
                secure: false,
                auth: {
                    user: testAccount.user,
                    pass: testAccount.pass
                }
            });
            
            console.log('📧 Test email service initialized (Ethereal)');
            console.log('📧 Test URL: https://ethereal.email/login');
        } catch (error) {
            console.error('❌ Failed to initialize test email service:', error);
            this.emailTransporter = null;
        }
    }

    /**
     * Send booking notification email
     */
    async sendBookingNotification(bookingData, result, endpoint = '/api/booking/create') {
        if (!this.emailTransporter) {
            console.log('⚠️ Email service not available, skipping notification');
            return false;
        }

        try {
            const emailContent = {
                timestamp: new Date().toISOString(),
                endpoint: endpoint,
                booking_request: bookingData,
                booking_result: result,
                server_info: {
                    environment: process.env.NODE_ENV || 'development',
                    railway_environment: process.env.RAILWAY_ENVIRONMENT || 'local'
                }
            };

            const subject = result.success ? 
                '✅ BOOKING SUCCESS - Order Created!' : 
                '❌ BOOKING ATTEMPT - Failed';

            const mailOptions = {
                from: process.env.EMAIL_USER || 'booking-notifications@refresh-studio.com',
                to: this.notificationEmail,
                subject: `🎯 ${subject}`,
                text: `Booking Notification\n\n${JSON.stringify(emailContent, null, 2)}`,
                html: `
                    <h2>🎯 Booking Notification: ${result.success ? 'SUCCESS ✅' : 'FAILED ❌'}</h2>
                    
                    <div style="background: ${result.success ? '#d4edda' : '#f8d7da'}; padding: 15px; border-radius: 5px; margin: 15px 0;">
                        <h3>📊 Result:</h3>
                        <p><strong>Success:</strong> ${result.success}</p>
                        ${result.success ? `<p><strong>Order ID:</strong> ${result.order?.orderId || 'N/A'}</p>` : ''}
                        <p><strong>Message:</strong> ${result.message || 'No message'}</p>
                        ${result.errors ? `<p><strong>Errors:</strong> ${JSON.stringify(result.errors)}</p>` : ''}
                    </div>

                    <h3>📧 Booking Request:</h3>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 5px;">
                        <p><strong>Service ID:</strong> ${bookingData.serviceId}</p>
                        <p><strong>Date:</strong> ${bookingData.date}</p>
                        <p><strong>Time:</strong> ${bookingData.hour}</p>
                        <p><strong>Name:</strong> ${bookingData.firstName} ${bookingData.lastName}</p>
                        <p><strong>Email:</strong> ${bookingData.email}</p>
                        <p><strong>Phone:</strong> ${bookingData.phone || 'N/A'}</p>
                        ${bookingData.note ? `<p><strong>Note:</strong> ${bookingData.note}</p>` : ''}
                    </div>
                    
                    <h3>🔍 Full JSON Data:</h3>
                    <pre style="background: #f5f5f5; padding: 15px; border-radius: 5px; overflow-x: auto; font-size: 12px;">${JSON.stringify(emailContent, null, 2)}</pre>
                    
                    <hr>
                    <p><small>Timestamp: ${emailContent.timestamp}</small></p>
                    <p><small>Environment: ${emailContent.server_info.environment}</small></p>
                    <p><small>🚀 Refresh Studio Booking System</small></p>
                `
            };

            const info = await this.emailTransporter.sendMail(mailOptions);
            
            console.log('📧 Booking notification email sent:', info.messageId);
            
            if (process.env.NODE_ENV !== 'production') {
                console.log('📧 Preview URL:', nodemailer.getTestMessageUrl(info));
            }
            
            return true;
            
        } catch (error) {
            console.error('❌ Failed to send booking notification:', error);
            return false;
        }
    }

    /**
     * Send test email
     */
    async sendTestEmail() {
        const testBookingData = {
            serviceId: 130113,
            date: '26.08.2025',
            hour: '15:10',
            firstName: 'Test',
            lastName: 'User',
            email: 'test@example.com',
            phone: '+421900000000',
            note: 'Test booking notification'
        };

        const testResult = {
            success: true,
            message: 'This is a test booking notification',
            method: 'test',
            order: {
                orderId: 'TEST-123456'
            }
        };

        return await this.sendBookingNotification(testBookingData, testResult, '/api/test');
    }
}

export default new EmailService();