import express from 'express';
import * as runsController from '../controllers/runs.controller.js';
import { triggerRunSchema, paginationSchema, uuidParamSchema } from '../validations/run.validation.js';
import { rateLimiter } from '../middleware/rateLimiter.middleware.js';

const router = express.Router();

router.post(
    '/',
    rateLimiter({ limit: 10, window: 60, keyType: 'user' }),
    validate(triggerRunSchema),
    runsController.triggerRun
);

router.get(
    '/',
    rateLimiter({ limit: 60, window: 60, keyType: 'user' }),
    validate(paginationSchema),
    runsController.listRuns
);

router.get('/:id', validate(uuidParamSchema), runsController.getRun);

export default router;
