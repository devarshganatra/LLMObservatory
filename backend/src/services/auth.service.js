import bcrypt from 'bcrypt';
import * as userRepository from '../repositories/userRepository.js';
import * as jwtUtils from '../utils/jwt.js';
import { ValidationError, ConflictError } from '../errors/AppError.js';
import { logger } from '../logger/logger.js';

const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);

/**
 * Registers a new user.
 */
export async function register({ email, password }) {
    const existing = await userRepository.getUserByEmail(email);
    if (existing) {
        throw new ConflictError('User already exists');
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await userRepository.createUser({ email, passwordHash });

    logger.info({ userId: user.id }, 'User registered successfully');

    const tokens = generateTokens(user);
    return { user, ...tokens };
}

/**
 * Logs in a user.
 */
export async function login({ email, password }) {
    const user = await userRepository.getUserByEmail(email);

    // Generic error message for security (prevent user enumeration)
    const invalidCredentialsError = new ValidationError('Invalid credentials');

    if (!user) {
        logger.warn({ email }, 'Login attempt for non-existent user');
        throw invalidCredentialsError;
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
        logger.warn({ userId: user.id }, 'Login attempt with invalid password');
        throw invalidCredentialsError;
    }

    logger.info({ userId: user.id }, 'User logged in successfully');

    const tokens = generateTokens(user);
    return { user, ...tokens };
}

/**
 * Refreshes access token using refresh token.
 */
export async function refresh(refreshToken) {
    try {
        const decoded = jwtUtils.verifyRefreshToken(refreshToken);

        // Security: Prevent using access tokens for refresh
        if (decoded.type !== 'refresh') {
            throw new ValidationError('Invalid or expired token');
        }

        const user = await userRepository.getUserById(decoded.user_id);

        if (!user || user.token_version !== decoded.token_version) {
            throw new ValidationError('Invalid or expired token');
        }

        // Rotation: Issue new access AND refresh tokens
        const tokens = generateTokens(user);

        logger.info({ userId: user.id }, 'Token refreshed successfully');
        return tokens;
    } catch (err) {
        logger.error({ err }, 'Token refresh failed');
        throw new ValidationError('Invalid or expired token');
    }
}

/**
 * Generates access and refresh tokens for a user.
 */
function generateTokens(user) {
    const payload = {
        user_id: user.id,
        email: user.email,
        role: user.role,
        token_version: user.token_version
    };

    return {
        access_token: jwtUtils.signAccessToken(payload),
        refresh_token: jwtUtils.signRefreshToken(payload)
    };
}
