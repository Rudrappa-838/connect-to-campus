const { pool } = require('./src/config/db');

async function debugStudentLogin() {
    try {
        console.log("-----------------------------------------");
        console.log("🔍 RUNNING AWS DATABASE LOGIN DIAGNOSTIC");
        console.log("-----------------------------------------");

        // 1. Get ANY student that has a custom ID
        const studentRes = await pool.query(`
            SELECT id, admission_no, email, school_id 
            FROM students 
            WHERE admission_no IS NOT NULL 
            AND admission_no NOT LIKE '%@%'
            ORDER BY id DESC LIMIT 1
        `);
        
        if (studentRes.rows.length === 0) {
            console.log("❌ CRITICAL ERROR: No custom IDs found in the students table.");
            console.log("Please make sure you clicked Submit on the Super Admin dashboard.");
            process.exit(0);
        }

        const testStudent = studentRes.rows[0];
        console.log(`✅ Found a Student with Custom ID: ${testStudent.admission_no}`);
        console.log(`   Student Table ID: ${testStudent.id}, Email: ${testStudent.email}`);

        // 2. Check the users table for this exact student
        const userRes = await pool.query(`
            SELECT id, email, role, linked_id 
            FROM users 
            WHERE linked_id = $1
        `, [testStudent.id]);

        if (userRes.rows.length === 0) {
            console.log(`❌ CRITICAL ERROR: This student has NO user account in the users table!`);
        } else {
            console.log(`✅ Found corresponding User Account in users table:`);
            console.log(`   User Table ID: ${userRes.rows[0].id}`);
            console.log(`   Login Email (Username): ${userRes.rows[0].email}`);
            console.log(`   Role: ${userRes.rows[0].role}`);
            
            if (userRes.rows[0].email.toLowerCase() !== testStudent.admission_no.toLowerCase()) {
                console.log(`\n🚨 THE PROBLEM IS HERE 🚨`);
                console.log(`The users table email (${userRes.rows[0].email}) does NOT match the Custom ID (${testStudent.admission_no})!`);
                console.log(`This is why login fails. The migration script missed this user!`);
            } else {
                console.log(`✅ The login username correctly matches the Custom ID.`);
            }
        }
        console.log("-----------------------------------------");
        process.exit(0);
    } catch (e) {
        console.error("Error during debug:", e);
        process.exit(1);
    }
}

debugStudentLogin();
