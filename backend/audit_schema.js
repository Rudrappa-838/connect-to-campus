const { pool } = require('./src/config/db');

async function auditSchema() {
  const tables = ['students', 'schools', 'users', 'marks', 'classes', 'sections', 'subjects'];
  try {
    for (const table of tables) {
      const res = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = $1
      `, [table]);
      console.log(`\n--- ${table} Table Columns ---`);
      res.rows.forEach(row => {
        console.log(`${row.column_name}: ${row.data_type}`);
      });
    }
  } catch (err) {
    console.error('Audit Error:', err);
  } finally {
    process.exit(0);
  }
}

auditSchema();
