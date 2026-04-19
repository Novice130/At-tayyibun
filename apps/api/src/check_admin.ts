import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is not defined');
  process.exit(1);
}

async function checkAdmin() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  const adminEmail = 'admin@attayyibun.com';
  console.log(`Checking user: ${adminEmail}`);

  try {
    const client = await pool.connect();
    const res = await client.query('SELECT id, email, role, is_verified, two_factor_enabled FROM users WHERE email = $1', [adminEmail]);
    client.release();

    if (res.rows.length > 0) {
      console.log('User found:');
      console.log(JSON.stringify(res.rows[0], null, 2));

      const accountRes = await client.query('SELECT * FROM account WHERE "userId" = $1', [res.rows[0].id]);
      if (accountRes.rows.length > 0) {
        console.log('Account found:');
        console.log(JSON.stringify(accountRes.rows[0], null, 2));
      } else {
        console.log('Account NOT found for this user!');
      }
    } else {
      console.log('User NOT found!');
    }
  } catch (err) {
    console.error('Error querying database:', err);
  } finally {
    await pool.end();
  }
}

checkAdmin();
