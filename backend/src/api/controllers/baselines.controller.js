import * as baselineService from '../../services/baselineService.js';
import { NotFoundError } from '../../errors/AppError.js';

/**
 * GET /api/baselines
 */
export async function listBaselines(req, res, next) {
    try {
        const { page, limit } = req.validated.query;
        const offset = (page - 1) * limit;

        const result = await baselineService.getBaselines({
            limit,
            offset
        });

        res.json(result);
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/baselines/:id
 */
export async function getBaseline(req, res, next) {
    try {
        const { id } = req.validated.params;
        const result = await baselineService.getBaselineDetail(id);

        if (!result) {
            throw new NotFoundError(`Baseline with ID ${id} not found`, 'BASELINE_NOT_FOUND');
        }

        res.json(result);
    } catch (err) {
        next(err);
    }
}
