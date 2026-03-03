import express from 'express';
import * as insightsController from '../controllers/insights.controller.js';
import { validate } from '../middleware/validate.js';
import { uuidParamSchema } from '../validations/run.validation.js';

const router = express.Router();

// Route: GET /api/runs/:id/insights
router.get('/:id/insights', validate(uuidParamSchema), insightsController.getRunInsights);

export default router;
