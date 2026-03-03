import express from 'express';
import * as driftController from '../controllers/drift.controller.js';
import { validate } from '../middleware/validate.js';
import { uuidParamSchema } from '../validations/run.validation.js';

const router = express.Router();

// Route: GET /api/runs/:id/drift
router.get('/:id/drift', validate(uuidParamSchema), driftController.getRunDrift);

export default router;
