import * as runService from '../../services/runService.js';
import { enqueueRunJob } from '../../infrastructure/queue/runQueue.js';
import { toRunDetailDTO } from '../dto/runDetail.dto.js';
import { NotFoundError } from '../../errors/AppError.js';

/**
 * POST /api/runs
 * Triggers a new run asynchronously.
 *
 * Returns 202 Accepted immediately with { run_id, status: "pending" }.
 * The pipeline is processed by the BullMQ worker in a separate process.
 */
export async function triggerRun(req, res, next) {
    try {
        const { run_type = 'manual-api' } = req.body;
        const userId = req.user.id;

        // 1. Create a lightweight 'pending' run record in PostgreSQL
        const { dbRunId } = await runService.initPendingRun(userId, run_type);

        // 2. Enqueue job for the worker to pick up (non-blocking)
        await enqueueRunJob(dbRunId);

        // 3. Return immediately — client polls GET /api/runs/:id for status
        res.status(202).json({
            run_id: dbRunId,
            status: 'pending',
            message: 'Run queued for processing. Poll GET /api/runs/:id for status updates.'
        });
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
