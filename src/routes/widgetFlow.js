import express from 'express';
import WidgetFlowService from '../services/widgetFlowService.js';

const router = express.Router();

/**
 * POST /api/widget/complete-flow
 * Complete widget flow: category -> service -> worker -> availability
 * Body: { categoryName, serviceName, date? }
 */
router.post('/complete-flow', async (req, res) => {
    try {
        const { categoryName, serviceName, date } = req.body;

        if (!categoryName || !serviceName) {
            return res.status(400).json({
                success: false,
                error: 'categoryName and serviceName are required',
                timestamp: new Date().toISOString()
            });
        }

        const result = await WidgetFlowService.getCompleteServiceFlow(
            categoryName,
            serviceName,
            date ? new Date(date) : null
        );

        res.json({
            ...result,
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
 * GET /api/widget/quick-lookup/:searchTerm
 * Quick service lookup with immediate availability
 * Query params: ?date=DD.MM.YYYY
 */
router.get('/quick-lookup/:searchTerm', async (req, res) => {
    try {
        const { searchTerm } = req.params;
        const { date = "04.09.2025" } = req.query;

        const result = await WidgetFlowService.quickServiceLookup(searchTerm, date);

        res.json({
            ...result,
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

export default router;