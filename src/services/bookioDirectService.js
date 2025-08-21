import axios from 'axios';

/**
 * Direct Bookio API Service
 * Uses the actual Bookio widget API endpoints for accurate service data
 */
class BookioDirectService {
    constructor() {
        this.baseURL = 'https://services.bookio.com/widget/api';
        this.facility = 'refresh-laserove-a-esteticke-studio-zu0yxr5l';
        this.headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
        
        // Cache for service data
        this.serviceCache = null;
        this.cacheExpiry = null;
        this.cacheTimeout = 10 * 60 * 1000; // 10 minutes
    }

    /**
     * Get all categories from Bookio API
     */
    async getCategories() {
        try {
            const response = await axios.post(`${this.baseURL}/categories`, {
                facility: this.facility,
                lang: 'sk'
            }, { headers: this.headers });

            return response.data.data || [];
        } catch (error) {
            console.error('Error fetching categories:', error);
            throw error;
        }
    }

    /**
     * Get services for a specific category
     */
    async getServicesForCategory(categoryId) {
        try {
            const response = await axios.post(`${this.baseURL}/services`, {
                facility: this.facility,
                categoryId: categoryId,
                lang: 'sk'
            }, { headers: this.headers });

            return response.data.data || [];
        } catch (error) {
            console.error(`Error fetching services for category ${categoryId}:`, error);
            return [];
        }
    }

    /**
     * Build complete service index with all services from all categories
     */
    async buildServiceIndex() {
        try {
            console.log('🏗️ Building complete service index from Bookio API...');
            
            // Get all categories
            const categories = await this.getCategories();
            console.log(`📋 Found ${categories.length} categories`);

            const allServices = [];

            // Get services from each category
            for (const category of categories) {
                try {
                    const services = await this.getServicesForCategory(category.categoryId);
                    
                    // Add category context to each service
                    services.forEach(service => {
                        allServices.push({
                            serviceId: service.serviceId,
                            title: service.title,
                            price: service.price,
                            priceNumber: service.priceNumber,
                            duration: service.duration,
                            durationString: service.durationString,
                            description: service.description,
                            categoryId: category.categoryId,
                            categoryName: category.title,
                            categoryDescription: category.selectServiceTitle,
                            type: service.type,
                            priority: service.priority || 999
                        });
                    });

                    console.log(`📦 Category "${category.title}": ${services.length} services`);
                } catch (error) {
                    console.warn(`⚠️ Skipping category ${category.categoryId}: ${error.message}`);
                    continue;
                }
            }

            console.log(`✅ Built complete service index: ${allServices.length} total services`);
            
            // Cache the results
            this.serviceCache = allServices;
            this.cacheExpiry = Date.now() + this.cacheTimeout;
            
            return allServices;
        } catch (error) {
            console.error('Error building service index:', error);
            throw error;
        }
    }

    /**
     * Get cached service index or build if expired
     */
    async getServiceIndex() {
        if (!this.serviceCache || !this.cacheExpiry || Date.now() > this.cacheExpiry) {
            return await this.buildServiceIndex();
        }
        return this.serviceCache;
    }

    /**
     * Search services with exact matching
     */
    async searchServices(searchTerm) {
        try {
            const services = await this.getServiceIndex();
            const search = searchTerm.toLowerCase().trim();
            
            if (!search) {
                return {
                    success: false,
                    message: 'Zadajte názov služby pre vyhľadanie'
                };
            }

            // Search strategies (in order of priority)
            let results = [];

            // 1. Exact title match
            const exactMatch = services.filter(service => 
                service.title.toLowerCase() === search
            );
            
            // 2. Title contains search term
            const titleContains = services.filter(service => 
                service.title.toLowerCase().includes(search)
            );

            // 3. Search words in title (split search term)
            const searchWords = search.split(' ').filter(word => word.length > 2);
            const wordMatches = services.filter(service => {
                const title = service.title.toLowerCase();
                return searchWords.some(word => title.includes(word));
            });

            // 4. Category context search
            const categoryMatches = services.filter(service => 
                service.categoryName.toLowerCase().includes(search)
            );

            // Combine and prioritize results
            results = [
                ...exactMatch,
                ...titleContains.filter(s => !exactMatch.find(e => e.serviceId === s.serviceId)),
                ...wordMatches.filter(s => 
                    !exactMatch.find(e => e.serviceId === s.serviceId) &&
                    !titleContains.find(t => t.serviceId === s.serviceId)
                ),
                ...categoryMatches.filter(s => 
                    !exactMatch.find(e => e.serviceId === s.serviceId) &&
                    !titleContains.find(t => t.serviceId === s.serviceId) &&
                    !wordMatches.find(w => w.serviceId === s.serviceId)
                )
            ];

            // Remove duplicates by service name and price
            const uniqueResults = [];
            const seen = new Set();
            
            for (const service of results) {
                const key = `${service.title}-${service.priceNumber}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    uniqueResults.push(service);
                }
            }
            
            results = uniqueResults;

            // Sort by priority and price
            results.sort((a, b) => {
                // First by priority (lower number = higher priority)
                if (a.priority !== b.priority) {
                    return (a.priority || 999) - (b.priority || 999);
                }
                // Then by price
                return (a.priceNumber || 0) - (b.priceNumber || 0);
            });

            // Limit results to top 10
            results = results.slice(0, 10);

            return {
                success: true,
                found: results.length,
                searchTerm: searchTerm,
                services: results.map(service => ({
                    serviceId: service.serviceId,
                    name: service.title,
                    price: service.price,
                    duration: service.durationString,
                    category: service.categoryName,
                    description: service.description,
                    priceNumber: service.priceNumber
                }))
            };

        } catch (error) {
            console.error('Service search error:', error);
            return {
                success: false,
                error: error.message,
                searchTerm: searchTerm
            };
        }
    }

    /**
     * Get workers for a specific service
     */
    async getWorkers(serviceId) {
        try {
            const response = await axios.post(`${this.baseURL}/workers`, {
                serviceId: parseInt(serviceId),
                lang: 'sk'
            }, { headers: this.headers });

            return response.data.data || [];
        } catch (error) {
            console.error(`Error fetching workers for service ${serviceId}:`, error);
            return [];
        }
    }

    /**
     * Get allowed times for service on specific date
     */
    async getAllowedTimes(serviceId, workerId, date) {
        try {
            const response = await axios.post(`${this.baseURL}/allowedTimes`, {
                serviceId: parseInt(serviceId),
                workerId: parseInt(workerId),
                date: date,
                addons: [],
                count: 1,
                participantsCount: 0,
                lang: 'sk'
            }, { headers: this.headers });

            return response.data.data || {};
        } catch (error) {
            console.error(`Error fetching allowed times:`, error);
            return {};
        }
    }

    /**
     * Get allowed days for service
     */
    async getAllowedDays(serviceId, workerId) {
        try {
            const currentDate = new Date().toLocaleDateString('sk-SK', {
                day: '2-digit',
                month: '2-digit', 
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }).replace(',', '');

            const response = await axios.post(`${this.baseURL}/allowedDays`, {
                serviceId: parseInt(serviceId),
                workerId: parseInt(workerId),
                date: currentDate,
                addons: [],
                count: 1,
                participantsCount: 0,
                lang: 'sk'
            }, { headers: this.headers });

            return response.data.data || {};
        } catch (error) {
            console.error(`Error fetching allowed days:`, error);
            return {};
        }
    }

    /**
     * Find soonest available slot for a service
     */
    async findSoonestSlot(serviceId, workerId = -1) {
        try {
            // Get workers if not specified
            if (workerId === -1) {
                const workers = await this.getWorkers(serviceId);
                if (workers.length === 0) {
                    return {
                        success: false,
                        message: 'Služba momentálne nie je dostupná'
                    };
                }
                // Use first available worker (excluding "Nezáleží" if others exist)
                const realWorkers = workers.filter(w => w.workerId !== -1);
                workerId = realWorkers.length > 0 ? realWorkers[0].workerId : workers[0].workerId;
            }

            // Get allowed days
            const allowedDays = await this.getAllowedDays(serviceId, workerId);
            
            if (!allowedDays.allowedDays || allowedDays.allowedDays.length === 0) {
                return {
                    success: false,
                    message: 'Pre túto službu momentálne nie sú dostupné termíny'
                };
            }

            // Check first available day
            const firstDay = allowedDays.allowedDays[0];
            const date = `${firstDay}.${allowedDays.month.toString().padStart(2, '0')}.${allowedDays.year} 00:00`;
            
            const times = await this.getAllowedTimes(serviceId, workerId, date);
            
            if (times.times && times.times.all && times.times.all.length > 0) {
                const firstTime = times.times.all[0];
                return {
                    success: true,
                    date: `${firstDay}.${allowedDays.month.toString().padStart(2, '0')}.${allowedDays.year}`,
                    time: firstTime.name,
                    workerId: workerId,
                    totalSlots: times.times.all.length,
                    allTimes: times.times.all.slice(0, 5).map(t => t.name),
                    message: `Najrýchlejší dostupný termín je ${firstDay}.${allowedDays.month}.${allowedDays.year} o ${firstTime.name}`
                };
            }

            return {
                success: false,
                message: 'Momentálne nie sú dostupné žiadne voľné termíny'
            };

        } catch (error) {
            console.error('Error finding soonest slot:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

export default new BookioDirectService();