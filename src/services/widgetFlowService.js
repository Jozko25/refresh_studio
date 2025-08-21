import axios from 'axios';

/**
 * Widget Flow Service - Mimics actual widget user interaction
 * Goes through the complete widget flow: category -> service -> worker -> availability
 */
class WidgetFlowService {
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
     * Complete widget flow: find service in category and get booking details
     */
    async getCompleteServiceFlow(categoryName, serviceName, date = null) {
        try {
            console.log(`🎯 Starting widget flow for: ${categoryName} -> ${serviceName}`);

            // Step 1: Get all categories
            const categoriesResponse = await axios.post(`${this.baseURL}/categories`, {
                facility: this.facility,
                lang: 'sk'
            }, { headers: this.headers });

            const categories = categoriesResponse.data.data || [];
            const targetCategory = categories.find(cat => 
                cat.title.includes(categoryName) || categoryName.includes(cat.title)
            );

            if (!targetCategory) {
                return {
                    success: false,
                    error: `Category "${categoryName}" not found`
                };
            }

            console.log(`✅ Found category: ${targetCategory.title} (ID: ${targetCategory.categoryId})`);

            // Step 2: Get services in category
            const servicesResponse = await axios.post(`${this.baseURL}/services`, {
                facility: this.facility,
                categoryId: targetCategory.categoryId,
                lang: 'sk'
            }, { headers: this.headers });

            const services = servicesResponse.data.data || [];
            const targetService = services.find(service => 
                service.title.includes(serviceName) || serviceName.includes(service.title)
            );

            if (!targetService) {
                return {
                    success: false,
                    error: `Service "${serviceName}" not found in category "${categoryName}"`,
                    availableServices: services.map(s => s.title)
                };
            }

            console.log(`✅ Found service: ${targetService.title} (ID: ${targetService.serviceId})`);

            // Step 3: Get workers for this service
            const workersResponse = await axios.post(`${this.baseURL}/workers`, {
                serviceId: targetService.serviceId,
                lang: 'sk'
            }, { headers: this.headers });

            const workers = workersResponse.data.data || [];
            console.log(`✅ Found ${workers.length} workers: ${workers.map(w => w.name).join(', ')}`);

            // Step 4: Get availability for each worker
            const checkDate = date || new Date();
            checkDate.setDate(checkDate.getDate() + 14); // Default to 2 weeks ahead
            const dateStr = this.formatDateForAPI(checkDate);

            const workerAvailability = [];
            
            for (const worker of workers) {
                if (worker.workerId === -1) continue; // Skip "Nezáleží" for individual worker results
                
                console.log(`⏰ Checking availability for: ${worker.name}`);

                try {
                    const availabilityResponse = await axios.post(`${this.baseURL}/allowedTimes`, {
                        serviceId: targetService.serviceId,
                        workerId: worker.workerId,
                        date: dateStr,
                        count: 1,
                        participantsCount: 0,
                        addons: [],
                        lang: 'sk'
                    }, { headers: this.headers });

                    const times = availabilityResponse.data.data?.times;
                    
                    workerAvailability.push({
                        workerId: worker.workerId,
                        workerName: worker.name,
                        date: this.formatDateForDisplay(checkDate),
                        morningSlots: times?.mornings?.data || [],
                        afternoonSlots: times?.afternoon?.data || [],
                        allTimes: times?.all || [],
                        totalSlots: times?.all?.length || 0,
                        firstAvailable: times?.all?.[0]?.id,
                        lastAvailable: times?.all?.[times.all.length - 1]?.id
                    });

                    console.log(`   📅 ${worker.name}: ${times?.all?.length || 0} slots available`);

                } catch (error) {
                    console.log(`   ❌ ${worker.name}: Error - ${error.message}`);
                    workerAvailability.push({
                        workerId: worker.workerId,
                        workerName: worker.name,
                        error: error.message,
                        totalSlots: 0
                    });
                }
            }

            return {
                success: true,
                flow: {
                    step1_category: {
                        categoryId: targetCategory.categoryId,
                        name: targetCategory.title
                    },
                    step2_service: {
                        serviceId: targetService.serviceId,
                        name: targetService.title,
                        price: targetService.price,
                        duration: targetService.durationString,
                        description: targetService.description
                    },
                    step3_workers: workers.map(w => ({ id: w.workerId, name: w.name })),
                    step4_availability: {
                        checkDate: this.formatDateForDisplay(checkDate),
                        workers: workerAvailability
                    }
                },
                summary: {
                    categoryName: targetCategory.title,
                    serviceName: targetService.title,
                    servicePrice: targetService.price,
                    serviceDuration: targetService.durationString,
                    workersAvailable: workerAvailability.filter(w => w.totalSlots > 0).length,
                    totalWorkersChecked: workerAvailability.length,
                    bestOption: this.findBestAvailability(workerAvailability)
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
     * Quick service lookup with immediate availability
     */
    async quickServiceLookup(searchTerm, date = "04.09.2025") {
        try {
            console.log(`🔍 Quick lookup for: ${searchTerm} on ${date}`);

            // Search all categories for the service
            const categoriesResponse = await axios.post(`${this.baseURL}/categories`, {
                facility: this.facility,
                lang: 'sk'
            }, { headers: this.headers });

            const categories = categoriesResponse.data.data || [];
            
            for (const category of categories) {
                const servicesResponse = await axios.post(`${this.baseURL}/services`, {
                    facility: this.facility,
                    categoryId: category.categoryId,
                    lang: 'sk'
                }, { headers: this.headers });

                const services = servicesResponse.data.data || [];
                const matchedService = services.find(service => 
                    service.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    searchTerm.toLowerCase().includes(service.title.toLowerCase())
                );

                if (matchedService) {
                    console.log(`✅ Found: ${matchedService.title} in ${category.title}`);

                    // Get workers
                    const workersResponse = await axios.post(`${this.baseURL}/workers`, {
                        serviceId: matchedService.serviceId,
                        lang: 'sk'
                    }, { headers: this.headers });

                    const workers = workersResponse.data.data || [];

                    // Get availability for first available worker
                    const availableWorker = workers.find(w => w.workerId !== -1);
                    if (availableWorker) {
                        const availabilityResponse = await axios.post(`${this.baseURL}/allowedTimes`, {
                            serviceId: matchedService.serviceId,
                            workerId: availableWorker.workerId,
                            date: date + " 00:00",
                            count: 1,
                            participantsCount: 0,
                            addons: [],
                            lang: 'sk'
                        }, { headers: this.headers });

                        const times = availabilityResponse.data.data?.times;

                        return {
                            success: true,
                            service: {
                                serviceId: matchedService.serviceId,
                                name: matchedService.title,
                                price: matchedService.price,
                                duration: matchedService.durationString,
                                category: category.title
                            },
                            worker: {
                                workerId: availableWorker.workerId,
                                name: availableWorker.name
                            },
                            availability: {
                                date: date,
                                morningTimes: times?.mornings?.data?.map(t => t.id) || [],
                                afternoonTimes: times?.afternoon?.data?.map(t => t.id) || [],
                                allTimes: times?.all?.map(t => t.id) || [],
                                totalSlots: times?.all?.length || 0
                            }
                        };
                    }
                }
            }

            return {
                success: false,
                error: `Service "${searchTerm}" not found`
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
    findBestAvailability(workerAvailability) {
        const available = workerAvailability.filter(w => w.totalSlots > 0);
        if (available.length === 0) return null;

        // Return worker with most slots
        return available.reduce((best, current) => 
            current.totalSlots > best.totalSlots ? current : best
        );
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
}

export default new WidgetFlowService();