import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { createServer as createViteServer } from 'vite';
import { db, pool } from './src/db/index.ts';
import * as schema from './src/db/schema.ts';
import { seedInitialDataIfNeeded, ensureTablesExist, cleanExpiredReservations, saveSession, getSessionUser, deleteSession } from './src/db/db-service.ts';
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

  // Initialize Cloud SQL / PostgreSQL Database schema & seed asynchronously
  seedInitialDataIfNeeded().catch((err) => {
    console.error('[Database Seed/Init Error]:', err);
  });

  app.use(express.json({ limit: '10mb' }));

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

  const requireUser = (req: Request, res: Response): any | null => {
    const user = (req as any).currentUser;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized: Valid authentication session required.' });
      return null;
    }
    if (!user.active) {
      res.status(403).json({ error: 'Account deactivated. Action forbidden.' });
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
          SQL_HOST_EXISTS: !!process.env.SQL_HOST,
          SQL_USER_EXISTS: !!process.env.SQL_USER,
          SQL_DB_NAME: process.env.SQL_DB_NAME,
          SQL_PASSWORD_EXISTS: !!process.env.SQL_PASSWORD,
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

      if (user.twoFactorEnabled && user.twoFactorPin) {
        if (!pin) {
          return res.status(200).json({
            requires_2fa: true,
            user_id: user.id,
            message: 'Two-Factor Authentication PIN required to complete sign in.',
          });
        }
        if (String(pin).trim() !== user.twoFactorPin.trim()) {
          return res.status(401).json({ error: 'Invalid Two-Factor Authentication PIN code.' });
        }
      }

      const nowIso = new Date().toISOString();
      await db.update(schema.users).set({ lastActiveAt: nowIso }).where(eq(schema.users.id, user.id));

      const token = `sess_${user.id}_${crypto.randomBytes(16).toString('hex')}`;
      await saveSession(token, user.id);

      await db.insert(schema.auditLogs).values({
        id: `aud_${Date.now()}`,
        orgId: user.orgId || 'org_default',
        userId: user.id,
        userName: user.name,
        action: 'USER_LOGIN',
        targetType: 'user',
        targetId: user.id,
        details: `User ${user.name} (${user.email}) logged into CRM with Cloud SQL session token.`,
        timestamp: nowIso,
      });

      res.json({
        token,
        ...toSafeUser(user),
      });
    } catch (err: any) {
      console.error('Login error:', err);
      res.status(500).json({ error: err.message || 'Server error during login.' });
    }
  });

  app.post('/api/auth/2fa', async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;

      const { enabled, pin } = req.body;

      if (enabled && (!pin || String(pin).trim().length < 4)) {
        return res.status(400).json({ error: '2FA PIN must be at least 4 digits.' });
      }

      await db.update(schema.users).set({
        twoFactorEnabled: !!enabled,
        twoFactorPin: enabled && pin ? String(pin).trim() : null,
      }).where(eq(schema.users.id, user.id));

      const updated = await db.select().from(schema.users).where(eq(schema.users.id, user.id));

      await db.insert(schema.auditLogs).values({
        id: `aud_${Date.now()}`,
        orgId: user.orgId || 'org_default',
        userId: user.id,
        userName: user.name,
        action: 'USER_2FA_UPDATED',
        targetType: 'user',
        targetId: user.id,
        details: `Updated 2-Factor Authentication state to enabled=${!!enabled}.`,
        timestamp: new Date().toISOString(),
      });

      res.json({ success: true, user: toSafeUser(updated[0]) });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/auth/logout', async (req, res) => {
    try {
      const user = (req as any).currentUser;
      const authHeader = req.headers['authorization'];
      const sessionToken =
        (req.headers['x-session-token'] as string) ||
        (authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : undefined);

      if (sessionToken) {
        await deleteSession(sessionToken);
      }

      if (user) {
        await db.insert(schema.auditLogs).values({
          id: `aud_${Date.now()}`,
          orgId: user.orgId || 'org_default',
          userId: user.id,
          userName: user.name,
          action: 'USER_LOGOUT',
          targetType: 'user',
          targetId: user.id,
          details: `User ${user.name} logged out.`,
          timestamp: new Date().toISOString(),
        });
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
        await db.update(schema.users)
          .set({ lastActiveAt: new Date().toISOString() })
          .where(eq(schema.users.id, user.id));
      }
      res.json({ status: 'alive' });
    } catch (err: any) {
      res.json({ status: 'alive' });
    }
  });

  // --- Users Endpoints ---

  app.get('/api/users', async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;
      const usersList = await db.select().from(schema.users).where(eq(schema.users.orgId, user.orgId || 'org_default'));
      res.json(usersList.map(toSafeUser));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/users', async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;
      if (user.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can create users.' });
      }

      const { name, email, role, password, avatar_url, two_factor_enabled, two_factor_pin } = req.body;
      if (!name || !email || !role) {
        return res.status(400).json({ error: 'Name, email, and role are required.' });
      }

      const existing = await db.select().from(schema.users).where(
        sql`LOWER(${schema.users.email}) = ${email.toLowerCase()}`
      );
      if (existing.length > 0) {
        return res.status(400).json({ error: 'A user with this email already exists.' });
      }

      const rawPass = password ? String(password).trim() : (role === 'admin' ? 'Fahad@6599' : role === 'team_leader' ? 'Leader@1234' : 'Caller@1234');
      const hashedPass = hashPassword(rawPass);
      const newId = `usr_${Date.now()}`;
      const nowIso = new Date().toISOString();

      await db.insert(schema.users).values({
        id: newId,
        orgId: user.orgId || 'org_default',
        name,
        email,
        role,
        password: hashedPass,
        avatarUrl: avatar_url ? String(avatar_url).trim() : null,
        twoFactorEnabled: !!two_factor_enabled,
        twoFactorPin: two_factor_pin ? String(two_factor_pin).trim() : null,
        active: true,
        lastActiveAt: nowIso,
        createdAt: nowIso,
      });

      await db.insert(schema.auditLogs).values({
        id: `aud_${Date.now()}`,
        orgId: user.orgId || 'org_default',
        userId: user.id,
        userName: user.name,
        action: 'USER_CREATED',
        targetType: 'user',
        targetId: newId,
        details: `Created user ${name} (${email}) as ${role} with bcrypt hashed password.`,
        timestamp: nowIso,
      });

      const inserted = await db.select().from(schema.users).where(eq(schema.users.id, newId));
      res.status(201).json(toSafeUser(inserted[0]));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/users/:id/reset-password', async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;
      if (user.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can reset user passwords.' });
      }

      const { id } = req.params;
      const { new_password } = req.body;

      if (!new_password || String(new_password).trim().length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
      }

      const targetUsers = await db.select().from(schema.users).where(eq(schema.users.id, id));
      if (targetUsers.length === 0) {
        return res.status(404).json({ error: 'User not found.' });
      }

      const newHash = hashPassword(String(new_password).trim());
      await db.update(schema.users).set({ password: newHash }).where(eq(schema.users.id, id));

      await db.insert(schema.auditLogs).values({
        id: `aud_${Date.now()}`,
        orgId: user.orgId || 'org_default',
        userId: user.id,
        userName: user.name,
        action: 'USER_PASSWORD_RESET',
        targetType: 'user',
        targetId: id,
        details: `Reset password for user ${targetUsers[0].name} (${targetUsers[0].email}) with new bcrypt hash.`,
        timestamp: new Date().toISOString(),
      });

      res.json({ success: true, message: `Password reset successfully for ${targetUsers[0].name}.` });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/users/:id', async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;
      if (user.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can modify users.' });
      }

      const { id } = req.params;
      const { active, role, name, password, avatar_url, two_factor_enabled, two_factor_pin } = req.body;

      const targetUsers = await db.select().from(schema.users).where(eq(schema.users.id, id));
      if (targetUsers.length === 0) {
        return res.status(404).json({ error: 'User not found.' });
      }
      const targetUser = targetUsers[0];

      const updates: any = {};
      if (typeof active === 'boolean') {
        if (!active && targetUser.role === 'admin') {
          return res.status(400).json({ error: 'Administrator accounts cannot be deactivated.' });
        }
        updates.active = active;
        if (!active) {
          await db.update(schema.leads).set({
            status: 'unassigned',
            assignedCallerId: null,
            assignedCallerName: null,
            reservedAt: null,
          }).where(and(eq(schema.leads.assignedCallerId, id), eq(schema.leads.status, 'reserved')));
        }
      }

      if (role) updates.role = role;
      if (name) updates.name = name;
      if (avatar_url !== undefined) updates.avatarUrl = avatar_url ? String(avatar_url).trim() : null;
      if (password && String(password).trim().length >= 6) updates.password = hashPassword(String(password).trim());
      if (typeof two_factor_enabled === 'boolean') updates.twoFactorEnabled = two_factor_enabled;
      if (two_factor_pin !== undefined) updates.twoFactorPin = two_factor_pin ? String(two_factor_pin).trim() : null;

      await db.update(schema.users).set(updates).where(eq(schema.users.id, id));

      await db.insert(schema.auditLogs).values({
        id: `aud_${Date.now()}`,
        orgId: user.orgId || 'org_default',
        userId: user.id,
        userName: user.name,
        action: 'USER_UPDATED',
        targetType: 'user',
        targetId: id,
        details: `Updated user ${targetUser.name}: active=${updates.active ?? targetUser.active}, role=${updates.role ?? targetUser.role}`,
        timestamp: new Date().toISOString(),
      });

      const updated = await db.select().from(schema.users).where(eq(schema.users.id, id));
      res.json(toSafeUser(updated[0]));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/users/:id', async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;
      if (user.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can delete users.' });
      }

      const { id } = req.params;

      if (id === user.id) {
        return res.status(400).json({ error: 'You cannot delete your own logged-in admin account.' });
      }

      const targetUsers = await db.select().from(schema.users).where(eq(schema.users.id, id));
      if (targetUsers.length === 0) {
        return res.status(404).json({ error: 'User record not found.' });
      }
      const targetUser = targetUsers[0];

      await db.update(schema.leads).set({
        status: 'unassigned',
        assignedCallerId: null,
        assignedCallerName: null,
        reservedAt: null,
      }).where(eq(schema.leads.assignedCallerId, id));

      await db.delete(schema.users).where(eq(schema.users.id, id));

      await db.insert(schema.auditLogs).values({
        id: `aud_${Date.now()}`,
        orgId: user.orgId || 'org_default',
        userId: user.id,
        userName: user.name,
        action: 'USER_DELETED',
        targetType: 'user',
        targetId: id,
        details: `Admin ${user.name} hard deleted user ${targetUser.name} (${targetUser.email}) from Cloud SQL database.`,
        timestamp: new Date().toISOString(),
      });

      res.json({ message: `User ${targetUser.name} was successfully deleted.` });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/users/profile', async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;

      const { name, avatar_url } = req.body;
      const dbUsers = await db.select().from(schema.users).where(eq(schema.users.id, user.id));
      if (dbUsers.length === 0) {
        return res.status(404).json({ error: 'User profile record not found.' });
      }
      const dbUser = dbUsers[0];

      const updates: any = {};
      let changesMade = false;

      if (name !== undefined && typeof name === 'string') {
        const trimmedName = name.trim();
        if (trimmedName.length > 0 && trimmedName !== dbUser.name) {
          updates.name = trimmedName;
          changesMade = true;
        }
      }

      if (avatar_url !== undefined) {
        const trimmedAvatar = avatar_url ? String(avatar_url).trim() : null;
        if (trimmedAvatar !== dbUser.avatarUrl) {
          updates.avatarUrl = trimmedAvatar;
          changesMade = true;
        }
      }

      if (changesMade) {
        await db.update(schema.users).set(updates).where(eq(schema.users.id, user.id));

        await db.insert(schema.auditLogs).values({
          id: `aud_${Date.now()}`,
          orgId: user.orgId || 'org_default',
          userId: user.id,
          userName: updates.name || dbUser.name,
          action: 'PROFILE_UPDATED',
          targetType: 'user',
          targetId: user.id,
          details: `Caller ${updates.name || dbUser.name} updated profile details.`,
          timestamp: new Date().toISOString(),
        });
      }

      const updated = await db.select().from(schema.users).where(eq(schema.users.id, user.id));
      res.json(toSafeUser(updated[0]));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Industries ---

  app.get('/api/industries', async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;
      const inds = await db.select().from(schema.industries).where(eq(schema.industries.orgId, user.orgId || 'org_default'));
      res.json(inds.map((i) => ({ id: i.id, org_id: i.orgId, name: i.name, default_pitch: i.defaultPitch })));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/industries', async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;
      if (user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin role required.' });
      }

      const { name, default_pitch } = req.body;
      if (!name) return res.status(400).json({ error: 'Industry name required.' });

      const newId = `ind_${Date.now()}`;
      await db.insert(schema.industries).values({
        id: newId,
        orgId: user.orgId || 'org_default',
        name,
        defaultPitch: default_pitch || null,
      });

      res.status(201).json({ id: newId, org_id: user.orgId || 'org_default', name, default_pitch });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- ATOMIC LEAD RESERVATION ENGINE WITH POSTGRES ATOMIC ROW LOCK ---

  app.post('/api/leads/next', async (req, res) => {
    const client = await pool.connect();
    try {
      const caller = requireUser(req, res);
      if (!caller) {
        client.release();
        return;
      }

      await client.query('BEGIN');

      const now = new Date();
      const nowIso = now.toISOString();
      const orgId = caller.orgId || caller.org_id || 'org_default';

      // Update caller's last active timestamp
      await client.query('UPDATE users SET last_active_at = $1 WHERE id = $2', [nowIso, caller.id]);

      // Step 1: Automatically clean expired lead reservations
      await cleanExpiredReservations(orgId);

      // Step 2: Check if caller already has an active, non-expired reserved lead (must also respect allowed_caller_ids)
      const existingRes = await client.query(
        `SELECT l.*, b.name as biz_name, b.phone as biz_phone, b.has_website, b.website_url, b.industry, b.address, b.city, b.state, b.zip, b.email as biz_email, b.contact_person
         FROM leads l
         LEFT JOIN businesses b ON l.business_id = b.id
         WHERE l.org_id = $1 AND l.status = 'reserved' AND l.assigned_caller_id = $2
           AND (
             l.allowed_caller_ids IS NULL 
             OR l.allowed_caller_ids::text = 'null'
             OR l.allowed_caller_ids::text = '[]'
             OR l.allowed_caller_ids @> jsonb_build_array($2::text)
           )
         LIMIT 1`,
        [orgId, caller.id]
      );

      // Clean up/unassign any reserved lead that is no longer allowed for this caller
      await client.query(
        `UPDATE leads 
         SET status = 'unassigned', assigned_caller_id = NULL, assigned_caller_name = NULL, reserved_at = NULL 
         WHERE org_id = $1 AND status = 'reserved' AND assigned_caller_id = $2
           AND NOT (
             allowed_caller_ids IS NULL 
             OR allowed_caller_ids::text = 'null'
             OR allowed_caller_ids::text = '[]'
             OR allowed_caller_ids @> jsonb_build_array($2::text)
           )`,
        [orgId, caller.id]
      );

      if (existingRes.rows.length > 0) {
        await client.query('COMMIT');
        client.release();
        const row = existingRes.rows[0];
        const biz = {
          id: row.business_id,
          org_id: orgId,
          name: row.biz_name,
          phone: row.biz_phone,
          has_website: row.has_website,
          website_url: row.website_url,
          industry: row.industry,
          address: row.address,
          city: row.city,
          state: row.state,
          zip: row.zip,
          email: row.biz_email,
          contact_person: row.contact_person,
        };
        return res.json({
          id: row.id,
          org_id: orgId,
          business_id: row.business_id,
          status: row.status,
          assigned_caller_id: row.assigned_caller_id,
          assigned_caller_name: row.assigned_caller_name,
          allowed_caller_ids: row.allowed_caller_ids,
          reserved_at: row.reserved_at,
          completed_at: row.completed_at,
          current_cycle: row.current_cycle,
          created_at: row.created_at,
          business: biz,
          smart_pitch: calculateSmartPitch(row.has_website),
        });
      }

      // Step 3: Check for due or overdue follow-ups assigned to this caller
      const dueFollowUpsRes = await client.query(
        `SELECT f.*, l.id as target_lead_id
         FROM follow_ups f
         JOIN leads l ON f.lead_id = l.id
         WHERE f.org_id = $1 AND f.caller_id = $2 AND f.status != 'closed' AND f.scheduled_at <= $3
           AND (
             l.allowed_caller_ids IS NULL 
             OR l.allowed_caller_ids::text = 'null'
             OR l.allowed_caller_ids::text = '[]'
             OR l.allowed_caller_ids @> jsonb_build_array($2::text)
           )
         ORDER BY f.scheduled_at ASC
         LIMIT 1
         FOR UPDATE OF f`,
        [orgId, caller.id, nowIso]
      );

      if (dueFollowUpsRes.rows.length > 0) {
        const fup = dueFollowUpsRes.rows[0];
        
        // Mark follow up as closed
        await client.query(`UPDATE follow_ups SET status = 'closed' WHERE id = $1`, [fup.id]);

        // Reserve target lead
        await client.query(
          `UPDATE leads SET status = 'reserved', assigned_caller_id = $1, assigned_caller_name = $2, reserved_at = $3 WHERE id = $4`,
          [caller.id, caller.name, nowIso, fup.target_lead_id]
        );

        const leadRes = await client.query(
          `SELECT l.*, b.name as biz_name, b.phone as biz_phone, b.has_website, b.website_url, b.industry, b.address, b.city, b.state, b.zip, b.email as biz_email, b.contact_person
           FROM leads l
           LEFT JOIN businesses b ON l.business_id = b.id
           WHERE l.id = $1`,
          [fup.target_lead_id]
        );

        await client.query('COMMIT');
        client.release();

        const row = leadRes.rows[0];
        const biz = {
          id: row.business_id,
          org_id: orgId,
          name: row.biz_name,
          phone: row.biz_phone,
          has_website: row.has_website,
          website_url: row.website_url,
          industry: row.industry,
          address: row.address,
          city: row.city,
          state: row.state,
          zip: row.zip,
          email: row.biz_email,
          contact_person: row.contact_person,
        };

        return res.json({
          id: row.id,
          org_id: orgId,
          business_id: row.business_id,
          status: 'reserved',
          assigned_caller_id: caller.id,
          assigned_caller_name: caller.name,
          reserved_at: nowIso,
          business: biz,
          smart_pitch: calculateSmartPitch(row.has_website),
          is_followup_resurface: true,
        });
      }

      // Step 4: ATOMIC RESERVATION OF NEXT UNASSIGNED LEAD USING POSTGRES "FOR UPDATE SKIP LOCKED"
      // Filter strictly by allowed_caller_ids directly in SQL!
      const unassignedRes = await client.query(
        `SELECT l.id, l.business_id, l.allowed_caller_ids
         FROM leads l
         WHERE l.org_id = $1 AND l.status = 'unassigned'
           AND (
             l.allowed_caller_ids IS NULL 
             OR l.allowed_caller_ids::text = 'null'
             OR l.allowed_caller_ids::text = '[]'
             OR l.allowed_caller_ids @> jsonb_build_array($2::text)
           )
         ORDER BY l.created_at ASC
         FOR UPDATE SKIP LOCKED`,
        [orgId, caller.id]
      );

      console.log(
        `[Leads API Visibility Filter] Caller: "${caller.name}" (${caller.id}) | Role: ${caller.role} | Applied Filter: (allowed_caller_ids IS NULL OR allowed_caller_ids @> ["${caller.id}"]) | Matching Unassigned Leads: ${unassignedRes.rows.length}`
      );

      let targetLeadRow: any = null;
      for (const row of unassignedRes.rows) {
        let allowed = row.allowed_caller_ids;
        if (typeof allowed === 'string') {
          try {
            allowed = JSON.parse(allowed);
          } catch (e) {
            allowed = null;
          }
        }
        if (allowed && Array.isArray(allowed) && allowed.length > 0) {
          if (!allowed.includes(caller.id)) continue;
        }
        targetLeadRow = row;
        break;
      }

      if (!targetLeadRow) {
        await client.query('COMMIT');
        client.release();
        return res.json({
          lead: null,
          message: 'No leads available in the queue right now.',
        });
      }

      // Mark selected lead as reserved
      await client.query(
        `UPDATE leads SET status = 'reserved', assigned_caller_id = $1, assigned_caller_name = $2, reserved_at = $3 WHERE id = $4`,
        [caller.id, caller.name, nowIso, targetLeadRow.id]
      );

      const leadRes = await client.query(
        `SELECT l.*, b.name as biz_name, b.phone as biz_phone, b.has_website, b.website_url, b.industry, b.address, b.city, b.state, b.zip, b.email as biz_email, b.contact_person
         FROM leads l
         LEFT JOIN businesses b ON l.business_id = b.id
         WHERE l.id = $1`,
        [targetLeadRow.id]
      );

      await client.query(
        `INSERT INTO audit_logs (id, org_id, user_id, user_name, action, target_type, target_id, details, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          `aud_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          orgId,
          caller.id,
          caller.name,
          'LEAD_RESERVED_ATOMIC_SQL',
          'lead',
          targetLeadRow.id,
          `Lead ${leadRes.rows[0]?.biz_name || targetLeadRow.id} atomically reserved for ${caller.name} in Cloud SQL.`,
          nowIso,
        ]
      );

      await client.query('COMMIT');
      client.release();

      const row = leadRes.rows[0];
      const biz = {
        id: row.business_id,
        org_id: orgId,
        name: row.biz_name,
        phone: row.biz_phone,
        has_website: row.has_website,
        website_url: row.website_url,
        industry: row.industry,
        address: row.address,
        city: row.city,
        state: row.state,
        zip: row.zip,
        email: row.biz_email,
        contact_person: row.contact_person,
      };

      res.json({
        id: row.id,
        org_id: orgId,
        business_id: row.business_id,
        status: 'reserved',
        assigned_caller_id: caller.id,
        assigned_caller_name: caller.name,
        reserved_at: nowIso,
        business: biz,
        smart_pitch: calculateSmartPitch(row.has_website),
      });
    } catch (err: any) {
      await client.query('ROLLBACK');
      client.release();
      console.error('Error in /api/leads/next:', err);
      res.status(500).json({ error: err.message || 'Error assigning lead.' });
    }
  });

  // Notifications / Callbacks
  app.get('/api/notifications/callbacks', async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;

      const orgId = user.orgId || user.org_id || 'org_default';
      const now = new Date();
      const serverLocalDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const todayStr = (req.query.today as string) || (req.query.date as string) || serverLocalDate;
      const targetDate = (req.query.date as string) || todayStr;

      let query = `
        SELECT f.*, b.name as biz_name, b.phone as biz_phone, b.industry as biz_industry, b.address as biz_address, b.contact_person as biz_contact_person, b.email as biz_email, b.has_website as biz_has_website, cl.who_answered, cl.call_outcome, cl.notes as cl_notes, cl.caller_name as cl_caller_name
        FROM follow_ups f
        LEFT JOIN businesses b ON f.business_id = b.id
        LEFT JOIN call_logs cl ON f.call_log_id = cl.id
        WHERE f.org_id = $1
      `;
      const params: any[] = [orgId];

      if (user.role === 'caller') {
        query += ` AND f.caller_id = $2`;
        params.push(user.id);
      }

      const rawRes = await pool.query(query, params);

      const items = rawRes.rows.map((f) => {
        const scheduled_date = f.scheduled_at ? new Date(f.scheduled_at).toISOString().split('T')[0] : todayStr;
        let scheduled_time: string | undefined = undefined;
        if (f.scheduled_at) {
          const iso = new Date(f.scheduled_at).toISOString();
          if (iso.includes('T')) scheduled_time = iso.split('T')[1].substring(0, 5);
        }

        const is_due_today = scheduled_date === todayStr;
        const is_overdue = scheduled_date < todayStr && f.status !== 'closed';

        return {
          id: f.id,
          lead_id: f.lead_id,
          business_id: f.business_id,
          business_name: f.biz_name || 'Unknown Business',
          business_phone: f.biz_phone || 'N/A',
          industry: f.biz_industry || 'General',
          address: f.biz_address,
          contact_person: f.biz_contact_person,
          contact_email: f.biz_email,
          caller_id: f.caller_id,
          caller_name: f.cl_caller_name || 'Assigned Agent',
          scheduled_at: f.scheduled_at,
          scheduled_date,
          scheduled_time,
          method: f.method || 'Call',
          notes: f.notes || f.cl_notes,
          call_outcome: f.call_outcome,
          smart_pitch: calculateSmartPitch(f.biz_has_website),
          status: f.status,
          created_at: f.created_at,
          is_due_today,
          is_overdue,
        };
      });

      const today_callbacks = items.filter((i) => i.scheduled_date === todayStr);
      const overdue_callbacks = items.filter((i) => i.is_overdue);
      const upcoming_callbacks = items.filter((i) => i.scheduled_date > todayStr);
      const selected_date_callbacks = items.filter((i) => i.scheduled_date === targetDate);

      res.json({
        today_callbacks,
        overdue_callbacks,
        upcoming_callbacks,
        selected_date_callbacks,
        target_date: targetDate,
        active_count: today_callbacks.length,
        total_overdue_count: overdue_callbacks.length,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get Single Lead Details with Strict Batch Visibility Check
  app.get('/api/leads/:id', async (req, res, next) => {
    try {
      const { id } = req.params;
      if (['batches', 'manage', 'visibility', 'next'].includes(id)) {
        return next();
      }

      const user = requireUser(req, res);
      if (!user) return;

      const orgId = user.orgId || user.org_id || 'org_default';

      const targetLeadRes = await db.select().from(schema.leads).where(and(eq(schema.leads.id, id), eq(schema.leads.orgId, orgId)));
      if (targetLeadRes.length === 0) return res.status(404).json({ error: 'Lead not found.' });

      const targetLead = targetLeadRes[0];

      if (user.role === 'caller') {
        let allowed = targetLead.allowedCallerIds;
        if (typeof allowed === 'string') {
          try { allowed = JSON.parse(allowed); } catch { allowed = null; }
        }

        // Fallback to batch-level restrictions if lead-level is not populated
        if (!allowed || (Array.isArray(allowed) && allowed.length === 0)) {
          const bizRes = await db.select().from(schema.businesses).where(eq(schema.businesses.id, targetLead.businessId));
          if (bizRes.length > 0 && bizRes[0].batchId) {
            const batchRes = await db.select().from(schema.importedBatches).where(eq(schema.importedBatches.id, bizRes[0].batchId));
            if (batchRes.length > 0) {
              allowed = batchRes[0].allowedCallerIds;
              if (typeof allowed === 'string') {
                try { allowed = JSON.parse(allowed); } catch { allowed = null; }
              }
            }
          }
        }

        if (allowed && Array.isArray(allowed) && allowed.length > 0) {
          if (!allowed.includes(user.id)) {
            return res.status(403).json({
              error: 'Forbidden: Requester ID is not present in the target batch visibility filter.',
            });
          }
        }
      }

      const bizRes = await db.select().from(schema.businesses).where(eq(schema.businesses.id, targetLead.businessId));
      const biz = bizRes[0] ? {
        id: bizRes[0].id,
        org_id: orgId,
        name: bizRes[0].name,
        phone: bizRes[0].phone,
        has_website: bizRes[0].hasWebsite,
        website_url: bizRes[0].websiteUrl,
        industry: bizRes[0].industry,
        address: bizRes[0].address,
        city: bizRes[0].city,
        state: bizRes[0].state,
        zip: bizRes[0].zip,
        email: bizRes[0].email,
        contact_person: bizRes[0].contactPerson,
      } : undefined;

      res.json({
        id: targetLead.id,
        org_id: orgId,
        business_id: targetLead.businessId,
        status: targetLead.status,
        assigned_caller_id: targetLead.assignedCallerId,
        assigned_caller_name: targetLead.assignedCallerName,
        allowed_caller_ids: targetLead.allowedCallerIds,
        reserved_at: targetLead.reservedAt,
        completed_at: targetLead.completedAt,
        current_cycle: targetLead.currentCycle,
        created_at: targetLead.createdAt,
        business: biz,
        smart_pitch: biz ? calculateSmartPitch(biz.has_website) : 'Website + AI Receptionist',
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Reserve Specific Lead
  app.post('/api/leads/reserve-specific', async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;

      const { leadId } = req.body;
      if (!leadId) return res.status(400).json({ error: 'leadId is required.' });

      const orgId = user.orgId || user.org_id || 'org_default';

      const targetLeadRes = await db.select().from(schema.leads).where(and(eq(schema.leads.id, leadId), eq(schema.leads.orgId, orgId)));
      if (targetLeadRes.length === 0) return res.status(404).json({ error: 'Lead not found.' });

      const targetLead = targetLeadRes[0];

      if (user.role === 'caller') {
        let allowed = targetLead.allowedCallerIds;
        if (typeof allowed === 'string') {
          try { allowed = JSON.parse(allowed); } catch { allowed = null; }
        }

        if (!allowed || (Array.isArray(allowed) && allowed.length === 0)) {
          const bizRes = await db.select().from(schema.businesses).where(eq(schema.businesses.id, targetLead.businessId));
          if (bizRes.length > 0 && bizRes[0].batchId) {
            const batchRes = await db.select().from(schema.importedBatches).where(eq(schema.importedBatches.id, bizRes[0].batchId));
            if (batchRes.length > 0) {
              allowed = batchRes[0].allowedCallerIds;
              if (typeof allowed === 'string') {
                try { allowed = JSON.parse(allowed); } catch { allowed = null; }
              }
            }
          }
        }

        if (allowed && Array.isArray(allowed) && allowed.length > 0) {
          if (!allowed.includes(user.id)) {
            return res.status(403).json({
              error: 'Forbidden: Requester ID is not present in the target batch visibility filter.',
            });
          }
        }

        await db.update(schema.leads).set({
          status: 'unassigned',
          assignedCallerId: null,
          assignedCallerName: null,
          reservedAt: null,
        }).where(and(eq(schema.leads.orgId, orgId), eq(schema.leads.status, 'reserved'), eq(schema.leads.assignedCallerId, user.id)));
      }

      const nowIso = new Date().toISOString();
      await db.update(schema.leads).set({
        status: 'reserved',
        assignedCallerId: user.id,
        assignedCallerName: user.name,
        reservedAt: nowIso,
      }).where(and(eq(schema.leads.id, leadId), eq(schema.leads.orgId, orgId)));

      const lead = targetLead;
      const bizRes = await db.select().from(schema.businesses).where(eq(schema.businesses.id, lead.businessId));
      const biz = bizRes[0] ? {
        id: bizRes[0].id,
        org_id: orgId,
        name: bizRes[0].name,
        phone: bizRes[0].phone,
        has_website: bizRes[0].hasWebsite,
        website_url: bizRes[0].websiteUrl,
        industry: bizRes[0].industry,
        address: bizRes[0].address,
        city: bizRes[0].city,
        state: bizRes[0].state,
        zip: bizRes[0].zip,
        email: bizRes[0].email,
        contact_person: bizRes[0].contactPerson,
      } : undefined;

      await db.insert(schema.auditLogs).values({
        id: `aud_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        orgId,
        userId: user.id,
        userName: user.name,
        action: 'LEAD_RESERVED_DIRECT_CALLBACK',
        targetType: 'lead',
        targetId: lead.id,
        details: `Caller ${user.name} directly selected callback lead ${biz?.name || lead.id} from Notification Center.`,
        timestamp: nowIso,
      });

      res.json({
        id: lead.id,
        org_id: orgId,
        business_id: lead.businessId,
        status: 'reserved',
        assigned_caller_id: user.id,
        assigned_caller_name: user.name,
        reserved_at: nowIso,
        business: biz,
        smart_pitch: biz ? calculateSmartPitch(biz.has_website) : 'Website + AI Receptionist',
        is_followup_resurface: true,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Release Active Reservation
  app.post('/api/leads/release', async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;

      const { leadId } = req.body;
      const orgId = user.orgId || user.org_id || 'org_default';

      await db.update(schema.leads).set({
        status: 'unassigned',
        assignedCallerId: null,
        assignedCallerName: null,
        reservedAt: null,
      }).where(and(eq(schema.leads.id, leadId), eq(schema.leads.orgId, orgId), eq(schema.leads.status, 'reserved'), eq(schema.leads.assignedCallerId, user.id)));

      await db.insert(schema.auditLogs).values({
        id: `aud_${Date.now()}`,
        orgId,
        userId: user.id,
        userName: user.name,
        action: 'LEAD_RESERVE_RELEASED',
        targetType: 'lead',
        targetId: leadId,
        details: `User ${user.name} explicitly released reservation for lead ${leadId}.`,
        timestamp: new Date().toISOString(),
      });

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Submit Call Outcome
  app.post('/api/leads/outcome', async (req, res) => {
    try {
      const caller = requireUser(req, res);
      if (!caller) return;

      const {
        leadId,
        who_answered,
        call_outcome,
        pitch_given,
        objection_reason,
        has_followup,
        followup_at,
        followup_method,
        contact_name,
        contact_email,
        notes,
      } = req.body;

      if (!leadId || !who_answered) {
        return res.status(400).json({ error: 'leadId and who_answered are required.' });
      }

      const orgId = caller.orgId || caller.org_id || 'org_default';
      const now = new Date().toISOString();

      const leadRes = await db.select().from(schema.leads).where(and(eq(schema.leads.id, leadId), eq(schema.leads.orgId, orgId)));
      if (leadRes.length === 0) return res.status(404).json({ error: 'Lead not found.' });

      const lead = leadRes[0];
      const bizRes = await db.select().from(schema.businesses).where(eq(schema.businesses.id, lead.businessId));
      const bizName = bizRes[0]?.name || lead.id;

      const newStatus = (call_outcome === 'Do Not Call' || who_answered === 'Business Closed-Disconnected') ? 'do_not_call' : 'completed';

      await db.update(schema.leads).set({
        status: newStatus,
        completedAt: now,
        reservedAt: null,
      }).where(eq(schema.leads.id, leadId));

      await db.update(schema.followUps).set({
        status: 'closed',
      }).where(and(eq(schema.followUps.leadId, leadId), eq(schema.followUps.orgId, orgId)));

      const callLogId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
      await db.insert(schema.callLogs).values({
        id: callLogId,
        orgId,
        leadId: lead.id,
        businessId: lead.businessId,
        callerId: caller.id,
        callerName: caller.name,
        whoAnswered: who_answered,
        callOutcome: call_outcome || null,
        pitchGiven: pitch_given || null,
        objectionReason: objection_reason || null,
        hasFollowup: Boolean(has_followup),
        followupAt: followup_at || null,
        followupMethod: followup_method || null,
        contactName: contact_name || null,
        contactEmail: contact_email || null,
        notes: notes || null,
        createdAt: now,
      });

      if (has_followup && followup_at) {
        await db.insert(schema.followUps).values({
          id: `fup_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          orgId,
          callLogId,
          leadId: lead.id,
          businessId: lead.businessId,
          callerId: caller.id,
          status: call_outcome === 'Interested (appointment set)' ? 'appointment' : 'interested',
          scheduledAt: followup_at,
          method: followup_method || 'Call',
          notes: notes || null,
          createdAt: now,
        });
      }

      await db.update(schema.users).set({ lastActiveAt: now }).where(eq(schema.users.id, caller.id));

      await db.insert(schema.auditLogs).values({
        id: `aud_${Date.now()}`,
        orgId,
        userId: caller.id,
        userName: caller.name,
        action: 'CALL_OUTCOME_SUBMITTED',
        targetType: 'lead',
        targetId: lead.id,
        details: `Caller ${caller.name} submitted outcome for ${bizName}: ${who_answered} -> ${call_outcome || 'N/A'}.`,
        timestamp: now,
      });

      res.json({
        success: true,
        callLog: {
          id: callLogId,
          org_id: orgId,
          lead_id: lead.id,
          business_id: lead.businessId,
          caller_id: caller.id,
          caller_name: caller.name,
          who_answered,
          call_outcome,
          pitch_given,
          objection_reason,
          has_followup: Boolean(has_followup),
          followup_at,
          followup_method,
          contact_name,
          contact_email,
          notes,
          created_at: now,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Lead CSV Import - Validate Endpoint
  app.post('/api/leads/import/validate', (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin permissions required for lead import.' });
    }

    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'No data rows provided for validation.' });
    }

    const validRows: any[] = [];
    const skippedBlankRows: number[] = [];

    rows.forEach((row, idx) => {
      const rowNum = idx + 1;

      let businessName = extractFlexibleColumn(row, ['business_name', 'business', 'company_name', 'company', 'name', 'title', 'store_name', 'client', 'account', 'clinic_name']);
      let phone = extractFlexibleColumn(row, ['phone', 'phone_number', 'mobile', 'telephone', 'contact_number', 'cell', 'tel', 'phone_no']);
      let industry = extractFlexibleColumn(row, ['industry', 'category', 'type', 'business_type', 'niche', 'sector', 'service']);
      let address = extractFlexibleColumn(row, [
        'address', 'street_address', 'street', 'location', 'full_address',
        'address1', 'address_line_1', 'address_line1', 'street_address_1',
        'addr', 'building', 'location_address', 'address_details', 'venue'
      ]);
      let city = extractFlexibleColumn(row, ['city', 'town', 'municipality', 'district', 'city_name', 'suburb', 'city_town']);
      let state = extractFlexibleColumn(row, ['state', 'province', 'region', 'state_code', 'state_name', 'state_province']);
      let zip = extractFlexibleColumn(row, [
        'zip', 'zipcode', 'zip_code', 'zip_postal', 'zip_postal_code',
        'postal', 'postal_code', 'postalcode', 'pincode', 'pin_code',
        'post_code', 'postcode', 'zip_code_code'
      ]);
      let websiteVal = extractFlexibleColumn(row, ['website', 'website_url', 'url', 'has_website', 'site', 'domain', 'link']);
      let email = extractFlexibleColumn(row, ['email', 'contact_email', 'business_email', 'e_mail', 'mail', 'email_address']);
      let contactPerson = extractFlexibleColumn(row, ['contact_person', 'contact_name', 'decision_maker', 'owner', 'doctor', 'manager', 'person', 'contact', 'full_name', 'name_of_contact']);

      if (!zip) {
        const searchStr = `${address} ${city} ${state}`;
        const zipMatch = searchStr.match(/\b(\d{5}(-\d{4})?)\b/);
        if (zipMatch) zip = zipMatch[1];
      }

      if (!state && address) {
        const stateMatch = address.match(/\b([A-Z]{2})\b\s*(\d{5})?/i);
        if (stateMatch && stateMatch[1] && stateMatch[1].length === 2) {
          state = stateMatch[1].toUpperCase();
        }
      }

      if ((!address || address === 'N/A') && (city || state || zip)) {
        address = [city, state, zip].filter(Boolean).join(', ');
      } else if (!address) {
        address = 'N/A';
      }

      if (!businessName && !phone && !industry && !address && !websiteVal && !email && !contactPerson) {
        skippedBlankRows.push(rowNum);
        return;
      }

      if (!businessName) {
        businessName = phone ? `Business ${phone}` : `Imported Business #${validRows.length + 1}`;
      }

      if (!phone) {
        phone = `(555) 300-${String(1000 + (validRows.length % 9000))}`;
      }

      if (!industry) {
        industry = inferIndustryFromName(businessName);
      }

      const trimmedWeb = (websiteVal || '').trim();
      const lowerWeb = trimmedWeb.toLowerCase();
      const isExplicitNoWebsite =
        !trimmedWeb ||
        ['no_website', 'no website', 'none', 'no', 'n/a', 'false', '0', 'null', 'undefined', 'not available'].includes(lowerWeb);

      let hasWebsite = false;
      let websiteUrl: string | undefined = undefined;

      if (!isExplicitNoWebsite) {
        if (lowerWeb.startsWith('http://') || lowerWeb.startsWith('https://')) {
          hasWebsite = true;
          websiteUrl = trimmedWeb;
        } else if (trimmedWeb.includes('.') && !trimmedWeb.includes(' ')) {
          hasWebsite = true;
          websiteUrl = `https://${trimmedWeb}`;
        } else if (['yes', 'true', '1', 'y'].includes(lowerWeb)) {
          hasWebsite = true;
        }
      }

      validRows.push({
        name: businessName,
        phone,
        has_website: hasWebsite,
        website_url: websiteUrl,
        industry,
        address,
        city: city || undefined,
        state: state || undefined,
        zip: zip || undefined,
        email: email || undefined,
        contact_person: contactPerson || undefined,
      });
    });

    res.json({
      total_rows: rows.length,
      valid_count: validRows.length,
      invalid_count: 0,
      errors: [],
      skipped_blank_rows: skippedBlankRows,
      sample_valid_rows: validRows.slice(0, 5),
      valid_rows: validRows,
    });
  });

  // Lead CSV Import - Commit Endpoint into Cloud SQL Database (ZERO Firestore writes!)
  app.post('/api/leads/import/commit', async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;
      if (user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin permissions required.' });
      }

      const { rows, fileName, allowed_caller_ids } = req.body;
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ error: 'No rows provided for import commit.' });
      }

      const cleanAllowedCallerIds = Array.isArray(allowed_caller_ids) && allowed_caller_ids.length > 0
        ? allowed_caller_ids.map(String)
        : null;

      const orgId = user.orgId || user.org_id || 'org_default';
      const now = new Date().toISOString();
      const batchId = `batch_${Date.now()}`;
      const batchFileName = fileName || `Uploaded_Leads_${new Date().toISOString().split('T')[0]}.csv`;

      await db.insert(schema.importedBatches).values({
        id: batchId,
        orgId,
        fileName: batchFileName,
        totalLeads: rows.length,
        allowedCallerIds: cleanAllowedCallerIds,
        importedById: user.id,
        importedByName: user.name,
        createdAt: now,
      });

      const bizValues: any[] = [];
      const leadValues: any[] = [];
      const indSet = new Set<string>();

      rows.forEach((r, idx) => {
        const bizId = `biz_imp_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 5)}`;
        const leadId = `lead_imp_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 5)}`;

        bizValues.push({
          id: bizId,
          batchId,
          orgId,
          name: r.name || `Business #${idx + 1}`,
          phone: r.phone || '(555) 000-0000',
          hasWebsite: Boolean(r.has_website),
          websiteUrl: r.website_url || null,
          industry: r.industry || 'General Business',
          address: r.address || 'N/A',
          city: r.city || null,
          state: r.state || null,
          zip: r.zip || null,
          email: r.email || null,
          contactPerson: r.contact_person || null,
          createdAt: now,
        });

        leadValues.push({
          id: leadId,
          orgId,
          businessId: bizId,
          status: 'unassigned',
          allowedCallerIds: cleanAllowedCallerIds,
          currentCycle: 1,
          createdAt: now,
        });

        if (r.industry) indSet.add(r.industry);
      });

      // Insert businesses and leads in batches to PostgreSQL
      const CHUNK = 500;
      for (let i = 0; i < bizValues.length; i += CHUNK) {
        await db.insert(schema.businesses).values(bizValues.slice(i, i + CHUNK));
        await db.insert(schema.leads).values(leadValues.slice(i, i + CHUNK));
      }

      for (const indName of indSet) {
        await db.insert(schema.industries).values({
          id: `ind_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          orgId,
          name: indName,
        }).onConflictDoNothing();
      }

      await db.insert(schema.auditLogs).values({
        id: `aud_${Date.now()}`,
        orgId,
        userId: user.id,
        userName: user.name,
        action: 'LEADS_BULK_IMPORTED',
        targetType: 'lead_batch',
        targetId: batchId,
        details: `Imported ${rows.length} leads from file "${batchFileName}" into Cloud SQL CRM queue successfully.`,
        timestamp: now,
      });

      res.json({
        success: true,
        importedCount: rows.length,
        batch: {
          id: batchId,
          org_id: orgId,
          file_name: batchFileName,
          total_leads: rows.length,
          allowed_caller_ids: cleanAllowedCallerIds,
          imported_by_id: user.id,
          imported_by_name: user.name,
          created_at: now,
        },
      });
    } catch (err: any) {
      console.error('Error committing lead import to Cloud SQL:', err);
      res.status(500).json({ error: err.message || 'Failed to import leads to database.' });
    }
  });

  // Get Batches
  app.get('/api/leads/batches', async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;
      if (user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin permissions required.' });
      }

      const orgId = user.orgId || user.org_id || 'org_default';
      const batches = await db.select().from(schema.importedBatches).where(eq(schema.importedBatches.orgId, orgId));

      const result: any[] = [];
      for (const batch of batches) {
        const bizList = await db.select().from(schema.businesses).where(eq(schema.businesses.batchId, batch.id));
        const bizIds = bizList.map((b) => b.id);

        let unassigned_count = 0;
        let completed_count = 0;

        if (bizIds.length > 0) {
          const unassignedRes = await pool.query(
            `SELECT COUNT(*) FROM leads WHERE business_id = ANY($1) AND status = 'unassigned'`,
            [bizIds]
          );
          const completedRes = await pool.query(
            `SELECT COUNT(*) FROM leads WHERE business_id = ANY($1) AND (status = 'completed' OR status = 'do_not_call')`,
            [bizIds]
          );
          unassigned_count = parseInt(unassignedRes.rows[0].count, 10) || 0;
          completed_count = parseInt(completedRes.rows[0].count, 10) || 0;
        }

        result.push({
          id: batch.id,
          org_id: orgId,
          file_name: batch.fileName,
          total_leads: bizList.length,
          allowed_caller_ids: batch.allowedCallerIds,
          imported_by_id: batch.importedById,
          imported_by_name: batch.importedByName,
          created_at: batch.createdAt,
          unassigned_count,
          completed_count,
          sample_businesses: bizList.slice(0, 5),
        });
      }

      result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Edit Batch File Settings
  app.patch('/api/leads/batches/:id', async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;
      if (user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin permissions required.' });
      }

      const { id } = req.params;
      const { file_name, allowed_caller_ids } = req.body;
      const orgId = user.orgId || user.org_id || 'org_default';

      const batchRes = await db.select().from(schema.importedBatches).where(and(eq(schema.importedBatches.id, id), eq(schema.importedBatches.orgId, orgId)));
      if (batchRes.length === 0) {
        return res.status(404).json({ error: 'Batch file record not found.' });
      }

      const updates: any = {};
      if (file_name !== undefined && file_name.trim()) updates.fileName = file_name.trim();

      const cleanIds = Array.isArray(allowed_caller_ids) && allowed_caller_ids.length > 0
        ? allowed_caller_ids.map(String)
        : null;

      if (allowed_caller_ids !== undefined) updates.allowedCallerIds = cleanIds;

      await db.update(schema.importedBatches).set(updates).where(eq(schema.importedBatches.id, id));

      if (allowed_caller_ids !== undefined) {
        await pool.query(
          `UPDATE leads SET allowed_caller_ids = $1::jsonb WHERE business_id IN (SELECT id FROM businesses WHERE batch_id = $2)`,
          [cleanIds ? JSON.stringify(cleanIds) : null, id]
        );

        if (cleanIds) {
          await pool.query(
            `UPDATE leads 
             SET status = 'unassigned', assigned_caller_id = NULL, assigned_caller_name = NULL, reserved_at = NULL 
             WHERE business_id IN (SELECT id FROM businesses WHERE batch_id = $1)
               AND status = 'reserved' 
               AND assigned_caller_id IS NOT NULL 
               AND NOT (allowed_caller_ids @> jsonb_build_array(assigned_caller_id))`,
            [id]
          );
        }
      }

      await db.insert(schema.auditLogs).values({
        id: `aud_${Date.now()}`,
        orgId,
        userId: user.id,
        userName: user.name,
        action: 'LEAD_BATCH_UPDATED',
        targetType: 'lead_batch',
        targetId: id,
        details: `Updated uploaded lead file batch "${updates.fileName || batchRes[0].fileName}" settings in Cloud SQL.`,
        timestamp: new Date().toISOString(),
      });

      const updatedBatch = await db.select().from(schema.importedBatches).where(eq(schema.importedBatches.id, id));
      res.json({ success: true, batch: updatedBatch[0] });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Delete Batch File & Associated Leads (ZERO Firestore writes!)
  app.delete('/api/leads/batches/:id', async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;
      if (user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin permissions required.' });
      }

      const { id } = req.params;
      const orgId = user.orgId || user.org_id || 'org_default';

      const batchRes = await db.select().from(schema.importedBatches).where(and(eq(schema.importedBatches.id, id), eq(schema.importedBatches.orgId, orgId)));
      if (batchRes.length === 0) {
        return res.status(404).json({ error: 'Batch file record not found.' });
      }

      const countRes = await pool.query(`SELECT COUNT(*) FROM businesses WHERE batch_id = $1`, [id]);
      const bizCount = parseInt(countRes.rows[0].count, 10) || 0;

      // Delete all associated records in PostgreSQL CASCADE order
      await pool.query(
        `DELETE FROM follow_ups WHERE business_id IN (SELECT id FROM businesses WHERE batch_id = $1)`,
        [id]
      );
      await pool.query(
        `DELETE FROM call_logs WHERE business_id IN (SELECT id FROM businesses WHERE batch_id = $1)`,
        [id]
      );
      await pool.query(
        `DELETE FROM leads WHERE business_id IN (SELECT id FROM businesses WHERE batch_id = $1)`,
        [id]
      );
      await pool.query(
        `DELETE FROM businesses WHERE batch_id = $1`,
        [id]
      );
      await db.delete(schema.importedBatches).where(eq(schema.importedBatches.id, id));

      await db.insert(schema.auditLogs).values({
        id: `aud_${Date.now()}`,
        orgId,
        userId: user.id,
        userName: user.name,
        action: 'LEAD_BATCH_DELETED',
        targetType: 'lead_batch',
        targetId: id,
        details: `Deleted uploaded file batch "${batchRes[0].fileName}" (${bizCount} leads removed from Cloud SQL CRM).`,
        timestamp: new Date().toISOString(),
      });

      res.json({ success: true, deleted_count: bizCount });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin Lead Queue Management & Detailed Listing
  app.get('/api/leads/manage', async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;
      if (user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin permissions required.' });
      }

      const orgId = user.orgId || user.org_id || 'org_default';
      const result = await pool.query(
        `SELECT l.id as id, l.status, l.allowed_caller_ids, l.current_cycle, l.created_at,
                b.id as business_id, b.name as business_name, b.phone, b.industry, b.city, b.state, b.zip, b.address, b.batch_id,
                ib.file_name as batch_name
         FROM leads l
         JOIN businesses b ON l.business_id = b.id
         LEFT JOIN imported_batches ib ON b.batch_id = ib.id
         WHERE l.org_id = $1
         ORDER BY l.created_at DESC`,
        [orgId]
      );

      res.json(result.rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin Change Visibility of Individual or Multiple Uploaded Leads
  app.patch('/api/leads/visibility', async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;
      if (user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin permissions required.' });
      }

      const { lead_ids, batch_id, update_all, allowed_caller_ids } = req.body;
      const orgId = user.orgId || user.org_id || 'org_default';

      const cleanIds = Array.isArray(allowed_caller_ids) && allowed_caller_ids.length > 0
        ? allowed_caller_ids.map(String)
        : null;

      const callerVal = cleanIds ? JSON.stringify(cleanIds) : null;
      let updatedCount = 0;

      if (update_all) {
        const queryRes = await pool.query(
          `UPDATE leads SET allowed_caller_ids = $1::jsonb WHERE org_id = $2`,
          [callerVal, orgId]
        );
        await pool.query(
          `UPDATE imported_batches SET allowed_caller_ids = $1::jsonb WHERE org_id = $2`,
          [callerVal, orgId]
        );
        updatedCount = queryRes.rowCount || 0;
      } else if (batch_id) {
        const queryRes = await pool.query(
          `UPDATE leads SET allowed_caller_ids = $1::jsonb WHERE business_id IN (SELECT id FROM businesses WHERE batch_id = $2)`,
          [callerVal, batch_id]
        );
        await pool.query(
          `UPDATE imported_batches SET allowed_caller_ids = $1::jsonb WHERE id = $2 AND org_id = $3`,
          [callerVal, batch_id, orgId]
        );
        updatedCount = queryRes.rowCount || 0;
      } else if (Array.isArray(lead_ids) && lead_ids.length > 0) {
        const queryRes = await pool.query(
          `UPDATE leads SET allowed_caller_ids = $1::jsonb WHERE id = ANY($2) AND org_id = $3`,
          [callerVal, lead_ids, orgId]
        );
        updatedCount = queryRes.rowCount || 0;
      } else {
        return res.status(400).json({ error: 'Please specify lead_ids, batch_id, or update_all flag.' });
      }

      if (cleanIds) {
        await pool.query(
          `UPDATE leads 
           SET status = 'unassigned', assigned_caller_id = NULL, assigned_caller_name = NULL, reserved_at = NULL 
           WHERE org_id = $1 
             AND status = 'reserved' 
             AND assigned_caller_id IS NOT NULL 
             AND NOT (allowed_caller_ids @> jsonb_build_array(assigned_caller_id))`,
          [orgId]
        );
      }

      await db.insert(schema.auditLogs).values({
        id: `aud_${Date.now()}`,
        orgId,
        userId: user.id,
        userName: user.name,
        action: 'LEAD_VISIBILITY_UPDATED',
        targetType: 'lead_queue',
        targetId: batch_id || (lead_ids ? lead_ids.join(',') : 'all_leads'),
        details: `Updated visibility settings for ${updatedCount} leads (Assigned callers: ${cleanIds ? cleanIds.join(', ') : 'Public to All Callers'}).`,
        timestamp: new Date().toISOString(),
      });

      res.json({ success: true, updatedCount });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Diagnostic Endpoint for Batch Visibility
  app.get('/api/admin/diagnostic/visibility', async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;
      if (user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin permissions required.' });
      }

      const orgId = user.orgId || user.org_id || 'org_default';

      const callers = await db.select().from(schema.users).where(
        and(eq(schema.users.orgId, orgId), eq(schema.users.role, 'caller'))
      );

      const batches = await db.select().from(schema.importedBatches).where(
        eq(schema.importedBatches.orgId, orgId)
      );

      const batchDiagnostics: any[] = [];
      const checks: string[] = [];

      for (const b of batches) {
        let allowedIds: string[] = [];
        if (Array.isArray(b.allowedCallerIds)) {
          allowedIds = b.allowedCallerIds;
        } else if (typeof b.allowedCallerIds === 'string') {
          try { allowedIds = JSON.parse(b.allowedCallerIds); } catch { allowedIds = []; }
        }

        const isRestricted = allowedIds && allowedIds.length > 0;

        const bizList = await db.select().from(schema.businesses).where(eq(schema.businesses.batchId, b.id));
        const bizIds = bizList.map((biz) => biz.id);

        const callerBreakdown: any[] = [];

        for (const c of callers) {
          const isAllowedForCaller = !isRestricted || allowedIds.includes(c.id);

          let accessibleLeads = 0;
          if (bizIds.length > 0) {
            const countRes = await pool.query(
              `SELECT COUNT(*) FROM leads 
               WHERE business_id = ANY($1) 
                 AND status = 'unassigned'
                 AND (
                   allowed_caller_ids IS NULL 
                   OR allowed_caller_ids::text = 'null'
                   OR allowed_caller_ids::text = '[]'
                   OR allowed_caller_ids @> jsonb_build_array($2::text)
                 )`,
              [bizIds, c.id]
            );
            accessibleLeads = parseInt(countRes.rows[0].count, 10) || 0;
          }

          callerBreakdown.push({
            caller_id: c.id,
            caller_name: c.name,
            caller_email: c.email,
            is_allowed: isAllowedForCaller,
            accessible_leads_count: accessibleLeads,
            status: isAllowedForCaller ? 'Access Granted' : 'Access Blocked',
          });
        }

        const allowedCallersList = callers.filter((c) => !isRestricted || allowedIds.includes(c.id));
        const blockedCallersList = callers.filter((c) => isRestricted && !allowedIds.includes(c.id));

        batchDiagnostics.push({
          batch_id: b.id,
          file_name: b.fileName,
          total_leads: bizList.length,
          allowed_caller_ids: allowedIds,
          is_restricted: isRestricted,
          allowed_callers_count: allowedCallersList.length,
          blocked_callers_count: blockedCallersList.length,
          caller_breakdown: callerBreakdown,
        });

        if (isRestricted) {
          checks.push(
            `Batch '${b.fileName}' is restricted to ${allowedCallersList.length} caller(s) (${allowedCallersList.map((c) => c.name).join(', ')}). ${blockedCallersList.length} caller(s) are strictly blocked.`
          );
        } else {
          checks.push(
            `Batch '${b.fileName}' is unrestricted (Global Access) — accessible by all ${callers.length} caller(s).`
          );
        }
      }

      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        total_callers: callers.length,
        total_batches: batches.length,
        batch_diagnostics: batchDiagnostics,
        verification_checks: checks,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Dashboards
  app.get('/api/dashboard/caller', async (req, res) => {
    try {
      const caller = requireUser(req, res);
      if (!caller) return;
      const orgId = caller.orgId || caller.org_id || 'org_default';

      await cleanExpiredReservations(orgId);

      const todayStr = new Date().toISOString().split('T')[0];
      const callerLogs = await db.select().from(schema.callLogs).where(
        and(
          eq(schema.callLogs.orgId, orgId),
          eq(schema.callLogs.callerId, caller.id),
          sql`${schema.callLogs.createdAt}::text LIKE ${todayStr + '%'}`
        )
      );

      const calls_today = callerLogs.length;
      const interested_count = callerLogs.filter((c) => c.callOutcome?.includes('Interested')).length;
      const appointments_count = callerLogs.filter((c) => c.callOutcome === 'Interested (appointment set)').length;

      const remainingRes = await pool.query(
        `SELECT COUNT(*) FROM leads 
         WHERE org_id = $1 AND status = 'unassigned'
           AND (
             allowed_caller_ids IS NULL 
             OR allowed_caller_ids::text = 'null'
             OR allowed_caller_ids::text = '[]'
             OR allowed_caller_ids @> jsonb_build_array($2::text)
           )`,
        [orgId, caller.id]
      );
      const remaining_leads = parseInt(remainingRes.rows[0].count, 10) || 0;

      let current_streak = 0;
      const sortedLogs = [...callerLogs].sort(
        (a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime()
      );
      for (const log of sortedLogs) {
        if (log.callOutcome?.includes('Interested')) current_streak++;
        else break;
      }

      res.json({
        calls_today,
        interested_count,
        appointments_count,
        remaining_leads,
        avg_call_seconds: 45,
        current_streak,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/dashboard/admin', async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;
      const orgId = user.orgId || user.org_id || 'org_default';

      await cleanExpiredReservations(orgId);

      const totalLeadsRes = await pool.query(`SELECT COUNT(*) FROM leads WHERE org_id = $1`, [orgId]);
      const completedLeadsRes = await pool.query(`SELECT COUNT(*) FROM leads WHERE org_id = $1 AND (status = 'completed' OR status = 'do_not_call')`, [orgId]);
      const remainingLeadsRes = await pool.query(`SELECT COUNT(*) FROM leads WHERE org_id = $1 AND status = 'unassigned'`, [orgId]);
      const totalCallsRes = await pool.query(`SELECT COUNT(*) FROM call_logs WHERE org_id = $1`, [orgId]);
      const interestedCallsRes = await pool.query(`SELECT COUNT(*) FROM call_logs WHERE org_id = $1 AND call_outcome LIKE '%Interested%'`, [orgId]);
      const apptsRes = await pool.query(`SELECT COUNT(*) FROM call_logs WHERE org_id = $1 AND call_outcome = 'Interested (appointment set)'`, [orgId]);

      const total_leads = parseInt(totalLeadsRes.rows[0].count, 10) || 0;
      const completed_leads = parseInt(completedLeadsRes.rows[0].count, 10) || 0;
      const remaining_leads = parseInt(remainingLeadsRes.rows[0].count, 10) || 0;
      const total_calls = parseInt(totalCallsRes.rows[0].count, 10) || 0;
      const interested_calls = parseInt(interestedCallsRes.rows[0].count, 10) || 0;
      const appointments_set = parseInt(apptsRes.rows[0].count, 10) || 0;
      const conversion_rate = total_calls > 0 ? Math.round((interested_calls / total_calls) * 100) : 0;

      // Top Performers
      const topRes = await pool.query(
        `SELECT caller_id, caller_name, COUNT(*) as calls_count,
                COUNT(CASE WHEN call_outcome = 'Interested (appointment set)' THEN 1 END) as appointments,
                COUNT(CASE WHEN call_outcome LIKE '%Interested%' THEN 1 END) as interested
         FROM call_logs
         WHERE org_id = $1 AND caller_id IS NOT NULL
         GROUP BY caller_id, caller_name
         ORDER BY appointments DESC, calls_count DESC`,
        [orgId]
      );
      const top_performers = topRes.rows.map((r) => ({
        caller_id: r.caller_id,
        caller_name: r.caller_name,
        calls_count: parseInt(r.calls_count, 10) || 0,
        appointments: parseInt(r.appointments, 10) || 0,
        interested: parseInt(r.interested, 10) || 0,
      }));

      // Active Callers
      const now = Date.now();
      const callers = await db.select().from(schema.users).where(and(eq(schema.users.orgId, orgId), eq(schema.users.role, 'caller')));
      const todayStr = new Date().toISOString().split('T')[0];

      const active_callers: any[] = [];
      for (const c of callers) {
        const lastActive = new Date(c.lastActiveAt || c.createdAt || '').getTime();
        const idleMinutes = Math.floor((now - lastActive) / 60000);
        const isIdleAlert = idleMinutes >= 15;

        const activeLeadRes = await pool.query(
          `SELECT b.name as biz_name FROM leads l JOIN businesses b ON l.business_id = b.id WHERE l.assigned_caller_id = $1 AND l.status = 'reserved' LIMIT 1`,
          [c.id]
        );
        const activeBizName = activeLeadRes.rows[0]?.biz_name;

        const callsTodayRes = await pool.query(
          `SELECT COUNT(*) FROM call_logs WHERE caller_id = $1 AND created_at::text LIKE $2`,
          [c.id, `${todayStr}%`]
        );
        const callsToday = parseInt(callsTodayRes.rows[0].count, 10) || 0;

        let status: 'In Call' | 'Idle' | 'Offline' = 'Offline';
        if (c.active) {
          if (activeBizName) status = 'In Call';
          else if (idleMinutes < 15) status = 'Idle';
          else status = 'Offline';
        }

        active_callers.push({
          id: c.id,
          name: c.name,
          status,
          last_active_at: c.lastActiveAt,
          calls_today: callsToday,
          idle_minutes: idleMinutes,
          is_idle_alert: isIdleAlert && c.active,
          current_lead_name: activeBizName,
        });
      }

      // 7-day volume series
      const call_volume_series: Array<{ date: string; total_calls: number; interested: number; appointments: number }> = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];

        const dayRes = await pool.query(
          `SELECT COUNT(*) as total,
                  COUNT(CASE WHEN call_outcome LIKE '%Interested%' THEN 1 END) as interested,
                  COUNT(CASE WHEN call_outcome = 'Interested (appointment set)' THEN 1 END) as appointments
           FROM call_logs WHERE org_id = $1 AND created_at::text LIKE $2`,
          [orgId, `${dateStr}%`]
        );

        call_volume_series.push({
          date: dateStr,
          total_calls: parseInt(dayRes.rows[0].total, 10) || 0,
          interested: parseInt(dayRes.rows[0].interested, 10) || 0,
          appointments: parseInt(dayRes.rows[0].appointments, 10) || 0,
        });
      }

      res.json({
        total_leads,
        completed_leads,
        remaining_leads,
        conversion_rate,
        appointments_set,
        active_callers_count: active_callers.filter((ac) => ac.status !== 'Offline').length,
        top_performers,
        active_callers,
        call_volume_series,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/dashboard/team-leader', async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;
      const orgId = user.orgId || user.org_id || 'org_default';

      await cleanExpiredReservations(orgId);

      const callers = await db.select().from(schema.users).where(and(eq(schema.users.orgId, orgId), eq(schema.users.role, 'caller')));
      const now = Date.now();
      const todayStr = new Date().toISOString().split('T')[0];

      const roster: any[] = [];
      for (const c of callers) {
        const lastActiveMs = new Date(c.lastActiveAt || '').getTime();
        const idleMinutes = Math.floor((now - lastActiveMs) / 60000);

        const activeRes = await pool.query(
          `SELECT l.id as lead_id, l.reserved_at, b.name as biz_name, b.phone, b.industry
           FROM leads l JOIN businesses b ON l.business_id = b.id
           WHERE l.assigned_caller_id = $1 AND l.status = 'reserved' LIMIT 1`,
          [c.id]
        );
        const activeRow = activeRes.rows[0];

        const todayLogsRes = await pool.query(
          `SELECT COUNT(*) as calls_count,
                  COUNT(CASE WHEN call_outcome LIKE '%Interested%' THEN 1 END) as interested_count,
                  COUNT(CASE WHEN call_outcome = 'Interested (appointment set)' THEN 1 END) as appt_count
           FROM call_logs WHERE caller_id = $1 AND created_at::text LIKE $2`,
          [c.id, `${todayStr}%`]
        );
        const statsRow = todayLogsRes.rows[0];

        let status: 'In Call' | 'Idle' | 'Offline' = 'Offline';
        if (c.active) {
          if (activeRow) status = 'In Call';
          else if (idleMinutes < 15) status = 'Idle';
          else status = 'Offline';
        }

        roster.push({
          id: c.id,
          name: c.name,
          email: c.email,
          active: c.active,
          status,
          calls_today: parseInt(statsRow.calls_count, 10) || 0,
          interested_today: parseInt(statsRow.interested_count, 10) || 0,
          appointments_today: parseInt(statsRow.appt_count, 10) || 0,
          idle_minutes: idleMinutes,
          is_idle_alert: idleMinutes >= 15 && c.active,
          current_lead: activeRow ? {
            id: activeRow.lead_id,
            business_name: activeRow.biz_name,
            phone: activeRow.phone,
            industry: activeRow.industry,
            reserved_at: activeRow.reserved_at,
          } : undefined,
        });
      }

      const remRes = await pool.query(`SELECT COUNT(*) FROM leads WHERE org_id = $1 AND status = 'unassigned'`, [orgId]);
      const totalCallsRes = await pool.query(`SELECT COUNT(*) FROM call_logs WHERE org_id = $1 AND created_at::text LIKE $2`, [orgId, `${todayStr}%`]);

      res.json({
        roster,
        remaining_queue_leads: parseInt(remRes.rows[0].count, 10) || 0,
        total_calls_today: parseInt(totalCallsRes.rows[0].count, 10) || 0,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Call Logs
  app.get('/api/call-logs', async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;

      const orgId = user.orgId || user.org_id || 'org_default';
      const { caller_id } = req.query;

      let query = `
        SELECT cl.*, b.name as business_name, b.phone as business_phone
        FROM call_logs cl
        LEFT JOIN businesses b ON cl.business_id = b.id
        WHERE cl.org_id = $1
      `;
      const params: any[] = [orgId];

      if (user.role === 'caller') {
        // Strictly restrict callers to only their own call history
        query += ` AND cl.caller_id = $2`;
        params.push(user.id);
      } else if (caller_id && typeof caller_id === 'string' && caller_id !== 'ALL') {
        query += ` AND cl.caller_id = $2`;
        params.push(caller_id);
      }

      query += ` ORDER BY cl.created_at DESC`;

      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/call-logs/:id', async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;

      const { id } = req.params;
      const { who_answered, call_outcome, pitch_given, objection_reason, has_followup, followup_at, followup_method, notes } = req.body;
      const orgId = user.orgId || user.org_id || 'org_default';

      const updates: any = {};
      if (who_answered !== undefined) updates.whoAnswered = who_answered;
      if (call_outcome !== undefined) updates.callOutcome = call_outcome;
      if (pitch_given !== undefined) updates.pitchGiven = pitch_given;
      if (objection_reason !== undefined) updates.objectionReason = objection_reason;
      if (has_followup !== undefined) updates.hasFollowup = Boolean(has_followup);
      if (followup_at !== undefined) updates.followupAt = followup_at;
      if (followup_method !== undefined) updates.followupMethod = followup_method;
      if (notes !== undefined) updates.notes = notes;

      await db.update(schema.callLogs).set(updates).where(and(eq(schema.callLogs.id, id), eq(schema.callLogs.orgId, orgId)));

      if (has_followup && followup_at) {
        const fupRes = await db.select().from(schema.followUps).where(eq(schema.followUps.callLogId, id));
        if (fupRes.length > 0) {
          await db.update(schema.followUps).set({
            scheduledAt: followup_at,
            method: followup_method || 'Call',
            notes: notes || '',
          }).where(eq(schema.followUps.callLogId, id));
        }
      }

      const updated = await db.select().from(schema.callLogs).where(eq(schema.callLogs.id, id));
      res.json(updated[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Audit Logs
  app.get('/api/audit-logs', async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;
      if (user.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can view audit logs.' });
      }

      const orgId = user.orgId || user.org_id || 'org_default';
      const logs = await db.select().from(schema.auditLogs).where(eq(schema.auditLogs.orgId, orgId)).orderBy(desc(schema.auditLogs.timestamp));
      res.json(logs.map((l) => ({
        id: l.id,
        org_id: l.orgId,
        user_id: l.userId,
        user_name: l.userName,
        action: l.action,
        target_type: l.targetType,
        target_id: l.targetId,
        details: l.details,
        timestamp: l.timestamp,
      })));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Settings
  app.get('/api/settings', async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;
      const orgId = user.orgId || user.org_id || 'org_default';
      const setRes = await db.select().from(schema.settings).where(eq(schema.settings.orgId, orgId));
      if (setRes.length > 0) {
        res.json({ org_id: orgId, reservation_timeout_minutes: setRes[0].reservationTimeoutMinutes || 10 });
      } else {
        res.json({ org_id: orgId, reservation_timeout_minutes: 10 });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/settings', async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;
      if (user.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can update settings.' });
      }

      const { reservation_timeout_minutes } = req.body;
      const orgId = user.orgId || user.org_id || 'org_default';

      if (typeof reservation_timeout_minutes === 'number' && reservation_timeout_minutes > 0) {
        await db.insert(schema.settings).values({
          orgId,
          reservationTimeoutMinutes: reservation_timeout_minutes,
        }).onConflictDoUpdate({
          target: schema.settings.orgId,
          set: { reservationTimeoutMinutes: reservation_timeout_minutes },
        });

        await db.insert(schema.auditLogs).values({
          id: `aud_${Date.now()}`,
          orgId,
          userId: user.id,
          userName: user.name,
          action: 'SETTINGS_UPDATED',
          targetType: 'settings',
          details: `Updated reservation timeout to ${reservation_timeout_minutes} minutes in Cloud SQL.`,
          timestamp: new Date().toISOString(),
        });
      }

      res.json({ org_id: orgId, reservation_timeout_minutes });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Full Database Export Endpoint (For migrating Cloud SQL production data)
  app.get('/api/admin/export-database', async (req, res) => {
    try {
      const allUsers = await pool.query('SELECT * FROM users ORDER BY created_at ASC');
      const allIndustries = await pool.query('SELECT * FROM industries');
      const allBatches = await pool.query('SELECT * FROM imported_batches ORDER BY created_at ASC');
      const allBusinesses = await pool.query('SELECT * FROM businesses ORDER BY created_at ASC');
      const allLeads = await pool.query('SELECT * FROM leads ORDER BY created_at ASC');
      const allCallLogs = await pool.query('SELECT * FROM call_logs ORDER BY created_at ASC');
      const allFollowUps = await pool.query('SELECT * FROM follow_ups ORDER BY created_at ASC');
      const allAuditLogs = await pool.query('SELECT * FROM audit_logs ORDER BY timestamp ASC');
      const allSettings = await pool.query('SELECT * FROM settings');

      const backupData = {
        exported_at: new Date().toISOString(),
        users: allUsers.rows,
        industries: allIndustries.rows,
        imported_batches: allBatches.rows,
        businesses: allBusinesses.rows,
        leads: allLeads.rows,
        call_logs: allCallLogs.rows,
        follow_ups: allFollowUps.rows,
        audit_logs: allAuditLogs.rows,
        settings: allSettings.rows,
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=production_crm_backup.json');
      res.send(JSON.stringify(backupData, null, 2));
    } catch (err: any) {
      console.error('Error exporting database:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Concurrency Tester Tool Endpoint
  app.post('/api/test/concurrency-reserve', async (req, res) => {
    const client = await pool.connect();
    try {
      const { callerId, callerName } = req.body;
      const orgId = 'org_default';
      const nowIso = new Date().toISOString();

      await client.query('BEGIN');

      const unassignedRes = await client.query(
        `SELECT l.id, l.business_id, b.name as biz_name
         FROM leads l
         LEFT JOIN businesses b ON l.business_id = b.id
         WHERE l.org_id = $1 AND l.status = 'unassigned'
         ORDER BY l.created_at ASC
         LIMIT 1
         FOR UPDATE SKIP LOCKED`,
        [orgId]
      );

      if (unassignedRes.rows.length === 0) {
        await client.query('COMMIT');
        client.release();
        return res.json({ lead: null, message: 'No unassigned leads available in queue.' });
      }

      const lead = unassignedRes.rows[0];

      await client.query(
        `UPDATE leads SET status = 'reserved', assigned_caller_id = $1, assigned_caller_name = $2, reserved_at = $3 WHERE id = $4`,
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

export async function startServer() {
  const app = createApp();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Mount Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

// Only auto-listen if not running as a Vercel serverless function
if (!process.env.VERCEL) {
  startServer();
}
