const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { pool } = require('./src/config/db');

async function masterFixFinal() {
    const client = await pool.connect();
    try {
        console.log('🚀 Starting MASTER DB REPAIR FINAL...');
        await client.query('BEGIN');

        // ===============================================
        // 1. FIX STUDENTS TABLE (Base)
        // ===============================================
        console.log('🔧 Fixing Students Table...');
        await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS name VARCHAR(255)`);
        await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS academic_year VARCHAR(50)`); // Fix for promotionController
        // Relax constraints
        await client.query(`ALTER TABLE students ALTER COLUMN first_name DROP NOT NULL`);
        await client.query(`ALTER TABLE students ALTER COLUMN last_name DROP NOT NULL`);
        // Populate name if missing
        await client.query(`UPDATE students SET name = TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, 'Unknown')) WHERE name IS NULL`);

        // ===============================================
        // 2. FIX TEACHERS & STAFF
        // ===============================================
        console.log('🔧 Fixing Teachers/Staff...');
        for (const t of ['teachers', 'staff']) {
            await client.query(`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS name VARCHAR(255)`);
            await client.query(`ALTER TABLE ${t} ALTER COLUMN first_name DROP NOT NULL`);
            await client.query(`ALTER TABLE ${t} ALTER COLUMN last_name DROP NOT NULL`);
            // Add missing profile columns found in generic load errors
            await client.query(`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS transport_route_id INTEGER`);
            await client.query(`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS salary_per_day DECIMAL(10,2) DEFAULT 0`);
        }

        // ===============================================
        // 3. FIX PROMOTIONS (Critical Code mismatch found)
        // Code expects 'to_academic_year' (string), DB had 'academic_year_id'
        // ===============================================
        console.log('🔧 Fixing Student Promotions Table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS student_promotions (
                id SERIAL PRIMARY KEY,
                school_id INTEGER,
                student_id INTEGER,
                from_class_id INTEGER,
                to_class_id INTEGER,
                promotion_date DATE DEFAULT CURRENT_DATE
            );
        `);
        // Ensure ALL columns used by promotionController exist
        const promotionCols = [
            'from_section_id INTEGER',
            'to_section_id INTEGER',
            'from_academic_year VARCHAR(50)', // Code uses this string
            'to_academic_year VARCHAR(50)',   // Code uses this string
            'status VARCHAR(50) DEFAULT \'Promoted\'',
            'promoted_by INTEGER',
            'notes TEXT',
            'academic_year_id INTEGER', // Backup ID link
            'generated_certificate_id INTEGER'
        ];

        for (const colDef of promotionCols) {
            const colName = colDef.split(' ')[0];
            await client.query(`ALTER TABLE student_promotions ADD COLUMN IF NOT EXISTS ${colName} ${colDef.replace(colName, '')}`);
        }

        // ===============================================
        // 4. FIX LEAVES (Controller uses s.name join)
        // ===============================================
        console.log('🔧 Fixing Leaves Table...');
        // Ensure leave table has necessary columns if any (seems fine, issue was in join which is fixed by adding name to students)

        // ===============================================
        // 5. FIX MARKS & EXAMS
        // ===============================================
        console.log('🔧 Fixing Marks Schema...');
        await client.query(`ALTER TABLE marks ADD COLUMN IF NOT EXISTS component_scores JSONB DEFAULT '{}'`);
        // Ensure marks table matches json usage in controller

        await client.query('COMMIT');
        console.log('🎉 FINAL REPAIR COMPLETE! Code <-> Schema should now be perfectly synced.');

    } catch (e) {
        await client.query('ROLLBACK');
        console.error('❌ Error in Final Fix:', e);
    } finally {
        client.release();
        pool.end();
    }
}

masterFixFinal();
