/**
 * Base class for operational errors.
 */
export class AppError extends Error {
    constructor(message, statusCode, errorCode, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.errorCode = errorCode;
        this.isOperational = isOperational;
        Error.captureStackTrace(this, this.constructor);
    }
}

export class NotFoundError extends AppError {
    constructor(message = 'Resource not found', errorCode = 'NOT_FOUND') {
        super(message, 404, errorCode);
    }
}

export class ValidationError extends AppError {
    constructor(message = 'Validation failed', details = [], errorCode = 'VALIDATION_ERROR') {
        super(message, 400, errorCode);
        this.details = details;
    }
}

export class DatabaseError extends AppError {
    constructor(message = 'Database operation failed', errorCode = 'DATABASE_ERROR') {
        super(message, 500, errorCode);
    }
}

export class ConflictError extends AppError {
    constructor(message = 'Conflict detected', errorCode = 'CONFLICT') {
        super(message, 409, errorCode);
    }
}
