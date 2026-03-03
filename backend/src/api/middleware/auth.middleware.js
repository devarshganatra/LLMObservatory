/**
 * Authentication & Authorization Middleware
 */

import * as jwtUtils from '../../utils/jwt.js';
import * as userRepository from '../../repositories/userRepository.js';
import { AppError } from '../../errors/AppError.js';
import { logger } from '../../logger/logger.js';

/**
 * Custom error for unauthorized access.
 */
class UnauthorizedError extends AppError {
    constructor(message = 'Unauthorized') {
        super(message, 401, 'UNAUTHORIZED');
    }
}

/**
 * Custom error for forbidden access.
 */
class ForbiddenError extends AppError {
    constructor(message = 'Forbidden') {
        super(message, 403, 'FORBIDDEN');
    }
}

/**
 * Middleware to protect routes with JWT.
 */
export const protect = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next(new UnauthorizedError('Missing or malformed Authorization header'));
        }

        const token = authHeader.split(' ')[1];
        if (!token) {
            return next(new UnauthorizedError('Missing token'));
        }

        const decoded = jwtUtils.verifyAccessToken(token);

        // Security: Prevent using refresh tokens for access
        if (decoded.type !== 'access') {
            return next(new UnauthorizedError('Invalid token type'));
        }

        // Fetch user to verify token_version (forced logout support)
        const user = await userRepository.getUserById(decoded.user_id);
        if (!user || user.token_version !== decoded.token_version) {
            return next(new UnauthorizedError('Invalid or expired token session'));
        }

        // Attach user to request
        req.user = {
            id: user.id,
            email: user.email,
            role: user.role
        };

        next();
    } catch (err) {
        logger.error({ err }, 'JWT verification failed');
        next(new UnauthorizedError('Invalid or expired token'));
    }
};

/**
 * Middleware for role-based access control.
 */
export const requireRole = (role) => (req, res, next) => {
    if (!req.user || req.user.role !== role) {
        return next(new ForbiddenError(`Required role: ${role}`));
    }
    next();
};
