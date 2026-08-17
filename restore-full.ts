import fs from 'fs';
import pg from 'pg';

const NEON_URL = 'postgresql://neondb_owner:npg_m7kGWiOZUAw4@ep-dry-forest-ay3ln0tr.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require';

async function restoreFull() {
  const client = new pg.Client({ connectionString: NEON_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('Reading real_prod_data.sql...');
  const content = fs.readFileSync('C:\\Users\\Malik Fahad Awan\\Downloads\\real_prod_data.sql', 'utf8');
  const lines = content.split('\n');

  console.log('Truncating tables...');
  await client.query('TRUNCATE TABLE users, industries, imported_batches, businesses, leads, call_logs, follow_ups, audit_logs, settings, sessions CASCADE;');

  const groups: { [key: string]: string[] } = {
    users: [],
    industries: [],
    imported_batches: [],
    businesses: [],
    leads: [],
    call_logs: [],
    follow_ups: [],
    audit_logs: [],
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith('INSERT INTO ')) continue;

    for (const key of Object.keys(groups)) {
      if (trimmed.startsWith(`INSERT INTO ${key} `)) {
        // Ensure statement ends with semicolon
        let stmt = trimmed;
        if (!stmt.endsWith(';')) stmt += ';';
        groups[key].push(stmt);
        break;
      }
    }
  }

  for (const [key, stmts] of Object.entries(groups)) {
    console.log(`Inserting ${key}: ${stmts.length} rows...`);
    const chunkSize = 25;
    for (let i = 0; i < stmts.length; i += chunkSize) {
      const chunkSql = 'BEGIN;\n' + stmts.slice(i, i + chunkSize).join('\n') + '\nCOMMIT;';
      try {
        await client.query(chunkSql);
      } catch (err: any) {
        // Try individual statements
        for (const single of stmts.slice(i, i + chunkSize)) {
          try { await client.query(single); } catch (e) {}
        }
      }
    }
  }

  console.log('Finished restoring all tables.');

  const stats = await client.query(`
    SELECT 'users' as tbl, count(*) as count from users
    UNION ALL SELECT 'imported_batches', count(*) from imported_batches
    UNION ALL SELECT 'businesses', count(*) from businesses
    UNION ALL SELECT 'leads', count(*) from leads
    UNION ALL SELECT 'call_logs', count(*) from call_logs
    UNION ALL SELECT 'follow_ups', count(*) from follow_ups
    UNION ALL SELECT 'audit_logs', count(*) from audit_logs
    UNION ALL SELECT 'industries', count(*) from industries
  `);

  console.table(stats.rows);
  await client.end();
}

restoreFull().catch(console.error);
