const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

console.log('--- Database Connection Check ---');

let connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    if (process.env.DB_USER && process.env.DB_HOST && process.env.DB_NAME) {
        console.log('ℹ️  DATABASE_URL not found, constructing from DB_* variables...');
        connectionString = `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME}`;
        // Do NOT append ?sslmode=require to string, rely on object config below
    } else {
        console.error('❌ Missing Database Configuration!');
        console.error('   Please set DATABASE_URL or (DB_USER, DB_PASSWORD, DB_HOST, DB_NAME)');
        process.exit(1);
    }
}

console.log('Target URL:', connectionString.replace(/:[^:/@]+@/, ':****@')); // Hide password

const client = new Client({
    connectionString: connectionString,
    // EXACTLY matching db.js logic:
    ssl: process.env.DB_SSL_MODE === 'disable' ? false : { rejectUnauthorized: false }
});

async function check() {
    try {
        console.log('Connecting...');
        await client.connect();
        console.log('✅ Connection Successful!');

        const res = await client.query('SELECT current_database(), inet_server_addr()');
        console.log('📂 Connected Database:', res.rows[0].current_database);
        console.log('🖥️  Server IP/Addr:', res.rows[0].inet_server_addr);

        console.log('--------------------------------');
        console.log('This confirms your backend IS connecting to the cloud database.');

        await client.end();
    } catch (err) {
        console.error('❌ Connection Failed:', err.message);
        if (err.message.includes('password')) {
            console.error('   -> Check DB_PASSWORD in .env');
        } else if (err.message.includes('does not exist')) {
            console.error('   -> Check DB_NAME in .env');
        } else {
            console.error('   -> Check DB_HOST and Security Group settings');
        }
    }
}

check();
