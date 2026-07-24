// ============================================================
// Accès global à la mini-app : mot de passe unique, vérifié
// côté serveur (voir Edge Function global-password-auth).
// Le mot de passe n'est jamais comparé côté client. Le token
// obtenu n'est gardé qu'en mémoire (jamais dans localStorage/
// sessionStorage) — une fermeture complète de l'app le fait
// disparaître, comme pour la session admin.
// ============================================================

import { GLOBAL_PASSWORD_AUTH_URL } from './config.js?v20260725b';

let accessToken = null;

export function hasAppAccess() {
  return !!accessToken;
}

export async function submitGlobalPassword(password) {
  const res = await fetch(GLOBAL_PASSWORD_AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'invalid_password');
  accessToken = data.token;
  return true;
}
