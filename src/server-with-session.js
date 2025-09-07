import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import routes
import elevenlabsUnifiedRoutes from './routes/elevenlabsUnified.js';
import sessionRoutes from './routes/session.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Basic middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: 'with-session'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'REFRESH Studio API',
    status: 'running',
    session: 'enabled'
  });
});

// Mount routes
app.use('/api/elevenlabs', elevenlabsUnifiedRoutes);
app.use('/api/session', sessionRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found'
  });
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📋 Health: http://0.0.0.0:${PORT}/health`);
  console.log(`🤖 ElevenLabs: http://0.0.0.0:${PORT}/api/elevenlabs`);
  console.log(`🔐 Session: http://0.0.0.0:${PORT}/api/session/status`);
  console.log(`✅ Session management enabled`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  server.close(() => {
    process.exit(0);
  });
});

export default app;