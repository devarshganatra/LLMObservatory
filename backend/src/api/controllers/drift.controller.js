import * as driftService from '../../services/driftService.js';
import { NotFoundError } from '../../errors/AppError.js';

/**
 * GET /api/runs/:id/drift
 */
export async function getRunDrift(req, res, next) {
    try {
        const { id } = req.validated.params;
        const result = await driftService.getDriftByRunId(id);

        if (!result) {
            throw new NotFoundError(`Drift record not found for run ${id}`, 'DRIFT_NOT_FOUND');
        }

        res.json(result);
    } catch (err) {
        next(err);
    }
}
