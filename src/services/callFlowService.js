import axios from 'axios';

/**
 * Call Flow Service for Complete Client Journey
 * Handles service discovery, availability checking, and appointment flow
 */
class CallFlowService {
    constructor() {
        this.baseURL = 'https://services.bookio.com/widget/api';
        this.facility = 'refresh-laserove-a-esteticke-studio-zu0yxr5l';
        this.headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Origin': 'https://services.bookio.com',
            'Referer': `https://services.bookio.com/${this.facility}/widget?lang=sk`,
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        };
    }

    /**
     * Get initial service categories overview (3 most popular)
     */
    async getServiceOverview() {
        try {
            const categoriesResponse = await axios.post(`${this.baseURL}/categories`, {
                facility: this.facility,
                lang: 'sk'
            }, { headers: this.headers });

            const categories = categoriesResponse.data.data || [];
            
            // Popular categories first
            const popularCategories = [
                'HYDRAFACIAL™',
                'PLEŤOVÉ OŠETRENIA - DO 30 ROKOV', 
                'LASEROVÁ EPILÁCIA'
            ];

            const overview = [];
            for (const categoryName of popularCategories) {
                const category = categories.find(cat => cat.title === categoryName);
                if (category) {
                    overview.push({
                        categoryId: category.categoryId,
                        name: category.title,
                        description: this.getCategoryDescription(category.title)
                    });
                }
            }

            return {
                success: true,
                totalCategories: categories.length,
                overview: overview,
                hasMore: categories.length > 3,
                message: "Ponúkame rôzne služby vrátane:"
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get more service categories (paginated)
     */
    async getMoreCategories(offset = 0, limit = 3) {
        try {
            const categoriesResponse = await axios.post(`${this.baseURL}/categories`, {
                facility: this.facility,
                lang: 'sk'
            }, { headers: this.headers });

            const categories = categoriesResponse.data.data || [];
            const paginatedCategories = categories.slice(offset, offset + limit);

            const categoryList = paginatedCategories.map(category => ({
                categoryId: category.categoryId,
                name: category.title,
                description: this.getCategoryDescription(category.title)
            }));

            return {
                success: true,
                categories: categoryList,
                totalCategories: categories.length,
                showing: `${offset + 1}-${Math.min(offset + limit, categories.length)}`,
                hasMore: (offset + limit) < categories.length,
                nextOffset: offset + limit
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Search for services by name or keywords
     */
    async searchServices(searchTerm) {
        try {
            const categoriesResponse = await axios.post(`${this.baseURL}/categories`, {
                facility: this.facility,
                lang: 'sk'
            }, { headers: this.headers });

            const categories = categoriesResponse.data.data || [];
            const matchedServices = [];

            // Search through all categories
            for (const category of categories) {
                try {
                    const servicesResponse = await axios.post(`${this.baseURL}/services`, {
                        facility: this.facility,
                        categoryId: category.categoryId,
                        lang: 'sk'
                    }, { headers: this.headers });

                    const services = servicesResponse.data.data || [];
                    
                    // Find matching services
                    for (const service of services) {
                        if (this.isServiceMatch(service.title, searchTerm) || 
                            this.isServiceMatch(category.title, searchTerm)) {
                            matchedServices.push({
                                serviceId: service.serviceId,
                                name: service.title,
                                price: service.price,
                                duration: service.durationString,
                                category: category.title,
                                priceNumber: service.priceNumber
                            });
                        }
                    }
                } catch (error) {
                    continue;
                }

                // Limit results to avoid long response
                if (matchedServices.length >= 10) break;
            }

            // Sort by price (most popular services usually mid-range)
            matchedServices.sort((a, b) => (a.priceNumber || 0) - (b.priceNumber || 0));

            return {
                success: true,
                searchTerm: searchTerm,
                found: matchedServices.length,
                services: matchedServices.slice(0, 5), // Top 5 matches
                hasMore: matchedServices.length > 5
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get service details with availability
     */
    async getServiceDetails(serviceId) {
        try {
            // First get workers for this service
            const workersResponse = await axios.post(`${this.baseURL}/workers`, {
                serviceId: parseInt(serviceId),
                lang: 'sk'
            }, { headers: this.headers });

            const workers = workersResponse.data.data || [];
            
            // Get availability for today and next few days
            const availabilityPromises = [];
            const today = new Date();

            for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
                const checkDate = new Date(today);
                checkDate.setDate(checkDate.getDate() + dayOffset);
                availabilityPromises.push(this.getDateAvailability(serviceId, -1, checkDate));
            }

            const availabilityResults = await Promise.all(availabilityPromises);
            const soonestSlot = this.findSoonestFromResults(availabilityResults);

            return {
                success: true,
                serviceId: serviceId,
                workers: workers.map(w => ({ id: w.workerId, name: w.name })),
                availability: {
                    soonest: soonestSlot,
                    next7Days: availabilityResults.filter(r => r.totalSlots > 0)
                }
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get complete booking information for a service
     */
    async getBookingInfo(serviceId, workerId = -1) {
        try {
            // Get service workers
            const workersResponse = await axios.post(`${this.baseURL}/workers`, {
                serviceId: parseInt(serviceId),
                lang: 'sk'
            }, { headers: this.headers });

            const workers = workersResponse.data.data || [];

            // Find soonest available slot
            const soonestSlot = await this.findSoonestSlot(serviceId, workerId);

            // Get today's availability
            const todayAvailability = await this.getDateAvailability(serviceId, workerId, new Date());

            return {
                success: true,
                serviceId: serviceId,
                workerId: workerId,
                workers: workers.map(w => ({
                    id: w.workerId,
                    name: w.name,
                    isSelected: w.workerId == workerId
                })),
                soonest: soonestSlot,
                today: todayAvailability,
                message: soonestSlot.found ? 
                    `Najbližší voľný termín je ${soonestSlot.date} o ${soonestSlot.time}` :
                    "Momentálne nie sú dostupné žiadne voľné termíny"
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Helper methods
     */
    async findSoonestSlot(serviceId, workerId = -1, maxDays = 14) {
        const today = new Date();

        for (let dayOffset = 0; dayOffset < maxDays; dayOffset++) {
            const checkDate = new Date(today);
            checkDate.setDate(checkDate.getDate() + dayOffset);
            
            const dateStr = this.formatDateForAPI(checkDate);
            
            try {
                const response = await axios.post(`${this.baseURL}/allowedTimes`, {
                    serviceId: parseInt(serviceId),
                    workerId: parseInt(workerId),
                    date: dateStr,
                    count: 1,
                    participantsCount: 0,
                    addons: [],
                    lang: 'sk'
                }, { headers: this.headers });

                const times = response.data.data?.times?.all || [];
                
                if (times.length > 0) {
                    return {
                        found: true,
                        serviceId: serviceId,
                        workerId: workerId,
                        date: this.formatDateForDisplay(checkDate),
                        dateFormatted: this.formatDateForSpeech(checkDate),
                        time: times[0].id,
                        daysFromNow: dayOffset,
                        totalSlots: times.length,
                        alternativeSlots: times.slice(1, 3).map(slot => slot.id)
                    };
                }
            } catch (error) {
                continue;
            }
        }

        return {
            found: false,
            serviceId: serviceId,
            workerId: workerId,
            message: `Žiadne voľné termíny v najbližších ${maxDays} dňoch`
        };
    }

    async getDateAvailability(serviceId, workerId, date) {
        try {
            const dateStr = this.formatDateForAPI(date);
            
            const response = await axios.post(`${this.baseURL}/allowedTimes`, {
                serviceId: parseInt(serviceId),
                workerId: parseInt(workerId),
                date: dateStr,
                count: 1,
                participantsCount: 0,
                addons: [],
                lang: 'sk'
            }, { headers: this.headers });

            const data = response.data.data;
            const allTimes = data?.times?.all || [];
            const mornings = data?.times?.mornings?.data || [];
            const afternoons = data?.times?.afternoon?.data || [];

            return {
                date: this.formatDateForDisplay(date),
                dateFormatted: this.formatDateForSpeech(date),
                totalSlots: allTimes.length,
                morningSlots: mornings.length,
                afternoonSlots: afternoons.length,
                firstTime: allTimes[0]?.id,
                lastTime: allTimes[allTimes.length - 1]?.id,
                sampleTimes: allTimes.slice(0, 3).map(slot => slot.id)
            };

        } catch (error) {
            return {
                date: this.formatDateForDisplay(date),
                totalSlots: 0,
                error: error.message
            };
        }
    }

    findSoonestFromResults(results) {
        for (const result of results) {
            if (result.totalSlots > 0) {
                return {
                    found: true,
                    date: result.date,
                    dateFormatted: result.dateFormatted,
                    time: result.firstTime,
                    totalSlots: result.totalSlots
                };
            }
        }
        return { found: false };
    }

    isServiceMatch(serviceName, searchTerm) {
        const service = serviceName.toLowerCase();
        const search = searchTerm.toLowerCase();
        
        // Direct match or contains
        return service.includes(search) || search.includes(service) ||
               this.fuzzyMatch(service, search);
    }

    fuzzyMatch(text, search) {
        // Simple fuzzy matching for common terms
        const commonMatches = {
            'hydrafacial': ['hydra', 'facial', 'pleť'],
            'laser': ['epilácia', 'odstránenie'],
            'piercing': ['piercing'],
            'tetovanie': ['tetovanie', 'obočie', 'permanent'],
            'peeling': ['peeling', 'chemický'],
            'esthederm': ['esthederm', 'institut']
        };

        for (const [key, terms] of Object.entries(commonMatches)) {
            if (text.includes(key) && terms.some(term => search.includes(term))) {
                return true;
            }
        }
        return false;
    }

    getCategoryDescription(categoryName) {
        const descriptions = {
            'HYDRAFACIAL™': 'Pokročilé ošetrenie pleti s okamžitými výsledkami',
            'PLEŤOVÉ OŠETRENIA - DO 30 ROKOV': 'Ošetrenia pleti pre mladších klientov',
            'LASEROVÁ EPILÁCIA': 'Trvalé odstránenie chĺpkov laserom',
            'CHEMICKÝ PEELING': 'Obnova pokožky chemickým peelingom',
            'INSTITUT ESTHEDERM': 'Luxusné francúzske ošetrenia',
            'PIERCING': 'Profesionálny piercing a starostlivosť',
            'TETOVANIE OBOČIA': 'Permanentný makeup obočia',
            'KONZULTÁCIE': 'Odborné konzultácie'
        };
        
        return descriptions[categoryName] || 'Profesionálne služby';
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

    formatDateForSpeech(date) {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        if (date.toDateString() === today.toDateString()) {
            return 'dnes';
        } else if (date.toDateString() === tomorrow.toDateString()) {
            return 'zajtra';
        } else {
            const options = { weekday: 'long', day: 'numeric', month: 'long' };
            return date.toLocaleDateString('sk-SK', options);
        }
    }
}

export default new CallFlowService();