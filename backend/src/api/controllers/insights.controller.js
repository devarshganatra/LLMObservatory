import * as insightService from '../../services/insightService.js';
import { NotFoundError } from '../../errors/AppError.js';

/**
 * GET /api/runs/:id/insights
 */
export async function getRunInsights(req, res, next) {
    try {
        const { id } = req.validated.params;
        const result = await insightService.getInsightsByRunId(id);

        if (!result) {
            throw new NotFoundError(`Insight record not found for run ${id}`, 'INSIGHT_NOT_FOUND');
        }

        res.json(result);
    } catch (err) {
        next(err);
    }
}
