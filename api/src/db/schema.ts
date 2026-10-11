import type { ColorToken, DocumentSource, PaymentMethod, PlanCode, StaffRole } from '@prana/shared';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Mirrors migrations/0001_init.sql. Property names are the column names, so rows
// come back in the same snake_case shape the API contract uses.

/** updated_at = last edit (sync resolves conflicts by it); changed_at = last server write (the sync cursor). */
const meta = {
  created_at: text().notNull(),
  updated_at: text().notNull(),
  deleted_at: text(),
  changed_at: text().notNull(),
};

export const business = sqliteTable('business', {
  id: text().primaryKey(),
  name: text().notNull(),
  locale: text().notNull(),
  timezone: text().notNull(),
  created_at: text().notNull(),
  updated_at: text().notNull(),
});

export const location = sqliteTable('location', {
  id: text().primaryKey(),
  business_id: text().notNull(),
  name: text().notNull(),
  ...meta,
});

export const staff = sqliteTable('staff', {
  id: text().primaryKey(),
  business_id: text().notNull(),
  firebase_uid: text(),
  email: text().notNull(),
  name: text().notNull(),
  role: text().$type<StaffRole>().notNull(),
  ...meta,
});

export const offeringGroup = sqliteTable('offering_group', {
  id: text().primaryKey(),
  business_id: text().notNull(),
  name: text().notNull(),
  sort: integer().notNull(),
  ...meta,
});

export const offering = sqliteTable('offering', {
  id: text().primaryKey(),
  business_id: text().notNull(),
  group_id: text().notNull(),
  name: text().notNull(),
  color_token: text().$type<ColorToken>().notNull(),
  default_duration_min: integer().notNull(),
  entry_rule: text(),
  default_capacity: integer(),
  active: integer({ mode: 'boolean' }).notNull(),
  ...meta,
});

export const session = sqliteTable('session', {
  id: text().primaryKey(),
  business_id: text().notNull(),
  location_id: text().notNull(),
  offering_id: text().notNull(),
  starts_at: text().notNull(),
  ends_at: text().notNull(),
  teacher_staff_id: text(),
  capacity: integer(),
  note: text(),
  ...meta,
});

export const member = sqliteTable('member', {
  id: text().primaryKey(),
  business_id: text().notNull(),
  full_name: text().notNull(),
  email: text(),
  phone: text(),
  dob: text(),
  is_student_or_retired: integer({ mode: 'boolean' }).notNull(),
  health_flag: integer({ mode: 'boolean' }).notNull(),
  health_text: text(),
  consent_accuracy: integer({ mode: 'boolean' }).notNull(),
  consent_news: integer({ mode: 'boolean' }).notNull(),
  signed_place: text(),
  signed_date: text(),
  member_since: text().notNull(),
  notes: text(),
  ...meta,
});

export const plan = sqliteTable('plan', {
  id: text().primaryKey(),
  business_id: text().notNull(),
  code: text().$type<PlanCode>().notNull(),
  name: text().notNull(),
  visits_per_month: integer(),
  price_cents: integer(),
  ...meta,
});

export const membership = sqliteTable('membership', {
  id: text().primaryKey(),
  business_id: text().notNull(),
  member_id: text().notNull(),
  plan_id: text().notNull(),
  period_start: text().notNull(),
  period_end: text().notNull(),
  frozen_until: text(),
  ...meta,
});

export const visit = sqliteTable('visit', {
  id: text().primaryKey(),
  business_id: text().notNull(),
  member_id: text().notNull(),
  session_id: text().notNull(),
  membership_id: text(),
  checked_in_at: text().notNull(),
  ...meta,
});

export const payment = sqliteTable('payment', {
  id: text().primaryKey(),
  business_id: text().notNull(),
  member_id: text().notNull(),
  membership_id: text(),
  amount_cents: integer().notNull(),
  currency: text().$type<'EUR'>().notNull(),
  method: text().$type<PaymentMethod>().notNull(),
  paid_at: text().notNull(),
  note: text(),
  ...meta,
});

export const document = sqliteTable('document', {
  id: text().primaryKey(),
  business_id: text().notNull(),
  member_id: text(),
  kind: text().$type<'upisnica'>().notNull(),
  r2_key: text().notNull(),
  mime: text().notNull(),
  source: text().$type<DocumentSource>().notNull(),
  filename: text(),
  size_bytes: integer().notNull(),
  ocr_json: text({ mode: 'json' }).$type<unknown>(),
  created_by: text().notNull(),
  ...meta,
});

export type BusinessRow = typeof business.$inferSelect;
export type StaffRow = typeof staff.$inferSelect;
export type MemberRow = typeof member.$inferSelect;
export type DocumentRow = typeof document.$inferSelect;
