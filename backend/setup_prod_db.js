const { pool } = require('./src/config/db');

async function setup() {
    try {
        console.log('🚧 Setting up Production Database Schema...');

        // 1. Schools Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS schools (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255),
                address TEXT,
                contact_email VARCHAR(255),
                school_code VARCHAR(50) UNIQUE,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Schools table check passed');

        // 2. Users Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(50) NOT NULL,
                school_id INTEGER REFERENCES schools(id),
                reset_password_token VARCHAR(255),
                reset_password_expires BIGINT,
                current_session_token VARCHAR(555),
                fcm_token VARCHAR(500),
                must_change_password BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Users table check passed');

        console.log('🎉 Base Tables Ready! Now run init_tables.js');

    } catch (error) {
        console.error('❌ Setup Failed:', error);
    } finally {
        pool.end();
    }
}

setup();
