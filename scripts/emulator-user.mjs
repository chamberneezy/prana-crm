// Creates a user in the local Firebase Auth emulator (it starts empty every time). Safe to call twice.
export const EMULATOR_URL = 'http://127.0.0.1:9099';
export const FIRESTORE_EMULATOR_URL = 'http://127.0.0.1:8080';

const ACCOUNTS = `${EMULATOR_URL}/identitytoolkit.googleapis.com/v1`;

async function post(path, body, headers = {}) {
  const res = await fetch(`${ACCOUNTS}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  return { ok: res.ok, body: await res.json().catch(() => null), status: res.status };
}

export async function ensureUser(email, password) {
  let res = await post('accounts:signUp?key=fake-api-key', { email, password, returnSecureToken: false });
  if (!res.ok && res.body?.error?.message === 'EMAIL_EXISTS') res = await post('accounts:signInWithPassword?key=fake-api-key', { email, password, returnSecureToken: false });
  if (!res.ok) throw new Error(`Could not create ${email} in the Auth emulator: ${res.body?.error?.message ?? res.status}`);
  // Mark the address verified, as a real Google sign-in is: the Firestore rules accept only verified owners.
  const verified = await post('projects/prana-crm/accounts:update', { localId: res.body.localId, emailVerified: true }, { Authorization: 'Bearer owner' });
  if (!verified.ok) throw new Error(`Could not verify ${email} in the Auth emulator: ${verified.body?.error?.message ?? verified.status}`);
}

export async function waitForEmulator(timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      await fetch(EMULATOR_URL);
      return;
    } catch {
      if (Date.now() > deadline) throw new Error('The Firebase Auth emulator did not start.');
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
}
