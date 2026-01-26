const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

// DB Connection Test
router.get('/db-check', async (req, res) => {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT NOW() as time');
        client.release();

        // Also check Env vars (safely)
        const envCheck = {
            node_env: process.env.NODE_ENV,
            ssl_mode: process.env.DB_SSL_MODE,
            has_db_url: !!process.env.DATABASE_URL,
            has_jwt: !!process.env.JWT_SECRET,
            time: result.rows[0].time
        };

        res.json({ status: 'OK', env: envCheck });
    } catch (error) {
        console.error('DB Check Failed:', error);
        res.status(500).json({
            status: 'ERROR',
            message: error.message,
            ssl_mode: process.env.DB_SSL_MODE
        });
    }
});

module.exports = router;
