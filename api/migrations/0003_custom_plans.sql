-- The studio can add its own kinds of membership: plan.code gains 'custom'.
-- SQLite can't change a CHECK constraint, so the table is rebuilt under the same name, keeping every id.
-- Foreign keys are deferred to the end of the migration: dropping the old table leaves memberships pointing at
-- missing plans for a moment, and putting the same rows back into the new table resolves each of them.
-- (Renaming the old table away instead would repoint memberships at the old name, which is then dropped.)

PRAGMA defer_foreign_keys = true;

CREATE TABLE plan_copy AS SELECT * FROM plan;
DROP TABLE plan;
CREATE TABLE plan (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES business(id),
  code TEXT NOT NULL CHECK (code IN ('1x', '2x', '3x', 'unl', 'trial', 'custom')),
  name TEXT NOT NULL,
  visits_per_month INTEGER,
  price_cents INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  changed_at TEXT NOT NULL
);
INSERT INTO plan (id, business_id, code, name, visits_per_month, price_cents, created_at, updated_at, deleted_at, changed_at)
  SELECT id, business_id, code, name, visits_per_month, price_cents, created_at, updated_at, deleted_at, changed_at FROM plan_copy;
DROP TABLE plan_copy;
CREATE INDEX plan_business ON plan(business_id);
