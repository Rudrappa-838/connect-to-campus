const { pool } = require('./src/config/db');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function diagnose() {
    const client = await pool.connect();
    try {
        console.log('🔍 STARTING SERVER DIAGNOSTICS...');

        // 1. Check School ID (Assume 1 or find first)
        const schoolRes = await client.query('SELECT id FROM schools LIMIT 1');
        const schoolId = schoolRes.rows[0]?.id;
        console.log(`🏫 School ID found: ${schoolId}`);

        if (!schoolId) {
            console.error('❌ CRITICAL: No schools found in DB!');
            return;
        }

        // 2. CHECK FEES CONFIGURATION (Students Query)
        console.log('\n--- 💰 DIAGNOSING FEES (Students Loading) ---');
        // Find a class
        const classRes = await client.query('SELECT id, name FROM classes WHERE school_id = $1 LIMIT 1', [schoolId]);
        if (classRes.rows.length === 0) {
            console.log('⚠️ No Class found for school. Fee Config needs classes.');
        } else {
            const cls = classRes.rows[0];
            console.log(`Found Class: ${cls.name} (ID: ${cls.id})`);

            // Try the QUERY from feeController.getFeeAllocations
            const studentQuery = `SELECT id, name, admission_no, section_id FROM students WHERE school_id = $1 AND class_id = $2 ORDER BY name ASC`;
            try {
                const sRes = await client.query(studentQuery, [schoolId, cls.id]);
                console.log(`✅ Student Query Success. Found ${sRes.rows.length} students in class ${cls.id}.`);
                if (sRes.rows.length > 0) console.log('Sample:', sRes.rows[0]);
            } catch (e) {
                console.error('❌ Student Query FAILED:', e.message);
            }
        }

        // 3. CHECK ANNOUNCEMENTS
        console.log('\n--- 📢 DIAGNOSING ANNOUNCEMENTS ---');
        // Try the QUERY from calendarController.getAnnouncements (Simplified)
        const annQuery = `
            SELECT a.*, c.name as class_name 
            FROM announcements a
            LEFT JOIN classes c ON a.class_id = c.id
            WHERE a.school_id = $1
            LIMIT 5
        `;
        try {
            const aRes = await client.query(annQuery, [schoolId]);
            console.log(`✅ Announcement Query Success. Found ${aRes.rows.length} items.`);
        } catch (e) {
            console.error('❌ Announcement Query FAILED:', e.message);
        }

        // 4. CHECK TABLE COLUMNS (Double Check)
        console.log('\n--- 🛠 SCHEMA CHECK ---');
        const checkCols = async (table) => {
            const res = await client.query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = $1
            `, [table]);
            console.log(`Table '${table}' has ${res.rows.length} columns.`);
            // console.log(res.rows.map(r => r.column_name).join(', '));
        };
        await checkCols('students');
        await checkCols('announcements');
        await checkCols('fee_structures');

    } catch (e) {
        console.error('❌ DIAGNOSTIC CRASHED:', e);
    } finally {
        client.release();
        pool.end();
    }
}

diagnose();
