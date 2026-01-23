const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { pool } = require('./src/config/db');

async function createAllTables() {
    const client = await pool.connect();
    try {
        console.log('🏗️ Starting Full Database Initialization...');

        // 1. Schools
        await client.query(`
            CREATE TABLE IF NOT EXISTS schools (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                school_code VARCHAR(50) UNIQUE NOT NULL,
                address TEXT,
                contact_email VARCHAR(255) NOT NULL,
                logo TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                subscription_status VARCHAR(50) DEFAULT 'ACTIVE',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Created: schools');

        // 2. Users (Ensure columns exist - redundant but safe)
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(200) NOT NULL, 
                school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
                current_session_token TEXT,
                must_change_password BOOLEAN DEFAULT FALSE,
                fcm_token TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Verified: users');

        // 3. Classes
        await client.query(`
            CREATE TABLE IF NOT EXISTS classes (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                section VARCHAR(50),
                school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
                class_teacher_id INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Created: classes');

        // 4. Students
        await client.query(`
            CREATE TABLE IF NOT EXISTS students (
                id SERIAL PRIMARY KEY,
                first_name VARCHAR(100) NOT NULL,
                last_name VARCHAR(100),
                admission_no VARCHAR(100) NOT NULL,
                roll_no VARCHAR(50),
                email VARCHAR(255),
                phone VARCHAR(50),
                dob DATE,
                gender VARCHAR(20),
                address TEXT,
                blood_group VARCHAR(10),
                class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
                school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
                parent_id INTEGER,
                status VARCHAR(50) DEFAULT 'Active',
                profile_image TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Created: students');

        // 5. Teachers
        await client.query(`
            CREATE TABLE IF NOT EXISTS teachers (
                id SERIAL PRIMARY KEY,
                first_name VARCHAR(100) NOT NULL,
                last_name VARCHAR(100),
                employee_id VARCHAR(100) NOT NULL,
                email VARCHAR(255),
                phone VARCHAR(50),
                qualification VARCHAR(255),
                specialization VARCHAR(255),
                school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
                status VARCHAR(50) DEFAULT 'Active',
                profile_image TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Created: teachers');

        // 6. Staff
        await client.query(`
            CREATE TABLE IF NOT EXISTS staff (
                id SERIAL PRIMARY KEY,
                first_name VARCHAR(100) NOT NULL,
                last_name VARCHAR(100),
                employee_id VARCHAR(100) NOT NULL,
                email VARCHAR(255),
                phone VARCHAR(50),
                role VARCHAR(100), 
                school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
                status VARCHAR(50) DEFAULT 'Active',
                profile_image TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Created: staff');

        console.log('🎉 All Critical Tables Created Successfully!');

    } catch (e) {
        console.error('❌ Error creating tables:', e);
    } finally {
        client.release();
        pool.end();
    }
}

createAllTables();
