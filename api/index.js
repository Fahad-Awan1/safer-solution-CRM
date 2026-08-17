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
    const poolConfig = process.env.DATABASE_URL ? {
      connectionString: process.env.DATABASE_URL,
      ssl: isCloud ? { rejectUnauthorized: false } : false,
      max: 10,
      connectionTimeoutMillis: 15e3
    } : {
      host: process.env.SQL_HOST || "localhost",
      user: process.env.SQL_USER || "postgres",
      password: process.env.SQL_PASSWORD || "postgres",
      database: process.env.SQL_DB_NAME || "safer_solution_crm",
      ssl: isCloud ? { rejectUnauthorized: false } : false,
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
import fs from "fs";
import path from "path";
var SALT_ROUNDS = 10;
function isBcryptHash(str) {
  return typeof str === "string" && (str.startsWith("$2a$") || str.startsWith("$2b$"));
}
function hashPassword(plain) {
  if (!plain) return "";
  if (isBcryptHash(plain)) return plain;
  return bcrypt.hashSync(plain.trim(), SALT_ROUNDS);
}
async function ensureTablesExist() {
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
    console.log("[Database] All required PostgreSQL tables verified/created successfully.");
  } catch (err) {
    console.error("[Database] Error ensuring tables exist:", err);
  }
}
async function seedInitialDataIfNeeded() {
  try {
    await ensureTablesExist();
    const existingUsers = await db.select().from(users).limit(1);
    const localDbPath = path.join(process.cwd(), ".data", "db.json");
    const rootDbPath = path.join(process.cwd(), "db.json");
    let localData = null;
    if (fs.existsSync(localDbPath)) {
      try {
        localData = JSON.parse(fs.readFileSync(localDbPath, "utf-8"));
      } catch (e) {
      }
    } else if (fs.existsSync(rootDbPath)) {
      try {
        localData = JSON.parse(fs.readFileSync(rootDbPath, "utf-8"));
      } catch (e) {
      }
    }
    if (existingUsers.length === 0) {
      console.log("[Cloud SQL] Database is empty. Migrating local data or inserting seed data...");
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const orgId = "org_default";
      if (localData && Array.isArray(localData.users) && localData.users.length > 0) {
        console.log(`[Cloud SQL] Migrating ${localData.users.length} users, ${localData.businesses?.length || 0} businesses, ${localData.leads?.length || 0} leads from local storage...`);
        for (const u of localData.users) {
          if (!u || !u.id) continue;
          await db.insert(users).values({
            id: u.id,
            orgId: u.org_id || orgId,
            name: u.name,
            email: u.email,
            role: u.role || "caller",
            password: u.password ? hashPassword(u.password) : hashPassword("Caller@1234"),
            avatarUrl: u.avatar_url || null,
            twoFactorEnabled: !!u.two_factor_enabled,
            twoFactorPin: u.two_factor_pin || null,
            active: u.active !== void 0 ? u.active : true,
            lastActiveAt: u.last_active_at || now,
            createdAt: u.created_at || now
          }).onConflictDoNothing();
        }
        if (Array.isArray(localData.industries)) {
          for (const ind of localData.industries) {
            if (!ind || !ind.id) continue;
            await db.insert(industries).values({
              id: ind.id,
              orgId: ind.org_id || orgId,
              name: ind.name,
              defaultPitch: ind.default_pitch || null
            }).onConflictDoNothing();
          }
        }
        if (Array.isArray(localData.imported_batches)) {
          for (const b of localData.imported_batches) {
            if (!b || !b.id) continue;
            await db.insert(importedBatches).values({
              id: b.id,
              orgId: b.org_id || orgId,
              fileName: b.file_name || "Imported_Leads.csv",
              totalLeads: b.total_leads || 0,
              allowedCallerIds: Array.isArray(b.allowed_caller_ids) ? b.allowed_caller_ids : null,
              importedById: b.imported_by_id || null,
              importedByName: b.imported_by_name || null,
              createdAt: b.created_at || now
            }).onConflictDoNothing();
          }
        }
        if (Array.isArray(localData.businesses)) {
          for (const biz of localData.businesses) {
            if (!biz || !biz.id) continue;
            await db.insert(businesses).values({
              id: biz.id,
              batchId: biz.batch_id || null,
              orgId: biz.org_id || orgId,
              name: biz.name || "Business",
              phone: biz.phone || "N/A",
              hasWebsite: !!biz.has_website,
              websiteUrl: biz.website_url || null,
              industry: biz.industry || "General Business",
              address: biz.address || "N/A",
              city: biz.city || null,
              state: biz.state || null,
              zip: biz.zip || null,
              email: biz.email || null,
              contactPerson: biz.contact_person || null,
              createdAt: biz.created_at || now
            }).onConflictDoNothing();
          }
        }
        const insertedUsersList = await db.select({ id: users.id }).from(users);
        const validUserIds = new Set(insertedUsersList.map((u) => u.id));
        if (Array.isArray(localData.leads)) {
          for (const l of localData.leads) {
            if (!l || !l.id || !l.business_id) continue;
            const hasValidCaller = l.assigned_caller_id && validUserIds.has(l.assigned_caller_id);
            await db.insert(leads).values({
              id: l.id,
              orgId: l.org_id || orgId,
              businessId: l.business_id,
              status: hasValidCaller ? l.status || "unassigned" : "unassigned",
              assignedCallerId: hasValidCaller ? l.assigned_caller_id : null,
              assignedCallerName: hasValidCaller ? l.assigned_caller_name : null,
              allowedCallerIds: Array.isArray(l.allowed_caller_ids) ? l.allowed_caller_ids : null,
              reservedAt: hasValidCaller ? l.reserved_at || null : null,
              completedAt: l.completed_at || null,
              currentCycle: l.current_cycle || 1,
              createdAt: l.created_at || now
            }).onConflictDoNothing();
          }
        }
        if (Array.isArray(localData.call_logs)) {
          for (const cl of localData.call_logs) {
            if (!cl || !cl.id) continue;
            const hasValidCaller = cl.caller_id && validUserIds.has(cl.caller_id);
            await db.insert(callLogs).values({
              id: cl.id,
              orgId: cl.org_id || orgId,
              leadId: cl.lead_id || null,
              businessId: cl.business_id || null,
              callerId: hasValidCaller ? cl.caller_id : null,
              callerName: cl.caller_name || "Caller",
              whoAnswered: cl.who_answered || "Answered",
              callOutcome: cl.call_outcome || null,
              pitchGiven: cl.pitch_given || null,
              objectionReason: cl.objection_reason || null,
              hasFollowup: !!cl.has_followup,
              followupAt: cl.followup_at || null,
              followupMethod: cl.followup_method || null,
              contactName: cl.contact_name || null,
              contactEmail: cl.contact_email || null,
              notes: cl.notes || null,
              createdAt: cl.created_at || now
            }).onConflictDoNothing();
          }
        }
        if (Array.isArray(localData.follow_ups)) {
          for (const fu of localData.follow_ups) {
            if (!fu || !fu.id || !fu.scheduled_at) continue;
            const hasValidCaller = fu.caller_id && validUserIds.has(fu.caller_id);
            await db.insert(followUps).values({
              id: fu.id,
              orgId: fu.org_id || orgId,
              callLogId: fu.call_log_id || null,
              leadId: fu.lead_id || null,
              businessId: fu.business_id || null,
              callerId: hasValidCaller ? fu.caller_id : null,
              status: fu.status || "interested",
              scheduledAt: fu.scheduled_at,
              method: fu.method || "Call",
              notes: fu.notes || null,
              createdAt: fu.created_at || now
            }).onConflictDoNothing();
          }
        }
        if (Array.isArray(localData.audit_logs)) {
          for (const al of localData.audit_logs) {
            if (!al || !al.id) continue;
            await db.insert(auditLogs).values({
              id: al.id,
              orgId: al.org_id || orgId,
              userId: al.user_id || "system",
              userName: al.user_name || "System",
              action: al.action || "LOG",
              targetType: al.target_type || "system",
              targetId: al.target_id || null,
              details: al.details || "",
              timestamp: al.timestamp || now
            }).onConflictDoNothing();
          }
        }
        console.log("[Cloud SQL] Data migration completed successfully.");
      } else {
        await db.insert(users).values({
          id: "usr_admin",
          orgId,
          name: "Fahad Riaz (Admin)",
          email: "fahadriazcs@gmail.com",
          role: "admin",
          password: hashPassword("Fahad@6599"),
          active: true,
          lastActiveAt: now,
          createdAt: now
        }).onConflictDoNothing();
        const defaultIndustries = [
          { id: "ind_1", orgId, name: "Dental Clinic", defaultPitch: "AI Dental Front Desk" },
          { id: "ind_2", orgId, name: "Barber Shop / Salon", defaultPitch: "24/7 Appointment Booking" },
          { id: "ind_3", orgId, name: "Restaurant / Dining", defaultPitch: "Table & Takeout Reservation AI" },
          { id: "ind_4", orgId, name: "Auto Repair", defaultPitch: "Service Scheduling Assistant" },
          { id: "ind_5", orgId, name: "Plumbing & HVAC", defaultPitch: "Dispatch Call Handling AI" }
        ];
        for (const ind of defaultIndustries) {
          await db.insert(industries).values(ind).onConflictDoNothing();
        }
        await db.insert(auditLogs).values({
          id: `aud_seed_${Date.now()}`,
          orgId,
          userId: "usr_admin",
          userName: "Fahad Riaz (Admin)",
          action: "SYSTEM_INITIALIZED",
          targetType: "system",
          details: "Initialized agency CRM database on Cloud SQL (PostgreSQL) with Admin account.",
          timestamp: now
        }).onConflictDoNothing();
        console.log("[Cloud SQL] Default seed data initialized.");
      }
      await pool.query(`
        INSERT INTO leads (id, org_id, business_id, status, allowed_caller_ids, current_cycle, created_at)
        SELECT 'lead_' || id, org_id, id, 'unassigned', NULL, 1, COALESCE(created_at, NOW())
        FROM businesses b
        WHERE NOT EXISTS (SELECT 1 FROM leads l WHERE l.business_id = b.id)
      `);
    } else {
      const adminUsers = await db.select().from(users).where(eq(users.email, "fahadriazcs@gmail.com"));
      if (adminUsers.length === 0) {
        await db.insert(users).values({
          id: "usr_admin",
          orgId: "org_default",
          name: "Fahad Riaz (Admin)",
          email: "fahadriazcs@gmail.com",
          role: "admin",
          password: hashPassword("Fahad@6599"),
          active: true,
          lastActiveAt: (/* @__PURE__ */ new Date()).toISOString(),
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        }).onConflictDoNothing();
      }
    }
  } catch (error) {
    console.error("Error seeding Cloud SQL data:", error);
  }
}
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
async function saveSession(token, userId) {
  try {
    await db.insert(sessions).values({
      token,
      userId,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    }).onConflictDoNothing();
  } catch (error) {
    console.error("Error saving session:", error);
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
import { eq as eq2, and as and2, sql as sql2, desc as desc2 } from "drizzle-orm";
dotenv2.config();
var SALT_ROUNDS2 = 10;
function isBcryptHash2(str) {
  return typeof str === "string" && (str.startsWith("$2a$") || str.startsWith("$2b$"));
}
function hashPassword2(plain) {
  if (!plain) return "";
  if (isBcryptHash2(plain)) return plain;
  return bcrypt2.hashSync(plain.trim(), SALT_ROUNDS2);
}
function verifyPassword(plain, storedHashOrPlain) {
  if (!storedHashOrPlain || !plain) return false;
  const trimmedPlain = plain.trim();
  if (isBcryptHash2(storedHashOrPlain)) {
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
function createApp() {
  const app2 = express();
  seedInitialDataIfNeeded().catch((err) => {
    console.error("[Database Seed/Init Error]:", err);
  });
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
      await ensureTablesExist();
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
        const users2 = await db.select().from(users).where(
          sql2`LOWER(TRIM(${users.email})) = ${String(email).toLowerCase().trim()}`
        );
        user = users2[0];
        if (!user) {
          return res.status(401).json({ error: "Invalid email address or user account does not exist." });
        }
        const isValid = verifyPassword(String(password).trim(), user.password);
        if (!isValid) {
          return res.status(401).json({ error: "Incorrect password. Please try again." });
        }
        if (user.password && !isBcryptHash2(user.password)) {
          const newHash = hashPassword2(String(password).trim());
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
      await db.update(users).set({ lastActiveAt: now }).where(eq2(users.id, user.id));
      const token = crypto.randomBytes(32).toString("hex");
      await saveSession(token, user);
      await db.insert(auditLogs).values({
        id: `aud_${Date.now()}`,
        orgId: user.orgId || "org_default",
        userId: user.id,
        userName: user.name,
        action: "USER_LOGIN",
        targetType: "user",
        targetId: user.id,
        details: `User ${user.name} logged into system.`,
        timestamp: now
      });
      res.json({ token, user: toSafeUser(user) });
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
      const hashedPassword = hashPassword2(plainPass);
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
      const { name, email, role, password, active, two_factor_enabled, two_factor_pin } = req.body;
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
      if (password && password.trim()) updates.password = hashPassword2(password.trim());
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
      const todayStr = now.toISOString().split("T")[0];
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
        selected_date_callbacks: [],
        target_date: todayStr,
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
  return app2;
}

// api/index.ts
var app = createApp();
function handler(req, res) {
  return app(req, res);
}
export {
  handler as default
};
