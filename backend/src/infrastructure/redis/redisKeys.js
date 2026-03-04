/**
 * Centralized Redis key naming strategy.
 * Includes environment prefix to prevent collisions.
 */

const ENV = process.env.NODE_ENV || 'local';
const PREFIX = `${ENV}:llm_obs`;

export const redisKeys = {
    // Rate Limiting
    rateLimit: {
        ip: (ip) => `${PREFIX}:rate_limit:ip:${ip}`,
        user: (userId) => `${PREFIX}:rate_limit:user:${userId}`,
    },

    // Caching
    cache: {
        runsPage: (page) => `${PREFIX}:cache:runs:page:${page}`,
        run: (runId) => `${PREFIX}:cache:run:${runId}`,
        drift: (runId) => `${PREFIX}:cache:drift:${runId}`,
        insights: (runId) => `${PREFIX}:cache:insights:${runId}`,
    },

    // Sessions
    session: {
        revokedToken: (jti) => `${PREFIX}:session:revoked:${jti}`,
        userSessions: (userId) => `${PREFIX}:session:user_active:${userId}`,
    },

    // Patterns for invalidation
    patterns: {
        allRuns: `${PREFIX}:cache:runs:page:*`,
        runRelated: (runId) => `${PREFIX}:cache:*:${runId}*`,
    }
};
