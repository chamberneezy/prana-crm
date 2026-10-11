-- Prana CRM schema. IDs are UUIDv7 text. Dates are YYYY-MM-DD, instants are UTC ISO 8601.
-- updated_at is when the row was last edited (sync resolves conflicts by it);
-- changed_at is when the server last wrote it (the sync cursor).

CREATE TABLE business (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'hr',
  timezone TEXT NOT NULL DEFAULT 'Europe/Zagreb',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE location (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES business(id),
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  changed_at TEXT NOT NULL
);
CREATE INDEX location_business ON location(business_id);

CREATE TABLE staff (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES business(id),
  firebase_uid TEXT,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'teacher', 'front_desk')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  changed_at TEXT NOT NULL
);
CREATE UNIQUE INDEX staff_firebase_uid ON staff(firebase_uid) WHERE firebase_uid IS NOT NULL;
CREATE UNIQUE INDEX staff_email ON staff(email) WHERE deleted_at IS NULL;
CREATE INDEX staff_business ON staff(business_id);

CREATE TABLE offering_group (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES business(id),
  name TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  changed_at TEXT NOT NULL
);
CREATE INDEX offering_group_business ON offering_group(business_id);

CREATE TABLE offering (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES business(id),
  group_id TEXT NOT NULL REFERENCES offering_group(id),
  name TEXT NOT NULL,
  color_token TEXT NOT NULL,
  default_duration_min INTEGER NOT NULL,
  entry_rule TEXT,
  default_capacity INTEGER,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  changed_at TEXT NOT NULL
);
CREATE INDEX offering_business ON offering(business_id);

CREATE TABLE session (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES business(id),
  location_id TEXT NOT NULL REFERENCES location(id),
  offering_id TEXT NOT NULL REFERENCES offering(id),
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  teacher_staff_id TEXT REFERENCES staff(id),
  capacity INTEGER,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  changed_at TEXT NOT NULL
);
CREATE INDEX session_business_starts ON session(business_id, starts_at);

CREATE TABLE member (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES business(id),
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  dob TEXT,
  is_student_or_retired INTEGER NOT NULL DEFAULT 0,
  health_flag INTEGER NOT NULL DEFAULT 0,
  health_text TEXT,
  consent_accuracy INTEGER NOT NULL DEFAULT 0,
  consent_news INTEGER NOT NULL DEFAULT 0,
  signed_place TEXT,
  signed_date TEXT,
  member_since TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  changed_at TEXT NOT NULL
);
CREATE INDEX member_business ON member(business_id);

CREATE TABLE plan (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES business(id),
  code TEXT NOT NULL CHECK (code IN ('1x', '2x', '3x', 'unl', 'trial')),
  name TEXT NOT NULL,
  visits_per_month INTEGER,
  price_cents INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  changed_at TEXT NOT NULL
);
CREATE INDEX plan_business ON plan(business_id);

CREATE TABLE membership (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES business(id),
  member_id TEXT NOT NULL REFERENCES member(id),
  plan_id TEXT NOT NULL REFERENCES plan(id),
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  frozen_until TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  changed_at TEXT NOT NULL
);
CREATE INDEX membership_business_end ON membership(business_id, period_end);
CREATE INDEX membership_member ON membership(member_id);

CREATE TABLE visit (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES business(id),
  member_id TEXT NOT NULL REFERENCES member(id),
  session_id TEXT NOT NULL REFERENCES session(id),
  membership_id TEXT REFERENCES membership(id),
  checked_in_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  changed_at TEXT NOT NULL
);
CREATE INDEX visit_business ON visit(business_id);
CREATE INDEX visit_member ON visit(member_id);
CREATE INDEX visit_membership ON visit(membership_id);
-- A member is checked in to a session once.
CREATE UNIQUE INDEX visit_session_member ON visit(session_id, member_id) WHERE deleted_at IS NULL;

CREATE TABLE payment (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES business(id),
  member_id TEXT NOT NULL REFERENCES member(id),
  membership_id TEXT REFERENCES membership(id),
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  method TEXT NOT NULL CHECK (method IN ('cash', 'card', 'transfer')),
  paid_at TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  changed_at TEXT NOT NULL
);
CREATE INDEX payment_business_paid ON payment(business_id, paid_at);
CREATE INDEX payment_member ON payment(member_id);
CREATE INDEX payment_membership ON payment(membership_id);

CREATE TABLE document (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES business(id),
  member_id TEXT REFERENCES member(id),
  kind TEXT NOT NULL DEFAULT 'upisnica',
  r2_key TEXT NOT NULL,
  mime TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('camera', 'pdf', 'image')),
  filename TEXT,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  ocr_json TEXT,
  created_by TEXT NOT NULL REFERENCES staff(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  changed_at TEXT NOT NULL
);
CREATE INDEX document_business ON document(business_id);
CREATE INDEX document_member ON document(member_id);
