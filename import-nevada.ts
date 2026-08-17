import fs from 'fs';
import Papa from 'papaparse';
import pg from 'pg';

const NEON_URL = 'postgresql://neondb_owner:npg_m7kGWiOZUAw4@ep-dry-forest-ay3ln0tr.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require';

const callerIds = [
  'usr_1785296597006', // Ghufran
  'usr_1785522663846', // Aleem
  'usr_1785332494030', // Kiyani
  'usr_1785296652254', // Umair
  'usr_1785435112543', // Hasham Awan
];

function extractFlexibleColumn(row: any, candidates: string[]): string {
  if (!row || typeof row !== 'object') return '';
  const keys = Object.keys(row);
  for (const candidate of candidates) {
    const targetNorm = candidate.toLowerCase().replace(/[^a-z0-9]/g, '');
    const matchKey = keys.find(
      (k) => k.toLowerCase().replace(/[^a-z0-9]/g, '') === targetNorm
    );
    if (matchKey && row[matchKey] !== undefined && row[matchKey] !== null) {
      const val = String(row[matchKey]).trim();
      if (val) return val;
    }
  }
  return '';
}

async function importCsv(filePath: string, fileName: string) {
  const client = new pg.Client({ connectionString: NEON_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log(`Reading ${filePath}...`);
  const csvContent = fs.readFileSync(filePath, 'utf8');
  const parsed = Papa.parse(csvContent, { header: true, skipEmptyLines: true });

  const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const orgId = 'org_default';

  await client.query(
    `INSERT INTO imported_batches (id, org_id, file_name, total_leads, allowed_caller_ids, imported_by_id, imported_by_name, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
    [batchId, orgId, fileName, parsed.data.length, JSON.stringify(callerIds), 'usr_admin', 'Fahad Riaz (Admin)']
  );

  let inserted = 0;
  for (const row of parsed.data as any[]) {
    const name = extractFlexibleColumn(row, ['Business Name', 'name', 'company', 'Business']);
    const phone = extractFlexibleColumn(row, ['Phone Number', 'phone', 'telephone', 'Phone']);
    if (!name || !phone) continue;

    const hasWebsite = extractFlexibleColumn(row, ['Has Website', 'website', 'has_website']);
    const isWebsite = hasWebsite && hasWebsite.toLowerCase() !== 'false' && hasWebsite.toLowerCase() !== 'no' && hasWebsite.toLowerCase() !== 'no_website' && hasWebsite.toLowerCase() !== '';
    const websiteUrl = isWebsite && hasWebsite.startsWith('http') ? hasWebsite : null;
    const industry = extractFlexibleColumn(row, ['Industry', 'Category', 'type']) || 'Dental Clinic';
    const address = extractFlexibleColumn(row, ['Address', 'street']);
    const city = extractFlexibleColumn(row, ['City']);
    const state = extractFlexibleColumn(row, ['State']);
    const zip = extractFlexibleColumn(row, ['Zip', 'zip_code', 'postal_code']);
    const email = extractFlexibleColumn(row, ['Email', 'contact_email']);
    const contact = extractFlexibleColumn(row, ['Contact', 'contact_person']);

    const bizId = `biz_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    await client.query(
      `INSERT INTO businesses (id, batch_id, org_id, name, phone, has_website, website_url, industry, address, city, state, zip, email, contact_person, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())`,
      [bizId, batchId, orgId, name, phone, !!isWebsite, websiteUrl, industry, address || '', city || null, state || null, zip || null, email || null, contact || null]
    );

    const leadId = `lead_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    await client.query(
      `INSERT INTO leads (id, org_id, business_id, status, allowed_caller_ids, current_cycle, created_at)
       VALUES ($1, $2, $3, 'unassigned', $4, 1, NOW())`,
      [leadId, orgId, bizId, JSON.stringify(callerIds)]
    );

    inserted++;
  }

  console.log(`Imported ${inserted} leads from ${fileName}`);
  await client.end();
}

async function main() {
  await importCsv('C:\\Users\\Malik Fahad Awan\\Downloads\\nevada dentists - Sheet1.csv', 'nevada dentists - Sheet1.csv');
}

main().catch(console.error);
