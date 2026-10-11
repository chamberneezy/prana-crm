// Starts everything for local development: the Auth emulator, the API and the web app.
// Sign in at http://localhost:5173 with the account below.
import { spawn } from 'node:child_process';
import { ensureUser, waitForEmulator } from './emulator-user.mjs';

const DEV_USER = { email: 'mario@prana.test', password: 'prana-dev' };

const children = [
  spawn('npx', ['firebase', 'emulators:start', '--only', 'auth', '--project', 'prana-crm'], { stdio: 'inherit' }),
  spawn('npm', ['run', 'dev', '-w', '@prana/api'], { stdio: 'inherit' }),
  spawn('npm', ['run', 'dev', '-w', '@prana/web'], { stdio: 'inherit' }),
];

const stop = () => {
  for (const child of children) child.kill('SIGTERM');
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const child of children) child.on('exit', stop);

await waitForEmulator();
await ensureUser(DEV_USER.email, DEV_USER.password);
console.log(`\nSign in at http://localhost:5173 with ${DEV_USER.email} / ${DEV_USER.password}\n`);
