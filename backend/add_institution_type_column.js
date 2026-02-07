const { pool } = require('./src/config/db');

async function addInstitutionType() {
    const client = await pool.connect();
    try {
        console.log('Checking schools table for institution_type column...');

        // Check if column exists
        const checkQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='schools' AND column_name='institution_type';
    `;
        const res = await client.query(checkQuery);

        if (res.rows.length === 0) {
            console.log('Column does not exist. Adding institution_type...');
            await client.query(`
        ALTER TABLE schools 
        ADD COLUMN institution_type VARCHAR(50) DEFAULT 'SCHOOL';
      `);
            console.log('✅ Successfully added institution_type column.');
        } else {
            console.log('ℹ️ institution_type column already exists.');
        }

        // Verify
        const verify = await client.query("SELECT id, name, institution_type FROM schools LIMIT 5");
        console.log('Current schools data:', verify.rows);

    } catch (err) {
        console.error('Error updating database:', err);
    } finally {
        client.release();
        pool.end();
    }
}

addInstitutionType();
