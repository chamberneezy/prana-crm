/** Why a sign-in attempt did not work. `cancelled` (the owner closed the pop-up) needs no message. */
export type SignInProblem = 'wrong' | 'cancelled' | 'failed';

export class SignInFailure extends Error {
  constructor(readonly problem: SignInProblem) {
    super(problem);
  }
}

/** What the app needs from sign-in, whoever provides it. */
export interface AuthSession {
  /** Calls back now and whenever someone signs in or out. Returns a function that stops it. */
  onChange(callback: (signedIn: boolean) => void): () => void;
  /** The token the API checks, or null when nobody is signed in. */
  getToken(forceRefresh?: boolean): Promise<string | null>;
  signInWithEmail(email: string, password: string): Promise<void>;
  signInWithProvider(provider: 'apple' | 'google'): Promise<void>;
  /** Sends the e-mail for setting a new password. Resolves whether or not the address has an account. */
  sendPasswordReset(email: string): Promise<void>;
  /** The signed-in person's e-mail, lower-cased, or null. */
  email(): string | null;
  signOut(): Promise<void>;
}
