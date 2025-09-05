import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Token Storage Service
 * Manages multiple auth tokens with proper identification
 */
class TokenStorage {
    constructor() {
        this.storageDir = path.join(__dirname, '../../data/tokens');
        this.indexFile = path.join(this.storageDir, 'token-index.json');
    }

    /**
     * Generate a unique token ID based on account and environment
     */
    generateTokenId(username, environment, facility) {
        const sanitizedUsername = username.replace(/[@.]/g, '_');
        const sanitizedFacility = facility.replace(/[^a-zA-Z0-9-]/g, '_');
        return `${sanitizedUsername}_${environment}_${sanitizedFacility}`;
    }

    /**
     * Store a token with full metadata
     */
    async storeToken(tokenData) {
        try {
            // Ensure storage directory exists
            await fs.mkdir(this.storageDir, { recursive: true });

            const tokenId = this.generateTokenId(
                tokenData.username,
                tokenData.environment,
                tokenData.facility
            );

            // Prepare token record
            const tokenRecord = {
                id: tokenId,
                username: tokenData.username,
                environment: tokenData.environment,
                facility: tokenData.facility,
                cookie: tokenData.cookie,
                expiry: tokenData.expiry,
                refreshTime: tokenData.refreshTime,
                createdAt: new Date().toISOString(),
                lastUsed: new Date().toISOString(),
                useCount: 1,
                isActive: true,
                metadata: {
                    userAgent: tokenData.userAgent || 'Bookio-Auth-System',
                    ipAddress: tokenData.ipAddress || 'localhost',
                    version: '1.0.0'
                }
            };

            // Store individual token file
            const tokenFile = path.join(this.storageDir, `${tokenId}.json`);
            await fs.writeFile(tokenFile, JSON.stringify(tokenRecord, null, 2));

            // Update token index
            await this.updateTokenIndex(tokenRecord);

            console.log(`💾 Token stored: ${tokenId}`);
            return tokenId;

        } catch (error) {
            console.error('❌ Failed to store token:', error.message);
            throw error;
        }
    }

    /**
     * Retrieve a token by criteria
     */
    async getToken(username, environment, facility) {
        try {
            const tokenId = this.generateTokenId(username, environment, facility);
            const tokenFile = path.join(this.storageDir, `${tokenId}.json`);
            
            const data = await fs.readFile(tokenFile, 'utf8');
            const tokenRecord = JSON.parse(data);

            // Update last used
            tokenRecord.lastUsed = new Date().toISOString();
            tokenRecord.useCount = (tokenRecord.useCount || 0) + 1;
            
            // Save updated record
            await fs.writeFile(tokenFile, JSON.stringify(tokenRecord, null, 2));

            console.log(`🔑 Token retrieved: ${tokenId} (used ${tokenRecord.useCount} times)`);
            return tokenRecord;

        } catch (error) {
            if (error.code === 'ENOENT') {
                console.log(`📭 No token found for: ${username}@${environment}:${facility}`);
                return null;
            }
            console.error('❌ Failed to get token:', error.message);
            throw error;
        }
    }

    /**
     * Update token index for fast lookups
     */
    async updateTokenIndex(tokenRecord) {
        try {
            let index = {};
            
            // Load existing index
            try {
                const data = await fs.readFile(this.indexFile, 'utf8');
                index = JSON.parse(data);
            } catch (error) {
                // Index doesn't exist, start fresh
            }

            // Add/update token in index
            index[tokenRecord.id] = {
                id: tokenRecord.id,
                username: tokenRecord.username,
                environment: tokenRecord.environment,
                facility: tokenRecord.facility,
                expiry: tokenRecord.expiry,
                lastUsed: tokenRecord.lastUsed,
                isActive: tokenRecord.isActive,
                createdAt: tokenRecord.createdAt
            };

            // Save index
            await fs.writeFile(this.indexFile, JSON.stringify(index, null, 2));

        } catch (error) {
            console.error('⚠️ Failed to update token index:', error.message);
        }
    }

    /**
     * List all stored tokens
     */
    async listTokens() {
        try {
            const data = await fs.readFile(this.indexFile, 'utf8');
            const index = JSON.parse(data);
            
            return Object.values(index).map(token => ({
                id: token.id,
                username: token.username,
                environment: token.environment,
                facility: token.facility,
                expiry: token.expiry,
                lastUsed: token.lastUsed,
                isActive: token.isActive,
                isValid: new Date(token.expiry) > new Date()
            }));

        } catch (error) {
            console.log('📭 No tokens stored yet');
            return [];
        }
    }

    /**
     * Delete expired tokens
     */
    async cleanupExpiredTokens() {
        try {
            const tokens = await this.listTokens();
            const now = new Date();
            let cleaned = 0;

            for (const token of tokens) {
                if (new Date(token.expiry) < now) {
                    await this.deleteToken(token.id);
                    cleaned++;
                }
            }

            console.log(`🧹 Cleaned up ${cleaned} expired tokens`);
            return cleaned;

        } catch (error) {
            console.error('❌ Failed to cleanup tokens:', error.message);
            return 0;
        }
    }

    /**
     * Delete a specific token
     */
    async deleteToken(tokenId) {
        try {
            // Delete token file
            const tokenFile = path.join(this.storageDir, `${tokenId}.json`);
            await fs.unlink(tokenFile);

            // Update index
            const data = await fs.readFile(this.indexFile, 'utf8');
            const index = JSON.parse(data);
            delete index[tokenId];
            await fs.writeFile(this.indexFile, JSON.stringify(index, null, 2));

            console.log(`🗑️ Token deleted: ${tokenId}`);
            return true;

        } catch (error) {
            console.error('❌ Failed to delete token:', error.message);
            return false;
        }
    }

    /**
     * Get token statistics
     */
    async getStatistics() {
        try {
            const tokens = await this.listTokens();
            
            const stats = {
                total: tokens.length,
                active: tokens.filter(t => t.isActive).length,
                valid: tokens.filter(t => t.isValid).length,
                expired: tokens.filter(t => !t.isValid).length,
                environments: [...new Set(tokens.map(t => t.environment))],
                facilities: [...new Set(tokens.map(t => t.facility))],
                accounts: [...new Set(tokens.map(t => t.username))]
            };

            return stats;

        } catch (error) {
            return {
                total: 0,
                active: 0,
                valid: 0,
                expired: 0,
                environments: [],
                facilities: [],
                accounts: []
            };
        }
    }

    /**
     * Find tokens by criteria
     */
    async findTokens(criteria) {
        try {
            const tokens = await this.listTokens();
            
            return tokens.filter(token => {
                if (criteria.environment && token.environment !== criteria.environment) return false;
                if (criteria.facility && token.facility !== criteria.facility) return false;
                if (criteria.username && token.username !== criteria.username) return false;
                if (criteria.isValid !== undefined && token.isValid !== criteria.isValid) return false;
                if (criteria.isActive !== undefined && token.isActive !== criteria.isActive) return false;
                
                return true;
            });

        } catch (error) {
            console.error('❌ Failed to find tokens:', error.message);
            return [];
        }
    }
}

export default new TokenStorage();