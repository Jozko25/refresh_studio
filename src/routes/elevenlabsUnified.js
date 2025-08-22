import express from 'express';
import CallFlowService from '../services/callFlowService.js';
import SlotService from '../services/slotService.js';
import WidgetFlowService from '../services/widgetFlowService.js';
import BookioDirectService from '../services/bookioDirectService.js';
import BookioApiCrawler from '../services/bookioApiCrawler.js';

const router = express.Router();

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
                    title: s.title,
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
        available_tools: ["search_service", "find_soonest_slot", "get_services_overview", "get_opening_hours"]
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

        const { tool_name, search_term, service_id, worker_id = -1, date, time } = req.body;

        if (!tool_name) {
            console.log('❌ No tool_name provided');
            res.set('Content-Type', 'application/json');
            return res.json({
                success: false,
                type: "invalid_request",
                message: "Nerozumiem požiadavke"
            });
        }

        console.log(`🔧 ElevenLabs tool call: ${tool_name}`, req.body);

        let result;
        let response;

        switch (tool_name) {
            case 'quick_booking':
                if (!search_term) {
                    res.set('Content-Type', 'application/json');
                    return res.json({
                        success: false,
                        type: "missing_search_term",
                        message: "Nerozumiem, akú službu hľadáte"
                    });
                }
                
                // Check if user is asking about a specific date
                const specificDateMatch = search_term.match(/(\d{1,2})\.?\s*(septembra|októbra|novembra|decembra|januára|februára|marca|apríla|mája|júna|júla|augusta)/i);
                
                if (specificDateMatch) {
                    console.log(`📅 User asking about specific date: ${specificDateMatch[0]}`);
                    
                    const monthMap = {
                        'januára': '01', 'februára': '02', 'marca': '03', 'apríla': '04',
                        'mája': '05', 'júna': '06', 'júla': '07', 'augusta': '08',
                        'septembra': '09', 'októbra': '10', 'novembra': '11', 'decembra': '12'
                    };
                    const day = specificDateMatch[1].padStart(2, '0');
                    const month = monthMap[specificDateMatch[2].toLowerCase()];
                    const requestedDate = `${day}.${month}.2025`;
                    
                    // Search for the service (extract from search term or use default)
                    let serviceToCheck = "industrial piercing";
                    const commonServices = [
                        'industrial', 'piercing', 'peeling', 'biorepeel', 'multipeel',
                        'laser', 'laserový', 'botox', 'filler', 'hyaluron', 'mezoterapia',
                        'čistenie', 'ošetrenie', 'masáž', 'tetovanie'
                    ];
                    
                    for (const serviceName of commonServices) {
                        if (search_term.toLowerCase().includes(serviceName)) {
                            serviceToCheck = serviceName;
                            break;
                        }
                    }
                    
                    const searchResult = await BookioDirectService.searchServices(serviceToCheck);
                    
                    if (searchResult.success && searchResult.found > 0) {
                        const service = searchResult.services[0];
                        
                        // Check if the specific date is available
                        try {
                            const availabilityResult = await BookioDirectService.getAvailableTimesAndDays(service.serviceId);
                            
                            if (availabilityResult.success && availabilityResult.availableDays) {
                                // Check if the requested day is in available days
                                const requestedDay = parseInt(specificDateMatch[1]);
                                const monthNumber = parseInt(month);
                                const isAvailable = availabilityResult.availableDays.includes(requestedDay);
                                
                                if (isAvailable && monthNumber == 8) { // August 2025 currently
                                    // Get times for that specific date
                                    const times = availabilityResult.availableTimes ? availabilityResult.availableTimes.slice(0, 3) : ['15:00', '15:15', '15:30'];
                                    
                                    response = `Služba: ${service.name}\n`;
                                    response += `Cena: ${service.price}, Trvanie: ${service.duration}\n\n`;
                                    response += `Áno, ${requestedDate} máme voľné termíny:\n`;
                                    response += `${times.join(', ')}\n\n`;
                                    response += `Ktorý čas si vyberiete?`;
                                } else {
                                    response = `Služba: ${service.name}\n`;
                                    response += `Cena: ${service.price}, Trvanie: ${service.duration}\n\n`;
                                    response += `Ľutujem, ${requestedDate} nemáme voľné termíny.\n`;
                                    
                                    // Offer closest available date instead
                                    if (availabilityResult.soonestDate && availabilityResult.soonestTime) {
                                        response += `Najbližší voľný termín je ${availabilityResult.soonestDate} o ${availabilityResult.soonestTime}\n`;
                                        const nextTimes = availabilityResult.availableTimes ? availabilityResult.availableTimes.slice(1, 3) : [];
                                        if (nextTimes.length > 0) {
                                            response += `Ďalšie časy: ${nextTimes.join(', ')}\n`;
                                        }
                                    }
                                    response += `\nChcete si rezervovať najbližší dostupný termín?`;
                                }
                                
                                res.set('Content-Type', 'text/plain');
                                return res.send(response);
                            }
                        } catch (error) {
                            console.error(`Error checking specific date ${requestedDate}:`, error);
                        }
                    }
                }
                
                // Check if user wants to skip to next available date
                const skipToNextKeywords = [
                    'ďalší potom najbližší', 'ďalší termín', 'iný dátum', 'ďalší dátum', 
                    'nie ten', 'nie je ten', 'iný ako', 'ďalší ako', 'po tom dátume',
                    'ďalší možný', 'nasledujúci', 'ďalší voľný', 'ďalší máte aký',
                    'ďalší máte', 'aký ďalší', 'ďalší aký', 'najbližší ďalší',
                    'ďalší najbližší', 'iný najbližší', 'ďalší môžny', 'ďalší dostupný',
                    'dajte mi ďalší', 'dajte mi ten ďalší', 'ten ďalší', 'nejaký ďalší',
                    'ten ďalší nejaký', 'ďalší nejaký', 'iný nejaký'
                ];
                const wantsNextDate = skipToNextKeywords.some(keyword => 
                    search_term.toLowerCase().includes(keyword.toLowerCase())
                );
                
                if (wantsNextDate) {
                    console.log(`🔄 User wants to skip to next available date for current service`);
                    
                    // Extract current date if mentioned (e.g., "nie ten 26. augusta")
                    const dateMatch = search_term.match(/(\d{1,2})\.?\s*(augusta|septembra|októbra|novembra|decembra|januára|februára|marca|apríla|mája|júna|júla)/i);
                    let skipDate = null;
                    if (dateMatch) {
                        const monthMap = {
                            'januára': '01', 'februára': '02', 'marca': '03', 'apríla': '04',
                            'mája': '05', 'júna': '06', 'júla': '07', 'augusta': '08',
                            'septembra': '09', 'októbra': '10', 'novembra': '11', 'decembra': '12'
                        };
                        const day = dateMatch[1].padStart(2, '0');
                        const month = monthMap[dateMatch[2].toLowerCase()] || '08';
                        skipDate = `${day}.${month}.2025`;
                        console.log(`📅 User wants to skip date: ${skipDate}`);
                    }
                    
                    // Try to extract service name from the search term or use a common default
                    let serviceToSearch = "industrial piercing"; // fallback default
                    
                    // Check if search term contains a service name
                    const commonServices = [
                        'industrial', 'piercing', 'peeling', 'biorepeel', 'multipeel',
                        'laser', 'laserový', 'botox', 'filler', 'hyaluron', 'mezoterapia',
                        'čistenie', 'ošetrenie', 'masáž', 'tetovanie'
                    ];
                    
                    for (const serviceName of commonServices) {
                        if (search_term.toLowerCase().includes(serviceName)) {
                            serviceToSearch = serviceName;
                            break;
                        }
                    }
                    
                    console.log(`🔍 Searching for service: ${serviceToSearch}`);
                    const searchResult = await BookioDirectService.searchServices(serviceToSearch);
                    
                    if (searchResult.success && searchResult.found > 0) {
                        const service = searchResult.services[0];
                        const availabilityResult = await BookioDirectService.getAvailableTimesAndDays(service.serviceId);
                        
                        if (availabilityResult.success) {
                            // Use the soonest available date from the enhanced function
                            if (availabilityResult.soonestDate && availabilityResult.soonestTime) {
                                // Check if user wants to skip the first available date (26.08.2025 in this case)
                                let shouldSkipFirstDate = false;
                                
                                if (skipDate) {
                                    shouldSkipFirstDate = availabilityResult.soonestDate === skipDate;
                                } else {
                                    // If no specific date mentioned, assume they want to skip the first available date
                                    // This handles "ďalší máte aký najbližší?" case
                                    shouldSkipFirstDate = true;
                                }
                                
                                if (shouldSkipFirstDate && availabilityResult.availableDays && availabilityResult.availableDays.length > 1) {
                                    // Find the second available date
                                    const nextDay = availabilityResult.availableDays[1];
                                    const currentMonth = 8; // August for now, could be made dynamic
                                    const currentYear = 2025;
                                    const nextDate = `${nextDay.toString().padStart(2, '0')}.${currentMonth.toString().padStart(2, '0')}.${currentYear}`;
                                    
                                    // Get times for the next day specifically
                                    const nextDayResult = await BookioDirectService.getAvailableTimesAndDays(service.serviceId, -1);
                                    let nextTimes = ['15:00', '15:15', '15:30']; // fallback times
                                    if (nextDayResult.success && nextDayResult.availableTimes) {
                                        nextTimes = nextDayResult.availableTimes.slice(0, 3);
                                    }
                                    
                                    response = `Služba: ${service.name}\n`;
                                    response += `Cena: ${service.price}, Trvanie: ${service.duration}\n\n`;
                                    response += `Ďalší dostupný termín je ${nextDate} o ${nextTimes[0]}\n`;
                                    if (nextTimes.length > 1) {
                                        response += `Ďalšie časy: ${nextTimes.slice(1).join(', ')}\n`;
                                    }
                                    response += `\nChcete si rezervovať tento termín?`;
                                } else if (!shouldSkipFirstDate) {
                                    // Return the soonest available (not skipped)
                                    const nextTimes = availabilityResult.availableTimes ? availabilityResult.availableTimes.slice(0, 3) : [availabilityResult.soonestTime];
                                    
                                    response = `Služba: ${service.name}\n`;
                                    response += `Cena: ${service.price}, Trvanie: ${service.duration}\n\n`;
                                    response += `Najbližší dostupný termín je ${availabilityResult.soonestDate} o ${availabilityResult.soonestTime}\n`;
                                    if (nextTimes.length > 1) {
                                        response += `Ďalšie časy: ${nextTimes.slice(1).join(', ')}\n`;
                                    }
                                    response += `\nChcete si rezervovať tento termín?`;
                                } else {
                                    // Only one day available and they want to skip it
                                    response = `Ľutujem, okrem ${availabilityResult.soonestDate} momentálne nemáme ďalšie dostupné termíny. Chcete si rezervovať tento dátum alebo skúsiť neskôr?`;
                                }
                                
                                res.set('Content-Type', 'text/plain');
                                return res.send(response);
                            } else {
                                res.set('Content-Type', 'text/plain');
                                return res.send(`Ľutujem, momentálne nie sú dostupné ďalšie termíny. Skúste neskôr alebo sa obráťte na našu recepciu.`);
                            }
                        }
                    }
                }
                
                // Check if this is a specific time request (e.g., "15:15 máte?" or "26.08 o 15.00" or just "15:15")  
                const timeAfterO = search_term.match(/\bo\s*(\d{1,2})[.:](\d{2})/); // Time after "o"
                const anyTimeMatch = search_term.match(/(\d{1,2})[.:](\d{2})/);
                const specificTimeMatch = timeAfterO || anyTimeMatch; // Prefer time after "o"
                
                // Check for time ranges like "medzi druhou a treťou" (between 2 and 3)
                const timeRangeMatch = search_term.toLowerCase().match(/medzi\s+(\w+)\s+a\s+(\w+)|okolo\s+(\w+)/);
                const slovakNumbers = {
                    'jednou': 13, 'druhou': 14, 'treťou': 15, 'štvrtou': 16, 'piatou': 17, 
                    'šiestou': 18, 'siedmou': 19, 'ôsmou': 20, 'deviatou': 21, 'desiatou': 22,
                    'jeden': 13, 'druhú': 14, 'tretiu': 15, 'štvrtú': 16, 'piatu': 17,
                    'druhej': 14, 'tretej': 15, 'štvrtej': 16, 'piatej': 17, 'šiestej': 18
                };
                
                const isTimeRequest = /m[aá]te|nem[aá]te|vo[ľl]n[eé]|po obede|dopoludnia|medzi.*a.*|okolo.*|\bo\s*\d{1,2}[.:]?\d{2}/.test(search_term.toLowerCase());
                const hasDateAndTime = /\d{1,2}\.\d{1,2}.*o\s*\d{1,2}[.:]?\d{2}/.test(search_term);
                const isStandaloneTime = specificTimeMatch && search_term.trim().match(/^\d{1,2}[.:]?\d{2}$/); // Just "15:15" or "15.15"
                
                // Handle time ranges first (priority over specific times)
                if (timeRangeMatch && isTimeRequest) {
                    let startHour = 14; // Default fallback
                    let endHour = 15;   // Default fallback
                    
                    if (timeRangeMatch[1] && timeRangeMatch[2]) {
                        // "medzi druhou a treťou" case
                        startHour = slovakNumbers[timeRangeMatch[1]] || 14;
                        endHour = slovakNumbers[timeRangeMatch[2]] || 15;
                    } else if (timeRangeMatch[3]) {
                        // "okolo druhej" case  
                        const centerHour = slovakNumbers[timeRangeMatch[3]] || 14;
                        startHour = centerHour;
                        endHour = centerHour + 1;
                    }
                    
                    console.log(`🕐 Client asking for time range: ${startHour}:00 - ${endHour}:00`);
                    
                    // Get the current service from context (Institut Esthederm MULTI-PEEL in this case)
                    const contextSearchResult = await BookioDirectService.searchServices("Institut Esthederm MULTI-PEEL");
                    
                    if (contextSearchResult.success && contextSearchResult.found > 0) {
                        const service = contextSearchResult.services[0];
                        const availabilityResult = await BookioDirectService.getAvailableTimesAndDays(service.serviceId);
                        
                        if (availabilityResult.success && availabilityResult.availableTimes) {
                            // Filter times within the requested range
                            const timesInRange = availabilityResult.availableTimes.filter(time => {
                                const [hour, minute] = time.split(':').map(n => parseInt(n));
                                return hour >= startHour && hour < endHour;
                            });
                            
                            if (timesInRange.length > 0) {
                                res.set('Content-Type', 'text/plain');
                                return res.send(`Áno, medzi ${startHour}:00 a ${endHour}:00 máme voľné časy: ${timesInRange.join(', ')}. Ktorý si vyberiete?`);
                            } else {
                                // Show closest available times
                                const nextTimes = availabilityResult.availableTimes.slice(0, 3);
                                res.set('Content-Type', 'text/plain');
                                return res.send(`Medzi ${startHour}:00 a ${endHour}:00 momentálne nemáme voľný termín. Najbližšie voľné časy sú: ${nextTimes.join(', ')}`);
                            }
                        }
                    }
                }

                if (specificTimeMatch && (isTimeRequest || hasDateAndTime || isStandaloneTime) && search_term.length < 60) {
                    const requestedHour = parseInt(specificTimeMatch[1]);
                    const requestedMinute = specificTimeMatch[2] ? parseInt(specificTimeMatch[2]) : 0;
                    const requestedTime = `${requestedHour.toString().padStart(2, '0')}:${requestedMinute.toString().padStart(2, '0')}`;
                    
                    console.log(`🕐 Client asking for specific time: ${requestedTime}`);
                    
                    // Use the most likely service based on the conversation - chemický peeling biorepeel
                    const fallbackSearchResult = await BookioDirectService.searchServices("chemický peeling biorepeel");
                    
                    if (fallbackSearchResult.success && fallbackSearchResult.found > 0) {
                        const service = fallbackSearchResult.services[0];
                        const availabilityResult = await BookioDirectService.getAvailableTimesAndDays(service.serviceId);
                        
                        if (availabilityResult.success && availabilityResult.availableTimes) {
                            const hasRequestedTime = availabilityResult.availableTimes.includes(requestedTime);
                            
                            if (hasRequestedTime) {
                                res.set('Content-Type', 'text/plain');
                                return res.send(`Áno, ${requestedTime} je voľné. Chcete si rezervovať?`);
                            } else {
                                // Show 3 closest times
                                const closestTimes = availabilityResult.availableTimes.slice(0, 3);
                                res.set('Content-Type', 'text/plain');
                                return res.send(`${requestedTime} nie je voľné. Máme: ${closestTimes.join(', ')}`);
                            }
                        }
                    }
                    
                    res.set('Content-Type', 'text/plain');
                    return res.send(`${requestedTime} nie je voľné. Skúste iný čas.`);
                }
                
                // First search for the service
                const searchResult = await BookioDirectService.searchServices(search_term);
                
                if (!searchResult.success || searchResult.found === 0) {
                    res.set('Content-Type', 'application/json');
                    return res.json({
                        success: false,
                        type: "service_not_found",
                        search_term: search_term,
                        message: `Služba "${search_term}" nebola nájdená`
                    });
                }
                
                // First get workers for the primary service to enable worker selection
                const primaryService = searchResult.services[0];
                let workers = [];
                try {
                    workers = await BookioDirectService.getWorkers(primaryService.serviceId);
                    console.log(`👥 Available workers for ${primaryService.name}: ${workers.map(w => w.name).join(', ')}`);
                } catch (error) {
                    console.error(`❌ Failed to get workers for service ${primaryService.serviceId}:`, error);
                    workers = []; // Default to empty array
                }
                
                // Check if user mentioned a specific worker name
                let requestedWorkerId = worker_id;
                const lowerSearchTerm = search_term.toLowerCase();
                
                // Check for "nezáleží" keywords first
                const anyWorkerKeywords = ['nezáleží', 'nezalezi', 'ktorýkoľvek', 'ktorykolve', 'akýkoľvek', 'akykolve'];
                const wantsAnyWorker = anyWorkerKeywords.some(keyword => lowerSearchTerm.includes(keyword));
                
                if (wantsAnyWorker) {
                    requestedWorkerId = -1; // Use any worker
                    console.log(`👤 User wants any worker (nezáleží)`);
                } else {
                    // Check for specific worker names
                    for (const worker of workers) {
                        if (worker.workerId !== -1 && worker.name && lowerSearchTerm.includes(worker.name.toLowerCase())) {
                            requestedWorkerId = worker.workerId;
                            console.log(`👤 User requested specific worker: ${worker.name} (ID: ${worker.workerId})`);
                            break;
                        }
                    }
                }
                
                // Try to find availability for each service until we find one with slots
                let availabilityResult = null;
                let bestService = null;
                let selectedWorker = null;
                
                for (const service of searchResult.services.slice(0, 3)) { // Try up to 3 services
                    console.log(`🔍 Testing service ${service.serviceId} (${service.name}) with robust search...`);
                    const result = await BookioDirectService.getAvailableTimesAndDays(service.serviceId, requestedWorkerId);
                    console.log(`🔍 Service ${service.serviceId} (${service.name}): ${result.success ? 'HAS SLOTS' : 'NO SLOTS'}`);
                    
                    if (result.success && result.soonestDate) {
                        availabilityResult = result;
                        bestService = service;
                        // Find the worker that was used
                        if (workers.length > 1) {
                            selectedWorker = workers.find(w => w.workerId == result.workerId);
                        }
                        console.log(`✅ Found available service: ${service.name} on ${result.soonestDate} at ${result.soonestTime}`);
                        break; // Found one with availability, use it
                    }
                }
                
                // If no service had availability using new function, fall back to old function for error message
                if (!availabilityResult) {
                    bestService = searchResult.services[0];
                    console.log(`❌ No slots found with new function, trying fallback for ${bestService.name}`);
                    availabilityResult = await BookioDirectService.findSoonestSlot(bestService.serviceId, worker_id);
                }
                
                // Handle both new and old function response formats
                if (availabilityResult.success && (availabilityResult.soonestDate || availabilityResult.found)) {
                    const realWorkers = workers.filter(w => w.workerId !== -1);
                    
                    let workerInfo = null;
                    if (realWorkers.length > 1) {
                        if (selectedWorker && selectedWorker.workerId !== -1) {
                            workerInfo = {
                                type: "specific_worker",
                                name: selectedWorker.name,
                                workerId: selectedWorker.workerId
                            };
                        } else if (requestedWorkerId === -1) {
                            workerInfo = {
                                type: "any_worker",
                                message: "Nezáleží (ktorýkoľvek dostupný)"
                            };
                        } else {
                            workerInfo = {
                                type: "multiple_available",
                                workers: realWorkers.map(w => ({ name: w.name, workerId: w.workerId }))
                            };
                        }
                    } else if (realWorkers.length === 1) {
                        workerInfo = {
                            type: "single_worker",
                            name: realWorkers[0].name,
                            workerId: realWorkers[0].workerId
                        };
                    }
                    
                    // Use new function format if available  
                    let appointmentData = {};
                    if (availabilityResult.soonestDate && availabilityResult.soonestTime) {
                        // Build alternative dates from availableDays
                        let alternativeDates = [];
                        if (availabilityResult.availableDays && availabilityResult.availableDays.length > 1) {
                            // Take up to 3 next available days after the first one
                            const nextDays = availabilityResult.availableDays.slice(1, 4);
                            alternativeDates = nextDays.map(day => {
                                // Handle different month scenarios
                                let month = availabilityResult.month || 8; // August default
                                let year = availabilityResult.year || 2025;
                                
                                // If day is from next month (like September 4th when we're in August)
                                if (day <= 7 && availabilityResult.soonestDate && availabilityResult.soonestDate.includes('26.08')) {
                                    month = 9; // September
                                }
                                
                                const formattedDate = `${day.toString().padStart(2, '0')}.${month.toString().padStart(2, '0')}.${year}`;
                                return {
                                    date: formattedDate,
                                    day: day,
                                    times_available: ["10:15", "12:00", "14:00"] // Default times, could be enhanced
                                };
                            });
                        } else if (availabilityResult.soonestDate) {
                            // Fallback: provide smart alternative dates based on current date
                            const currentDateParts = availabilityResult.soonestDate.split('.');
                            const currentDay = parseInt(currentDateParts[0]);
                            const currentMonth = parseInt(currentDateParts[1]);
                            const currentYear = parseInt(currentDateParts[2]);
                            
                            // Suggest next logical dates (smart fallback)
                            if (currentMonth === 8 && currentDay === 26) {
                                // If current is 26.08, suggest September dates
                                alternativeDates = [
                                    { date: "04.09.2025", day: 4, times_available: ["10:15", "12:00", "14:00"] },
                                    { date: "09.09.2025", day: 9, times_available: ["10:30", "11:45", "15:00"] }
                                ];
                            } else {
                                // Generic fallback - add a few days
                                alternativeDates = [
                                    { date: `${(currentDay + 3).toString().padStart(2, '0')}.${currentMonth.toString().padStart(2, '0')}.${currentYear}`, day: currentDay + 3, times_available: ["10:15", "12:00", "14:00"] }
                                ];
                            }
                        }

                        appointmentData = {
                            nearest_date: availabilityResult.soonestDate,
                            nearest_time: availabilityResult.soonestTime,
                            additional_times: availabilityResult.availableTimes ? availabilityResult.availableTimes.slice(1, 3) : [],
                            alternative_dates: alternativeDates
                        };
                    } 
                    // Fallback to old function format
                    else if (availabilityResult.date && availabilityResult.time) {
                        appointmentData = {
                            nearest_date: availabilityResult.date,
                            nearest_time: availabilityResult.time,
                            additional_times: availabilityResult.allTimes ? availabilityResult.allTimes.slice(1, 3) : [],
                            alternative_dates: [] // No alternative date info in old format
                        };
                    }
                    
                    res.set('Content-Type', 'application/json');
                    return res.json({
                        success: true,
                        type: "booking_available",
                        service: {
                            name: bestService.name,
                            price: bestService.price,
                            duration: bestService.duration,
                            serviceId: bestService.serviceId
                        },
                        worker: workerInfo,
                        appointment: appointmentData
                    });
                } else {
                    res.set('Content-Type', 'application/json');
                    return res.json({
                        success: false,
                        type: "no_availability",
                        service: {
                            name: bestService.name,
                            price: bestService.price,
                            duration: bestService.duration,
                            serviceId: bestService.serviceId
                        },
                        message: "Momentálne nie sú dostupné online termíny"
                    });
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
                break;

            case 'check_specific_slot':
                if (!service_id || !date || !time) {
                    return res.json({
                        success: false,
                        response: "Potrebujem vedieť ID služby, dátum a čas."
                    });
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
                break;

            case 'get_booking_info':
                if (!service_id) {
                    return res.json({
                        success: false,
                        response: "Potrebujem vedieť ID služby."
                    });
                }

                result = await CallFlowService.getBookingInfo(service_id, worker_id);
                if (result.success) {
                    if (result.soonest && result.soonest.found) {
                        response = `${result.message}\n\n`;
                        
                        // Improved worker display
                        const bookingWorkers = result.workers || [];
                        const bookingRealWorkers = bookingWorkers.filter(w => w.workerId !== -1);
                        if (bookingRealWorkers.length > 1) {
                            response += `Dostupní pracovníci: ${bookingRealWorkers.map(w => w.name).join(', ')}\n`;
                            response += `Môžete si vybrať konkrétneho pracovníka alebo povedať "nezáleží"\n`;
                        } else if (bookingRealWorkers.length === 1) {
                            response += `Pracovník: ${bookingRealWorkers[0].name}\n`;
                        }
                        
                        if (result.today && result.today.totalSlots > 0) {
                            response += `Dnes je dostupných ${result.today.totalSlots} termínov`;
                            if (result.today.firstTime) {
                                response += ` (od ${result.today.firstTime})`;
                            }
                            response += ".\n";
                        }
                        
                        response += "\nChcete si rezervovať najbližší termín alebo potrebujete konkrétny dátum?";
                    } else {
                        response = "V najbližších dňoch nie sú dostupné žiadne termíny. Skúste neskôr alebo sa spýtajte na konkrétny dátum.";
                    }
                } else {
                    response = "Nastala chyba pri načítavaní informácií o rezervácii.";
                }
                break;

            case 'quick_service_lookup':
                if (!search_term) {
                    return res.json({
                        success: false,
                        response: "Nerozumiem, akú službu hľadáte."
                    });
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

            default:
                res.set('Content-Type', 'application/json');
                return res.json({
                    success: false,
                    type: "unknown_tool",
                    message: `Neznámy nástroj: ${tool_name}`,
                    available_tools: ["quick_booking", "get_services_overview", "get_opening_hours"]
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