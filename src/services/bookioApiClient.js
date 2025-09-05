import axios from 'axios';
import bookioAuthService from './bookioAuthService.js';
import config from '../../config/bookio-config.js';

/**
 * Bookio API Client
 * Makes authenticated requests to Bookio admin API
 */
class BookioApiClient {
    constructor() {
        this.config = config;
        this.baseURL = config.apiBaseURL;
        
        // Create axios instance
        this.client = axios.create({
            baseURL: this.baseURL,
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            }
        });
        
        // Request/Response interceptors
        this.setupInterceptors();
        
        // Request statistics
        this.stats = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            authRefreshes: 0
        };
    }

    /**
     * Setup axios interceptors
     */
    setupInterceptors() {
        // Request interceptor - add auth cookie
        this.client.interceptors.request.use(
            async (config) => {
                try {
                    // Get fresh cookie
                    const cookieHeader = await bookioAuthService.getCookieHeader();
                    config.headers['Cookie'] = cookieHeader;
                    
                    // Add referer for admin endpoints
                    if (config.url.includes('/client-admin/')) {
                        config.headers['Referer'] = this.config.baseURL;
                        config.headers['Origin'] = this.config.baseURL;
                    }
                    
                    console.log(`🔒 Request to: ${config.method.toUpperCase()} ${config.url}`);
                    this.stats.totalRequests++;
                    
                } catch (error) {
                    console.error('❌ Failed to add auth cookie:', error.message);
                    throw error;
                }
                
                return config;
            },
            (error) => {
                return Promise.reject(error);
            }
        );
        
        // Response interceptor - handle auth errors
        this.client.interceptors.response.use(
            (response) => {
                this.stats.successfulRequests++;
                console.log(`✅ Response: ${response.status} from ${response.config.url}`);
                return response;
            },
            async (error) => {
                const originalRequest = error.config;
                
                // Handle 401/403 - authentication required
                if (error.response && [401, 403].includes(error.response.status) && !originalRequest._retry) {
                    console.log('🔄 Auth error detected, refreshing cookie...');
                    originalRequest._retry = true;
                    this.stats.authRefreshes++;
                    
                    try {
                        // Refresh authentication
                        await bookioAuthService.forceRefresh();
                        
                        // Retry original request with new cookie
                        const cookieHeader = await bookioAuthService.getCookieHeader();
                        originalRequest.headers['Cookie'] = cookieHeader;
                        
                        return this.client(originalRequest);
                        
                    } catch (refreshError) {
                        console.error('❌ Failed to refresh authentication:', refreshError.message);
                        throw refreshError;
                    }
                }
                
                // Handle other errors
                this.stats.failedRequests++;
                console.error(`❌ Request failed: ${error.response?.status || 'Network Error'} - ${error.message}`);
                
                return Promise.reject(error);
            }
        );
    }

    /**
     * Create a booking in Bookio admin
     */
    async createBooking(bookingData) {
        try {
            console.log('📅 Creating booking via admin API');
            
            const endpoint = this.config.endpoints.adminBooking;
            
            // Prepare booking payload
            const payload = this.prepareBookingPayload(bookingData);
            
            // Make authenticated request
            const response = await this.client.post(endpoint, payload);
            
            // Handle response - Bookio format analysis
            console.log('📋 Booking API Response:', JSON.stringify(response.data, null, 2));
            
            if (response.data && response.data.data && response.data.data.success === true) {
                console.log('✅ Booking created successfully');
                return {
                    success: true,
                    bookingId: response.data.data.eventId || response.data.data.id || 'unknown',
                    data: response.data.data,
                    errors: response.data.data.errors || {}
                };
            } else if (response.data && response.data.data && response.data.data.success === false) {
                console.error('❌ Booking creation failed:', response.data.data);
                return {
                    success: false,
                    error: response.data.data?.message || 'Booking validation failed',
                    data: response.data.data,
                    errors: response.data.data.errors || {}
                };
            } else {
                // Unexpected response format
                console.warn('⚠️ Unexpected response format:', response.data);
                return {
                    success: false,
                    error: 'Unexpected response format',
                    data: response.data
                };
            }
            
        } catch (error) {
            console.error('❌ Booking request failed:', error.message);
            
            // Extract error details
            const errorResponse = error.response?.data;
            
            return {
                success: false,
                error: error.message,
                statusCode: error.response?.status,
                details: errorResponse
            };
        }
    }

    /**
     * Prepare booking payload for admin API (based on actual Bookio format)
     */
    prepareBookingPayload(bookingData) {
        // Map input data to Bookio admin API format (exact structure from curl)
        return {
            event: {
                type: 0, // Standard appointment type
                service: {
                    value: parseInt(bookingData.serviceId)
                },
                count: 0, // Default count
                dateFrom: bookingData.date, // Format: "DD.MM.YYYY"
                dateTo: bookingData.date,   // Same date for single appointment
                timeFrom: bookingData.timeFrom || bookingData.time, // Format: "HH:mm"
                timeTo: bookingData.timeTo || this.calculateEndTime(bookingData.time, bookingData.duration || 40),
                repeat: {
                    repeatReservation: false,
                    repeatDays: [false, false, false, false, false, false, false], // No repeat
                    selectedInterval: {
                        label: "Weekly",
                        value: 1
                    },
                    selectedRepeatDateTo: null
                },
                duration: parseInt(bookingData.duration || 40), // Default 40 minutes
                timeBefore: parseInt(bookingData.timeBefore || 10), // Buffer before
                timeAfter: parseInt(bookingData.timeAfter || 10),   // Buffer after
                name: `${bookingData.firstName || ''} ${bookingData.lastName || ''}`.trim(),
                phone: bookingData.phone || '',
                selectedCountry: bookingData.country || 'sk',
                email: bookingData.email || '',
                price: parseFloat(bookingData.price || 0),
                resObjects: bookingData.resObjects || [
                    {
                        id: `u_${bookingData.workerId || 31576}`,
                        value: parseInt(bookingData.workerId || 31576),
                        label: bookingData.workerName || "AI Recepcia",
                        title: bookingData.workerName || "AI Recepcia", 
                        color: bookingData.workerColor || "#26a69a",
                        capacity: 1
                    }
                ],
                autoConfirmCustomer: bookingData.autoConfirm || null,
                width: 1920,
                height: 1080,
                allowedMarketing: bookingData.allowMarketing || false
            },
            facility: this.config.facility
        };
    }

    /**
     * Calculate end time based on start time and duration
     */
    calculateEndTime(startTime, durationMinutes) {
        const [hours, minutes] = startTime.split(':').map(Number);
        const startMinutes = hours * 60 + minutes;
        const endMinutes = startMinutes + durationMinutes;
        
        const endHours = Math.floor(endMinutes / 60);
        const endMins = endMinutes % 60;
        
        return `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;
    }

    /**
     * Get booking details
     */
    async getBooking(bookingId) {
        try {
            const response = await this.client.get(`/client-admin/api/bookings/${bookingId}`);
            
            return {
                success: true,
                booking: response.data
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message,
                statusCode: error.response?.status
            };
        }
    }

    /**
     * Cancel a booking
     */
    async cancelBooking(bookingId, reason = '') {
        try {
            const response = await this.client.post(`/client-admin/api/bookings/${bookingId}/cancel`, {
                reason: reason
            });
            
            return {
                success: true,
                message: 'Booking cancelled successfully',
                data: response.data
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message,
                statusCode: error.response?.status
            };
        }
    }

    /**
     * Update a booking
     */
    async updateBooking(bookingId, updateData) {
        try {
            const response = await this.client.put(`/client-admin/api/bookings/${bookingId}`, updateData);
            
            return {
                success: true,
                message: 'Booking updated successfully',
                data: response.data
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message,
                statusCode: error.response?.status
            };
        }
    }

    /**
     * Get available slots for a service
     */
    async getAvailableSlots(serviceId, date) {
        try {
            const response = await this.client.post('/client-admin/api/schedule/available-slots', {
                facility: this.config.facility,
                serviceId: serviceId,
                date: date // Format: "DD.MM.YYYY"
            });
            
            return {
                success: true,
                slots: response.data.slots || [],
                date: date
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message,
                statusCode: error.response?.status
            };
        }
    }

    /**
     * Get customer bookings
     */
    async getCustomerBookings(email) {
        try {
            const response = await this.client.get('/client-admin/api/customers/bookings', {
                params: {
                    email: email,
                    facility: this.config.facility
                }
            });
            
            return {
                success: true,
                bookings: response.data.bookings || [],
                customer: response.data.customer
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message,
                statusCode: error.response?.status
            };
        }
    }

    /**
     * Make a generic authenticated request
     */
    async makeRequest(method, endpoint, data = null, config = {}) {
        try {
            const response = await this.client({
                method: method,
                url: endpoint,
                data: data,
                ...config
            });
            
            return {
                success: true,
                data: response.data,
                status: response.status
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message,
                statusCode: error.response?.status,
                details: error.response?.data
            };
        }
    }

    /**
     * Get API client statistics
     */
    getStatistics() {
        const successRate = this.stats.totalRequests > 0
            ? (this.stats.successfulRequests / this.stats.totalRequests * 100).toFixed(2)
            : 0;
        
        return {
            ...this.stats,
            successRate: `${successRate}%`,
            environment: this.config.name
        };
    }

    /**
     * Test authentication
     */
    async testAuthentication() {
        try {
            console.log('🔍 Testing authentication...');
            
            // Try multiple endpoints to test authentication
            const testEndpoints = [
                { name: 'User Profile', endpoint: '/client-admin/api/user/profile' },
                { name: 'Schedule Data', endpoint: '/client-admin/api/schedule/data' },
                { name: 'Reservations Count', endpoint: '/client-admin/api/facility/reservations-count' }
            ];
            
            for (const test of testEndpoints) {
                try {
                    const response = await this.client.get(test.endpoint);
                    
                    if (response.status === 200) {
                        console.log(`✅ ${test.name} test successful`);
                        return {
                            success: true,
                            authenticated: true,
                            endpoint: test.name,
                            data: response.data
                        };
                    }
                } catch (error) {
                    console.log(`⚠️ ${test.name} failed: ${error.response?.status || error.message}`);
                    continue;
                }
            }
            
            return {
                success: false,
                authenticated: false,
                error: 'All test endpoints failed'
            };
            
        } catch (error) {
            console.error('❌ Authentication test error:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

export default new BookioApiClient();