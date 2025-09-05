import axios from 'axios';
import tough from 'tough-cookie';
import { wrapper } from 'axios-cookiejar-support';

/**
 * Bookio Session Service
 * Attempts to create reservations using session management
 */
class BookioSessionService {
    constructor() {
        this.baseURL = 'https://services.bookio.com';
        this.widgetPath = '/ai-recepcia-zll65ixf/widget';
        this.facility = 'ai-recepcia-zll65ixf';
        
        // Create cookie jar for session management
        this.cookieJar = new tough.CookieJar();
        this.client = wrapper(axios.create({
            jar: this.cookieJar,
            withCredentials: true
        }));
    }

    /**
     * Initialize session by loading the widget page
     */
    async initializeSession() {
        try {
            console.log('🔐 Initializing Bookio session...');
            
            // First, load the widget page to get initial cookies
            const widgetResponse = await this.client.get(`${this.baseURL}${this.widgetPath}`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'sk-SK,sk;q=0.9,en;q=0.8',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });

            // Extract any CSRF tokens or session identifiers from the HTML
            const html = widgetResponse.data;
            const csrfMatch = html.match(/csrf[_-]?token['"]\s*[:=]\s*['"]([^'"]+)/i);
            const sessionMatch = html.match(/session[_-]?id['"]\s*[:=]\s*['"]([^'"]+)/i);
            
            this.csrfToken = csrfMatch ? csrfMatch[1] : null;
            this.sessionId = sessionMatch ? sessionMatch[1] : null;

            console.log('✅ Session initialized');
            console.log(`📍 CSRF Token: ${this.csrfToken ? 'Found' : 'Not found'}`);
            console.log(`🍪 Cookies: ${this.cookieJar.getCookiesSync(this.baseURL).length} cookies set`);

            return {
                success: true,
                hasCSRF: !!this.csrfToken,
                cookieCount: this.cookieJar.getCookiesSync(this.baseURL).length
            };

        } catch (error) {
            console.error('❌ Failed to initialize session:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Attempt to create reservation without Turnstile token
     */
    async createReservationDirect(reservationData) {
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

            console.log('📅 Attempting direct reservation (no Turnstile)...');

            // Initialize session first
            await this.initializeSession();

            // Prepare the payload without _vrf token
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
                wlHash: null
                // Intentionally omitting _vrf and _vrfm
            };

            // Add CSRF token if we found one
            if (this.csrfToken) {
                payload._csrf = this.csrfToken;
            }

            console.log('🚀 Submitting reservation without Turnstile token...');

            // Attempt the reservation
            const response = await this.client.post(
                `${this.baseURL}/widget/api/createReservation?lang=sk`,
                payload,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json, text/plain, */*',
                        'Accept-Language': 'sk-SK,sk;q=0.9,en;q=0.8',
                        'Origin': this.baseURL,
                        'Referer': `${this.baseURL}${this.widgetPath}`,
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                }
            );

            const data = response.data;

            if (data && data.data && data.data.success && data.data.order) {
                console.log('✅ Reservation created successfully!');
                return {
                    success: true,
                    order: data.data.order,
                    method: 'direct_no_token'
                };
            } else {
                console.log('❌ Reservation failed:', data);
                return {
                    success: false,
                    response: data,
                    message: 'Reservation failed - likely requires Turnstile token'
                };
            }

        } catch (error) {
            console.error('❌ Direct reservation error:', error.response?.data || error.message);
            
            // Check if it's a Turnstile requirement error
            if (error.response?.status === 403 || error.response?.data?.message?.includes('captcha')) {
                return {
                    success: false,
                    requiresTurnstile: true,
                    message: 'Turnstile verification required - cannot bypass',
                    error: error.response?.data
                };
            }

            return {
                success: false,
                error: error.response?.data || error.message,
                message: 'Failed to create reservation'
            };
        }
    }

    /**
     * Try to get facility configuration
     */
    async getFacilityConfig() {
        try {
            const response = await this.client.post(
                `${this.baseURL}/widget/api/facilityConfiguration`,
                {
                    facility: 'ai-recepcia-zll65ixf',
                    lang: 'sk'
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    }
                }
            );

            console.log('🏢 Facility config:', response.data);
            return response.data;

        } catch (error) {
            console.error('❌ Failed to get facility config:', error.message);
            return null;
        }
    }
}

export default new BookioSessionService();