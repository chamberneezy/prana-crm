// Creates a user in the local Firebase Auth emulator (it starts empty every time). Safe to call twice.
export const EMULATOR_URL = 'http://127.0.0.1:9099';

export async function ensureUser(email, password) {
  const res = await fetch(`${EMULATOR_URL}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: false }),
  });
  if (res.ok) return;
  const body = await res.json().catch(() => null);
  if (body?.error?.message !== 'EMAIL_EXISTS') throw new Error(`Could not create ${email} in the Auth emulator: ${body?.error?.message ?? res.status}`);
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
