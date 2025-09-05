import axios from 'axios';
import LLMServiceMatcher from './llmServiceMatcher.js';

/**
 * Direct Bookio API Service
 * Uses the actual Bookio widget API endpoints for accurate service data
 */
class BookioDirectService {
    constructor() {
        this.baseURL = 'https://services.bookio.com/widget/api';
        this.facility = 'ai-recepcia-zll65ixf';
        this.headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
        
        // Cache for service data
        this.serviceCache = null;
        this.cacheExpiry = null;
        this.cacheTimeout = 24 * 60 * 60 * 1000; // 24 hours
        this.isBuilding = false; // Prevent concurrent builds
        
        // LLM service matcher (lazy-loaded)
        this.llmMatcher = null;
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
        // Prevent concurrent builds
        if (this.isBuilding) {
            console.log('⏳ Service index build already in progress, waiting...');
            while (this.isBuilding) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            return this.serviceCache;
        }

        try {
            this.isBuilding = true;
            console.log('🏗️ Building complete service index...');
            const startTime = Date.now();
            
            // FORCE API rebuild to get correct serviceIds - skip crawled data
            console.log('🔧 FORCED: Using API crawling to get correct serviceIds...');
            let allServices = await this.buildFromAPI();

            const buildTime = Date.now() - startTime;
            console.log(`✅ Service index ready: ${allServices.length} total services in ${buildTime}ms`);
            console.log(`🏷️ Sample services: ${allServices.slice(0, 3).map(s => `${s.title} (${s.price})`).join(', ')}...`);
            
            // Cache the results
            this.serviceCache = allServices;
            this.cacheExpiry = Date.now() + this.cacheTimeout;
            
            return allServices;
        } catch (error) {
            console.error('❌ Error building service index:', error);
            throw error;
        } finally {
            this.isBuilding = false;
        }
    }

    /**
     * Load services from comprehensive crawler results
     */
    async loadCrawledServices() {
        try {
            const fs = await import('fs/promises');
            const path = await import('path');
            
            const dataDir = path.join(process.cwd(), 'data');
            const filepath = path.join(dataDir, 'bookio-services-index.json');
            
            const data = await fs.readFile(filepath, 'utf8');
            const crawledData = JSON.parse(data);
            
            // Check if data is recent (within 24 hours)
            const lastUpdate = new Date(crawledData.lastUpdate);
            const now = new Date();
            const hoursOld = (now - lastUpdate) / (1000 * 60 * 60);
            
            if (hoursOld > 24) {
                console.log(`📊 Crawled data is ${hoursOld.toFixed(1)} hours old, rebuilding...`);
                return null;
            }
            
            console.log(`📊 Loaded ${crawledData.totalServices} services from comprehensive crawler (${hoursOld.toFixed(1)}h old)`);
            return crawledData.services;
        } catch (error) {
            console.log('📡 No crawled services data available, will use API crawling');
            return null;
        }
    }

    /**
     * Original API crawling method (fallback)
     */
    async buildFromAPI() {
        console.log('🌐 Building from direct API calls...');
        
        // Get all categories
        const categories = await this.getCategories();
        console.log(`📋 Found ${categories.length} categories: ${categories.map(c => c.title).join(', ')}`);

        const allServices = [];

        // Use Promise.all for faster concurrent processing
        const categoryPromises = categories.map(async (category) => {
            try {
                const services = await this.getServicesForCategory(category.categoryId);
                
                // Add category context to each service
                const enrichedServices = services.map(service => ({
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
                    priority: service.priority || 999,
                    // Add searchable text for better matching (both original and normalized)
                    searchText: `${service.title} ${category.title} ${service.description || ''}`.toLowerCase(),
                    normalizedSearchText: this.normalizeText(`${service.title} ${category.title} ${service.description || ''}`)
                }));

                console.log(`📦 Category "${category.title}": ${services.length} services`);
                return enrichedServices;
            } catch (error) {
                console.warn(`⚠️ Skipping category "${category.title}" (${category.categoryId}): ${error.message}`);
                return [];
            }
        });

        // Wait for all categories to complete
        const categoryResults = await Promise.all(categoryPromises);
        categoryResults.forEach(services => allServices.push(...services));

        return allServices;
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
     * Search services using LLM-powered intelligent matching
     */
    async searchServices(searchTerm) {
        try {
            const allServices = await this.getServiceIndex();
            const search = searchTerm.toLowerCase().trim();
            
            if (!search) {
                return {
                    success: false,
                    message: 'Zadajte názov služby pre vyhľadanie'
                };
            }

            console.log(`🔍 Searching for: "${search}" among ${allServices.length} services`);
            
            // Normalize search term for better matching with Slovak accents
            const normalizedSearch = this.normalizeText(search);
            
            // Filter services to prioritize regular pricing over sale items
            // Unless user specifically asks for sale/discount/akcia
            const isAskingForSale = search.includes('zľava') || search.includes('akcia') || search.includes('zlavy') || search.includes('discount');
            
            let services;
            if (isAskingForSale) {
                console.log(`💰 User specifically asking for sale items, including all services`);
                services = allServices;
            } else {
                // Prioritize non-sale services: exclude AKCIA categories unless no alternatives exist
                const regularServices = allServices.filter(service => 
                    !service.categoryName.includes('AKCIA') && 
                    !service.title.includes('zľava')
                );
                
                // If we have regular services, use them. Otherwise fall back to all services
                if (regularServices.length > 0) {
                    console.log(`🏷️ Filtering out sale items: ${allServices.length} → ${regularServices.length} services`);
                    services = regularServices;
                } else {
                    console.log(`⚠️ No regular services found, using all services including sales`);
                    services = allServices;
                }
            }

            // Lazy-load LLM matcher on first use
            if (!this.llmMatcher) {
                this.llmMatcher = new LLMServiceMatcher();
            }
            
            // Try LLM-powered matching first (if available)
            if (this.llmMatcher && this.llmMatcher.isAvailable()) {
                console.log(`🤖 Using LLM-powered service matching for: "${searchTerm}"`);
                
                try {
                    // Try to get top 3 matches first for better accuracy
                    const llmTopMatches = await this.llmMatcher.getTopMatches(searchTerm, services, 3);
                    
                    if (llmTopMatches.success && llmTopMatches.services && llmTopMatches.services.length > 0) {
                        console.log(`✅ LLM found ${llmTopMatches.services.length} top matches for: "${searchTerm}"`);
                        llmTopMatches.services.forEach((service, i) => {
                            console.log(`  ${i + 1}. ${service.title} (${service.categoryTitle || service.categoryName})`);
                        });
                        
                        return {
                            success: true,
                            found: llmTopMatches.services.length,
                            searchTerm: searchTerm,
                            matchMethod: 'llm',
                            confidence: 'high',
                            services: llmTopMatches.services.map(service => ({
                                serviceId: service.serviceId,
                                name: service.title,
                                price: service.price,
                                duration: service.durationString || service.duration,
                                category: service.categoryTitle || service.categoryName,
                                description: service.description,
                                priceNumber: service.priceNumber
                            }))
                        };
                    }
                    
                    // Fallback to single match if top matches failed
                    const llmResult = await this.llmMatcher.matchService(searchTerm, services);
                    
                    if (llmResult.success && llmResult.service) {
                        console.log(`✅ LLM single match: "${searchTerm}" → "${llmResult.service.title}"`);
                        
                        return {
                            success: true,
                            found: 1,
                            searchTerm: searchTerm,
                            matchMethod: 'llm',
                            confidence: llmResult.confidence,
                            services: [{
                                serviceId: llmResult.service.serviceId,
                                name: llmResult.service.title,
                                price: llmResult.service.price,
                                duration: llmResult.service.durationString || llmResult.service.duration,
                                category: llmResult.service.categoryTitle || llmResult.service.categoryName,
                                description: llmResult.service.description,
                                priceNumber: llmResult.service.priceNumber
                            }]
                        };
                    } else {
                        console.log(`❌ LLM could not match service for: "${searchTerm}", falling back to traditional search`);
                    }
                } catch (error) {
                    console.error('❌ LLM matching error:', error.message);
                    console.log('🔄 Falling back to traditional search algorithm');
                }
            } else {
                console.log('⚠️ LLM matcher not available (missing OpenAI API key), using traditional search');
            }

            // Fallback to traditional search with simplified scoring
            console.log(`🔍 Running fallback search for: "${search}" (normalized: "${normalizedSearch}")`);
            const searchWords = normalizedSearch.split(' ').filter(word => word.length > 1);
            
            // Simplified scoring for fallback with fuzzy matching
            const scoredServices = services.map(service => {
                const title = service.title.toLowerCase();
                const normalizedTitle = this.normalizeText(service.title);
                const searchText = service.searchText || title;
                const normalizedSearchText = service.normalizedSearchText || normalizedTitle;
                let score = 0;
                
                // Exact title match (both original and normalized)
                if (title === search || normalizedTitle === normalizedSearch) {
                    score += 1000;
                }
                
                // Title contains search phrase (both original and normalized)
                if (title.includes(search) || normalizedTitle.includes(normalizedSearch)) {
                    score += 500;
                }
                
                // Search in full normalized search text (includes category and description)
                if (normalizedSearchText.includes(normalizedSearch)) {
                    score += 200;
                }
                
                // Fuzzy matching for common Slovak mistakes - disabled for now, LLM handles this
                // if (this.fuzzyMatch(normalizedSearch, normalizedTitle)) {
                //     score += 400;
                // }
                
                // All words present (using normalized text)
                if (searchWords.length > 1 && searchWords.every(word => normalizedSearchText.includes(word))) {
                    score += 300;
                }
                
                // Individual word matches (using normalized text)
                searchWords.forEach(word => {
                    if (normalizedSearchText.includes(word)) {
                        score += 10;
                    }
                });
                
                return { ...service, score };
            }).filter(service => service.score > 0);
            
            // Sort and limit results
            const results = scoredServices
                .sort((a, b) => b.score - a.score)
                .slice(0, 10);
            
            console.log(`🎯 Fallback search found ${results.length} matches for "${searchTerm}"`);
            if (results.length > 0) {
                console.log(`Top result: ${results[0].title} (${results[0].categoryName})`);
            }

            return {
                success: true,
                found: results.length,
                searchTerm: searchTerm,
                matchMethod: 'traditional',
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
                lang: 'sk',
                facility: this.facility
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
                lang: 'sk',
                facility: this.facility
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
                lang: 'sk',
                facility: this.facility
            }, { headers: this.headers });

            return response.data.data || {};
        } catch (error) {
            console.error(`Error fetching allowed days:`, error);
            return {};
        }
    }

    /**
     * Get available times and days for a service, returning the soonest booking slot
     * Handles multiple months, edge cases, retries, and comprehensive error handling
     */
    async getAvailableTimesAndDays(serviceId, workerId = -1, maxMonthsAhead = 3, maxRetries = 2) {
        const startTime = Date.now();
        let apiCallCount = 0;
        
        try {
            console.log(`🔍 Getting available times and days for service ${serviceId}, worker ${workerId}`);
            
            // Validate inputs
            if (!serviceId || serviceId <= 0) {
                return { success: false, error: 'Invalid service ID provided' };
            }

            // Get workers if not specified with retry logic
            if (workerId === -1) {
                const workers = await this.retryApiCall(
                    () => this.getWorkers(serviceId), 
                    maxRetries, 
                    `getWorkers(${serviceId})`
                );
                apiCallCount++;
                
                if (!workers || workers.length === 0) {
                    return {
                        success: false,
                        message: 'Služba momentálne nie je dostupná - žiadni pracovníci',
                        debugInfo: { serviceId, apiCallCount, duration: Date.now() - startTime }
                    };
                }
                
                // Use first available worker (excluding "Nezáleží" if others exist)
                const realWorkers = workers.filter(w => w && w.workerId && w.workerId !== -1);
                workerId = realWorkers.length > 0 ? realWorkers[0].workerId : workers[0]?.workerId;
                
                if (!workerId || workerId <= 0) {
                    return { success: false, error: 'No valid worker ID found' };
                }
                
                console.log(`👤 Selected worker ID: ${workerId} from ${workers.length} available workers`);
            }

            const now = new Date();
            const currentMonth = now.getMonth() + 1;
            const currentYear = now.getFullYear();
            const currentDay = now.getDate();

            // Check multiple months ahead
            for (let monthOffset = 0; monthOffset < maxMonthsAhead; monthOffset++) {
                const targetDate = new Date(currentYear, currentMonth - 1 + monthOffset, 1);
                const targetMonth = targetDate.getMonth() + 1;
                const targetYear = targetDate.getFullYear();
                
                console.log(`📅 Checking month: ${targetMonth}/${targetYear} (offset: ${monthOffset})`);

                try {
                    // Get allowed days for this month with retry logic
                    const allowedDaysData = await this.retryApiCall(
                        () => this.getAllowedDaysForMonth(serviceId, workerId, targetYear, targetMonth),
                        maxRetries,
                        `getAllowedDays(${serviceId}, ${workerId}, ${targetYear}-${targetMonth})`
                    );
                    apiCallCount++;

                    if (!this.isValidAllowedDaysResponse(allowedDaysData)) {
                        console.log(`⚠️ Invalid or empty response for ${targetMonth}/${targetYear}`);
                        continue;
                    }

                    // Filter out past dates for current month
                    let validDays = allowedDaysData.allowedDays || [];
                    if (monthOffset === 0) {
                        validDays = validDays.filter(day => {
                            const dayDate = new Date(targetYear, targetMonth - 1, day);
                            return dayDate >= now;
                        });
                    }

                    if (validDays.length === 0) {
                        console.log(`📅 No valid days available in ${targetMonth}/${targetYear}`);
                        continue;
                    }

                    // Sort days and check earliest available slots
                    const sortedDays = validDays.sort((a, b) => a - b);
                    console.log(`📋 Valid days in ${targetMonth}/${targetYear}: [${sortedDays.join(', ')}]`);

                    for (const day of sortedDays) {
                        const dateStr = this.formatDateString(day, targetMonth, targetYear);
                        
                        try {
                            // Add small delay to prevent rate limiting
                            if (apiCallCount > 3) {
                                await this.sleep(100);
                            }

                            const timesData = await this.retryApiCall(
                                () => this.getAllowedTimes(serviceId, workerId, dateStr),
                                maxRetries,
                                `getAllowedTimes(${serviceId}, ${workerId}, ${dateStr})`
                            );
                            apiCallCount++;

                            if (this.hasValidTimeSlots(timesData)) {
                                const earliestTime = timesData.times.all[0];
                                const appointmentDate = new Date(targetYear, targetMonth - 1, day);
                                const daysFromNow = Math.ceil((appointmentDate - now) / (1000 * 60 * 60 * 24));

                                console.log(`✅ Found earliest slot: ${day}.${targetMonth}.${targetYear} at ${earliestTime.name}`);

                                return {
                                    success: true,
                                    serviceId: parseInt(serviceId),
                                    workerId: parseInt(workerId),
                                    soonestDate: this.formatDisplayDate(day, targetMonth, targetYear),
                                    soonestTime: earliestTime.name,
                                    soonestDateTime: appointmentDate.toISOString(),
                                    availableTimes: timesData.times.all.map(t => t.name),
                                    totalAvailableSlots: timesData.times.all.length,
                                    daysFromNow: Math.max(daysFromNow, 0),
                                    year: targetYear,
                                    month: targetMonth,
                                    day: day,
                                    availableDays: sortedDays,
                                    monthsSearched: monthOffset + 1,
                                    apiCallCount: apiCallCount,
                                    searchDuration: Date.now() - startTime,
                                    message: `Najrýchlejší dostupný termín: ${day}.${targetMonth}.${targetYear} o ${earliestTime.name} (za ${Math.max(daysFromNow, 0)} ${this.getDaysLabel(daysFromNow)})`
                                };
                            }
                        } catch (error) {
                            console.log(`❌ Error checking times for ${dateStr}: ${error.message}`);
                            // Continue to next day instead of failing completely
                            continue;
                        }
                    }
                } catch (error) {
                    console.log(`❌ Error checking month ${targetMonth}/${targetYear}: ${error.message}`);
                    // Continue to next month instead of failing completely
                    continue;
                }
            }

            // No slots found after checking all months
            console.log(`❌ No available slots found after checking ${maxMonthsAhead} months`);
            return {
                success: false,
                found: false,
                message: `Momentálne nie sú dostupné žiadne voľné termíny v najbližších ${maxMonthsAhead} mesiacoch`,
                debugInfo: {
                    serviceId: parseInt(serviceId),
                    workerId: parseInt(workerId),
                    monthsSearched: maxMonthsAhead,
                    apiCallCount: apiCallCount,
                    searchDuration: Date.now() - startTime
                }
            };

        } catch (error) {
            console.error('Critical error in getAvailableTimesAndDays:', error);
            return {
                success: false,
                error: error.message,
                debugInfo: {
                    serviceId: parseInt(serviceId),
                    workerId: workerId,
                    apiCallCount: apiCallCount,
                    searchDuration: Date.now() - startTime,
                    errorStack: error.stack
                }
            };
        }
    }

    /**
     * Retry API calls with exponential backoff
     */
    async retryApiCall(apiFunction, maxRetries, operationName) {
        let lastError;
        
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const result = await apiFunction();
                if (attempt > 0) {
                    console.log(`✅ ${operationName} succeeded on attempt ${attempt + 1}`);
                }
                return result;
            } catch (error) {
                lastError = error;
                
                if (attempt < maxRetries) {
                    const delay = Math.min(1000 * Math.pow(2, attempt), 5000); // Exponential backoff, max 5s
                    console.log(`⚠️ ${operationName} failed (attempt ${attempt + 1}), retrying in ${delay}ms: ${error.message}`);
                    await this.sleep(delay);
                } else {
                    console.log(`❌ ${operationName} failed after ${maxRetries + 1} attempts: ${error.message}`);
                }
            }
        }
        
        throw lastError;
    }

    /**
     * Get allowed days for specific month/year
     */
    async getAllowedDaysForMonth(serviceId, workerId, year, month) {
        // Create a date string for the first day of the target month
        const dateStr = `01.${month.toString().padStart(2, '0')}.${year} 00:00`;
        
        const response = await axios.post(`${this.baseURL}/allowedDays`, {
            serviceId: parseInt(serviceId),
            workerId: parseInt(workerId),
            date: dateStr,
            addons: [],
            count: 1,
            participantsCount: 0,
            lang: 'sk',
            facility: this.facility
        }, { headers: this.headers });

        return response.data.data || {};
    }

    /**
     * Validate allowed days API response
     */
    isValidAllowedDaysResponse(response) {
        return response && 
               response.allowedDays && 
               Array.isArray(response.allowedDays) && 
               response.allowedDays.length > 0 &&
               response.year && 
               response.month &&
               !response.cantReserve;
    }

    /**
     * Check if times response has valid slots
     */
    hasValidTimeSlots(timesData) {
        return timesData && 
               timesData.times && 
               timesData.times.all && 
               Array.isArray(timesData.times.all) && 
               timesData.times.all.length > 0;
    }

    /**
     * Format date string for API calls
     */
    formatDateString(day, month, year) {
        return `${day.toString().padStart(2, '0')}.${month.toString().padStart(2, '0')}.${year} 00:00`;
    }

    /**
     * Format date for display
     */
    formatDisplayDate(day, month, year) {
        return `${day.toString().padStart(2, '0')}.${month.toString().padStart(2, '0')}.${year}`;
    }

    /**
     * Get proper Slovak label for days
     */
    getDaysLabel(days) {
        if (days === 0) return 'dnes';
        if (days === 1) return 'deň';
        if (days >= 2 && days <= 4) return 'dni';
        return 'dní';
    }

    /**
     * Sleep utility for delays
     */
    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
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
     * Find soonest available slot for a service (checks up to 60 days ahead)
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

            // Get allowed days (this gets current month by default)
            const allowedDays = await this.getAllowedDays(serviceId, workerId);
            
            console.log('🔍 Debug - Allowed days response:', JSON.stringify(allowedDays, null, 2));
            
            if (!allowedDays.allowedDays || allowedDays.allowedDays.length === 0) {
                console.log('❌ No allowed days found - API unreliable, disabling time checks');
                return {
                    success: false,
                    found: false,
                    message: 'Pre overenie dostupnosti termínov použite rezervačný systém'
                };
            }

            // Check each allowed day
            for (const day of allowedDays.allowedDays) {
                const dateStr = `${day}.${allowedDays.month.toString().padStart(2, '0')}.${allowedDays.year} 00:00`;
                
                console.log(`🔍 Debug - Checking date: ${dateStr}`);
                
                try {
                    const times = await this.getAllowedTimes(serviceId, workerId, dateStr);
                    
                    console.log(`🔍 Debug - Times for ${dateStr}:`, times.times?.all?.length || 0, 'slots');
                    
                    if (times.times && times.times.all && times.times.all.length > 0) {
                        const firstTime = times.times.all[0];
                        
                        // Calculate days from now
                        const appointmentDate = new Date(allowedDays.year, allowedDays.month - 1, day);
                        const today = new Date();
                        const daysFromNow = Math.ceil((appointmentDate - today) / (1000 * 60 * 60 * 24));
                        
                        console.log(`✅ Found appointment: ${day}.${allowedDays.month}.${allowedDays.year} o ${firstTime.name}`);
                        
                        return {
                            success: true,
                            found: true,
                            date: `${day}.${allowedDays.month.toString().padStart(2, '0')}.${allowedDays.year}`,
                            time: firstTime.name,
                            workerId: workerId,
                            totalSlots: times.times.all.length,
                            allTimes: times.times.all.slice(0, 5).map(t => t.name),
                            daysFromNow: daysFromNow,
                            message: `Najrýchlejší dostupný termín je ${day}.${allowedDays.month}.${allowedDays.year} o ${firstTime.name}`
                        };
                    }
                } catch (error) {
                    console.log(`❌ Error checking ${dateStr}:`, error.message);
                    continue;
                }
            }

            console.log('❌ No available slots found in any allowed days');
            return {
                success: false,
                found: false,
                message: 'Momentálne nie sú dostupné žiadne voľné termíny v najbližších dňoch'
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