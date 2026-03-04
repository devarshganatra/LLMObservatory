import express from 'express';
import * as authController from '../controllers/auth.controller.js';
import { validate } from '../middleware/validate.js';
import { protect } from '../middleware/auth.middleware.js';
import { registerSchema, loginSchema, refreshSchema } from '../validations/auth.validation.js';
import { rateLimiter } from '../middleware/rateLimiter.middleware.js';

const router = express.Router();

/**
 * Rate limit for authentication endpoints (Distributed).
 * 5 attempts per minute for login/register.
 */
const authLimiter = rateLimiter({
    limit: 5,
    window: 60,
    keyType: 'ip'
});

/**
 * Stricter rate limit for refresh endpoint (Distributed).
 * 10 requests per minute.
 */
const refreshLimiter = rateLimiter({
    limit: 10,
    window: 60,
    keyType: 'user'
});

router.post('/register', authLimiter, validate(registerSchema), authController.register);
router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.post('/refresh', refreshLimiter, validate(refreshSchema), authController.refresh);

// Profile endpoint (protected)
router.get('/me', protect, authController.me);

export default router;
