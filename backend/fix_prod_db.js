const { Pool } = require('pg');
require('dotenv').config();

async function fixProdDb() {
    const url = process.env.PROD_DATABASE_URL;
    if (!url) {
        console.log('No PROD_DATABASE_URL found in .env');
        return;
    }

    const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
    try {
        console.log('Applying linked_id fix to PROD DB...');
        await pool.query('ALTER TABLE public.users ADD COLUMN IF NOT EXISTS linked_id INTEGER');
        console.log('✅ linked_id column added to public.users');

        // Also check if students table needs any fixes for first_name/last_name if they were missing
        await pool.query('ALTER TABLE public.students ADD COLUMN IF NOT EXISTS first_name VARCHAR(255)');
        await pool.query('ALTER TABLE public.students ADD COLUMN IF NOT EXISTS last_name VARCHAR(255)');
        await pool.query('ALTER TABLE public.students ADD COLUMN IF NOT EXISTS middle_name VARCHAR(255)');
        console.log('✅ first_name, last_name, middle_name columns checked in public.students');

    } catch (error) {
        console.error('❌ Error fixing PROD DB:', error.message);
    } finally {
        await pool.end();
    }
}

fixProdDb();
