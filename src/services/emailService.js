import nodemailer from 'nodemailer';

/**
 * Email Notification Service
 * Sends email notifications for booking attempts
 */
class EmailService {
    constructor() {
        this.notificationEmail = 'janko.tank.poi@gmail.com';
        // Initialize email service asynchronously to not block startup
        this.initEmailService().catch(error => {
            console.error('❌ Email service initialization failed:', error);
            this.emailTransporter = null;
        });
    }

    /**
     * Initialize email service
     */
    async initEmailService() {
        try {
            // Debug environment variables in development
            if (process.env.NODE_ENV !== 'production') {
                console.log('📧 Email config debug:');
                console.log('EMAIL_USER:', process.env.EMAIL_USER || 'NOT SET');
                console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? `${process.env.EMAIL_PASS.substring(0, 4)}****` : 'NOT SET');
            }
            
            this.emailTransporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.EMAIL_USER || 'janko.tank.poi@gmail.com',
                    pass: process.env.EMAIL_PASS || 'iuekpqukojprkeww'
                }
            });
            
            console.log('📧 Email service initialized with Gmail');
        } catch (error) {
            console.warn('⚠️ Gmail service failed, using fallback:', error.message);
            
            // Fallback to ethereal email for testing
            await this.initTestEmailService();
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
    async sendBookingNotification(bookingData, result, endpoint = '/api/booking/create', location = 'bratislava') {
        if (!this.emailTransporter) {
            console.log('⚠️ Email service not available, skipping notification');
            return false;
        }

        try {
            // Location info
            const locationInfo = {
                bratislava: {
                    name: 'Bratislava',
                    address: 'Lazaretská 13, Bratislava',
                    widget_url: 'https://services.bookio.com/refresh-laserove-a-esteticke-studio-zu0yxr5l/widget?lang=sk'
                },
                pezinok: {
                    name: 'Pezinok',
                    address: 'Pezinok',
                    widget_url: 'https://services.bookio.com/refresh-laserove-a-esteticke-studio/widget?lang=sk'
                }
            };
            
            const currentLocation = locationInfo[location] || locationInfo.bratislava;
            
            const emailContent = {
                timestamp: new Date().toISOString(),
                location: currentLocation,
                service: bookingData.serviceName || 'Unknown service',
                appointment_time: `${bookingData.date} o ${bookingData.hour}`,
                customer: {
                    name: `${bookingData.firstName} ${bookingData.lastName}`,
                    email: bookingData.email,
                    phone: bookingData.phone
                },
                booking_url: currentLocation.widget_url
            };

            const subject = result.success ? 
                '✅ BOOKING SUCCESS - Order Created!' : 
                '❌ BOOKING ATTEMPT - Failed';

            const mailOptions = {
                from: process.env.EMAIL_USER || 'booking-notifications@refresh-studio.com',
                to: this.notificationEmail,
                subject: `🎯 ${subject} - ${currentLocation.name}`,
                text: `Booking Notification\n\n${JSON.stringify(emailContent, null, 2)}`,
                html: `
                    <h2>🎯 Booking Notification: ${result.success ? 'SUCCESS ✅' : 'FAILED ❌'}</h2>
                    
                    <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #2196f3;">
                        <h3>📍 Location: ${currentLocation.name}</h3>
                        <p><strong>Address:</strong> ${currentLocation.address}</p>
                        <p><strong>Booking URL:</strong> <a href="${currentLocation.widget_url}">${currentLocation.widget_url}</a></p>
                    </div>

                    <div style="background: #fff3e0; padding: 20px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #ff9800;">
                        <h3>💼 Service Details</h3>
                        <p><strong>Service:</strong> ${emailContent.service}</p>
                        <p><strong>Appointment:</strong> ${emailContent.appointment_time}</p>
                    </div>

                    <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #4caf50;">
                        <h3>👤 Customer Information</h3>
                        <p><strong>Name:</strong> ${emailContent.customer.name}</p>
                        <p><strong>Email:</strong> ${emailContent.customer.email}</p>
                        <p><strong>Phone:</strong> ${emailContent.customer.phone || 'N/A'}</p>
                    </div>
                    
                    <hr style="margin: 30px 0;">
                    <p><small>Timestamp: ${emailContent.timestamp}</small></p>
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