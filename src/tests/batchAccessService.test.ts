import { pool } from '../db/index.ts';
import { canUserAccessBatchOrLead, buildPgVisibilityWhereClause, UserContext } from '../services/batchAccessService.ts';

/**
 * Test Suite: Batch Access & Visibility Service
 * Tests visibility enforcement logic across Admin, Team Leader, and Caller roles.
 */
async function runTestSuite() {
  console.log('===========================================================');
  console.log('🧪 RUNNING BATCH ACCESS SERVICE TEST SUITE');
  console.log('===========================================================\n');

  let totalTests = 0;
  let passedTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`  ✅ PASS: ${testName}`);
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      if (detail) console.error(`     Detail: ${detail}`);
    }
  }

  // --- UNIT TESTS ---
  console.log('--- 1. UNIT TESTS: Pure Rule Evaluation (canUserAccessBatchOrLead) ---');

  const adminUser: UserContext = { id: 'usr_admin', role: 'admin', name: 'Admin User' };
  const teamLeaderUser: UserContext = { id: 'usr_tl', role: 'team_leader', name: 'Team Leader User' };
  const caller1: UserContext = { id: 'usr_caller_1', role: 'caller', name: 'Caller One' };
  const caller2: UserContext = { id: 'usr_caller_2', role: 'caller', name: 'Caller Two' };

  // Case 1: Unrestricted batch (null or empty array)
  assert(
    canUserAccessBatchOrLead(adminUser, null).allowed === true,
    'Admin accesses unrestricted batch (null)'
  );
  assert(
    canUserAccessBatchOrLead(teamLeaderUser, null).allowed === true,
    'Team Leader accesses unrestricted batch (null)'
  );
  assert(
    canUserAccessBatchOrLead(caller1, null).allowed === true,
    'Caller 1 accesses unrestricted batch (null)'
  );
  assert(
    canUserAccessBatchOrLead(caller2, []).allowed === true,
    'Caller 2 accesses unrestricted batch ([])'
  );
  assert(
    canUserAccessBatchOrLead(caller1, '[]').allowed === true,
    'Caller 1 accesses unrestricted batch stringified ("[]")'
  );

  // Case 2: Single-caller restricted batch (restricted to usr_caller_1)
  const restrictedToCaller1 = ['usr_caller_1'];
  assert(
    canUserAccessBatchOrLead(adminUser, restrictedToCaller1).allowed === true,
    'Admin accesses restricted batch (bypasses caller restriction)'
  );
  assert(
    canUserAccessBatchOrLead(teamLeaderUser, restrictedToCaller1).allowed === true,
    'Team Leader accesses restricted batch (bypasses caller restriction)'
  );
  assert(
    canUserAccessBatchOrLead(caller1, restrictedToCaller1).allowed === true,
    'Allowed Caller 1 accesses restricted batch'
  );
  assert(
    canUserAccessBatchOrLead(caller2, restrictedToCaller1).allowed === false,
    'Non-allowed Caller 2 is BLOCKED from restricted batch'
  );

  // Case 3: Stringified JSON array restriction
  const stringifiedRestriction = JSON.stringify(['usr_caller_1', 'usr_caller_3']);
  assert(
    canUserAccessBatchOrLead(caller1, stringifiedRestriction).allowed === true,
    'Caller 1 accesses stringified restricted batch'
  );
  assert(
    canUserAccessBatchOrLead(caller2, stringifiedRestriction).allowed === false,
    'Caller 2 is BLOCKED from stringified restricted batch'
  );

  // --- INTEGRATION TESTS WITH POSTGRESQL ---
  console.log('\n--- 2. INTEGRATION TESTS: Live Database Queries & Role Simulation ---');

  const orgId = 'org_default';
  const testBatchId = `batch_test_${Date.now()}`;
  const testBizId = `biz_test_${Date.now()}`;
  const testLeadId1 = `lead_test_1_${Date.now()}`;
  const testLeadId2 = `lead_test_2_${Date.now()}`;

  const dbAdmin: UserContext = { id: 'usr_admin', role: 'admin' };
  const dbTL: UserContext = { id: 'usr_tl_test', role: 'team_leader' };
  const dbCallerA: UserContext = { id: 'usr_caller_A', role: 'caller' };
  const dbCallerB: UserContext = { id: 'usr_caller_B', role: 'caller' };

  try {
    // Setup test users in DB if missing
    await pool.query(
      `INSERT INTO users (id, org_id, name, email, role)
       VALUES 
         ('usr_tl_test', $1, 'Test TL', 'tl_test@crm.com', 'team_leader'),
         ('usr_caller_A', $1, 'Caller A', 'caller_a@crm.com', 'caller'),
         ('usr_caller_B', $1, 'Caller B', 'caller_b@crm.com', 'caller')
       ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role`,
      [orgId]
    );

    // Step A: Insert a Restricted Batch restricted ONLY to Caller A
    await pool.query(
      `INSERT INTO imported_batches (id, org_id, file_name, total_leads, allowed_caller_ids, created_at)
       VALUES ($1, $2, 'TestSuite_Restricted_Batch.csv', 2, $3::jsonb, NOW())`,
      [testBatchId, orgId, JSON.stringify([dbCallerA.id])]
    );

    await pool.query(
      `INSERT INTO businesses (id, batch_id, org_id, name, phone, industry, address, created_at)
       VALUES ($1, $2, $3, 'TestSuite Biz', '(555) 000-1111', 'Testing', '100 Test Ave', NOW())`,
      [testBizId, testBatchId, orgId]
    );

    await pool.query(
      `INSERT INTO leads (id, org_id, business_id, status, allowed_caller_ids, current_cycle, created_at)
       VALUES 
         ($1, $2, $3, 'unassigned', $4::jsonb, 1, NOW()),
         ($5, $2, $3, 'unassigned', $4::jsonb, 1, NOW())`,
      [testLeadId1, orgId, testBizId, JSON.stringify([dbCallerA.id]), testLeadId2]
    );

    // Test DB Queries with SQL visibility clauses
    const runQueryForUser = async (user: UserContext) => {
      const clause = buildPgVisibilityWhereClause(user.id, user.role, 2);
      const query = `
        SELECT l.id 
        FROM leads l
        WHERE l.business_id = $1 AND l.status = 'unassigned' AND ${clause.sqlClause}
      `;
      const params = [testBizId, ...clause.params];
      const res = await pool.query(query, params);
      return res.rows.length;
    };

    const adminVisibleCount = await runQueryForUser(dbAdmin);
    assert(
      adminVisibleCount === 2,
      'DB Query: Admin sees all 2 leads in restricted batch',
      `Got ${adminVisibleCount}`
    );

    const tlVisibleCount = await runQueryForUser(dbTL);
    assert(
      tlVisibleCount === 2,
      'DB Query: Team Leader sees all 2 leads in restricted batch',
      `Got ${tlVisibleCount}`
    );

    const callerAVisibleCount = await runQueryForUser(dbCallerA);
    assert(
      callerAVisibleCount === 2,
      'DB Query: Allowed Caller A sees all 2 leads in restricted batch',
      `Got ${callerAVisibleCount}`
    );

    const callerBVisibleCount = await runQueryForUser(dbCallerB);
    assert(
      callerBVisibleCount === 0,
      'DB Query: Non-allowed Caller B sees 0 leads (Strictly Blocked)',
      `Got ${callerBVisibleCount}`
    );

    // Step B: Update Batch Restrictions dynamically (Add Caller B)
    console.log('\n--- 3. DYNAMIC VISIBILITY UPDATE TEST ---');
    await pool.query(
      `UPDATE imported_batches SET allowed_caller_ids = $1::jsonb WHERE id = $2`,
      [JSON.stringify([dbCallerA.id, dbCallerB.id]), testBatchId]
    );
    await pool.query(
      `UPDATE leads SET allowed_caller_ids = $1::jsonb WHERE business_id = $2`,
      [JSON.stringify([dbCallerA.id, dbCallerB.id]), testBizId]
    );

    const callerBUpdatedCount = await runQueryForUser(dbCallerB);
    assert(
      callerBUpdatedCount === 2,
      'Dynamic Update: Caller B now sees 2 leads after being added to allowed_caller_ids',
      `Got ${callerBUpdatedCount}`
    );

    // Step C: Remove all restrictions (Make batch Global Access)
    await pool.query(
      `UPDATE imported_batches SET allowed_caller_ids = NULL WHERE id = $1`,
      [testBatchId]
    );
    await pool.query(
      `UPDATE leads SET allowed_caller_ids = NULL WHERE business_id = $1`,
      [testBizId]
    );

    const callerBGlobalCount = await runQueryForUser(dbCallerB);
    assert(
      callerBGlobalCount === 2,
      'Global Access Update: Caller B sees leads when restrictions are cleared (NULL)',
      `Got ${callerBGlobalCount}`
    );

  } finally {
    // Cleanup test records
    await pool.query(`DELETE FROM leads WHERE id IN ($1, $2)`, [testLeadId1, testLeadId2]);
    await pool.query(`DELETE FROM businesses WHERE id = $1`, [testBizId]);
    await pool.query(`DELETE FROM imported_batches WHERE id = $1`, [testBatchId]);
    await pool.query(`DELETE FROM users WHERE id IN ('usr_tl_test', 'usr_caller_A', 'usr_caller_B')`);
  }

  console.log('\n===========================================================');
  console.log(`📊 TEST SUITE SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED`);
  console.log('===========================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

// Execute test suite if run directly
runTestSuite().catch((err) => {
  console.error('Fatal Error running Batch Access Service test suite:', err);
  process.exit(1);
});
