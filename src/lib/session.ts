// Persists the hub owner's access token + profile across page reloads.
// The scanning/printing device is expected to stay logged in for a shift,
// so we don't want a refresh to force a re-login.

export interface HubOwnerSession {
  accessToken: string;
  refreshToken: string;
  id: string;
  phone: string;
  name?: string;
  warehouseId?: string;
}

const STORAGE_KEY = 'hubOwnerSession';

export function saveSession(session: HubOwnerSession) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // localStorage unavailable (private mode, etc.) — session just won't survive a refresh
  }
}

export function loadSession(): HubOwnerSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HubOwnerSession;
    if (!parsed.accessToken || !parsed.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function getAccessToken(): string | null {
  return loadSession()?.accessToken ?? null;
}
