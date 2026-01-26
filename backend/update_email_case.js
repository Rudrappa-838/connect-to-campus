const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { pool } = require('./src/config/db');

async function updateEmail() {
    const client = await pool.connect();
    try {
        console.log('🔄 Checking for user "Softnetbgk@gmail.com"...');

        // Check Users
        const userCheck = await client.query("SELECT * FROM users WHERE email = 'Softnetbgk@gmail.com'");
        if (userCheck.rows.length > 0) {
            console.log(`✅ Found User ID: ${userCheck.rows[0].id} with capitalized email.`);

            await client.query("BEGIN");
            const updateRes = await client.query(
                "UPDATE users SET email = 'softnetbgk@gmail.com' WHERE email = 'Softnetbgk@gmail.com' RETURNING *"
            );
            console.log(`✅ Updated User Email to: ${updateRes.rows[0].email}`);
            await client.query("COMMIT");
        } else {
            console.log("ℹ️ No user found with exact email 'Softnetbgk@gmail.com'. Checking lowercase...");
            const lowerCheck = await client.query("SELECT * FROM users WHERE email = 'softnetbgk@gmail.com'");
            if (lowerCheck.rows.length > 0) {
                console.log("ℹ️ User already exists as 'softnetbgk@gmail.com'.");
            } else {
                console.log("❌ User not found with either casing.");
            }
        }

        // Check Schools (contact_email)
        console.log('\n🔄 Checking schools contact_email...');
        const schoolCheck = await client.query("SELECT * FROM schools WHERE contact_email = 'Softnetbgk@gmail.com'");
        if (schoolCheck.rows.length > 0) {
            console.log(`✅ Found School ID: ${schoolCheck.rows[0].id} with capitalized contact_email.`);
            await client.query("UPDATE schools SET contact_email = 'softnetbgk@gmail.com' WHERE contact_email = 'Softnetbgk@gmail.com'");
            console.log("✅ Updated School Contact Email.");
        } else {
            console.log("ℹ️ No school found with capitalized contact_email.");
        }

    } catch (e) {
        await client.query("ROLLBACK");
        console.error('❌ Error updating email:', e);
    } finally {
        client.release();
        pool.end();
    }
}

updateEmail();
