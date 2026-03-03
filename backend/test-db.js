import 'dotenv/config';
import pool from './src/db/connection.js';

async function test() {
    try {
        const res = await pool.query('SELECT NOW()');
        console.log('Connected successfully:', res.rows[0]);
        process.exit(0);
    } catch (err) {
        console.error('DB connection failed:', err);
        process.exit(1);
    }
}

test();