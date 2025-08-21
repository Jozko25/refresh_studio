import express from 'express';
import CallFlowService from '../services/callFlowService.js';
import SlotService from '../services/slotService.js';
import WidgetFlowService from '../services/widgetFlowService.js';

const router = express.Router();

/**
 * ElevenLabs Tool Functions
 * These endpoints correspond to the tools configured in ElevenLabs
 */

/**
 * POST /api/elevenlabs/get_services_overview
 * Tool: get_services_overview
 */
router.post('/get_services_overview', async (req, res) => {
    try {
        const result = await CallFlowService.getServiceOverview();
        
        // Format for ElevenLabs response
        let response = "Ponúkame tieto hlavné služby:\n\n";
        
        if (result.success && result.overview) {
            result.overview.forEach((service, index) => {
                response += `${index + 1}. ${service.name} - ${service.description}\n`;
            });
            response += "\nChcete počuť o ďalších službách alebo vás zaujíma niektorá z týchto?";
        } else {
            response = "Momentálne nemôžem načítať zoznam služieb. Skúste to prosím znovu.";
        }

        res.json({
            success: result.success,
            response: response,
            data: result
        });

    } catch (error) {
        res.json({
            success: false,
            response: "Nastala chyba pri načítavaní služieb. Skúste to prosím znovu.",
            error: error.message
        });
    }
});

/**
 * POST /api/elevenlabs/search_service
 * Tool: search_service
 */
router.post('/search_service', async (req, res) => {
    try {
        const { search_term } = req.body;
        
        if (!search_term) {
            return res.json({
                success: false,
                response: "Nerozumiem, akú službu hľadáte. Môžete byť konkrétnejší?"
            });
        }

        const result = await CallFlowService.searchServices(search_term);
        
        let response = "";
        
        if (result.success && result.found > 0) {
            response = `Našla som ${result.found} ${result.found === 1 ? 'službu' : 'služieb'} pre "${search_term}":\n\n`;
            
            result.services.slice(0, 3).forEach((service, index) => {
                response += `${index + 1}. ${service.name}\n`;
                response += `   Cena: ${service.price}, Trvanie: ${service.duration}\n`;
                if (service.category) response += `   Kategória: ${service.category}\n`;
                response += "\n";
            });
            
            if (result.services.length > 0) {
                response += "Ktorá služba vás zaujíma? Môžem vám nájsť voľné termíny.";
            }
        } else {
            response = `Ľutujem, nenašla som službu "${search_term}". Skúste iný názov alebo sa spýtajte na naše hlavné služby.`;
        }

        res.json({
            success: result.success,
            response: response,
            data: result
        });

    } catch (error) {
        res.json({
            success: false,
            response: "Nastala chyba pri hľadaní služby. Skúste to prosím znovu.",
            error: error.message
        });
    }
});

/**
 * POST /api/elevenlabs/find_soonest_slot
 * Tool: find_soonest_slot
 */
router.post('/find_soonest_slot', async (req, res) => {
    try {
        const { service_id, worker_id = -1 } = req.body;
        
        if (!service_id) {
            return res.json({
                success: false,
                response: "Potrebujem vedieť ID služby. Najskôr vyhľadajte službu."
            });
        }

        const result = await SlotService.findSoonestSlot(service_id, worker_id);
        
        let response = "";
        
        if (result.success && result.found) {
            const workerName = worker_id == 18204 ? 'Janka' : worker_id == 30224 ? 'Veronika' : 'ktorýkoľvek pracovník';
            
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

        res.json({
            success: result.success,
            response: response,
            data: result
        });

    } catch (error) {
        res.json({
            success: false,
            response: "Nastala chyba pri hľadaní termínu. Skúste to prosím znovu.",
            error: error.message
        });
    }
});

/**
 * POST /api/elevenlabs/check_specific_slot
 * Tool: check_specific_slot
 */
router.post('/check_specific_slot', async (req, res) => {
    try {
        const { service_id, worker_id = -1, date, time } = req.body;
        
        if (!service_id || !date || !time) {
            return res.json({
                success: false,
                response: "Potrebujem vedieť ID služby, dátum a čas."
            });
        }

        const result = await SlotService.checkSlot(service_id, worker_id, date, time);
        
        let response = "";
        
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

        res.json({
            success: result.success,
            response: response,
            data: result
        });

    } catch (error) {
        res.json({
            success: false,
            response: "Nastala chyba pri kontrole termínu. Skúste to prosím znovu.",
            error: error.message
        });
    }
});

/**
 * POST /api/elevenlabs/get_booking_info
 * Tool: get_booking_info
 */
router.post('/get_booking_info', async (req, res) => {
    try {
        const { service_id, worker_id = -1 } = req.body;
        
        if (!service_id) {
            return res.json({
                success: false,
                response: "Potrebujem vedieť ID služby."
            });
        }

        const result = await CallFlowService.getBookingInfo(service_id, worker_id);
        
        let response = "";
        
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

        res.json({
            success: result.success,
            response: response,
            data: result
        });

    } catch (error) {
        res.json({
            success: false,
            response: "Nastala chyba pri načítavaní informácií. Skúste to prosím znovu.",
            error: error.message
        });
    }
});

/**
 * POST /api/elevenlabs/quick_service_lookup
 * Tool: quick_service_lookup
 */
router.post('/quick_service_lookup', async (req, res) => {
    try {
        const { search_term, date = "04.09.2025" } = req.body;
        
        if (!search_term) {
            return res.json({
                success: false,
                response: "Nerozumiem, akú službu hľadáte."
            });
        }

        const result = await WidgetFlowService.quickServiceLookup(search_term, date);
        
        let response = "";
        
        if (result.success) {
            response = `Našla som službu: ${result.service.name}\n`;
            response += `Cena: ${result.service.price}, Trvanie: ${result.service.duration}\n`;
            response += `Pracovník: ${result.worker.name}\n\n`;
            
            if (result.availability.totalSlots > 0) {
                response += `Na ${date} je dostupných ${result.availability.totalSlots} termínov:\n`;
                
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
                response += `Na ${date} nie sú dostupné žiadne termíny.\n`;
                response += "Chcete skúsiť iný dátum alebo najrýchlejší možný termín?";
            }
        } else {
            response = `Ľutujem, nenašla som službu "${search_term}". Skúste iný názov.`;
        }

        res.json({
            success: result.success,
            response: response,
            data: result
        });

    } catch (error) {
        res.json({
            success: false,
            response: "Nastala chyba pri vyhľadávaní služby.",
            error: error.message
        });
    }
});

/**
 * POST /api/elevenlabs/get_opening_hours
 * Tool: get_opening_hours
 */
router.post('/get_opening_hours', async (req, res) => {
    try {
        const response = `Naše otváracie hodiny sú:
Pondelok až piatok: 9:00 - 12:00 a 13:00 - 17:00
Sobota a nedeľa: Zatvorené

Nachádzame sa na adrese:
Lazaretská 13, Bratislava

Pre rezervácie môžete volať alebo navštíviť našu webstránku.`;

        res.json({
            success: true,
            response: response,
            data: {
                weekdays: "9:00-12:00, 13:00-17:00",
                weekend: "Zatvorené",
                address: "Lazaretská 13, Bratislava",
                website: "www.refresh-studio.sk"
            }
        });

    } catch (error) {
        res.json({
            success: false,
            response: "Nastala chyba pri načítavaní informácií.",
            error: error.message
        });
    }
});

export default router;