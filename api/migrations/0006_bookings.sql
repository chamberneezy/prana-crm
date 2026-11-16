-- Najave: members signing up for a session from the studio's app, without an account, by first and last name.
-- Not visits: they count toward nothing until staff check the member in. Only a hash of the cancel token is kept;
-- the app that made the sign-up holds the token itself. One live sign-up per member and session.
CREATE TABLE booking (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES business(id),
  session_id TEXT NOT NULL REFERENCES session(id),
  member_id TEXT NOT NULL REFERENCES member(id),
  cancel_token_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  changed_at TEXT NOT NULL
);
CREATE UNIQUE INDEX booking_session_member ON booking(session_id, member_id) WHERE deleted_at IS NULL;
CREATE INDEX booking_business ON booking(business_id);
