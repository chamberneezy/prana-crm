-- Who teaches each class type: a JSON list of staff ids, in order (the first is the default for new sessions).
-- Teachers can be added by name only: they have no e-mail, so they can't sign in. The unique e-mail index now
-- ignores the empty address, so several such teachers can exist.

ALTER TABLE offering ADD COLUMN teacher_ids TEXT NOT NULL DEFAULT '[]';

DROP INDEX staff_email;
CREATE UNIQUE INDEX staff_email ON staff(email) WHERE deleted_at IS NULL AND email <> '';
