const axios = require('axios');
async function test() {
  try {
    const res = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'DAL1088',
      password: '123456',
      role: 'STAFF'
    });
    console.log('SUCCESS:', res.data);
  } catch (e) {
    console.error('ERROR:', e.response?.data || e.message);
  }
}
test();
