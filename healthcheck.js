#!/usr/bin/env node

/**
 * Health Check Script for Production Monitoring
 * Run this every 5 minutes via cron job
 */

import axios from 'axios';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';

async function healthCheck() {
    try {
        console.log(`🔍 Checking health of ${SERVER_URL}`);
        
        // Check auth system health
        const authResponse = await axios.get(`${SERVER_URL}/api/auth/health`);
        
        const health = authResponse.data;
        
        if (health.status === 'healthy') {
            console.log('✅ System healthy');
            console.log(`   Auth: ${health.auth.cookieValid ? 'Valid' : 'Invalid'}`);
            console.log(`   Scheduler: ${health.scheduler.running ? 'Running' : 'Stopped'}`);
            process.exit(0);
        } else {
            console.error('❌ System unhealthy:', health);
            
            // Try to restart scheduler
            try {
                await axios.post(`${SERVER_URL}/api/auth/scheduler/start`);
                console.log('🔄 Attempted to restart scheduler');
            } catch (error) {
                console.error('❌ Failed to restart scheduler:', error.message);
            }
            
            process.exit(1);
        }
        
    } catch (error) {
        console.error('❌ Health check failed:', error.message);
        process.exit(1);
    }
}

healthCheck();