import pino from 'pino';

/**
 * JSON-structured logger using pino.
 */
export const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    base: {
        env: process.env.NODE_ENV,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
        level: (label) => {
            return { level: label.toUpperCase() };
        },
    },
});
