const { pool } = require('./src/config/db');

async function checkSchema() {
    try {
        console.log('--- Checking Schools Table Columns (for logo) ---');
        const schoolsQuery = `
            SELECT column_name, data_type, character_maximum_length
            FROM information_schema.columns 
            WHERE table_name = 'schools' AND column_name = 'logo';
        `;
        const schoolsRes = await pool.query(schoolsQuery);
        console.log(schoolsRes.rows);

        console.log('\n--- Checking Academic Years Table Columns ---');
        const academicYearsQuery = `
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'academic_years';
        `;
        const academicRes = await pool.query(academicYearsQuery);
        console.log('Columns:', academicRes.rows.map(r => r.column_name));

        console.log('\n--- Checking Events Table Columns (for Calendar) ---');
        const eventsQuery = `
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'events';
        `;
        const eventsRes = await pool.query(eventsQuery);
        console.log('Columns:', eventsRes.rows.map(r => r.column_name));

    } catch (err) {
        console.error('Error checking schema:', err);
    } finally {
        pool.end();
    }
}

checkSchema();
