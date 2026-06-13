/**
 * Run Subject Combination Migration
 * Usage: node run_subject_combination_migration.js
 */
const { pool } = require('../config/db');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    const client = await pool.connect();
    try {
        console.log('🚀 Running Subject Combination migration...');
        const sql = fs.readFileSync(
            path.join(__dirname, 'add_subject_combination_tables.sql'),
            'utf8'
        );
        await client.query(sql);
        console.log('✅ Subject Combination tables created successfully!');
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration();
