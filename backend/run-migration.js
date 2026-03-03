import fs from 'fs';
import pool from './src/db/connection.js';

async function migrate() {
    try {
        const sql = fs.readFileSync('./migrations/006_auth.sql', 'utf8');
        console.log('Running migration 006_auth.sql...');
        await pool.query(sql);
        console.log('✅ Migration successful');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        process.exit(1);
    }
}

migrate();
