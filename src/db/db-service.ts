import { db, pool } from './index';
import * as schema from './schema';
import { eq, and, or, isNull, inArray, sql, desc, lte, gte } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

const SALT_ROUNDS = 10;

function isBcryptHash(str: string): boolean {
  return typeof str === 'string' && (str.startsWith('$2a$') || str.startsWith('$2b$'));
}

function hashPassword(plain: string): string {
  if (!plain) return '';
  if (isBcryptHash(plain)) return plain;
  return bcrypt.hashSync(plain.trim(), SALT_ROUNDS);
}

function calculateSmartPitch(hasWebsite: boolean): string {
  return hasWebsite ? 'AI Receptionist Only' : 'Website + AI Receptionist';
}

export async function ensureTablesExist() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL DEFAULT 'org_default',
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        role TEXT NOT NULL,
        password TEXT,
        avatar_url TEXT,
        two_factor_enabled BOOLEAN DEFAULT false,
        two_factor_pin TEXT,
        active BOOLEAN NOT NULL DEFAULT true,
        last_active_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS industries (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL DEFAULT 'org_default',
        name TEXT NOT NULL,
        default_pitch TEXT
      );

      CREATE TABLE IF NOT EXISTS imported_batches (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL DEFAULT 'org_default',
        file_name TEXT NOT NULL,
        total_leads INTEGER DEFAULT 0,
        allowed_caller_ids JSONB,
        imported_by_id TEXT,
        imported_by_name TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS businesses (
        id TEXT PRIMARY KEY,
        batch_id TEXT REFERENCES imported_batches(id) ON DELETE SET NULL,
        org_id TEXT NOT NULL DEFAULT 'org_default',
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        has_website BOOLEAN DEFAULT false,
        website_url TEXT,
        industry TEXT NOT NULL,
        address TEXT NOT NULL,
        city TEXT,
        state TEXT,
        zip TEXT,
        email TEXT,
        contact_person TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS leads (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL DEFAULT 'org_default',
        business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'unassigned',
        assigned_caller_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        assigned_caller_name TEXT,
        allowed_caller_ids JSONB,
        reserved_at TIMESTAMP,
        completed_at TIMESTAMP,
        current_cycle INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS call_logs (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL DEFAULT 'org_default',
        lead_id TEXT REFERENCES leads(id) ON DELETE CASCADE,
        business_id TEXT REFERENCES businesses(id) ON DELETE CASCADE,
        caller_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        caller_name TEXT NOT NULL,
        who_answered TEXT NOT NULL,
        call_outcome TEXT,
        pitch_given TEXT,
        objection_reason TEXT,
        has_followup BOOLEAN DEFAULT false,
        followup_at TIMESTAMP,
        followup_method TEXT,
        contact_name TEXT,
        contact_email TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS follow_ups (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL DEFAULT 'org_default',
        call_log_id TEXT REFERENCES call_logs(id) ON DELETE CASCADE,
        lead_id TEXT REFERENCES leads(id) ON DELETE CASCADE,
        business_id TEXT REFERENCES businesses(id) ON DELETE CASCADE,
        caller_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        status TEXT NOT NULL DEFAULT 'interested',
        scheduled_at TIMESTAMP NOT NULL,
        method TEXT DEFAULT 'Call',
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL DEFAULT 'org_default',
        user_id TEXT NOT NULL,
        user_name TEXT NOT NULL,
        action TEXT NOT NULL,
        target_type TEXT NOT NULL,
        target_id TEXT,
        details TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS settings (
        org_id TEXT PRIMARY KEY DEFAULT 'org_default',
        reservation_timeout_minutes INTEGER DEFAULT 10
      );

      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('[Database] All required PostgreSQL tables verified/created successfully.');
  } catch (err) {
    console.error('[Database] Error ensuring tables exist:', err);
  }
}

export async function seedInitialDataIfNeeded() {
  try {
    await ensureTablesExist();
    const existingUsers = await db.select().from(schema.users).limit(1);
    
    // Check if local db.json exists to migrate existing data
    const localDbPath = path.join(process.cwd(), '.data', 'db.json');
    const rootDbPath = path.join(process.cwd(), 'db.json');
    let localData: any = null;

    if (fs.existsSync(localDbPath)) {
      try {
        localData = JSON.parse(fs.readFileSync(localDbPath, 'utf-8'));
      } catch (e) {}
    } else if (fs.existsSync(rootDbPath)) {
      try {
        localData = JSON.parse(fs.readFileSync(rootDbPath, 'utf-8'));
      } catch (e) {}
    }

    if (existingUsers.length === 0) {
      console.log('[Cloud SQL] Database is empty. Migrating local data or inserting seed data...');

      const now = new Date().toISOString();
      const orgId = 'org_default';

      if (localData && Array.isArray(localData.users) && localData.users.length > 0) {
        console.log(`[Cloud SQL] Migrating ${localData.users.length} users, ${localData.businesses?.length || 0} businesses, ${localData.leads?.length || 0} leads from local storage...`);
        
        // Migrate Users
        for (const u of localData.users) {
          if (!u || !u.id) continue;
          await db.insert(schema.users).values({
            id: u.id,
            orgId: u.org_id || orgId,
            name: u.name,
            email: u.email,
            role: u.role || 'caller',
            password: u.password ? hashPassword(u.password) : hashPassword('Caller@1234'),
            avatarUrl: u.avatar_url || null,
            twoFactorEnabled: !!u.two_factor_enabled,
            twoFactorPin: u.two_factor_pin || null,
            active: u.active !== undefined ? u.active : true,
            lastActiveAt: u.last_active_at || now,
            createdAt: u.created_at || now,
          }).onConflictDoNothing();
        }

        // Migrate Industries
        if (Array.isArray(localData.industries)) {
          for (const ind of localData.industries) {
            if (!ind || !ind.id) continue;
            await db.insert(schema.industries).values({
              id: ind.id,
              orgId: ind.org_id || orgId,
              name: ind.name,
              defaultPitch: ind.default_pitch || null,
            }).onConflictDoNothing();
          }
        }

        // Migrate Imported Batches
        if (Array.isArray(localData.imported_batches)) {
          for (const b of localData.imported_batches) {
            if (!b || !b.id) continue;
            await db.insert(schema.importedBatches).values({
              id: b.id,
              orgId: b.org_id || orgId,
              fileName: b.file_name || 'Imported_Leads.csv',
              totalLeads: b.total_leads || 0,
              allowedCallerIds: Array.isArray(b.allowed_caller_ids) ? b.allowed_caller_ids : null,
              importedById: b.imported_by_id || null,
              importedByName: b.imported_by_name || null,
              createdAt: b.created_at || now,
            }).onConflictDoNothing();
          }
        }

        // Migrate Businesses
        if (Array.isArray(localData.businesses)) {
          for (const biz of localData.businesses) {
            if (!biz || !biz.id) continue;
            await db.insert(schema.businesses).values({
              id: biz.id,
              batchId: biz.batch_id || null,
              orgId: biz.org_id || orgId,
              name: biz.name || 'Business',
              phone: biz.phone || 'N/A',
              hasWebsite: !!biz.has_website,
              websiteUrl: biz.website_url || null,
              industry: biz.industry || 'General Business',
              address: biz.address || 'N/A',
              city: biz.city || null,
              state: biz.state || null,
              zip: biz.zip || null,
              email: biz.email || null,
              contactPerson: biz.contact_person || null,
              createdAt: biz.created_at || now,
            }).onConflictDoNothing();
          }
        }

        // Get set of all valid user IDs
        const insertedUsersList = await db.select({ id: schema.users.id }).from(schema.users);
        const validUserIds = new Set(insertedUsersList.map(u => u.id));

        // Migrate Leads
        if (Array.isArray(localData.leads)) {
          for (const l of localData.leads) {
            if (!l || !l.id || !l.business_id) continue;
            const hasValidCaller = l.assigned_caller_id && validUserIds.has(l.assigned_caller_id);
            await db.insert(schema.leads).values({
              id: l.id,
              orgId: l.org_id || orgId,
              businessId: l.business_id,
              status: hasValidCaller ? (l.status || 'unassigned') : 'unassigned',
              assignedCallerId: hasValidCaller ? l.assigned_caller_id : null,
              assignedCallerName: hasValidCaller ? l.assigned_caller_name : null,
              allowedCallerIds: Array.isArray(l.allowed_caller_ids) ? l.allowed_caller_ids : null,
              reservedAt: hasValidCaller ? (l.reserved_at || null) : null,
              completedAt: l.completed_at || null,
              currentCycle: l.current_cycle || 1,
              createdAt: l.created_at || now,
            }).onConflictDoNothing();
          }
        }

        // Migrate Call Logs
        if (Array.isArray(localData.call_logs)) {
          for (const cl of localData.call_logs) {
            if (!cl || !cl.id) continue;
            const hasValidCaller = cl.caller_id && validUserIds.has(cl.caller_id);
            await db.insert(schema.callLogs).values({
              id: cl.id,
              orgId: cl.org_id || orgId,
              leadId: cl.lead_id || null,
              businessId: cl.business_id || null,
              callerId: hasValidCaller ? cl.caller_id : null,
              callerName: cl.caller_name || 'Caller',
              whoAnswered: cl.who_answered || 'Answered',
              callOutcome: cl.call_outcome || null,
              pitchGiven: cl.pitch_given || null,
              objectionReason: cl.objection_reason || null,
              hasFollowup: !!cl.has_followup,
              followupAt: cl.followup_at || null,
              followupMethod: cl.followup_method || null,
              contactName: cl.contact_name || null,
              contactEmail: cl.contact_email || null,
              notes: cl.notes || null,
              createdAt: cl.created_at || now,
            }).onConflictDoNothing();
          }
        }

        // Migrate Follow Ups
        if (Array.isArray(localData.follow_ups)) {
          for (const fu of localData.follow_ups) {
            if (!fu || !fu.id || !fu.scheduled_at) continue;
            const hasValidCaller = fu.caller_id && validUserIds.has(fu.caller_id);
            await db.insert(schema.followUps).values({
              id: fu.id,
              orgId: fu.org_id || orgId,
              callLogId: fu.call_log_id || null,
              leadId: fu.lead_id || null,
              businessId: fu.business_id || null,
              callerId: hasValidCaller ? fu.caller_id : null,
              status: fu.status || 'interested',
              scheduledAt: fu.scheduled_at,
              method: fu.method || 'Call',
              notes: fu.notes || null,
              createdAt: fu.created_at || now,
            }).onConflictDoNothing();
          }
        }

        // Migrate Audit Logs
        if (Array.isArray(localData.audit_logs)) {
          for (const al of localData.audit_logs) {
            if (!al || !al.id) continue;
            await db.insert(schema.auditLogs).values({
              id: al.id,
              orgId: al.org_id || orgId,
              userId: al.user_id || 'system',
              userName: al.user_name || 'System',
              action: al.action || 'LOG',
              targetType: al.target_type || 'system',
              targetId: al.target_id || null,
              details: al.details || '',
              timestamp: al.timestamp || now,
            }).onConflictDoNothing();
          }
        }

        console.log('[Cloud SQL] Data migration completed successfully.');
      } else {
        // Insert default Seed Data
        await db.insert(schema.users).values({
          id: 'usr_admin',
          orgId,
          name: 'Fahad Riaz (Admin)',
          email: 'fahadriazcs@gmail.com',
          role: 'admin',
          password: hashPassword('Fahad@6599'),
          active: true,
          lastActiveAt: now,
          createdAt: now,
        }).onConflictDoNothing();

        const defaultIndustries = [
          { id: 'ind_1', orgId, name: 'Dental Clinic', defaultPitch: 'AI Dental Front Desk' },
          { id: 'ind_2', orgId, name: 'Barber Shop / Salon', defaultPitch: '24/7 Appointment Booking' },
          { id: 'ind_3', orgId, name: 'Restaurant / Dining', defaultPitch: 'Table & Takeout Reservation AI' },
          { id: 'ind_4', orgId, name: 'Auto Repair', defaultPitch: 'Service Scheduling Assistant' },
          { id: 'ind_5', orgId, name: 'Plumbing & HVAC', defaultPitch: 'Dispatch Call Handling AI' },
        ];

        for (const ind of defaultIndustries) {
          await db.insert(schema.industries).values(ind).onConflictDoNothing();
        }

        await db.insert(schema.auditLogs).values({
          id: `aud_seed_${Date.now()}`,
          orgId,
          userId: 'usr_admin',
          userName: 'Fahad Riaz (Admin)',
          action: 'SYSTEM_INITIALIZED',
          targetType: 'system',
          details: 'Initialized agency CRM database on Cloud SQL (PostgreSQL) with Admin account.',
          timestamp: now,
        }).onConflictDoNothing();

        console.log('[Cloud SQL] Default seed data initialized.');
      }

      // Self-healing: Ensure every business has a corresponding lead record
      await pool.query(`
        INSERT INTO leads (id, org_id, business_id, status, allowed_caller_ids, current_cycle, created_at)
        SELECT 'lead_' || id, org_id, id, 'unassigned', NULL, 1, COALESCE(created_at, NOW())
        FROM businesses b
        WHERE NOT EXISTS (SELECT 1 FROM leads l WHERE l.business_id = b.id)
      `);
    } else {
      // Ensure admin user exists with correct password hash
      const adminUsers = await db.select().from(schema.users).where(eq(schema.users.email, 'fahadriazcs@gmail.com'));
      if (adminUsers.length === 0) {
        await db.insert(schema.users).values({
          id: 'usr_admin',
          orgId: 'org_default',
          name: 'Fahad Riaz (Admin)',
          email: 'fahadriazcs@gmail.com',
          role: 'admin',
          password: hashPassword('Fahad@6599'),
          active: true,
          lastActiveAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        }).onConflictDoNothing();
      }
    }
  } catch (error) {
    console.error('Error seeding Cloud SQL data:', error);
  }
}

// Clean expired reservations
export async function cleanExpiredReservations(orgId: string = 'org_default') {
  try {
    let timeoutMinutes = 10;
    const settingsRes = await db.select().from(schema.settings).where(eq(schema.settings.orgId, orgId));
    if (settingsRes.length > 0 && settingsRes[0].reservationTimeoutMinutes) {
      timeoutMinutes = settingsRes[0].reservationTimeoutMinutes;
    }
    const cutoffTime = new Date(Date.now() - timeoutMinutes * 60 * 1000).toISOString();

    const expiredLeads = await db.select().from(schema.leads).where(
      and(
        eq(schema.leads.orgId, orgId),
        eq(schema.leads.status, 'reserved'),
        lte(schema.leads.reservedAt, cutoffTime)
      )
    );

    for (const lead of expiredLeads) {
      const callerName = lead.assignedCallerName || lead.assignedCallerId || 'Unknown';
      await db.update(schema.leads).set({
        status: 'unassigned',
        assignedCallerId: null,
        assignedCallerName: null,
        reservedAt: null,
      }).where(eq(schema.leads.id, lead.id));

      await db.insert(schema.auditLogs).values({
        id: `aud_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        orgId,
        userId: 'system',
        userName: 'System Auto-Cleaner',
        action: 'LEAD_RESERVATION_EXPIRED',
        targetType: 'lead',
        targetId: lead.id,
        details: `Reservation expired after ${timeoutMinutes} mins for caller ${callerName}. Returned to queue.`,
        timestamp: new Date().toISOString(),
      });
    }
    return expiredLeads.length;
  } catch (error) {
    console.error('Error cleaning expired reservations:', error);
    return 0;
  }
}

// Sessions
export async function saveSession(token: string, userIdOrUser: string | any) {
  try {
    const cleanUserId = typeof userIdOrUser === 'string' ? userIdOrUser : userIdOrUser?.id;
    if (!cleanUserId) return;
    await db.insert(schema.sessions).values({
      token,
      userId: cleanUserId,
      createdAt: new Date().toISOString(),
    }).onConflictDoNothing();
  } catch (error) {
    console.error('Error saving session:', error);
  }
}

export async function getSessionUser(token: string) {
  try {
    const res = await pool.query(
      `SELECT u.* FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = $1 LIMIT 1`,
      [token]
    );
    return res.rows[0] || null;
  } catch (error) {
    console.error('Error getting session user:', error);
    return null;
  }
}

export async function deleteSession(token: string) {
  try {
    await db.delete(schema.sessions).where(eq(schema.sessions.token, token));
  } catch (error) {
    console.error('Error deleting session:', error);
  }
}
