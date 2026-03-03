import { ValidationError } from '../../errors/AppError.js';

/**
 * Generic validation middleware using Zod safeParse.
 * Express 5 makes req.query and req.params read-only, so validated
 * data is stored on req.validated for downstream access.
 */
export const validate = (schema) => (req, res, next) => {
    const result = schema.safeParse({
        body: req.body,
        query: req.query,
        params: req.params,
    });

    if (!result.success) {
        const issues = result.error?.issues ?? [];
        const details = issues.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
        }));
        return next(new ValidationError('Input validation failed', details));
    }

    // Store validated data — req.query and req.params are read-only in Express 5
    req.validated = result.data;
    if (result.data.body) req.body = result.data.body;

    next();
};
