const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.rgtbslnmkuuzeauxiylv:Rudrappa%40838@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres' });
client.connect().then(() => 
    client.query(
        `INSERT INTO attendance (school_id, student_id, date, status, marking_mode) VALUES ($1, $2, $3, 'Present', $4)
         ON CONFLICT (student_id, date) DO UPDATE SET status = 'Present', marking_mode = $4, created_at = CURRENT_TIMESTAMP`,
        [1, 1, '2026-06-29', 'face']
    )
).then(res => {
    console.log("Success");
    client.end();
}).catch(e => {
    console.error("Error:", e);
    client.end();
});
