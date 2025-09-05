import axios from 'axios';
import config from '../../config/bookio-config.js';

/**
 * Enhanced Slot Service for Production Facilities
 * Supports multiple locations (Bratislava and Pezinok)
 */
class SlotService {
    constructor() {
        this.baseURL = 'https://services.bookio.com/widget/api';
        this.config = config;
    }

    /**
     * Get headers for specific facility
     */
    getHeaders(facilityKey = null) {
        const facilityConfig = config.getFacilityConfig(facilityKey);
        return {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Origin': 'https://services.bookio.com',
            'Referer': facilityConfig.widgetURL,
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        };
    }

    /**
     * Find the soonest available slot
     */
    async findSoonestSlot(serviceId, workerId = -1, maxDays = 14, facilityKey = null) {
        try {
            const today = new Date();

            for (let dayOffset = 0; dayOffset < maxDays; dayOffset++) {
                const checkDate = new Date(today);
                checkDate.setDate(checkDate.getDate() + dayOffset);
                
                const dateStr = this.formatDateForAPI(checkDate);
                
                const response = await axios.post(`${this.baseURL}/allowedTimes`, {
                    serviceId: parseInt(serviceId),
                    workerId: parseInt(workerId),
                    date: dateStr,
                    count: 1,
                    participantsCount: 0,
                    addons: [],
                    lang: 'sk'
                }, { headers: this.getHeaders(facilityKey) });

                const times = response.data.data?.times?.all || [];
                
                if (times.length > 0) {
                    return {
                        success: true,
                        found: true,
                        serviceId: serviceId,
                        workerId: workerId,
                        facility: facilityKey,
                        date: this.formatDateForDisplay(checkDate),
                        time: times[0].id,
                        daysFromNow: dayOffset,
                        totalSlots: times.length,
                        alternativeSlots: times.slice(1, 3).map(slot => slot.id)
                    };
                }
            }

            return {
                success: true,
                found: false,
                serviceId: serviceId,
                workerId: workerId,
                message: `No slots found in next ${maxDays} days`
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Check if specific slot is available
     */
    async checkSlot(serviceId, workerId, date, time, facilityKey = null) {
        try {
            const dateStr = this.formatDateForAPI(new Date(date));
            
            const response = await axios.post(`${this.baseURL}/allowedTimes`, {
                serviceId: parseInt(serviceId),
                workerId: parseInt(workerId),
                date: dateStr,
                count: 1,
                participantsCount: 0,
                addons: [],
                lang: 'sk'
            }, { headers: this.getHeaders(facilityKey) });

            const times = response.data.data?.times?.all || [];
            const isAvailable = times.some(slot => slot.id === time);

            if (isAvailable) {
                return {
                    success: true,
                    available: true,
                    serviceId: serviceId,
                    workerId: workerId,
                    date: date,
                    time: time
                };
            } else {
                // Get closest available times
                const closestTimes = this.findClosestTimes(times, time);
                
                return {
                    success: true,
                    available: false,
                    serviceId: serviceId,
                    workerId: workerId,
                    date: date,
                    requestedTime: time,
                    totalSlots: times.length,
                    closestTimes: closestTimes.slice(0, 3).map(slot => slot.id)
                };
            }

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get all available slots for a date
     */
    async getAvailableSlots(serviceId, workerId, date, facilityKey = null) {
        try {
            const dateStr = this.formatDateForAPI(new Date(date));
            
            const response = await axios.post(`${this.baseURL}/allowedTimes`, {
                serviceId: parseInt(serviceId),
                workerId: parseInt(workerId),
                date: dateStr,
                count: 1,
                participantsCount: 0,
                addons: [],
                lang: 'sk'
            }, { headers: this.getHeaders(facilityKey) });

            const data = response.data.data;
            const allTimes = data?.times?.all || [];
            const mornings = data?.times?.mornings?.data || [];
            const afternoons = data?.times?.afternoon?.data || [];

            return {
                success: true,
                serviceId: serviceId,
                workerId: workerId,
                date: date,
                totalSlots: allTimes.length,
                morningSlots: mornings.length,
                afternoonSlots: afternoons.length,
                slots: allTimes.map(slot => slot.id),
                morningTimes: mornings.map(slot => slot.id),
                afternoonTimes: afternoons.map(slot => slot.id)
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Find closest available times to desired time
     */
    findClosestTimes(availableTimes, desiredTime) {
        const desiredMinutes = this.timeToMinutes(desiredTime);
        
        return availableTimes
            .map(slot => ({
                ...slot,
                minuteDiff: Math.abs(this.timeToMinutes(slot.id) - desiredMinutes)
            }))
            .sort((a, b) => a.minuteDiff - b.minuteDiff);
    }

    /**
     * Utility functions
     */
    timeToMinutes(timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    }

    formatDateForAPI(date) {
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        return `${day}.${month}.${year} 00:00`;
    }

    formatDateForDisplay(date) {
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        return `${day}.${month}.${year}`;
    }

    /**
     * Get available slots for all facilities
     */
    async getAvailableSlotsAllFacilities(serviceId, workerId, date) {
        const facilities = this.config.getAllFacilities();
        const results = {};
        
        for (const facility of facilities) {
            try {
                const slots = await this.getAvailableSlots(serviceId, workerId, date, facility.key);
                results[facility.key] = {
                    name: facility.name,
                    success: true,
                    ...slots
                };
            } catch (error) {
                results[facility.key] = {
                    name: facility.name,
                    success: false,
                    error: error.message
                };
            }
        }
        
        return results;
    }

    /**
     * Test slot availability for specific facility
     */
    async testFacilitySlots(facilityKey = null) {
        try {
            // For production facilities, hardcode the URLs regardless of current environment
            let facilityConfig;
            
            if (facilityKey === 'bratislava') {
                facilityConfig = {
                    name: 'Bratislava',
                    facility: 'refresh-laserove-a-esteticke-studio',
                    widgetURL: 'https://services.bookio.com/refresh-laserove-a-esteticke-studio/widget?lang=sk'
                };
            } else if (facilityKey === 'pezinok') {
                facilityConfig = {
                    name: 'Pezinok',
                    facility: 'refresh-laserove-a-esteticke-studio-zu0yxr5l',
                    widgetURL: 'https://services.bookio.com/refresh-laserove-a-esteticke-studio-zu0yxr5l/widget?lang=sk'
                };
            } else {
                facilityConfig = this.config.getFacilityConfig(facilityKey);
            }
            
            console.log(`🧪 Testing slot availability for ${facilityConfig.name}...`);
            console.log(`   Widget URL: ${facilityConfig.widgetURL}`);
            
            const today = new Date();
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            
            // Test with generic service/worker IDs
            const testServiceId = 1;
            const testWorkerId = -1; // Any worker
            
            const slots = await this.getAvailableSlotsDirectly(
                testServiceId, 
                testWorkerId, 
                this.formatDateForDisplay(tomorrow),
                facilityConfig
            );
            
            return {
                facility: facilityConfig.name,
                facilityKey: facilityKey,
                widgetURL: facilityConfig.widgetURL,
                testDate: this.formatDateForDisplay(tomorrow),
                ...slots
            };
            
        } catch (error) {
            return {
                facility: facilityKey,
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get all services for a facility
     */
    async getServicesForFacility(facilityKey = null) {
        try {
            // For production facilities, hardcode the URLs regardless of current environment
            let facilityConfig;
            
            if (facilityKey === 'bratislava') {
                facilityConfig = {
                    name: 'Bratislava',
                    facility: 'refresh-laserove-a-esteticke-studio',
                    widgetURL: 'https://services.bookio.com/refresh-laserove-a-esteticke-studio/widget?lang=sk'
                };
            } else if (facilityKey === 'pezinok') {
                facilityConfig = {
                    name: 'Pezinok',
                    facility: 'refresh-laserove-a-esteticke-studio-zu0yxr5l',
                    widgetURL: 'https://services.bookio.com/refresh-laserove-a-esteticke-studio-zu0yxr5l/widget?lang=sk'
                };
            } else {
                facilityConfig = this.config.getFacilityConfig(facilityKey);
            }
            
            console.log(`🏥 Fetching services for ${facilityConfig.name}...`);
            console.log(`   Widget URL: ${facilityConfig.widgetURL}`);
            
            const headers = {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Origin': 'https://services.bookio.com',
                'Referer': facilityConfig.widgetURL,
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            };
            
            const response = await axios.post(`${this.baseURL}/services`, {
                facility: facilityConfig.facility,
                lang: 'sk'
            }, { headers });

            const services = response.data.data || [];
            
            return {
                success: true,
                facility: facilityConfig.name,
                facilityKey: facilityKey,
                widgetURL: facilityConfig.widgetURL,
                totalServices: services.length,
                services: services.map(service => ({
                    serviceId: service.id,
                    name: service.name,
                    description: service.description || '',
                    price: service.price || 'N/A',
                    duration: service.duration || 'N/A',
                    categoryId: service.categoryId,
                    categoryName: service.categoryName || 'Other'
                }))
            };

        } catch (error) {
            return {
                success: false,
                facility: facilityKey,
                error: error.message
            };
        }
    }

    /**
     * Get categories for a facility
     */
    async getCategoriesForFacility(facilityKey = null) {
        try {
            // For production facilities, hardcode the URLs regardless of current environment
            let facilityConfig;
            
            if (facilityKey === 'bratislava') {
                facilityConfig = {
                    name: 'Bratislava',
                    facility: 'refresh-laserove-a-esteticke-studio',
                    widgetURL: 'https://services.bookio.com/refresh-laserove-a-esteticke-studio/widget?lang=sk'
                };
            } else if (facilityKey === 'pezinok') {
                facilityConfig = {
                    name: 'Pezinok',
                    facility: 'refresh-laserove-a-esteticke-studio-zu0yxr5l',
                    widgetURL: 'https://services.bookio.com/refresh-laserove-a-esteticke-studio-zu0yxr5l/widget?lang=sk'
                };
            } else {
                facilityConfig = this.config.getFacilityConfig(facilityKey);
            }
            
            console.log(`📋 Fetching categories for ${facilityConfig.name}...`);
            
            const headers = {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Origin': 'https://services.bookio.com',
                'Referer': facilityConfig.widgetURL,
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            };
            
            const response = await axios.post(`${this.baseURL}/categories`, {
                facility: facilityConfig.facility,
                lang: 'sk'
            }, { headers });

            const categories = response.data.data || [];
            
            return {
                success: true,
                facility: facilityConfig.name,
                facilityKey: facilityKey,
                widgetURL: facilityConfig.widgetURL,
                totalCategories: categories.length,
                categories: categories.map(category => ({
                    categoryId: category.id,
                    name: category.name,
                    description: category.description || '',
                    serviceCount: category.serviceCount || 0
                }))
            };

        } catch (error) {
            return {
                success: false,
                facility: facilityKey,
                error: error.message
            };
        }
    }

    /**
     * Get available slots directly with custom facility config
     */
    async getAvailableSlotsDirectly(serviceId, workerId, date, facilityConfig) {
        try {
            const dateStr = this.formatDateForAPI(new Date(date));
            
            const headers = {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Origin': 'https://services.bookio.com',
                'Referer': facilityConfig.widgetURL,
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            };
            
            const response = await axios.post(`${this.baseURL}/allowedTimes`, {
                serviceId: parseInt(serviceId),
                workerId: parseInt(workerId),
                date: dateStr,
                count: 1,
                participantsCount: 0,
                addons: [],
                lang: 'sk'
            }, { headers });

            const data = response.data.data;
            const allTimes = data?.times?.all || [];
            const mornings = data?.times?.mornings?.data || [];
            const afternoons = data?.times?.afternoon?.data || [];

            return {
                success: true,
                serviceId: serviceId,
                workerId: workerId,
                date: date,
                totalSlots: allTimes.length,
                morningSlots: mornings.length,
                afternoonSlots: afternoons.length,
                slots: allTimes.map(slot => slot.id),
                morningTimes: mornings.map(slot => slot.id),
                afternoonTimes: afternoons.map(slot => slot.id)
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
}

export default new SlotService();