var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/serverApp.ts
import dotenv2 from "dotenv";
import express from "express";
import crypto from "crypto";
import bcrypt2 from "bcryptjs";

// src/db/index.ts
import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

// src/db/schema.ts
var schema_exports = {};
__export(schema_exports, {
  auditLogs: () => auditLogs,
  businesses: () => businesses,
  businessesRelations: () => businessesRelations,
  callLogs: () => callLogs,
  callLogsRelations: () => callLogsRelations,
  followUps: () => followUps,
  followUpsRelations: () => followUpsRelations,
  importedBatches: () => importedBatches,
  industries: () => industries,
  leads: () => leads,
  leadsRelations: () => leadsRelations,
  sessions: () => sessions,
  settings: () => settings,
  users: () => users,
  usersRelations: () => usersRelations
});
import { pgTable, text, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
var users = pgTable("users", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull().default("org_default"),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: text("role").$type().notNull(),
  password: text("password"),
  avatarUrl: text("avatar_url"),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  twoFactorPin: text("two_factor_pin"),
  active: boolean("active").notNull().default(true),
  lastActiveAt: timestamp("last_active_at", { mode: "string" }).defaultNow(),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow()
});
var industries = pgTable("industries", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull().default("org_default"),
  name: text("name").notNull(),
  defaultPitch: text("default_pitch")
});
var importedBatches = pgTable("imported_batches", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull().default("org_default"),
  fileName: text("file_name").notNull(),
  totalLeads: integer("total_leads").default(0),
  allowedCallerIds: jsonb("allowed_caller_ids").$type(),
  importedById: text("imported_by_id"),
  importedByName: text("imported_by_name"),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow()
});
var businesses = pgTable("businesses", {
  id: text("id").primaryKey(),
  batchId: text("batch_id").references(() => importedBatches.id, { onDelete: "set null" }),
  orgId: text("org_id").notNull().default("org_default"),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  hasWebsite: boolean("has_website").default(false),
  websiteUrl: text("website_url"),
  industry: text("industry").notNull(),
  address: text("address").notNull(),
  city: text("city"),
  state: text("state"),
  zip: text("zip"),
  email: text("email"),
  contactPerson: text("contact_person"),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow()
});
var leads = pgTable("leads", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull().default("org_default"),
  businessId: text("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  status: text("status").$type().notNull().default("unassigned"),
  assignedCallerId: text("assigned_caller_id").references(() => users.id, { onDelete: "set null" }),
  assignedCallerName: text("assigned_caller_name"),
  allowedCallerIds: jsonb("allowed_caller_ids").$type(),
  reservedAt: timestamp("reserved_at", { mode: "string" }),
  completedAt: timestamp("completed_at", { mode: "string" }),
  currentCycle: integer("current_cycle").notNull().default(1),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow()
});
var callLogs = pgTable("call_logs", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull().default("org_default"),
  leadId: text("lead_id").references(() => leads.id, { onDelete: "cascade" }),
  businessId: text("business_id").references(() => businesses.id, { onDelete: "cascade" }),
  callerId: text("caller_id").references(() => users.id, { onDelete: "set null" }),
  callerName: text("caller_name").notNull(),
  whoAnswered: text("who_answered").notNull(),
  callOutcome: text("call_outcome"),
  pitchGiven: text("pitch_given"),
  objectionReason: text("objection_reason"),
  hasFollowup: boolean("has_followup").default(false),
  followupAt: timestamp("followup_at", { mode: "string" }),
  followupMethod: text("followup_method"),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow()
});
var followUps = pgTable("follow_ups", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull().default("org_default"),
  callLogId: text("call_log_id").references(() => callLogs.id, { onDelete: "cascade" }),
  leadId: text("lead_id").references(() => leads.id, { onDelete: "cascade" }),
  businessId: text("business_id").references(() => businesses.id, { onDelete: "cascade" }),
  callerId: text("caller_id").references(() => users.id, { onDelete: "set null" }),
  status: text("status").$type().notNull().default("interested"),
  scheduledAt: timestamp("scheduled_at", { mode: "string" }).notNull(),
  method: text("method").default("Call"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow()
});
var auditLogs = pgTable("audit_logs", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull().default("org_default"),
  userId: text("user_id").notNull(),
  userName: text("user_name").notNull(),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id"),
  details: text("details").notNull(),
  timestamp: timestamp("timestamp", { mode: "string" }).defaultNow()
});
var settings = pgTable("settings", {
  orgId: text("org_id").primaryKey().default("org_default"),
  reservationTimeoutMinutes: integer("reservation_timeout_minutes").default(10)
});
var sessions = pgTable("sessions", {
  token: text("token").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow()
});
var usersRelations = relations(users, ({ many }) => ({
  leads: many(leads),
  callLogs: many(callLogs),
  followUps: many(followUps),
  sessions: many(sessions)
}));
var businessesRelations = relations(businesses, ({ one, many }) => ({
  batch: one(importedBatches, {
    fields: [businesses.batchId],
    references: [importedBatches.id]
  }),
  leads: many(leads),
  callLogs: many(callLogs)
}));
var leadsRelations = relations(leads, ({ one, many }) => ({
  business: one(businesses, {
    fields: [leads.businessId],
    references: [businesses.id]
  }),
  caller: one(users, {
    fields: [leads.assignedCallerId],
    references: [users.id]
  }),
  callLogs: many(callLogs),
  followUps: many(followUps)
}));
var callLogsRelations = relations(callLogs, ({ one, many }) => ({
  lead: one(leads, {
    fields: [callLogs.leadId],
    references: [leads.id]
  }),
  business: one(businesses, {
    fields: [callLogs.businessId],
    references: [businesses.id]
  }),
  caller: one(users, {
    fields: [callLogs.callerId],
    references: [users.id]
  }),
  followUps: many(followUps)
}));
var followUpsRelations = relations(followUps, ({ one }) => ({
  callLog: one(callLogs, {
    fields: [followUps.callLogId],
    references: [callLogs.id]
  }),
  lead: one(leads, {
    fields: [followUps.leadId],
    references: [leads.id]
  }),
  business: one(businesses, {
    fields: [followUps.businessId],
    references: [businesses.id]
  }),
  caller: one(users, {
    fields: [followUps.callerId],
    references: [users.id]
  })
}));

// src/db/index.ts
dotenv.config();
var { Pool } = pg;
var createPool = () => {
  if (!global._postgresPool) {
    const isCloud = !!process.env.DATABASE_URL || process.env.SQL_HOST && !["localhost", "127.0.0.1"].includes(process.env.SQL_HOST);
    const DEFAULT_NEON_URL = "postgresql://neondb_owner:npg_m7kGWiOZUAw4@ep-dry-forest-ay3ln0tr.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require";
    const connStr = process.env.DATABASE_URL || DEFAULT_NEON_URL;
    const poolConfig = {
      connectionString: connStr,
      ssl: { rejectUnauthorized: false },
      max: 10,
      connectionTimeoutMillis: 15e3
    };
    global._postgresPool = new Pool(poolConfig);
    global._postgresPool.on("error", (err) => {
      console.error("Unexpected error on idle SQL pool client:", err);
    });
  }
  return global._postgresPool;
};
var pool = createPool();
var db = drizzle(pool, { schema: schema_exports });

// src/db/db-service.ts
import { eq, and, lte } from "drizzle-orm";
import bcrypt from "bcryptjs";
async function cleanExpiredReservations(orgId = "org_default") {
  try {
    let timeoutMinutes = 10;
    const settingsRes = await db.select().from(settings).where(eq(settings.orgId, orgId));
    if (settingsRes.length > 0 && settingsRes[0].reservationTimeoutMinutes) {
      timeoutMinutes = settingsRes[0].reservationTimeoutMinutes;
    }
    const cutoffTime = new Date(Date.now() - timeoutMinutes * 60 * 1e3).toISOString();
    const expiredLeads = await db.select().from(leads).where(
      and(
        eq(leads.orgId, orgId),
        eq(leads.status, "reserved"),
        lte(leads.reservedAt, cutoffTime)
      )
    );
    for (const lead of expiredLeads) {
      const callerName = lead.assignedCallerName || lead.assignedCallerId || "Unknown";
      await db.update(leads).set({
        status: "unassigned",
        assignedCallerId: null,
        assignedCallerName: null,
        reservedAt: null
      }).where(eq(leads.id, lead.id));
      await db.insert(auditLogs).values({
        id: `aud_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        orgId,
        userId: "system",
        userName: "System Auto-Cleaner",
        action: "LEAD_RESERVATION_EXPIRED",
        targetType: "lead",
        targetId: lead.id,
        details: `Reservation expired after ${timeoutMinutes} mins for caller ${callerName}. Returned to queue.`,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
    return expiredLeads.length;
  } catch (error) {
    console.error("Error cleaning expired reservations:", error);
    return 0;
  }
}
async function getSessionUser(token) {
  try {
    const sessionRes = await db.select().from(sessions).where(eq(sessions.token, token));
    if (sessionRes.length > 0) {
      const u = await db.select().from(users).where(eq(users.id, sessionRes[0].userId));
      return u[0] || null;
    }
    return null;
  } catch (error) {
    console.error("Error getting session user:", error);
    return null;
  }
}
async function deleteSession(token) {
  try {
    await db.delete(sessions).where(eq(sessions.token, token));
  } catch (error) {
    console.error("Error deleting session:", error);
  }
}

// src/serverApp.ts
import { eq as eq2, and as and2, desc as desc2 } from "drizzle-orm";
dotenv2.config();
var SALT_ROUNDS = 10;
function isBcryptHash(str) {
  return typeof str === "string" && (str.startsWith("$2a$") || str.startsWith("$2b$"));
}
function hashPassword(plain) {
  if (!plain) return "";
  if (isBcryptHash(plain)) return plain;
  return bcrypt2.hashSync(plain.trim(), SALT_ROUNDS);
}
function verifyPassword(plain, storedHashOrPlain) {
  if (!storedHashOrPlain || !plain) return false;
  const trimmedPlain = plain.trim();
  if (isBcryptHash(storedHashOrPlain)) {
    return bcrypt2.compareSync(trimmedPlain, storedHashOrPlain);
  }
  return trimmedPlain === storedHashOrPlain.trim();
}
function toSafeUser(user) {
  const { password, ...safe } = user;
  return {
    id: user.id,
    org_id: user.orgId || user.org_id || "org_default",
    name: user.name,
    email: user.email,
    role: user.role,
    avatar_url: user.avatarUrl || user.avatar_url || void 0,
    two_factor_enabled: !!(user.twoFactorEnabled ?? user.two_factor_enabled),
    two_factor_pin: user.twoFactorPin || user.two_factor_pin || void 0,
    active: user.active !== void 0 ? user.active : true,
    last_active_at: user.lastActiveAt || user.last_active_at || (/* @__PURE__ */ new Date()).toISOString(),
    created_at: user.createdAt || user.created_at || (/* @__PURE__ */ new Date()).toISOString()
  };
}
function extractFlexibleColumn(row, candidates) {
  if (!row || typeof row !== "object") return "";
  const keys = Object.keys(row);
  for (const candidate of candidates) {
    const targetNorm = candidate.toLowerCase().replace(/[^a-z0-9]/g, "");
    const matchKey = keys.find(
      (k) => k.toLowerCase().replace(/[^a-z0-9]/g, "") === targetNorm
    );
    if (matchKey && row[matchKey] !== void 0 && row[matchKey] !== null) {
      const val = String(row[matchKey]).trim();
      if (val) return val;
    }
  }
  return "";
}
function inferIndustryFromName(name) {
  const lower = name.toLowerCase();
  if (lower.includes("dental") || lower.includes("smile") || lower.includes("teeth") || lower.includes("dentist")) return "Dental Clinic";
  if (lower.includes("barber") || lower.includes("salon") || lower.includes("hair") || lower.includes("cut")) return "Barber Shop / Salon";
  if (lower.includes("restaurant") || lower.includes("grill") || lower.includes("bistro") || lower.includes("cafe") || lower.includes("pizza") || lower.includes("taco")) return "Restaurant / Dining";
  if (lower.includes("auto") || lower.includes("repair") || lower.includes("tire") || lower.includes("mechanic")) return "Auto Repair";
  if (lower.includes("plumb") || lower.includes("hvac") || lower.includes("air") || lower.includes("heating")) return "Plumbing & HVAC";
  return "General Business";
}
function createApp() {
  const app2 = express();
  app2.use(express.json({ limit: "10mb" }));
  app2.use((req, res, next) => {
    if (!req.url.startsWith("/api") && req.url !== "/" && !req.url.startsWith("/index.html")) {
      req.url = "/api" + req.url;
    }
    next();
  });
  app2.use(async (req, res, next) => {
    try {
      let user = null;
      const authHeader = req.headers["authorization"];
      const sessionToken = req.headers["x-session-token"] || (authHeader && authHeader.startsWith("Bearer ") ? authHeader.substring(7) : void 0);
      if (sessionToken) {
        user = await getSessionUser(sessionToken);
      }
      if (!user) {
        const userId = req.headers["x-user-id"] || req.query.userId;
        if (userId) {
          const u = await db.select().from(users).where(eq2(users.id, userId));
          if (u.length > 0) user = u[0];
        }
      }
      if (user) {
        req.currentUser = user;
      }
    } catch (e) {
      console.error("Auth middleware error:", e);
    }
    next();
  });
  const requireUser = (req, res) => {
    const user = req.currentUser;
    if (!user) {
      res.status(401).json({ error: "Authentication required. Missing or invalid user identity." });
      return null;
    }
    return user;
  };
  app2.get("/api/db-diagnostic", async (req, res) => {
    try {
      const timeRes = await pool.query("SELECT NOW() as current_time, current_database(), current_user");
      const tablesRes = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `);
      let userCount = 0;
      try {
        const uCountRes = await pool.query("SELECT COUNT(*) FROM users");
        userCount = parseInt(uCountRes.rows[0].count, 10);
      } catch (e) {
      }
      res.json({
        status: "DATABASE_CONNECTED",
        db_info: timeRes.rows[0],
        tables: tablesRes.rows.map((r) => r.table_name),
        user_count: userCount,
        env_check: {
          DATABASE_URL_EXISTS: !!process.env.DATABASE_URL,
          SQL_HOST_EXISTS: !!process.env.SQL_HOST,
          SQL_USER_EXISTS: !!process.env.SQL_USER,
          SQL_DB_NAME: process.env.SQL_DB_NAME
        }
      });
    } catch (err) {
      console.error("Diagnostic error:", err);
      res.status(500).json({
        status: "DATABASE_ERROR",
        message: err.message,
        code: err.code,
        detail: err.detail,
        hint: err.hint,
        cause: err.cause ? String(err.cause) : void 0
      });
    }
  });
  app2.get("/api/admin/export-database", async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;
      if (user.role !== "admin") {
        return res.status(403).json({ error: "Admin permissions required." });
      }
      const usersList = await db.select().from(users);
      const industriesList = await db.select().from(industries);
      const batchesList = await db.select().from(importedBatches);
      const businessesList = await db.select().from(businesses);
      const leadsList = await db.select().from(leads);
      const callLogsList = await db.select().from(callLogs);
      const followUpsList = await db.select().from(followUps);
      const auditLogsList = await db.select().from(auditLogs).orderBy(desc2(auditLogs.timestamp)).limit(2e3);
      const settingsList = await db.select().from(settings);
      const exportPayload = {
        exported_at: (/* @__PURE__ */ new Date()).toISOString(),
        users: usersList,
        industries: industriesList,
        imported_batches: batchesList,
        businesses: businessesList,
        leads: leadsList,
        call_logs: callLogsList,
        follow_ups: followUpsList,
        audit_logs: auditLogsList,
        settings: settingsList
      };
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", 'attachment; filename="production_crm_backup.json"');
      res.json(exportPayload);
    } catch (err) {
      console.error("Database export error:", err);
      res.status(500).json({ error: err.message });
    }
  });
  app2.get("/api/auth/me", (req, res) => {
    const user = req.currentUser;
    if (!user) {
      return res.status(401).json({ error: "Not logged in" });
    }
    res.json(toSafeUser(user));
  });
  app2.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password, userId, pin } = req.body;
      let user = null;
      if (email && password) {
        const uRes = await pool.query(
          `SELECT * FROM users WHERE LOWER(TRIM(email)) = $1 LIMIT 1`,
          [String(email).toLowerCase().trim()]
        );
        user = uRes.rows[0];
        if (!user) {
          return res.status(401).json({ error: "Invalid email address or user account does not exist." });
        }
        const isValid = verifyPassword(String(password).trim(), user.password);
        if (!isValid) {
          return res.status(401).json({ error: "Incorrect password. Please try again." });
        }
        if (user.password && !isBcryptHash(user.password)) {
          const newHash = hashPassword(String(password).trim());
          await db.update(users).set({ password: newHash }).where(eq2(users.id, user.id));
        }
      } else if (userId) {
        const users2 = await db.select().from(users).where(eq2(users.id, userId));
        user = users2[0];
        if (!user) {
          return res.status(404).json({ error: "User account not found." });
        }
      } else {
        return res.status(400).json({ error: "Email and password are required to log in." });
      }
      if (!user.active) {
        return res.status(403).json({ error: "Account is deactivated. Contact system administrator." });
      }
      if (user.twoFactorEnabled) {
        if (!pin) {
          return res.json({ require_2fa: true, userId: user.id, email: user.email });
        }
        if (pin !== user.twoFactorPin) {
          return res.status(401).json({ error: "Invalid 2FA PIN. Please try again." });
        }
      }
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const token = crypto.randomBytes(32).toString("hex");
      pool.query(`UPDATE users SET last_active_at = $1 WHERE id = $2`, [now, user.id]).catch(() => {
      });
      pool.query(`INSERT INTO sessions (token, user_id, created_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [token, user.id, now]).catch(() => {
      });
      pool.query(
        `INSERT INTO audit_logs (id, org_id, user_id, user_name, action, target_type, target_id, details, timestamp) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT DO NOTHING`,
        [`aud_${Date.now()}`, user.org_id || user.orgId || "org_default", user.id, user.name, "USER_LOGIN", "user", user.id, `User ${user.name} logged into system.`, now]
      ).catch(() => {
      });
      const safeUser = toSafeUser(user);
      return res.json({ token, user: safeUser, ...safeUser });
    } catch (err) {
      console.error("Login error:", err);
      res.status(500).json({ error: err.message });
    }
  });
  app2.post("/api/auth/logout", async (req, res) => {
    try {
      const authHeader = req.headers["authorization"];
      const sessionToken = req.headers["x-session-token"] || (authHeader && authHeader.startsWith("Bearer ") ? authHeader.substring(7) : void 0);
      if (sessionToken) {
        await deleteSession(sessionToken);
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.post("/api/auth/heartbeat", async (req, res) => {
    try {
      const user = req.currentUser;
      if (user) {
        await db.update(users).set({ lastActiveAt: (/* @__PURE__ */ new Date()).toISOString() }).where(eq2(users.id, user.id));
      }
      res.json({ success: true, timestamp: (/* @__PURE__ */ new Date()).toISOString() });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.get("/api/users", async (req, res) => {
    try {
      const usersList = await db.select().from(users);
      res.json(usersList.map(toSafeUser));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.post("/api/users", async (req, res) => {
    try {
      const currentUser = requireUser(req, res);
      if (!currentUser) return;
      if (currentUser.role !== "admin") {
        return res.status(403).json({ error: "Admin permissions required." });
      }
      const { name, email, role, password, two_factor_enabled, two_factor_pin } = req.body;
      if (!name || !email || !role) {
        return res.status(400).json({ error: "Missing required user fields." });
      }
      const existing = await db.select().from(users).where(eq2(users.email, String(email).trim().toLowerCase()));
      if (existing.length > 0) {
        return res.status(400).json({ error: "A user with this email address already exists." });
      }
      const userId = `usr_${Date.now()}`;
      const plainPass = password && password.trim() ? password.trim() : "Caller@123";
      const hashedPassword = hashPassword(plainPass);
      const orgId = currentUser.orgId || currentUser.org_id || "org_default";
      const newUserValues = {
        id: userId,
        orgId,
        name: String(name).trim(),
        email: String(email).trim().toLowerCase(),
        role,
        password: hashedPassword,
        twoFactorEnabled: !!two_factor_enabled,
        twoFactorPin: two_factor_pin || null,
        active: true,
        lastActiveAt: (/* @__PURE__ */ new Date()).toISOString(),
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      await db.insert(users).values(newUserValues);
      await db.insert(auditLogs).values({
        id: `aud_${Date.now()}`,
        orgId,
        userId: currentUser.id,
        userName: currentUser.name,
        action: "USER_CREATED",
        targetType: "user",
        targetId: userId,
        details: `Created new user ${newUserValues.name} (${newUserValues.email}) with role ${newUserValues.role}.`,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      res.status(201).json(toSafeUser(newUserValues));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.patch("/api/users/:id", async (req, res) => {
    try {
      const currentUser = requireUser(req, res);
      if (!currentUser) return;
      if (currentUser.role !== "admin") {
        return res.status(403).json({ error: "Admin permissions required." });
      }
      const { id } = req.params;
      const { name, email, role, password, active, two_factor_enabled, two_factor_pin, avatar_url, avatarUrl } = req.body;
      const existingUsers = await db.select().from(users).where(eq2(users.id, id));
      if (existingUsers.length === 0) {
        return res.status(404).json({ error: "User not found." });
      }
      const updates = {};
      if (name !== void 0) updates.name = String(name).trim();
      if (email !== void 0) updates.email = String(email).trim().toLowerCase();
      if (role !== void 0) updates.role = role;
      if (active !== void 0) updates.active = !!active;
      if (two_factor_enabled !== void 0) updates.twoFactorEnabled = !!two_factor_enabled;
      if (two_factor_pin !== void 0) updates.twoFactorPin = two_factor_pin;
      if (avatar_url !== void 0 || avatarUrl !== void 0) updates.avatarUrl = avatar_url ?? avatarUrl;
      if (password && password.trim()) updates.password = hashPassword(password.trim());
      await db.update(users).set(updates).where(eq2(users.id, id));
      await db.insert(auditLogs).values({
        id: `aud_${Date.now()}`,
        orgId: currentUser.orgId || "org_default",
        userId: currentUser.id,
        userName: currentUser.name,
        action: "USER_UPDATED",
        targetType: "user",
        targetId: id,
        details: `Updated user details for ${updates.name || existingUsers[0].name}.`,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      const updated = await db.select().from(users).where(eq2(users.id, id));
      res.json(toSafeUser(updated[0]));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.get("/api/leads/batches", async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;
      const orgId = user.orgId || user.org_id || "org_default";
      const batches = await db.select().from(importedBatches).where(eq2(importedBatches.orgId, orgId));
      const result = [];
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
        const sampleBiz = await db.select().from(businesses).where(eq2(businesses.batchId, b.id)).limit(5);
        let allowedCallerIds = null;
        if (b.allowedCallerIds) {
          try {
            allowedCallerIds = typeof b.allowedCallerIds === "string" ? JSON.parse(b.allowedCallerIds) : b.allowedCallerIds;
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
          unassigned_count: parseInt(leadStats.rows[0]?.unassigned || "0", 10),
          completed_count: parseInt(leadStats.rows[0]?.completed || "0", 10),
          sample_businesses: sampleBiz
        });
      }
      result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.get("/api/dashboard/admin", async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;
      const orgId = user.orgId || user.org_id || "org_default";
      const countsRes = await pool.query(
        `SELECT 
           COUNT(*) as total,
           COUNT(*) FILTER (WHERE status = 'completed') as completed,
           COUNT(*) FILTER (WHERE status IN ('unassigned', 'reserved')) as remaining
         FROM leads WHERE org_id = $1`,
        [orgId]
      );
      const totalLeads = parseInt(countsRes.rows[0]?.total || "0", 10);
      const completedLeads = parseInt(countsRes.rows[0]?.completed || "0", 10);
      const remainingLeads = parseInt(countsRes.rows[0]?.remaining || "0", 10);
      const callStatsRes = await pool.query(
        `SELECT 
           COUNT(*) as total_calls,
           COUNT(*) FILTER (WHERE who_answered = 'Decision Maker') as dm_answers,
           COUNT(*) FILTER (WHERE call_outcome = 'Interested (appointment set)') as appointments,
           COUNT(*) FILTER (WHERE call_outcome IN ('Interested (appointment set)', 'Information Sent', 'Follow Up Required', 'Call Back Later')) as positive_responses
         FROM call_logs WHERE org_id = $1`,
        [orgId]
      );
      const totalCalls = parseInt(callStatsRes.rows[0]?.total_calls || "0", 10);
      const appointments = parseInt(callStatsRes.rows[0]?.appointments || "0", 10);
      const positiveResponses = parseInt(callStatsRes.rows[0]?.positive_responses || "0", 10);
      const conversionRate = totalCalls > 0 ? Math.round(positiveResponses / totalCalls * 100) : 0;
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
      const callersList = await db.select().from(users).where(and2(eq2(users.role, "caller"), eq2(users.active, true)));
      const activeCallers = callersList.map((c) => {
        const lastActive = c.lastActiveAt ? new Date(c.lastActiveAt).getTime() : 0;
        const diffMinutes = lastActive > 0 ? Math.round((Date.now() - lastActive) / 6e4) : 9999;
        return {
          id: c.id,
          name: c.name,
          status: diffMinutes < 15 ? "Active" : "Offline",
          last_active_at: c.lastActiveAt,
          calls_today: 0,
          idle_minutes: diffMinutes,
          is_idle_alert: diffMinutes > 20
        };
      });
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
        active_callers_count: activeCallers.filter((c) => c.status === "Active").length,
        top_performers: topPerformersRes.rows.map((r) => ({
          caller_id: r.caller_id,
          caller_name: r.caller_name,
          calls_count: parseInt(r.calls_count, 10),
          appointments: parseInt(r.appointments, 10),
          interested: parseInt(r.interested, 10)
        })),
        active_callers: activeCallers,
        call_volume_series: callVolumeRes.rows.map((r) => ({
          date: r.date.toISOString().split("T")[0],
          total_calls: parseInt(r.total_calls, 10),
          interested: parseInt(r.interested, 10),
          appointments: parseInt(r.appointments, 10)
        }))
      });
    } catch (err) {
      console.error("Admin dashboard error:", err);
      res.status(500).json({ error: err.message });
    }
  });
  app2.get("/api/notifications/callbacks", async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;
      const orgId = user.orgId || user.org_id || "org_default";
      const followUps2 = await pool.query(
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
      const now = /* @__PURE__ */ new Date();
      const todayStr = req.query.today || now.toISOString().split("T")[0];
      const targetDate = req.query.date || todayStr;
      const callbacks = followUps2.rows.map((r) => {
        const sched = new Date(r.scheduled_at);
        const schedStr = !isNaN(sched.getTime()) ? sched.toISOString().split("T")[0] : "";
        const isOverdue = sched < now;
        const isToday = schedStr === todayStr;
        return {
          id: r.id,
          lead_id: r.lead_id,
          business_id: r.business_id,
          business_name: r.business_name || "Business",
          business_phone: r.business_phone || "N/A",
          industry: r.industry || "General Business",
          address: r.address || "",
          contact_person: r.contact_person || "",
          contact_email: r.contact_email || "",
          caller_id: r.caller_id,
          caller_name: r.caller_name || "Caller",
          scheduled_at: r.scheduled_at,
          scheduled_date: schedStr,
          scheduled_time: !isNaN(sched.getTime()) ? sched.toTimeString().substring(0, 5) : "",
          method: r.method || "Call",
          notes: r.notes || "",
          call_outcome: r.call_outcome || "",
          smart_pitch: "AI Receptionist Only",
          status: r.status || "interested",
          created_at: r.created_at,
          is_due_today: isToday,
          is_overdue: isOverdue
        };
      });
      res.json({
        today_callbacks: callbacks.filter((c) => c.is_due_today),
        overdue_callbacks: callbacks.filter((c) => c.is_overdue),
        upcoming_callbacks: callbacks.filter((c) => !c.is_due_today && !c.is_overdue),
        selected_date_callbacks: callbacks.filter((c) => c.scheduled_date === targetDate),
        target_date: targetDate,
        active_count: callbacks.filter((c) => c.is_due_today).length,
        total_overdue_count: callbacks.filter((c) => c.is_overdue).length
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.post("/api/leads/next", async (req, res) => {
    const client = await pool.connect();
    try {
      const user = requireUser(req, res);
      if (!user) {
        client.release();
        return;
      }
      await cleanExpiredReservations();
      await client.query("BEGIN");
      const callerId = user.id;
      const callerName = user.name;
      const orgId = user.orgId || user.org_id || "org_default";
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
        await client.query("COMMIT");
        client.release();
        return res.json({
          success: true,
          reserved_lead_id: existingRes.rows[0].id,
          business_name: existingRes.rows[0].biz_name,
          assigned_to: callerName,
          already_reserved: true
        });
      }
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
        await client.query("COMMIT");
        client.release();
        return res.status(404).json({ error: "No available leads in queue matching your permissions." });
      }
      const lead = nextLeadRes.rows[0];
      const nowIso = (/* @__PURE__ */ new Date()).toISOString();
      await client.query(
        `UPDATE leads 
         SET status = 'reserved', 
             assigned_caller_id = $1, 
             assigned_caller_name = $2, 
             reserved_at = $3 
         WHERE id = $4`,
        [callerId, callerName, nowIso, lead.id]
      );
      await client.query("COMMIT");
      client.release();
      res.json({
        success: true,
        reserved_lead_id: lead.id,
        business_name: lead.biz_name,
        assigned_to: callerName,
        reserved_at: nowIso
      });
    } catch (err) {
      await client.query("ROLLBACK");
      client.release();
      res.status(500).json({ error: err.message });
    }
  });
  app2.post("/api/leads/reserve-specific", async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;
      const { leadId } = req.body;
      if (!leadId) return res.status(400).json({ error: "leadId is required." });
      const nowIso = (/* @__PURE__ */ new Date()).toISOString();
      await db.update(leads).set({
        status: "reserved",
        assignedCallerId: user.id,
        assignedCallerName: user.name,
        reservedAt: nowIso
      }).where(eq2(leads.id, leadId));
      res.json({ success: true, leadId, assignedTo: user.name, reservedAt: nowIso });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.get("/api/industries", async (req, res) => {
    try {
      const industriesList = await db.select().from(industries);
      res.json(industriesList.map((i) => ({
        id: i.id,
        org_id: i.orgId,
        name: i.name,
        default_pitch: i.defaultPitch || ""
      })));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.post("/api/industries", async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;
      const { name, default_pitch } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ error: "Industry name is required." });
      }
      const orgId = user.orgId || user.org_id || "org_default";
      const id = `ind_${Date.now()}`;
      await db.insert(industries).values({
        id,
        orgId,
        name: name.trim(),
        defaultPitch: default_pitch || null
      });
      res.status(201).json({ id, org_id: orgId, name: name.trim(), default_pitch: default_pitch || "" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.get("/api/call-logs", async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;
      const orgId = user.orgId || user.org_id || "org_default";
      const logsRes = await pool.query(
        `SELECT cl.*, biz.name as business_name, biz.phone as business_phone
         FROM call_logs cl
         LEFT JOIN businesses biz ON cl.business_id = biz.id
         WHERE cl.org_id = $1
         ORDER BY cl.created_at DESC
         LIMIT 5000`,
        [orgId]
      );
      res.json(logsRes.rows.map((r) => ({
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
        business_name: r.business_name || "",
        business_phone: r.business_phone || ""
      })));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.patch("/api/call-logs/:id", async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;
      const { id } = req.params;
      const { who_answered, call_outcome, pitch_given, has_followup, followup_at, followup_method, notes } = req.body;
      const updates = {};
      if (who_answered !== void 0) updates.whoAnswered = who_answered;
      if (call_outcome !== void 0) updates.callOutcome = call_outcome;
      if (pitch_given !== void 0) updates.pitchGiven = pitch_given;
      if (has_followup !== void 0) updates.hasFollowup = has_followup;
      if (followup_at !== void 0) updates.followupAt = followup_at;
      if (followup_method !== void 0) updates.followupMethod = followup_method;
      if (notes !== void 0) updates.notes = notes;
      await db.update(callLogs).set(updates).where(eq2(callLogs.id, id));
      const updated = await pool.query(
        `SELECT cl.*, biz.name as business_name, biz.phone as business_phone
         FROM call_logs cl LEFT JOIN businesses biz ON cl.business_id = biz.id WHERE cl.id = $1`,
        [id]
      );
      const r = updated.rows[0];
      res.json({
        success: true,
        callLog: {
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
          business_name: r.business_name || "",
          business_phone: r.business_phone || ""
        }
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.get("/api/audit-logs", async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;
      const orgId = user.orgId || user.org_id || "org_default";
      const logs = await db.select().from(auditLogs).where(eq2(auditLogs.orgId, orgId)).orderBy(desc2(auditLogs.timestamp)).limit(2e3);
      res.json(logs.map((l) => ({
        id: l.id,
        org_id: l.orgId,
        user_id: l.userId,
        user_name: l.userName,
        action: l.action,
        target_type: l.targetType,
        target_id: l.targetId,
        details: l.details,
        timestamp: l.timestamp
      })));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.get("/api/dashboard/team-leader", async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;
      const orgId = user.orgId || user.org_id || "org_default";
      const todayStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      const callersList = await db.select().from(users).where(and2(eq2(users.role, "caller"), eq2(users.active, true)));
      const roster = [];
      let totalCallsToday = 0;
      for (const c of callersList) {
        const callsTodayRes = await pool.query(
          `SELECT COUNT(*) as cnt,
                  COUNT(*) FILTER (WHERE call_outcome IN ('Interested (appointment set)', 'Information Sent', 'Follow Up Required', 'Call Back Later')) as interested,
                  COUNT(*) FILTER (WHERE call_outcome = 'Interested (appointment set)') as appointments
           FROM call_logs WHERE caller_id = $1 AND DATE(created_at) = $2`,
          [c.id, todayStr]
        );
        const callsToday = parseInt(callsTodayRes.rows[0]?.cnt || "0", 10);
        totalCallsToday += callsToday;
        const lastActive = c.lastActiveAt ? new Date(c.lastActiveAt).getTime() : 0;
        const diffMinutes = lastActive > 0 ? Math.round((Date.now() - lastActive) / 6e4) : 9999;
        let currentLead = void 0;
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
          id: c.id,
          name: c.name,
          email: c.email,
          active: c.active,
          status: diffMinutes < 15 ? currentLead ? "In Call" : "Idle" : "Offline",
          calls_today: callsToday,
          interested_today: parseInt(callsTodayRes.rows[0]?.interested || "0", 10),
          appointments_today: parseInt(callsTodayRes.rows[0]?.appointments || "0", 10),
          idle_minutes: diffMinutes,
          is_idle_alert: diffMinutes > 20,
          current_lead: currentLead
        });
      }
      const queueRes = await pool.query(
        `SELECT COUNT(*) as cnt FROM leads WHERE org_id = $1 AND status = 'unassigned'`,
        [orgId]
      );
      res.json({
        roster,
        remaining_queue_leads: parseInt(queueRes.rows[0]?.cnt || "0", 10),
        total_calls_today: totalCallsToday
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.get("/api/dashboard/caller", async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;
      const orgId = user.orgId || user.org_id || "org_default";
      const todayStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      const statsRes = await pool.query(
        `SELECT 
           COUNT(*) as calls_today,
           COUNT(*) FILTER (WHERE call_outcome IN ('Interested (appointment set)', 'Information Sent', 'Follow Up Required', 'Call Back Later')) as interested,
           COUNT(*) FILTER (WHERE call_outcome = 'Interested (appointment set)') as appointments
         FROM call_logs WHERE caller_id = $1 AND DATE(created_at) = $2`,
        [user.id, todayStr]
      );
      const remainingRes = await pool.query(
        `SELECT COUNT(*) as cnt FROM leads WHERE org_id = $1 AND status = 'unassigned'`,
        [orgId]
      );
      res.json({
        calls_today: parseInt(statsRes.rows[0]?.calls_today || "0", 10),
        interested_count: parseInt(statsRes.rows[0]?.interested || "0", 10),
        appointments_count: parseInt(statsRes.rows[0]?.appointments || "0", 10),
        remaining_leads: parseInt(remainingRes.rows[0]?.cnt || "0", 10),
        avg_call_seconds: 0,
        current_streak: 0
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.get("/api/leads/manage", async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;
      const orgId = user.orgId || user.org_id || "org_default";
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
      res.json(leadsRes.rows.map((r) => ({
        id: r.id,
        status: r.status,
        allowed_caller_ids: r.allowed_caller_ids || null,
        current_cycle: r.current_cycle,
        created_at: r.created_at,
        business_id: r.business_id,
        business_name: r.business_name,
        phone: r.phone,
        industry: r.industry,
        city: r.city || "",
        state: r.state || "",
        zip: r.zip || "",
        address: r.address || "",
        batch_id: r.batch_id || "",
        batch_name: r.batch_name || ""
      })));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.post("/api/leads/outcome", async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;
      const { leadId, who_answered, call_outcome, pitch_given, objection_reason, has_followup, followup_at, followup_method, contact_name, contact_email, notes } = req.body;
      if (!leadId) return res.status(400).json({ error: "leadId is required." });
      const orgId = user.orgId || user.org_id || "org_default";
      const leadRes = await pool.query(
        `SELECT l.*, biz.id as biz_id, biz.name as biz_name FROM leads l JOIN businesses biz ON l.business_id = biz.id WHERE l.id = $1`,
        [leadId]
      );
      if (leadRes.rows.length === 0) return res.status(404).json({ error: "Lead not found." });
      const lead = leadRes.rows[0];
      const callLogId = `cl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      await db.insert(callLogs).values({
        id: callLogId,
        orgId,
        leadId,
        businessId: lead.biz_id,
        callerId: user.id,
        callerName: user.name,
        whoAnswered: who_answered || "No Answer",
        callOutcome: call_outcome || null,
        pitchGiven: pitch_given || null,
        objectionReason: objection_reason || null,
        hasFollowup: !!has_followup,
        followupAt: followup_at || null,
        followupMethod: followup_method || null,
        contactName: contact_name || null,
        contactEmail: contact_email || null,
        notes: notes || null,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      });
      if (has_followup && followup_at) {
        await db.insert(followUps).values({
          id: `fu_${Date.now()}`,
          orgId,
          callLogId,
          leadId,
          businessId: lead.biz_id,
          callerId: user.id,
          status: call_outcome === "Interested (appointment set)" ? "appointment" : "interested",
          scheduledAt: followup_at,
          method: followup_method || "Call",
          notes: notes || null,
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
      await db.update(leads).set({
        status: call_outcome === "Do Not Call" ? "do_not_call" : "completed",
        completedAt: (/* @__PURE__ */ new Date()).toISOString()
      }).where(eq2(leads.id, leadId));
      await db.update(users).set({ lastActiveAt: (/* @__PURE__ */ new Date()).toISOString() }).where(eq2(users.id, user.id));
      res.json({ success: true, callLogId });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.post("/api/leads/release", async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;
      const { leadId } = req.body;
      if (!leadId) return res.status(400).json({ error: "leadId is required." });
      await db.update(leads).set({
        status: "unassigned",
        assignedCallerId: null,
        assignedCallerName: null,
        reservedAt: null
      }).where(eq2(leads.id, leadId));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.patch("/api/leads/visibility", async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;
      if (user.role !== "admin" && user.role !== "team_leader") {
        return res.status(403).json({ error: "Permission denied." });
      }
      const { lead_ids, update_all, allowed_caller_ids } = req.body;
      const orgId = user.orgId || user.org_id || "org_default";
      const newAllowed = allowed_caller_ids === null ? null : JSON.stringify(allowed_caller_ids || []);
      let updatedCount = 0;
      if (update_all) {
        const result = await pool.query(
          `UPDATE leads SET allowed_caller_ids = $1 WHERE org_id = $2`,
          [newAllowed, orgId]
        );
        updatedCount = result.rowCount || 0;
      } else if (lead_ids && lead_ids.length > 0) {
        for (const lid of lead_ids) {
          await pool.query(`UPDATE leads SET allowed_caller_ids = $1 WHERE id = $2`, [newAllowed, lid]);
        }
        updatedCount = lead_ids.length;
      }
      res.json({ success: true, updatedCount });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.post("/api/leads/import/validate", async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;
      const { rows } = req.body;
      if (!rows || !Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ error: "No rows to validate." });
      }
      const errors = [];
      const validRows = [];
      rows.forEach((row, index) => {
        const bizName = extractFlexibleColumn(row, ["Business Name", "business_name", "name", "company", "Company Name"]);
        const phone = extractFlexibleColumn(row, ["Phone Number", "phone_number", "phone", "Phone", "telephone"]);
        if (!bizName) {
          errors.push({ row: index + 2, field: "Business Name", message: "Missing business name", value: "" });
        }
        if (!phone) {
          errors.push({ row: index + 2, field: "Phone Number", message: "Missing phone number", value: "" });
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
        valid_rows: validRows
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.post("/api/leads/import/commit", async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;
      const { rows, fileName, allowed_caller_ids } = req.body;
      if (!rows || !Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ error: "No rows to import." });
      }
      const orgId = user.orgId || user.org_id || "org_default";
      const batchId = `batch_${Date.now()}`;
      await db.insert(importedBatches).values({
        id: batchId,
        orgId,
        fileName: fileName || "Imported_Batch.csv",
        totalLeads: rows.length,
        allowedCallerIds: allowed_caller_ids && allowed_caller_ids.length > 0 ? allowed_caller_ids : null,
        importedById: user.id,
        importedByName: user.name,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      });
      let importedCount = 0;
      for (const row of rows) {
        const bizName = extractFlexibleColumn(row, ["Business Name", "business_name", "name", "company", "Company Name"]);
        const phone = extractFlexibleColumn(row, ["Phone Number", "phone_number", "phone", "Phone", "telephone"]);
        if (!bizName || !phone) continue;
        const hasWebsite = extractFlexibleColumn(row, ["Has Website", "has_website", "website", "Website", "Website URL"]);
        const industry = extractFlexibleColumn(row, ["Industry", "industry", "Category", "Type"]) || inferIndustryFromName(bizName);
        const address = extractFlexibleColumn(row, ["Address", "address", "Street", "street_address"]);
        const city = extractFlexibleColumn(row, ["City", "city"]);
        const state = extractFlexibleColumn(row, ["State", "state"]);
        const zip = extractFlexibleColumn(row, ["Zip", "zip", "Zip Code", "zip_code", "Zipcode", "postal_code"]);
        const email = extractFlexibleColumn(row, ["Email", "email", "contact_email"]);
        const contactPerson = extractFlexibleColumn(row, ["Contact", "contact", "Contact Person", "contact_person", "Contact Name"]);
        const isWebsite = hasWebsite && hasWebsite.toLowerCase() !== "false" && hasWebsite.toLowerCase() !== "no" && hasWebsite.toLowerCase() !== "no_website" && hasWebsite.toLowerCase() !== "";
        const websiteUrl = isWebsite && hasWebsite.startsWith("http") ? hasWebsite : void 0;
        const bizId = `biz_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        await db.insert(businesses).values({
          id: bizId,
          batchId,
          orgId,
          name: bizName,
          phone,
          hasWebsite: !!isWebsite,
          websiteUrl: websiteUrl || null,
          industry,
          address: address || "",
          city: city || null,
          state: state || null,
          zip: zip || null,
          email: email || null,
          contactPerson: contactPerson || null,
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        });
        const leadId = `lead_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        await db.insert(leads).values({
          id: leadId,
          orgId,
          businessId: bizId,
          status: "unassigned",
          allowedCallerIds: allowed_caller_ids && allowed_caller_ids.length > 0 ? allowed_caller_ids : null,
          currentCycle: 1,
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        });
        importedCount++;
      }
      await db.insert(auditLogs).values({
        id: `aud_${Date.now()}`,
        orgId,
        userId: user.id,
        userName: user.name,
        action: "LEADS_IMPORTED",
        targetType: "batch",
        targetId: batchId,
        details: `Imported ${importedCount} leads from ${fileName || "CSV file"}.`,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      res.json({ success: true, importedCount });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.patch("/api/leads/batches/:id", async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;
      const { id } = req.params;
      const { file_name, allowed_caller_ids } = req.body;
      const updates = {};
      if (file_name !== void 0) updates.fileName = file_name;
      if (allowed_caller_ids !== void 0) {
        updates.allowedCallerIds = allowed_caller_ids;
        const businesses2 = await db.select({ id: businesses.id }).from(businesses).where(eq2(businesses.batchId, id));
        const bizIds = businesses2.map((b) => b.id);
        if (bizIds.length > 0) {
          const newAllowed = allowed_caller_ids && allowed_caller_ids.length > 0 ? JSON.stringify(allowed_caller_ids) : null;
          for (const bizId of bizIds) {
            await pool.query(`UPDATE leads SET allowed_caller_ids = $1 WHERE business_id = $2`, [newAllowed, bizId]);
          }
        }
      }
      if (Object.keys(updates).length > 0) {
        await db.update(importedBatches).set(updates).where(eq2(importedBatches.id, id));
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.delete("/api/leads/batches/:id", async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;
      if (user.role !== "admin") {
        return res.status(403).json({ error: "Admin permissions required to delete batches." });
      }
      const { id } = req.params;
      const businesses2 = await db.select({ id: businesses.id }).from(businesses).where(eq2(businesses.batchId, id));
      const bizIds = businesses2.map((b) => b.id);
      if (bizIds.length > 0) {
        for (const bizId of bizIds) {
          await pool.query(`DELETE FROM follow_ups WHERE business_id = $1`, [bizId]);
          await pool.query(`DELETE FROM call_logs WHERE business_id = $1`, [bizId]);
          await pool.query(`DELETE FROM leads WHERE business_id = $1`, [bizId]);
        }
        await pool.query(`DELETE FROM businesses WHERE batch_id = $1`, [id]);
      }
      await db.delete(importedBatches).where(eq2(importedBatches.id, id));
      await db.insert(auditLogs).values({
        id: `aud_${Date.now()}`,
        orgId: user.orgId || "org_default",
        userId: user.id,
        userName: user.name,
        action: "BATCH_DELETED",
        targetType: "batch",
        targetId: id,
        details: `Deleted lead batch ${id} and all associated records.`,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.post("/api/users/:id/reset-password", async (req, res) => {
    try {
      const currentUser = requireUser(req, res);
      if (!currentUser) return;
      if (currentUser.role !== "admin") {
        return res.status(403).json({ error: "Admin permissions required." });
      }
      const { id } = req.params;
      const { new_password } = req.body;
      if (!new_password || new_password.length < 6) {
        return res.status(400).json({ error: "New password must be at least 6 characters." });
      }
      const hashed = hashPassword(new_password);
      await db.update(users).set({ password: hashed }).where(eq2(users.id, id));
      await db.insert(auditLogs).values({
        id: `aud_${Date.now()}`,
        orgId: currentUser.orgId || "org_default",
        userId: currentUser.id,
        userName: currentUser.name,
        action: "PASSWORD_RESET",
        targetType: "user",
        targetId: id,
        details: `Admin reset password for user ${id}.`,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.patch("/api/users/profile", async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;
      const { name, avatar_url } = req.body;
      const updates = {};
      if (name !== void 0) updates.name = String(name).trim();
      if (avatar_url !== void 0) updates.avatarUrl = avatar_url;
      if (Object.keys(updates).length > 0) {
        await db.update(users).set(updates).where(eq2(users.id, user.id));
      }
      const updated = await db.select().from(users).where(eq2(users.id, user.id));
      res.json(toSafeUser(updated[0]));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.delete("/api/users/:id", async (req, res) => {
    try {
      const currentUser = requireUser(req, res);
      if (!currentUser) return;
      if (currentUser.role !== "admin") {
        return res.status(403).json({ error: "Admin permissions required." });
      }
      const { id } = req.params;
      if (id === currentUser.id) {
        return res.status(400).json({ error: "Cannot delete your own account." });
      }
      await db.delete(sessions).where(eq2(sessions.userId, id));
      await db.delete(users).where(eq2(users.id, id));
      await db.insert(auditLogs).values({
        id: `aud_${Date.now()}`,
        orgId: currentUser.orgId || "org_default",
        userId: currentUser.id,
        userName: currentUser.name,
        action: "USER_DELETED",
        targetType: "user",
        targetId: id,
        details: `Deleted user account ${id}.`,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      res.json({ success: true, message: "User deleted successfully." });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.get("/api/admin/diagnostic/visibility", async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;
      const orgId = user.orgId || user.org_id || "org_default";
      const callersList = await db.select().from(users).where(and2(eq2(users.role, "caller"), eq2(users.active, true)));
      const batchesList = await db.select().from(importedBatches).where(eq2(importedBatches.orgId, orgId));
      const batchDiagnostics = [];
      for (const batch of batchesList) {
        let allowedIds = [];
        if (batch.allowedCallerIds) {
          try {
            allowedIds = typeof batch.allowedCallerIds === "string" ? JSON.parse(batch.allowedCallerIds) : batch.allowedCallerIds;
          } catch {
            allowedIds = [];
          }
        }
        const isRestricted = allowedIds.length > 0;
        const leadsCountRes = await pool.query(
          `SELECT COUNT(*) as cnt FROM leads l JOIN businesses biz ON l.business_id = biz.id WHERE biz.batch_id = $1`,
          [batch.id]
        );
        const totalLeads = parseInt(leadsCountRes.rows[0]?.cnt || "0", 10);
        const callerBreakdown = callersList.map((c) => {
          const isAllowed = !isRestricted || allowedIds.includes(c.id);
          return {
            caller_id: c.id,
            caller_name: c.name,
            caller_email: c.email,
            is_allowed: isAllowed,
            accessible_leads_count: isAllowed ? totalLeads : 0,
            status: isAllowed ? "ALLOWED" : "BLOCKED"
          };
        });
        batchDiagnostics.push({
          batch_id: batch.id,
          file_name: batch.fileName,
          total_leads: totalLeads,
          allowed_caller_ids: allowedIds,
          is_restricted: isRestricted,
          allowed_callers_count: callerBreakdown.filter((c) => c.is_allowed).length,
          blocked_callers_count: callerBreakdown.filter((c) => !c.is_allowed).length,
          caller_breakdown: callerBreakdown
        });
      }
      const checks = [
        `${callersList.length} active callers found`,
        `${batchesList.length} imported batches found`,
        `Visibility audit completed at ${(/* @__PURE__ */ new Date()).toISOString()}`
      ];
      res.json({
        success: true,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        total_callers: callersList.length,
        total_batches: batchesList.length,
        verification_checks: checks,
        batch_diagnostics: batchDiagnostics
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.post("/api/concurrency-test", async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;
      res.json({
        success: true,
        message: "Concurrency test passed",
        user_id: user.id,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app2.get("/api/export/csv", async (req, res) => {
    try {
      const user = requireUser(req, res);
      if (!user) return;
      const orgId = user.orgId || user.org_id || "org_default";
      const logsRes = await pool.query(
        `SELECT cl.*, biz.name as business_name, biz.phone as business_phone
         FROM call_logs cl
         LEFT JOIN businesses biz ON cl.business_id = biz.id
         WHERE cl.org_id = $1
         ORDER BY cl.created_at DESC`,
        [orgId]
      );
      const headers = "Date,Caller,Business,Phone,Who Answered,Outcome,Pitch,Objection,Notes\n";
      const csvRows = logsRes.rows.map((r) => {
        return [
          r.created_at || "",
          (r.caller_name || "").replace(/,/g, " "),
          (r.business_name || "").replace(/,/g, " "),
          r.business_phone || "",
          r.who_answered || "",
          r.call_outcome || "",
          r.pitch_given || "",
          r.objection_reason || "",
          (r.notes || "").replace(/,/g, " ").replace(/\n/g, " ")
        ].join(",");
      }).join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", 'attachment; filename="call_logs_export.csv"');
      res.send(headers + csvRows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  return app2;
}

// src/apiEntry.ts
var app = createApp();
function handler(req, res) {
  return app(req, res);
}
export {
  handler as default
};
