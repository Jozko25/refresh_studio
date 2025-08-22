import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';

/**
 * Comprehensive Bookio API Crawler
 * Systematically crawls all categories and services from the Bookio widget API
 */
class BookioApiCrawler {
    constructor() {
        this.baseURL = 'https://services.bookio.com/widget/api';
        this.facility = 'refresh-laserove-a-esteticke-studio-zu0yxr5l';
        this.headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/plain, */*',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
            'Origin': 'https://services.bookio.com',
            'Referer': `https://services.bookio.com/${this.facility}/widget?lang=sk`,
            'Accept-Language': 'sk-SK,sk;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br'
        };
        
        this.crawledData = {
            categories: [],
            services: [],
            crawlTime: null,
            totalCategories: 0,
            totalServices: 0
        };
    }

    /**
     * Main crawl method - crawls everything
     */
    async crawlAll() {
        console.log('🕷️ Starting comprehensive Bookio API crawl...');
        const startTime = Date.now();
        
        try {
            // Step 1: Get all categories
            await this.crawlCategories();
            
            // Step 2: Get all services from each category
            await this.crawlAllServices();
            
            // Step 3: Save results
            await this.saveResults();
            
            const crawlTime = Date.now() - startTime;
            console.log(`✅ Crawl completed in ${crawlTime}ms`);
            console.log(`📊 Results: ${this.crawledData.totalCategories} categories, ${this.crawledData.totalServices} services`);
            
            return this.crawledData;
        } catch (error) {
            console.error('❌ Crawl failed:', error);
            throw error;
        }
    }

    /**
     * Crawl all categories from the API
     */
    async crawlCategories() {
        console.log('📋 Crawling categories...');
        
        try {
            const response = await axios.post(`${this.baseURL}/categories`, {
                facility: this.facility,
                lang: 'sk'
            }, { headers: this.headers });

            const categories = response.data?.data || [];
            
            console.log(`📋 Found ${categories.length} categories:`);
            categories.forEach(cat => {
                console.log(`  - ${cat.title} (ID: ${cat.categoryId})`);
            });
            
            this.crawledData.categories = categories;
            this.crawledData.totalCategories = categories.length;
            
            return categories;
        } catch (error) {
            console.error('❌ Error crawling categories:', error);
            throw error;
        }
    }

    /**
     * Crawl services from all categories
     */
    async crawlAllServices() {
        console.log('🔍 Crawling services from all categories...');
        
        const allServices = [];
        let successCount = 0;
        let errorCount = 0;
        
        // Process categories in batches to avoid overwhelming the API
        const batchSize = 3;
        for (let i = 0; i < this.crawledData.categories.length; i += batchSize) {
            const batch = this.crawledData.categories.slice(i, i + batchSize);
            
            const batchPromises = batch.map(async (category) => {
                try {
                    const services = await this.crawlServicesForCategory(category);
                    successCount++;
                    return services.map(service => ({
                        ...service,
                        categoryId: category.categoryId,
                        categoryTitle: category.title,
                        categoryDescription: category.selectServiceTitle || category.title
                    }));
                } catch (error) {
                    console.error(`❌ Failed to crawl category "${category.title}":`, error.message);
                    errorCount++;
                    return [];
                }
            });
            
            const batchResults = await Promise.all(batchPromises);
            batchResults.forEach(services => allServices.push(...services));
            
            // Small delay between batches
            if (i + batchSize < this.crawledData.categories.length) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        
        console.log(`✅ Crawled ${successCount} categories successfully, ${errorCount} errors`);
        console.log(`📊 Total services found: ${allServices.length}`);
        
        this.crawledData.services = allServices;
        this.crawledData.totalServices = allServices.length;
        this.crawledData.crawlTime = new Date().toISOString();
        
        return allServices;
    }

    /**
     * Crawl services for a specific category
     */
    async crawlServicesForCategory(category) {
        try {
            const response = await axios.post(`${this.baseURL}/services`, {
                facility: this.facility,
                categoryId: category.categoryId,
                lang: 'sk'
            }, { headers: this.headers });

            const services = response.data?.data || [];
            
            console.log(`📦 Category "${category.title}": ${services.length} services`);
            
            // Log service details for debugging
            if (services.length > 0) {
                services.forEach(service => {
                    console.log(`    • ${service.title} - ${service.price} (${service.durationString || service.duration})`);
                });
            }
            
            return services;
        } catch (error) {
            console.error(`❌ Error crawling services for category ${category.categoryId}:`, error);
            return [];
        }
    }

    /**
     * Save crawled data to file
     */
    async saveResults() {
        try {
            const dataDir = path.join(process.cwd(), 'data');
            
            // Ensure data directory exists
            try {
                await fs.mkdir(dataDir, { recursive: true });
            } catch (err) {
                // Directory might already exist
            }
            
            // Save complete crawl results
            const filepath = path.join(dataDir, 'bookio-crawl-results.json');
            await fs.writeFile(filepath, JSON.stringify(this.crawledData, null, 2));
            console.log(`💾 Saved crawl results to ${filepath}`);
            
            // Save services index for quick lookup
            const servicesFilepath = path.join(dataDir, 'bookio-services-index.json');
            const servicesIndex = {
                lastUpdate: this.crawledData.crawlTime,
                totalServices: this.crawledData.totalServices,
                services: this.crawledData.services.map(service => ({
                    serviceId: service.serviceId,
                    title: service.title,
                    price: service.price,
                    priceNumber: service.priceNumber,
                    duration: service.duration,
                    durationString: service.durationString,
                    description: service.description || '',
                    categoryId: service.categoryId,
                    categoryTitle: service.categoryTitle,
                    categoryDescription: service.categoryDescription,
                    searchText: `${service.title} ${service.categoryTitle} ${service.description || ''}`.toLowerCase()
                }))
            };
            await fs.writeFile(servicesFilepath, JSON.stringify(servicesIndex, null, 2));
            console.log(`📇 Saved services index to ${servicesFilepath}`);
            
        } catch (error) {
            console.error('❌ Error saving results:', error);
        }
    }

    /**
     * Get service statistics
     */
    getStats() {
        const servicesByCategory = {};
        this.crawledData.services.forEach(service => {
            const category = service.categoryTitle;
            if (!servicesByCategory[category]) {
                servicesByCategory[category] = [];
            }
            servicesByCategory[category].push(service);
        });

        return {
            totalCategories: this.crawledData.totalCategories,
            totalServices: this.crawledData.totalServices,
            crawlTime: this.crawledData.crawlTime,
            servicesByCategory: Object.keys(servicesByCategory).map(category => ({
                category,
                count: servicesByCategory[category].length,
                services: servicesByCategory[category].map(s => `${s.title} (${s.price})`)
            }))
        };
    }
}

export default BookioApiCrawler;