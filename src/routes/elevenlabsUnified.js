import express from 'express';
import CallFlowService from '../services/callFlowService.js';
import SlotService from '../services/slotService.js';
import WidgetFlowService from '../services/widgetFlowService.js';

const router = express.Router();

/**
 * POST /api/elevenlabs
 * Unified endpoint for all ElevenLabs tool calls
 * Handles dynamic routing based on tool_name parameter
 */
router.post('/', async (req, res) => {
    try {
        const { tool_name, search_term, service_id, worker_id = -1, date, time } = req.body;

        if (!tool_name) {
            return res.json({
                success: false,
                response: "Nerozumiem požiadavke. Skúste to znovu."
            });
        }

        console.log(`🔧 ElevenLabs tool call: ${tool_name}`, req.body);

        let result;
        let response;

        switch (tool_name) {
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
                    return res.json({
                        success: false,
                        response: "Nerozumiem, akú službu hľadáte. Môžete byť konkrétnejší?"
                    });
                }
                
                result = await CallFlowService.searchServices(search_term);
                if (result.success && result.found > 0) {
                    response = `Našla som ${result.found} ${result.found === 1 ? 'službu' : 'služieb'} pre "${search_term}":\n\n`;
                    result.services.slice(0, 3).forEach((service, index) => {
                        response += `${index + 1}. ${service.name}\n`;
                        response += `   Cena: ${service.price}, Trvanie: ${service.duration}\n`;
                        response += `   ID služby: ${service.serviceId}\n\n`;
                    });
                    response += "Ktorá služba vás zaujíma? Môžem vám nájsť voľné termíny.";
                } else {
                    response = `Ľutujem, nenašla som službu "${search_term}". Skúste iný názov alebo sa spýtajte na naše hlavné služby.`;
                }
                break;

            case 'find_soonest_slot':
                if (!service_id) {
                    return res.json({
                        success: false,
                        response: "Potrebujem vedieť ID služby. Najskôr vyhľadajte službu."
                    });
                }

                result = await SlotService.findSoonestSlot(service_id, worker_id);
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
                return res.json({
                    success: false,
                    response: `Neznámy nástroj: ${tool_name}. Dostupné nástroje: get_services_overview, search_service, find_soonest_slot, check_specific_slot, get_booking_info, quick_service_lookup, get_opening_hours`
                });
        }

        res.json({
            success: result?.success !== false,
            response: response,
            data: result
        });

    } catch (error) {
        console.error('ElevenLabs unified endpoint error:', error);
        res.json({
            success: false,
            response: "Nastala chyba. Skúste to prosím znovu.",
            error: error.message
        });
    }
});

export default router;