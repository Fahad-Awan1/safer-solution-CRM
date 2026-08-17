const baseUrl = 'https://safer-solution-crm-nine.vercel.app';

const endpoints = [
  { name: 'Diagnostic', method: 'GET', path: '/api/db-diagnostic' },
  { name: 'Admin Login', method: 'POST', path: '/api/auth/login', body: { email: 'fahadriazcs@gmail.com', password: 'Fahad@6599' } },
  { name: 'Industries', method: 'GET', path: '/api/industries' },
  { name: 'Users List', method: 'GET', path: '/api/users' },
  { name: 'Admin Dashboard', method: 'GET', path: '/api/dashboard/admin' },
  { name: 'Team Leader Dashboard', method: 'GET', path: '/api/dashboard/team-leader' },
  { name: 'Caller Dashboard', method: 'GET', path: '/api/dashboard/caller' },
  { name: 'Lead Queue', method: 'GET', path: '/api/leads/manage' },
  { name: 'Lead Batches', method: 'GET', path: '/api/leads/batches' },
  { name: 'Visibility Audit', method: 'GET', path: '/api/admin/diagnostic/visibility' },
  { name: 'Call Logs', method: 'GET', path: '/api/call-logs' },
  { name: 'Callback Notifications', method: 'GET', path: '/api/notifications/callbacks' },
  { name: 'Audit Logs', method: 'GET', path: '/api/audit-logs' },
  { name: 'CSV Export', method: 'GET', path: '/api/export/csv' }
];

async function run() {
  console.log('===============================================================');
  console.log('🚀 EXECUTING NODE PRODUCTION API VERIFICATION ON VERCEL');
  console.log('===============================================================');

  let token = '';
  let passed = 0;
  let failed = 0;

  for (const ep of endpoints) {
    const sw = Date.now();
    try {
      const headers = {
        'x-user-id': 'usr_admin',
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['x-session-token'] = token;
        headers['Authorization'] = `Bearer ${token}`;
      }

      const opts = {
        method: ep.method,
        headers,
      };
      if (ep.body) opts.body = JSON.stringify(ep.body);

      const res = await fetch(`${baseUrl}${ep.path}`, opts);
      const latency = Date.now() - sw;

      if (res.ok) {
        passed++;
        const data = await res.json().catch(() => null);
        if (ep.name === 'Admin Login' && data?.token) {
          token = data.token;
        }
        console.log(`  ✅ [PASS] ${ep.name} (${res.status} OK) - ${latency}ms`);
      } else {
        failed++;
        const txt = await res.text().catch(() => '');
        console.log(`  ❌ [FAIL] ${ep.name} (${res.status}) - ${latency}ms | ${txt.substring(0, 80)}`);
      }
    } catch (err) {
      failed++;
      console.log(`  ❌ [FAIL] ${ep.name} - ${Date.now() - sw}ms | ${err.message}`);
    }
  }

  console.log('===============================================================');
  console.log(`VERIFICATION COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================');
}

run().catch(console.error);
