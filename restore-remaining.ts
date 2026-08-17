import fs from 'fs';
import pg from 'pg';

const NEON_URL = 'postgresql://neondb_owner:npg_m7kGWiOZUAw4@ep-dry-forest-ay3ln0tr.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require';

async function importFromSql() {
  const client = new pg.Client({ connectionString: NEON_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('Reading real_prod_data.sql line by line...');
  const content = fs.readFileSync('C:\\Users\\Malik Fahad Awan\\Downloads\\real_prod_data.sql', 'utf8');
  const statements = content.split(';\n');

  console.log(`Found ${statements.length} statements.`);

  let callLogsCount = 0;
  let businessesCount = 0;
  let leadsCount = 0;
  let batchesCount = 0;
  let followUpsCount = 0;

  for (const rawStmt of statements) {
    const stmt = rawStmt.trim();
    if (!stmt || stmt.startsWith('--') || stmt === 'BEGIN' || stmt === 'COMMIT') continue;
    if (stmt.startsWith('CREATE TABLE') || stmt.startsWith('INSERT INTO users') || stmt.startsWith('INSERT INTO industries')) {
      continue;
    }

    try {
      if (stmt.includes('INSERT INTO call_logs')) {
        await client.query(stmt);
        callLogsCount++;
      } else if (stmt.includes('INSERT INTO imported_batches')) {
        await client.query(stmt);
        batchesCount++;
      } else if (stmt.includes('INSERT INTO businesses')) {
        await client.query(stmt);
        businessesCount++;
      } else if (stmt.includes('INSERT INTO leads')) {
        await client.query(stmt);
        leadsCount++;
      } else if (stmt.includes('INSERT INTO follow_ups')) {
        await client.query(stmt);
        followUpsCount++;
      }
    } catch (e: any) {
      // Ignore individual line syntax errors or duplicate keys
    }
  }

  console.log(`Restored: ${businessesCount} businesses, ${leadsCount} leads, ${callLogsCount} call logs, ${followUpsCount} follow ups, ${batchesCount} batches.`);

  const stats = await client.query(`
    SELECT 'leads' as tbl, count(*) from leads
    UNION ALL SELECT 'businesses', count(*) from businesses
    UNION ALL SELECT 'imported_batches', count(*) from imported_batches
    UNION ALL SELECT 'call_logs', count(*) from call_logs
    UNION ALL SELECT 'follow_ups', count(*) from follow_ups
    UNION ALL SELECT 'users', count(*) from users
  `);

  console.table(stats.rows);
  await client.end();
}

importFromSql().catch(console.error);
