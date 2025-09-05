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
            
            // Prepare simplified service list for LLM
            const serviceList = availableServices.map((service, index) => {
                return `${index + 1}. ${service.title} - ${service.price}`;
            }).join('\n');

            // Using simplified inline prompt instead of buildMatchingPrompt
            
            // Debug logging
            console.log(`📋 Service list preview (first 5):`);
            availableServices.slice(0, 5).forEach((service, index) => {
                console.log(`  ${index + 1}. ${service.title} - ${service.price}`);
            });
            console.log(`📋 Service at index 12: ${availableServices[11] ? `${availableServices[11].title} - ${availableServices[11].price}` : 'NOT FOUND'}`);
            
            const response = await axios.post(this.baseURL, {
                model: "gpt-4o",
                messages: [
                    {
                        role: "system", 
                        content: "You are an expert service matcher. Find the best matching service for the customer's request. Respond with ONLY the number (1-188), nothing else."
                    },
                    {
                        role: "user",
                        content: `Customer wants: "${userQuery}"\n\nServices:\n${serviceList}\n\nWhich service number matches best? Answer with only the number.`
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

1. **EXACT SERVICE NAME MATCHES** (highest priority)
   - If customer mentions a specific service name that exists exactly in the list, choose that service
   - "bokombrady" → match exact "bokombrady" service (NOT legs or other face services)
   - "podpazušie" → match exact "podpazušie" service
   - "brada" → match exact "brada" service (if exists)
   - CRITICAL: "laserová epilácia bokombrady" should match the "bokombrady" service, NOT "CELÉ NOHY"

2. **BODY PART MATCHING FOR LASER HAIR REMOVAL** (second priority)
   - Only use when exact service name doesn't exist
   - "fúzy" (mustache), "obličej" (face) → match face/tvár services
   - "nohy" (legs), "lýtka" (calves) → match leg services  
   - "ruky" (arms), "paže" (arms) → match arm services
   - Always check gender: "páni" for men, default for women
   
3. **SLOVAK ACCENT VARIATIONS AND PRONUNCIATION** 
   - Slovak speakers often adapt foreign words with Slovak endings (e.g., "exceláže" likely refers to "EXCELLAGE")
   - Consider phonetic similarities and common Slovak pronunciation patterns
   - Look for accent variations: á→a, é→e, í→i, ó→o, ú→u, ý→y, ň→n, ť→t, ď→d, ľ→l, č→c, š→s, ž→z
   - "institut estéderm" matches "Institut Esthederm"

4. **AGE-APPROPRIATE SELECTION**
   - For ages 16-25: prefer BASIC/ZÁKLAD services, AKNÉ treatments
   - For ages 26-35: prefer standard services without "POKROČILÉ" or "ADVANCED"
   - For ages 36+: any service level appropriate
   - "pleťové ošetrenie 25 rokov" should match BASIC facial treatments, NOT advanced mezoterapia

4. **PARTIAL MATCHES**
   - Look for key words within service names
   - "biorepeel" matches "Chemický peeling BIOREPEEL"

5. **CATEGORY MATCHES** (lowest priority)

KEY CONSIDERATIONS:
- NEVER match facial hair terms (bokombrady, fúzy, brada) with leg services (NOHY, LÝTKA)
- "bokombrady" = sideburns on face → look for "tvár" services, especially "celá tvár páni"
- Use your language understanding to match Slovak pronunciations and word adaptations to service names
- Consider age-appropriateness when multiple services are available
- Prioritize semantic meaning over exact spelling when dealing with foreign words adapted to Slovak

EXAMPLES OF CORRECT MATCHING:
- "laserová epilácia bokombrady" → should match the exact "bokombrady" service (€15, 15min), NOT "CELÉ NOHY" (legs, €160)
- "bokombrady" → match exact "bokombrady" service
- "laser epilácia fúzy" → should match face/tvár services, NOT leg services
- Always prefer exact service name matches over body part interpretations

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
                model: "gpt-4o", 
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