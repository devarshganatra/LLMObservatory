import express from 'express';
import * as baselinesController from '../controllers/baselines.controller.js';
import { validate } from '../middleware/validate.js';
import { paginationSchema, uuidParamSchema } from '../validations/run.validation.js';

const router = express.Router();

router.get('/', validate(paginationSchema), baselinesController.listBaselines);
router.get('/:id', validate(uuidParamSchema), baselinesController.getBaseline);

export default router;
