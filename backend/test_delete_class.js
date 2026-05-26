const { pool } = require('./src/config/db');

async function testDelete() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Find a class to test with (or we can just query the schema to find all constraints on classes)
        console.log("Checking all foreign keys that reference classes...");
        const classFks = await client.query(`
            SELECT tc.table_name, kcu.column_name, rc.delete_rule 
            FROM information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name 
            JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name 
            JOIN information_schema.referential_constraints AS rc ON tc.constraint_name = rc.constraint_name 
            WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'classes';
        `);
        console.log("Classes FKs:", classFks.rows);

        console.log("Checking all foreign keys that reference exam_schedules...");
        const examFks = await client.query(`
            SELECT tc.table_name, kcu.column_name, rc.delete_rule 
            FROM information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name 
            JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name 
            JOIN information_schema.referential_constraints AS rc ON tc.constraint_name = rc.constraint_name 
            WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'exam_schedules';
        `);
        console.log("Exam Schedules FKs:", examFks.rows);

        console.log("Checking all foreign keys that reference fee_structures...");
        const feeFks = await client.query(`
            SELECT tc.table_name, kcu.column_name, rc.delete_rule 
            FROM information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name 
            JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name 
            JOIN information_schema.referential_constraints AS rc ON tc.constraint_name = rc.constraint_name 
            WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'fee_structures';
        `);
        console.log("Fee Structures FKs:", feeFks.rows);
        
        console.log("Checking all foreign keys that reference sections...");
        const sectionFks = await client.query(`
            SELECT tc.table_name, kcu.column_name, rc.delete_rule 
            FROM information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name 
            JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name 
            JOIN information_schema.referential_constraints AS rc ON tc.constraint_name = rc.constraint_name 
            WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'sections';
        `);
        console.log("Sections FKs:", sectionFks.rows);

        await client.query('ROLLBACK');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Error:', e);
    } finally {
        client.release();
        pool.end();
    }
}

testDelete();
