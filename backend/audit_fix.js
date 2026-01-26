const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { pool } = require('./src/config/db');

async function auditFix() {
    const client = await pool.connect();
    try {
        console.log('🚀 Starting FINAL AUDIT FIX (Hostel & Transport consistency)...');
        await client.query('BEGIN');

        // ===============================================
        // 1. FIX HOSTEL CONTROLLER DEPENDENCY
        // (Controller selects s.parent_name, but table likely has father_name)
        // ===============================================
        console.log('🔧 Fixing Student Parent Name Column...');
        // We add a generated column or just a standard column to satisfy the query
        // The controller expects 'parent_name'.
        await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS parent_name VARCHAR(255)`);

        // Auto-fill parent_name from father_name if empty
        await client.query(`UPDATE students SET parent_name = COALESCE(father_name, mother_name, 'Guardian') WHERE parent_name IS NULL`);

        // ===============================================
        // 2. FIX TRANSPORT COLUMNS ON STUDENTS
        // (Controller checks route_id, pickup_point on students table)
        // ===============================================
        console.log('🔧 Fixing Student Transport Columns...');
        await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS route_id INTEGER`);
        await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS pickup_point VARCHAR(255) DEFAULT 'School'`);
        await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS transport_mode VARCHAR(50) DEFAULT 'School Bus'`);

        // ===============================================
        // 3. FIX LIBRARY BOOKS
        // (Ensure basic columns exist)
        // ===============================================
        console.log('🔧 Fixing Library Schema...');
        await client.query(`ALTER TABLE library_books ADD COLUMN IF NOT EXISTS book_number VARCHAR(100)`);
        await client.query(`ALTER TABLE library_books ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Available'`);

        // ===============================================
        // 4. CLEANUP & SYNC
        // ===============================================
        console.log('✅ Audit Fix Applied successfully.');
        await client.query('COMMIT');

    } catch (e) {
        await client.query('ROLLBACK');
        console.error('❌ Error in Audit Fix:', e);
    } finally {
        client.release();
        pool.end();
    }
}

auditFix();
