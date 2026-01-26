const { pool } = require('./src/config/db');

async function inspectTable() {
    const client = await pool.connect();
    try {
        console.log('🔍 Inspecting MARKS table schema...');

        // 1. Get Columns
        const columns = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'marks'
        `);
        console.log('\n📊 Columns:');
        columns.rows.forEach(c => console.log(` - ${c.column_name} (${c.data_type})`));

        // 2. Get Constraints
        const constraints = await client.query(`
            SELECT conname, pg_get_constraintdef(c.oid)
            FROM pg_constraint c
            JOIN pg_namespace n ON n.oid = c.connamespace
            WHERE conrelid = 'marks'::regclass
        `);
        console.log('\n🔐 Constraints:');
        constraints.rows.forEach(c => console.log(` - ${c.conname}: ${c.pg_get_constraintdef}`));

    } catch (error) {
        console.error('❌ Error inspecting table:', error);
    } finally {
        client.release();
        process.exit();
    }
}

inspectTable();
