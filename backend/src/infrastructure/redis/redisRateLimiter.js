import redisClient from './redisClient.js';
import { logger } from '../../logger/logger.js';

/**
 * Token Bucket Rate Limiter using Redis.
 * 
 * Logic:
 * Each bucket (key) has:
 * - tokens: current available tokens
 * - last_refill: timestamp of last refill
 * 
 * Atomic refills and deductions are handled via Redis Lua-like behavior 
 * or multi/exec if needed, but here we use a simple script-like approach with 
 * a single HGETALL and HSET for simplicity in this implementation, 
 * or ideally a Lua script for true atomicity.
 * 
 * For production, we will use a small Lua script to ensure atomicity.
 */

const RATE_LIMIT_SCRIPT = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
local tokens = tonumber(bucket[1])
local last_refill = tonumber(bucket[2])

if not tokens then
  tokens = limit
  last_refill = now
else
  local elapsed = math.max(0, now - last_refill)
  local refill = math.floor(elapsed * refill_rate)
  tokens = math.min(limit, tokens + refill)
  last_refill = now
end

local allowed = tokens >= 1
if allowed then
  tokens = tokens - 1
end

redis.call('HMSET', key, 'tokens', tokens, 'last_refill', last_refill)
redis.call('EXPIRE', key, 3600) -- Bucket expires after 1 hour of inactivity

return {tostring(allowed), tokens}
`;

export async function checkRateLimit(key, limit, windowSeconds) {
    const client = redisClient.getInstance();

    // Fail open: If Redis is unavailable, allow request but log warning
    if (!client || !redisClient.isConnected) {
        logger.warn({ key }, 'Redis unavailable: Rate limiting failed open');
        return { allowed: true, remaining: limit };
    }

    const refillRate = limit / windowSeconds;
    const now = Math.floor(Date.now() / 1000);

    try {
        // Evaluation in Redis for atomicity
        const [allowedStr, remaining] = await client.eval(RATE_LIMIT_SCRIPT, {
            keys: [key],
            arguments: [limit.toString(), refillRate.toString(), now.toString()]
        });

        const allowed = allowedStr === 'true';

        if (!allowed) {
            logger.warn({ event: 'rate_limit_triggered', key }, 'Rate limit exceeded');
        }

        return {
            allowed,
            remaining: Math.max(0, parseInt(remaining))
        };
    } catch (err) {
        logger.error({ err, key }, 'Redis Rate Limiter Error');
        // Fail open on error
        return { allowed: true, remaining: limit };
    }
}
