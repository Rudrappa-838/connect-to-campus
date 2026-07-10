const { pool } = require('./src/config/db.js');
async function testUpdate() {
    const client = await pool.connect();
    try {
        const id = 153; // name1
        const res = await client.query('SELECT * FROM teachers WHERE id = $1', [id]);
        console.log('Before:', res.rows[0].name);

        const updateRes = await client.query(
            `UPDATE teachers SET name = $1 WHERE id = $2 RETURNING *`,
            ['name1 updated', id]
        );
        console.log('After:', updateRes.rows[0].name);
    } catch(e) { console.error(e); } finally { client.release(); pool.end(); }
}
testUpdate();
