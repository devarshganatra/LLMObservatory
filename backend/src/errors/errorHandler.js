import { logger } from '../logger/logger.js';
import { AppError } from './AppError.js';

/**
 * Global error handling middleware.
 */
export const errorHandler = (err, req, res, next) => {
    let statusCode = err.statusCode || 500;
    let errorCode = err.errorCode || 'INTERNAL_ERROR';
    let message = err.message || 'Internal Server Error';
    let details = err.details;

    // Handle DB Errors (PostgreSQL)
    if (err.code && typeof err.code === 'string') {
        if (err.code === '22P02') { // Invalid input for UUID/Integer
            statusCode = 400;
            errorCode = 'INVALID_INPUT';
            message = 'Invalid input format (e.g. invalid UUID)';
        } else if (err.code === '23505') { // Unique violation
            statusCode = 409;
            errorCode = 'CONFLICT';
            message = 'Resource already exists';
        } else if (err.code === '23503') { // ForeignKey violation
            statusCode = 400;
            errorCode = 'FOREIGN_KEY_VIOLATION';
            message = 'Referenced resource does not exist';
        }
    }

    // Handle Zod/Operational Errors already wrapped
    if (err instanceof AppError) {
        statusCode = err.statusCode;
        errorCode = err.errorCode;
        message = err.message;
        details = err.details;
    }

    // Log the error
    if (statusCode >= 500) {
        logger.error({
            err: {
                message: err.message,
                stack: err.stack,
                code: err.code,
                name: err.constructor.name
            },
            request_id: req.requestId,
            route: req.originalUrl,
            method: req.method
        }, 'Unhandled Server Error');
    } else {
        logger.warn({
            errorCode,
            message,
            details,
            request_id: req.requestId,
            route: req.originalUrl
        }, 'Operational Error');
    }

    // Prepare response
    const response = {
        error: {
            code: errorCode,
            message: message
        }
    };

    if (details) {
        response.error.details = details;
    }

    // Include stack trace only in non-production
    if (process.env.NODE_ENV !== 'production') {
        response.error.stack = err.stack;
    }

    res.status(statusCode).json(response);
};
