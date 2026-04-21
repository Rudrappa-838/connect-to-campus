const { pool } = require('./src/config/db');
async function check() {
    try {
        const r = await pool.query("SELECT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'student_reviews')");
        console.log("EXISTS:", r.rows[0].exists);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
check();
