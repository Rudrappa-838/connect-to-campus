const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

console.log('--- Database Connection Check ---');
console.log('Target URL:', process.env.DATABASE_URL ? 'Found (Starts with ' + process.env.DATABASE_URL.substring(0, 20) + '...)' : 'MISSING');

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
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
    }
}

check();
