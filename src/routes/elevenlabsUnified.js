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
        available_tools: ["quick_booking", "select_location", "location_booking", "search_service", "find_soonest_slot", "get_services_overview", "get_opening_hours"]
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

        let { tool_name, search_term, service_id, worker_id = -1, date, time, location } = req.body;

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
                const locationMatch = detectLocation(search_term);
                if (!locationMatch) {
                    res.set('Content-Type', 'text/plain');
                    return res.send("Nerozumiem lokáciu. Povedzte 'Bratislava' alebo 'Pezinok'.");
                }
                
                // Use proper search functionality that's already implemented
                const searchWords = search_term.toLowerCase().split(' ').filter(word => 
                    word.length > 2 && !['bratislava', 'pezinok'].includes(word)
                );
                
                console.log(`🔍 ElevenLabs searching for: "${searchWords.join(' ')}"`);
                
                // Search for the service using BookioDirectService
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
                    const service = searchResult.services[0];
                    console.log(`🎯 Using service:`, service);
                    
                    // Get real availability using the same method as the working booking endpoint
                    console.log(`🔍 Calling getAvailableTimesAndDays with serviceId: ${service.serviceId}, worker_id: ${worker_id || -1}`);
                    
                    let slotResult;
                    try {
                        slotResult = await BookioDirectService.getAvailableTimesAndDays(
                            service.serviceId,
                            worker_id || -1,
                            3 // Check up to 3 months ahead
                        );
                        
                        console.log(`⏰ Availability result:`, JSON.stringify(slotResult, null, 2));
                    } catch (error) {
                        console.error(`❌ Error calling getAvailableTimesAndDays:`, error);
                        slotResult = { success: false, error: error.message };
                    }
                    
                    response = `Služba: ${service.name}\n`;
                    response += `Cena: ${service.price}, Trvanie: ${service.duration}\n`;
                    response += `Miesto: ${locationMatch === 'bratislava' ? 'Bratislava - Lazaretská 13' : 'Pezinok'}\n\n`;
                    
                    // Check if we have real availability
                    if (slotResult.success && slotResult.soonestDate) {
                        response += `Najbližší termín: ${slotResult.soonestDate} o ${slotResult.soonestTime}`;
                        
                        // Add alternative times
                        if (slotResult.availableTimes && slotResult.availableTimes.length > 1) {
                            const alternatives = slotResult.availableTimes.slice(1, 3);
                            response += `\nĎalšie časy: ${alternatives.join(', ')}`;
                        }
                        
                        // Add next day info if available
                        if (slotResult.daysFromNow === 0) {
                            response = response.replace(slotResult.soonestDate, 'dnes');
                        } else if (slotResult.daysFromNow === 1) {
                            response = response.replace(slotResult.soonestDate, 'zajtra');
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

            case 'confirm_booking_DISABLED':
                res.set('Content-Type', 'application/json');
                return res.json({
                    success: false,
                    type: "booking_disabled",
                    message: "Rezervácie nie sú momentálne dostupné"
                });
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
                const searchLocation = detectLocation(search_term, location);
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



            default:
                res.set('Content-Type', 'application/json');
                return res.json({
                    success: false,
                    type: "unknown_tool",
                    message: `Neznámy nástroj: ${tool_name}`,
                    available_tools: ["quick_booking", "select_location", "location_booking", "get_services_overview", "get_opening_hours", "search_service", "find_soonest_slot"]
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