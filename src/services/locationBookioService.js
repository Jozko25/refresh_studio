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
            // Get services for this facility
            const response = await axios.get(`${this.baseUrl}/${locationInfo.facility}/api/services_public`, {
                timeout: 15000
            });

            const services = response.data.services || [];
            
            // Search logic similar to BookioDirectService
            const searchWords = searchTerm.toLowerCase().split(' ').filter(word => word.length > 2);
            const scoredServices = [];

            for (const service of services) {
                let score = 0;
                const serviceName = service.name.toLowerCase();
                const categoryName = (service.category?.name || '').toLowerCase();

                // Exact match gets highest score
                if (serviceName.includes(searchTerm.toLowerCase())) {
                    score += 100;
                }

                // Word matching
                for (const word of searchWords) {
                    if (serviceName.includes(word)) score += 50;
                    if (categoryName.includes(word)) score += 25;
                }

                if (score > 0) {
                    scoredServices.push({
                        serviceId: service.id,
                        name: service.name,
                        price: `${service.price} €`,
                        duration: `${service.duration}min`,
                        categoryName: service.category?.name || 'Ostatné',
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
            // Get available slots
            const today = new Date();
            const endDate = new Date(today);
            endDate.setMonth(today.getMonth() + 3); // Look 3 months ahead

            const response = await axios.get(`${this.baseUrl}/${locationInfo.facility}/api/availability_slots`, {
                params: {
                    service_id: serviceId,
                    worker_id: workerId,
                    date_from: this.formatDate(today),
                    date_to: this.formatDate(endDate)
                },
                timeout: 15000
            });

            const slots = response.data.slots || [];
            
            if (slots.length === 0) {
                return { success: true, found: false };
            }

            // Find earliest slot
            const earliestSlot = slots[0];
            const slotDate = new Date(earliestSlot.datetime);
            const daysFromNow = Math.ceil((slotDate - today) / (1000 * 60 * 60 * 24));

            // Get alternative slots for same day
            const sameDay = slots.filter(slot => 
                slot.datetime.startsWith(earliestSlot.datetime.split('T')[0])
            ).slice(1, 4);

            return {
                success: true,
                found: true,
                date: this.formatDate(slotDate),
                time: slotDate.toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' }),
                daysFromNow,
                totalSlots: slots.filter(slot => 
                    slot.datetime.startsWith(earliestSlot.datetime.split('T')[0])
                ).length,
                alternativeSlots: sameDay.map(slot => 
                    new Date(slot.datetime).toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' })
                ),
                location: locationInfo.name
            };

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
     * Get services overview for location
     */
    async getServicesOverview(location = 'bratislava') {
        const locationInfo = this.getLocationInfo(location);
        if (!locationInfo) {
            return { success: false, message: 'Neznáme miesto' };
        }

        try {
            const response = await axios.get(`${this.baseUrl}/${locationInfo.facility}/api/services_public`, {
                timeout: 10000
            });

            const services = response.data.services || [];
            
            // Group by category and get top services
            const categories = {};
            services.forEach(service => {
                const categoryName = service.category?.name || 'Ostatné';
                if (!categories[categoryName]) {
                    categories[categoryName] = [];
                }
                categories[categoryName].push(service);
            });

            const overview = Object.keys(categories).slice(0, 3).map(categoryName => ({
                name: categoryName,
                description: `${categories[categoryName].length} služieb dostupných v ${locationInfo.name}`
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