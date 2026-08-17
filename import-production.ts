import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import { db, pool } from './src/db/index.ts';
import * as schema from './src/db/schema.ts';

async function importProductionData(filePath: string) {
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  console.log(`Reading production backup file: ${filePath}...`);
  const raw = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(raw);

  console.log('--- Production Data Contents ---');
  console.log(`Users:            ${data.users?.length || 0}`);
  console.log(`Industries:       ${data.industries?.length || 0}`);
  console.log(`Imported Batches: ${data.imported_batches?.length || 0}`);
  console.log(`Businesses:       ${data.businesses?.length || 0}`);
  console.log(`Leads:            ${data.leads?.length || 0}`);
  console.log(`Call Logs:        ${data.call_logs?.length || 0}`);
  console.log(`Follow Ups:       ${data.follow_ups?.length || 0}`);
  console.log(`Audit Logs:       ${data.audit_logs?.length || 0}`);
  console.log(`Settings:         ${data.settings?.length || 0}`);

  console.log('\nCleaning existing local data...');
  await pool.query('TRUNCATE users, industries, imported_batches, businesses, leads, call_logs, follow_ups, audit_logs, settings, sessions CASCADE;');

  const orgId = 'org_default';

  // 1. Users
  if (Array.isArray(data.users)) {
    for (const u of data.users) {
      if (!u || !u.id) continue;
      await db.insert(schema.users).values({
        id: u.id,
        orgId: u.org_id || u.orgId || orgId,
        name: u.name,
        email: u.email,
        role: u.role,
        password: u.password,
        avatarUrl: u.avatar_url || u.avatarUrl || null,
        twoFactorEnabled: !!(u.two_factor_enabled ?? u.twoFactorEnabled),
        twoFactorPin: u.two_factor_pin || u.twoFactorPin || null,
        active: u.active !== undefined ? u.active : true,
        lastActiveAt: u.last_active_at || u.lastActiveAt || new Date().toISOString(),
        createdAt: u.created_at || u.createdAt || new Date().toISOString(),
      }).onConflictDoNothing();
    }
  }

  // 2. Industries
  if (Array.isArray(data.industries)) {
    for (const ind of data.industries) {
      if (!ind || !ind.id) continue;
      await db.insert(schema.industries).values({
        id: ind.id,
        orgId: ind.org_id || ind.orgId || orgId,
        name: ind.name,
        defaultPitch: ind.default_pitch || ind.defaultPitch || null,
      }).onConflictDoNothing();
    }
  }

  // 3. Batches
  if (Array.isArray(data.imported_batches)) {
    for (const b of data.imported_batches) {
      if (!b || !b.id) continue;
      await db.insert(schema.importedBatches).values({
        id: b.id,
        orgId: b.org_id || b.orgId || orgId,
        fileName: b.file_name || b.fileName || 'Batch',
        totalLeads: b.total_leads || b.totalLeads || 0,
        allowedCallerIds: b.allowed_caller_ids || b.allowedCallerIds || null,
        importedById: b.imported_by_id || b.importedById || null,
        importedByName: b.imported_by_name || b.importedByName || null,
        createdAt: b.created_at || b.createdAt || new Date().toISOString(),
      }).onConflictDoNothing();
    }
  }

  // 4. Businesses
  if (Array.isArray(data.businesses)) {
    for (const biz of data.businesses) {
      if (!biz || !biz.id) continue;
      await db.insert(schema.businesses).values({
        id: biz.id,
        batchId: biz.batch_id || biz.batchId || null,
        orgId: biz.org_id || biz.orgId || orgId,
        name: biz.name || 'Business',
        phone: biz.phone || 'N/A',
        hasWebsite: !!(biz.has_website ?? biz.hasWebsite),
        websiteUrl: biz.website_url || biz.websiteUrl || null,
        industry: biz.industry || 'General Business',
        address: biz.address || 'N/A',
        city: biz.city || null,
        state: biz.state || null,
        zip: biz.zip || null,
        email: biz.email || null,
        contactPerson: biz.contact_person || biz.contactPerson || null,
        createdAt: biz.created_at || biz.createdAt || new Date().toISOString(),
      }).onConflictDoNothing();
    }
  }

  // 5. Leads
  if (Array.isArray(data.leads)) {
    for (const l of data.leads) {
      if (!l || !l.id || !l.business_id && !l.businessId) continue;
      await db.insert(schema.leads).values({
        id: l.id,
        orgId: l.org_id || l.orgId || orgId,
        businessId: l.business_id || l.businessId,
        status: l.status || 'unassigned',
        assignedCallerId: l.assigned_caller_id || l.assignedCallerId || null,
        assignedCallerName: l.assigned_caller_name || l.assignedCallerName || null,
        allowedCallerIds: l.allowed_caller_ids || l.allowedCallerIds || null,
        reservedAt: l.reserved_at || l.reservedAt || null,
        completedAt: l.completed_at || l.completedAt || null,
        currentCycle: l.current_cycle || l.currentCycle || 1,
        createdAt: l.created_at || l.createdAt || new Date().toISOString(),
      }).onConflictDoNothing();
    }
  }

  // 6. Call Logs
  if (Array.isArray(data.call_logs)) {
    for (const cl of data.call_logs) {
      if (!cl || !cl.id) continue;
      await db.insert(schema.callLogs).values({
        id: cl.id,
        orgId: cl.org_id || cl.orgId || orgId,
        leadId: cl.lead_id || cl.leadId || null,
        businessId: cl.business_id || cl.businessId || null,
        callerId: cl.caller_id || cl.callerId || null,
        callerName: cl.caller_name || cl.callerName || 'Caller',
        whoAnswered: cl.who_answered || cl.whoAnswered || 'Answered',
        callOutcome: cl.call_outcome || cl.callOutcome || null,
        pitchGiven: cl.pitch_given || cl.pitchGiven || null,
        objectionReason: cl.objection_reason || cl.objectionReason || null,
        hasFollowup: !!(cl.has_followup ?? cl.hasFollowup),
        followupAt: cl.followup_at || cl.followupAt || null,
        followupMethod: cl.followup_method || cl.followupMethod || null,
        contactName: cl.contact_name || cl.contactName || null,
        contactEmail: cl.contact_email || cl.contactEmail || null,
        notes: cl.notes || null,
        createdAt: cl.created_at || cl.createdAt || new Date().toISOString(),
      }).onConflictDoNothing();
    }
  }

  // 7. Follow Ups
  if (Array.isArray(data.follow_ups)) {
    for (const fu of data.follow_ups) {
      if (!fu || !fu.id || !fu.scheduled_at && !fu.scheduledAt) continue;
      await db.insert(schema.followUps).values({
        id: fu.id,
        orgId: fu.org_id || fu.orgId || orgId,
        callLogId: fu.call_log_id || fu.callLogId || null,
        leadId: fu.lead_id || fu.leadId || null,
        businessId: fu.business_id || fu.businessId || null,
        callerId: fu.caller_id || fu.callerId || null,
        status: fu.status || 'interested',
        scheduledAt: fu.scheduled_at || fu.scheduledAt,
        method: fu.method || 'Call',
        notes: fu.notes || null,
        createdAt: fu.created_at || fu.createdAt || new Date().toISOString(),
      }).onConflictDoNothing();
    }
  }

  // 8. Audit Logs
  if (Array.isArray(data.audit_logs)) {
    for (const al of data.audit_logs) {
      if (!al || !al.id) continue;
      await db.insert(schema.auditLogs).values({
        id: al.id,
        orgId: al.org_id || al.orgId || orgId,
        userId: al.user_id || al.userId || 'system',
        userName: al.user_name || al.userName || 'System',
        action: al.action || 'LOG',
        targetType: al.target_type || al.targetType || 'system',
        targetId: al.target_id || al.targetId || null,
        details: al.details || '',
        timestamp: al.timestamp || new Date().toISOString(),
      }).onConflictDoNothing();
    }
  }

  // 9. Settings
  if (Array.isArray(data.settings)) {
    for (const s of data.settings) {
      if (!s) continue;
      await db.insert(schema.settings).values({
        orgId: s.org_id || s.orgId || orgId,
        reservationTimeoutMinutes: s.reservation_timeout_minutes || s.reservationTimeoutMinutes || 10,
      }).onConflictDoUpdate({
        target: schema.settings.orgId,
        set: { reservationTimeoutMinutes: s.reservation_timeout_minutes || s.reservationTimeoutMinutes || 10 },
      });
    }
  }

  console.log('\n✅ Production data successfully imported into local PostgreSQL!');
  process.exit(0);
}

const fileArg = process.argv[2] || 'production_crm_backup.json';
importProductionData(path.resolve(process.cwd(), fileArg)).catch(e => {
  console.error('Import failed:', e);
  process.exit(1);
});
