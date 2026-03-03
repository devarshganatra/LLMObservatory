import { z } from 'zod';

/**
 * Password strength: 8+ chars, 1+ number, 1+ letter.
 */
const passwordSchema = z.string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(/[a-zA-Z]/, 'Password must contain at least one letter')
    .regex(/[0-9]/, 'Password must contain at least one number');

/**
 * Registration schema.
 */
export const registerSchema = z.object({
    body: z.object({
        email: z.string().email('Invalid email format'),
        password: passwordSchema,
        role: z.enum(['user', 'admin']).optional()
    })
});

/**
 * Login schema.
 */
export const loginSchema = z.object({
    body: z.object({
        email: z.string().email('Invalid email format'),
        password: z.string() // Don't enforce strength on login, just presence
    })
});

/**
 * Refresh token schema.
 */
export const refreshSchema = z.object({
    body: z.object({
        refresh_token: z.string().min(1, 'Refresh token is required')
    })
});
