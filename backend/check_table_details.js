const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { pool } = require('./src/config/db');

async function checkSchema() {
    try {
        console.log('🔍 Checking Schema Details...');
        const tables = ['students', 'student_promotions', 'fee_structures', 'marks'];

        for (const table of tables) {
            const res = await pool.query(`
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns 
                WHERE table_name = '${table}'
                ORDER BY column_name;
            `);
            console.log(`\n📋 TABLE: ${table}`);
            if (res.rows.length === 0) {
                console.log('   (Table does not exist!)');
            } else {
                res.rows.forEach(r => console.log(`   - ${r.column_name} (${r.data_type})`));
            }
        }
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

checkSchema();
