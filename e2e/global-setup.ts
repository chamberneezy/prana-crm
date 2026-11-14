import { ensureUser } from '../scripts/emulator-user.mjs';
import { OWNER, STRANGER, TEACHER } from './users';

// The Auth emulator starts empty: create the allowlisted owner, a teacher, and an account with no access.
export default async function globalSetup() {
  await ensureUser(OWNER.email, OWNER.password);
  await ensureUser(STRANGER.email, STRANGER.password);
  await ensureUser(TEACHER.email, TEACHER.password);
}
