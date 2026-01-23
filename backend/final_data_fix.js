const { pool } = require('./src/config/db');
const path = require('path');
const dotenv = require('dotenv');

// 1. Load Environment Variables
const envPath = path.join(__dirname, '.env');
const result = dotenv.config({ path: envPath });

console.log(`[DEBUG] Loading .env from: ${envPath}`);
if (result.error) {
    console.log('[DEBUG] Error loading .env:', result.error.message);
} else {
    console.log('[DEBUG] .env loaded successfully');
}

// 2. Debug API/DB Credentials (Sanitized)
const dbUrl = process.env.DATABASE_URL || '';
console.log('[DEBUG] DB_USER:', process.env.DB_USER ? 'SET' : 'MISSING');
console.log('[DEBUG] DB_HOST:', process.env.DB_HOST ? 'SET' : 'MISSING');
console.log('[DEBUG] DATABASE_URL:', dbUrl ? `SET (Length: ${dbUrl.length})` : 'MISSING');
console.log('[DEBUG] NODE_ENV:', process.env.NODE_ENV);

if (!dbUrl && !process.env.DB_HOST) {
    console.error('❌ CRITICAL: No Database Configuration Found. Please check your .env file.');
    process.exit(1);
}

// 3. Main Data Fix Function
async function fixData() {
    let client;
    try {
        console.log('🚀 CONNECTING TO DATABASE...');
        client = await pool.connect();
        console.log('✅ Connected.');

        await client.query('BEGIN');
        console.log('🔄 Transaction Started.');

        // -- Check School --
        const schoolRes = await client.query('SELECT id FROM schools LIMIT 1');
        const schoolId = schoolRes.rows[0]?.id;
        if (!schoolId) {
            throw new Error('No school found in database. Cannot fix data.');
        }
        console.log(`🏫 Found School ID: ${schoolId}`);

        // -- 1. Fix Expenditures Table --
        console.log('🔧 Verifying Expenditures Table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS expenditures (
                id SERIAL PRIMARY KEY,
                school_id INTEGER,
                title VARCHAR(255),
                amount DECIMAL(10, 2),
                category VARCHAR(100),
                description TEXT,
                expense_date DATE DEFAULT CURRENT_DATE,
                payment_method VARCHAR(50),
                transaction_id VARCHAR(100),
                upi_id VARCHAR(100),
                created_by INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        // Add columns if missing
        await client.query(`ALTER TABLE expenditures ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(100)`);
        await client.query(`ALTER TABLE expenditures ADD COLUMN IF NOT EXISTS upi_id VARCHAR(100)`);
        await client.query(`ALTER TABLE expenditures ADD COLUMN IF NOT EXISTS created_by INTEGER`);
        console.log('✅ Expenditures Table Verified.');

        // -- 2. Fix Student Class Links --
        console.log('🔧 Fixing Student Class Assignments...');

        let classId;
        const classRes = await client.query('SELECT id FROM classes WHERE school_id = $1 LIMIT 1', [schoolId]);
        if (classRes.rows.length === 0) {
            console.log('⚠️ No classes found. Creating "Grade 1"...');
            const newClass = await client.query(
                'INSERT INTO classes (school_id, name, section_count) VALUES ($1, $2, $3) RETURNING id',
                [schoolId, 'Grade 1', 1]
            );
            classId = newClass.rows[0].id;
        } else {
            classId = classRes.rows[0].id;
        }

        const updateClassRes = await client.query(
            'UPDATE students SET class_id = $1 WHERE (class_id IS NULL OR class_id = 0) AND school_id = $2',
            [classId, schoolId]
        );
        console.log(`✅ Assigned ${updateClassRes.rowCount} students to Class ID ${classId}`);

        // -- 3. Fix Student Section Links --
        let sectionId;
        const secRes = await client.query('SELECT id FROM sections WHERE class_id = $1 LIMIT 1', [classId]);
        if (secRes.rows.length === 0) {
            console.log('⚠️ No sections found. Creating "Section A"...');
            const newSec = await client.query(
                'INSERT INTO sections (school_id, class_id, name) VALUES ($1, $2, $3) RETURNING id',
                [schoolId, classId, 'A']
            );
            sectionId = newSec.rows[0].id;
        } else {
            sectionId = secRes.rows[0].id;
        }

        const updateSecRes = await client.query(
            'UPDATE students SET section_id = $1 WHERE (section_id IS NULL OR section_id = 0) AND school_id = $2',
            [sectionId, schoolId]
        );
        console.log(`✅ Assigned ${updateSecRes.rowCount} students to Section ID ${sectionId}`);

        // -- 4. Fix Announcements Schema --
        console.log('🔧 Fixing Announcements Schema...');
        try {
            await client.query(`ALTER TABLE announcements ALTER COLUMN valid_until TYPE DATE USING valid_until::DATE`);
        } catch (e) {
            console.log('ℹ️ Announcement date fix skipped (already correct or empty).');
        }

        await client.query('COMMIT');
        console.log('✅ DATA FIX COMPLETE. ALL SYSTEMS GO.');

    } catch (e) {
        if (client) await client.query('ROLLBACK');
        console.error('❌ Data Fix Failed:', e);
        process.exit(1);
    } finally {
        if (client) client.release();
        pool.end();
    }
}

fixData();
