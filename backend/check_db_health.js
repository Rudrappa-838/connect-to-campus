const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { pool } = require('./src/config/db');

async function checkHealth() {
    const client = await pool.connect();
    try {
        console.log('🏥 Starting Database Health Check...');

        const requiredTables = [
            'schools', 'users', 'classes', 'sections', 'subjects', 'students', 'teachers', 'staff',
            'school_holidays', 'events', 'notifications', 'announcements',
            'leaves', 'exam_types', 'exam_components', 'exam_schedules', 'marks', 'mark_components',
            'timetables', 'library_books', 'library_transactions',
            'hostels', 'hostel_rooms', 'hostel_allocations', 'hostel_mess_bills', 'hostel_payments',
            'transport_vehicles', 'transport_routes', 'transport_stops',
            'fee_structures', 'student_fees', 'fee_payments',
            'salary_payments', 'expenditures',
            'doubts', 'student_certificates', 'admissions_enquiries',
            'attendance', 'teacher_attendance', 'staff_attendance'
        ];

        const missingTables = [];
        const missingColumns = [];

        for (const table of requiredTables) {
            // Check Table
            const res = await client.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = $1
                );
            `, [table]);

            if (!res.rows[0].exists) {
                missingTables.push(table);
                console.log(`❌ Missing Table: ${table}`);
            } else {
                // Check Critical Columns for existing tables
                if (table === 'schools') {
                    await checkColumn(client, table, 'is_active', missingColumns);
                    await checkColumn(client, table, 'status', missingColumns);
                    await checkColumn(client, table, 'school_code', missingColumns);
                }
                if (table === 'users') {
                    await checkColumn(client, table, 'school_id', missingColumns);
                    await checkColumn(client, table, 'current_session_token', missingColumns);
                }
                if (table === 'students') {
                    await checkColumn(client, table, 'admission_date', missingColumns);
                    await checkColumn(client, table, 'status', missingColumns);
                }
            }
        }

        console.log('\n--- DIAGNOSTIC REPORT ---');
        if (missingTables.length === 0 && missingColumns.length === 0) {
            console.log('✅ ALL TABLES AND CRITICAL COLUMNS EXIST.');
            console.log('The database structure is PERFECT.');
        } else {
            if (missingTables.length > 0) console.log(`⚠️  MISSING TABLES (${missingTables.length}):`, missingTables.join(', '));
            if (missingColumns.length > 0) console.log(`⚠️  MISSING COLUMNS (${missingColumns.length}):`, missingColumns.join(', '));
            console.log('\n👉 SOLUTION: You MUST run "node backend/fix_db_schema_final.js" to fix this.');
        }

    } catch (e) {
        console.error('❌ Check Failed:', e);
    } finally {
        client.release();
        pool.end();
    }
}

async function checkColumn(client, table, column, list) {
    const res = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = $1 AND column_name = $2
    `, [table, column]);
    if (res.rows.length === 0) {
        console.log(`❌ Missing Column: ${table}.${column}`);
        list.push(`${table}.${column}`);
    }
}

checkHealth();
