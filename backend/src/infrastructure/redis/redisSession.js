import redisClient from './redisClient.js';
import { logger } from '../../logger/logger.js';
import { redisKeys } from './redisKeys.js';

/**
 * JWT Session and Token Revocation Service.
 */

export const redisSession = {
    /**
     * Revoke a specific token JTI and add it to the user's active session set.
     * This allows both individual token revocation and "logout all".
     */
    async revokeToken(userId, jti, expiresInSeconds) {
        const client = redisClient.getInstance();
        if (!client || !redisClient.isConnected) return false;

        try {
            const tokenKey = redisKeys.session.revokedToken(jti);
            const userSessionsKey = redisKeys.session.userSessions(userId);

            await Promise.all([
                // Store JTI in a string key with TTL for standard revocation check
                client.set(tokenKey, '1', { EX: expiresInSeconds }),
                // Add JTI to the user's active set
                client.sAdd(userSessionsKey, jti),
                // Ensure the session set itself has a reasonable TTL (e.g., 7 days or max token age)
                client.expire(userSessionsKey, 7 * 24 * 3600)
            ]);

            logger.info({ event: 'token_revoked', jti, userId }, 'Token Revoked');
            return true;
        } catch (err) {
            logger.error({ err, jti, userId }, 'Redis Token Revocation Error');
            return false;
        }
    },

    /**
     * Check if a token JTI is revoked.
     * Fail-open: If Redis is down, assume token is valid.
     */
    async isTokenRevoked(jti) {
        const client = redisClient.getInstance();
        if (!client || !redisClient.isConnected) return false;

        try {
            const key = redisKeys.session.revokedToken(jti);
            const exists = await client.exists(key);
            return exists === 1;
        } catch (err) {
            logger.error({ err, jti }, 'Redis Revocation Check Error');
            return false;
        }
    },

    /**
     * Revoke all sessions for a specific user.
     */
    async logoutAll(userId) {
        const client = redisClient.getInstance();
        if (!client || !redisClient.isConnected) return false;

        try {
            const userSessionsKey = redisKeys.session.userSessions(userId);
            const jtis = await client.sMembers(userSessionsKey);

            if (jtis.length > 0) {
                const pipeline = client.multi();
                for (const jti of jtis) {
                    pipeline.set(redisKeys.session.revokedToken(jti), '1', { EX: 3600 }); // Short TTL for mass revocation safety
                }
                pipeline.del(userSessionsKey);
                await pipeline.exec();
            }

            logger.info({ event: 'logout_all_sessions', userId }, 'All User Sessions Revoked');
            return true;
        } catch (err) {
            logger.error({ err, userId }, 'Redis LogoutAll Error');
            return false;
        }
    }
};
