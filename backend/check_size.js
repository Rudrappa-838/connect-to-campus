const { pool } = require('./src/config/db');

async function checkSchoolSize() {
    const email = 'rudrappam789@gmail.com';
    try {
        const uRes = await pool.query('SELECT school_id FROM users WHERE email = $1', [email]);
        if (uRes.rows.length === 0) { console.log('User not found'); return; }
        const schoolId = uRes.rows[0].school_id;
        console.log(`School ID: ${schoolId}`);

        const sCount = await pool.query('SELECT count(*) FROM students WHERE school_id = $1', [schoolId]);
        const tCount = await pool.query('SELECT count(*) FROM teachers WHERE school_id = $1', [schoolId]);
        const hCount = await pool.query('SELECT count(*) FROM school_holidays WHERE school_id = $1', [schoolId]);

        console.log(`Students: ${sCount.rows[0].count}`);
        console.log(`Teachers: ${tCount.rows[0].count}`);
        console.log(`Holidays: ${hCount.rows[0].count}`);
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
checkSchoolSize();
