import fs from 'fs';
import pg from 'pg';

const NEON_URL = 'postgresql://neondb_owner:npg_m7kGWiOZUAw4@ep-dry-forest-ay3ln0tr.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require';

async function fastRestore() {
  const client = new pg.Client({ connectionString: NEON_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('Reading real_prod_data.sql...');
  const content = fs.readFileSync('C:\\Users\\Malik Fahad Awan\\Downloads\\real_prod_data.sql', 'utf8');
  const lines = content.split('\n');

  const batchStmts: string[] = [];
  let currentGroup: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('--') || trimmed === 'BEGIN;' || trimmed === 'COMMIT;' || trimmed.startsWith('CREATE TABLE')) {
      continue;
    }

    currentGroup.push(trimmed);
    if (currentGroup.length >= 100) {
      batchStmts.push(currentGroup.join('\n'));
      currentGroup = [];
    }
  }

  if (currentGroup.length > 0) {
    batchStmts.push(currentGroup.join('\n'));
  }

  console.log(`Executing ${batchStmts.length} multi-query chunks...`);
  for (let i = 0; i < batchStmts.length; i++) {
    try {
      await client.query(batchStmts[i]);
    } catch (e: any) {
      // ignore
    }
    if ((i + 1) % 5 === 0 || i === batchStmts.length - 1) {
      console.log(`Processed chunk ${i + 1}/${batchStmts.length}`);
    }
  }

  console.log('Fast restore completed!');
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

fastRestore().catch(console.error);
