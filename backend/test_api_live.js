// Test the review API directly
const http = require('http');

// First, test if server is up
const testReq = http.get('http://localhost:5000/api', (res) => {
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => {
        console.log('✅ Backend is running! Status:', res.statusCode);
        console.log('Response:', data.substring(0, 100));
    });
});
testReq.on('error', (e) => {
    console.error('❌ Backend NOT running:', e.message);
    console.error('   → Start it with: cd backend && npm run dev');
});
testReq.end();

// Test the reviews route (should get 401 since no auth token)
setTimeout(() => {
    const options = {
        hostname: 'localhost',
        port: 5000,
        path: '/api/student-reviews/student/1',
        method: 'GET',
    };
    const req2 = http.request(options, (res) => {
        let data = '';
        res.on('data', d => data += d);
        res.on('end', () => {
            if (res.statusCode === 401) {
                console.log('✅ Route /api/student-reviews EXISTS (got 401 = auth required, which is correct)');
            } else if (res.statusCode === 404) {
                console.log('❌ Route /api/student-reviews DOES NOT EXIST on server (got 404)');
            } else {
                console.log(`ℹ️ Route returned ${res.statusCode}:`, data.substring(0, 100));
            }
        });
    });
    req2.on('error', () => console.log('❌ Could not reach backend'));
    req2.end();
}, 1000);
