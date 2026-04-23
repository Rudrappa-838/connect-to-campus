const { pool } = require('./src/config/db');

async function testUpdateLogic() {
    const client = await pool.connect();
    try {
        // 1. Find a student
        const res = await client.query('SELECT id, class_id, section_id, roll_number, name FROM students LIMIT 1');
        if (res.rows.length === 0) {
            console.log('No students found.');
            return;
        }

        const student = res.rows[0];
        console.log('Testing with student:', student);

        // 2. Run the exact query from the controller
        const safe_class_id = student.class_id;
        const safe_section_id = student.section_id;
        const roll_number = student.roll_number;
        const id = student.id.toString(); // req.params.id is a string
        const schoolId = 1; // Assuming 1

        let rollDup;
        if (safe_section_id) {
            rollDup = await client.query('SELECT id FROM students WHERE class_id = $1 AND section_id = $2 AND roll_number = $3 AND school_id = $4 AND id != $5 AND (status IS NULL OR status != \'Deleted\')', [safe_class_id, safe_section_id, roll_number, schoolId, id]);
        } else {
            rollDup = await client.query('SELECT id FROM students WHERE class_id = $1 AND section_id IS NULL AND roll_number = $2 AND school_id = $3 AND id != $4 AND (status IS NULL OR status != \'Deleted\')', [safe_class_id, roll_number, schoolId, id]);
        }

        console.log('Duplicates found:', rollDup.rows);

    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        process.exit();
    }
}
testUpdateLogic();
