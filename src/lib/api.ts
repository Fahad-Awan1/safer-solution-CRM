import { User } from '../types';

let currentUserId = '';
let currentSessionToken = '';

export function setCurrentUserId(userId: string, token?: string) {
  currentUserId = userId;
  localStorage.setItem('crm_active_user_id', userId);
  if (token) {
    currentSessionToken = token;
    localStorage.setItem('crm_session_token', token);
  }
}

export function getCurrentUserId(): string {
  const stored = localStorage.getItem('crm_active_user_id');
  if (stored) return stored;
  return currentUserId;
}

export function getSessionToken(): string {
  if (currentSessionToken) return currentSessionToken;
  const stored = localStorage.getItem('crm_session_token');
  if (stored) return stored;
  return '';
}

export function clearAuthSession() {
  currentUserId = '';
  currentSessionToken = '';
  localStorage.removeItem('crm_active_user_id');
  localStorage.removeItem('crm_session_token');
}

export async function apiFetch<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const userId = getCurrentUserId();
  const token = getSessionToken();

  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }
  if (userId) {
    headers.set('x-user-id', userId);
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('x-session-token', token);
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMsg = `HTTP Error ${response.status}`;
    try {
      const errJson = await response.json();
      if (errJson.error) errorMsg = errJson.error;
    } catch (_) {}
    throw new Error(errorMsg);
  }

  return response.json();
}
