import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { db, pool } from './db/index';
import * as schema from './db/schema';
import { seedInitialDataIfNeeded, ensureTablesExist, cleanExpiredReservations, saveSession, getSessionUser, deleteSession } from './db/db-service';
import { eq, and, or, isNull, inArray, sql, desc, lte, gte } from 'drizzle-orm';

// --- Types ---
export type UserRole = 'admin' | 'team_leader' | 'caller';

export interface User {
  id: string;
  org_id: string;
  name: string;
  email: string;
  role: UserRole;
  password?: string;
  avatar_url?: string;
  two_factor_enabled?: boolean;
  two_factor_pin?: string;
  active: boolean;
  last_active_at: string;
  created_at: string;
}

// Security & Password Hashing Helpers
const SALT_ROUNDS = 10;

function isBcryptHash(str: string): boolean {
  return typeof str === 'string' && (str.startsWith('$2a$') || str.startsWith('$2b$'));
}

function hashPassword(plain: string): string {
  if (!plain) return '';
  if (isBcryptHash(plain)) return plain;
  return bcrypt.hashSync(plain.trim(), SALT_ROUNDS);
}

function verifyPassword(plain: string, storedHashOrPlain?: string): boolean {
  if (!storedHashOrPlain || !plain) return false;
  const trimmedPlain = plain.trim();
  if (isBcryptHash(storedHashOrPlain)) {
    return bcrypt.compareSync(trimmedPlain, storedHashOrPlain);
  }
  return trimmedPlain === storedHashOrPlain.trim();
}

function toSafeUser(user: any) {
  const { password, ...safe } = user;
  return {
    id: user.id,
    org_id: user.orgId || user.org_id || 'org_default',
    name: user.name,
    email: user.email,
    role: user.role,
    avatar_url: user.avatarUrl || user.avatar_url || undefined,
    two_factor_enabled: !!(user.twoFactorEnabled ?? user.two_factor_enabled),
    two_factor_pin: user.twoFactorPin || user.two_factor_pin || undefined,
    active: user.active !== undefined ? user.active : true,
    last_active_at: user.lastActiveAt || user.last_active_at || new Date().toISOString(),
    created_at: user.createdAt || user.created_at || new Date().toISOString(),
  };
}

function calculateSmartPitch(hasWebsite: boolean): string {
  return hasWebsite ? 'AI Receptionist Only' : 'Website + AI Receptionist';
}

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

function inferIndustryFromName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('dental') || lower.includes('smile') || lower.includes('teeth') || lower.includes('dentist')) return 'Dental Clinic';
  if (lower.includes('barber') || lower.includes('salon') || lower.includes('hair') || lower.includes('cut')) return 'Barber Shop / Salon';
  if (lower.includes('restaurant') || lower.includes('grill') || lower.includes('bistro') || lower.includes('cafe') || lower.includes('pizza') || lower.includes('taco')) return 'Restaurant / Dining';
  if (lower.includes('auto') || lower.includes('repair') || lower.includes('tire') || lower.includes('mechanic')) return 'Auto Repair';
  if (lower.includes('plumb') || lower.includes('hvac') || lower.includes('air') || lower.includes('heating')) return 'Plumbing & HVAC';
  return 'General Business';
}

export function createApp() {
  const app = express();

  app.use(express.json({ limit: '10mb' }));

  // Normalize route URLs for Vercel serverless rewrites
  app.use((req, res, next) => {
    if (!req.url.startsWith('/api') && req.url !== '/' && !req.url.startsWith('/index.html')) {
      req.url = '/api' + req.url;
    }
    next();
  });

  // Session Token / Auth Middleware
  app.use(async (req, res, next) => {
    try {
      let user: any = null;
      const authHeader = req.headers['authorization'];
      const sessionToken =
        (req.headers['x-session-token'] as string) ||
        (authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : undefined);

      if (sessionToken) {
        user = await getSessionUser(sessionToken);
      }

      if (!user) {
        const userId = (req.headers['x-user-id'] as string) || (req.query.userId as string);
        if (userId) {
          const u = await db.select().from(schema.users).where(eq(schema.users.id, userId));
          if (u.length > 0) user = u[0];
        }
      }

      if (user) {
        (req as any).currentUser = user;
      }
    } catch (e) {
      console.error('Auth middleware error:', e);
    }
    next();
  });

  const requireUser = (req: Request, res: Response) => {
    const user = (req as any).currentUser;
    if (!user) {
      res.status(401).json({ error: 'Authentication required. Missing or invalid user identity.' });
      return null;
    }
    return user;
  };

  // Database Diagnostic & Auto-repair Endpoint
  app.get('/api/db-diagnostic', async (req, res) => {
    try {
      // Step 1: Ensure tables exist
      await ensureTablesExist();

      // Step 2: Query DB info
      const timeRes = await pool.query('SELECT NOW() as current_time, current_database(), current_user');

      // Step 3: Get all table names in public schema
      const tablesRes = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `);

      // Step 4: Count rows in users table if it exists
      let userCount = 0;
      try {
        const uCountRes = await pool.query('SELECT COUNT(*) FROM users');
        userCount = parseInt(uCountRes.rows[0].count, 10);
      } catch (e) {}

      res.json({
        status: 'DATABASE_CONNECTED',
        db_info: timeRes.rows[0],
        tables: tablesRes.rows.map((r: any) => r.table_name),
        user_count: userCount,
        env_check: {
          DATABASE_URL_EXISTS: !!process.env.DATABASE_URL,
          SQL_HOST_EXISTS: !!process.env.SQL_HOST,
          SQL_USER_EXISTS: !!process.env.SQL_USER,
          SQL_DB_NAME: process.env.SQL_DB_NAME,
        },
      });
    } catch (err: any) {
      console.error('Diagnostic error:', err);
      res.status(500).json({
        status: 'DATABASE_ERROR',
        message: err.message,
        code: err.code,
        detail: err.detail,
        hint: err.hint,
        cause: err.cause ? String(err.cause) : undefined,
      });
    }
  });

  // Export full database as JSON
  app.get('/api/admin/export-database', async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;
      if (user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin permissions required.' });
      }

      const usersList = await db.select().from(schema.users);
      const industriesList = await db.select().from(schema.industries);
      const batchesList = await db.select().from(schema.importedBatches);
      const businessesList = await db.select().from(schema.businesses);
      const leadsList = await db.select().from(schema.leads);
      const callLogsList = await db.select().from(schema.callLogs);
      const followUpsList = await db.select().from(schema.followUps);
      const auditLogsList = await db.select().from(schema.auditLogs).orderBy(desc(schema.auditLogs.timestamp)).limit(2000);
      const settingsList = await db.select().from(schema.settings);

      const exportPayload = {
        exported_at: new Date().toISOString(),
        users: usersList,
        industries: industriesList,
        imported_batches: batchesList,
        businesses: businessesList,
        leads: leadsList,
        call_logs: callLogsList,
        follow_ups: followUpsList,
        audit_logs: auditLogsList,
        settings: settingsList,
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="production_crm_backup.json"');
      res.json(exportPayload);
    } catch (err: any) {
      console.error('Database export error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // --- Auth Endpoints ---

  app.get('/api/auth/me', (req, res) => {
    const user = (req as any).currentUser;
    if (!user) {
      return res.status(401).json({ error: 'Not logged in' });
    }
    res.json(toSafeUser(user));
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password, userId, pin } = req.body;

      let user: any = null;

      if (email && password) {
        const users = await db.select().from(schema.users).where(
          sql`LOWER(TRIM(${schema.users.email})) = ${String(email).toLowerCase().trim()}`
        );
        user = users[0];

        if (!user) {
          return res.status(401).json({ error: 'Invalid email address or user account does not exist.' });
        }

        const isValid = verifyPassword(String(password).trim(), user.password);
        if (!isValid) {
          return res.status(401).json({ error: 'Incorrect password. Please try again.' });
        }

        if (user.password && !isBcryptHash(user.password)) {
          const newHash = hashPassword(String(password).trim());
          await db.update(schema.users).set({ password: newHash }).where(eq(schema.users.id, user.id));
        }
      } else if (userId) {
        const users = await db.select().from(schema.users).where(eq(schema.users.id, userId));
        user = users[0];
        if (!user) {
          return res.status(404).json({ error: 'User account not found.' });
        }
      } else {
        return res.status(400).json({ error: 'Email and password are required to log in.' });
      }

      if (!user.active) {
        return res.status(403).json({ error: 'Account is deactivated. Contact system administrator.' });
      }

      if (user.twoFactorEnabled) {
        if (!pin) {
          return res.json({ require_2fa: true, userId: user.id, email: user.email });
        }
        if (pin !== user.twoFactorPin) {
          return res.status(401).json({ error: 'Invalid 2FA PIN. Please try again.' });
        }
      }

      const now = new Date().toISOString();
      await db.update(schema.users).set({ lastActiveAt: now }).where(eq(schema.users.id, user.id));

      const token = crypto.randomBytes(32).toString('hex');
      await saveSession(token, user);

      await db.insert(schema.auditLogs).values({
        id: `aud_${Date.now()}`,
        orgId: user.orgId || 'org_default',
        userId: user.id,
        userName: user.name,
        action: 'USER_LOGIN',
        targetType: 'user',
        targetId: user.id,
        details: `User ${user.name} logged into system.`,
        timestamp: now,
      });

      res.json({ token, user: toSafeUser(user) });
    } catch (err: any) {
      console.error('Login error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/auth/logout', async (req, res) => {
    try {
      const authHeader = req.headers['authorization'];
      const sessionToken =
        (req.headers['x-session-token'] as string) ||
        (authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : undefined);

      if (sessionToken) {
        await deleteSession(sessionToken);
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Users & Team Management ---

  app.get('/api/users', async (req, res) => {
    try {
      const usersList = await db.select().from(schema.users);
      res.json(usersList.map(toSafeUser));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/users', async (req, res) => {
    try {
      const currentUser = requireUser(req, res);
      if (!currentUser) return;
      if (currentUser.role !== 'admin') {
        return res.status(403).json({ error: 'Admin permissions required.' });
      }

      const { name, email, role, password, two_factor_enabled, two_factor_pin } = req.body;
      if (!name || !email || !role) {
        return res.status(400).json({ error: 'Missing required user fields.' });
      }

      const existing = await db.select().from(schema.users).where(eq(schema.users.email, String(email).trim().toLowerCase()));
      if (existing.length > 0) {
        return res.status(400).json({ error: 'A user with this email address already exists.' });
      }

      const userId = `usr_${Date.now()}`;
      const plainPass = password && password.trim() ? password.trim() : 'Caller@123';
      const hashedPassword = hashPassword(plainPass);
      const orgId = currentUser.orgId || currentUser.org_id || 'org_default';

      const newUserValues = {
        id: userId,
        orgId,
        name: String(name).trim(),
        email: String(email).trim().toLowerCase(),
        role: role as UserRole,
        password: hashedPassword,
        twoFactorEnabled: !!two_factor_enabled,
        twoFactorPin: two_factor_pin || null,
        active: true,
        lastActiveAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      await db.insert(schema.users).values(newUserValues);

      await db.insert(schema.auditLogs).values({
        id: `aud_${Date.now()}`,
        orgId,
        userId: currentUser.id,
        userName: currentUser.name,
        action: 'USER_CREATED',
        targetType: 'user',
        targetId: userId,
        details: `Created new user ${newUserValues.name} (${newUserValues.email}) with role ${newUserValues.role}.`,
        timestamp: new Date().toISOString(),
      });

      res.status(201).json(toSafeUser(newUserValues));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/users/:id', async (req, res) => {
    try {
      const currentUser = requireUser(req, res);
      if (!currentUser) return;
      if (currentUser.role !== 'admin') {
        return res.status(403).json({ error: 'Admin permissions required.' });
      }

      const { id } = req.params;
      const { name, email, role, password, active, two_factor_enabled, two_factor_pin } = req.body;

      const existingUsers = await db.select().from(schema.users).where(eq(schema.users.id, id));
      if (existingUsers.length === 0) {
        return res.status(404).json({ error: 'User not found.' });
      }

      const updates: any = {};
      if (name !== undefined) updates.name = String(name).trim();
      if (email !== undefined) updates.email = String(email).trim().toLowerCase();
      if (role !== undefined) updates.role = role;
      if (active !== undefined) updates.active = !!active;
      if (two_factor_enabled !== undefined) updates.twoFactorEnabled = !!two_factor_enabled;
      if (two_factor_pin !== undefined) updates.twoFactorPin = two_factor_pin;
      if (password && password.trim()) updates.password = hashPassword(password.trim());

      await db.update(schema.users).set(updates).where(eq(schema.users.id, id));

      await db.insert(schema.auditLogs).values({
        id: `aud_${Date.now()}`,
        orgId: currentUser.orgId || 'org_default',
        userId: currentUser.id,
        userName: currentUser.name,
        action: 'USER_UPDATED',
        targetType: 'user',
        targetId: id,
        details: `Updated user details for ${updates.name || existingUsers[0].name}.`,
        timestamp: new Date().toISOString(),
      });

      const updated = await db.select().from(schema.users).where(eq(schema.users.id, id));
      res.json(toSafeUser(updated[0]));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Lead Batches & Visibility ---

  app.get('/api/leads/batches', async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;

      const orgId = user.orgId || user.org_id || 'org_default';
      const batches = await db.select().from(schema.importedBatches).where(eq(schema.importedBatches.orgId, orgId));

      const result: any[] = [];
      for (const b of batches) {
        const leadStats = await pool.query(
          `SELECT 
             COUNT(*) as total,
             COUNT(*) FILTER (WHERE status = 'unassigned') as unassigned,
             COUNT(*) FILTER (WHERE status = 'completed') as completed
           FROM leads l
           JOIN businesses biz ON l.business_id = biz.id
           WHERE biz.batch_id = $1`,
          [b.id]
        );

        const sampleBiz = await db.select().from(schema.businesses).where(eq(schema.businesses.batchId, b.id)).limit(5);

        let allowedCallerIds: string[] | null = null;
        if (b.allowedCallerIds) {
          try {
            allowedCallerIds = typeof b.allowedCallerIds === 'string' ? JSON.parse(b.allowedCallerIds) : b.allowedCallerIds;
          } catch {
            allowedCallerIds = null;
          }
        }

        result.push({
          id: b.id,
          org_id: b.orgId,
          file_name: b.fileName,
          total_leads: b.totalLeads,
          allowed_caller_ids: allowedCallerIds,
          imported_by_id: b.importedById,
          imported_by_name: b.importedByName,
          created_at: b.createdAt,
          unassigned_count: parseInt(leadStats.rows[0]?.unassigned || '0', 10),
          completed_count: parseInt(leadStats.rows[0]?.completed || '0', 10),
          sample_businesses: sampleBiz,
        });
      }

      result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Dashboard Analytics ---

  app.get('/api/dashboard/admin', async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;

      const orgId = user.orgId || user.org_id || 'org_default';

      // 1. Lead counts
      const countsRes = await pool.query(
        `SELECT 
           COUNT(*) as total,
           COUNT(*) FILTER (WHERE status = 'completed') as completed,
           COUNT(*) FILTER (WHERE status IN ('unassigned', 'reserved')) as remaining
         FROM leads WHERE org_id = $1`,
        [orgId]
      );

      const totalLeads = parseInt(countsRes.rows[0]?.total || '0', 10);
      const completedLeads = parseInt(countsRes.rows[0]?.completed || '0', 10);
      const remainingLeads = parseInt(countsRes.rows[0]?.remaining || '0', 10);

      // 2. Call stats
      const callStatsRes = await pool.query(
        `SELECT 
           COUNT(*) as total_calls,
           COUNT(*) FILTER (WHERE who_answered = 'Decision Maker') as dm_answers,
           COUNT(*) FILTER (WHERE call_outcome = 'Interested (appointment set)') as appointments,
           COUNT(*) FILTER (WHERE call_outcome IN ('Interested (appointment set)', 'Information Sent', 'Follow Up Required', 'Call Back Later')) as positive_responses
         FROM call_logs WHERE org_id = $1`,
        [orgId]
      );

      const totalCalls = parseInt(callStatsRes.rows[0]?.total_calls || '0', 10);
      const appointments = parseInt(callStatsRes.rows[0]?.appointments || '0', 10);
      const positiveResponses = parseInt(callStatsRes.rows[0]?.positive_responses || '0', 10);
      const conversionRate = totalCalls > 0 ? Math.round((positiveResponses / totalCalls) * 100) : 0;

      // 3. Top performers
      const topPerformersRes = await pool.query(
        `SELECT 
           caller_id, 
           caller_name, 
           COUNT(*) as calls_count,
           COUNT(*) FILTER (WHERE call_outcome = 'Interested (appointment set)') as appointments,
           COUNT(*) FILTER (WHERE call_outcome IN ('Interested (appointment set)', 'Information Sent', 'Follow Up Required', 'Call Back Later')) as interested
         FROM call_logs 
         WHERE org_id = $1 
         GROUP BY caller_id, caller_name 
         ORDER BY calls_count DESC 
         LIMIT 5`,
        [orgId]
      );

      // 4. Active callers
      const callersList = await db.select().from(schema.users).where(and(eq(schema.users.role, 'caller'), eq(schema.users.active, true)));
      const activeCallers = callersList.map((c) => {
        const lastActive = c.lastActiveAt ? new Date(c.lastActiveAt).getTime() : 0;
        const diffMinutes = lastActive > 0 ? Math.round((Date.now() - lastActive) / 60000) : 9999;
        return {
          id: c.id,
          name: c.name,
          status: diffMinutes < 15 ? 'Active' : 'Offline',
          last_active_at: c.lastActiveAt,
          calls_today: 0,
          idle_minutes: diffMinutes,
          is_idle_alert: diffMinutes > 20,
        };
      });

      // 5. Call Volume Series (Past 7 Days)
      const callVolumeRes = await pool.query(
        `SELECT 
           DATE(created_at) as date,
           COUNT(*) as total_calls,
           COUNT(*) FILTER (WHERE call_outcome IN ('Interested (appointment set)', 'Information Sent', 'Follow Up Required', 'Call Back Later')) as interested,
           COUNT(*) FILTER (WHERE call_outcome = 'Interested (appointment set)') as appointments
         FROM call_logs
         WHERE org_id = $1 AND created_at >= NOW() - INTERVAL '7 days'
         GROUP BY DATE(created_at)
         ORDER BY date ASC`,
        [orgId]
      );

      res.json({
        total_leads: totalLeads,
        completed_leads: completedLeads,
        remaining_leads: remainingLeads,
        conversion_rate: conversionRate,
        appointments_set: appointments,
        active_callers_count: activeCallers.filter((c) => c.status === 'Active').length,
        top_performers: topPerformersRes.rows.map((r: any) => ({
          caller_id: r.caller_id,
          caller_name: r.caller_name,
          calls_count: parseInt(r.calls_count, 10),
          appointments: parseInt(r.appointments, 10),
          interested: parseInt(r.interested, 10),
        })),
        active_callers: activeCallers,
        call_volume_series: callVolumeRes.rows.map((r: any) => ({
          date: r.date.toISOString().split('T')[0],
          total_calls: parseInt(r.total_calls, 10),
          interested: parseInt(r.interested, 10),
          appointments: parseInt(r.appointments, 10),
        })),
      });
    } catch (err: any) {
      console.error('Admin dashboard error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // --- Notifications / Callbacks ---

  app.get('/api/notifications/callbacks', async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;

      const orgId = user.orgId || user.org_id || 'org_default';
      const followUps = await pool.query(
        `SELECT 
           fu.id,
           fu.lead_id,
           fu.business_id,
           biz.name as business_name,
           biz.phone as business_phone,
           biz.industry,
           biz.address,
           biz.contact_person,
           biz.email as contact_email,
           fu.caller_id,
           u.name as caller_name,
           fu.scheduled_at,
           fu.method,
           fu.notes,
           fu.status,
           fu.created_at,
           cl.call_outcome
         FROM follow_ups fu
         LEFT JOIN businesses biz ON fu.business_id = biz.id
         LEFT JOIN users u ON fu.caller_id = u.id
         LEFT JOIN call_logs cl ON fu.call_log_id = cl.id
         WHERE fu.org_id = $1
         ORDER BY fu.scheduled_at ASC`,
        [orgId]
      );

      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];

      const callbacks = followUps.rows.map((r: any) => {
        const sched = new Date(r.scheduled_at);
        const schedStr = !isNaN(sched.getTime()) ? sched.toISOString().split('T')[0] : '';
        const isOverdue = sched < now;
        const isToday = schedStr === todayStr;

        return {
          id: r.id,
          lead_id: r.lead_id,
          business_id: r.business_id,
          business_name: r.business_name || 'Business',
          business_phone: r.business_phone || 'N/A',
          industry: r.industry || 'General Business',
          address: r.address || '',
          contact_person: r.contact_person || '',
          contact_email: r.contact_email || '',
          caller_id: r.caller_id,
          caller_name: r.caller_name || 'Caller',
          scheduled_at: r.scheduled_at,
          scheduled_date: schedStr,
          scheduled_time: !isNaN(sched.getTime()) ? sched.toTimeString().substring(0, 5) : '',
          method: r.method || 'Call',
          notes: r.notes || '',
          call_outcome: r.call_outcome || '',
          smart_pitch: 'AI Receptionist Only',
          status: r.status || 'interested',
          created_at: r.created_at,
          is_due_today: isToday,
          is_overdue: isOverdue,
        };
      });

      res.json({
        today_callbacks: callbacks.filter((c: any) => c.is_due_today),
        overdue_callbacks: callbacks.filter((c: any) => c.is_overdue),
        upcoming_callbacks: callbacks.filter((c: any) => !c.is_due_today && !c.is_overdue),
        selected_date_callbacks: [],
        target_date: todayStr,
        active_count: callbacks.filter((c: any) => c.is_due_today).length,
        total_overdue_count: callbacks.filter((c: any) => c.is_overdue).length,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Next Lead Reservation Engine (Atomic SELECT FOR UPDATE SKIP LOCKED)
  app.post('/api/leads/next', async (req, res) => {
    const client = await pool.connect();
    try {
      const user = requireUser(req, res);
      if (!user) {
        client.release();
        return;
      }

      await cleanExpiredReservations();

      await client.query('BEGIN');

      const callerId = user.id;
      const callerName = user.name;
      const orgId = user.orgId || user.org_id || 'org_default';

      // 1. Check if caller already has an active reserved lead
      const existingRes = await client.query(
        `SELECT l.id, biz.name as biz_name 
         FROM leads l
         JOIN businesses biz ON l.business_id = biz.id
         WHERE l.status = 'reserved' 
           AND l.assigned_caller_id = $1 
           AND l.org_id = $2
         LIMIT 1`,
        [callerId, orgId]
      );

      if (existingRes.rows.length > 0) {
        await client.query('COMMIT');
        client.release();
        return res.json({
          success: true,
          reserved_lead_id: existingRes.rows[0].id,
          business_name: existingRes.rows[0].biz_name,
          assigned_to: callerName,
          already_reserved: true,
        });
      }

      // 2. Select next unassigned lead with SKIP LOCKED
      const nextLeadRes = await client.query(
        `SELECT l.id, biz.name as biz_name 
         FROM leads l
         JOIN businesses biz ON l.business_id = biz.id
         WHERE l.status = 'unassigned' 
           AND l.org_id = $1
           AND (
             l.allowed_caller_ids IS NULL 
             OR l.allowed_caller_ids = '[]'::jsonb
             OR l.allowed_caller_ids @> jsonb_build_array($2::text)
           )
         ORDER BY l.created_at ASC
         LIMIT 1
         FOR UPDATE SKIP LOCKED`,
        [orgId, callerId]
      );

      if (nextLeadRes.rows.length === 0) {
        await client.query('COMMIT');
        client.release();
        return res.status(404).json({ error: 'No available leads in queue matching your permissions.' });
      }

      const lead = nextLeadRes.rows[0];
      const nowIso = new Date().toISOString();

      await client.query(
        `UPDATE leads 
         SET status = 'reserved', 
             assigned_caller_id = $1, 
             assigned_caller_name = $2, 
             reserved_at = $3 
         WHERE id = $4`,
        [callerId, callerName, nowIso, lead.id]
      );

      await client.query('COMMIT');
      client.release();

      res.json({
        success: true,
        reserved_lead_id: lead.id,
        business_name: lead.biz_name,
        assigned_to: callerName,
        reserved_at: nowIso,
      });
    } catch (err: any) {
      await client.query('ROLLBACK');
      client.release();
      res.status(500).json({ error: err.message });
    }
  });

  return app;
}
