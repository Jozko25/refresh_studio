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
            
            // Prepare service list for LLM
            const serviceList = availableServices.map((service, index) => 
                `${index + 1}. ${service.title} - ${service.price} (${service.durationString || service.duration}) [Category: ${service.categoryName}]`
            ).join('\n');

            const prompt = this.buildMatchingPrompt(userQuery, serviceList);
            
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
    buildMatchingPrompt(userQuery, serviceList) {
        return `The customer is asking for: "${userQuery}"

Available services:
${serviceList}

Which service number best matches what the customer wants? Consider:
- Exact name matches (highest priority)
- Similar services (e.g., "biorepeel" matches "Chemický peeling BIOREPEEL")
- Slovak language variations
- Common misspellings
- Service categories

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
            const serviceList = availableServices.map((service, index) => 
                `${index + 1}. ${service.title} - ${service.price} [${service.categoryName}]`
            ).join('\n');

            const prompt = `Customer query: "${userQuery}"

Available services:
${serviceList}

Return the top ${topN} most relevant service numbers in order of relevance (e.g., "1, 5, 12").`;

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
     * Check if LLM matching is available
     */
    isAvailable() {
        return !!this.openaiApiKey;
    }
}

export default LLMServiceMatcher;