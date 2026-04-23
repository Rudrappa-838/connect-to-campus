const { pool } = require('./src/config/db');

async function checkStudentsSchema() {
  try {
    const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'students'
    `);
    console.log('--- students Table Columns ---');
    res.rows.forEach(row => {
      console.log(`${row.column_name}: ${row.data_type}`);
    });
  } catch (err) {
    console.error('Error fetching schema:', err);
  } finally {
    process.exit(0);
  }
}

checkStudentsSchema();
