import fs from 'fs';
import pg from 'pg';

const NEON_URL = 'postgresql://neondb_owner:npg_m7kGWiOZUAw4@ep-dry-forest-ay3ln0tr.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require';

async function restoreOrdered() {
  const client = new pg.Client({ connectionString: NEON_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('Reading real_prod_data.sql...');
  const content = fs.readFileSync('C:\\Users\\Malik Fahad Awan\\Downloads\\real_prod_data.sql', 'utf8');
  const rawStatements = content.split(';\n');

  console.log('Truncating tables...');
  await client.query('TRUNCATE users, industries, imported_batches, businesses, leads, call_logs, follow_ups, audit_logs, settings, sessions CASCADE;');

  const usersStmts: string[] = [];
  const industriesStmts: string[] = [];
  const batchesStmts: string[] = [];
  const businessesStmts: string[] = [];
  const leadsStmts: string[] = [];
  const callLogsStmts: string[] = [];
  const followUpsStmts: string[] = [];
  const auditLogsStmts: string[] = [];

  for (const s of rawStatements) {
    const trimmed = s.trim();
    if (!trimmed || trimmed.startsWith('--') || trimmed.startsWith('CREATE TABLE') || trimmed === 'BEGIN' || trimmed === 'COMMIT') continue;

    if (trimmed.includes('INSERT INTO users')) usersStmts.push(trimmed);
    else if (trimmed.includes('INSERT INTO industries')) industriesStmts.push(trimmed);
    else if (trimmed.includes('INSERT INTO imported_batches')) batchesStmts.push(trimmed);
    else if (trimmed.includes('INSERT INTO businesses')) businessesStmts.push(trimmed);
    else if (trimmed.includes('INSERT INTO leads')) leadsStmts.push(trimmed);
    else if (trimmed.includes('INSERT INTO call_logs')) callLogsStmts.push(trimmed);
    else if (trimmed.includes('INSERT INTO follow_ups')) followUpsStmts.push(trimmed);
    else if (trimmed.includes('INSERT INTO audit_logs')) auditLogsStmts.push(trimmed);
  }

  console.log(`Parsed statements:
    Users: ${usersStmts.length}
    Industries: ${industriesStmts.length}
    Batches: ${batchesStmts.length}
    Businesses: ${businessesStmts.length}
    Leads: ${leadsStmts.length}
    Call Logs: ${callLogsStmts.length}
    Follow Ups: ${followUpsStmts.length}
    Audit Logs: ${auditLogsStmts.length}
  `);

  async function executeGroup(name: string, stmts: string[]) {
    console.log(`Inserting ${name} (${stmts.length})...`);
    // Group in chunks of 50
    const chunkSize = 50;
    for (let i = 0; i < stmts.length; i += chunkSize) {
      const chunk = stmts.slice(i, i + chunkSize).join(';\n');
      try {
        await client.query(chunk);
      } catch (e: any) {
        // execute one by one if chunk fails
        for (const single of stmts.slice(i, i + chunkSize)) {
          try { await client.query(single); } catch (err) {}
        }
      }
    }
  }

  await executeGroup('users', usersStmts);
  await executeGroup('industries', industriesStmts);
  await executeGroup('imported_batches', batchesStmts);
  await executeGroup('businesses', businessesStmts);
  await executeGroup('leads', leadsStmts);
  await executeGroup('call_logs', callLogsStmts);
  await executeGroup('follow_ups', followUpsStmts);
  await executeGroup('audit_logs', auditLogsStmts);

  console.log('Restoration completed!');

  const stats = await client.query(`
    SELECT 'users' as table_name, count(*) as row_count from users
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

restoreOrdered().catch(console.error);
