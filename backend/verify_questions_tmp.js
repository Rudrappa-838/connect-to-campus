const { pool } = require('./src/config/db');
async function verify() {
    try {
        const res = await pool.query('SELECT id, question_text, subject, chapter FROM questions ORDER BY id DESC LIMIT 5');
        console.log('--- RECENT QUESTIONS ---');
        res.rows.forEach(r => console.log(`[${r.id}] ${r.subject} - ${r.chapter}: ${r.question_text.substring(0, 50)}...`));
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
verify();
