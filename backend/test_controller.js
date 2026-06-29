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

const res = {
    status: function(code) {
        console.log("Status:", code);
        return this;
    },
    json: function(data) {
        console.log("JSON:", data);
        process.exit(0);
    },
    send: function(data) {
        console.log("SEND:", data);
        process.exit(0);
    }
};

markFaceAttendanceById(req, res).catch(e => {
    console.error("Uncaught Error:", e);
});
