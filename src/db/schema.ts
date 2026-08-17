import { pgTable, text, integer, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().default('org_default'),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  role: text('role').$type<'admin' | 'team_leader' | 'caller'>().notNull(),
  password: text('password'),
  avatarUrl: text('avatar_url'),
  twoFactorEnabled: boolean('two_factor_enabled').default(false),
  twoFactorPin: text('two_factor_pin'),
  active: boolean('active').notNull().default(true),
  lastActiveAt: timestamp('last_active_at', { mode: 'string' }).defaultNow(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
});

export const industries = pgTable('industries', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().default('org_default'),
  name: text('name').notNull(),
  defaultPitch: text('default_pitch'),
});

export const importedBatches = pgTable('imported_batches', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().default('org_default'),
  fileName: text('file_name').notNull(),
  totalLeads: integer('total_leads').default(0),
  allowedCallerIds: jsonb('allowed_caller_ids').$type<string[]>(),
  importedById: text('imported_by_id'),
  importedByName: text('imported_by_name'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
});

export const businesses = pgTable('businesses', {
  id: text('id').primaryKey(),
  batchId: text('batch_id').references(() => importedBatches.id, { onDelete: 'set null' }),
  orgId: text('org_id').notNull().default('org_default'),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  hasWebsite: boolean('has_website').default(false),
  websiteUrl: text('website_url'),
  industry: text('industry').notNull(),
  address: text('address').notNull(),
  city: text('city'),
  state: text('state'),
  zip: text('zip'),
  email: text('email'),
  contactPerson: text('contact_person'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
});

export const leads = pgTable('leads', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().default('org_default'),
  businessId: text('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  status: text('status').$type<'unassigned' | 'reserved' | 'completed' | 'do_not_call'>().notNull().default('unassigned'),
  assignedCallerId: text('assigned_caller_id').references(() => users.id, { onDelete: 'set null' }),
  assignedCallerName: text('assigned_caller_name'),
  allowedCallerIds: jsonb('allowed_caller_ids').$type<string[]>(),
  reservedAt: timestamp('reserved_at', { mode: 'string' }),
  completedAt: timestamp('completed_at', { mode: 'string' }),
  currentCycle: integer('current_cycle').notNull().default(1),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
});

export const callLogs = pgTable('call_logs', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().default('org_default'),
  leadId: text('lead_id').references(() => leads.id, { onDelete: 'cascade' }),
  businessId: text('business_id').references(() => businesses.id, { onDelete: 'cascade' }),
  callerId: text('caller_id').references(() => users.id, { onDelete: 'set null' }),
  callerName: text('caller_name').notNull(),
  whoAnswered: text('who_answered').notNull(),
  callOutcome: text('call_outcome'),
  pitchGiven: text('pitch_given'),
  objectionReason: text('objection_reason'),
  hasFollowup: boolean('has_followup').default(false),
  followupAt: timestamp('followup_at', { mode: 'string' }),
  followupMethod: text('followup_method'),
  contactName: text('contact_name'),
  contactEmail: text('contact_email'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
});

export const followUps = pgTable('follow_ups', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().default('org_default'),
  callLogId: text('call_log_id').references(() => callLogs.id, { onDelete: 'cascade' }),
  leadId: text('lead_id').references(() => leads.id, { onDelete: 'cascade' }),
  businessId: text('business_id').references(() => businesses.id, { onDelete: 'cascade' }),
  callerId: text('caller_id').references(() => users.id, { onDelete: 'set null' }),
  status: text('status').$type<'interested' | 'email_sent' | 'followup' | 'appointment' | 'closed'>().notNull().default('interested'),
  scheduledAt: timestamp('scheduled_at', { mode: 'string' }).notNull(),
  method: text('method').default('Call'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
});

export const auditLogs = pgTable('audit_logs', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().default('org_default'),
  userId: text('user_id').notNull(),
  userName: text('user_name').notNull(),
  action: text('action').notNull(),
  targetType: text('target_type').notNull(),
  targetId: text('target_id'),
  details: text('details').notNull(),
  timestamp: timestamp('timestamp', { mode: 'string' }).defaultNow(),
});

export const settings = pgTable('settings', {
  orgId: text('org_id').primaryKey().default('org_default'),
  reservationTimeoutMinutes: integer('reservation_timeout_minutes').default(10),
});

export const sessions = pgTable('sessions', {
  token: text('token').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  leads: many(leads),
  callLogs: many(callLogs),
  followUps: many(followUps),
  sessions: many(sessions),
}));

export const businessesRelations = relations(businesses, ({ one, many }) => ({
  batch: one(importedBatches, {
    fields: [businesses.batchId],
    references: [importedBatches.id],
  }),
  leads: many(leads),
  callLogs: many(callLogs),
}));

export const leadsRelations = relations(leads, ({ one, many }) => ({
  business: one(businesses, {
    fields: [leads.businessId],
    references: [businesses.id],
  }),
  caller: one(users, {
    fields: [leads.assignedCallerId],
    references: [users.id],
  }),
  callLogs: many(callLogs),
  followUps: many(followUps),
}));

export const callLogsRelations = relations(callLogs, ({ one, many }) => ({
  lead: one(leads, {
    fields: [callLogs.leadId],
    references: [leads.id],
  }),
  business: one(businesses, {
    fields: [callLogs.businessId],
    references: [businesses.id],
  }),
  caller: one(users, {
    fields: [callLogs.callerId],
    references: [users.id],
  }),
  followUps: many(followUps),
}));

export const followUpsRelations = relations(followUps, ({ one }) => ({
  callLog: one(callLogs, {
    fields: [followUps.callLogId],
    references: [callLogs.id],
  }),
  lead: one(leads, {
    fields: [followUps.leadId],
    references: [leads.id],
  }),
  business: one(businesses, {
    fields: [followUps.businessId],
    references: [businesses.id],
  }),
  caller: one(users, {
    fields: [followUps.callerId],
    references: [users.id],
  }),
}));
