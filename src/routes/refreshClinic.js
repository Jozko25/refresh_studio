import express from 'express';
import RefreshClinicService from '../services/refreshClinicEnhanced.js';

const router = express.Router();

/**
 * GET /api/refresh-clinic/facility
 * Get basic facility information
 */
router.get('/facility', async (req, res) => {
  try {
    const result = await RefreshClinicService.getFacilityInfo();
    
    if (result.success) {
      res.json({
        success: true,
        facility: result.facility,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/refresh-clinic/services
 * Get all available services
 */
router.get('/services', async (req, res) => {
  try {
    const result = await RefreshClinicService.getAllServices();
    
    if (result.success) {
      res.json({
        success: true,
        servicesCount: result.services.length,
        services: result.services,
        source: result.source,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/refresh-clinic/services/category/:category
 * Get services by category
 */
router.get('/services/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const result = await RefreshClinicService.getServicesByCategory(category);
    
    if (result.success) {
      res.json({
        success: true,
        category: category,
        found: result.found,
        services: result.services,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/refresh-clinic/services/search
 * Search services by name or category
 * Query params: ?q=search_term&availability=true
 */
router.get('/services/search', async (req, res) => {
  try {
    const { q: query, availability } = req.query;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Search query parameter "q" is required',
        timestamp: new Date().toISOString()
      });
    }

    const includeAvailability = availability === 'true';
    const result = await RefreshClinicService.searchServices(query, includeAvailability);
    
    if (result.success) {
      res.json({
        success: true,
        query: query,
        found: result.found,
        services: result.services,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/refresh-clinic/services/:serviceId/availability
 * Get availability for a specific service
 * Query params: ?date=DD.MM.YYYY&days=7
 */
router.get('/services/:serviceId/availability', async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { date, days = 7 } = req.query;
    
    const result = await RefreshClinicService.getServiceAvailability(
      serviceId, 
      date, 
      parseInt(days)
    );
    
    if (result.success) {
      res.json({
        success: true,
        serviceId: serviceId,
        date: date || 'today',
        times: result.times,
        source: result.source,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(404).json({
        success: false,
        error: result.error,
        serviceId: serviceId,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/refresh-clinic/services-with-availability
 * Get all services with their availability
 * Query params: ?date=DD.MM.YYYY&days=7
 */
router.get('/services-with-availability', async (req, res) => {
  try {
    const { date, days = 7 } = req.query;
    
    const result = await RefreshClinicService.getServicesWithAvailability(
      date, 
      parseInt(days)
    );
    
    if (result.success) {
      res.json({
        success: true,
        facility: result.facility,
        date: date || 'today',
        servicesCount: result.servicesCount,
        services: result.services,
        timestamp: result.timestamp
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/refresh-clinic/services/batch-availability
 * Get availability for multiple services
 * Body: { serviceIds: [1001, 1002], date?: "DD.MM.YYYY", days?: 7 }
 */
router.post('/services/batch-availability', async (req, res) => {
  try {
    const { serviceIds, date, days = 7 } = req.body;
    
    if (!serviceIds || !Array.isArray(serviceIds)) {
      return res.status(400).json({
        success: false,
        error: 'serviceIds array is required in request body',
        timestamp: new Date().toISOString()
      });
    }

    const results = [];
    
    for (const serviceId of serviceIds) {
      const availability = await RefreshClinicService.getServiceAvailability(
        serviceId, 
        date, 
        parseInt(days)
      );
      
      results.push({
        serviceId: serviceId,
        success: availability.success,
        times: availability.success ? availability.times : null,
        error: availability.success ? null : availability.error
      });

      // Small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    res.json({
      success: true,
      date: date || 'today',
      requestedServices: serviceIds.length,
      results: results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/refresh-clinic/service-categories
 * Get list of all service categories
 */
router.get('/service-categories', async (req, res) => {
  try {
    const servicesResult = await RefreshClinicService.getAllServices();
    
    if (servicesResult.success) {
      const categories = [...new Set(servicesResult.services.map(s => s.category))];
      const categoriesWithCounts = categories.map(category => ({
        category: category,
        count: servicesResult.services.filter(s => s.category === category).length,
        services: servicesResult.services.filter(s => s.category === category).map(s => ({
          id: s.id,
          name: s.name,
          price: s.price
        }))
      }));

      res.json({
        success: true,
        totalCategories: categories.length,
        categories: categoriesWithCounts,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: servicesResult.error,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/refresh-clinic/staff
 * Get staff/worker information
 */
router.get('/staff', async (req, res) => {
  try {
    const servicesResult = await RefreshClinicService.getAllServices();
    
    if (servicesResult.success) {
      res.json({
        success: true,
        staffMembers: servicesResult.staffMembers,
        totalStaff: servicesResult.staffMembers.length,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: servicesResult.error,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/refresh-clinic/price-list
 * Get formatted price list of all services
 */
router.get('/price-list', async (req, res) => {
  try {
    const servicesResult = await RefreshClinicService.getAllServices();
    
    if (servicesResult.success) {
      const priceList = servicesResult.services.map(service => ({
        id: service.id,
        name: service.name,
        category: service.category,
        price: service.price,
        duration: service.duration,
        currency: service.currency,
        formattedPrice: service.price ? `${service.price}${service.currency}` : 'Price on consultation'
      })).sort((a, b) => {
        if (a.category === b.category) {
          return (a.price || 0) - (b.price || 0);
        }
        return a.category.localeCompare(b.category);
      });

      res.json({
        success: true,
        totalServices: priceList.length,
        priceList: priceList,
        lastUpdated: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: servicesResult.error,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;