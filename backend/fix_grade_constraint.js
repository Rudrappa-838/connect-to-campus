const { pool } = require('./src/config/db');

async function fix() {
    try {
        console.log('🔧 Fixing Grade Constraints...');

        // 1. Drop the bad constraint
        await pool.query(`
            ALTER TABLE grades 
            DROP CONSTRAINT IF EXISTS unique_grade_name_per_school
        `);
        console.log('✅ Dropped constraint: unique_grade_name_per_school');

        // 2. Add the correct constraint (Unique per Exam Type)
        await pool.query(`
            ALTER TABLE grades 
            ADD CONSTRAINT unique_grade_name_per_exam 
            UNIQUE (school_id, exam_type_id, name)
        `);
        console.log('✅ Added constraint: unique_grade_name_per_exam');

        console.log('🎉 Fix Applied Successfully!');
        process.exit(0);

    } catch (e) {
        console.error('❌ Error fixing constraints:', e);
        process.exit(1);
    }
}

fix();
