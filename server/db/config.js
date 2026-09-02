const { Pool } = require('pg');
require('dotenv').config();

// Prefer a single DATABASE_URL (Neon, Vercel, most managed Postgres).
// Fall back to discrete DB_* vars for local dev / legacy EC2 setup.
const connectionString = process.env.DATABASE_URL;

const pool = connectionString
  ? new Pool({
      connectionString,
      // Neon and most managed providers require SSL. They use certs that
      // aren't in the default CA bundle, so disable strict verification.
      ssl: { rejectUnauthorized: false },
    })
  : new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'everything_db',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
    });

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

module.exports = pool;
