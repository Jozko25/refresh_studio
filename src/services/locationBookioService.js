import axios from 'axios';
import BookioDirectService from './bookioDirectService.js';
import serviceCache from './serviceCache.js';

/**
 * Location-aware Bookio Service
 * Handles both Bratislava and Pezinok locations
 */
class LocationBookioService {
    constructor() {
        this.locations = {
            bratislava: {
                facility: 'refresh-laserove-a-esteticke-studio-zu0yxr5l',
                name: 'Bratislava',
                address: 'Lazaretská 13, Bratislava',
                widget_url: 'https://services.bookio.com/refresh-laserove-a-esteticke-studio-zu0yxr5l/widget?lang=sk'
            },
            pezinok: {
                facility: 'refresh-laserove-a-esteticke-studio',
                name: 'Pezinok',
                address: 'Pezinok',
                widget_url: 'https://services.bookio.com/refresh-laserove-a-esteticke-studio/widget?lang=sk'
            }
        };
        
        this.baseUrl = 'https://services.bookio.com';
    }

    /**
     * Get location info
     */
    getLocationInfo(location) {
        return this.locations[location] || null;
    }

    /**
     * Get all services for location (with caching)
     */
    async getAllServices(location = 'bratislava') {
        const locationInfo = this.getLocationInfo(location);
        if (!locationInfo) {
            return { success: false, message: 'Neznáme miesto' };
        }

        // Check cache first
        const cached = serviceCache.getServices(location);
        if (cached.success) {
            // Start background refresh if stale
            if (cached.stale) {
                this.backgroundRefreshServices(location);
            }
            return {
                success: true,
                services: cached.services,
                fromCache: true,
                age: cached.age
            };
        }

        // Cache miss - fetch from API
        return await this.fetchServicesFromAPI(location);
    }

    /**
     * Fetch services from API (no cache)
     */
    async fetchServicesFromAPI(location) {
        const locationInfo = this.getLocationInfo(location);
        
        try {
            console.log(`🌐 Fetching services from API for ${location}`);
            
            const response = await axios.post(`${this.baseUrl}/widget/api/services?lang=sk`, {
                facility: locationInfo.facility,
                categoryId: null, // Get all services
                lang: 'sk'
            }, {
                timeout: 15000,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const services = response.data.data || [];
            
            // Cache the results
            serviceCache.setServices(location, services);
            
            return {
                success: true,
                services,
                fromCache: false
            };
            
        } catch (error) {
            console.error(`❌ Error fetching services for ${location}:`, error.message);
            return { success: false, message: 'Chyba pri načítaní služieb z API' };
        }
    }

    /**
     * Background refresh for stale cache
     */
    async backgroundRefreshServices(location) {
        serviceCache.backgroundRefresh(location, async (loc) => {
            const result = await this.fetchServicesFromAPI(loc);
            return result.success ? result.services : null;
        });
    }

    /**
     * Search services for specific location
     */
    async searchServices(searchTerm, location = 'bratislava') {
        // Get all services (cached or fresh)
        const servicesResult = await this.getAllServices(location);
        if (!servicesResult.success) {
            return servicesResult;
        }

        const services = servicesResult.services;
        const locationInfo = this.getLocationInfo(location);

        try {
            
            // Search logic with accent-insensitive matching
            const normalizedSearchTerm = this.normalizeText(searchTerm);
            const searchWords = normalizedSearchTerm.split(' ').filter(word => word.length > 2);
            const scoredServices = [];

            for (const service of services) {
                let score = 0;
                const normalizedServiceName = this.normalizeText(service.title);
                
                // Exact match gets highest score
                if (normalizedServiceName.includes(normalizedSearchTerm)) {
                    score += 100;
                }

                // Word matching with normalized text
                for (const word of searchWords) {
                    if (normalizedServiceName.includes(word)) score += 50;
                }

                if (score > 0) {
                    scoredServices.push({
                        serviceId: service.serviceId,
                        name: service.title,
                        price: service.price,
                        duration: service.durationString,
                        categoryName: 'LASEROVÁ EPILÁCIA', // Will be filled properly later
                        location: locationInfo.name,
                        score
                    });
                }
            }

            scoredServices.sort((a, b) => b.score - a.score);

            return {
                success: true,
                found: scoredServices.length,
                services: scoredServices,
                location: locationInfo.name
            };

        } catch (error) {
            console.error(`❌ Error searching services for ${location}:`, error.message);
            return { success: false, message: 'Chyba pri vyhľadávaní služieb' };
        }
    }

    /**
     * Find soonest slot for specific location
     */
    async findSoonestSlot(serviceId, location = 'bratislava', workerId = -1, skipSlots = 0) {
        const locationInfo = this.getLocationInfo(location);
        if (!locationInfo) {
            return { success: false, message: 'Neznáme miesto' };
        }

        try {
            // Get available slots using the correct widget API
            const today = new Date();
            
            // If no specific worker provided, get workers for this service and location
            if (workerId === -1) {
                const workersResponse = await axios.post(`${this.baseUrl}/widget/api/workers?lang=sk`, {
                    serviceId: parseInt(serviceId),
                    facility: locationInfo.facility,
                    lang: 'sk'
                }, {
                    timeout: 10000,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
                const workers = workersResponse.data?.data || [];
                if (workers.length > 0) {
                    // Use first available worker
                    workerId = workers[0].workerId;
                    console.log(`👤 Using worker ${workerId} for ${location} service ${serviceId}`);
                } else {
                    console.log(`⚠️ No workers found for service ${serviceId} in ${location}`);
                    workerId = -1; // Keep default
                }
            }
            
            // Try multiple days starting from today
            for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
                const checkDate = new Date(today);
                checkDate.setDate(today.getDate() + dayOffset);
                
                const formattedDateTime = `${this.formatDate(checkDate)} 00:00`;
                
                const response = await axios.post(`${this.baseUrl}/widget/api/allowedTimes?lang=sk`, {
                    serviceId: parseInt(serviceId),
                    workerId: parseInt(workerId),
                    date: formattedDateTime,
                    lang: 'sk',
                    count: 1,
                    participantsCount: 0,
                    addons: []
                }, {
                    timeout: 15000,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                const times = response.data?.data?.times?.all || [];
                
                console.log(`🕐 Checking ${formattedDateTime} for service ${serviceId} in ${location}: ${times.length} slots`);
                if (times.length > 0) {
                    console.log(`📅 Available times for ${formattedDateTime}: ${times.map(t => t.name).slice(0, 5).join(', ')}${times.length > 5 ? '...' : ''}`);
                }
                
                if (times.length > skipSlots) {
                    // Found available slots for this day, skip the required number
                    const selectedTime = times[skipSlots];
                    const slotDate = checkDate;
                    const daysFromNow = dayOffset;
                    
                    // Get alternative times after the selected one
                    const alternativeSlots = times.slice(skipSlots + 1, skipSlots + 3).map(time => time.name);
                    
                    const slotLabel = skipSlots > 0 ? `${skipSlots + 1}. dostupný termín` : 'Najbližší termín';
                    console.log(`✅ Found ${slotLabel} in ${location}: ${this.formatDate(slotDate)} at ${selectedTime.name}`);
                    
                    return {
                        success: true,
                        found: true,
                        date: this.formatDate(slotDate),
                        time: selectedTime.name,
                        daysFromNow,
                        totalSlots: times.length,
                        alternativeSlots,
                        location: locationInfo.name,
                        skipSlots: skipSlots
                    };
                }
            }
            
            // No slots found in the next 30 days
            return { success: true, found: false };

        } catch (error) {
            console.error(`❌ Error finding slots for ${location}:`, error.message);
            return { success: false, message: 'Chyba pri hľadaní termínov' };
        }
    }

    /**
     * Format date to DD.MM.YYYY
     */
    formatDate(date) {
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        return `${day}.${month}.${year}`;
    }

    /**
     * Normalize text for better matching (remove accents, lowercase, etc.)
     */
    normalizeText(text) {
        return text
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Remove diacritics/accents
            .replace(/[^\w\s]/g, '') // Remove special characters
            .trim();
    }

    /**
     * Get services overview for location
     */
    async getServicesOverview(location = 'bratislava') {
        const locationInfo = this.getLocationInfo(location);
        if (!locationInfo) {
            return { success: false, message: 'Neznáme miesto' };
        }

        try {
            // Get categories first
            const categoriesResponse = await axios.post(`${this.baseUrl}/widget/api/categories?lang=sk`, {
                facility: locationInfo.facility,
                lang: 'sk'
            }, {
                timeout: 10000,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const categories = categoriesResponse.data.data || [];
            
            const overview = categories.slice(0, 3).map(category => ({
                name: category.title,
                description: `Služby dostupné v ${locationInfo.name}`
            }));

            return {
                success: true,
                overview,
                location: locationInfo.name
            };

        } catch (error) {
            console.error(`❌ Error getting overview for ${location}:`, error.message);
            return { success: false, message: 'Chyba pri načítaní služieb' };
        }
    }
}

export default new LocationBookioService();