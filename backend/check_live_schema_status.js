const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { pool } = require('./src/config/db');

async function checkSchemaStatus() {
    const client = await pool.connect();
    try {
        console.log('🔍 VERIFYING LIVE DATABASE SCHEMA...');

        const tablesToCheck = [
            { table: 'expenditures', column: 'created_at' },
            { table: 'library_books', column: 'created_at' },
            { table: 'announcements', column: 'created_at' }, // V2
            { table: 'leaves', column: 'created_at' },
            { table: 'notifications', column: 'created_at' },

            // V5 Checks (Teacher Assignments)
            { table: 'sections', column: 'class_teacher_id' },
            { table: 'classes', column: 'class_teacher_id' },

            // V6 Checks (Grades & Marks)
            { table: 'grades', column: 'grade_point' },
            { table: 'marks', column: 'year' },

            // V7 Checks (The Big Ones)
            { table: 'students', column: 'roll_number' },
            { table: 'students', column: 'admission_no' },
            { table: 'teachers', column: 'salary_per_day' },
            { table: 'staff', column: 'role' }
        ];

        let allGood = true;

        for (const check of tablesToCheck) {
            const res = await client.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = $1 AND column_name = $2
            `, [check.table, check.column]);

            if (res.rows.length > 0) {
                console.log(`✅ [${check.table}] . ${check.column} -> EXISTS`);
            } else {
                console.log(`❌ [${check.table}] . ${check.column} -> MISSING`);
                allGood = false;
            }
        }

        if (allGood) {
            console.log('\n🎉 SYSTEM STATUS: 100% HEALTHY. All columns present.');
            console.log('👉 If you still see errors, please CLEAR BROWSER CACHE.');
        } else {
            console.log('\n⚠️ SYSTEM STATUS: INCOMPLETE. Run the fix script again!');
        }

    } catch (e) {
        console.error('❌ Error checking schema:', e);
    } finally {
        client.release();
        pool.end();
    }
}

checkSchemaStatus();
