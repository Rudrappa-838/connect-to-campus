const { pool } = require('./src/config/db');

async function runSyncMigration() {
  const client = await pool.connect();
  try {
    console.log('🔄 Starting Schema Sync Migration...');
    await client.query('BEGIN');

    // 1. Students Table: Add history columns for unassigned students
    console.log('--- Updating Students Table ---');
    await client.query(`
      ALTER TABLE students 
      ADD COLUMN IF NOT EXISTS class_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS section_name VARCHAR(50);
    `);
    console.log('✅ Added class_name and section_name to students table');

    // 2. Marks Table: Ensure columns exist (removing need for "emergency" code)
    console.log('--- Updating Marks Table ---');
    await client.query(`
      ALTER TABLE marks 
      ADD COLUMN IF NOT EXISTS deleted_student_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS deleted_student_admission_no VARCHAR(50);
      
      -- Ensure student_id can be null (for preserved marks)
      ALTER TABLE marks ALTER COLUMN student_id DROP NOT NULL;
    `);
    console.log('✅ Verified marks table columns');

    // 3. Schools Table: Double check marksheet template
    console.log('--- Updating Schools Table ---');
    await client.query(`
      ALTER TABLE schools 
      ADD COLUMN IF NOT EXISTS marksheet_template VARCHAR(255);
    `);
    console.log('✅ Verified schools table columns');

    await client.query('COMMIT');
    console.log('🎉 Migration completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

runSyncMigration();
