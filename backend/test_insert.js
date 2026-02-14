const { pool } = require('./src/config/db');

async function testFullInsert() {
    const client = await pool.connect();
    try {
        console.log('Testing FULL insert...');
        await client.query('BEGIN');

        const schoolRes = await client.query('SELECT id FROM schools LIMIT 1');
        const schoolId = schoolRes.rows[0].id;
        const classRes = await client.query('SELECT id FROM classes WHERE school_id = $1 LIMIT 1', [schoolId]);
        const classId = classRes.rows[0].id;
        const admissionNo = 'TESTF' + Math.floor(Math.random() * 10000);

        const query = `
            INSERT INTO students 
            (school_id, name, first_name, last_name, admission_no, roll_number, gender, dob, class_id, section_id, 
             father_name, mother_name, contact_number, email, address, attendance_id, admission_date) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING id
        `;

        const values = [
            schoolId,
            'Test Full',
            'Test',
            'Full',
            admissionNo,
            100,
            'Male',
            new Date(),
            classId,
            null, // section_id
            'Dad',
            'Mom',
            '1234567890',
            'testfull@test.com',
            'Here',
            'ATT' + Math.floor(Math.random() * 1000),
            new Date()
        ];

        const res = await client.query(query, values);
        console.log('Full insert successful! ID:', res.rows[0].id);

        await client.query('ROLLBACK');
    } catch (err) {
        console.error('Full insert failed:', err);
    } finally {
        client.release();
        pool.end();
    }
}

testFullInsert();
