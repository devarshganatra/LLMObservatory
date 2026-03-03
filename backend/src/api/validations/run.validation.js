import { z } from 'zod';

/**
 * UUID validation
 */
export const uuidParamSchema = z.object({
    params: z.object({
        id: z.string().uuid('Invalid UUID format'),
    }),
});

/**
 * Pagination validation
 */
export const paginationSchema = z.object({
    query: z.object({
        page: z.preprocess(
            (val) => (val === undefined || val === '' ? undefined : parseInt(val, 10)),
            z.number().int().min(1).default(1)
        ),
        limit: z.preprocess(
            (val) => (val === undefined || val === '' ? undefined : parseInt(val, 10)),
            z.number().int().min(1).max(100).default(10)
        ),
        model: z.string().optional(),
        classification: z.string().optional(),
    }),
});

/**
 * POST /runs validation
 */
export const triggerRunSchema = z.object({
    body: z.object({
        model: z.string({ required_error: 'Model name is required' }),
        temperature: z.number().refine((val) => val === 0.2, {
            message: 'Temperature must be exactly 0.2 for production runs',
        }),
        max_output_tokens: z.number().int().positive().optional().default(4096),
        run_type: z.string().optional().default('manual-api'),
    }),
});
