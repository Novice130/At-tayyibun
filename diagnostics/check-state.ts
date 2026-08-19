import { Pool } from 'pg';

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL not set'); process.exit(1); }

const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: true } });

async function main() {
  const sections: Record<string, string> = {
    latestVerification: `
      SELECT identifier, value, "expiresAt",
             "expiresAt" > NOW() AS valid,
             "createdAt"
      FROM verification
      WHERE "createdAt" > NOW() - INTERVAL '10 minutes'
      ORDER BY "createdAt" DESC
    `,
  };
  for (const [name, sql] of Object.entries(sections)) {
    try {
      const r = await pool.query(sql);
      console.log('\n=== ' + name + ' (' + r.rowCount + ' rows) ===');
      console.table(r.rows);
    } catch (e: any) {
      console.log('\n=== ' + name + ' ERROR ===');
      console.log(e.message);
    }
  }
  await pool.end();
}
main().catch(e => { console.error(e); process.exit(1); });
