# 🏥 REFRESH Studio - Production Deployment Guide

## 📧 Complete Logging & Email Monitoring System

Your REFRESH Studio booking system now has **comprehensive monitoring** that sends all events to **janko.tank.poi@gmail.com**.

## ✅ What's Monitored

### 🔐 Authentication Events
- ✅ Login attempts (success/failure)
- ✅ Token refresh cycles (every 11 hours)
- ✅ Session expiry warnings
- ✅ Authentication errors

### 📋 Booking Events  
- ✅ Booking attempts
- ✅ Successful bookings (with full details)
- ✅ Booking failures (with error details)
- ✅ API response errors
- ✅ Customer information logging

### ⏰ Scheduler Events
- ✅ Scheduler startup/shutdown
- ✅ Automatic refresh cycles
- ✅ Refresh failures and retries
- ✅ Multiple failure alerts (critical)

### 🖥️ System Events
- ✅ Service startup notifications
- ✅ System errors and crashes
- ✅ Daily summary reports
- ✅ Performance statistics

## 🚀 Production Setup

### 1. Email Configuration (Required for Production)

Add these environment variables to your `.env` file:

```bash
# Production SMTP Configuration
SMTP_HOST=your-smtp-server.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@company.com
SMTP_PASS=your-email-password

# Alternative: Gmail SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=your-app-password  # Use App Password, not regular password
```

### 2. Start Production Monitoring

```javascript
import { ProductionBookingService } from './PRODUCTION_BOOKING_SYSTEM.mjs';
import bookioScheduler from './src/services/bookioScheduler.js';

// Start the complete system
const bookingService = new ProductionBookingService();
await bookingService.initialize();

// Start automatic token refresh scheduler
await bookioScheduler.start();

console.log('🚀 REFRESH Studio production system active!');
```

### 3. Integration with Voice Agent

```javascript
import { ProductionBookingService } from './PRODUCTION_BOOKING_SYSTEM.mjs';

const bookingService = new ProductionBookingService();

// For HydraFacial bookings
await bookingService.createHydrafacialBooking(
    {
        name: customerName,
        phone: customerPhone, 
        email: customerEmail
    },
    {
        date: '15.12.2025',  // DD.MM.YYYY
        from: '14:00',
        to: '15:00'
    }
);

// For Laser bookings
await bookingService.createLaserBooking(customerData, bookingTime);
```

## 📊 Email Notifications You'll Receive

### 🎉 Successful Booking
- **Subject**: `[REFRESH Studio] ✅ Booking success`
- **Content**: Full booking details (service, date, time, customer info)
- **Triggered**: Every successful booking

### ❌ Booking Failure
- **Subject**: `[REFRESH Studio] ❌ Booking failed`
- **Content**: Error details and booking data for debugging
- **Triggered**: Failed bookings, API errors

### 🔐 Authentication Issues
- **Subject**: `[REFRESH Studio] 🚨 Authentication failed`
- **Content**: Login errors, token refresh failures
- **Triggered**: Auth problems requiring attention

### ⏰ Scheduler Alerts
- **Subject**: `[REFRESH Studio] 🚨 Scheduler multiple failures`
- **Content**: Critical alerts when auto-refresh fails repeatedly
- **Triggered**: System needs manual intervention

### 📈 Daily Summary
- **Subject**: `[REFRESH Studio] 📊 Daily Summary`
- **Content**: Statistics, error counts, system health
- **Triggered**: Once per day (configurable)

## 📁 Log Files

All events are logged to structured JSON files:
- **Location**: `./logs/refresh-booking-YYYY-MM-DD.log`
- **Format**: JSON with timestamps, levels, categories
- **Retention**: 30 days (automatic cleanup)
- **Categories**: AUTH, BOOKING, SCHEDULER, API, SYSTEM

## 🔧 Monitoring Dashboard

Check system status anytime:

```javascript
const stats = await bookingService.getSystemStats();
console.log('📊 System Status:', stats);

// View recent logs
const logs = await logger.getRecentLogs(50);
console.log('📝 Recent activity:', logs);

// Check scheduler status  
const schedulerStatus = bookioScheduler.getStatus();
console.log('⏰ Scheduler:', schedulerStatus);
```

## 🚨 Alert Levels

### 🟢 INFO (Normal Operation)
- Successful bookings
- Scheduled refreshes
- System startup

### 🟡 WARN (Attention Needed)
- Booking retries
- Single refresh failures
- Rate limiting

### 🔴 ERROR (Immediate Action)
- Multiple auth failures
- System crashes
- Critical booking errors

## 📧 Test Email System

```bash
# Test email notifications
node TEST_MONITORING_SYSTEM.mjs
```

**Preview URLs**: During development, test emails are viewable at:
- https://ethereal.email/

## 🔄 12-Hour Token Refresh Cycle

The system automatically:
1. **Refreshes tokens every 11 hours** (1-hour safety buffer)
2. **Sends email on refresh failures**
3. **Retries failed refreshes** (up to 3 times)
4. **Alerts on critical failures** requiring manual intervention

## ⚡ Quick Production Start

```bash
# 1. Configure SMTP in .env
# 2. Start the system
node -e "
import { ProductionBookingService } from './PRODUCTION_BOOKING_SYSTEM.mjs';
import bookioScheduler from './src/services/bookioScheduler.js';

async function startProduction() {
    const service = new ProductionBookingService();
    await service.initialize();
    await bookioScheduler.start();
    
    console.log('🚀 REFRESH Studio production active!');
    console.log('📧 Monitoring emails sent to: janko.tank.poi@gmail.com');
    console.log('📊 Logs: ./logs/');
    console.log('⏰ Next refresh in 11 hours');
}

startProduction().catch(console.error);
"
```

---

## 🎯 Summary

✅ **Comprehensive logging** - Every action logged with structured data  
✅ **Real-time email alerts** - Instant notifications to janko.tank.poi@gmail.com  
✅ **Automatic monitoring** - 24/7 system health checks  
✅ **12-hour auth cycle** - Automatic token refresh with failure handling  
✅ **Production ready** - Full error handling and recovery  

Your REFRESH Studio booking system is now **enterprise-grade** with complete observability! 🚀