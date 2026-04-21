require('dotenv').config();
const { pool } = require('../config/db');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    try {
        console.log('🔄 Running Question Bank migration...');

        const migrationSQL = fs.readFileSync(
            path.join(__dirname, 'add_question_bank_tables.sql'),
            'utf8'
        );

        await pool.query(migrationSQL);

        console.log('✅ Migration completed successfully!');
        console.log('📊 Question Bank tables are now created.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

runMigration();
