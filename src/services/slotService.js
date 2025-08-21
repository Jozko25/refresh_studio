import axios from 'axios';

/**
 * Slot Service for Webhook Integration
 * Simple API for finding and checking appointment slots
 */
class SlotService {
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
     * Find the soonest available slot
     */
    async findSoonestSlot(serviceId, workerId = -1, maxDays = 14) {
        try {
            const today = new Date();

            for (let dayOffset = 0; dayOffset < maxDays; dayOffset++) {
                const checkDate = new Date(today);
                checkDate.setDate(checkDate.getDate() + dayOffset);
                
                const dateStr = this.formatDateForAPI(checkDate);
                
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
                    return {
                        success: true,
                        found: true,
                        serviceId: serviceId,
                        workerId: workerId,
                        date: this.formatDateForDisplay(checkDate),
                        time: times[0].id,
                        daysFromNow: dayOffset,
                        totalSlots: times.length,
                        alternativeSlots: times.slice(1, 3).map(slot => slot.id)
                    };
                }
            }

            return {
                success: true,
                found: false,
                serviceId: serviceId,
                workerId: workerId,
                message: `No slots found in next ${maxDays} days`
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Check if specific slot is available
     */
    async checkSlot(serviceId, workerId, date, time) {
        try {
            const dateStr = this.formatDateForAPI(new Date(date));
            
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
            const isAvailable = times.some(slot => slot.id === time);

            if (isAvailable) {
                return {
                    success: true,
                    available: true,
                    serviceId: serviceId,
                    workerId: workerId,
                    date: date,
                    time: time
                };
            } else {
                // Get closest available times
                const closestTimes = this.findClosestTimes(times, time);
                
                return {
                    success: true,
                    available: false,
                    serviceId: serviceId,
                    workerId: workerId,
                    date: date,
                    requestedTime: time,
                    totalSlots: times.length,
                    closestTimes: closestTimes.slice(0, 3).map(slot => slot.id)
                };
            }

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get all available slots for a date
     */
    async getAvailableSlots(serviceId, workerId, date) {
        try {
            const dateStr = this.formatDateForAPI(new Date(date));
            
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
                date: date,
                totalSlots: allTimes.length,
                morningSlots: mornings.length,
                afternoonSlots: afternoons.length,
                slots: allTimes.map(slot => slot.id),
                morningTimes: mornings.map(slot => slot.id),
                afternoonTimes: afternoons.map(slot => slot.id)
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
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
            .sort((a, b) => a.minuteDiff - b.minuteDiff);
    }

    /**
     * Utility functions
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
}

export default new SlotService();