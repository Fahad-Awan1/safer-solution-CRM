import fs from 'fs';
import pg from 'pg';

const NEON_URL = 'postgresql://neondb_owner:npg_m7kGWiOZUAw4@ep-dry-forest-ay3ln0tr.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require';

async function restore() {
  console.log('Connecting to Neon PostgreSQL...');
  const client = new pg.Client({
    connectionString: NEON_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('Connected.');

  console.log('Reading production_crm_complete_data.sql...');
  const sql = fs.readFileSync('C:\\Users\\Malik Fahad Awan\\Downloads\\production_crm_complete_data.sql', 'utf8');

  console.log('Executing SQL restore...');
  await client.query(sql);
  console.log('Restore completed successfully!');

  const counts = await client.query(`
    SELECT 'users' as tbl, count(*) as count FROM users
    UNION ALL SELECT 'imported_batches', count(*) FROM imported_batches
    UNION ALL SELECT 'businesses', count(*) FROM businesses
    UNION ALL SELECT 'leads', count(*) FROM leads
    UNION ALL SELECT 'call_logs', count(*) FROM call_logs
    UNION ALL SELECT 'follow_ups', count(*) FROM follow_ups
    UNION ALL SELECT 'audit_logs', count(*) FROM audit_logs
    UNION ALL SELECT 'industries', count(*) FROM industries
  `);

  console.table(counts.rows);
  await client.end();
}

restore().catch(console.error);
