const { Pool } = require('pg');
require('dotenv').config(); // Loaded for DB Config

const getConnectionString = () => {
    // For develop branch, prioritize production URL if in production mode
    if (process.env.NODE_ENV === 'production') {
        process.env.DB_ENV_LABEL = 'PRODUCTION (AWS RDS)';
        return process.env.PROD_DATABASE_URL || process.env.DATABASE_URL;
    }

    process.env.DB_ENV_LABEL = 'DEVELOP (SUPABASE/DEV)';
    return process.env.DATABASE_URL;
};

const connectionString = getConnectionString();
console.log(`🌿 Environment: ${process.env.NODE_ENV || 'development'} | 🌐 DB: ${process.env.DB_ENV_LABEL}`);

const pool = new Pool({
    connectionString: connectionString || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
    // Force allow self-signed certs (AWS RDS uses them by default)
    ssl: { rejectUnauthorized: false },
    max: 10,
    connectionTimeoutMillis: 60000, // 60s to establish connection
    idleTimeoutMillis: 0, // Disable idle timeout (keep connections open)
    keepAlive: true,
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    // process.exit(-1); // Don't crash the server
});

module.exports = { pool };
