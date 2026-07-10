fetch('http://localhost:5000/api/teachers/153', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NCwicm9sZSI6IlNDSE9PTF9BRE1JTiIsInNjaG9vbElkIjoxLCJpYXQiOjE3ODM1OTA3MDUsImV4cCI6MTgxNTEyNjcwNX0.5uXGqU3J5J9Ff9qM0' // Wait I need a valid token.
  },
  body: JSON.stringify({ name: 'name1 updated api' })
}).then(res => res.json()).then(data => console.log('Response:', data)).catch(err => console.error(err));
