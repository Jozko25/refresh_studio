import axios from 'axios';

/**
 * Optimized Bookio Service for ElevenLabs Integration
 * Provides fast, cached responses to avoid timeouts
 */
class BookioFastService {
    constructor() {
        this.baseURL = 'https://services.bookio.com/widget/api';
        this.facility = 'refresh-laserove-a-esteticke-studio-zu0yxr5l';
        this.headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
            'Referer': `https://services.bookio.com/${this.facility}/widget?lang=sk`
        };
        
        // Cache with longer TTL for ElevenLabs
        this.cache = {
            categories: null,
            services: {},
            lastUpdate: null
        };
        this.cacheTTL = 3600000; // 1 hour cache
        
        // Initialize cache on startup
        this.initializeCache();
    }

    /**
     * Initialize cache with categories and popular services
     */
    async initializeCache() {
        try {
            console.log('🚀 Initializing BookioFastService cache...');
            await this.getAllCategories();
            // Pre-load popular categories
            const popularCategories = [14149, 14142, 23984, 29976]; // HYDRAFACIAL, LASER, etc.
            for (const categoryId of popularCategories) {
                await this.getServicesByCategory(categoryId);
            }
            console.log('✅ Cache initialized successfully');
        } catch (error) {
            console.error('❌ Cache initialization failed:', error.message);
        }
    }

    /**
     * Get all categories with caching
     */
    async getAllCategories() {
        // Check cache
        if (this.cache.categories && this.cache.lastUpdate && 
            (Date.now() - this.cache.lastUpdate < this.cacheTTL)) {
            return this.cache.categories;
        }

        try {
            const response = await axios.post(`${this.baseURL}/categories`, {
                facility: this.facility,
                lang: 'sk'
            }, { 
                headers: this.headers,
                timeout: 5000
            });

            this.cache.categories = response.data.data || [];
            this.cache.lastUpdate = Date.now();
            return this.cache.categories;
        } catch (error) {
            console.error('Error fetching categories:', error.message);
            // Return cached data if available
            return this.cache.categories || [];
        }
    }

    /**
     * Get services for a specific category with caching
     */
    async getServicesByCategory(categoryId) {
        // Check cache
        const cacheKey = `cat_${categoryId}`;
        if (this.cache.services[cacheKey] && 
            this.cache.services[cacheKey].timestamp &&
            (Date.now() - this.cache.services[cacheKey].timestamp < this.cacheTTL)) {
            return this.cache.services[cacheKey].data;
        }

        try {
            const response = await axios.post(`${this.baseURL}/services`, {
                facility: this.facility,
                categoryId: categoryId,
                lang: 'sk'
            }, { 
                headers: this.headers,
                timeout: 5000
            });

            const services = response.data.data || [];
            this.cache.services[cacheKey] = {
                data: services,
                timestamp: Date.now()
            };
            return services;
        } catch (error) {
            console.error(`Error fetching services for category ${categoryId}:`, error.message);
            // Return cached data if available
            return this.cache.services[cacheKey]?.data || [];
        }
    }

    /**
     * Quick search for services - uses cached data for speed
     */
    async quickSearch(searchTerm) {
        const normalizedSearch = searchTerm.toLowerCase();
        const categories = await this.getAllCategories();
        const results = [];

        // Search in category names first
        for (const category of categories) {
            if (category.title.toLowerCase().includes(normalizedSearch)) {
                // Load services for matching category
                const services = await this.getServicesByCategory(category.categoryId);
                results.push({
                    category: category.title,
                    categoryId: category.categoryId,
                    services: services.slice(0, 5) // Limit to first 5 services
                });
            }
        }

        // If no category match, search in popular service names
        if (results.length === 0) {
            // Check popular categories
            const popularCategories = [
                { id: 14149, name: 'HYDRAFACIAL™' },
                { id: 14142, name: 'LASEROVÁ EPILÁCIA' },
                { id: 23984, name: 'PLEŤOVÉ OŠETRENIA' },
                { id: 29976, name: 'OŠETRENIE AKNÉ' }
            ];

            for (const cat of popularCategories) {
                const services = await this.getServicesByCategory(cat.id);
                const matchingServices = services.filter(s => 
                    s.title.toLowerCase().includes(normalizedSearch)
                );
                
                if (matchingServices.length > 0) {
                    results.push({
                        category: cat.name,
                        categoryId: cat.id,
                        services: matchingServices.slice(0, 5)
                    });
                }
            }
        }

        return {
            success: true,
            searchTerm: searchTerm,
            found: results.length,
            results: results
        };
    }

    /**
     * Get service overview - returns cached category list
     */
    async getServiceOverview() {
        const categories = await this.getAllCategories();
        
        return {
            success: true,
            overview: categories.map(cat => ({
                id: cat.categoryId,
                name: cat.title,
                description: cat.selectServiceTitle || ''
            }))
        };
    }

    /**
     * Format service for response
     */
    formatService(service, categoryName = '') {
        return {
            serviceId: service.serviceId,
            name: service.title,
            category: categoryName,
            price: service.price || `${service.priceNumber || 0} €`,
            duration: service.durationString || `${service.duration || 0} min`,
            description: service.description || ''
        };
    }

    /**
     * Get available slots for a service (simplified)
     */
    async getAvailableSlots(serviceId, date) {
        try {
            // For now, return mock data to avoid timeout
            // In production, this should call the actual availability API
            return {
                success: true,
                serviceId: serviceId,
                date: date,
                slots: [
                    { time: '09:00', available: true },
                    { time: '10:00', available: true },
                    { time: '11:00', available: true },
                    { time: '14:00', available: true },
                    { time: '15:00', available: true },
                    { time: '16:00', available: true }
                ]
            };
        } catch (error) {
            console.error('Error getting slots:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// Create singleton instance
const bookioFastService = new BookioFastService();

export default bookioFastService;