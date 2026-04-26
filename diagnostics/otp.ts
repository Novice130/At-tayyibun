import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const sql = `SELECT identifier, value, "expiresAt" FROM verification WHERE "createdAt" > NOW() - INTERVAL '5 minutes' AND identifier LIKE '2fa-otp%' ORDER BY "createdAt" DESC LIMIT 3`;
pool.query(sql).then(r => { console.log(JSON.stringify(r.rows, null, 2)); return pool.end(); });
