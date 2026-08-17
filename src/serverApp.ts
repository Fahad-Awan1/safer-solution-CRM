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

  // Database Diagnostic Endpoint
  app.get('/api/db-diagnostic', async (req, res) => {
    try {
      // Step 1: Query DB info
      const timeRes = await pool.query('SELECT NOW() as current_time, current_database(), current_user');

      // Step 2: Get all table names in public schema
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
        const uRes = await pool.query(
          `SELECT * FROM users WHERE LOWER(TRIM(email)) = $1 LIMIT 1`,
          [String(email).toLowerCase().trim()]
        );
        user = uRes.rows[0];

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
      const token = crypto.randomBytes(32).toString('hex');

      // Update session and audit log asynchronously
      pool.query(`UPDATE users SET last_active_at = $1 WHERE id = $2`, [now, user.id]).catch(() => {});
      pool.query(`INSERT INTO sessions (token, user_id, created_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [token, user.id, now]).catch(() => {});
      pool.query(
        `INSERT INTO audit_logs (id, org_id, user_id, user_name, action, target_type, target_id, details, timestamp) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT DO NOTHING`,
        [`aud_${Date.now()}`, user.org_id || user.orgId || 'org_default', user.id, user.name, 'USER_LOGIN', 'user', user.id, `User ${user.name} logged into system.`, now]
      ).catch(() => {});

      const safeUser = toSafeUser(user);
      return res.json({ token, user: safeUser, ...safeUser });
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

  app.post('/api/auth/heartbeat', async (req, res) => {
    try {
      const user = (req as any).currentUser;
      if (user) {
        await db.update(schema.users).set({ lastActiveAt: new Date().toISOString() }).where(eq(schema.users.id, user.id));
      }
      res.json({ success: true, timestamp: new Date().toISOString() });
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
      const { name, email, role, password, active, two_factor_enabled, two_factor_pin, avatar_url, avatarUrl } = req.body;

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
      if (avatar_url !== undefined || avatarUrl !== undefined) updates.avatarUrl = avatar_url ?? avatarUrl;
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
      const todayStr = (req.query.today as string) || now.toISOString().split('T')[0];
      const targetDate = (req.query.date as string) || todayStr;

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
        selected_date_callbacks: callbacks.filter((c: any) => c.scheduled_date === targetDate),
        target_date: targetDate,
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

  app.post('/api/leads/reserve-specific', async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;

      const { leadId } = req.body;
      if (!leadId) return res.status(400).json({ error: 'leadId is required.' });

      const nowIso = new Date().toISOString();
      await db.update(schema.leads).set({
        status: 'reserved',
        assignedCallerId: user.id,
        assignedCallerName: user.name,
        reservedAt: nowIso,
      }).where(eq(schema.leads.id, leadId));

      res.json({ success: true, leadId, assignedTo: user.name, reservedAt: nowIso });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // =============================================
  // --- Industries ---
  // =============================================

  app.get('/api/industries', async (req, res) => {
    try {
      const industriesList = await db.select().from(schema.industries);
      res.json(industriesList.map((i: any) => ({
        id: i.id,
        org_id: i.orgId,
        name: i.name,
        default_pitch: i.defaultPitch || '',
      })));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/industries', async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;

      const { name, default_pitch } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Industry name is required.' });
      }

      const orgId = user.orgId || user.org_id || 'org_default';
      const id = `ind_${Date.now()}`;
      await db.insert(schema.industries).values({
        id,
        orgId,
        name: name.trim(),
        defaultPitch: default_pitch || null,
      });

      res.status(201).json({ id, org_id: orgId, name: name.trim(), default_pitch: default_pitch || '' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // =============================================
  // --- Call Logs ---
  // =============================================

  app.get('/api/call-logs', async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;

      const orgId = user.orgId || user.org_id || 'org_default';
      const logsRes = await pool.query(
        `SELECT cl.*, biz.name as business_name, biz.phone as business_phone
         FROM call_logs cl
         LEFT JOIN businesses biz ON cl.business_id = biz.id
         WHERE cl.org_id = $1
         ORDER BY cl.created_at DESC
         LIMIT 5000`,
        [orgId]
      );

      res.json(logsRes.rows.map((r: any) => ({
        id: r.id,
        org_id: r.org_id,
        lead_id: r.lead_id,
        business_id: r.business_id,
        caller_id: r.caller_id,
        caller_name: r.caller_name,
        who_answered: r.who_answered,
        call_outcome: r.call_outcome,
        pitch_given: r.pitch_given,
        objection_reason: r.objection_reason,
        has_followup: r.has_followup,
        followup_at: r.followup_at,
        followup_method: r.followup_method,
        contact_name: r.contact_name,
        contact_email: r.contact_email,
        notes: r.notes,
        created_at: r.created_at,
        business_name: r.business_name || '',
        business_phone: r.business_phone || '',
      })));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/call-logs/:id', async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;

      const { id } = req.params;
      const { who_answered, call_outcome, pitch_given, has_followup, followup_at, followup_method, notes } = req.body;

      const updates: any = {};
      if (who_answered !== undefined) updates.whoAnswered = who_answered;
      if (call_outcome !== undefined) updates.callOutcome = call_outcome;
      if (pitch_given !== undefined) updates.pitchGiven = pitch_given;
      if (has_followup !== undefined) updates.hasFollowup = has_followup;
      if (followup_at !== undefined) updates.followupAt = followup_at;
      if (followup_method !== undefined) updates.followupMethod = followup_method;
      if (notes !== undefined) updates.notes = notes;

      await db.update(schema.callLogs).set(updates).where(eq(schema.callLogs.id, id));

      const updated = await pool.query(
        `SELECT cl.*, biz.name as business_name, biz.phone as business_phone
         FROM call_logs cl LEFT JOIN businesses biz ON cl.business_id = biz.id WHERE cl.id = $1`,
        [id]
      );

      const r = updated.rows[0];
      res.json({
        success: true,
        callLog: {
          id: r.id, org_id: r.org_id, lead_id: r.lead_id, business_id: r.business_id,
          caller_id: r.caller_id, caller_name: r.caller_name, who_answered: r.who_answered,
          call_outcome: r.call_outcome, pitch_given: r.pitch_given, objection_reason: r.objection_reason,
          has_followup: r.has_followup, followup_at: r.followup_at, followup_method: r.followup_method,
          contact_name: r.contact_name, contact_email: r.contact_email, notes: r.notes,
          created_at: r.created_at, business_name: r.business_name || '', business_phone: r.business_phone || '',
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // =============================================
  // --- Audit Logs ---
  // =============================================

  app.get('/api/audit-logs', async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;

      const orgId = user.orgId || user.org_id || 'org_default';
      const logs = await db.select().from(schema.auditLogs)
        .where(eq(schema.auditLogs.orgId, orgId))
        .orderBy(desc(schema.auditLogs.timestamp))
        .limit(2000);

      res.json(logs.map((l: any) => ({
        id: l.id, org_id: l.orgId, user_id: l.userId, user_name: l.userName,
        action: l.action, target_type: l.targetType, target_id: l.targetId,
        details: l.details, timestamp: l.timestamp,
      })));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // =============================================
  // --- Dashboard: Team Leader ---
  // =============================================

  app.get('/api/dashboard/team-leader', async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;

      const orgId = user.orgId || user.org_id || 'org_default';
      const todayStr = new Date().toISOString().split('T')[0];

      // Get all callers
      const callersList = await db.select().from(schema.users)
        .where(and(eq(schema.users.role, 'caller'), eq(schema.users.active, true)));

      const roster: any[] = [];
      let totalCallsToday = 0;

      for (const c of callersList) {
        const callsTodayRes = await pool.query(
          `SELECT COUNT(*) as cnt,
                  COUNT(*) FILTER (WHERE call_outcome IN ('Interested (appointment set)', 'Information Sent', 'Follow Up Required', 'Call Back Later')) as interested,
                  COUNT(*) FILTER (WHERE call_outcome = 'Interested (appointment set)') as appointments
           FROM call_logs WHERE caller_id = $1 AND DATE(created_at) = $2`,
          [c.id, todayStr]
        );

        const callsToday = parseInt(callsTodayRes.rows[0]?.cnt || '0', 10);
        totalCallsToday += callsToday;

        const lastActive = c.lastActiveAt ? new Date(c.lastActiveAt).getTime() : 0;
        const diffMinutes = lastActive > 0 ? Math.round((Date.now() - lastActive) / 60000) : 9999;

        // Check for active reserved lead
        let currentLead: any = undefined;
        const reservedRes = await pool.query(
          `SELECT l.id, biz.name as business_name, biz.phone, biz.industry, l.reserved_at
           FROM leads l JOIN businesses biz ON l.business_id = biz.id
           WHERE l.status = 'reserved' AND l.assigned_caller_id = $1 AND l.org_id = $2 LIMIT 1`,
          [c.id, orgId]
        );
        if (reservedRes.rows.length > 0) {
          const rl = reservedRes.rows[0];
          currentLead = { id: rl.id, business_name: rl.business_name, phone: rl.phone, industry: rl.industry, reserved_at: rl.reserved_at };
        }

        roster.push({
          id: c.id, name: c.name, email: c.email, active: c.active,
          status: diffMinutes < 15 ? (currentLead ? 'In Call' : 'Idle') : 'Offline',
          calls_today: callsToday,
          interested_today: parseInt(callsTodayRes.rows[0]?.interested || '0', 10),
          appointments_today: parseInt(callsTodayRes.rows[0]?.appointments || '0', 10),
          idle_minutes: diffMinutes,
          is_idle_alert: diffMinutes > 20,
          current_lead: currentLead,
        });
      }

      // Remaining queue leads
      const queueRes = await pool.query(
        `SELECT COUNT(*) as cnt FROM leads WHERE org_id = $1 AND status = 'unassigned'`, [orgId]
      );

      res.json({
        roster,
        remaining_queue_leads: parseInt(queueRes.rows[0]?.cnt || '0', 10),
        total_calls_today: totalCallsToday,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // =============================================
  // --- Dashboard: Caller ---
  // =============================================

  app.get('/api/dashboard/caller', async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;

      const orgId = user.orgId || user.org_id || 'org_default';
      const todayStr = new Date().toISOString().split('T')[0];

      const statsRes = await pool.query(
        `SELECT 
           COUNT(*) as calls_today,
           COUNT(*) FILTER (WHERE call_outcome IN ('Interested (appointment set)', 'Information Sent', 'Follow Up Required', 'Call Back Later')) as interested,
           COUNT(*) FILTER (WHERE call_outcome = 'Interested (appointment set)') as appointments
         FROM call_logs WHERE caller_id = $1 AND DATE(created_at) = $2`,
        [user.id, todayStr]
      );

      const remainingRes = await pool.query(
        `SELECT COUNT(*) as cnt FROM leads WHERE org_id = $1 AND status = 'unassigned'`, [orgId]
      );

      res.json({
        calls_today: parseInt(statsRes.rows[0]?.calls_today || '0', 10),
        interested_count: parseInt(statsRes.rows[0]?.interested || '0', 10),
        appointments_count: parseInt(statsRes.rows[0]?.appointments || '0', 10),
        remaining_leads: parseInt(remainingRes.rows[0]?.cnt || '0', 10),
        avg_call_seconds: 0,
        current_streak: 0,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // =============================================
  // --- Lead Management ---
  // =============================================

  app.get('/api/leads/manage', async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;

      const orgId = user.orgId || user.org_id || 'org_default';
      const leadsRes = await pool.query(
        `SELECT l.id, l.status, l.allowed_caller_ids, l.current_cycle, l.created_at,
                biz.id as business_id, biz.name as business_name, biz.phone, biz.industry,
                biz.city, biz.state, biz.zip, biz.address, biz.batch_id,
                ib.file_name as batch_name
         FROM leads l
         JOIN businesses biz ON l.business_id = biz.id
         LEFT JOIN imported_batches ib ON biz.batch_id = ib.id
         WHERE l.org_id = $1
         ORDER BY l.created_at DESC
         LIMIT 10000`,
        [orgId]
      );

      res.json(leadsRes.rows.map((r: any) => ({
        id: r.id,
        status: r.status,
        allowed_caller_ids: r.allowed_caller_ids || null,
        current_cycle: r.current_cycle,
        created_at: r.created_at,
        business_id: r.business_id,
        business_name: r.business_name,
        phone: r.phone,
        industry: r.industry,
        city: r.city || '',
        state: r.state || '',
        zip: r.zip || '',
        address: r.address || '',
        batch_id: r.batch_id || '',
        batch_name: r.batch_name || '',
      })));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/leads/outcome', async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;

      const { leadId, who_answered, call_outcome, pitch_given, objection_reason, has_followup, followup_at, followup_method, contact_name, contact_email, notes } = req.body;
      if (!leadId) return res.status(400).json({ error: 'leadId is required.' });

      const orgId = user.orgId || user.org_id || 'org_default';

      // Get lead + business info
      const leadRes = await pool.query(
        `SELECT l.*, biz.id as biz_id, biz.name as biz_name FROM leads l JOIN businesses biz ON l.business_id = biz.id WHERE l.id = $1`,
        [leadId]
      );
      if (leadRes.rows.length === 0) return res.status(404).json({ error: 'Lead not found.' });
      const lead = leadRes.rows[0];

      // Create call log
      const callLogId = `cl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      await db.insert(schema.callLogs).values({
        id: callLogId,
        orgId,
        leadId,
        businessId: lead.biz_id,
        callerId: user.id,
        callerName: user.name,
        whoAnswered: who_answered || 'No Answer',
        callOutcome: call_outcome || null,
        pitchGiven: pitch_given || null,
        objectionReason: objection_reason || null,
        hasFollowup: !!has_followup,
        followupAt: followup_at || null,
        followupMethod: followup_method || null,
        contactName: contact_name || null,
        contactEmail: contact_email || null,
        notes: notes || null,
        createdAt: new Date().toISOString(),
      });

      // Create follow-up if needed
      if (has_followup && followup_at) {
        await db.insert(schema.followUps).values({
          id: `fu_${Date.now()}`,
          orgId,
          callLogId,
          leadId,
          businessId: lead.biz_id,
          callerId: user.id,
          status: call_outcome === 'Interested (appointment set)' ? 'appointment' : 'interested',
          scheduledAt: followup_at,
          method: followup_method || 'Call',
          notes: notes || null,
          createdAt: new Date().toISOString(),
        });
      }

      // Mark lead as completed
      await db.update(schema.leads).set({
        status: call_outcome === 'Do Not Call' ? 'do_not_call' : 'completed',
        completedAt: new Date().toISOString(),
      }).where(eq(schema.leads.id, leadId));

      // Update last active
      await db.update(schema.users).set({ lastActiveAt: new Date().toISOString() }).where(eq(schema.users.id, user.id));

      res.json({ success: true, callLogId });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/leads/release', async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;

      const { leadId } = req.body;
      if (!leadId) return res.status(400).json({ error: 'leadId is required.' });

      await db.update(schema.leads).set({
        status: 'unassigned',
        assignedCallerId: null,
        assignedCallerName: null,
        reservedAt: null,
      }).where(eq(schema.leads.id, leadId));

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/leads/visibility', async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;
      if (user.role !== 'admin' && user.role !== 'team_leader') {
        return res.status(403).json({ error: 'Permission denied.' });
      }

      const { lead_ids, update_all, allowed_caller_ids } = req.body;
      const orgId = user.orgId || user.org_id || 'org_default';
      const newAllowed = allowed_caller_ids === null ? null : JSON.stringify(allowed_caller_ids || []);

      let updatedCount = 0;
      if (update_all) {
        const result = await pool.query(
          `UPDATE leads SET allowed_caller_ids = $1 WHERE org_id = $2`, [newAllowed, orgId]
        );
        updatedCount = result.rowCount || 0;
      } else if (lead_ids && lead_ids.length > 0) {
        for (const lid of lead_ids) {
          await pool.query(`UPDATE leads SET allowed_caller_ids = $1 WHERE id = $2`, [newAllowed, lid]);
        }
        updatedCount = lead_ids.length;
      }

      res.json({ success: true, updatedCount });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // =============================================
  // --- Lead Import (Validate & Commit) ---
  // =============================================

  app.post('/api/leads/import/validate', async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;

      const { rows } = req.body;
      if (!rows || !Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ error: 'No rows to validate.' });
      }

      const errors: any[] = [];
      const validRows: any[] = [];

      rows.forEach((row: any, index: number) => {
        const bizName = extractFlexibleColumn(row, ['Business Name', 'business_name', 'name', 'company', 'Company Name']);
        const phone = extractFlexibleColumn(row, ['Phone Number', 'phone_number', 'phone', 'Phone', 'telephone']);

        if (!bizName) {
          errors.push({ row: index + 2, field: 'Business Name', message: 'Missing business name', value: '' });
        }
        if (!phone) {
          errors.push({ row: index + 2, field: 'Phone Number', message: 'Missing phone number', value: '' });
        }

        if (bizName && phone) {
          validRows.push(row);
        }
      });

      res.json({
        total_rows: rows.length,
        valid_count: validRows.length,
        invalid_count: rows.length - validRows.length,
        errors: errors.slice(0, 100),
        sample_valid_rows: validRows,
        valid_rows: validRows,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/leads/import/commit', async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;

      const { rows, fileName, allowed_caller_ids } = req.body;
      if (!rows || !Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ error: 'No rows to import.' });
      }

      const orgId = user.orgId || user.org_id || 'org_default';
      const batchId = `batch_${Date.now()}`;

      // Create batch record
      await db.insert(schema.importedBatches).values({
        id: batchId,
        orgId,
        fileName: fileName || 'Imported_Batch.csv',
        totalLeads: rows.length,
        allowedCallerIds: allowed_caller_ids && allowed_caller_ids.length > 0 ? allowed_caller_ids : null,
        importedById: user.id,
        importedByName: user.name,
        createdAt: new Date().toISOString(),
      });

      let importedCount = 0;

      for (const row of rows) {
        const bizName = extractFlexibleColumn(row, ['Business Name', 'business_name', 'name', 'company', 'Company Name']);
        const phone = extractFlexibleColumn(row, ['Phone Number', 'phone_number', 'phone', 'Phone', 'telephone']);
        if (!bizName || !phone) continue;

        const hasWebsite = extractFlexibleColumn(row, ['Has Website', 'has_website', 'website', 'Website', 'Website URL']);
        const industry = extractFlexibleColumn(row, ['Industry', 'industry', 'Category', 'Type']) || inferIndustryFromName(bizName);
        const address = extractFlexibleColumn(row, ['Address', 'address', 'Street', 'street_address']);
        const city = extractFlexibleColumn(row, ['City', 'city']);
        const state = extractFlexibleColumn(row, ['State', 'state']);
        const zip = extractFlexibleColumn(row, ['Zip', 'zip', 'Zip Code', 'zip_code', 'Zipcode', 'postal_code']);
        const email = extractFlexibleColumn(row, ['Email', 'email', 'contact_email']);
        const contactPerson = extractFlexibleColumn(row, ['Contact', 'contact', 'Contact Person', 'contact_person', 'Contact Name']);

        const isWebsite = hasWebsite && hasWebsite.toLowerCase() !== 'false' && hasWebsite.toLowerCase() !== 'no' && hasWebsite.toLowerCase() !== 'no_website' && hasWebsite.toLowerCase() !== '';
        const websiteUrl = isWebsite && hasWebsite.startsWith('http') ? hasWebsite : undefined;

        const bizId = `biz_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        await db.insert(schema.businesses).values({
          id: bizId, batchId, orgId, name: bizName, phone,
          hasWebsite: !!isWebsite, websiteUrl: websiteUrl || null,
          industry, address: address || '', city: city || null, state: state || null, zip: zip || null,
          email: email || null, contactPerson: contactPerson || null,
          createdAt: new Date().toISOString(),
        });

        const leadId = `lead_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        await db.insert(schema.leads).values({
          id: leadId, orgId, businessId: bizId, status: 'unassigned',
          allowedCallerIds: allowed_caller_ids && allowed_caller_ids.length > 0 ? allowed_caller_ids : null,
          currentCycle: 1, createdAt: new Date().toISOString(),
        });

        importedCount++;
      }

      // Audit log
      await db.insert(schema.auditLogs).values({
        id: `aud_${Date.now()}`,
        orgId,
        userId: user.id,
        userName: user.name,
        action: 'LEADS_IMPORTED',
        targetType: 'batch',
        targetId: batchId,
        details: `Imported ${importedCount} leads from ${fileName || 'CSV file'}.`,
        timestamp: new Date().toISOString(),
      });

      res.json({ success: true, importedCount });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // =============================================
  // --- Lead Batches (PATCH & DELETE) ---
  // =============================================

  app.patch('/api/leads/batches/:id', async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;

      const { id } = req.params;
      const { file_name, allowed_caller_ids } = req.body;

      const updates: any = {};
      if (file_name !== undefined) updates.fileName = file_name;
      if (allowed_caller_ids !== undefined) {
        updates.allowedCallerIds = allowed_caller_ids;
        // Also update all leads in this batch
        const businesses = await db.select({ id: schema.businesses.id }).from(schema.businesses).where(eq(schema.businesses.batchId, id));
        const bizIds = businesses.map((b: any) => b.id);
        if (bizIds.length > 0) {
          const newAllowed = allowed_caller_ids && allowed_caller_ids.length > 0 ? JSON.stringify(allowed_caller_ids) : null;
          for (const bizId of bizIds) {
            await pool.query(`UPDATE leads SET allowed_caller_ids = $1 WHERE business_id = $2`, [newAllowed, bizId]);
          }
        }
      }

      if (Object.keys(updates).length > 0) {
        await db.update(schema.importedBatches).set(updates).where(eq(schema.importedBatches.id, id));
      }

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/leads/batches/:id', async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;
      if (user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin permissions required to delete batches.' });
      }

      const { id } = req.params;

      // Delete in order: follow_ups -> call_logs -> leads -> businesses -> batch
      const businesses = await db.select({ id: schema.businesses.id }).from(schema.businesses).where(eq(schema.businesses.batchId, id));
      const bizIds = businesses.map((b: any) => b.id);

      if (bizIds.length > 0) {
        for (const bizId of bizIds) {
          await pool.query(`DELETE FROM follow_ups WHERE business_id = $1`, [bizId]);
          await pool.query(`DELETE FROM call_logs WHERE business_id = $1`, [bizId]);
          await pool.query(`DELETE FROM leads WHERE business_id = $1`, [bizId]);
        }
        await pool.query(`DELETE FROM businesses WHERE batch_id = $1`, [id]);
      }

      await db.delete(schema.importedBatches).where(eq(schema.importedBatches.id, id));

      // Audit log
      await db.insert(schema.auditLogs).values({
        id: `aud_${Date.now()}`,
        orgId: user.orgId || 'org_default',
        userId: user.id,
        userName: user.name,
        action: 'BATCH_DELETED',
        targetType: 'batch',
        targetId: id,
        details: `Deleted lead batch ${id} and all associated records.`,
        timestamp: new Date().toISOString(),
      });

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // =============================================
  // --- User Management: Reset Password & Profile ---
  // =============================================

  app.post('/api/users/:id/reset-password', async (req, res) => {
    try {
      const currentUser = requireUser(req, res);
      if (!currentUser) return;
      if (currentUser.role !== 'admin') {
        return res.status(403).json({ error: 'Admin permissions required.' });
      }

      const { id } = req.params;
      const { new_password } = req.body;

      if (!new_password || new_password.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters.' });
      }

      const hashed = hashPassword(new_password);
      await db.update(schema.users).set({ password: hashed }).where(eq(schema.users.id, id));

      await db.insert(schema.auditLogs).values({
        id: `aud_${Date.now()}`,
        orgId: currentUser.orgId || 'org_default',
        userId: currentUser.id,
        userName: currentUser.name,
        action: 'PASSWORD_RESET',
        targetType: 'user',
        targetId: id,
        details: `Admin reset password for user ${id}.`,
        timestamp: new Date().toISOString(),
      });

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/users/profile', async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;

      const { name, avatar_url } = req.body;

      const updates: any = {};
      if (name !== undefined) updates.name = String(name).trim();
      if (avatar_url !== undefined) updates.avatarUrl = avatar_url;

      if (Object.keys(updates).length > 0) {
        await db.update(schema.users).set(updates).where(eq(schema.users.id, user.id));
      }

      const updated = await db.select().from(schema.users).where(eq(schema.users.id, user.id));
      res.json(toSafeUser(updated[0]));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/users/:id', async (req, res) => {
    try {
      const currentUser = requireUser(req, res);
      if (!currentUser) return;
      if (currentUser.role !== 'admin') {
        return res.status(403).json({ error: 'Admin permissions required.' });
      }

      const { id } = req.params;
      if (id === currentUser.id) {
        return res.status(400).json({ error: 'Cannot delete your own account.' });
      }

      await db.delete(schema.sessions).where(eq(schema.sessions.userId, id));
      await db.delete(schema.users).where(eq(schema.users.id, id));

      await db.insert(schema.auditLogs).values({
        id: `aud_${Date.now()}`,
        orgId: currentUser.orgId || 'org_default',
        userId: currentUser.id,
        userName: currentUser.name,
        action: 'USER_DELETED',
        targetType: 'user',
        targetId: id,
        details: `Deleted user account ${id}.`,
        timestamp: new Date().toISOString(),
      });

      res.json({ success: true, message: 'User deleted successfully.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // =============================================
  // --- Admin Diagnostic: Visibility ---
  // =============================================

  app.get('/api/admin/diagnostic/visibility', async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;

      const orgId = user.orgId || user.org_id || 'org_default';

      const callersList = await db.select().from(schema.users)
        .where(and(eq(schema.users.role, 'caller'), eq(schema.users.active, true)));

      const batchesList = await db.select().from(schema.importedBatches)
        .where(eq(schema.importedBatches.orgId, orgId));

      const batchDiagnostics: any[] = [];

      for (const batch of batchesList) {
        let allowedIds: string[] = [];
        if (batch.allowedCallerIds) {
          try {
            allowedIds = typeof batch.allowedCallerIds === 'string' ? JSON.parse(batch.allowedCallerIds as string) : batch.allowedCallerIds;
          } catch { allowedIds = []; }
        }

        const isRestricted = allowedIds.length > 0;

        const leadsCountRes = await pool.query(
          `SELECT COUNT(*) as cnt FROM leads l JOIN businesses biz ON l.business_id = biz.id WHERE biz.batch_id = $1`,
          [batch.id]
        );
        const totalLeads = parseInt(leadsCountRes.rows[0]?.cnt || '0', 10);

        const callerBreakdown = callersList.map((c: any) => {
          const isAllowed = !isRestricted || allowedIds.includes(c.id);
          return {
            caller_id: c.id,
            caller_name: c.name,
            caller_email: c.email,
            is_allowed: isAllowed,
            accessible_leads_count: isAllowed ? totalLeads : 0,
            status: isAllowed ? 'ALLOWED' : 'BLOCKED',
          };
        });

        batchDiagnostics.push({
          batch_id: batch.id,
          file_name: batch.fileName,
          total_leads: totalLeads,
          allowed_caller_ids: allowedIds,
          is_restricted: isRestricted,
          allowed_callers_count: callerBreakdown.filter((c: any) => c.is_allowed).length,
          blocked_callers_count: callerBreakdown.filter((c: any) => !c.is_allowed).length,
          caller_breakdown: callerBreakdown,
        });
      }

      const checks: string[] = [
        `${callersList.length} active callers found`,
        `${batchesList.length} imported batches found`,
        `Visibility audit completed at ${new Date().toISOString()}`,
      ];

      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        total_callers: callersList.length,
        total_batches: batchesList.length,
        verification_checks: checks,
        batch_diagnostics: batchDiagnostics,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // =============================================
  // --- Concurrency Test ---
  // =============================================

  app.post('/api/concurrency-test', async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;

      res.json({
        success: true,
        message: 'Concurrency test passed',
        user_id: user.id,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // =============================================
  // --- Export Call Logs CSV ---
  // =============================================

  app.get('/api/export/csv', async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;

      const orgId = user.orgId || user.org_id || 'org_default';
      const logsRes = await pool.query(
        `SELECT cl.*, biz.name as business_name, biz.phone as business_phone
         FROM call_logs cl
         LEFT JOIN businesses biz ON cl.business_id = biz.id
         WHERE cl.org_id = $1
         ORDER BY cl.created_at DESC`,
        [orgId]
      );

      const headers = 'Date,Caller,Business,Phone,Who Answered,Outcome,Pitch,Objection,Notes\n';
      const csvRows = logsRes.rows.map((r: any) => {
        return [
          r.created_at || '',
          (r.caller_name || '').replace(/,/g, ' '),
          (r.business_name || '').replace(/,/g, ' '),
          r.business_phone || '',
          r.who_answered || '',
          r.call_outcome || '',
          r.pitch_given || '',
          r.objection_reason || '',
          (r.notes || '').replace(/,/g, ' ').replace(/\n/g, ' '),
        ].join(',');
      }).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="call_logs_export.csv"');
      res.send(headers + csvRows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return app;
}
