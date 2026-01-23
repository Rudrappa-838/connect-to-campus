const { pool } = require('./src/config/db');
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

async function fixData() {
    const client = await pool.connect();
    try {
        console.log('🚀 INITIALIZING FINAL DATA FIX (DATA POPULATION)...');
        await client.query('BEGIN');

        const schoolRes = await client.query('SELECT id FROM schools LIMIT 1');
        const schoolId = schoolRes.rows[0]?.id;
        if (!schoolId) throw new Error('No school found');

        // 1. FIX EXPENDITURES (Ensure Columns Exist)
        console.log('🔧 Verifying Finance Tables...');
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
        // Add missing columns if table existed but was old
        await client.query(`ALTER TABLE expenditures ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(100)`);
        await client.query(`ALTER TABLE expenditures ADD COLUMN IF NOT EXISTS upi_id VARCHAR(100)`);
        await client.query(`ALTER TABLE expenditures ADD COLUMN IF NOT EXISTS created_by INTEGER`);

        // 2. FIX STUDENTS (Class/Section Linkage)
        console.log('🔧 Fixing Student Class Assignments...');

        // Ensure at least one class exists
        let classRes = await client.query('SELECT id FROM classes WHERE school_id = $1 LIMIT 1', [schoolId]);
        let classId;
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

        // Assign NULL class_id students to this class
        const updateClassRes = await client.query(
            'UPDATE students SET class_id = $1 WHERE class_id IS NULL AND school_id = $2',
            [classId, schoolId]
        );
        console.log(`✅ Assigned ${updateClassRes.rowCount} students to Class ID ${classId}`);

        // Ensure at least one section exists
        let secRes = await client.query('SELECT id FROM sections WHERE class_id = $1 LIMIT 1', [classId]);
        let sectionId;
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

        // Assign NULL section_id students to this section
        const updateSecRes = await client.query(
            'UPDATE students SET section_id = $1 WHERE section_id IS NULL AND school_id = $2',
            [sectionId, schoolId]
        );
        console.log(`✅ Assigned ${updateSecRes.rowCount} students to Section ID ${sectionId}`);

        // 3. ANNOUNCEMENTS (Fix Date Type)
        console.log('🔧 Fixing Announcements Schema...');
        try {
            // Attempt to alter column type safely
            await client.query(`ALTER TABLE announcements ALTER COLUMN valid_until TYPE DATE USING valid_until::DATE`);
        } catch (e) {
            console.log('⚠️ Could not alter valid_until type (might be null or incompatible). Ignoring.');
        }

        await client.query('COMMIT');
        console.log('✅ DATA FIX COMPLETE.');

    } catch (e) {
        await client.query('ROLLBACK');
        console.error('❌ Data Fix Failed:', e);
    } finally {
        client.release();
        pool.end();
    }
}

fixData();
