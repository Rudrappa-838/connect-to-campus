const { pool } = require('./src/config/db');
async function check() {
  const staffCols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'staff';");
  console.log("STAFF Cols:");
  console.log(JSON.stringify(staffCols.rows, null, 2));
  const usersCols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users';");
  console.log("USERS Cols:");
  console.log(JSON.stringify(usersCols.rows, null, 2));
  process.exit(0);
}
check().catch(console.error);
