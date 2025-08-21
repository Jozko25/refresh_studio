#!/usr/bin/env node

/**
 * Real-time REFRESH Clinic Availability Tester
 * Tests real-time availability across all workers for any service
 */

import axios from 'axios';

class RealTimeAvailabilityTester {
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
     * Get real-time availability for a service across all workers
     */
    async getServiceAvailabilityAllWorkers(serviceId, serviceName) {
        try {
            console.log(`\n🔍 Getting real-time availability for: ${serviceName} (${serviceId})`);
            console.log('=' * 70);

            // Get current date/time
            const now = new Date();
            const dateStr = this.formatDate(now);

            // Get workers for this service
            const workersResponse = await axios.post(`${this.baseURL}/workers`, {
                serviceId: parseInt(serviceId),
                lang: 'sk'
            }, { headers: this.headers });

            const workers = workersResponse.data.data;
            console.log(`👥 Available workers: ${workers.length}`);

            const availabilityResults = [];

            // Check availability for each worker
            for (const worker of workers) {
                console.log(`\n⏰ Checking availability for: ${worker.name} (ID: ${worker.workerId})`);

                try {
                    const availabilityResponse = await axios.post(`${this.baseURL}/allowedTimes`, {
                        serviceId: parseInt(serviceId),
                        workerId: worker.workerId,
                        date: dateStr,
                        count: 1,
                        participantsCount: 0,
                        addons: []
                    }, { headers: this.headers });

                    const times = availabilityResponse.data.data?.times;
                    const availableSlots = times?.all || [];

                    availabilityResults.push({
                        workerId: worker.workerId,
                        workerName: worker.name,
                        totalSlots: availableSlots.length,
                        morningSlots: times?.mornings?.data?.length || 0,
                        afternoonSlots: times?.afternoon?.data?.length || 0,
                        slots: availableSlots.slice(0, 5), // First 5 slots
                        available: availableSlots.length > 0
                    });

                    console.log(`   ✅ ${availableSlots.length} slots available`);
                    if (availableSlots.length > 0) {
                        const firstFew = availableSlots.slice(0, 3).map(s => s.name).join(', ');
                        console.log(`   📅 Next slots: ${firstFew}`);
                    }

                } catch (error) {
                    console.log(`   ❌ Error checking availability: ${error.message}`);
                    availabilityResults.push({
                        workerId: worker.workerId,
                        workerName: worker.name,
                        error: error.message,
                        available: false
                    });
                }

                // Small delay to be respectful
                await new Promise(resolve => setTimeout(resolve, 200));
            }

            return {
                success: true,
                serviceId: serviceId,
                serviceName: serviceName,
                checkTime: now.toISOString(),
                workers: availabilityResults,
                summary: {
                    totalWorkers: workers.length,
                    workersWithAvailability: availabilityResults.filter(r => r.available).length,
                    totalAvailableSlots: availabilityResults.reduce((sum, r) => sum + (r.totalSlots || 0), 0)
                }
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                serviceId: serviceId
            };
        }
    }

    /**
     * Test multiple services
     */
    async testMultipleServices() {
        const testServices = [
            { id: 101282, name: 'LAMINÁCIA OBOČIA s FARBENÍM a ÚPRAVOU' },
            { id: 127325, name: 'Hydrafacial J.Lo™' },
            { id: 105391, name: 'Institut Esthederm EXCELLAGE' },
            { id: 125847, name: 'Chemický peeling BIOREPEEL' },
            { id: 109702, name: 'MEZOTERAPIA PLETI JALUPRO s vital injektorom' }
        ];

        console.log('🏥 REFRESH Clinic Real-Time Availability Test');
        console.log('============================================\n');

        const results = [];

        for (const service of testServices) {
            const result = await this.getServiceAvailabilityAllWorkers(service.id, service.name);
            results.push(result);

            if (result.success) {
                console.log(`\n📊 Summary for ${service.name}:`);
                console.log(`   Workers with availability: ${result.summary.workersWithAvailability}/${result.summary.totalWorkers}`);
                console.log(`   Total available slots: ${result.summary.totalAvailableSlots}`);
            }

            console.log('\n' + '-'.repeat(70));
            
            // Delay between services
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        return results;
    }

    /**
     * Format date for API
     */
    formatDate(date) {
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${day}.${month}.${year} ${hours}:${minutes}`;
    }
}

// Run the test
async function main() {
    const tester = new RealTimeAvailabilityTester();
    
    if (process.argv[2] && process.argv[3]) {
        // Test specific service
        const serviceId = process.argv[2];
        const serviceName = process.argv[3];
        await tester.getServiceAvailabilityAllWorkers(serviceId, serviceName);
    } else {
        // Test multiple services
        await tester.testMultipleServices();
    }
}

main().catch(console.error);