import * as authService from '../../services/auth.service.js';
import { logger } from '../../logger/logger.js';

/**
 * Register a new user.
 */
export async function register(req, res, next) {
    try {
        const { email, password, role } = req.body;
        const result = await authService.register({ email, password, role });

        // Don't return password hash
        delete result.user.password_hash;

        res.status(201).json({
            status: 'success',
            data: result
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Login a user.
 */
export async function login(req, res, next) {
    try {
        const { email, password } = req.body;
        const result = await authService.login({ email, password });

        delete result.user.password_hash;

        res.status(200).json({
            status: 'success',
            data: result
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Refresh access token.
 */
export async function refresh(req, res, next) {
    try {
        const { refresh_token } = req.body;
        const result = await authService.refresh(refresh_token);

        res.status(200).json({
            status: 'success',
            data: result
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Get current user profile.
 */
export async function me(req, res) {
    res.status(200).json({
        status: 'success',
        data: {
            user: req.user
        }
    });
}
