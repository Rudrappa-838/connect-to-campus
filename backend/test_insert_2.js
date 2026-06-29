const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.rgtbslnmkuuzeauxiylv:Rudrappa%40838@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres' });
client.connect().then(() => 
    client.query(
        `INSERT INTO teacher_attendance (school_id, teacher_id, date, status, marking_mode) VALUES ($1, $2, $3, 'Present', $4)
         ON CONFLICT (teacher_id, date) DO UPDATE SET status = 'Present', marking_mode = $4, created_at = CURRENT_TIMESTAMP`,
        [1, 1, '2026-06-29', 'face']
    )
).then(res => {
    console.log("Success Teacher");
    return client.query(
        `INSERT INTO staff_attendance (school_id, staff_id, date, status, marking_mode) VALUES ($1, $2, $3, 'Present', $4)
         ON CONFLICT (staff_id, date) DO UPDATE SET status = 'Present', marking_mode = $4, created_at = CURRENT_TIMESTAMP`,
        [1, 1, '2026-06-29', 'face']
    )
}).then(() => {
    console.log("Success Staff");
    client.end();
}).catch(e => {
    console.error("Error:", e);
    client.end();
});
