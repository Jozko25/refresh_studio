-- REFRESH Studio Logging Database Schema
-- Creates tables for comprehensive activity logging

-- Main logs table
CREATE TABLE IF NOT EXISTS logs (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    level VARCHAR(20) NOT NULL, -- info, warn, error, critical
    category VARCHAR(50) NOT NULL, -- BOOKING, AUTH, API, SYSTEM, etc.
    message TEXT NOT NULL,
    facility VARCHAR(100), -- bratislava, pezinok, system
    data JSONB, -- Additional structured data
    user_email VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level);
CREATE INDEX IF NOT EXISTS idx_logs_category ON logs(category);
CREATE INDEX IF NOT EXISTS idx_logs_facility ON logs(facility);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_level_timestamp ON logs(level, timestamp DESC);

-- Booking events table (for detailed booking tracking)
CREATE TABLE IF NOT EXISTS booking_events (
    id SERIAL PRIMARY KEY,
    log_id INTEGER REFERENCES logs(id),
    event_type VARCHAR(50) NOT NULL, -- attempt, success, failure
    facility VARCHAR(100) NOT NULL,
    service_id INTEGER,
    service_name VARCHAR(255),
    customer_name VARCHAR(255),
    customer_email VARCHAR(255),
    customer_phone VARCHAR(50),
    booking_date DATE,
    booking_time_from TIME,
    booking_time_to TIME,
    price DECIMAL(10,2),
    worker_name VARCHAR(255),
    booking_id VARCHAR(100), -- Bookio reservation ID
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for booking events
CREATE INDEX IF NOT EXISTS idx_booking_events_facility ON booking_events(facility);
CREATE INDEX IF NOT EXISTS idx_booking_events_date ON booking_events(booking_date DESC);
CREATE INDEX IF NOT EXISTS idx_booking_events_type ON booking_events(event_type);
CREATE INDEX IF NOT EXISTS idx_booking_events_created_at ON booking_events(created_at DESC);

-- Authentication events table
CREATE TABLE IF NOT EXISTS auth_events (
    id SERIAL PRIMARY KEY,
    log_id INTEGER REFERENCES logs(id),
    event_type VARCHAR(50) NOT NULL, -- login, refresh, failure
    facility VARCHAR(100),
    username VARCHAR(255),
    success BOOLEAN NOT NULL DEFAULT false,
    error_message TEXT,
    token_expiry TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for auth events
CREATE INDEX IF NOT EXISTS idx_auth_events_facility ON auth_events(facility);
CREATE INDEX IF NOT EXISTS idx_auth_events_success ON auth_events(success);
CREATE INDEX IF NOT EXISTS idx_auth_events_created_at ON auth_events(created_at DESC);

-- API events table (for search, schedule data, etc.)
CREATE TABLE IF NOT EXISTS api_events (
    id SERIAL PRIMARY KEY,
    log_id INTEGER REFERENCES logs(id),
    event_type VARCHAR(50) NOT NULL, -- search, schedule_data, customers
    facility VARCHAR(100),
    endpoint VARCHAR(255),
    method VARCHAR(10),
    status_code INTEGER,
    duration_ms INTEGER,
    request_data JSONB,
    response_size INTEGER,
    success BOOLEAN NOT NULL DEFAULT false,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for API events
CREATE INDEX IF NOT EXISTS idx_api_events_facility ON api_events(facility);
CREATE INDEX IF NOT EXISTS idx_api_events_endpoint ON api_events(endpoint);
CREATE INDEX IF NOT EXISTS idx_api_events_status ON api_events(status_code);
CREATE INDEX IF NOT EXISTS idx_api_events_created_at ON api_events(created_at DESC);

-- Email notifications table (track what we sent)
CREATE TABLE IF NOT EXISTS email_notifications (
    id SERIAL PRIMARY KEY,
    log_id INTEGER REFERENCES logs(id),
    subject VARCHAR(255) NOT NULL,
    recipient VARCHAR(255) NOT NULL,
    email_type VARCHAR(50) NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    success BOOLEAN NOT NULL DEFAULT false,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for email notifications
CREATE INDEX IF NOT EXISTS idx_email_notifications_type ON email_notifications(email_type);
CREATE INDEX IF NOT EXISTS idx_email_notifications_sent_at ON email_notifications(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_notifications_success ON email_notifications(success);

-- System stats view for dashboard
CREATE OR REPLACE VIEW dashboard_stats AS
SELECT 
    (SELECT COUNT(*) FROM logs WHERE DATE(created_at) = CURRENT_DATE) as today_logs,
    (SELECT COUNT(*) FROM booking_events WHERE DATE(created_at) = CURRENT_DATE) as today_bookings,
    (SELECT COUNT(*) FROM booking_events WHERE event_type = 'success' AND DATE(created_at) = CURRENT_DATE) as today_successful_bookings,
    (SELECT COUNT(*) FROM logs WHERE level = 'error' AND DATE(created_at) = CURRENT_DATE) as today_errors,
    (SELECT COUNT(*) FROM auth_events WHERE success = true AND DATE(created_at) = CURRENT_DATE) as today_auth_success,
    (SELECT COUNT(*) FROM api_events WHERE DATE(created_at) = CURRENT_DATE) as today_api_calls;

-- Recent activities view for dashboard
CREATE OR REPLACE VIEW recent_activities AS
SELECT 
    l.id,
    l.timestamp,
    l.level,
    l.category,
    l.message,
    l.facility,
    l.data,
    CASE 
        WHEN be.id IS NOT NULL THEN 'booking'
        WHEN ae.id IS NOT NULL THEN 'auth'
        WHEN api.id IS NOT NULL THEN 'api'
        ELSE 'system'
    END as activity_type,
    COALESCE(be.customer_name, ae.username, api.endpoint, 'system') as activity_target
FROM logs l
LEFT JOIN booking_events be ON l.id = be.log_id
LEFT JOIN auth_events ae ON l.id = ae.log_id
LEFT JOIN api_events api ON l.id = api.log_id
ORDER BY l.timestamp DESC
LIMIT 100;