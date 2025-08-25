import axios from 'axios';
import BookioDirectService from './bookioDirectService.js';

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
     * Search services for specific location
     */
    async searchServices(searchTerm, location = 'bratislava') {
        const locationInfo = this.getLocationInfo(location);
        if (!locationInfo) {
            return { success: false, message: 'Neznáme miesto' };
        }

        try {
            // Get services for this facility using the correct widget API
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
    async findSoonestSlot(serviceId, location = 'bratislava', workerId = -1) {
        const locationInfo = this.getLocationInfo(location);
        if (!locationInfo) {
            return { success: false, message: 'Neznáme miesto' };
        }

        try {
            // Get available slots using the correct widget API
            const today = new Date();
            
            // Try multiple days starting from today
            for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
                const checkDate = new Date(today);
                checkDate.setDate(today.getDate() + dayOffset);
                
                const formattedDateTime = `${this.formatDate(checkDate)} ${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`;
                
                const response = await axios.post(`${this.baseUrl}/widget/api/allowedTimes?lang=sk`, {
                    serviceId: parseInt(serviceId),
                    workerId: parseInt(workerId) || 18204, // Default worker
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
                
                if (times.length > 0) {
                    // Found available slots for this day
                    const earliestTime = times[0];
                    const slotDate = checkDate;
                    const daysFromNow = dayOffset;
                    
                    // Get alternative times from the same day
                    const alternativeSlots = times.slice(1, 3).map(time => time.name);
                    
                    return {
                        success: true,
                        found: true,
                        date: this.formatDate(slotDate),
                        time: earliestTime.name,
                        daysFromNow,
                        totalSlots: times.length,
                        alternativeSlots,
                        location: locationInfo.name
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