import { checkRateLimit } from '../../infrastructure/redis/redisRateLimiter.js';
import { redisKeys } from '../../infrastructure/redis/redisKeys.js';
import { logger } from '../../logger/logger.js';

/**
 * Express Middleware for Redis-backed Rate Limiting.
 * 
 * Supports skip logic for tests and fail-open behavior.
 */

export const rateLimiter = ({
    limit = 10,
    window = 60,
    keyType = 'ip', // 'ip' | 'user'
}) => {
    return async (req, res, next) => {
        // Skip rate limiting in test environment
        if (process.env.NODE_ENV === 'test') {
            return next();
        }

        let identifier;
        let redisKey;

        if (keyType === 'user') {
            identifier = req.user?.id; // Assuming user id is attached to req.user by auth middleware
            if (!identifier) {
                // Fallback to IP if user not authenticated
                identifier = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
                redisKey = redisKeys.rateLimit.ip(identifier);
            } else {
                redisKey = redisKeys.rateLimit.user(identifier);
            }
        } else {
            identifier = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
            redisKey = redisKeys.rateLimit.ip(identifier);
        }

        const { allowed, remaining } = await checkRateLimit(redisKey, limit, window);

        // Set standard rate limit headers
        res.set({
            'X-RateLimit-Limit': limit,
            'X-RateLimit-Remaining': remaining,
            'X-RateLimit-Reset': Math.ceil(Date.now() / 1000) + (window) // Simplified reset time
        });

        if (!allowed) {
            res.set('Retry-After', window);
            return res.status(429).json({
                error: 'Too Many Requests',
                message: `Rate limit exceeded. Please try again after ${window} seconds.`,
            });
        }

        next();
    };
};
