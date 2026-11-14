-- First and last name as separate fields. full_name stays, always "first last", for lists, search and sorting.
-- Existing members are split at the first space: the first word is the first name, the rest the last name.

ALTER TABLE member ADD COLUMN first_name TEXT NOT NULL DEFAULT '';
ALTER TABLE member ADD COLUMN last_name TEXT NOT NULL DEFAULT '';

UPDATE member SET
  first_name = CASE WHEN instr(trim(full_name), ' ') > 0 THEN substr(trim(full_name), 1, instr(trim(full_name), ' ') - 1) ELSE trim(full_name) END,
  last_name = CASE WHEN instr(trim(full_name), ' ') > 0 THEN trim(substr(trim(full_name), instr(trim(full_name), ' ') + 1)) ELSE '' END,
  changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');
