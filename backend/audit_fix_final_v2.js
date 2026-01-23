const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { pool } = require('./src/config/db');

async function fixFinalModules() {
    const client = await pool.connect();
    try {
        console.log('🚀 Starting FINAL SCHEMA FIX V2 (Remaining Modules)...');
        await client.query('BEGIN');

        // ===============================================
        // 1. BIOMETRIC & RFID
        // ===============================================
        console.log('🔧 Fixing Biometric Columns...');
        for (const table of ['students', 'teachers', 'staff']) {
            await client.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS biometric_template TEXT`);
            await client.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS rfid_card_id VARCHAR(100)`);
        }

        // ===============================================
        // 2. ADMISSIONS
        // ===============================================
        console.log('🔧 Fixing Admissions Table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS admissions_enquiries (
                id SERIAL PRIMARY KEY,
                school_id INTEGER,
                student_name VARCHAR(255),
                parent_name VARCHAR(255),
                contact_number VARCHAR(50),
                email VARCHAR(255),
                class_applying_for VARCHAR(50),
                previous_school VARCHAR(255),
                notes TEXT,
                status VARCHAR(50) DEFAULT 'New',
                application_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // ===============================================
        // 3. EVENTS & ANNOUNCEMENTS
        // ===============================================
        console.log('🔧 Fixing Calendar & Announcements...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS events (
                id SERIAL PRIMARY KEY,
                school_id INTEGER,
                title VARCHAR(255),
                event_type VARCHAR(50),
                start_date TIMESTAMP,
                end_date TIMESTAMP,
                description TEXT,
                audience VARCHAR(50) DEFAULT 'All'
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS announcements (
                id SERIAL PRIMARY KEY,
                school_id INTEGER,
                title VARCHAR(255),
                message TEXT,
                target_role VARCHAR(50),
                priority VARCHAR(20) DEFAULT 'Normal',
                valid_until DATE,
                class_id INTEGER,
                section_id INTEGER,
                created_by INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // ===============================================
        // 4. FINANCE (EXPENDITURES)
        // ===============================================
        console.log('🔧 Fixing Expenditures...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS expenditures (
                id SERIAL PRIMARY KEY,
                school_id INTEGER,
                title VARCHAR(255),
                amount DECIMAL(10, 2),
                category VARCHAR(100),
                description TEXT,
                expense_date DATE DEFAULT CURRENT_DATE,
                payment_method VARCHAR(50),
                transaction_id VARCHAR(100),
                upi_id VARCHAR(100),
                created_by INTEGER,
                academic_year_id INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // ===============================================
        // 5. ACADEMIC YEARS
        // ===============================================
        console.log('🔧 Fixing Academic Years...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS academic_years (
                id SERIAL PRIMARY KEY,
                school_id INTEGER,
                year_label VARCHAR(50), -- e.g. "2025-2026"
                start_date DATE,
                end_date DATE,
                status VARCHAR(20) DEFAULT 'upcoming', -- active, completed, upcoming
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT unique_school_year UNIQUE (school_id, year_label)
            );
        `);

        console.log('✅ Final V2 Fixes Applied. System should be 100% covered now.');
        await client.query('COMMIT');

    } catch (e) {
        await client.query('ROLLBACK');
        console.error('❌ Error in Final Fix V2:', e);
    } finally {
        client.release();
        pool.end();
    }
}

fixFinalModules();
