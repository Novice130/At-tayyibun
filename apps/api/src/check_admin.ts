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
    try {
      const res = await client.query(
        'SELECT id, email, role, is_verified, two_factor_enabled FROM users WHERE email = $1',
        [adminEmail],
      );

      if (res.rows.length === 0) {
        console.log('User NOT found!');
        return;
      }

      console.log('User found:');
      console.log(JSON.stringify(res.rows[0], null, 2));

      const accountRes = await client.query(
        'SELECT id, "accountId", "providerId", "userId", password IS NOT NULL as has_password, "createdAt" FROM account WHERE "userId" = $1',
        [res.rows[0].id],
      );

      if (accountRes.rows.length > 0) {
        console.log('Account found:');
        console.log(JSON.stringify(accountRes.rows[0], null, 2));
        const credAccount = accountRes.rows.find((r: any) => r.providerId === 'credential');
        if (credAccount) {
          console.log(`✓ Credential account exists. has_password=${credAccount.has_password}`);
        } else {
          console.log('⚠ No credential account found (no email/password login possible)!');
        }
      } else {
        console.log('✗ Account NOT found — run: pnpm --filter @at-tayyibun/api seed:admin');
      }
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error querying database:', err);
  } finally {
    await pool.end();
  }
}

checkAdmin();
