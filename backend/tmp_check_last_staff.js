const fs = require('fs');
const { pool } = require('./src/config/db');
async function check() {
  const staff = await pool.query('SELECT * FROM staff ORDER BY id DESC LIMIT 1');
  const user = await pool.query("SELECT * FROM users WHERE email = $1 OR linked_id = $2 ORDER BY id DESC LIMIT 1", [staff.rows[0]?.email, staff.rows[0]?.id]);
  fs.writeFileSync('last_staff.json', JSON.stringify({ staff: staff.rows, user: user.rows }, null, 2));
  process.exit(0);
}
check().catch(console.error);
