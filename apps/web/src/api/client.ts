import type { ErrorCode, ErrorResponse, Lang } from '@prana/shared';
import { signOut } from 'firebase/auth';
import { auth } from '../auth/firebase';

/** An error from the API, with the server's plain-language message in both languages. */
export class ApiClientError extends Error {
  constructor(
    readonly code: ErrorCode | 'network',
    readonly status: number,
    readonly messages: { hr: string; en: string } | null,
    readonly fields: string[] = [],
  ) {
    super(code);
  }
}

async function send(method: string, path: string, body: unknown, forceRefresh: boolean): Promise<Response> {
  const token = await auth.currentUser?.getIdToken(forceRefresh);
  if (!token) throw new ApiClientError('unauthenticated', 401, null);

  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  try {
    return await fetch(`/api${path}`, { method, headers, body: payload });
  } catch {
    throw new ApiClientError('network', 0, null);
  }
}

async function request(method: string, path: string, body?: unknown): Promise<Response> {
  let res = await send(method, path, body, false);
  // A token can expire between the check and the call; try once more with a fresh one.
  if (res.status === 401) res = await send(method, path, body, true);
  if (res.ok) return res;

  let error: ErrorResponse['error'] | undefined;
  try {
    error = ((await res.json()) as ErrorResponse).error;
  } catch {
    // not our error format (e.g. the API is not running behind the proxy)
  }
  if (res.status === 401) await signOut(auth);
  if (!error) throw new ApiClientError(res.status >= 500 ? 'network' : 'internal', res.status, null);
  throw new ApiClientError(error.code, res.status, { hr: error.message_hr, en: error.message_en }, error.fields);
}

/** Calls the API as the signed-in user and returns the JSON body (undefined for 204). */
export async function api<T>(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<T> {
  const res = await request(method, path, body);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

/** Fetches a stored file. Documents have no public URL, so they can't be linked directly. */
export async function apiFile(path: string): Promise<Blob> {
  return (await request('GET', path)).blob();
}

/** The message to show for a failed call: the server's wording, or a generic one. */
export function errorMessage(error: unknown, lang: Lang, fallback: { generic: string; offline: string }): string {
  if (error instanceof ApiClientError) {
    if (error.code === 'network') return fallback.offline;
    if (error.messages) return error.messages[lang];
  }
  return fallback.generic;
}
