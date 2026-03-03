import { v4 } from 'uuid';

/**
 * Generates and attaches X-Request-ID to requests and responses.
 */
export const requestId = (req, res, next) => {
    const id = req.headers['x-request-id'] || v4();
    req.requestId = id;
    res.setHeader('X-Request-ID', id);
    next();
};
