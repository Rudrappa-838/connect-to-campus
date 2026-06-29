const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.rgtbslnmkuuzeauxiylv:Rudrappa%40838@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres' });
client.connect().then(() => 
    client.query('SELECT id, name, can_take_face_attendance FROM staff WHERE id = 1')
).then(res => {
    console.log(res.rows);
    client.end();
}).catch(e => {
    console.error(e);
    client.end();
});
