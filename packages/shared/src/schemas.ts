import { z } from 'zod';

/**
 * The API contract. Field names match the database columns (snake_case) so the
 * web app, the iOS app and sync all see the same shapes.
 * Dates are "YYYY-MM-DD"; instants are UTC ISO 8601; money is integer cents.
 */

// ── Primitives ────────────────────────────────────────────────────────────────

const id = z.uuid();
const isoDate = z.iso.date();
const isoDateTime = z.iso.datetime();
const cents = z.number().int();

const meta = {
  created_at: isoDateTime,
  updated_at: isoDateTime,
  deleted_at: isoDateTime.nullable(),
};

export const STAFF_ROLES = ['owner', 'teacher', 'front_desk'] as const;
export const PLAN_CODES = ['1x', '2x', '3x', 'unl', 'trial'] as const;
export const PAYMENT_METHODS = ['cash', 'card', 'transfer'] as const;
export const DOCUMENT_SOURCES = ['camera', 'pdf', 'image'] as const;
export const COLOR_TOKENS = ['class-spine', 'class-restorative', 'class-ashtanga', 'class-black-lotus', 'class-pranayama', 'class-workshop'] as const;
export const MEMBER_STATUSES = ['active', 'expiring', 'unpaid', 'frozen', 'trial', 'none'] as const;
export const DOCUMENT_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif'] as const;
export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;

export const staffRoleSchema = z.enum(STAFF_ROLES);
export const planCodeSchema = z.enum(PLAN_CODES);
export const paymentMethodSchema = z.enum(PAYMENT_METHODS);
export const documentSourceSchema = z.enum(DOCUMENT_SOURCES);
export const colorTokenSchema = z.enum(COLOR_TOKENS);
export const memberStatusSchema = z.enum(MEMBER_STATUSES);

export type StaffRole = z.infer<typeof staffRoleSchema>;
export type PlanCode = z.infer<typeof planCodeSchema>;
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;
export type DocumentSource = z.infer<typeof documentSourceSchema>;
export type ColorToken = z.infer<typeof colorTokenSchema>;

// ── Errors ────────────────────────────────────────────────────────────────────

export const ERROR_CODES = [
  'unauthenticated',
  'no_access',
  'not_found',
  'invalid_input',
  'consent_required',
  'already_checked_in',
  'file_too_large',
  'unsupported_file',
  'internal',
] as const;
export const errorCodeSchema = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

export const errorResponseSchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    message_hr: z.string(),
    message_en: z.string(),
    /** For invalid_input: the fields that failed, e.g. ["email"]. */
    fields: z.array(z.string()).optional(),
  }),
}).meta({ id: 'Error' });
export type ErrorResponse = z.infer<typeof errorResponseSchema>;

// ── Rows ──────────────────────────────────────────────────────────────────────

export const businessSchema = z.object({
  id,
  name: z.string(),
  locale: z.string(),
  timezone: z.string(),
}).meta({ id: 'Business' });

export const locationSchema = z.object({ id, business_id: id, name: z.string(), ...meta }).meta({ id: 'Location' });

export const staffSchema = z.object({
  id,
  business_id: id,
  email: z.string(),
  name: z.string(),
  role: staffRoleSchema,
  ...meta,
}).meta({ id: 'Staff' });

export const offeringGroupSchema = z.object({
  id,
  business_id: id,
  name: z.string(),
  sort: z.number().int(),
  ...meta,
}).meta({ id: 'OfferingGroup' });

export const offeringSchema = z.object({
  id,
  business_id: id,
  group_id: id,
  name: z.string(),
  color_token: colorTokenSchema,
  default_duration_min: z.number().int(),
  entry_rule: z.string().nullable(),
  default_capacity: z.number().int().nullable(),
  active: z.boolean(),
  ...meta,
}).meta({ id: 'Offering' });

export const sessionSchema = z.object({
  id,
  business_id: id,
  location_id: id,
  offering_id: id,
  starts_at: isoDateTime,
  ends_at: isoDateTime,
  teacher_staff_id: id.nullable(),
  capacity: z.number().int().nullable(),
  note: z.string().nullable(),
  ...meta,
}).meta({ id: 'Session' });

export const memberSchema = z.object({
  id,
  business_id: id,
  full_name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  dob: isoDate.nullable(),
  is_student_or_retired: z.boolean(),
  health_flag: z.boolean(),
  health_text: z.string().nullable(),
  consent_accuracy: z.boolean(),
  consent_news: z.boolean(),
  signed_place: z.string().nullable(),
  signed_date: isoDate.nullable(),
  member_since: isoDate,
  notes: z.string().nullable(),
  ...meta,
}).meta({ id: 'Member' });

export const planSchema = z.object({
  id,
  business_id: id,
  code: planCodeSchema,
  name: z.string(),
  /** null = unlimited */
  visits_per_month: z.number().int().nullable(),
  /** null until the studio sets a price */
  price_cents: cents.nullable(),
  ...meta,
}).meta({ id: 'Plan' });

export const membershipSchema = z.object({
  id,
  business_id: id,
  member_id: id,
  plan_id: id,
  period_start: isoDate,
  period_end: isoDate,
  frozen_until: isoDate.nullable(),
  ...meta,
}).meta({ id: 'Membership' });

export const visitSchema = z.object({
  id,
  business_id: id,
  member_id: id,
  session_id: id,
  membership_id: id.nullable(),
  checked_in_at: isoDateTime,
  ...meta,
}).meta({ id: 'Visit' });

export const paymentSchema = z.object({
  id,
  business_id: id,
  member_id: id,
  membership_id: id.nullable(),
  amount_cents: cents,
  currency: z.literal('EUR'),
  method: paymentMethodSchema,
  paid_at: isoDateTime,
  note: z.string().nullable(),
  ...meta,
}).meta({ id: 'Payment' });

/** The stored file's location is never exposed; files are read through GET /documents/:id/file. */
export const documentSchema = z.object({
  id,
  business_id: id,
  member_id: id.nullable(),
  kind: z.literal('upisnica'),
  mime: z.string(),
  source: documentSourceSchema,
  filename: z.string().nullable(),
  size_bytes: z.number().int(),
  ocr_json: z.unknown().nullable(),
  created_by: id,
  ...meta,
}).meta({ id: 'Document' });

export type Business = z.infer<typeof businessSchema>;
export type Location = z.infer<typeof locationSchema>;
export type Staff = z.infer<typeof staffSchema>;
export type OfferingGroup = z.infer<typeof offeringGroupSchema>;
export type Offering = z.infer<typeof offeringSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type Member = z.infer<typeof memberSchema>;
export type Plan = z.infer<typeof planSchema>;
export type Membership = z.infer<typeof membershipSchema>;
export type Visit = z.infer<typeof visitSchema>;
export type Payment = z.infer<typeof paymentSchema>;
export type DocumentRecord = z.infer<typeof documentSchema>;

// ── Views (rows plus what the screens need beside them) ───────────────────────

export const sessionViewSchema = sessionSchema.extend({
  offering_name: z.string(),
  color_token: colorTokenSchema,
  entry_rule: z.string().nullable(),
  teacher_name: z.string().nullable(),
  /** Visits checked in so far. */
  booked: z.number().int(),
  /** The session's capacity, or the class type's default; null = no limit set. */
  effective_capacity: z.number().int().nullable(),
}).meta({ id: 'SessionView' });

export const membershipViewSchema = membershipSchema.extend({
  plan_code: planCodeSchema,
  plan_name: z.string(),
  visits_total: z.number().int().nullable(),
  visits_used: z.number().int(),
  price_cents: cents.nullable(),
  paid_cents: cents,
  /** The end of the following membership when this one is already renewed; otherwise null. */
  renewed_until: isoDate.nullable(),
}).meta({ id: 'MembershipView' });

export const memberSummarySchema = z.object({
  id,
  full_name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  health_flag: z.boolean(),
  health_text: z.string().nullable(),
  status: memberStatusSchema,
  days_left: z.number().int().nullable(),
  debt_cents: cents,
  membership: membershipViewSchema.nullable(),
  last_visit_at: isoDateTime.nullable(),
}).meta({ id: 'MemberSummary' });

export const attendeeSchema = z.object({
  visit_id: id,
  member_id: id,
  full_name: z.string(),
  health_flag: z.boolean(),
  health_text: z.string().nullable(),
  checked_in_at: isoDateTime,
}).meta({ id: 'Attendee' });

export const memberVisitSchema = z.object({
  id,
  session_id: id,
  checked_in_at: isoDateTime,
  starts_at: isoDateTime,
  offering_name: z.string(),
  color_token: colorTokenSchema,
}).meta({ id: 'MemberVisit' });

export const paymentViewSchema = paymentSchema.extend({
  member_name: z.string().nullable(),
  plan_name: z.string().nullable(),
}).meta({ id: 'PaymentView' });

export const offeringViewSchema = offeringSchema.extend({ sessions_this_week: z.number().int() }).meta({ id: 'OfferingView' });

export type SessionView = z.infer<typeof sessionViewSchema>;
export type MembershipView = z.infer<typeof membershipViewSchema>;
export type MemberSummary = z.infer<typeof memberSummarySchema>;
export type Attendee = z.infer<typeof attendeeSchema>;
export type MemberVisit = z.infer<typeof memberVisitSchema>;
export type PaymentView = z.infer<typeof paymentViewSchema>;
export type OfferingView = z.infer<typeof offeringViewSchema>;

// ── Requests ──────────────────────────────────────────────────────────────────

const shortText = z.string().trim().max(200);
const longText = z.string().trim().max(2000);

export const memberInputSchema = z.object({
  full_name: shortText.min(1),
  email: z.email().max(200).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  dob: isoDate.nullable().optional(),
  is_student_or_retired: z.boolean().optional(),
  health_flag: z.boolean().optional(),
  health_text: longText.nullable().optional(),
  /** Must be true: nothing is saved without the accuracy consent. */
  consent_accuracy: z.boolean(),
  consent_news: z.boolean().optional(),
  signed_place: shortText.nullable().optional(),
  signed_date: isoDate.nullable().optional(),
  /** Defaults to today. */
  member_since: isoDate.optional(),
  notes: longText.nullable().optional(),
  /** When given, a one-month membership on this plan starts on member_since. */
  plan_code: planCodeSchema.optional(),
});
export const memberPatchSchema = memberInputSchema.omit({ plan_code: true }).partial();

export const membersQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: memberStatusSchema.optional(),
});

export const offeringGroupInputSchema = z.object({
  name: shortText.min(1),
  sort: z.number().int().optional(),
});

export const offeringInputSchema = z.object({
  group_id: id,
  name: shortText.min(1),
  color_token: colorTokenSchema,
  default_duration_min: z.number().int().min(5).max(24 * 60),
  entry_rule: shortText.nullable().optional(),
  default_capacity: z.number().int().min(1).max(1000).nullable().optional(),
  active: z.boolean().optional(),
});
export const offeringPatchSchema = offeringInputSchema.partial();

export const sessionsQuerySchema = z.object({
  /** First day, inclusive. Defaults to the Monday of this week. */
  from: isoDate.optional(),
  /** Last day, inclusive. Defaults to six days after `from`. */
  to: isoDate.optional(),
});

export const sessionInputSchema = z.object({
  offering_id: id,
  starts_at: isoDateTime,
  /** Defaults to starts_at plus the class type's duration. */
  ends_at: isoDateTime.optional(),
  /** Defaults to the business's first location. */
  location_id: id.optional(),
  teacher_staff_id: id.nullable().optional(),
  capacity: z.number().int().min(1).max(1000).nullable().optional(),
  note: longText.nullable().optional(),
});
export const sessionPatchSchema = sessionInputSchema.partial();

export const visitInputSchema = z.object({ member_id: id });

export const membershipInputSchema = z.object({
  member_id: id,
  plan_id: id,
  /** Defaults to today. */
  period_start: isoDate.optional(),
  /** Defaults to one month after period_start, minus a day. */
  period_end: isoDate.optional(),
});

export const membershipRenewSchema = z.object({
  /** Defaults to the same plan. */
  plan_id: id.optional(),
});

export const membershipFreezeSchema = z.object({
  /** Last frozen day; null lifts the freeze. */
  until: isoDate.nullable(),
});

export const planPatchSchema = z.object({
  name: shortText.min(1).optional(),
  price_cents: cents.min(0).nullable().optional(),
});

export const paymentsQuerySchema = z.object({
  /** First day, inclusive. Defaults to the first of this month. */
  from: isoDate.optional(),
  /** Last day, inclusive. Defaults to the last of that month. */
  to: isoDate.optional(),
});

export const paymentInputSchema = z.object({
  member_id: id,
  /** Left out: the member's current membership. null: not tied to a membership. */
  membership_id: id.nullable().optional(),
  amount_cents: cents.min(1),
  method: paymentMethodSchema,
  /** Defaults to now. */
  paid_at: isoDateTime.optional(),
  note: longText.nullable().optional(),
});

export const dashboardQuerySchema = z.object({
  /** Defaults to today in the business's time zone. */
  date: isoDate.optional(),
});

export const documentPatchSchema = z.object({
  member_id: id.nullable().optional(),
  ocr_json: z.unknown().optional(),
});

export type MemberInput = z.infer<typeof memberInputSchema>;
export type MemberPatch = z.infer<typeof memberPatchSchema>;
export type OfferingGroupInput = z.infer<typeof offeringGroupInputSchema>;
export type OfferingInput = z.infer<typeof offeringInputSchema>;
export type OfferingPatch = z.infer<typeof offeringPatchSchema>;
export type SessionInput = z.infer<typeof sessionInputSchema>;
export type SessionPatch = z.infer<typeof sessionPatchSchema>;
export type MembershipInput = z.infer<typeof membershipInputSchema>;
export type PaymentInput = z.infer<typeof paymentInputSchema>;
export type PlanPatch = z.infer<typeof planPatchSchema>;
export type DocumentPatch = z.infer<typeof documentPatchSchema>;

// ── Responses ─────────────────────────────────────────────────────────────────

export const meResponseSchema = z.object({ staff: staffSchema, business: businessSchema });
export const staffListResponseSchema = z.object({ staff: z.array(staffSchema) });

export const dashboardResponseSchema = z.object({
  date: isoDate,
  today: z.array(sessionViewSchema),
  tomorrow: z.array(sessionViewSchema),
  /** Unpaid first, then expiring by days left. */
  attention: z.array(memberSummarySchema),
  counts: z.object({
    active_members: z.number().int(),
    expiring_this_week: z.number().int(),
    unpaid_members: z.number().int(),
    debts_total_cents: cents,
    payments_this_month_cents: cents,
  }),
  currency: z.literal('EUR'),
});

export const membersResponseSchema = z.object({
  members: z.array(memberSummarySchema),
  /** Counts per status for the filter chips, after `q` but before `status`. */
  counts: z.object({
    all: z.number().int(),
    active: z.number().int(),
    expiring: z.number().int(),
    unpaid: z.number().int(),
    frozen: z.number().int(),
    trial: z.number().int(),
    none: z.number().int(),
  }),
});

export const memberResponseSchema = z.object({ member: memberSchema, summary: memberSummarySchema });

export const memberDetailResponseSchema = memberResponseSchema.extend({
  visits: z.array(memberVisitSchema),
  payments: z.array(paymentViewSchema),
  documents: z.array(documentSchema),
});

export const offeringGroupsResponseSchema = z.object({ groups: z.array(offeringGroupSchema) });
export const offeringGroupResponseSchema = z.object({ group: offeringGroupSchema });
export const offeringsResponseSchema = z.object({ offerings: z.array(offeringViewSchema) });
export const offeringResponseSchema = z.object({ offering: offeringSchema });

export const sessionsResponseSchema = z.object({ sessions: z.array(sessionViewSchema) });
export const sessionResponseSchema = z.object({ session: sessionViewSchema });
export const sessionDetailResponseSchema = z.object({ session: sessionViewSchema, attendees: z.array(attendeeSchema) });

export const visitResponseSchema = z.object({ visit: visitSchema, summary: memberSummarySchema });

export const plansResponseSchema = z.object({ plans: z.array(planSchema) });
export const planResponseSchema = z.object({ plan: planSchema });

export const membershipResponseSchema = z.object({ membership: membershipSchema, summary: memberSummarySchema });

export const paymentsResponseSchema = z.object({
  from: isoDate,
  to: isoDate,
  payments: z.array(paymentViewSchema),
  total_cents: cents,
  currency: z.literal('EUR'),
});
export const paymentResponseSchema = z.object({ payment: paymentSchema, summary: memberSummarySchema });

export const documentResponseSchema = z.object({ document: documentSchema });

export type MeResponse = z.infer<typeof meResponseSchema>;
export type StaffListResponse = z.infer<typeof staffListResponseSchema>;
export type DashboardResponse = z.infer<typeof dashboardResponseSchema>;
export type MembersResponse = z.infer<typeof membersResponseSchema>;
export type MemberResponse = z.infer<typeof memberResponseSchema>;
export type MemberDetailResponse = z.infer<typeof memberDetailResponseSchema>;
export type OfferingGroupsResponse = z.infer<typeof offeringGroupsResponseSchema>;
export type OfferingGroupResponse = z.infer<typeof offeringGroupResponseSchema>;
export type OfferingResponse = z.infer<typeof offeringResponseSchema>;
export type SessionResponse = z.infer<typeof sessionResponseSchema>;
export type OfferingsResponse = z.infer<typeof offeringsResponseSchema>;
export type SessionsResponse = z.infer<typeof sessionsResponseSchema>;
export type SessionDetailResponse = z.infer<typeof sessionDetailResponseSchema>;
export type VisitResponse = z.infer<typeof visitResponseSchema>;
export type PlansResponse = z.infer<typeof plansResponseSchema>;
export type PlanResponse = z.infer<typeof planResponseSchema>;
export type MembershipResponse = z.infer<typeof membershipResponseSchema>;
export type PaymentsResponse = z.infer<typeof paymentsResponseSchema>;
export type PaymentResponse = z.infer<typeof paymentResponseSchema>;
export type DocumentResponse = z.infer<typeof documentResponseSchema>;

// ── Sync (iOS) ────────────────────────────────────────────────────────────────

/** A row as the client sends it: the server sets business_id, and created_at on first insert. */
const serverSet = { business_id: true, created_at: true } as const;
const optionalCreated = { created_at: isoDateTime.optional() };

export const syncPushRowSchemas = {
  offering_group: offeringGroupSchema.omit(serverSet).extend(optionalCreated),
  offering: offeringSchema.omit(serverSet).extend(optionalCreated),
  session: sessionSchema.omit(serverSet).extend(optionalCreated),
  member: memberSchema.omit(serverSet).extend(optionalCreated),
  membership: membershipSchema.omit(serverSet).extend(optionalCreated),
  visit: visitSchema.omit(serverSet).extend(optionalCreated),
  payment: paymentSchema.omit(serverSet).extend(optionalCreated),
};
export const SYNC_PUSH_TABLES = ['offering_group', 'offering', 'session', 'member', 'membership', 'visit', 'payment'] as const satisfies ReadonlyArray<keyof typeof syncPushRowSchemas>;
export type SyncPushTable = (typeof SYNC_PUSH_TABLES)[number];

export const syncMutationSchema = z.object({
  table: z.enum(SYNC_PUSH_TABLES),
  /** The whole row. Set deleted_at to delete. Last write wins by updated_at. */
  row: z.record(z.string(), z.unknown()),
});

export const syncPushSchema = z.object({ mutations: z.array(syncMutationSchema).max(500) });

export const syncQuerySchema = z.object({
  /** The cursor from the previous pull. Left out: everything. */
  since: isoDateTime.optional(),
});

export const syncPullResponseSchema = z.object({
  /** Pass back as `since` next time. */
  cursor: isoDateTime,
  /** Changed rows per table, soft-deleted ones included. */
  changes: z.object({
    location: z.array(locationSchema),
    staff: z.array(staffSchema),
    offering_group: z.array(offeringGroupSchema),
    offering: z.array(offeringSchema),
    session: z.array(sessionSchema),
    plan: z.array(planSchema),
    member: z.array(memberSchema),
    membership: z.array(membershipSchema),
    visit: z.array(visitSchema),
    payment: z.array(paymentSchema),
    document: z.array(documentSchema),
  }),
});

export const syncPushResponseSchema = z.object({
  applied: z.number().int(),
  /** The server had a newer row; it is returned for the client to log and adopt. */
  conflicts: z.array(z.object({ index: z.number().int(), table: z.string(), id: z.string(), server: z.record(z.string(), z.unknown()) })),
  /** Rows that could not be applied (bad data, or a row that belongs elsewhere). */
  rejected: z.array(z.object({ index: z.number().int(), table: z.string(), id: z.string().nullable(), code: errorCodeSchema, fields: z.array(z.string()).optional() })),
  cursor: isoDateTime,
});

export type SyncPullResponse = z.infer<typeof syncPullResponseSchema>;
export type SyncPushResponse = z.infer<typeof syncPushResponseSchema>;
