/**
 * User Repository — SQL-only data access layer
 */

import pool from '../db/connection.js';

/**
 * Normalizes email to lowercase.
 */
function normalizeEmail(email) {
    return email.toLowerCase().trim();
}

/**
 * Creates a new user record.
 */
export async function createUser({ email, passwordHash, role = 'user' }) {
    const normalizedEmail = normalizeEmail(email);
    const result = await pool.query(
        `INSERT INTO users (email, password_hash, role)
         VALUES ($1, $2, $3)
         RETURNING id, email, role, token_version, created_at`,
        [normalizedEmail, passwordHash, role]
    );
    return result.rows[0];
}

/**
 * Finds a user by email.
 */
export async function getUserByEmail(email) {
    const normalizedEmail = normalizeEmail(email);
    const result = await pool.query(
        `SELECT id, email, password_hash, role, token_version, created_at
         FROM users
         WHERE email = $1`,
        [normalizedEmail]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Finds a user by ID.
 */
export async function getUserById(id) {
    const result = await pool.query(
        `SELECT id, email, role, token_version, created_at
         FROM users
         WHERE id = $1`,
        [id]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Increments token version (forced logout).
 */
export async function incrementTokenVersion(id) {
    await pool.query(
        `UPDATE users SET token_version = token_version + 1 WHERE id = $1`,
        [id]
    );
}
