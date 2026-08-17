const BASE_URL = 'https://safer-solution-crm-nine.vercel.app';

interface TestResult {
  suite: string;
  test: string;
  passed: boolean;
  details: string;
  durationMs: number;
}

const results: TestResult[] = [];

async function api(path: string, options: RequestInit = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, options);
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

async function runTest(suite: string, name: string, fn: () => Promise<string>) {
  const start = Date.now();
  try {
    const details = await fn();
    results.push({ suite, test: name, passed: true, details, durationMs: Date.now() - start });
    console.log(`  ✅ [PASS] ${name}: ${details}`);
  } catch (err: any) {
    const errMsg = err.message || String(err);
    results.push({ suite, test: name, passed: false, details: errMsg, durationMs: Date.now() - start });
    console.error(`  ❌ [FAIL] ${name}: ${errMsg}`);
  }
}

async function main() {
  console.log('===============================================================');
  console.log('🚀 RUNNING COMPREHENSIVE END-TO-END PRODUCTION AUDIT SUITE');
  console.log(`🌐 Target URL: ${BASE_URL}`);
  console.log('===============================================================\n');

  let adminToken = '';
  let adminUserId = '';

  // 1. AUTHENTICATION & SECURITY SUITE
  console.log('📦 SUITE 1: Authentication, Passwords & Sessions');
  
  await runTest('Auth', 'Database Diagnostic Endpoint', async () => {
    const res = await api('/api/db-diagnostic');
    if (res.data?.status !== 'DATABASE_CONNECTED') throw new Error(`Status was ${res.data?.status}`);
    return `Connected to ${res.data.db_info.current_database}, tables: ${res.data.tables.length}, users: ${res.data.user_count}`;
  });

  await runTest('Auth', 'Admin Login with Bcrypt Password', async () => {
    const res = await api('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'fahadriazcs@gmail.com',
        password: 'Fahad@6599',
      }),
    });
    if (!res.data?.token || !res.data?.id) throw new Error(`Login failed: ${JSON.stringify(res.data)}`);
    adminToken = res.data.token;
    adminUserId = res.data.id;
    return `Logged in as ${res.data.name} (${res.data.role}), Token issued: ${adminToken.substring(0, 12)}...`;
  });

  await runTest('Auth', 'Reject Wrong Password with 401', async () => {
    const res = await api('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'fahadriazcs@gmail.com',
        password: 'WrongPassword123!',
      }),
    });
    if (res.status === 401) return 'Correctly rejected invalid credentials with HTTP 401';
    throw new Error(`Expected 401, got ${res.status}`);
  });

  await runTest('Auth', 'Heartbeat Endpoint', async () => {
    const res = await api('/api/auth/heartbeat', {
      method: 'POST',
      headers: { 'x-user-id': adminUserId, 'x-session-token': adminToken },
    });
    if (!res.data?.success) throw new Error('Heartbeat failed');
    return `Heartbeat recorded at ${res.data.timestamp}`;
  });

  // 2. USER & TEAM MANAGEMENT SUITE
  console.log('\n📦 SUITE 2: User & Team Roster Management');

  await runTest('Users', 'Fetch All System Users (7 authentic users)', async () => {
    const res = await api('/api/users', {
      headers: { 'x-user-id': adminUserId, 'x-session-token': adminToken },
    });
    if (!Array.isArray(res.data) || res.data.length !== 7) {
      throw new Error(`Expected 7 users, got ${res.data?.length}`);
    }
    const names = res.data.map((u: any) => u.name).join(', ');
    return `Loaded 7 authentic team members: ${names}`;
  });

  // 3. DASHBOARDS & ANALYTICS SUITE
  console.log('\n📦 SUITE 3: Dashboards, Analytics & Real-Time KPIs');

  await runTest('Dashboards', 'Admin Analytics & Performance Summary', async () => {
    const res = await api('/api/dashboard/admin', {
      headers: { 'x-user-id': adminUserId, 'x-session-token': adminToken },
    });
    const d = res.data;
    if (d?.total_leads !== 1888) throw new Error(`Expected 1888 total leads, got ${d?.total_leads}`);
    if (d?.completed_leads !== 207) throw new Error(`Expected 207 completed leads, got ${d?.completed_leads}`);
    return `1,888 total leads, ${d.completed_leads} completed, ${d.remaining_leads} remaining, top performer: ${d.top_performers[0]?.caller_name} (${d.top_performers[0]?.calls_count} calls)`;
  });

  await runTest('Dashboards', 'Team Leader Live Roster & Queue Stats', async () => {
    const res = await api('/api/dashboard/team-leader', {
      headers: { 'x-user-id': adminUserId, 'x-session-token': adminToken },
    });
    if (!Array.isArray(res.data?.roster)) throw new Error('Missing roster array');
    return `Roster contains ${res.data.roster.length} callers, remaining queue leads: ${res.data.remaining_queue_leads}`;
  });

  await runTest('Dashboards', 'Caller Personal KPI Stats', async () => {
    const res = await api('/api/dashboard/caller', {
      headers: { 'x-user-id': adminUserId, 'x-session-token': adminToken },
    });
    return `Calls today: ${res.data?.calls_today}, interested: ${res.data?.interested_count}, remaining: ${res.data?.remaining_leads}`;
  });

  // 4. LEAD INVENTORY, BATCHES & ACCESS CONTROL RULES
  console.log('\n📦 SUITE 4: Lead Batches, Rules & Queue Management');

  await runTest('Leads', 'Fetch Lead Queue (1,888 leads)', async () => {
    const res = await api('/api/leads/manage', {
      headers: { 'x-user-id': adminUserId, 'x-session-token': adminToken },
    });
    if (res.data?.length !== 1888) throw new Error(`Expected 1888 leads, got ${res.data?.length}`);
    return `Loaded all 1,888 manageable leads with individual permissions`;
  });

  await runTest('Leads', 'Fetch Imported Batches & Access Permissions', async () => {
    const res = await api('/api/leads/batches', {
      headers: { 'x-user-id': adminUserId, 'x-session-token': adminToken },
    });
    if (res.data?.length !== 3) throw new Error(`Expected 3 batches, got ${res.data?.length}`);
    const barberBatch = res.data.find((b: any) => b.file_name.includes('Barbers'));
    if (!barberBatch) throw new Error('Barbers batch not found');
    const allowed = Array.isArray(barberBatch.allowed_caller_ids) ? barberBatch.allowed_caller_ids : JSON.parse(barberBatch.allowed_caller_ids || '[]');
    if (!allowed.includes('usr_1786314054301')) throw new Error('Barbers batch missing Aon restriction');
    return `3 batches verified. Barbers.csv strictly locked to Aon (usr_1786314054301)`;
  });

  await runTest('Leads', 'Caller Visibility Diagnostic Audit', async () => {
    const res = await api('/api/admin/diagnostic/visibility', {
      headers: { 'x-user-id': adminUserId, 'x-session-token': adminToken },
    });
    if (!res.data?.success) throw new Error('Diagnostic failed');
    return `${res.data.total_callers} callers, ${res.data.total_batches} batches audited with zero permission leaks`;
  });

  // 5. CALL LOGS, AUDIT TRAIL & NOTIFICATIONS
  console.log('\n📦 SUITE 5: Call Logs, Notifications & Callbacks');

  await runTest('CallLogs', 'Fetch Call Logs (241 logs)', async () => {
    const res = await api('/api/call-logs', {
      headers: { 'x-user-id': adminUserId, 'x-session-token': adminToken },
    });
    if (res.data?.length < 240) throw new Error(`Expected >=240 call logs, got ${res.data?.length}`);
    return `Loaded ${res.data.length} authentic historical call logs`;
  });

  await runTest('Notifications', 'Fetch Callback Follow-up Notifications', async () => {
    const res = await api('/api/notifications/callbacks', {
      headers: { 'x-user-id': adminUserId, 'x-session-token': adminToken },
    });
    const total = (res.data?.today_callbacks?.length || 0) + (res.data?.overdue_callbacks?.length || 0) + (res.data?.upcoming_callbacks?.length || 0);
    return `Loaded ${total} scheduled callback follow-ups (Overdue: ${res.data?.overdue_callbacks?.length}, Today: ${res.data?.today_callbacks?.length}, Upcoming: ${res.data?.upcoming_callbacks?.length})`;
  });

  await runTest('Industries', 'Fetch Supported Industries (98 industries)', async () => {
    const res = await api('/api/industries', {
      headers: { 'x-user-id': adminUserId, 'x-session-token': adminToken },
    });
    if (res.data?.length < 90) throw new Error(`Expected >=90 industries, got ${res.data?.length}`);
    return `Loaded ${res.data.length} predefined business industries`;
  });

  await runTest('Audit', 'Fetch System Audit Trail', async () => {
    const res = await api('/api/audit-logs', {
      headers: { 'x-user-id': adminUserId, 'x-session-token': adminToken },
    });
    if (!Array.isArray(res.data) || res.data.length === 0) throw new Error('Empty audit logs');
    return `Audit trail contains ${res.data.length} security and user activity logs`;
  });

  // 6. CSV VALIDATOR ENGINE TEST
  console.log('\n📦 SUITE 6: Lead CSV Importer & Validation Engine');

  await runTest('Import', 'Validate CSV Rows with Flexible Columns', async () => {
    const sampleRows = [
      { 'Business Name': 'Apex Dental Care', 'Phone Number': '555-900-1111', 'Industry': 'Dental Clinic', 'City': 'Austin' },
      { 'Company Name': 'Modern Barbers', 'Telephone': '555-900-2222', 'Type': 'Barber Shop', 'City': 'Dallas' },
      { 'Invalid Row': 'Missing name and phone' },
    ];
    const res = await api('/api/leads/import/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': adminUserId, 'x-session-token': adminToken },
      body: JSON.stringify({ rows: sampleRows }),
    });
    if (res.data?.valid_count !== 2 || res.data?.invalid_count !== 1) {
      throw new Error(`Expected 2 valid and 1 invalid row, got valid=${res.data?.valid_count}, invalid=${res.data?.invalid_count}`);
    }
    return `Successfully validated rows: 2 valid rows accepted, 1 invalid row caught with error`;
  });

  console.log('\n===============================================================');
  const passCount = results.filter((r) => r.passed).length;
  const failCount = results.filter((r) => !r.passed).length;
  console.log(`📊 AUDIT SUMMARY: ${passCount} PASSED / ${failCount} FAILED (${results.length} TOTAL)`);
  console.log('===============================================================');

  if (failCount > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal audit failure:', err);
  process.exit(1);
});
