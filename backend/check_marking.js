const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.rgtbslnmkuuzeauxiylv:Rudrappa%40838@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres' });
client.connect().then(() => 
    client.query(`
        SELECT column_name, table_name 
        FROM information_schema.columns 
        WHERE table_name IN ('attendance', 'teacher_attendance', 'staff_attendance') 
        AND column_name = 'marking_mode'
    `)
).then(res => {
    console.log("marking_mode columns:", res.rows);
    client.end(); 
}).catch(console.error);
