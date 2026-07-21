// ============================================================
// Couche d'accès aux données : REST Supabase (lecture publique)
// + appels aux Edge Functions (authentification et écritures admin).
// ============================================================

import { SUPABASE_URL, SUPABASE_ANON_KEY, TELEGRAM_AUTH_URL, ADMIN_API_URL } from './config.js';

const REST = `${SUPABASE_URL}/rest/v1`;

function restHeaders() {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  };
}

export async function restGet(path) {
  const res = await fetch(`${REST}/${path}`, { headers: restHeaders() });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Erreur API (${res.status}) sur ${path} — ${body}`);
  }
  return res.json();
}

export async function telegramLogin(initData) {
  const res = await fetch(TELEGRAM_AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'auth_failed');
  return data; // { token, expires_at, name }
}

export async function adminCall(sessionToken, payload) {
  const res = await fetch(ADMIN_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'admin_call_failed');
  return data;
}
