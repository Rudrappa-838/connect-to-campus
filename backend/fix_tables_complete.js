const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { pool } = require('./src/config/db');

async function fixAllTables() {
    const client = await pool.connect();
    try {
        console.log('🏗️ Starting COMPLETE Database Initialization...');

        // 1. Sections
        await client.query(`
            CREATE TABLE IF NOT EXISTS sections (
                id SERIAL PRIMARY KEY,
                name VARCHAR(50) NOT NULL,
                class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Created: sections');

        // 2. Subjects
        await client.query(`
            CREATE TABLE IF NOT EXISTS subjects (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Created: subjects');

        // 3. School Holidays
        await client.query(`
            CREATE TABLE IF NOT EXISTS school_holidays (
                id SERIAL PRIMARY KEY,
                school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
                holiday_date DATE NOT NULL,
                holiday_name VARCHAR(255) NOT NULL,
                is_paid BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(school_id, holiday_date)
            );
        `);
        console.log('✅ Created: school_holidays');

        // 4. Events
        await client.query(`
            CREATE TABLE IF NOT EXISTS events (
                id SERIAL PRIMARY KEY,
                school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
                title VARCHAR(255) NOT NULL,
                event_type VARCHAR(50),
                start_date TIMESTAMP,
                end_date TIMESTAMP,
                description TEXT,
                audience VARCHAR(50) DEFAULT 'All',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Created: events');

        // 5. Fee Structures (Likely needed soon)
        await client.query(`
            CREATE TABLE IF NOT EXISTS fee_structures (
                id SERIAL PRIMARY KEY,
                school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
                class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
                name VARCHAR(100) NOT NULL,
                amount DECIMAL(10, 2) NOT NULL,
                frequency VARCHAR(50) DEFAULT 'Yearly',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Created: fee_structures');

        // 6. Student Fees
        await client.query(`
            CREATE TABLE IF NOT EXISTS student_fees (
                id SERIAL PRIMARY KEY,
                student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
                fee_structure_id INTEGER REFERENCES fee_structures(id) ON DELETE CASCADE,
                amount_paid DECIMAL(10, 2) DEFAULT 0,
                status VARCHAR(50) DEFAULT 'Pending',
                due_date DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Created: student_fees');

        console.log('🎉 ALL TABLES (including sub-tables) Created!');

    } catch (e) {
        console.error('❌ Error creating tables:', e);
    } finally {
        client.release();
        pool.end();
    }
}

fixAllTables();
