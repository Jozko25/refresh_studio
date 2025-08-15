# Vercel Deployment Guide

## 🚀 Fixed Issues

The 404 error was caused by Vercel needing a specific serverless function structure. Here's what was fixed:

### 1. **Created Vercel Configuration** (`vercel.json`)
- Configured serverless functions
- Set up URL rewrites
- Added environment variables

### 2. **Added Serverless API Structure**
- `/api/health.js` - Health check endpoint
- `/api/booking/[...path].js` - Main booking API handler

### 3. **URL Structure**
Your deployed API endpoints are now:
- **Health Check**: `https://bookio-rho.vercel.app/health`
- **Available Times**: `https://bookio-rho.vercel.app/api/booking/webhook/elevenlabs-available-times`
- **Soonest Available**: `https://bookio-rho.vercel.app/api/booking/webhook/elevenlabs-soonest-available`
- **Book Appointment**: `https://bookio-rho.vercel.app/api/booking/webhook/elevenlabs-book-appointment`
- **Unified Webhook**: `https://bookio-rho.vercel.app/api/booking/webhook/elevenlabs-unified`

## 🔧 Testing Commands

```bash
# Test health endpoint
curl https://bookio-rho.vercel.app/health

# Test available times
curl -X POST https://bookio-rho.vercel.app/api/booking/webhook/elevenlabs-available-times \
  -H "Content-Type: application/json" \
  -d '{"date": "18.08.2025"}'

# Test unified webhook
curl -X POST https://bookio-rho.vercel.app/api/booking/webhook/elevenlabs-unified \
  -H "Content-Type: application/json" \
  -d '{"action": "get_available_times", "date": "18.08.2025"}'
```

## 📱 ElevenLabs Configuration

Use the updated `BOOKIO_VERCEL_CONFIG.json` file with the correct Vercel URL:
```
https://bookio-rho.vercel.app/api/booking/webhook/elevenlabs-unified
```

## 🔄 Next Deployment Steps

1. **Commit and push** your changes to trigger Vercel rebuild
2. **Test the health endpoint** first: `https://bookio-rho.vercel.app/health`
3. **Update ElevenLabs** with the new configuration
4. **Test voice integration** with Slovak commands

## ⚙️ Environment Variables

Make sure these are set in your Vercel dashboard:
- `BOOKIO_FACILITY_ID=16052`
- `NODE_ENV=production`
