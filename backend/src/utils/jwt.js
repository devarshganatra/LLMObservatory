import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

/**
 * Signs an access token.
 */
export function signAccessToken(payload) {
    return jwt.sign({ ...payload, type: 'access', jti: uuidv4() }, process.env.JWT_ACCESS_SECRET, {
        expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m'
    });
}

/**
 * Signs a refresh token.
 */
export function signRefreshToken(payload) {
    return jwt.sign({ ...payload, type: 'refresh', jti: uuidv4() }, process.env.JWT_REFRESH_SECRET, {
        expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d'
    });
}

/**
 * Verifies an access token.
 */
export function verifyAccessToken(token) {
    return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
}

/**
 * Verifies a refresh token.
 */
export function verifyRefreshToken(token) {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
}
