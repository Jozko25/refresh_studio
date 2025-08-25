import axios from 'axios';

/**
 * LLM-powered service matching
 * Uses OpenAI to intelligently match user queries to available services
 */
class LLMServiceMatcher {
    constructor() {
        this.openaiApiKey = process.env.OPENAI_API_KEY;
        this.baseURL = 'https://api.openai.com/v1/chat/completions';
        
        if (!this.openaiApiKey) {
            console.warn('⚠️ OPENAI_API_KEY not found. LLM service matching disabled.');
        }
    }

    /**
     * Match user query to best service using LLM
     */
    async matchService(userQuery, availableServices) {
        if (!this.openaiApiKey) {
            throw new Error('OpenAI API key not configured');
        }

        try {
            console.log(`🤖 Using LLM to match: "${userQuery}" against ${availableServices.length} services`);
            
            // Normalize user query for better matching
            const normalizedQuery = this.normalizeText(userQuery);
            console.log(`🔤 Normalized query: "${userQuery}" → "${normalizedQuery}"`);
            
            // Prepare service list for LLM with both original and normalized text
            const serviceList = availableServices.map((service, index) => {
                const normalizedTitle = this.normalizeText(service.title);
                const titleDisplay = normalizedTitle !== service.title.toLowerCase() ? 
                    `${service.title} (normalized: ${normalizedTitle})` : 
                    service.title;
                return `${index + 1}. ${titleDisplay} - ${service.price} (${service.durationString || service.duration}) [Category: ${service.categoryName}]`;
            }).join('\n');

            const prompt = this.buildMatchingPrompt(userQuery, serviceList, normalizedQuery);
            
            const response = await axios.post(this.baseURL, {
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system", 
                        content: "You are an expert at matching customer service requests to available services in a Slovak beauty clinic. Always respond with just the service number, no explanation."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                max_tokens: 10,
                temperature: 0.1
            }, {
                headers: {
                    'Authorization': `Bearer ${this.openaiApiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            const result = response.data.choices[0].message.content.trim();
            console.log(`🎯 LLM response: "${result}"`);
            
            // Parse the service number
            const serviceNumber = parseInt(result.match(/\d+/)?.[0]);
            
            if (serviceNumber && serviceNumber >= 1 && serviceNumber <= availableServices.length) {
                const matchedService = availableServices[serviceNumber - 1];
                console.log(`✅ LLM matched: "${userQuery}" → "${matchedService.title}"`);
                return {
                    success: true,
                    service: matchedService,
                    confidence: 'high',
                    method: 'llm'
                };
            } else {
                console.log(`❌ LLM returned invalid service number: ${result}`);
                return {
                    success: false,
                    error: 'LLM could not match service',
                    method: 'llm'
                };
            }
        } catch (error) {
            console.error('❌ LLM matching error:', error.message);
            return {
                success: false,
                error: error.message,
                method: 'llm'
            };
        }
    }

    /**
     * Build prompt for service matching
     */
    buildMatchingPrompt(userQuery, serviceList, normalizedQuery = null) {
        const queryInfo = normalizedQuery && normalizedQuery !== userQuery.toLowerCase() ? 
            `The customer is asking for: "${userQuery}" (normalized: "${normalizedQuery}")` :
            `The customer is asking for: "${userQuery}"`;
            
        return `${queryInfo}

Available services:
${serviceList}

Match the customer's request to the most appropriate service. Follow this EXACT priority:

1. **EXACT NAME MATCHES** (highest priority)
   - Look for identical words in service names

2. **SLOVAK ACCENT VARIATIONS** 
   - "exceláže" = "EXCELLAGE" (Slovak speakers add -áže ending to foreign words)
   - "institut estéderm" = "Institut Esthederm"
   - Remove all accents: á→a, é→e, í→i, ó→o, ú→u, ý→y, ň→n, ť→t, ď→d, ľ→l, č→c, š→s, ž→z

3. **AGE-APPROPRIATE SELECTION**
   - For ages 16-25: prefer BASIC/ZÁKLAD services, AKNÉ treatments
   - For ages 26-35: prefer standard services without "POKROČILÉ" or "ADVANCED"
   - For ages 36+: any service level appropriate
   - "pleťové ošetrenie 25 rokov" should match BASIC facial treatments, NOT advanced mezoterapia

4. **PARTIAL MATCHES**
   - Look for key words within service names
   - "biorepeel" matches "Chemický peeling BIOREPEEL"

5. **CATEGORY MATCHES** (lowest priority)

CRITICAL RULES:
- "exceláže" MUST match "EXCELLAGE", never "DISCOVERY"
- Young clients (under 30) should get basic treatments unless specifically requesting advanced
- Always prioritize exact name matches over category matches

Respond with only the service number (1-${serviceList.split('\n').length}).`;
    }

    /**
     * Get top matching services using LLM for multiple candidates
     */
    async getTopMatches(userQuery, availableServices, topN = 3) {
        if (!this.openaiApiKey) {
            throw new Error('OpenAI API key not configured');
        }

        try {
            const normalizedQuery = this.normalizeText(userQuery);
            
            const serviceList = availableServices.map((service, index) => {
                const normalizedTitle = this.normalizeText(service.title);
                const titleDisplay = normalizedTitle !== service.title.toLowerCase() ? 
                    `${service.title} (normalized: ${normalizedTitle})` : 
                    service.title;
                return `${index + 1}. ${titleDisplay} - ${service.price} [${service.categoryName}]`;
            }).join('\n');

            const queryInfo = normalizedQuery !== userQuery.toLowerCase() ? 
                `Customer query: "${userQuery}" (normalized: "${normalizedQuery}")` :
                `Customer query: "${userQuery}"`;

            const prompt = `${queryInfo}

Available services:
${serviceList}

Return the top ${topN} most relevant service numbers in order of relevance (e.g., "1, 5, 12").
Consider both original and normalized text when matching Slovak accented characters.`;

            const response = await axios.post(this.baseURL, {
                model: "gpt-4o-mini", 
                messages: [
                    {
                        role: "system",
                        content: "You are an expert at ranking services by relevance to customer queries. Return only comma-separated numbers."
                    },
                    {
                        role: "user", 
                        content: prompt
                    }
                ],
                max_tokens: 20,
                temperature: 0.1
            }, {
                headers: {
                    'Authorization': `Bearer ${this.openaiApiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            const result = response.data.choices[0].message.content.trim();
            const serviceNumbers = result.split(/[,\s]+/).map(n => parseInt(n.trim())).filter(n => !isNaN(n) && n >= 1 && n <= availableServices.length);
            
            const matchedServices = serviceNumbers.map(num => availableServices[num - 1]).filter(Boolean);
            
            console.log(`🎯 LLM top matches for "${userQuery}": ${matchedServices.map(s => s.title).join(', ')}`);
            
            return {
                success: true,
                services: matchedServices,
                method: 'llm'
            };
        } catch (error) {
            console.error('❌ LLM top matches error:', error.message);
            return {
                success: false,
                error: error.message,
                method: 'llm'
            };
        }
    }

    /**
     * Normalize text for better matching (remove accents, lowercase, etc.)
     */
    normalizeText(text) {
        return text
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Remove diacritics/accents
            .replace(/[^\w\s]/g, '') // Remove special characters
            .trim();
    }

    /**
     * Check if LLM matching is available
     */
    isAvailable() {
        return !!this.openaiApiKey;
    }
}

export default LLMServiceMatcher;