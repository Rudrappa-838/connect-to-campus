const { pool } = require('./src/config/db');

async function inspectLibrarySchema() {
    const client = await pool.connect();
    try {
        console.log('🔍 Inspecting Library Tables Schema...');

        const tables = ['library_books', 'library_transactions'];

        for (const table of tables) {
            console.log(`\n📊 Table: ${table}`);
            const columns = await client.query(`
                SELECT column_name, data_type, column_default 
                FROM information_schema.columns 
                WHERE table_name = $1
            `, [table]);
            columns.rows.forEach(c => console.log(` - ${c.column_name} (${c.data_type}) DEFAULT: ${c.column_default}`));

            const constraints = await client.query(`
                SELECT conname, pg_get_constraintdef(c.oid)
                FROM pg_constraint c
                JOIN pg_namespace n ON n.oid = c.connamespace
                WHERE conrelid = $1::regclass
            `, [table]);
            console.log('🔐 Constraints:');
            constraints.rows.forEach(c => console.log(` - ${c.conname}: ${c.pg_get_constraintdef}`));
        }

    } catch (error) {
        console.error('❌ Error inspecting library schema:', error);
    } finally {
        client.release();
        process.exit();
    }
}

inspectLibrarySchema();
