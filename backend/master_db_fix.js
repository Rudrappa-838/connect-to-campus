const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function runFixes() {
    console.log('--- AWS DATABASE FIX TOOL ---');

    // Debug what we found (safety first, hide passwords)
    const envVars = {
        DATABASE_URL: process.env.DATABASE_URL ? 'FOUND' : 'MISSING',
        PROD_DATABASE_URL: process.env.PROD_DATABASE_URL ? 'FOUND' : 'MISSING',
        DB_HOST: process.env.DB_HOST || 'MISSING',
        DB_USER: process.env.DB_USER || 'MISSING',
        DB_NAME: process.env.DB_NAME || 'MISSING'
    };
    console.log('Environment Check:', envVars);

    let poolConfig;
    const connStr = process.env.PROD_DATABASE_URL || process.env.DATABASE_URL;

    if (connStr) {
        console.log('Using Connection String...');
        poolConfig = { connectionString: connStr, ssl: { rejectUnauthorized: false } };
    } else {
        console.log('Using individual DB parameters...');
        poolConfig = {
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME || 'postgres',
            port: process.env.DB_PORT || 5432,
            ssl: { rejectUnauthorized: false }
        };
    }

    if (poolConfig.host === 'localhost' && !connStr) {
        console.warn('⚠️ WARNING: Host is set to localhost. Fix might fail if DB is remote.');
    }

    const pool = new Pool(poolConfig);
    let client;

    try {
        console.log(`Connecting to ${poolConfig.host || 'URL'}...`);
        client = await pool.connect();
        console.log('✅ Connection Successful!');

        await client.query('BEGIN');

        console.log('1. Fixing users table...');
        await client.query('ALTER TABLE IF EXISTS public.users ADD COLUMN IF NOT EXISTS linked_id INTEGER');
        await client.query('ALTER TABLE IF EXISTS public.users DROP CONSTRAINT IF EXISTS users_email_key');

        console.log('2. Fixing students table...');
        await client.query('ALTER TABLE IF EXISTS public.students ADD COLUMN IF NOT EXISTS first_name VARCHAR(255)');
        await client.query('ALTER TABLE IF EXISTS public.students ADD COLUMN IF NOT EXISTS last_name VARCHAR(255)');
        await client.query('ALTER TABLE IF EXISTS public.students ADD COLUMN IF NOT EXISTS middle_name VARCHAR(255)');

        await client.query('COMMIT');
        console.log('✨ SUCCESS: All fixes applied correctly.');

    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.error('❌ ERROR:', err.message);
        console.error('Full Error Detail:', err);
    } finally {
        if (client) client.release();
        await pool.end();
    }
}

runFixes();
