const { pool } = require('./src/config/db');

async function checkSchema() {
  try {
    const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'schools'
    `);
    console.log('--- schools Table Columns ---');
    res.rows.forEach(row => {
      console.log(`${row.column_name}: ${row.data_type}`);
    });

    const res2 = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users'
    `);
    console.log('\n--- users Table Columns ---');
    res2.rows.forEach(row => {
      console.log(`${row.column_name}: ${row.data_type}`);
    });

  } catch (err) {
    console.error('Error fetching schema:', err);
  } finally {
    process.exit(0);
  }
}

checkSchema();
