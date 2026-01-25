const axios = require('axios');
const { pool } = require('./src/config/db');

async function reproduce() {
    try {
        console.log('🔄 Simulating Grade Save...');

        // Just pick ANY user
        const userRes = await pool.query("SELECT id, school_id FROM users LIMIT 1");
        if (userRes.rows.length === 0) {
            console.log('❌ ABSOLUTELY NO USERS IN DB. Cannot reproduce.');
            process.exit(1);
        }
        const user = userRes.rows[0];
        console.log(`Found User ID: ${user.id}, School ID: ${user.school_id}`);

        console.log('🧪 Testing Controller Function Directly...');
        const gradeController = require('./src/controllers/gradeController');

        // Mock Req
        const req = {
            user: { schoolId: user.school_id, id: user.id },
            body: {
                exam_type_id: 1, // Will update below
                grades: [
                    { name: 'A', min_percentage: 90, max_percentage: 100, grade_point: 10, description: 'Best' }
                ]
            }
        };

        // Mock Res
        const res = {
            json: (data) => console.log('✅ Success Response:', data),
            status: (code) => {
                console.log('⚠️ Status Code:', code);
                return {
                    json: (data) => console.log('❌ Error Response:', data)
                };
            }
        };

        // Check if Exam Type exists first
        const etStats = await pool.query('SELECT id FROM exam_types WHERE school_id = $1 LIMIT 1', [user.school_id]);
        if (etStats.rows.length > 0) {
            req.body.exam_type_id = etStats.rows[0].id;
        } else {
            console.log('⚠️ No Exam Types found. Creating dummy...');
            const newEt = await pool.query("INSERT INTO exam_types (school_id, name, max_marks) VALUES ($1, 'Test Exam', 100) RETURNING id", [user.school_id]);
            req.body.exam_type_id = newEt.rows[0].id;
        }

        await gradeController.saveGrades(req, res);

        console.log('🏁 Test Complete');
        process.exit(0);

    } catch (e) {
        console.error('💣 Test Crashed:', e);
        process.exit(1);
    }
}

reproduce();
