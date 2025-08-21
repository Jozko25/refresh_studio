import express from 'express';
import CallFlowService from '../services/callFlowService.js';
import SlotService from '../services/slotService.js';
import WidgetFlowService from '../services/widgetFlowService.js';
import BookioDirectService from '../services/bookioDirectService.js';

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
        const hydrafacialServices = services.filter(s => 
            s.title.toLowerCase().includes('hydrafacial') || 
            s.title.toLowerCase().includes('perk') ||
            s.title.toLowerCase().includes('lip')
        );
        
        res.json({
            totalServices: services.length,
            hydrafacialServices: hydrafacialServices.map(s => ({
                id: s.serviceId,
                title: s.title,
                price: s.price,
                category: s.categoryName
            }))
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
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
            res.set('Content-Type', 'text/plain');
            return res.send("Nerozumiem požiadavke. Skúste to znovu.");
        }

        console.log(`🔧 ElevenLabs tool call: ${tool_name}`, req.body);

        let result;
        let response;

        switch (tool_name) {
            case 'quick_booking':
                if (!search_term) {
                    res.set('Content-Type', 'text/plain');
                    return res.send("Nerozumiem, akú službu hľadáte.");
                }
                
                // First search for the service
                const searchResult = await BookioDirectService.searchServices(search_term);
                
                if (!searchResult.success || searchResult.found === 0) {
                    res.set('Content-Type', 'text/plain');
                    return res.send(`Ľutujem, nenašla som službu "${search_term}". Skúste iný názov.`);
                }
                
                // Try to find availability for each service until we find one with slots
                let availabilityResult = null;
                let bestService = null;
                
                for (const service of searchResult.services.slice(0, 3)) { // Try up to 3 services
                    console.log(`🔍 Testing service ${service.serviceId} (${service.name}) with robust search...`);
                    const result = await BookioDirectService.getAvailableTimesAndDays(service.serviceId, worker_id);
                    console.log(`🔍 Service ${service.serviceId} (${service.name}): ${result.success ? 'HAS SLOTS' : 'NO SLOTS'}`);
                    
                    if (result.success && result.soonestDate) {
                        availabilityResult = result;
                        bestService = service;
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
                    response = `Služba: ${bestService.name}\n`;
                    response += `Cena: ${bestService.price}, Trvanie: ${bestService.duration}\n\n`;
                    
                    // Use new function format if available
                    if (availabilityResult.soonestDate && availabilityResult.soonestTime) {
                        response += `Najbližší voľný termín: ${availabilityResult.soonestDate} o ${availabilityResult.soonestTime}\n`;
                        
                        if (availabilityResult.availableTimes && availabilityResult.availableTimes.length > 1) {
                            response += `Ďalšie časy v ten deň: ${availabilityResult.availableTimes.slice(1, 4).join(', ')}\n`;
                        }
                    } 
                    // Fallback to old function format
                    else if (availabilityResult.date && availabilityResult.time) {
                        response += `Najbližší voľný termín: ${availabilityResult.date} o ${availabilityResult.time}\n`;
                        
                        if (availabilityResult.allTimes && availabilityResult.allTimes.length > 1) {
                            response += `Ďalšie časy v ten deň: ${availabilityResult.allTimes.slice(1, 4).join(', ')}\n`;
                        }
                    }
                    
                    response += `\nChcete si rezervovať tento termín?`;
                } else {
                    response = `Služba: ${bestService.name}\n`;
                    response += `Cena: ${bestService.price}, Trvanie: ${bestService.duration}\n\n`;
                    response += `Momentálne nie sú dostupné online termíny. Môžete sa objednať telefonicky alebo navštíviť naše štúdio priamo.`;
                }
                break;

            case 'get_services_overview':
                result = await CallFlowService.getServiceOverview();
                if (result.success && result.overview) {
                    response = "Ponúkame tieto hlavné služby:\n\n";
                    result.overview.forEach((service, index) => {
                        response += `${index + 1}. ${service.name} - ${service.description}\n`;
                    });
                    response += "\nChcete počuť o ďalších službách alebo vás zaujíma niektorá z týchto?";
                } else {
                    response = "Momentálne nemôžem načítať zoznam služieb. Skúste to prosím znovu.";
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
                        // Only one service found - provide details and ask if they want appointment
                        const service = result.services[0];
                        response = `Našla som službu: ${service.name}\n`;
                        response += `Cena: ${service.price}, Trvanie: ${service.duration}\n\n`;
                        response += `Chcete si rezervovať termín pre túto službu?`;
                        // Store service ID for next call
                        response += `\n[SERVICE_ID:${service.serviceId}]`;
                    } else {
                        // Multiple services - automatically pick first one if they're identical
                        const firstService = result.services[0];
                        const allIdentical = result.services.every(s => 
                            s.name === firstService.name && s.price === firstService.price
                        );
                        
                        if (allIdentical) {
                            // All services are identical - pick first one
                            response = `Našla som službu: ${firstService.name}\n`;
                            response += `Cena: ${firstService.price}, Trvanie: ${firstService.duration}\n\n`;
                            response += `Chcete si rezervovať termín pre túto službu?`;
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

                result = await BookioDirectService.findSoonestSlot(service_id, worker_id);
                if (result.success && result.found) {
                    if (result.daysFromNow === 0) {
                        response = `Najrýchlejší dostupný termín je dnes o ${result.time}.`;
                    } else if (result.daysFromNow === 1) {
                        response = `Najrýchlejší dostupný termín je zajtra (${result.date}) o ${result.time}.`;
                    } else {
                        response = `Najrýchlejší dostupný termín je ${result.date} o ${result.time} (o ${result.daysFromNow} dní).`;
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
                        response += `Dostupní pracovníci: ${result.workers.map(w => w.name).join(', ')}.\n`;
                        
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
                    response += `Pracovník: ${result.worker.name}\n\n`;
                    
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
                response = `Naše otváracie hodiny sú:
Pondelok až piatok: 9:00 - 12:00 a 13:00 - 17:00
Sobota a nedeľa: Zatvorené

Nachádzame sa na adrese:
Lazaretská 13, Bratislava

Pre rezervácie môžete volať alebo navštíviť našu webstránku.`;
                result = {
                    success: true,
                    data: {
                        weekdays: "9:00-12:00, 13:00-17:00",
                        weekend: "Zatvorené",
                        address: "Lazaretská 13, Bratislava"
                    }
                };
                break;

            default:
                res.set('Content-Type', 'text/plain');
                return res.send(`Neznámy nástroj: ${tool_name}. Dostupné nástroje: get_services_overview, search_service, find_soonest_slot, check_specific_slot, get_booking_info, quick_service_lookup, get_opening_hours`);
        }

        // ElevenLabs expects plain text response
        res.set('Content-Type', 'text/plain');
        res.send(response);

    } catch (error) {
        console.error('ElevenLabs unified endpoint error:', error);
        res.set('Content-Type', 'text/plain');
        res.send("Nastala chyba. Skúste to prosím znovu.");
    }
});

export default router;