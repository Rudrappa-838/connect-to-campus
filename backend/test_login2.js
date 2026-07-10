fetch('http://localhost:5000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'DADT2931', password: '123456', role: 'TEACHER' })
}).then(res => res.json()).then(data => console.log('Response:', data)).catch(err => console.error(err));
