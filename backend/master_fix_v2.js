const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { pool } = require('./src/config/db');

async function masterFixV2() {
    const client = await pool.connect();
    try {
        console.log('🚀 Starting MASTER DB REPAIR V2...');
        await client.query('BEGIN');

        // ===============================================
        // 1. FIX "FAILED TO LOAD TEACHERS/STAFF"
        // (Missing columns from v2 schema)
        // ===============================================
        console.log('🔧 Fixing Teachers/Staff Names & Constraints...');

        const tables = ['students', 'teachers', 'staff'];
        for (const t of tables) {
            // A. Ensure 'name' exists
            await client.query(`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS name VARCHAR(255)`);

            // B. Relax 'first_name', 'last_name' constraints if they exist
            const fnCheck = await client.query(`SELECT 1 FROM information_schema.columns WHERE table_name=$1 AND column_name='first_name'`, [t]);
            if (fnCheck.rows.length > 0) await client.query(`ALTER TABLE ${t} ALTER COLUMN first_name DROP NOT NULL`);

            const lnCheck = await client.query(`SELECT 1 FROM information_schema.columns WHERE table_name=$1 AND column_name='last_name'`, [t]);
            if (lnCheck.rows.length > 0) await client.query(`ALTER TABLE ${t} ALTER COLUMN last_name DROP NOT NULL`);
        }

        // C. Populate NULL names
        try {
            await client.query(`UPDATE students SET name = TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, 'Unknown')) WHERE name IS NULL`);
            await client.query(`UPDATE teachers SET name = COALESCE(email, 'Teacher') WHERE name IS NULL`);
            await client.query(`UPDATE staff SET name = COALESCE(email, 'Staff') WHERE name IS NULL`);
        } catch (e) { console.log('   (Skipping name population due to missing source cols)'); }

        // ===============================================
        // 2. FIX "FAILED TO PROMOTE STUDENTS"
        // (Missing promotions table)
        // ===============================================
        console.log('🔧 Fixing Student Promotions Table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS student_promotions (
                id SERIAL PRIMARY KEY,
                school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
                student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
                from_class_id INTEGER,
                from_section_id INTEGER,
                to_class_id INTEGER,
                to_section_id INTEGER,
                promotion_date DATE DEFAULT CURRENT_DATE,
                status VARCHAR(50) DEFAULT 'Promoted',
                academic_year_id INTEGER REFERENCES academic_years(id) ON DELETE SET NULL,
                generated_certificate_id INTEGER -- Link to leaving certificate if any
            );
        `);
        // Add columns if table existed but was old
        await client.query(`ALTER TABLE student_promotions ADD COLUMN IF NOT EXISTS academic_year_id INTEGER REFERENCES academic_years(id) ON DELETE SET NULL`);
        await client.query(`ALTER TABLE student_promotions ADD COLUMN IF NOT EXISTS generated_certificate_id INTEGER`);

        // ===============================================
        // 3. FIX "FAILED TO LOAD DATA" (Missing academic_year_id)
        // ===============================================
        console.log('🔧 Linking Academic Years to Modules...');
        const modules = ['attendance', 'marks', 'fee_payments', 'salary_payments', 'expenditures', 'exam_schedules'];
        for (const m of modules) {
            await client.query(`ALTER TABLE ${m} ADD COLUMN IF NOT EXISTS academic_year_id INTEGER REFERENCES academic_years(id) ON DELETE SET NULL`);
        }

        // ===============================================
        // 4. FIX "FAILED TO LOAD PROFILE" (Missing transport/other cols)
        // ===============================================
        console.log('🔧 Adding missing profile columns...');
        await client.query(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS transport_route_id INTEGER`);
        await client.query(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS salary_per_day DECIMAL(10,2) DEFAULT 0`);
        await client.query(`ALTER TABLE staff ADD COLUMN IF NOT EXISTS transport_route_id INTEGER`);
        await client.query(`ALTER TABLE staff ADD COLUMN IF NOT EXISTS salary_per_day DECIMAL(10,2) DEFAULT 0`);

        await client.query('COMMIT');
        console.log('🎉 MASTER REPAIR COMPLETE! All systems should be operational.');

    } catch (e) {
        await client.query('ROLLBACK');
        console.error('❌ Error in Master Fix:', e);
    } finally {
        client.release();
        pool.end();
    }
}

masterFixV2();
