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
     * Get available workers for a service
     */
    async getWorkersForService(serviceId, location = 'bratislava') {
        const locationInfo = this.getLocationInfo(location);
        if (!locationInfo) {
            return { success: false, message: 'Neznáme miesto' };
        }

        try {
            const response = await axios.post(`${this.baseUrl}/widget/api/workers?lang=sk`, {
                serviceId: parseInt(serviceId),
                facility: locationInfo.facility,
                lang: 'sk'
            }, {
                timeout: 10000,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const workers = response.data?.data || [];
            console.log(`👥 Found ${workers.length} workers for service ${serviceId} in ${location}`);
            
            return {
                success: true,
                workers: workers.map(worker => ({
                    workerId: worker.workerId,
                    name: worker.name,
                    fullName: worker.fullName || worker.name
                }))
            };

        } catch (error) {
            console.error(`❌ Error getting workers for service ${serviceId} in ${location}:`, error.message);
            return { success: false, message: 'Chyba pri načítaní zamestnancov' };
        }
    }

    /**
     * Find worker by name (fuzzy matching)
     */
    findWorkerByName(workers, requestedName) {
        if (!requestedName || !workers.length) return null;

        const normalized = this.normalizeText(requestedName);
        console.log(`🔍 Looking for worker: "${requestedName}" (normalized: "${normalized}")`);
        console.log(`🔍 Available workers: ${workers.map(w => `${w.name} (ID: ${w.workerId})`).join(', ')}`);

        // Try exact match first
        let worker = workers.find(w => 
            this.normalizeText(w.name).includes(normalized) ||
            this.normalizeText(w.fullName || w.name).includes(normalized)
        );

        // Try partial matches if exact fails
        if (!worker) {
            worker = workers.find(w => 
                normalized.includes(this.normalizeText(w.name)) ||
                this.normalizeText(w.name).includes(normalized.split(' ')[0]) // First word only
            );
        }

        // Skip "Nezáleží" (doesn't matter) option unless specifically requested
        if (worker && worker.name.toLowerCase().includes('nezáleží') && !normalized.includes('nezalezi')) {
            console.log(`⏭️ Skipping "Nezáleží" option, looking for actual worker`);
            const otherWorkers = workers.filter(w => !w.name.toLowerCase().includes('nezáleží'));
            if (otherWorkers.length > 0) {
                worker = otherWorkers.find(w => 
                    this.normalizeText(w.name).includes(normalized) ||
                    normalized.includes(this.normalizeText(w.name))
                );
            }
        }

        if (worker) {
            console.log(`✅ Found worker: ${worker.name} (ID: ${worker.workerId})`);
            return worker;
        }

        console.log(`❌ No worker found matching "${requestedName}"`);
        console.log(`❌ Tried matching against: ${workers.map(w => this.normalizeText(w.name)).join(', ')}`);
        return null;
    }

    /**
     * Find soonest slot for specific location
     */
    async findSoonestSlot(serviceId, location = 'bratislava', workerId = -1, skipSlots = 0, requestedWorkerName = null) {
        const locationInfo = this.getLocationInfo(location);
        if (!locationInfo) {
            return { success: false, message: 'Neznáme miesto' };
        }

        try {
            // Get available slots using the correct widget API
            const today = new Date();
            
            // Handle worker selection
            if (workerId === -1) {
                // Get all workers for this service
                const workersResult = await this.getWorkersForService(serviceId, location);
                if (!workersResult.success || workersResult.workers.length === 0) {
                    console.log(`⚠️ No workers found for service ${serviceId} in ${location}`);
                    workerId = -1; // Keep default
                } else {
                    const workers = workersResult.workers;
                    
                    // If specific worker requested, try to find them
                    if (requestedWorkerName) {
                        const requestedWorker = this.findWorkerByName(workers, requestedWorkerName);
                        if (requestedWorker) {
                            workerId = requestedWorker.workerId;
                            console.log(`👤 Using requested worker: ${requestedWorker.name} (ID: ${workerId})`);
                        } else {
                            // Worker not found, return error with available workers
                            const workerNames = workers.map(w => w.name).join(', ');
                            return {
                                success: false,
                                message: `Zamestnanec "${requestedWorkerName}" nie je dostupný pre túto službu. Dostupní zamestnanci: ${workerNames}`,
                                availableWorkers: workers
                            };
                        }
                    } else {
                        // Use first available worker
                        workerId = workers[0].workerId;
                        console.log(`👤 Using first available worker: ${workers[0].name} (ID: ${workerId})`);
                    }
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