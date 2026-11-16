-- Days the studio is closed (holidays). Sessions on such a day stay, shown as cancelled, and nobody can check in;
-- opening the day again brings them back. One per day.
CREATE TABLE closure (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES business(id),
  date TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  changed_at TEXT NOT NULL
);
CREATE UNIQUE INDEX closure_business_date ON closure(business_id, date) WHERE deleted_at IS NULL;

-- The standard week: the classes of a usual week (weekday 1 = Monday), to start a week's plan from.
CREATE TABLE week_slot (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES business(id),
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  start_time TEXT NOT NULL,
  duration_min INTEGER NOT NULL,
  offering_id TEXT NOT NULL REFERENCES offering(id),
  teacher_staff_id TEXT REFERENCES staff(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  changed_at TEXT NOT NULL
);
CREATE INDEX week_slot_business ON week_slot(business_id);
