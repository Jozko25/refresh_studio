/**
 * Service Cache Manager
 * Caches services for 4-6 hours with live API fallback
 */
class ServiceCache {
    constructor() {
        this.cache = new Map();
        this.CACHE_DURATION = 4 * 60 * 60 * 1000; // 4 hours in milliseconds
        this.MAX_CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours max
    }

    /**
     * Get cache key for location
     */
    getCacheKey(location) {
        return `services_${location}`;
    }

    /**
     * Check if cache is valid
     */
    isCacheValid(cacheEntry) {
        if (!cacheEntry) return false;
        
        const age = Date.now() - cacheEntry.timestamp;
        return age < this.CACHE_DURATION;
    }

    /**
     * Check if cache is still usable (within max duration)
     */
    isCacheUsable(cacheEntry) {
        if (!cacheEntry) return false;
        
        const age = Date.now() - cacheEntry.timestamp;
        return age < this.MAX_CACHE_DURATION;
    }

    /**
     * Get services from cache
     */
    getServices(location) {
        const key = this.getCacheKey(location);
        const cacheEntry = this.cache.get(key);
        
        if (this.isCacheValid(cacheEntry)) {
            console.log(`🎯 Cache HIT for ${location} (${Math.round((Date.now() - cacheEntry.timestamp) / 1000 / 60)} minutes old)`);
            return {
                success: true,
                services: cacheEntry.services,
                fromCache: true,
                age: Date.now() - cacheEntry.timestamp
            };
        }
        
        if (this.isCacheUsable(cacheEntry)) {
            console.log(`⏰ Cache STALE for ${location} (${Math.round((Date.now() - cacheEntry.timestamp) / 1000 / 60)} minutes old) - will refresh in background`);
            return {
                success: true,
                services: cacheEntry.services,
                fromCache: true,
                stale: true,
                age: Date.now() - cacheEntry.timestamp
            };
        }
        
        console.log(`❌ Cache MISS for ${location}`);
        return {
            success: false,
            fromCache: false
        };
    }

    /**
     * Set services in cache
     */
    setServices(location, services) {
        const key = this.getCacheKey(location);
        const cacheEntry = {
            services,
            timestamp: Date.now(),
            location
        };
        
        this.cache.set(key, cacheEntry);
        console.log(`💾 Cached ${services.length} services for ${location}`);
    }

    /**
     * Clear cache for location
     */
    clearCache(location = null) {
        if (location) {
            const key = this.getCacheKey(location);
            this.cache.delete(key);
            console.log(`🗑️ Cleared cache for ${location}`);
        } else {
            this.cache.clear();
            console.log(`🗑️ Cleared all service cache`);
        }
    }

    /**
     * Get cache stats
     */
    getCacheStats() {
        const stats = {};
        
        for (const [key, entry] of this.cache.entries()) {
            const age = Date.now() - entry.timestamp;
            const ageMinutes = Math.round(age / 1000 / 60);
            const isValid = this.isCacheValid(entry);
            const isUsable = this.isCacheUsable(entry);
            
            stats[key] = {
                serviceCount: entry.services?.length || 0,
                ageMinutes,
                isValid,
                isUsable,
                status: isValid ? 'fresh' : (isUsable ? 'stale' : 'expired')
            };
        }
        
        return stats;
    }

    /**
     * Background refresh for stale cache
     */
    async backgroundRefresh(location, fetchFunction) {
        try {
            console.log(`🔄 Background refresh started for ${location}`);
            const services = await fetchFunction(location);
            
            if (services && services.length > 0) {
                this.setServices(location, services);
                console.log(`✅ Background refresh completed for ${location}: ${services.length} services`);
            }
        } catch (error) {
            console.error(`❌ Background refresh failed for ${location}:`, error.message);
        }
    }
}

export default new ServiceCache();