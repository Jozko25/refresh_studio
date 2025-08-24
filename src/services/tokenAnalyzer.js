import axios from 'axios';
import crypto from 'crypto';
import vm from 'vm';

/**
 * Token Analyzer Service
 * Analyzes and attempts to reverse-engineer the Bookio verification token
 */
class TokenAnalyzer {
    constructor() {
        this.widgetURL = 'https://services.bookio.com/ai-recepcia-zll65ixf/widget';
        this.baseURL = 'https://services.bookio.com';
    }

    /**
     * Fetch the widget HTML and extract script sources
     */
    async fetchWidgetScripts() {
        try {
            console.log('🔍 Fetching widget HTML...');
            const response = await axios.get(this.widgetURL, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'sk-SK,sk;q=0.9,en;q=0.8'
                }
            });

            const html = response.data;
            
            // Extract script URLs
            const scriptUrls = [];
            const scriptRegex = /<script[^>]*src=["']([^"']+)["'][^>]*>/gi;
            let match;
            
            while ((match = scriptRegex.exec(html)) !== null) {
                const scriptUrl = match[1];
                if (!scriptUrl.startsWith('http')) {
                    scriptUrls.push(`${this.baseURL}${scriptUrl.startsWith('/') ? '' : '/'}${scriptUrl}`);
                } else {
                    scriptUrls.push(scriptUrl);
                }
            }

            // Also extract inline scripts
            const inlineScripts = [];
            const inlineRegex = /<script[^>]*>([^<]+)<\/script>/gi;
            
            while ((match = inlineRegex.exec(html)) !== null) {
                if (match[1] && match[1].trim()) {
                    inlineScripts.push(match[1]);
                }
            }

            console.log(`📦 Found ${scriptUrls.length} external scripts and ${inlineScripts.length} inline scripts`);
            
            return {
                scriptUrls,
                inlineScripts,
                html
            };
        } catch (error) {
            console.error('❌ Error fetching widget:', error.message);
            throw error;
        }
    }

    /**
     * Analyze scripts for token generation logic
     */
    async analyzeScripts(scriptUrls, inlineScripts) {
        const findings = {
            tokenPatterns: [],
            cryptoUsage: [],
            fingerprintLogic: [],
            relevantFunctions: []
        };

        // Analyze inline scripts
        for (const script of inlineScripts) {
            // Look for _vrf patterns
            if (script.includes('_vrf')) {
                console.log('✅ Found _vrf reference in inline script');
                
                // Extract context around _vrf
                const vrfContext = this.extractContext(script, '_vrf', 200);
                findings.tokenPatterns.push({
                    type: 'inline',
                    context: vrfContext
                });
            }

            // Look for fingerprint or crypto functions
            if (script.match(/fingerprint|crypto|hash|encrypt|sign/i)) {
                findings.cryptoUsage.push({
                    type: 'inline',
                    snippet: script.substring(0, 500)
                });
            }
        }

        // Download and analyze external scripts
        for (const url of scriptUrls) {
            try {
                console.log(`📥 Downloading: ${url}`);
                const response = await axios.get(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36'
                    }
                });
                
                const scriptContent = response.data;
                
                // Look for _vrf patterns
                if (scriptContent.includes('_vrf')) {
                    console.log(`✅ Found _vrf in: ${url}`);
                    
                    const vrfContext = this.extractContext(scriptContent, '_vrf', 500);
                    findings.tokenPatterns.push({
                        type: 'external',
                        url: url,
                        context: vrfContext
                    });
                }

                // Look for token generation functions
                const tokenFunctions = scriptContent.match(/function\s+\w*(?:token|vrf|fingerprint|sign)\w*\s*\([^)]*\)\s*{[^}]+}/gi);
                if (tokenFunctions) {
                    findings.relevantFunctions.push(...tokenFunctions);
                }

                // Look for Base64 encoding patterns
                if (scriptContent.includes('btoa') || scriptContent.includes('atob')) {
                    findings.cryptoUsage.push({
                        type: 'base64',
                        url: url
                    });
                }

            } catch (error) {
                console.error(`❌ Error downloading ${url}:`, error.message);
            }
        }

        return findings;
    }

    /**
     * Extract context around a search term
     */
    extractContext(text, searchTerm, contextSize = 200) {
        const results = [];
        let index = text.indexOf(searchTerm);
        
        while (index !== -1) {
            const start = Math.max(0, index - contextSize);
            const end = Math.min(text.length, index + searchTerm.length + contextSize);
            results.push(text.substring(start, end));
            index = text.indexOf(searchTerm, index + 1);
        }
        
        return results;
    }

    /**
     * Attempt to generate a token based on common patterns
     */
    generateToken(data) {
        const attempts = [];

        // Common pattern 1: Base64 encoded JSON
        const jsonPayload = JSON.stringify(data);
        attempts.push({
            method: 'base64_json',
            token: Buffer.from(jsonPayload).toString('base64')
        });

        // Common pattern 2: Timestamp + data hash
        const timestamp = Date.now();
        const hashData = `${timestamp}:${JSON.stringify(data)}`;
        const hash = crypto.createHash('sha256').update(hashData).digest('hex');
        attempts.push({
            method: 'timestamp_hash',
            token: `${timestamp}.${hash}`
        });

        // Common pattern 3: HMAC signature
        const secret = 'bookio_secret'; // This would need to be discovered
        const hmac = crypto.createHmac('sha256', secret).update(jsonPayload).digest('hex');
        attempts.push({
            method: 'hmac',
            token: hmac
        });

        // Common pattern 4: Random + encoded
        const random = crypto.randomBytes(32).toString('hex');
        const combined = `${random}.${Buffer.from(jsonPayload).toString('base64')}`;
        attempts.push({
            method: 'random_encoded',
            token: combined
        });

        return attempts;
    }

    /**
     * Main analysis function
     */
    async analyze() {
        try {
            console.log('🚀 Starting token analysis...');
            
            // Fetch widget and scripts
            const { scriptUrls, inlineScripts, html } = await this.fetchWidgetScripts();
            
            // Analyze scripts
            const findings = await this.analyzeScripts(scriptUrls, inlineScripts);
            
            // Save findings for review
            const fs = await import('fs/promises');
            const path = await import('path');
            
            const outputDir = path.join(process.cwd(), 'data');
            await fs.mkdir(outputDir, { recursive: true });
            
            const outputFile = path.join(outputDir, 'token-analysis.json');
            await fs.writeFile(outputFile, JSON.stringify(findings, null, 2));
            
            console.log(`💾 Analysis saved to: ${outputFile}`);
            
            return findings;
        } catch (error) {
            console.error('❌ Analysis failed:', error);
            throw error;
        }
    }
}

export default new TokenAnalyzer();