import axios from 'axios';
import TokenFetcher from './tokenFetcher.js';

/**
 * Bookio Turnstile Service
 * Handles Cloudflare Turnstile tokens for Bookio bookings
 */
class BookioTurnstileService {
    constructor() {
        this.baseURL = 'https://services.bookio.com/widget/api';
        this.widgetURL = 'https://services.bookio.com/ai-recepcia-zll65ixf/widget';
        this.facility = 'refresh-laserove-a-esteticke-studio-zu0yxr5l';
    }

    /**
     * Get a fresh Turnstile token by loading the widget
     */
    async getTurnstileToken() {
        try {
            console.log('🎫 Fetching fresh Turnstile token via automation...');
            
            // Get fresh token using Puppeteer automation
            const token = await TokenFetcher.getFreshTurnstileToken();
            
            if (token && token.length > 1000) {
                console.log('✅ Fresh token obtained via Puppeteer automation');
                return token;
            }

            console.log('❌ Invalid token');
            return null;
        } catch (error) {
            console.error('❌ Error with token:', error.message);
            return null;
        }
    }

    /**
     * Create a reservation with Turnstile token
     */
    async createReservationWithToken(reservationData) {
        try {
            const {
                serviceId,
                workerId = 31576,
                date,
                hour,
                firstName,
                lastName,
                email,
                phone,
                note = "",
                acceptTerms = true
            } = reservationData;

            console.log('📅 Creating reservation with Turnstile token:', {
                serviceId,
                workerId,
                date,
                hour,
                name: `${firstName} ${lastName}`,
                email
            });

            // Get fresh Turnstile token
            const turnstileToken = await this.getTurnstileToken();
            if (!turnstileToken) {
                return {
                    success: false,
                    message: 'Unable to get Turnstile token'
                };
            }

            // Prepare the reservation payload
            const payload = {
                serviceId: parseInt(serviceId),
                termId: null,
                workerId: parseInt(workerId),
                date: date,
                hour: hour,
                addons: [],
                cashGiftCard: null,
                count: 1,
                courseParticipants: [],
                firstService: {
                    termId: parseInt(serviceId),
                    count: null
                },
                height: 1080,
                width: 1920,
                items: null,
                lang: "sk",
                note: note,
                personalInfo: {
                    subscribe: false,
                    isBuyer: true,
                    giftCard: {
                        countOfUse: 1,
                        id: 0
                    },
                    firstName: firstName,
                    lastName: lastName,
                    email: email,
                    phone: phone,
                    selectedCountry: "sk",
                    acceptGenTerms: acceptTerms
                },
                priceLevels: null,
                requiredCustomersInfo: true,
                reservationSource: {
                    source: "WIDGET_WEB",
                    url: "",
                    isZlavaDnaSource: false,
                    code: "reservationSource.title.widget.web"
                },
                secondService: null,
                tags: [],
                thirdService: null,
                wlHash: null,
                _vrf: turnstileToken,
                _vrfm: false
            };

            console.log('🚀 Submitting reservation with token...');

            // Make the API call to create reservation
            const response = await axios.post(
                `${this.baseURL}/createReservation?lang=sk`,
                payload,
                { 
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json, text/plain, */*',
                        'Accept-Language': 'sk-SK,sk;q=0.9,en;q=0.8',
                        'Origin': 'https://services.bookio.com',
                        'Referer': this.widgetURL,
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    withCredentials: false
                }
            );

            const data = response.data;

            if (data && data.data && data.data.success && data.data.order) {
                console.log('✅ Reservation created successfully:', data.data.order.orderId);
                return {
                    success: true,
                    order: data.data.order,
                    method: 'turnstile_token'
                };
            } else if (data && data.data && data.data.errors) {
                console.error('❌ Reservation failed with errors:', data.data.errors);
                return {
                    success: false,
                    errors: data.data.errors,
                    message: 'Rezervácia nebola úspešná'
                };
            } else {
                console.error('❌ Unexpected response structure:', data);
                return {
                    success: false,
                    message: 'Neočakávaná odpoveď od servera'
                };
            }

        } catch (error) {
            console.error('❌ Error creating reservation with token:', error);
            if (error.response) {
                console.error('Response error:', error.response.data);
                return {
                    success: false,
                    error: error.response.data,
                    message: error.response.data.message || 'Chyba pri vytváraní rezervácie'
                };
            }
            return {
                success: false,
                error: error.message,
                message: 'Nastala chyba pri vytváraní rezervácie'
            };
        }
    }
}

export default new BookioTurnstileService();