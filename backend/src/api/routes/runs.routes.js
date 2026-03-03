import express from 'express';
import * as runsController from '../controllers/runs.controller.js';
import { validate } from '../middleware/validate.js';
import { triggerRunSchema, paginationSchema, uuidParamSchema } from '../validations/run.validation.js';

const router = express.Router();

router.post('/', validate(triggerRunSchema), runsController.triggerRun);
router.get('/', validate(paginationSchema), runsController.listRuns);
router.get('/:id', validate(uuidParamSchema), runsController.getRun);

export default router;
