const { pool } = require('../config/db');
const bcrypt = require('bcrypt');

const createTables = async (client) => {
    // Use the provided client or fall back to pool
    const db = client || pool;

    try {
        console.log('🔄 Initializing Database Schema...');

        // 1. Schools Table
        await db.query(`
            CREATE TABLE IF NOT EXISTS schools (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                address TEXT,
                contact_email VARCHAR(255) NOT NULL,
                subscription_status VARCHAR(50) DEFAULT 'ACTIVE',
                sms_provider VARCHAR(50),
                sms_api_key VARCHAR(255),
                sms_sender_id VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Schools table ready');

        // 2. Users Table
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(200) NOT NULL, 
                school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Users table ready');

        // ... Add other tables here if critical ...
        // For now, these are the minimum needed for Setup Admin to work.

    } catch (error) {
        console.error('❌ Error initializing database:', error.message);
        throw error;
    }
};

const initDb = async () => {
    try {
        await createTables();
    } finally {
        pool.end();
    }
};

if (require.main === module) {
    initDb();
}

module.exports = { createTables };
