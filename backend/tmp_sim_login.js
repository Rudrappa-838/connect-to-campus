const { pool } = require('./src/config/db');
const bcrypt = require('bcrypt');
async function test() {
  const email = 'DAL1088';
  const role = 'STAFF';
  const password = '123456';
  
  const isEmail = false;
  let checkEmails = [email];
  checkEmails.push(`${email}@staff.school.com`);
  checkEmails.push(`${email.toLowerCase()}@staff.school.com`);
  const stRes = await pool.query('SELECT email FROM staff WHERE employee_id ILIKE $1', [email]);
  if (stRes.rows.length > 0) checkEmails.push(stRes.rows[0].email);
  
  console.log("checkEmails:", checkEmails);
  
  const emailsArr = checkEmails.filter(Boolean).map(e => e.trim().toLowerCase());
  console.log("emailsArr:", emailsArr);
  const result = await pool.query('SELECT * FROM users WHERE LOWER(email) = ANY($1::text[])', [emailsArr]);
  console.log("Users returned:", result.rows.length);
  
  let user = null;
  if (result.rows.length > 0) {
      const priorityMatch = result.rows.find(u => u.email.toLowerCase().startsWith(email.toLowerCase() + '@'));
      user = priorityMatch || result.rows[0];
  }
  if (!user) return console.log("Fail 1");
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return console.log("Fail 2 (password)");
  
  console.log("Success! Authenticated.");
  process.exit(0);
}
test().catch(console.error);
