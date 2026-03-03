import express from 'express';
import rateLimit from 'express-rate-limit';
import * as authController from '../controllers/auth.controller.js';
import { validate } from '../middleware/validate.js';
import { protect } from '../middleware/auth.middleware.js';
import { registerSchema, loginSchema, refreshSchema } from '../validations/auth.validation.js';

const router = express.Router();

/**
 * Rate limit for authentication endpoints.
 * 5 attempts per 15 minutes for login/register.
 */
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10, // Slightly more generous for dev
    message: {
        status: 'fail',
        message: 'Too many requests from this IP, please try again after 15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Stricter rate limit for refresh endpoint.
 * 10 requests per minute.
 */
const refreshLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: {
        status: 'fail',
        message: 'Too many refresh attempts, please try again after a minute'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

router.post('/register', authLimiter, validate(registerSchema), authController.register);
router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.post('/refresh', refreshLimiter, validate(refreshSchema), authController.refresh);

// Profile endpoint (protected)
router.get('/me', protect, authController.me);

export default router;
