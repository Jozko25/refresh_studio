import axios from 'axios';

/**
 * Voice Booking Service for ElevenLabs Integration
 * Handles voice queries for appointment availability
 */
class VoiceBookingService {
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
     * Find the soonest available slot for a service
     */
    async findSoonestSlot(serviceId, workerId = -1, startDate = null) {
        try {
            const searchDate = startDate ? new Date(startDate) : new Date();
            const maxDaysToCheck = 14; // Check up to 2 weeks ahead
            
            console.log(`🔍 Finding soonest slot for service ${serviceId}, worker ${workerId}`);

            for (let dayOffset = 0; dayOffset < maxDaysToCheck; dayOffset++) {
                const checkDate = new Date(searchDate);
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
                        const soonestSlot = times[0];
                        return {
                            success: true,
                            found: true,
                            serviceId: serviceId,
                            workerId: workerId,
                            date: this.formatDateForDisplay(checkDate),
                            time: soonestSlot.id,
                            slot: soonestSlot,
                            daysFromNow: dayOffset,
                            totalAvailableSlots: times.length,
                            alternativeSlots: times.slice(1, 4), // Next 3 alternatives
                            voiceResponse: this.generateVoiceResponse('soonest', {
                                date: this.formatDateForVoice(checkDate),
                                time: soonestSlot.id,
                                daysFromNow: dayOffset,
                                totalSlots: times.length
                            })
                        };
                    }
                } catch (error) {
                    console.log(`Error checking ${dateStr}: ${error.message}`);
                    continue;
                }
            }

            return {
                success: true,
                found: false,
                serviceId: serviceId,
                workerId: workerId,
                message: `No available slots found in the next ${maxDaysToCheck} days`,
                voiceResponse: `Ľutujem, ale v najbližších ${maxDaysToCheck} dňoch nie sú dostupné žiadne voľné termíny pre túto službu.`
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                voiceResponse: 'Nastala chyba pri hľadaní voľného termínu. Skúste to znovu.'
            };
        }
    }

    /**
     * Check if a specific slot is available
     */
    async checkDesiredSlot(serviceId, workerId, desiredDate, desiredTime) {
        try {
            console.log(`🎯 Checking desired slot: ${desiredDate} ${desiredTime}`);

            const dateStr = this.formatDateForAPI(new Date(desiredDate));
            
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
            const desiredSlot = times.find(slot => slot.id === desiredTime);

            if (desiredSlot) {
                return {
                    success: true,
                    available: true,
                    serviceId: serviceId,
                    workerId: workerId,
                    date: desiredDate,
                    time: desiredTime,
                    slot: desiredSlot,
                    voiceResponse: `Výborné! Termín ${this.formatDateForVoice(new Date(desiredDate))} o ${desiredTime} je dostupný.`
                };
            } else {
                // Find closest available times
                const closestTimes = this.findClosestTimes(times, desiredTime);
                
                return {
                    success: true,
                    available: false,
                    serviceId: serviceId,
                    workerId: workerId,
                    date: desiredDate,
                    requestedTime: desiredTime,
                    alternativeSlots: closestTimes,
                    totalAvailableSlots: times.length,
                    voiceResponse: this.generateVoiceResponse('notAvailable', {
                        requestedTime: desiredTime,
                        date: this.formatDateForVoice(new Date(desiredDate)),
                        alternatives: closestTimes.slice(0, 3),
                        hasAlternatives: closestTimes.length > 0
                    })
                };
            }

        } catch (error) {
            return {
                success: false,
                error: error.message,
                voiceResponse: 'Nastala chyba pri kontrole termínu. Skúste to znovu.'
            };
        }
    }

    /**
     * Get comprehensive availability for voice interaction
     */
    async getVoiceAvailability(serviceId, workerId = -1, date = null) {
        try {
            const checkDate = date ? new Date(date) : new Date();
            const dateStr = this.formatDateForAPI(checkDate);

            console.log(`🎙️ Getting voice availability for ${dateStr}`);

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
                success: true,
                serviceId: serviceId,
                workerId: workerId,
                date: this.formatDateForDisplay(checkDate),
                totalSlots: allTimes.length,
                morningSlots: mornings.length,
                afternoonSlots: afternoons.length,
                firstAvailable: allTimes[0]?.id,
                lastAvailable: allTimes[allTimes.length - 1]?.id,
                sampleTimes: allTimes.slice(0, 5),
                voiceResponse: this.generateVoiceResponse('availability', {
                    date: this.formatDateForVoice(checkDate),
                    totalSlots: allTimes.length,
                    morningCount: mornings.length,
                    afternoonCount: afternoons.length,
                    firstTime: allTimes[0]?.id,
                    sampleTimes: allTimes.slice(0, 3)
                })
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                voiceResponse: 'Nastala chyba pri načítavaní dostupnosti. Skúste to znovu.'
            };
        }
    }

    /**
     * Search for a service by name (voice-friendly)
     */
    async findServiceByName(serviceName) {
        try {
            console.log(`🔎 Searching for service: ${serviceName}`);
            
            // Get all categories first
            const categoriesResponse = await axios.post(`${this.baseURL}/categories`, {
                facility: this.facility,
                lang: 'sk'
            }, { headers: this.headers });

            const categories = categoriesResponse.data.data || [];
            
            // Search through all services
            for (const category of categories) {
                try {
                    const servicesResponse = await axios.post(`${this.baseURL}/services`, {
                        facility: this.facility,
                        categoryId: category.categoryId,
                        lang: 'sk'
                    }, { headers: this.headers });

                    const services = servicesResponse.data.data || [];
                    
                    // Find matching service
                    const matchedService = services.find(service => 
                        service.title.toLowerCase().includes(serviceName.toLowerCase()) ||
                        serviceName.toLowerCase().includes(service.title.toLowerCase())
                    );

                    if (matchedService) {
                        return {
                            success: true,
                            found: true,
                            service: {
                                id: matchedService.serviceId,
                                name: matchedService.title,
                                price: matchedService.price,
                                duration: matchedService.durationString,
                                category: category.title
                            },
                            voiceResponse: `Našiel som službu: ${matchedService.title}. Cena je ${matchedService.price}, trvanie ${matchedService.durationString}.`
                        };
                    }
                } catch (error) {
                    continue;
                }
            }

            return {
                success: true,
                found: false,
                searchTerm: serviceName,
                voiceResponse: `Ľutujem, službu "${serviceName}" som nenašiel. Skúste iný názov alebo sa spýtajte na dostupné služby.`
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                voiceResponse: 'Nastala chyba pri hľadaní služby. Skúste to znovu.'
            };
        }
    }

    /**
     * Generate voice-friendly responses
     */
    generateVoiceResponse(type, data) {
        switch (type) {
            case 'soonest':
                if (data.daysFromNow === 0) {
                    return `Najbližší dostupný termín je dnes o ${data.time}. Celkovo je dostupných ${data.totalSlots} termínov.`;
                } else if (data.daysFromNow === 1) {
                    return `Najbližší dostupný termín je zajtra o ${data.time}. Na ${data.date} je dostupných ${data.totalSlots} termínov.`;
                } else {
                    return `Najbližší dostupný termín je ${data.date} o ${data.time}. To je o ${data.daysFromNow} dní. Celkovo je dostupných ${data.totalSlots} termínov.`;
                }

            case 'notAvailable':
                if (!data.hasAlternatives) {
                    return `Ľutujem, termín ${data.requestedTime} na ${data.date} nie je dostupný a nie sú dostupné ani žiadne alternatívy.`;
                }
                const altTimes = data.alternatives.map(alt => alt.id).join(', ');
                return `Ľutujem, termín ${data.requestedTime} na ${data.date} nie je dostupný. Dostupné sú tieto časy: ${altTimes}.`;

            case 'availability':
                if (data.totalSlots === 0) {
                    return `Na ${data.date} nie sú dostupné žiadne termíny.`;
                }
                const timesList = data.sampleTimes.map(t => t.id).join(', ');
                return `Na ${data.date} je dostupných ${data.totalSlots} termínov. Dopoludnia ${data.morningCount}, popoludní ${data.afternoonCount}. Prvé časy: ${timesList}.`;

            default:
                return 'Informácia je dostupná.';
        }
    }

    /**
     * Find closest available times to desired time
     */
    findClosestTimes(availableTimes, desiredTime) {
        const desiredMinutes = this.timeToMinutes(desiredTime);
        
        return availableTimes
            .map(slot => ({
                ...slot,
                minuteDiff: Math.abs(this.timeToMinutes(slot.id) - desiredMinutes)
            }))
            .sort((a, b) => a.minuteDiff - b.minuteDiff)
            .slice(0, 5); // Top 5 closest
    }

    /**
     * Helper functions
     */
    timeToMinutes(timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
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

    formatDateForVoice(date) {
        const options = { 
            weekday: 'long', 
            day: 'numeric', 
            month: 'long',
            locale: 'sk-SK'
        };
        return date.toLocaleDateString('sk-SK', options);
    }
}

export default new VoiceBookingService();