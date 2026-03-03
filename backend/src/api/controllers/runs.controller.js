import * as runService from '../../services/runService.js';
import { executePipeline } from '../../../runPipeline.js';
import { toRunDetailDTO } from '../dto/runDetail.dto.js';
import { NotFoundError } from '../../errors/AppError.js';

/**
 * POST /api/runs
 * Triggers a new run.
 */
export async function triggerRun(req, res, next) {
    try {
        const { run_type, temperature } = req.body;

        // Validation handled by middleware

        const result = await executePipeline({
            runType: run_type,
            temperatureOverride: temperature,
            userId: req.user.id
        });

        res.status(202).json(result);
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/runs
 * Lists paginated runs.
 */
export async function listRuns(req, res, next) {
    try {
        const { page, limit, model, classification } = req.validated.query;
        const offset = (page - 1) * limit;

        const result = await runService.getRuns({
            limit,
            offset,
            model,
            classification,
            page,
            userId: req.user.id
        });

        res.json(result);
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/runs/:id
 * Fetches a single run detail.
 */
export async function getRun(req, res, next) {
    try {
        const { id } = req.validated.params;
        const result = await runService.getRunById(id, req.user.id);

        if (!result) {
            throw new NotFoundError(`Run with ID ${id} not found`, 'RUN_NOT_FOUND');
        }

        const dto = toRunDetailDTO(result.run, result.drift, result.insight);
        res.json(dto);
    } catch (err) {
        next(err);
    }
}
