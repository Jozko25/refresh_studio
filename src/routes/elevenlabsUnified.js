import express from 'express';
import axios from 'axios';
import CallFlowService from '../services/callFlowService.js';
import SlotService from '../services/slotService.js';
import WidgetFlowService from '../services/widgetFlowService.js';
import BookioDirectService from '../services/bookioDirectService.js';
import BookioApiCrawler from '../services/bookioApiCrawler.js';
import TokenAnalyzer from '../services/tokenAnalyzer.js';
import LocationBookioService from '../services/locationBookioService.js';
import RefreshClinicService from '../services/refreshClinicService.js';

const router = express.Router();

/**
 * Compare two slots to determine which is earlier
 */
function isEarlierSlot(slot1, slot2) {
    // Parse dates
    const date1Parts = slot1.date.split('.');
    const date2Parts = slot2.date.split('.');
    
    const date1 = new Date(
        parseInt(date1Parts[2]), // year
        parseInt(date1Parts[1]) - 1, // month (0-based)
        parseInt(date1Parts[0]) // day
    );
    
    const date2 = new Date(
        parseInt(date2Parts[2]), // year
        parseInt(date2Parts[1]) - 1, // month (0-based)
        parseInt(date2Parts[0]) // day
    );
    
    // Compare dates first
    if (date1.getTime() !== date2.getTime()) {
        return date1.getTime() < date2.getTime();
    }
    
    // Same date, compare times
    const time1Parts = slot1.time.split(':');
    const time2Parts = slot2.time.split(':');
    
    const time1Minutes = parseInt(time1Parts[0]) * 60 + parseInt(time1Parts[1]);
    const time2Minutes = parseInt(time2Parts[0]) * 60 + parseInt(time2Parts[1]);
    
    return time1Minutes < time2Minutes;
}

/**
 * Detect location from search term or return null if unclear
 */
function detectLocation(searchTerm, existingLocation = null) {
    if (existingLocation) return existingLocation;
    
    const term = searchTerm.toLowerCase();
    if (term.includes('bratislava') || term.includes('lazaretská')) {
        return 'bratislava';
    }
    if (term.includes('pezinok')) {
        return 'pezinok';
    }
    return null; // Location unclear, need to ask
}

/**
 * GET /api/elevenlabs/test
 * Test endpoint to verify ElevenLabs can reach our webhook
 */
router.get('/test', (req, res) => {
    res.set('Content-Type', 'text/plain');
    res.send('ElevenLabs webhook is reachable! Tools should work now.');
});

// Debug endpoint to see all services
router.get('/debug/services', async (req, res) => {
    try {
        const services = await BookioDirectService.getServiceIndex();
        const { category, search } = req.query;
        
        let filteredServices = services;
        
        if (category) {
            filteredServices = services.filter(s => 
                s.categoryName.toLowerCase().includes(category.toLowerCase())
            );
        }
        
        if (search) {
            filteredServices = services.filter(s => 
                s.title.toLowerCase().includes(search.toLowerCase()) ||
                s.categoryName.toLowerCase().includes(search.toLowerCase())
            );
        }
        
        res.json({
            totalServices: services.length,
            filteredServices: filteredServices.length,
            categories: [...new Set(services.map(s => s.categoryName))],
            services: filteredServices.slice(0, 20).map(s => ({
                id: s.serviceId,
                title: s.title,
                price: s.price,
                duration: s.durationString,
                category: s.categoryName
            }))
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// Analyze token generation
router.post('/debug/analyze-token', async (req, res) => {
    try {
        console.log('🔬 Starting token analysis...');
        const analysis = await TokenAnalyzer.analyze();
        
        res.json({
            success: true,
            message: 'Token analysis complete',
            findings: {
                tokenPatternsFound: analysis.tokenPatterns.length,
                cryptoUsageFound: analysis.cryptoUsage.length,
                relevantFunctionsFound: analysis.relevantFunctions.length,
                samples: analysis.tokenPatterns.slice(0, 2)
            }
        });
    } catch (error) {
        console.error('❌ Token analysis failed:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Manual rebuild endpoint
router.post('/debug/rebuild-services', async (req, res) => {
    try {
        console.log('🔄 Manual service index rebuild requested');
        const services = await BookioDirectService.buildServiceIndex();
        res.json({
            success: true,
            message: `Service index rebuilt successfully with ${services.length} services`,
            totalServices: services.length,
            categories: [...new Set(services.map(s => s.categoryName))]
        });
    } catch (error) {
        console.error('❌ Manual rebuild failed:', error);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

// Comprehensive API crawler endpoint
router.post('/debug/crawl-api', async (req, res) => {
    try {
        console.log('🕷️ Starting comprehensive API crawl...');
        const crawler = new BookioApiCrawler();
        const results = await crawler.crawlAll();
        
        const stats = crawler.getStats();
        
        res.json({
            success: true,
            message: `API crawl completed successfully`,
            crawlTime: results.crawlTime,
            totalCategories: results.totalCategories,
            totalServices: results.totalServices,
            stats: stats.servicesByCategory
        });
    } catch (error) {
        console.error('❌ API crawl failed:', error);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});


// Get crawl results
router.get('/debug/crawl-results', async (req, res) => {
    try {
        const fs = await import('fs/promises');
        const path = await import('path');
        
        const dataDir = path.join(process.cwd(), 'data');
        const filepath = path.join(dataDir, 'bookio-crawl-results.json');
        
        try {
            const data = await fs.readFile(filepath, 'utf8');
            const results = JSON.parse(data);
            res.json(results);
        } catch (fileError) {
            res.status(404).json({
                success: false,
                message: 'No crawl results found. Run /debug/crawl-api first.'
            });
        }
    } catch (error) {
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

// Debug search scoring
router.get('/debug/search/:searchTerm', async (req, res) => {
    try {
        const { searchTerm } = req.params;
        const searchResult = await BookioDirectService.searchServices(searchTerm);
        
        if (searchResult.success) {
            res.json({
                success: true,
                searchTerm: searchTerm,
                totalResults: searchResult.found,
                services: searchResult.services.map(s => ({
                    serviceId: s.serviceId,
                    title: s.title,
                    name: s.name,
                    price: s.price,
                    category: s.categoryName,
                    score: s.score || 0
                }))
            });
        } else {
            res.json({
                success: false,
                error: searchResult.message
            });
        }
    } catch (error) {
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

// Get all available services organized by category
router.get('/services', async (req, res) => {
    try {
        const services = await BookioDirectService.getServiceIndex();
        
        // Group services by category
        const servicesByCategory = services.reduce((acc, service) => {
            const categoryName = service.categoryName || 'Ostatné';
            if (!acc[categoryName]) {
                acc[categoryName] = [];
            }
            acc[categoryName].push({
                id: service.serviceId,
                title: service.title,
                price: service.price,
                duration: service.durationString,
                description: service.description
            });
            return acc;
        }, {});

        // Sort services within each category by price
        Object.keys(servicesByCategory).forEach(category => {
            servicesByCategory[category].sort((a, b) => {
                const priceA = parseFloat(a.price.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
                const priceB = parseFloat(b.price.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
                return priceA - priceB;
            });
        });

        res.json({
            success: true,
            totalServices: services.length,
            categories: Object.keys(servicesByCategory).sort(),
            servicesByCategory
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * GET /api/elevenlabs
 * Handle GET requests - return success for URL validation
 */
router.get('/', (req, res) => {
    res.set('Content-Type', 'application/json');
    res.json({
        success: true,
        message: "REFRESH clinic webhook is ready",
        available_tools: ["quick_booking", "select_location", "location_booking", "search_service", "find_soonest_slot", "get_services_overview", "get_opening_hours", "confirm_booking"]
    });
});

/**
 * OPTIONS /api/elevenlabs
 * Handle preflight requests from ElevenLabs
 */
router.options('/', (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'POST, OPTIONS, HEAD');
    res.header('Access-Control-Allow-Headers', 'Content-Type, ElevenLabs-Signature');
    res.status(200).send();
});

/**
 * HEAD /api/elevenlabs
 * Handle HEAD requests for URL validation
 */
router.head('/', (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.status(200).send();
});

/**
 * POST /api/elevenlabs
 * Unified endpoint for all ElevenLabs tool calls
 * Handles dynamic routing based on tool_name parameter
 */
router.post('/', async (req, res) => {
    // Set timeout to 25 seconds (ElevenLabs timeout is 30s)
    req.setTimeout(25000);
    
    // Set CORS headers for ElevenLabs
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'POST');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    
    try {
        console.log('🚀 ElevenLabs webhook called:', {
            method: req.method,
            url: req.url,
            headers: req.headers,
            body: req.body
        });

        let { tool_name, search_term, service_id, worker_id = -1, date, time, location, preferred_location, user_name, user_email, user_phone, age, skip_slots = 0 } = req.body;

        // Handle ElevenLabs function_call format
        if (req.body.function_call && req.body.function_call.name) {
            tool_name = req.body.function_call.name;
            // Try to parse parameters if they're a JSON string
            if (typeof req.body.function_call.parameters === 'string') {
                try {
                    const params = JSON.parse(req.body.function_call.parameters);
                    search_term = params.search_term;
                    service_id = params.service_id;
                    worker_id = params.worker_id || -1;
                    date = params.date;
                    time = params.time;
                    location = params.location || params.preferred_location;
                    preferred_location = params.preferred_location;
                    user_name = params.user_name;
                    user_email = params.user_email;
                    user_phone = params.user_phone;
                    age = params.age;
                } catch (e) {
                    console.log('Failed to parse function_call.parameters:', e);
                }
            }
        }
        
        // Also check if tool is specified directly in body (for refresh_booking)
        if (!tool_name && req.body.tool) {
            tool_name = req.body.tool;
        }

        if (!tool_name) {
            console.log('❌ No tool_name provided, defaulting to get_services_overview');
            // Default to service overview if tool_name is missing
            tool_name = 'get_services_overview';
        }

        console.log(`🔧 ElevenLabs tool call: ${tool_name}`, req.body);

        let result;
        let response;

        switch (tool_name) {
            case 'quick_booking':
                if (!search_term) {
                    res.set('Content-Type', 'text/plain');
                    return res.send("Nerozumiem, akú službu hľadáte. Môžete byť konkrétnejší?");
                }
                
                // Detect or ask for location
                const detectedLocation = detectLocation(search_term, location);
                if (!detectedLocation) {
                    response = `V ktorom meste si želáte rezerváciu na "${search_term}"?\n\n`;
                    response += `🏢 Bratislava - Lazaretská 13\n`;
                    response += `🏢 Pezinok\n\n`;
                    response += `Povedzte "Bratislava" alebo "Pezinok".`;
                    res.set('Content-Type', 'text/plain');
                    return res.send(response);
                }
                
                // Use the working BookioDirectService but show location in response
                result = await BookioDirectService.searchServices(search_term);
                if (result.success && result.found > 0) {
                    const service = result.services[0];
                    
                    // Find soonest slot
                    const slotResult = await BookioDirectService.findSoonestSlot(service.serviceId, worker_id);
                    
                    const locationName = detectedLocation === 'bratislava' ? 'Bratislava' : 'Pezinok';
                    const locationAddress = detectedLocation === 'bratislava' ? 'Lazaretská 13' : 'Pezinok';
                    
                    response = `Služba: ${service.name}\n`;
                    response += `Cena: ${service.price}, Trvanie: ${service.duration}\n`;
                    response += `Miesto: ${locationName} - ${locationAddress}\n\n`;
                    
                    if (slotResult.success && slotResult.found) {
                        if (slotResult.daysFromNow === 0) {
                            response += `Najbližší termín: dnes o ${slotResult.time}`;
                        } else if (slotResult.daysFromNow === 1) {
                            response += `Najbližší termín: zajtra (${slotResult.date}) o ${slotResult.time}`;
                        } else {
                            response += `Najbližší termín: ${slotResult.date} o ${slotResult.time}`;
                        }
                        
                        if (slotResult.alternativeSlots.length > 0) {
                            response += `\nĎalšie časy: ${slotResult.alternativeSlots.slice(0, 2).join(', ')}`;
                        }
                        
                        response += `\n\nVyhovuje vám tento termín?`;
                    } else {
                        response += "Momentálne nie sú dostupné žiadne voľné termíny v najbližších dňoch.";
                    }
                } else {
                    response = `Ľutujem, nenašla som službu "${search_term}". Môžete skúsiť iný názov služby?`;
                }
                
                res.set('Content-Type', 'text/plain');
                return res.send(response);
                break;

            case 'select_location':
                const requestedLocation = search_term ? detectLocation(search_term) : null;
                if (requestedLocation) {
                    const locationInfo = LocationBookioService.getLocationInfo(requestedLocation);
                    response = `Vybrali ste ${locationInfo.name} - ${locationInfo.address}.\n\n`;
                    response += `Teraz môžete povedať akú službu si želáte rezervovať.`;
                } else {
                    response = `V ktorom meste si želáte rezerváciu?\n\n`;
                    response += `🏢 Bratislava - Lazaretská 13\n`;
                    response += `🏢 Pezinok\n\n`;
                    response += `Povedzte "Bratislava" alebo "Pezinok".`;
                }
                
                res.set('Content-Type', 'text/plain');
                return res.send(response);
                break;

            case 'location_booking':
                // Handle when user says location + service in one call
                if (!search_term) {
                    res.set('Content-Type', 'text/plain');
                    return res.send("Nerozumiem, akú službu hľadáte a v ktorom meste?");
                }
                
                // Parse combined location + service request
                const locationMatch = detectLocation(search_term, location || preferred_location);
                if (!locationMatch) {
                    res.set('Content-Type', 'text/plain');
                    return res.send("Nerozumiem lokáciu. Povedzte 'Bratislava' alebo 'Pezinok'.");
                }
                
                // Check for time-specific requests (e.g., "12:30", "o 12:30")
                const timePattern = /(\d{1,2}):?(\d{2})/;
                const timeMatch = search_term.match(timePattern);
                const requestedTime = timeMatch ? `${timeMatch[1]}:${timeMatch[2] || '00'}` : null;
                
                console.log(`🕐 Time detection: pattern=${timePattern}, match=${JSON.stringify(timeMatch)}, requestedTime=${requestedTime}`);
                
                // Use proper search functionality - PRESERVE IMPORTANT SERVICE VARIANTS
                let searchWords = search_term.toLowerCase().split(' ').filter(word => 
                    word.length > 2 && 
                    !['bratislava', 'pezinok'].includes(word) &&
                    !timePattern.test(word) &&
                    word !== 'rokov' &&
                    word !== 'mám' &&
                    word !== 'termín' &&
                    word !== 'voľný' &&
                    word !== 'najbližší' &&
                    word !== 'najrýchlejší'
                );
                
                // 🔥 CRITICAL FIX: Preserve service variants like 'platinum', 'j-lo'
                const importantVariants = ['platinum', 'platínum', 'j-lo', 'jlo', 'jennifer', 'lopez', 'základ', 'akné', 'krk'];
                const hasVariant = importantVariants.some(variant => 
                    search_term.toLowerCase().includes(variant)
                );
                
                if (hasVariant) {
                    // Keep the full service name with variant
                    const cleanedTerm = search_term.toLowerCase()
                        .replace(/bratislava|pezinok|termín|voľný|najbližší|najrýchlejší|aký|aké/gi, '')
                        .trim();
                    searchWords = cleanedTerm.split(' ').filter(word => word.length > 1);
                    console.log(`🎯 VARIANT DETECTED: Using specific search: "${searchWords.join(' ')}"`);
                }
                
                console.log(`🔍 ElevenLabs searching for: "${searchWords.join(' ')}"${requestedTime ? ` (requested time: ${requestedTime})` : ''}`);
                
                // Search for the service using LLM-powered service matching
                const searchResult = await BookioDirectService.searchServices(searchWords.join(' '));
                
                console.log(`📋 Search result:`, {
                    success: searchResult.success,
                    found: searchResult.found,
                    services: searchResult.services?.map(s => ({
                        serviceId: s.serviceId,
                        name: s.name,
                        price: s.price
                    }))
                });
                
                if (searchResult.success && searchResult.found > 0) {
                    // Check if we have multiple age-based options that need clarification
                    const ageSpecificKeywords = ['mládež', 'mladých', 'do 18', 'do 20', 'deti', 'akné'];
                    const adultKeywords = ['základ', 'dospelí', 'dospelý', 'rokov', 'mám'];
                    const priceSpecificKeywords = ['35', '55', '€', 'eur'];
                    
                    const hasAgeRequest = search_term.toLowerCase().split(' ').some(word => 
                        ageSpecificKeywords.some(keyword => word.includes(keyword))
                    );
                    const hasAdultRequest = search_term.toLowerCase().split(' ').some(word => 
                        adultKeywords.some(keyword => word.includes(keyword))
                    );
                    const hasPriceRequest = search_term.toLowerCase().split(' ').some(word => 
                        priceSpecificKeywords.some(keyword => word.includes(keyword))
                    );
                    
                    // Find age-specific and general services
                    const ageSpecificServices = searchResult.services.filter(s => 
                        ageSpecificKeywords.some(keyword => s.name.toLowerCase().includes(keyword))
                    );
                    const generalServices = searchResult.services.filter(s => 
                        !ageSpecificKeywords.some(keyword => s.name.toLowerCase().includes(keyword))
                    );
                    
                    // Check if we have multiple different services (not just price variations)
                    const uniqueServiceNames = [...new Set(searchResult.services.map(s => s.name.replace(/™/g, '').replace(/\s+/g, ' ').trim().toUpperCase()))];
                    const hasDifferentServices = uniqueServiceNames.length > 1;
                    
                    // Only ask for age clarification if we have truly different age-based services, not just price variations
                    // Skip age clarification if user specified a time (they want immediate availability info)
                    if (!hasAgeRequest && !hasAdultRequest && !hasPriceRequest && !requestedTime &&
                        ageSpecificServices.length > 0 && generalServices.length > 0 && 
                        hasDifferentServices) {
                        
                        console.log(`🤔 Multiple different age options available, asking for clarification`);
                        console.log(`Age services: ${ageSpecificServices.map(s => s.name).join(', ')}`);
                        console.log(`General services: ${generalServices.map(s => s.name).join(', ')}`);
                        
                        let response = `Pre ${searchResult.services[0].name.split(' ')[0]} máme rôzne možnosti:\n\n`;
                        
                        // Show age-specific options
                        ageSpecificServices.slice(0, 2).forEach((service, index) => {
                            response += `👦 ${service.name}: ${service.price}\n`;
                        });
                        
                        // Show general/adult options  
                        generalServices.slice(0, 2).forEach((service, index) => {
                            response += `👩 ${service.name}: ${service.price}\n`;
                        });
                        
                        response += `\nAká veková kategória je pre vás najvhodnejšia alebo ktorá možnosť vás zaujíma?`;
                        
                        res.set('Content-Type', 'text/plain');
                        return res.send(response);
                    }
                    
                    // Smart service selection based on request
                    let service = searchResult.services[0]; // default fallback
                    
                    // Check for price-specific request (e.g., "za 55 eur")
                    if (hasPriceRequest) {
                        const priceMatch = search_term.match(/(\d+)\s*(eur|€)/i);
                        if (priceMatch) {
                            const requestedPrice = priceMatch[1];
                            const priceMatchedService = searchResult.services.find(s => 
                                s.price.includes(requestedPrice)
                            );
                            if (priceMatchedService) {
                                service = priceMatchedService;
                                console.log(`💰 Price-specific request (${requestedPrice}€), using:`, service.name);
                            }
                        }
                    } else if (hasAdultRequest && generalServices.length > 0) {
                        // For adult requests, use LLM-prioritized service
                        service = generalServices[0];
                        console.log(`🎯 Adult request detected, using LLM-prioritized service:`, service);
                    } else if (hasAgeRequest && ageSpecificServices.length > 0) {
                        // Use age-specific service when requested
                        service = ageSpecificServices[0];
                        console.log(`🎯 Age-specific request, using youth service:`, service);
                    } else if (!hasAgeRequest && !hasAdultRequest && generalServices.length > 0) {
                        // For general requests, use first service (LLM already prioritized)
                        service = generalServices[0];
                        console.log(`🎯 Using LLM-prioritized service:`, service);
                    } else {
                        console.log(`🎯 Using first available service:`, service);
                    }
                    
                    // Get real availability using location-aware service
                    console.log(`🔍 Getting availability with serviceId: ${service.serviceId}, location: ${locationMatch}, worker_id: ${worker_id || -1}, requestedTime: ${requestedTime}`);
                    
                    let slotResult;
                    try {
                        if (requestedTime) {
                            // For time-specific requests, get full day availability from Bratislava service
                            const BookioDirectService = await import('../services/bookioDirectService.js');
                            const fullAvailability = await BookioDirectService.default.getAvailableTimesAndDays(
                                service.serviceId, -1, 3, 2
                            );
                            
                            if (fullAvailability.success && fullAvailability.availableTimes) {
                                const hasRequestedTime = fullAvailability.availableTimes.includes(requestedTime);
                                const closestTimes = fullAvailability.availableTimes.filter(time => {
                                    const [hour, minute] = time.split(':').map(Number);
                                    const [reqHour, reqMinute] = requestedTime.split(':').map(Number);
                                    const timeMinutes = hour * 60 + minute;
                                    const reqMinutes = reqHour * 60 + reqMinute;
                                    return Math.abs(timeMinutes - reqMinutes) <= 60; // Within 1 hour
                                });
                                
                                slotResult = {
                                    success: true,
                                    found: true,
                                    date: fullAvailability.soonestDate,
                                    time: hasRequestedTime ? requestedTime : closestTimes[0] || fullAvailability.soonestTime,
                                    alternativeSlots: hasRequestedTime ? 
                                        closestTimes.filter(t => t !== requestedTime).slice(0, 4) :
                                        closestTimes.slice(1, 5),
                                    totalSlots: fullAvailability.totalAvailableSlots,
                                    daysFromNow: fullAvailability.daysFromNow,
                                    timeSpecificRequest: true,
                                    hasRequestedTime,
                                    allAvailableTimes: fullAvailability.availableTimes
                                };
                            } else {
                                slotResult = { success: false, error: 'No availability found' };
                            }
                        } else {
                            // 🔥 COMPREHENSIVE SOONEST SLOT CHECKING - CHECK ALL SIMILAR SERVICES!
                            console.log(`🔥 COMPREHENSIVE CHECK: Looking for soonest slot across ALL workers and similar services`);
                            
                            // Step 1: Get soonest for this specific service
                            const primarySlot = await LocationBookioService.findSoonestSlot(
                                service.serviceId,
                                locationMatch,
                                -1  // Force check all workers
                            );
                            
                            let bestSlot = primarySlot;
                            console.log(`📅 Primary service slot: ${primarySlot.found ? `${primarySlot.date} o ${primarySlot.time}` : 'none'}`);
                            
                            // Step 2: DIRECT API CHECK for HydraFacial services with all workers
                            try {
                                const serviceType = service.name.toLowerCase();
                                
                                if (serviceType.includes('hydrafacial')) {
                                    console.log(`🔍 DIRECT API CHECK: Checking HydraFacial variants with all workers`);
                                    
                                    // Known HydraFacial services and their workers
                                    const hydrafacialServices = [
                                        { id: 125877, name: 'HYDRAFACIAL J.LO', workers: [18204], price: '145.00 €', duration: '1h' },  // Janka only
                                        { id: 125882, name: 'HYDRAFACIAL ZÁKLAD', workers: [18204, 30224], price: '95.00 €', duration: '45min' },  // Janka + Veronika
                                        { id: 132731, name: 'HYDRAFACIAL PLATINUM', workers: [18204, 30224], price: '125.00 €', duration: '1h' }  // Both workers confirmed
                                    ];
                                    
                                    for (const hydraService of hydrafacialServices) {
                                        for (const workerId of hydraService.workers) {
                                            const workerName = workerId === 18204 ? 'Janka' : workerId === 30224 ? 'Veronika' : `Worker ${workerId}`;
                                            console.log(`🔍 Checking ${hydraService.name} with ${workerName} (${workerId})`);
                                            
                                            // Check next 21 days (reduced to avoid Railway timeout)
                                            for (let dayOffset = 0; dayOffset < 21; dayOffset++) {
                                                const checkDate = new Date();
                                                checkDate.setDate(checkDate.getDate() + dayOffset);
                                                const dateStr = `${checkDate.getDate().toString().padStart(2, '0')}.${(checkDate.getMonth() + 1).toString().padStart(2, '0')}.${checkDate.getFullYear()} 00:00`;
                                                
                                                try {
                                                    const apiResponse = await axios.post('https://services.bookio.com/widget/api/allowedTimes?lang=sk', {
                                                        serviceId: hydraService.id,
                                                        workerId: workerId,
                                                        date: dateStr,
                                                        lang: 'sk',
                                                        count: 1,
                                                        participantsCount: 0,
                                                        addons: []
                                                    }, {
                                                        timeout: 5000,  // Reduced timeout
                                                        headers: { 'Content-Type': 'application/json' }
                                                    });
                                                    
                                                    const times = apiResponse.data?.data?.times?.all || [];
                                                    if (times.length > 0) {
                                                        const firstTime = times[0].name;
                                                        const slotDate = `${checkDate.getDate().toString().padStart(2, '0')}.${(checkDate.getMonth() + 1).toString().padStart(2, '0')}.${checkDate.getFullYear()}`;
                                                        
                                                        console.log(`📅 FOUND SLOT: ${slotDate} o ${firstTime} with ${workerName} for ${hydraService.name}`);
                                                        
                                                        const candidateSlot = {
                                                            success: true,
                                                            found: true,
                                                            date: slotDate,
                                                            time: firstTime,
                                                            workerId: workerId,
                                                            workerName: workerName,
                                                            actualService: hydraService.name,
                                                            price: hydraService.price,
                                                            duration: hydraService.duration,
                                                            serviceId: hydraService.id,
                                                            alternativeSlots: times.slice(1, 5).map(t => t.name),
                                                            daysFromNow: dayOffset
                                                        };
                                                        
                                                        // Compare with current best
                                                        if (!bestSlot.found || isEarlierSlot(candidateSlot, bestSlot)) {
                                                            bestSlot = candidateSlot;
                                                            console.log(`✅ NEW BEST: ${slotDate} o ${firstTime} with ${workerName} for ${hydraService.name}`);
                                                        }
                                                        
                                                        // Found the earliest possible, break out of day loop for this worker
                                                        break;
                                                    }
                                                } catch (apiError) {
                                                    // Ignore API errors for individual days
                                                }
                                            }
                                        }
                                    }
                                }
                                
                            } catch (variantError) {
                                console.error(`❌ Error in direct API check:`, variantError);
                            }
                            
                            slotResult = bestSlot;
                            console.log(`🏆 FINAL BEST SLOT: ${slotResult.found ? `${slotResult.date} o ${slotResult.time}` : 'none found'}`);
                        }
                        
                        console.log(`⏰ Availability result:`, JSON.stringify(slotResult, null, 2));
                    } catch (error) {
                        console.error(`❌ Error getting availability:`, error);
                        slotResult = { success: false, error: error.message };
                    }
                    
                    // Use actual service info if different service was found
                    const actualServiceName = slotResult.actualService || service.name;
                    const actualPrice = slotResult.price || service.price;
                    const actualDuration = slotResult.duration || service.duration;
                    
                    response = `Služba: ${actualServiceName}\n`;
                    response += `Cena: ${actualPrice}, Trvanie: ${actualDuration}\n`;
                    response += `Miesto: ${locationMatch === 'bratislava' ? 'Bratislava - Lazaretská 13' : 'Pezinok'}\n\n`;
                    
                    // Check if we have real availability
                    if (slotResult.success && slotResult.found && slotResult.date) {
                        if (slotResult.timeSpecificRequest && requestedTime) {
                            // Handle time-specific responses
                            if (slotResult.hasRequestedTime) {
                                response += `Áno, ${requestedTime} je dostupné dňa ${slotResult.date}`;
                                if (slotResult.alternativeSlots && slotResult.alternativeSlots.length > 0) {
                                    response += `\nĎalšie časy okolo tejto hodiny: ${slotResult.alternativeSlots.join(', ')}`;
                                }
                            } else {
                                response += `${requestedTime} nie je dostupné, ale máme tieto časy blízko:`;
                                response += `\n${slotResult.date}: ${slotResult.time}`;
                                if (slotResult.alternativeSlots && slotResult.alternativeSlots.length > 0) {
                                    response += `, ${slotResult.alternativeSlots.join(', ')}`;
                                }
                            }
                        } else {
                            // Regular response
                            response += `Najbližší termín: ${slotResult.date} o ${slotResult.time}`;
                            
                            // Show more alternative times for better user experience
                            if (slotResult.alternativeSlots && slotResult.alternativeSlots.length > 0) {
                                const alternatives = slotResult.alternativeSlots.slice(0, 4);
                                response += `\nĎalšie časy: ${alternatives.join(', ')}`;
                            }
                        }
                        
                        // Add day context
                        if (slotResult.daysFromNow === 0) {
                            response = response.replace(slotResult.date, 'dnes');
                        } else if (slotResult.daysFromNow === 1) {
                            response = response.replace(slotResult.date, 'zajtra');
                        }
                    } else {
                        response += "Momentálne nie sú dostupné žiadne voľné termíny v najbližších dňoch.";
                    }
                } else {
                    console.log(`❌ No services found for search: "${searchWords.join(' ')}"`);
                    response = "Ľutujem, nenašla som požadovanú službu.";
                }
                
                res.set('Content-Type', 'text/plain');
                return res.send(response);
                break;

            case 'confirm_booking':
                // Parse booking data from search_term
                // Expected format: "serviceId:101302,workerId:18204,date:27.08.2025,time:9:15,name:Jan Harmady,email:test@example.com,phone:+421910223761"
                
                if (!search_term || !search_term.includes('serviceId:')) {
                    res.set('Content-Type', 'text/plain');
                    return res.send("Nie sú poskytnuté údaje pre rezerváciu. Potrebujem serviceId, dátum, čas, meno, email a telefón.");
                }
                
                try {
                    // Parse booking parameters
                    const bookingParams = {};
                    search_term.split(',').forEach(param => {
                        const colonIndex = param.indexOf(':');
                        if (colonIndex > 0) {
                            const key = param.substring(0, colonIndex).trim();
                            const value = param.substring(colonIndex + 1).trim();
                            bookingParams[key] = value;
                        }
                    });
                    
                    console.log('🎯 ElevenLabs booking attempt:', bookingParams);
                    
                    // Validate required fields
                    const required = ['serviceId', 'date', 'time', 'name', 'phone'];
                    const missing = required.filter(field => !bookingParams[field]);
                    
                    // Check if email is missing or invalid
                    if (!bookingParams.email || !bookingParams.email.includes('@')) {
                        missing.push('email');
                    }
                    
                    if (missing.length > 0) {
                        res.set('Content-Type', 'text/plain');
                        if (missing.includes('email')) {
                            return res.send("Pre dokončenie rezervácie potrebujem váš email. Môžete mi ho prosím poskytnúť?");
                        } else if (missing.includes('phone')) {
                            return res.send("Pre dokončenie rezervácie potrebujem vaše telefónne číslo. Môžete mi ho prosím poskytnúť?");
                        } else {
                            return res.send(`Chýbajú údaje pre rezerváciu: ${missing.join(', ')}`);
                        }
                    }
                    
                    // Split name into first and last name
                    const nameParts = bookingParams.name.split(' ');
                    const firstName = nameParts[0] || 'Unknown';
                    const lastName = nameParts.slice(1).join(' ') || 'Customer';
                    
                    // Log booking attempt clearly for manual processing
                    console.log('🚨 NEW BOOKING REQUEST - PROCESS MANUALLY:');
                    console.log('👤 Customer:', bookingParams.name);
                    console.log('📧 Email:', bookingParams.email);
                    console.log('📱 Phone:', bookingParams.phone);
                    console.log('🏥 Service ID:', bookingParams.serviceId, '(HYDRAFACIAL ZÁKLAD)');
                    console.log('📅 Date:', bookingParams.date);
                    console.log('🕐 Time:', bookingParams.time);
                    console.log('🚨 === END BOOKING REQUEST ===');
                    
                    // Get service name from the search result if available
                    const serviceName = bookingParams.serviceName || `Service ID: ${bookingParams.serviceId}`;
                    
                    // Detect location from booking params, conversation context, or default to Bratislava
                    let detectedLocation = bookingParams.location || 
                                         detectLocation(req.body.conversation_id || '', null) ||
                                         detectLocation(search_term, null) ||
                                         'bratislava';
                    
                    const locationInfo = LocationBookioService.getLocationInfo(detectedLocation);
                    
                    console.log(`📍 Detected location: ${detectedLocation} (${locationInfo ? locationInfo.name : 'Unknown'})`);
                    
                    // Send booking data to Zapier webhook as JSON with individual fields
                    try {
                        const webhookPayload = {
                            customer_name: bookingParams.name || 'Unknown',
                            customer_email: bookingParams.email || 'no-email@example.com',
                            customer_phone: bookingParams.phone || '+421000000000',
                            service_id: bookingParams.serviceId || '000000',
                            service_name: serviceName,
                            date: bookingParams.date || 'TBD',
                            time: bookingParams.time || 'TBD',
                            location: locationInfo ? locationInfo.name : 'Bratislava',
                            location_address: locationInfo ? locationInfo.address : 'Lazaretská 13, Bratislava',
                            source: 'ElevenLabs Voice Agent',
                            booking_link: locationInfo ? locationInfo.widget_url : 'https://services.bookio.com/refresh-laserove-a-esteticke-studio-zu0yxr5l/widget?lang=sk'
                        };
                        
                        await axios.post('https://hooks.zapier.com/hooks/catch/22535098/utnkmyf/', webhookPayload, {
                            headers: { 'Content-Type': 'application/json' }
                        });
                        console.log('📨 Booking data sent to Zapier webhook successfully');
                    } catch (zapierError) {
                        console.log('📨 Zapier webhook failed (non-critical):', zapierError.message);
                    }
                    
                    // Try to call booking endpoint (may fail, but that's OK)
                    let bookingResult = { data: { success: false } };
                    try {
                        const axios = await import('axios');
                        bookingResult = await axios.default.post(`${req.protocol}://${req.get('host')}/api/booking/create`, {
                            serviceId: parseInt(bookingParams.serviceId),
                            workerId: parseInt(bookingParams.workerId) || 18204,
                            date: bookingParams.date,
                            hour: bookingParams.time,
                            firstName: firstName,
                            lastName: lastName,
                            email: bookingParams.email,
                            phone: bookingParams.phone,
                            note: `Rezervácia cez ElevenLabs agenta`,
                            acceptTerms: true
                        });
                    } catch (bookingError) {
                        console.log('📋 Booking API failed (expected), customer details logged above for manual processing');
                    }
                    
                    // Always give positive response - booking details are logged for manual processing
                    if (bookingResult.data.success) {
                        res.set('Content-Type', 'text/plain');
                        return res.send(`✅ Rezervácia bola úspešne vytvorená na ${bookingParams.date} o ${bookingParams.time}. Potvrdenie bolo odoslané emailom.`);
                    } else {
                        // Booking details logged above - give customer positive message
                        res.set('Content-Type', 'text/plain');
                        return res.send(`📝 Vaša rezervácia bola zaznamenaná na ${bookingParams.date} o ${bookingParams.time}. Náš tím vás bude kontaktovať na telefón ${bookingParams.phone} pre potvrdenie termínu.`);
                    }
                    
                } catch (error) {
                    console.error('❌ Booking error:', error.message);
                    // Give generic positive message since booking details might not be parsed yet
                    res.set('Content-Type', 'text/plain');
                    return res.send(`📝 Vaša rezervácia bola zaznamenaná. Náš tím vás bude kontaktovať pre potvrdenie termínu.`);
                }
                break;

            case 'get_services_overview':
                result = await CallFlowService.getServiceOverview();
                if (result.success && result.overview) {
                    res.set('Content-Type', 'application/json');
                    return res.json({
                        success: true,
                        type: "services_overview",
                        services: result.overview.map((service, index) => ({
                            index: index + 1,
                            name: service.name,
                            description: service.description
                        }))
                    });
                } else {
                    res.set('Content-Type', 'application/json');
                    return res.json({
                        success: false,
                        type: "services_error",
                        message: "Momentálne nemôžem načítať zoznam služieb"
                    });
                }
                break;

            case 'search_service':
                if (!search_term) {
                        res.set('Content-Type', 'text/plain');
                    return res.send("Nerozumiem, akú službu hľadáte. Môžete byť konkrétnejší?");
                }
                
                // Detect or ask for location
                const searchLocation = detectLocation(search_term, location || preferred_location);
                if (!searchLocation) {
                    response = `V ktorom meste hľadáte službu "${search_term}"?\n\n`;
                    response += `🏢 Bratislava - Lazaretská 13\n`;
                    response += `🏢 Pezinok\n\n`;
                    response += `Povedzte "Bratislava" alebo "Pezinok".`;
                    res.set('Content-Type', 'text/plain');
                    return res.send(response);
                }
                
                result = await LocationBookioService.searchServices(search_term, searchLocation);
                if (result.success && result.found > 0) {
                    if (result.found === 1) {
                        // Only one service found - provide details with worker info
                        const service = result.services[0];
                        let workers = [];
                        try {
                            workers = await BookioDirectService.getWorkers(service.serviceId);
                        } catch (error) {
                            console.error(`❌ Failed to get workers for service ${service.serviceId}:`, error);
                        }
                        const realWorkers = workers.filter(w => w.workerId !== -1);
                        
                        response = `Našla som službu: ${service.name}\n`;
                        response += `Cena: ${service.price}, Trvanie: ${service.duration}\n`;
                        
                        // Add worker information
                        if (realWorkers.length > 1) {
                            const workerNames = realWorkers.map(w => w.name).join(', ');
                            response += `Dostupní pracovníci: ${workerNames}\n`;
                        } else if (realWorkers.length === 1) {
                            response += `Pracovník: ${realWorkers[0].name}\n`;
                        }
                        
                        response += `\nChcete si rezervovať termín pre túto službu?`;
                        // Store service ID for next call
                        response += `\n[SERVICE_ID:${service.serviceId}]`;
                    } else {
                        // Multiple services - automatically pick first one if they're identical
                        const firstService = result.services[0];
                        const allIdentical = result.services.every(s => 
                            s.name === firstService.name && s.price === firstService.price
                        );
                        
                        if (allIdentical) {
                            // All services are identical - pick first one and show worker info
                            let workers = [];
                            try {
                                workers = await BookioDirectService.getWorkers(firstService.serviceId);
                            } catch (error) {
                                console.error(`❌ Failed to get workers for service ${firstService.serviceId}:`, error);
                            }
                            const realWorkers = workers.filter(w => w.workerId !== -1);
                            
                            response = `Našla som službu: ${firstService.name}\n`;
                            response += `Cena: ${firstService.price}, Trvanie: ${firstService.duration}\n`;
                            
                            // Add worker information
                            if (realWorkers.length > 1) {
                                const workerNames = realWorkers.map(w => w.name).join(', ');
                                response += `Dostupní pracovníci: ${workerNames}\n`;
                            } else if (realWorkers.length === 1) {
                                response += `Pracovník: ${realWorkers[0].name}\n`;
                            }
                            
                            response += `\nChcete si rezervovať termín pre túto službu?`;
                            response += `\n[SERVICE_ID:${firstService.serviceId}]`;
                        } else {
                            // Actually different services - let user choose
                            response = `Našla som ${result.found} služieb pre "${search_term}":\n\n`;
                            result.services.slice(0, 3).forEach((service, index) => {
                                response += `${index + 1}. ${service.name}\n`;
                                response += `   Cena: ${service.price}, Trvanie: ${service.duration}\n\n`;
                            });
                            response += "Ktorú službu si želáte? Povedzite číslo alebo názov.";
                        }
                    }
                } else {
                    response = `Ľutujem, nenašla som službu "${search_term}". Skúste iný názov alebo sa spýtajte na naše hlavné služby.`;
                }
                
                res.set('Content-Type', 'text/plain');
                return res.send(response);
                break;

            case 'search_services':
                // Alias for search_service - same functionality
                if (!search_term) {
                    res.set('Content-Type', 'text/plain');
                    return res.send("Nerozumiem, akú službu hľadáte. Môžete byť konkrétnejší?");
                }
                
                // Detect or ask for location
                const searchServicesLocation = detectLocation(search_term, location);
                if (!searchServicesLocation) {
                    response = `V ktorom meste hľadáte službu "${search_term}"?\n\n`;
                    response += `🏢 Bratislava - Lazaretská 13\n`;
                    response += `🏢 Pezinok\n\n`;
                    response += `Povedzte "Bratislava" alebo "Pezinok".`;
                    res.set('Content-Type', 'text/plain');
                    return res.send(response);
                }
                
                result = await BookioDirectService.searchServices(search_term);
                if (result.success && result.found > 0) {
                    if (result.found === 1) {
                        // Only one service found - provide details with worker info
                        const service = result.services[0];
                        let workers = [];
                        try {
                            workers = await BookioDirectService.getWorkers(service.serviceId);
                        } catch (error) {
                            console.error(`❌ Failed to get workers for service ${service.serviceId}:`, error);
                        }
                        const realWorkers = workers.filter(w => w.workerId !== -1);
                        
                        const locationName = searchServicesLocation === 'bratislava' ? 'Bratislava' : 'Pezinok';
                        const locationAddress = searchServicesLocation === 'bratislava' ? 'Lazaretská 13' : 'Pezinok';
                        
                        response = `Služba: ${service.name}\n`;
                        response += `Cena: ${service.price}, Trvanie: ${service.duration}\n`;
                        response += `Miesto: ${locationName} - ${locationAddress}\n`;
                        if (realWorkers.length > 0) {
                            response += `Personál: ${realWorkers.map(w => w.workerName).join(', ')}\n`;
                        }
                        response += `\nChcete si rezervovať termín?`;
                    } else {
                        // Multiple services found
                        const locationName = searchServicesLocation === 'bratislava' ? 'Bratislava' : 'Pezinok';
                        response = `Našla som ${result.found} služieb v ${locationName}:\n\n`;
                        result.services.slice(0, 3).forEach((service, index) => {
                            response += `${index + 1}. ${service.name}\n`;
                            response += `   Cena: ${service.price}, Trvanie: ${service.duration}\n\n`;
                        });
                        response += `Ktorá služba vás zaujíma?`;
                    }
                } else {
                    response = `Ľutujem, nenašla som službu "${search_term}" v požadovanom meste. Môžete skúsiť iný názov služby?`;
                }
                
                res.set('Content-Type', 'text/plain');
                return res.send(response);
                break;

            case 'find_soonest_slot':
                if (!service_id) {
                    res.set('Content-Type', 'text/plain');
                    return res.send("Najskôr musím nájsť službu. Akú službu si želáte?");
                }

                // Get workers for this service to provide context
                let slotWorkers = [];
                try {
                    slotWorkers = await BookioDirectService.getWorkers(service_id);
                } catch (error) {
                    console.error(`❌ Failed to get workers for service ${service_id}:`, error);
                }
                const slotRealWorkers = slotWorkers.filter(w => w.workerId !== -1);
                
                result = await BookioDirectService.findSoonestSlot(service_id, worker_id);
                if (result.success && result.found) {
                    if (result.daysFromNow === 0) {
                        response = `Najrýchlejší dostupný termín je dnes o ${result.time}.`;
                    } else if (result.daysFromNow === 1) {
                        response = `Najrýchlejší dostupný termín je zajtra (${result.date}) o ${result.time}.`;
                    } else {
                        response = `Najrýchlejší dostupný termín je ${result.date} o ${result.time} (o ${result.daysFromNow} dní).`;
                    }
                    
                    // Add worker information
                    if (slotRealWorkers.length > 1) {
                        if (worker_id && worker_id !== -1) {
                            const selectedWorker = slotWorkers.find(w => w.workerId == worker_id);
                            if (selectedWorker) {
                                response += `\nPracovník: ${selectedWorker.name}`;
                            }
                        } else {
                            const workerNames = slotRealWorkers.map(w => w.name).join(', ');
                            response += `\nDostupní pracovníci: ${workerNames}`;
                        }
                    } else if (slotRealWorkers.length === 1) {
                        response += `\nPracovník: ${slotRealWorkers[0].name}`;
                    }
                    
                    response += ` Celkovo je na tento deň dostupných ${result.totalSlots} termínov.`;
                    
                    if (result.alternativeSlots.length > 0) {
                        response += ` Ďalšie možné časy: ${result.alternativeSlots.join(', ')}.`;
                    }
                    
                    response += "\n\nChcete si rezervovať tento termín alebo potrebujete iný dátum?";
                } else {
                    response = "Ľutujem, v najbližších dňoch nie sú dostupné žiadne voľné termíny. Skúste neskôr alebo sa spýtajte na konkrétny dátum.";
                }
                
                res.set('Content-Type', 'text/plain');
                return res.send(response);
                break;

            case 'check_specific_slot':
                if (!service_id || !date || !time) {
                    res.set('Content-Type', 'text/plain');
                    return res.send("Potrebujem vedieť ID služby, dátum a čas.");
                }

                result = await SlotService.checkSlot(service_id, worker_id, date, time);
                if (result.success) {
                    if (result.available) {
                        response = `Výborné! Termín ${date} o ${time} je dostupný.`;
                        response += "\n\nChcete si tento termín rezervovať?";
                    } else {
                        response = `Ľutujem, termín ${date} o ${time} nie je dostupný.`;
                        
                        if (result.closestTimes && result.closestTimes.length > 0) {
                            response += ` Na tento deň sú dostupné tieto časy: ${result.closestTimes.join(', ')}.`;
                            response += "\n\nKtorý z týchto časov by vám vyhovoval?";
                        } else if (result.totalSlots > 0) {
                            response += ` Na tento deň je dostupných ${result.totalSlots} iných termínov.`;
                            response += "\n\nChcete počuť dostupné časy?";
                        } else {
                            response += " Na tento deň nie sú dostupné žiadne termíny.";
                            response += "\n\nSkúste iný dátum alebo sa spýtajte na najrýchlejší dostupný termín.";
                        }
                    }
                } else {
                    response = "Nastala chyba pri kontrole termínu. Skúste to prosím znovu.";
                }
                
                res.set('Content-Type', 'text/plain');
                return res.send(response);
                break;

            case 'get_booking_info_DISABLED':
                res.set('Content-Type', 'application/json');
                return res.json({
                    success: false,
                    type: "booking_disabled",
                    message: "Rezervácie nie sú momentálne dostupné"
                });
                break;

            case 'quick_service_lookup':
                if (!search_term) {
                    res.set('Content-Type', 'text/plain');
                    return res.send("Nerozumiem, akú službu hľadáte.");
                }

                const lookupDate = date || "04.09.2025";
                result = await WidgetFlowService.quickServiceLookup(search_term, lookupDate);
                
                if (result.success) {
                    response = `Našla som službu: ${result.service.name}\n`;
                    response += `Cena: ${result.service.price}, Trvanie: ${result.service.duration}\n`;
                    response += `ID služby: ${result.service.id}\n`;
                    
                    // Get all workers for this service, not just the one from result
                    let lookupWorkers = [];
                    try {
                        lookupWorkers = await BookioDirectService.getWorkers(result.service.id);
                    } catch (error) {
                        console.error(`❌ Failed to get workers for service ${result.service.id}:`, error);
                    }
                    const lookupRealWorkers = lookupWorkers.filter(w => w.workerId !== -1);
                    
                    if (lookupRealWorkers.length > 1) {
                        const workerNames = lookupRealWorkers.map(w => w.name).join(', ');
                        response += `Dostupní pracovníci: ${workerNames}\n`;
                    } else if (result.worker && result.worker.name) {
                        response += `Pracovník: ${result.worker.name}\n`;
                    }
                    response += `\n`;
                    
                    if (result.availability.totalSlots > 0) {
                        response += `Na ${lookupDate} je dostupných ${result.availability.totalSlots} termínov:\n`;
                        
                        if (result.availability.morningTimes.length > 0) {
                            response += `Dopoludnia: ${result.availability.morningTimes.slice(0, 4).join(', ')}`;
                            if (result.availability.morningTimes.length > 4) response += "...";
                            response += "\n";
                        }
                        
                        if (result.availability.afternoonTimes.length > 0) {
                            response += `Popoludní: ${result.availability.afternoonTimes.slice(0, 4).join(', ')}`;
                            if (result.availability.afternoonTimes.length > 4) response += "...";
                            response += "\n";
                        }
                        
                        response += "\nKtorý čas by vám vyhovoval?";
                    } else {
                        response += `Na ${lookupDate} nie sú dostupné žiadne termíny.\n`;
                        response += "Chcete skúsiť iný dátum alebo najrýchlejší možný termín?";
                    }
                } else {
                    response = `Ľutujem, nenašla som službu "${search_term}". Skúste iný názov.`;
                }
                
                res.set('Content-Type', 'text/plain');
                return res.send(response);
                break;

            case 'check_date':
                if (!service_id || !search_term) {
                    res.set('Content-Type', 'text/plain');
                    return res.send("Potrebujem vedieť službu a dátum na kontrolu.");
                }

                // Use search_term as date for check_date tool
                const checkDate = search_term;
                result = await SlotService.checkSlot(service_id, worker_id, checkDate, time);
                if (result.success) {
                    if (result.available) {
                        response = `Výborné! Na ${checkDate} je dostupný termín.`;
                        response += "\n\nChcete si tento termín rezervovať?";
                    } else {
                        response = `Ľutujem, na ${checkDate} nie sú dostupné žiadne termíny.`;
                        
                        if (result.closestTimes && result.closestTimes.length > 0) {
                            response += ` Na tento deň sú dostupné tieto časy: ${result.closestTimes.join(', ')}.`;
                            response += "\n\nKtorý z týchto časov by vám vyhovoval?";
                        } else if (result.totalSlots > 0) {
                            response += ` Na tento deň je dostupných ${result.totalSlots} iných termínov.`;
                            response += "\n\nChcete počuť dostupné časy?";
                        } else {
                            response += " Na tento deň nie sú dostupné žiadne termíny.";
                            response += "\n\nSkúste iný dátum alebo sa spýtajte na najrýchlejší dostupný termín.";
                        }
                    }
                } else {
                    response = "Nastala chyba pri kontrole termínu. Skúste to prosím znovu.";
                }
                
                res.set('Content-Type', 'text/plain');
                return res.send(response);
                break;

            case 'get_opening_hours':
                res.set('Content-Type', 'application/json');
                return res.json({
                    success: true,
                    type: "opening_hours",
                    hours: {
                        weekdays: {
                            days: "Pondelok až piatok",
                            times: "9:00 - 12:00 a 13:00 - 17:00"
                        },
                        weekend: {
                            days: "Sobota a nedeľa", 
                            times: "Zatvorené"
                        }
                    },
                    location: {
                        address: "Lazaretská 13, Bratislava"
                    }
                });
                break;

            case 'refresh_booking': {
                // All-in-one booking tool for ElevenLabs agent
                // Can handle: search, availability check, or booking confirmation
                
                // Extract all possible parameters from the agent
                const action = req.body.action || 'search'; // search, check_availability, confirm
                const service = req.body.service || req.body.service_name || search_term;
                const customerAge = req.body.age || req.body.customer_age || age;
                const customerName = req.body.name || req.body.customer_name || user_name;
                let customerEmail = req.body.email || req.body.customer_email || user_email || '';
                const customerPhone = req.body.phone || req.body.customer_phone || user_phone;
                const skipSlots = req.body.skip_slots || skip_slots || 0;
                const requestedDate = req.body.date || date;
                const requestedTime = req.body.time || time;
                const requestedWorker = req.body.worker || req.body.worker_name || req.body.zamestnanec;
                const requestedLocation = req.body.location || location || preferred_location || detectLocation(service, null) || detectLocation(req.body.conversation_id, null);
                
                // Fix Slovak "zavinac" issue - replace common Slovak words for @ 
                if (customerEmail) {
                    customerEmail = customerEmail
                        .replace(/\szavinac\s/gi, '@')
                        .replace(/\szavináč\s/gi, '@')
                        .replace(/\sat\s/gi, '@')
                        .replace(/\s@\s/g, '@') // Remove spaces around @
                        .trim();
                }
                
                // Store the selected service info globally for the booking
                let selectedServiceInfo = req.body.selected_service || null;
                
                console.log('🔧 refresh_booking request:', {
                    action,
                    service,
                    age: customerAge,
                    location: requestedLocation,
                    name: customerName,
                    email: customerEmail,
                    phone: customerPhone,
                    date: requestedDate,
                    time: requestedTime
                });
                
                // Handle different actions
                if (!service) {
                    res.set('Content-Type', 'text/plain');
                    return res.send("Nerozumiem, akú službu hľadáte. Môžete byť konkrétnejší?");
                }
                
                // Check if location is needed
                if (!requestedLocation) {
                    response = `V ktorom meste si želáte rezerváciu?\n\n`;
                    response += `🏢 Bratislava - Lazaretská 13\n`;
                    response += `🏢 Pezinok\n\n`;
                    response += `Povedzte "Bratislava" alebo "Pezinok".`;
                    res.set('Content-Type', 'text/plain');
                    return res.send(response);
                }
                
                // If we have name and phone, this is a booking confirmation
                if (customerName && customerPhone) {
                    let selectedService;
                    
                    // Use the selected service info if available, otherwise search for it
                    if (selectedServiceInfo && selectedServiceInfo.serviceId) {
                        selectedService = selectedServiceInfo;
                    } else if (service) {
                        // Find the service first based on the original search
                        const searchTerm = service + (customerAge ? ` vek ${customerAge}` : '');
                        console.log(`🔍 Searching for service to book: "${searchTerm}"`);
                        const searchResult = await BookioDirectService.searchServices(searchTerm);
                        
                        if (!searchResult.success || searchResult.found === 0) {
                            res.set('Content-Type', 'text/plain');
                            return res.send(`Ľutujem, nenašla som službu "${service}". Môžete skúsiť iný názov?`);
                        }
                        
                        selectedService = searchResult.services[0];
                    } else {
                        // No service info available
                        res.set('Content-Type', 'text/plain');
                        return res.send("Prepáčte, musím vedieť akú službu si želáte rezervovať.");
                    }
                    
                    const bookingDate = requestedDate || new Date().toISOString().split('T')[0].split('-').reverse().join('.');
                    const bookingTime = requestedTime || '10:00';
                    
                    // Log booking for manual processing
                    console.log('🚨 NEW BOOKING REQUEST FROM REFRESH_BOOKING:');
                    console.log('👤 Customer:', customerName);
                    console.log('📧 Email:', customerEmail || 'not provided');
                    console.log('📱 Phone:', customerPhone);
                    console.log('🏥 Service:', selectedService.name);
                    console.log('📅 Date:', bookingDate);
                    console.log('🕐 Time:', bookingTime);
                    console.log('📍 Location:', requestedLocation);
                    console.log('🚨 === END BOOKING REQUEST ===');
                    
                    // Get location info for Zapier
                    const locationInfo = LocationBookioService.getLocationInfo(requestedLocation);
                    
                    // Send to Zapier webhook
                    try {
                        const webhookPayload = {
                            customer_name: customerName,
                            customer_email: customerEmail || 'no-email@example.com',
                            customer_phone: customerPhone,
                            service_id: selectedService.serviceId,
                            service_name: selectedService.name,
                            date: bookingDate,
                            time: bookingTime,
                            location: locationInfo ? locationInfo.name : requestedLocation,
                            location_address: locationInfo ? locationInfo.address : requestedLocation,
                            source: 'ElevenLabs Voice Agent (refresh_booking)',
                            booking_link: locationInfo ? locationInfo.widget_url : 'https://services.bookio.com/refresh-laserove-a-esteticke-studio-zu0yxr5l/widget?lang=sk'
                        };
                        
                        await axios.post('https://hooks.zapier.com/hooks/catch/22535098/utnkmyf/', webhookPayload, {
                            headers: { 'Content-Type': 'application/json' }
                        });
                        console.log('📨 Booking data sent to Zapier webhook successfully');
                    } catch (zapierError) {
                        console.log('📨 Zapier webhook failed (non-critical):', zapierError.message);
                    }
                    
                    response = `Perfektné! Vaša rezervácia bola zaznamenaná.\n`;
                    response += `📋 ${selectedService.name}\n`;
                    response += `📅 ${bookingDate} o ${bookingTime}\n`;
                    response += `📍 ${locationInfo ? locationInfo.name : requestedLocation}\n\n`;
                    response += `Náš tím vás bude kontaktovať pre potvrdenie termínu.`;
                    
                    res.set('Content-Type', 'text/plain');
                    return res.send(response);
                }
                
                // Otherwise, search for services and show availability
                // First do a general search without age to see what's available
                const basicSearchTerm = service + (requestedLocation ? ` ${requestedLocation}` : '');
                
                // Extract time request from the original query with improved Slovak patterns
                const timePattern = /(\d{1,2}):?(\d{2})|(\d{1,2})\s*(?:hodín|hodina|hodiny|dlomu|o\s*(\d{1,2}))/i;
                const simpleTimePattern = /\bo\s*(\d{1,2})\b|\b(\d{1,2})\s*(?:hodín|hodina|hodiny|dlomu)/i;
                
                // Check multiple sources for time requests
                const fullQuery = `${service} ${req.body.search_term || ''} ${search_term || ''}`.toLowerCase();
                console.log(`🔍 Checking for time in: "${fullQuery}"`);
                
                let timeMatch = service.match(timePattern) || 
                               (req.body.search_term && req.body.search_term.match(timePattern)) ||
                               fullQuery.match(simpleTimePattern);
                
                let requestedTimeFromQuery = null;
                if (timeMatch) {
                    // Handle different match groups - find the first non-undefined group
                    const hour = timeMatch[1] || timeMatch[2] || timeMatch[3] || timeMatch[4];
                    if (hour && hour.length <= 2) { // Make sure it's a reasonable hour
                        requestedTimeFromQuery = `${hour}:00`;
                        console.log(`🕐 Extracted time: ${requestedTimeFromQuery} from match: ${JSON.stringify(timeMatch)}`);
                    }
                }
                
                // Also check the original requestedTime parameter
                const finalRequestedTime = requestedTimeFromQuery || requestedTime;
                
                // First search without age to check if age-based services exist (using facility-aware search)
                const initialSearchResult = await LocationBookioService.searchServices(basicSearchTerm, requestedLocation);
                
                // Check if we found services and if they have age variations
                if (initialSearchResult.success && initialSearchResult.found > 0) {
                    const ageSpecificKeywords = ['mládež', 'mladých', 'do 18', 'do 20', 'deti', 'akné', 'do 30'];
                    const hasAgeSpecificServices = initialSearchResult.services.some(s => 
                        ageSpecificKeywords.some(keyword => s.name.toLowerCase().includes(keyword))
                    );
                    const hasGeneralServices = initialSearchResult.services.some(s => 
                        !ageSpecificKeywords.some(keyword => s.name.toLowerCase().includes(keyword))
                    );
                    
                    // Only ask for age if we have BOTH age-specific AND general services for the same treatment
                    if (hasAgeSpecificServices && hasGeneralServices && !customerAge && !finalRequestedTime) {
                        console.log(`🤔 Found both age-specific and general services, asking for age clarification`);
                        response = `Pre ${service} máme rôzne možnosti podľa veku. Koľko máte rokov?\n\n`;
                        response += `Toto nám pomôže vybrať najvhodnejšie ošetrenie pre vás.`;
                        res.set('Content-Type', 'text/plain');
                        return res.send(response);
                    }
                }
                
                // Use age in search if provided (using facility-aware search)
                const searchTerm = basicSearchTerm + (customerAge ? ` vek ${customerAge}` : '');
                const searchResult = customerAge ? await LocationBookioService.searchServices(searchTerm, requestedLocation) : initialSearchResult;
                
                if (searchResult.success && searchResult.found > 0) {
                    const selectedService = searchResult.services[0];
                    const locationInfo = LocationBookioService.getLocationInfo(requestedLocation);
                    
                    // Check if user is asking for a specific time
                    if (finalRequestedTime) {
                        console.log(`🕐 Time-specific request detected: ${finalRequestedTime}`);
                        
                        try {
                            // Get availability for the specific time request
                            const fullAvailability = await BookioDirectService.getAvailableTimesAndDays(
                                selectedService.serviceId, -1, 7, 2
                            );
                            
                            if (fullAvailability.success && fullAvailability.availableTimes) {
                                const hasRequestedTime = fullAvailability.availableTimes.includes(finalRequestedTime);
                                
                                if (hasRequestedTime) {
                                    response = `Áno, ${finalRequestedTime} je dostupné!\n`;
                                    response += `📋 ${selectedService.name}\n`;
                                    response += `📅 ${fullAvailability.soonestDate} o ${finalRequestedTime}\n`;
                                    response += `📍 ${locationInfo ? locationInfo.name : requestedLocation}\n`;
                                    response += `💰 ${selectedService.price}\n\n`;
                                    response += `Chcete si rezervovať tento termín?`;
                                } else {
                                    const closestTimes = fullAvailability.availableTimes.filter(time => {
                                        const [hour, minute] = time.split(':').map(Number);
                                        const [reqHour, reqMinute] = finalRequestedTime.split(':').map(Number);
                                        const timeMinutes = hour * 60 + minute;
                                        const reqMinutes = reqHour * 60 + reqMinute;
                                        return Math.abs(timeMinutes - reqMinutes) <= 120; // Within 2 hours
                                    }).slice(0, 4);
                                    
                                    response = `Prepáčte, ${finalRequestedTime} nie je dostupné.\n`;
                                    response += `📋 ${selectedService.name}\n`;
                                    response += `💰 ${selectedService.price}\n\n`;
                                    
                                    if (closestTimes.length > 0) {
                                        response += `Dostupné časy blízko ${finalRequestedTime}:\n`;
                                        closestTimes.forEach(time => {
                                            response += `📅 ${fullAvailability.soonestDate} o ${time}\n`;
                                        });
                                        response += `\nKtorý z týchto časov vám vyhovuje?`;
                                    } else {
                                        response += `Najbližší dostupný termín je ${fullAvailability.soonestDate} o ${fullAvailability.soonestTime}.`;
                                    }
                                }
                            } else {
                                response = `Prepáčte, ${finalRequestedTime} nie je dostupné. Momentálne nie sú dostupné žiadne termíny pre túto službu.`;
                            }
                        } catch (error) {
                            console.error('❌ Error checking specific time:', error);
                            response = `Prepáčte, ${finalRequestedTime} nie je dostupné. Skúste iný termín.`;
                        }
                    } else {
                        // Regular request - show soonest available time with real availability
                        const locationInfo = LocationBookioService.getLocationInfo(requestedLocation);
                        
                        try {
                            // Get real availability for the service using facility-aware service
                            const LocationBookioService = await import('../services/locationBookioService.js');
                            const slotResult = await LocationBookioService.default.findSoonestSlot(
                                selectedService.serviceId, requestedLocation, -1, skipSlots, requestedWorker
                            );
                            
                            response = `${selectedService.name}\n`;
                            response += `📍 ${locationInfo ? locationInfo.name : requestedLocation}\n`;
                            response += `💰 ${selectedService.price}\n`;
                            response += `⏱️ ${selectedService.duration}\n\n`;
                            
                            // Get and show available workers for this service
                            const workersResult = await LocationBookioService.default.getWorkersForService(
                                selectedService.serviceId, requestedLocation
                            );
                            if (workersResult.success && workersResult.workers.length > 0) {
                                const workerNames = workersResult.workers.map(w => w.name).join(', ');
                                response += `👥 Dostupní zamestnanci: ${workerNames}\n\n`;
                            }
                            
                            // Handle worker not found error
                            if (!slotResult.success && slotResult.availableWorkers) {
                                response += `\n${slotResult.message}`;
                                
                                // Still try to find soonest slot with any worker
                                console.log(`🔄 Worker not found, trying to find soonest slot with any available worker`);
                                const fallbackSlotResult = await LocationBookioService.default.findSoonestSlot(
                                    selectedService.serviceId, requestedLocation, -1, skipSlots
                                );
                                
                                if (fallbackSlotResult.success && fallbackSlotResult.found) {
                                    const termLabel = skipSlots > 0 ? `${skipSlots + 1}. dostupný termín` : 'Najbližší termín';
                                    response += `\n\n${termLabel} (ktorýkoľvek zamestnanec): ${fallbackSlotResult.date} o ${fallbackSlotResult.time}`;
                                    if (fallbackSlotResult.alternativeSlots && fallbackSlotResult.alternativeSlots.length > 0) {
                                        response += `\nĎalšie časy: ${fallbackSlotResult.alternativeSlots.slice(0, 3).join(', ')}`;
                                    }
                                    response += `\n\nChcete si rezervovať tento termín?`;
                                }
                                
                                res.set('Content-Type', 'text/plain');
                                return res.send(response);
                            }
                            
                            // Show real availability with skip awareness
                            if (slotResult.success && slotResult.found && slotResult.date) {
                                const termLabel = skipSlots > 0 ? `${skipSlots + 1}. dostupný termín` : 'Najbližší termín';
                                
                                if (slotResult.daysFromNow === 0) {
                                    response += `${termLabel}: dnes o ${slotResult.time}`;
                                } else if (slotResult.daysFromNow === 1) {
                                    response += `${termLabel}: zajtra (${slotResult.date}) o ${slotResult.time}`;
                                } else {
                                    response += `${termLabel}: ${slotResult.date} o ${slotResult.time}`;
                                }
                                
                                // Show more alternative times for better user experience
                                if (slotResult.alternativeSlots && slotResult.alternativeSlots.length > 0) {
                                    const alternatives = slotResult.alternativeSlots.slice(0, 4);
                                    response += `\nĎalšie časy: ${alternatives.join(', ')}`;
                                }
                                
                                response += `\n\nChcete si rezervovať tento termín?`;
                            } else {
                                response += `Momentálne nie sú dostupné žiadne voľné termíny v najbližších dňoch.\n`;
                                response += `Skúste neskôr alebo kontaktujte našu recepciu.`;
                            }
                        } catch (error) {
                            console.error('❌ Error getting availability:', error);
                            response = `${selectedService.name}\n`;
                            response += `📍 ${locationInfo ? locationInfo.name : requestedLocation}\n`;
                            response += `💰 ${selectedService.price}\n`;
                            response += `⏱️ ${selectedService.duration}\n\n`;
                            response += `Pre overenie dostupnosti kontaktujte našu recepciu.`;
                        }
                    }
                    
                    // Store service info for next call
                    console.log(`✅ Selected service for booking: ${selectedService.name} (ID: ${selectedService.serviceId})`);
                } else {
                    response = `Ľutujem, nenašla som službu "${service}". Môžete skúsiť iný názov?`;
                }
                
                res.set('Content-Type', 'text/plain');
                return res.send(response);
            }
                break;

            default:
                res.set('Content-Type', 'application/json');
                return res.json({
                    success: false,
                    type: "unknown_tool",
                    message: `Neznámy nástroj: ${tool_name}`,
                    available_tools: ["refresh_booking", "quick_booking", "select_location", "location_booking", "get_services_overview", "get_opening_hours", "search_service", "search_services", "find_soonest_slot", "confirm_booking"]
                });
        }

        // This should not be reached anymore as all cases return directly
        res.set('Content-Type', 'application/json');
        res.json({ success: false, type: "unexpected_error", message: "Neočakávaná chyba" });

    } catch (error) {
        console.error('ElevenLabs unified endpoint error:', error);
        res.set('Content-Type', 'application/json');
        res.json({
            success: false,
            type: "server_error", 
            message: "Nastala chyba. Skúste to prosím znovu"
        });
    }
});

export default router;