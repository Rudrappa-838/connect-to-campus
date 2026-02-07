const { pool } = require('./src/config/db');

async function checkColumn() {
    try {
        const res = await pool.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'schools' AND column_name = 'institution_type'
        `);

        if (res.rows.length > 0) {
            console.log("✅ institution_type column EXISTS");
        } else {
            console.log("❌ institution_type column DOES NOT EXIST");
            console.log("\nRunning migration to add it...");

            await pool.query(`
                ALTER TABLE schools 
                ADD COLUMN IF NOT EXISTS institution_type VARCHAR(50) DEFAULT 'SCHOOL'
            `);

            console.log("✅ Column added successfully!");
        }
    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        pool.end();
    }
}

checkColumn();
