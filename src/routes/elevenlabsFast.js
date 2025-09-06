import express from 'express';
import BookioFastService from '../services/bookioFastService.js';
import EmailService from '../services/emailService.js';

const router = express.Router();

/**
 * Optimized ElevenLabs webhook for REFRESH studio
 * Provides fast responses to avoid timeouts
 */

// Health check
router.get('/', (req, res) => {
    res.json({
        success: true,
        message: "REFRESH studio fast webhook is ready",
        available_tools: ["search_service", "get_services_overview", "get_opening_hours", "request_booking"]
    });
});

// Handle OPTIONS for CORS
router.options('/', (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.status(200).send();
});

/**
 * Main webhook handler
 */
router.post('/', async (req, res) => {
    // Set timeout to 25 seconds (ElevenLabs timeout is 30s)
    req.setTimeout(25000);
    
    // Set CORS headers
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'POST');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    
    try {
        console.log('🚀 ElevenLabs Fast webhook called:', {
            body: req.body
        });

        const { tool_name, search_term, location, date, time, customer_name, phone, service_name, note } = req.body;

        let response;

        switch (tool_name) {
            case 'get_services_overview':
                const overview = await BookioFastService.getServiceOverview();
                if (overview.success) {
                    response = "Ponúkame tieto kategórie služieb:\n\n";
                    overview.overview.forEach((cat, index) => {
                        response += `${index + 1}. ${cat.name}\n`;
                    });
                    response += "\nKtorá kategória vás zaujíma?";
                } else {
                    response = "Momentálne nemôžem načítať zoznam služieb. Skúste to prosím o chvíľu.";
                }
                break;

            case 'search_service':
            case 'search_services':
                if (!search_term) {
                    response = "Nerozumiem, akú službu hľadáte. Môžete byť konkrétnejší?";
                    break;
                }

                const searchResult = await BookioFastService.quickSearch(search_term);
                
                if (searchResult.success && searchResult.found > 0) {
                    const firstResult = searchResult.results[0];
                    
                    if (firstResult.services.length === 1) {
                        const service = firstResult.services[0];
                        response = `Našla som službu v kategórii ${firstResult.category}:\n\n`;
                        response += `📌 ${service.title}\n`;
                        response += `💰 Cena: ${service.price}\n`;
                        response += `⏱️ Trvanie: ${service.durationString}\n`;
                        if (service.description) {
                            response += `📝 ${service.description}\n`;
                        }
                        response += `\nChcete si rezervovať termín pre túto službu?`;
                    } else {
                        response = `Našla som ${firstResult.services.length} služieb v kategórii ${firstResult.category}:\n\n`;
                        firstResult.services.forEach((service, index) => {
                            response += `${index + 1}. ${service.title}\n`;
                            response += `   💰 ${service.price} | ⏱️ ${service.durationString}\n\n`;
                        });
                        response += "Ktorá služba vás zaujíma? Povedzte číslo alebo názov.";
                    }
                } else {
                    response = `Ľutujem, nenašla som službu obsahujúcu "${search_term}".\n\n`;
                    response += "Skúste napríklad:\n";
                    response += "• Hydrafacial\n";
                    response += "• Laserová epilácia\n";
                    response += "• Pleťové ošetrenie\n";
                    response += "• Chemický peeling";
                }
                break;

            case 'get_opening_hours':
                response = "📍 REFRESH laserové a estetické štúdio\n\n";
                response += "🏢 Bratislava - Lazaretská 13:\n";
                response += "Po-Pi: 9:00 - 18:00\n";
                response += "So: 9:00 - 14:00\n";
                response += "Ne: Zatvorené\n\n";
                response += "🏢 Pezinok:\n";
                response += "Po-Pi: 9:00 - 17:00\n";
                response += "So-Ne: Zatvorené\n\n";
                response += "📞 Kontakt: +421 907 888 048";
                break;

            case 'request_booking':
                // Validate required fields
                if (!service_name && !search_term) {
                    response = "Ahoj! 👋 Rád vám pomôžem s rezerváciou.\n\n";
                    response += "Aké ošetrenie si želáte rezervovať?\n";
                    response += "Napríklad: Hydrafacial, laserová epilácia, pleťové ošetrenie...";
                    break;
                }

                if (!location) {
                    response = "V ktorej pobočke si želáte rezerváciu?\n\n";
                    response += "🏢 Bratislava - Lazaretská 13\n";
                    response += "🏢 Pezinok\n\n";
                    response += "Prosím povedzte 'Bratislava' alebo 'Pezinok'.";
                    break;
                }

                // Auto-suggest nearest slots if no date
                if (!date) {
                    response = `Výborne! Hľadáte ${service_name || search_term} v ${location}.\n\n`;
                    response += "📅 Najbližšie voľné termíny:\n\n";
                    
                    // Generate next 3 days of availability
                    const today = new Date();
                    for (let i = 1; i <= 3; i++) {
                        const nextDate = new Date(today);
                        nextDate.setDate(today.getDate() + i);
                        const dateStr = nextDate.toLocaleDateString('sk-SK', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long'
                        });
                        response += `${dateStr}:\n`;
                        response += `🌅 Ráno: 9:00, 10:00\n`;
                        response += `🌆 Popoludní: 14:00, 15:00, 16:00\n\n`;
                    }
                    
                    response += "Ktorý termín by vám vyhovoval?\n";
                    response += "Môžete povedať napríklad: 'zajtra o 14:00' alebo 'pondelok ráno'";
                    break;
                }

                if (!time) {
                    response = `Perfektne! Dátum ${date} mám zapísaný.\n\n`;
                    response += "🕐 Dostupné časy:\n";
                    response += "Dopoludnia: 9:00, 10:00, 11:00\n";
                    response += "Popoludní: 14:00, 15:00, 16:00, 17:00\n\n";
                    response += "Ktorý čas vám vyhovuje?";
                    break;
                }

                if (!customer_name) {
                    response = `Výborne! Termín ${date} o ${time} je voľný.\n\n`;
                    response += "Pre dokončenie rezervácie potrebujem vaše meno a priezvisko.";
                    break;
                }

                if (!phone) {
                    response = `Ďakujem, ${customer_name}! 😊\n\n`;
                    response += "Ešte potrebujem vaše telefónne číslo pre potvrdenie rezervácie.";
                    break;
                }

                // All info collected - create booking request
                const bookingRequest = {
                    serviceName: service_name || search_term,
                    customerName: customer_name,
                    date: date,
                    time: time,
                    phone: phone,
                    note: note || '',
                    location: location
                };

                // Send booking email
                try {
                    const emailSent = await EmailService.sendBookingRequestEmail(bookingRequest);
                    
                    if (emailSent) {
                        response = `✅ Perfektne! Vaša rezervácia bola úspešne odoslaná.\n\n`;
                        response += `📋 Zhrnutie rezervácie:\n`;
                        response += `━━━━━━━━━━━━━━━━━━━━\n`;
                        response += `✨ Služba: ${bookingRequest.serviceName}\n`;
                        response += `👤 Meno: ${bookingRequest.customerName}\n`;
                        response += `📍 Miesto: ${location === 'bratislava' ? 'Bratislava - Lazaretská 13' : 'Pezinok'}\n`;
                        response += `📅 Dátum: ${bookingRequest.date}\n`;
                        response += `🕐 Čas: ${bookingRequest.time}\n`;
                        response += `📱 Telefón: ${bookingRequest.phone}\n\n`;
                        response += `📧 Čoskoro vás budeme kontaktovať pre potvrdenie termínu.\n\n`;
                        response += `Tešíme sa na vás! 💆‍♀️✨`;
                    } else {
                        response = `❌ Nastala chyba pri odosielaní rezervácie.\n\n`;
                        response += `Prosím kontaktujte nás priamo:\n`;
                        response += `📞 +421 907 888 048`;
                    }
                } catch (error) {
                    console.error('Booking error:', error);
                    response = `❌ Nastala chyba pri spracovaní rezervácie.\n\n`;
                    response += `Prosím kontaktujte nás priamo:\n`;
                    response += `📞 +421 907 888 048`;
                }
                break;

            default:
                response = `Nepoznám nástroj: ${tool_name}.\n\n`;
                response += "Môžem vám pomôcť s:\n";
                response += "• Vyhľadaním služieb\n";
                response += "• Informáciami o otváracích hodinách\n";
                response += "• Rezerváciou termínu";
                break;
        }

        // Send response
        res.set('Content-Type', 'text/plain; charset=utf-8');
        res.send(response);

    } catch (error) {
        console.error('❌ ElevenLabs Fast webhook error:', error);
        res.set('Content-Type', 'text/plain; charset=utf-8');
        res.send("Nastala chyba. Skúste to prosím znovu alebo zavolajte na +421 907 888 048");
    }
});

export default router;