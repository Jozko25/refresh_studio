import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// Load environment variables FIRST before importing routes
dotenv.config();

import refreshClinicRoutes from './routes/refreshClinic.js';
import slotsRoutes from './routes/slots.js';
import callFlowRoutes from './routes/callFlow.js';
import widgetFlowRoutes from './routes/widgetFlow.js';
import elevenlabsRoutes from './routes/elevenlabs.js';
import elevenlabsUnifiedRoutes from './routes/elevenlabsUnified.js';
import bookingRoutes from './routes/booking.js';
import authRoutes from './routes/auth.js';
import logsRoutes from './routes/logs.js';
import { errorHandler } from './middleware/errorHandler.js';
import bookioScheduler from './services/bookioScheduler.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3000;

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  }
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP to allow dashboard JavaScript
}));
app.use(cors());
app.use(morgan('combined'));
app.use(limiter);
app.use(express.json());

// Serve static files for dashboard
app.use(express.static(path.join(__dirname, 'views')));

// Health check endpoint - Railway compatible
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'Bookio Webhook API',
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Dashboard route
app.get('/logs', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});

// Root endpoint for Railway
app.get('/', (req, res) => {
  res.status(200).json({
    message: '🚀 Bookio Webhook API with Database Logging',
    status: 'Active',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      dashboard: '/logs',
      logsAPI: '/api/logs',
      booking: '/api/booking/create',
      testEmail: '/api/booking/test-email'
    }
  });
});

// API routes
app.use('/api/refresh-clinic', refreshClinicRoutes);
app.use('/api/slots', slotsRoutes);
app.use('/api/call', callFlowRoutes);
app.use('/api/widget', widgetFlowRoutes);
app.use('/api/elevenlabs', elevenlabsUnifiedRoutes);
app.use('/api/booking', bookingRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/logs', logsRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Error handling middleware
app.use(errorHandler);

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 Bookio Webhook API server running on port ${PORT} - v${Date.now()}`);
  console.log(`📋 Health check: http://0.0.0.0:${PORT}/health`);
  console.log(`🔗 Original Facility: ${process.env.BOOKIO_FACILITY_ID || 'ai-recepcia-zll65ixf'}`);
  console.log(`🏥 REFRESH Clinic: refresh-laserove-a-esteticke-studio-zu0yxr5l`);
  console.log(`✨ REFRESH API: http://0.0.0.0:${PORT}/api/refresh-clinic/services`);
  console.log(`🎯 Slots API: http://0.0.0.0:${PORT}/api/slots/soonest/[serviceId]`);
  console.log(`📞 Call Flow: http://0.0.0.0:${PORT}/api/call/services-overview`);
  console.log(`🎨 Widget Flow: http://0.0.0.0:${PORT}/api/widget/quick-lookup/[search]`);
  console.log(`🤖 ElevenLabs: http://0.0.0.0:${PORT}/api/elevenlabs/[tool_name]`);
  console.log(`📅 Booking API: http://0.0.0.0:${PORT}/api/booking/create`);
  console.log(`🔐 Auth API: http://0.0.0.0:${PORT}/api/auth/status`);
  
  // Auto-start scheduler in production (gracefully handle failures)
  if (process.env.NODE_ENV === 'production' && process.env.BOOKIO_ENV) {
    try {
      console.log(`🔐 Starting auth scheduler for ${process.env.BOOKIO_ENV} environment...`);
      const schedulerStarted = await bookioScheduler.start();
      if (schedulerStarted) {
        console.log(`✅ Auth scheduler started successfully`);
      } else {
        console.log(`⚠️ Auth scheduler could not start (likely browser installation issue)`);
        console.log(`📊 Dashboard and API endpoints are still available`);
      }
    } catch (error) {
      console.error(`⚠️ Failed to start auth scheduler: ${error.message}`);
      console.log(`📊 Server will continue running - Dashboard available at /logs`);
      // Don't crash the server, just log the error
    }
  } else if (process.env.NODE_ENV === 'development') {
    console.log(`⚠️ Development mode - scheduler not auto-started. Use /api/auth/init to initialize manually`);
  }
});

export default app;
