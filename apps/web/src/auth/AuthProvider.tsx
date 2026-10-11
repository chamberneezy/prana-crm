import type { MeResponse } from '@prana/shared';
import { useQueryClient } from '@tanstack/react-query';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiClientError } from '../api/client';
import { auth } from './firebase';

/** Why the login screen is showing a message. */
export type AuthNotice = 'noAccess' | 'failed' | 'offline';

type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut'; notice: AuthNotice | null }
  // Signed in to Firebase and on the studio's staff list.
  | { status: 'ready'; me: MeResponse };

interface AuthContextValue {
  state: AuthState;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  const notice = useRef<AuthNotice | null>(null);
  const queryClient = useQueryClient();

  useEffect(
    () =>
      onAuthStateChanged(auth, async (user) => {
        if (!user) {
          queryClient.clear();
          setState({ status: 'signedOut', notice: notice.current });
          return;
        }
        notice.current = null;
        try {
          // Signing in to Firebase grants nothing by itself; the API decides who is staff.
          setState({ status: 'ready', me: await api<MeResponse>('GET', '/me') });
        } catch (error) {
          const code = error instanceof ApiClientError ? error.code : null;
          notice.current = code === 'no_access' ? 'noAccess' : code === 'network' ? 'offline' : 'failed';
          await firebaseSignOut(auth);
        }
      }),
    [queryClient],
  );

  const signOut = useCallback(async () => {
    notice.current = null;
    await firebaseSignOut(auth);
  }, []);

  const value = useMemo(() => ({ state, signOut }), [state, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth needs an AuthProvider above it');
  return value;
}

/** The signed-in staff member and business. Only for screens inside the shell. */
export function useMe(): MeResponse {
  const { state } = useAuth();
  if (state.status !== 'ready') throw new Error('useMe is only available after sign-in');
  return state.me;
}
