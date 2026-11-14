// Starts everything for local development: the Auth and Firestore emulators, the API and the web app.
// Sign in at http://localhost:5173 with the account below.
import { spawn } from 'node:child_process';
import { ensureUser, waitForEmulator } from './emulator-user.mjs';

const DEV_USER = { email: 'mario@prana.test', password: 'prana-dev' };
// A sample teacher, to see what a teacher's access shows.
const DEV_TEACHER = { email: 'petra@prana.test', password: 'prana-dev' };

const children = [
  spawn('npx', ['firebase', 'emulators:start', '--only', 'auth,firestore', '--project', 'prana-crm'], { stdio: 'inherit' }),
  spawn('npm', ['run', 'dev', '-w', '@prana/api'], { stdio: 'inherit' }),
  spawn('npm', ['run', 'dev', '-w', '@prana/web'], { stdio: 'inherit' }),
];

// SIGINT (as Ctrl-C) lets the Firebase CLI stop the Firestore emulator (Java) too; SIGTERM would leave it running.
const stop = () => {
  for (const child of children) child.kill('SIGINT');
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const child of children) child.on('exit', stop);

await waitForEmulator();
await ensureUser(DEV_USER.email, DEV_USER.password);
await ensureUser(DEV_TEACHER.email, DEV_TEACHER.password);
console.log(`\nSign in at http://localhost:5173 with ${DEV_USER.email} / ${DEV_USER.password} (owner)`);
console.log(`or ${DEV_TEACHER.email} / ${DEV_TEACHER.password} (teacher)\n`);
