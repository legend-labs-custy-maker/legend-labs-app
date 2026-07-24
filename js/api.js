// ============================================================
// Couche d'accès aux données : REST Supabase (lecture publique)
// + appels aux Edge Functions (authentification et écritures admin).
// ============================================================

import { SUPABASE_URL, SUPABASE_ANON_KEY, TELEGRAM_AUTH_URL, ADMIN_API_URL, VALIDATE_PROMO_URL, ADMIN_LOGIN_URL } from './config.js?v20260726';

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

// Appelle une fonction Postgres exposée en RPC (ex: incrémenter un compteur
// de façon contrôlée, sans donner d'accès en écriture à toute la table).
export async function rpcIncrementLikes(productId) {
  const res = await fetch(`${REST}/rpc/increment_product_likes`, {
    method: 'POST',
    headers: restHeaders(),
    body: JSON.stringify({ p_product_id: productId }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Erreur lors du like (${res.status}) — ${body}`);
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

// Enregistre/synchronise la fiche du visiteur courant (pas de session,
// aucun privilège — juste une fiche utilisateur à jour côté serveur).
export async function registerUser(initData) {
  const res = await fetch(TELEGRAM_AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData, action: 'register_user' }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'register_failed');
  return data.user; // { telegram_id, first_name, last_name, username, photo_url, preferences, created_at }
}

// ---------- Favoris (synchronisés par compte Telegram) ----------
async function favoriteCall(payload) {
  const res = await fetch(TELEGRAM_AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'favorite_failed');
  return data;
}
export function addFavorite(initData, product_id) {
  return favoriteCall({ initData, action: 'add_favorite', product_id });
}
export function removeFavorite(initData, product_id) {
  return favoriteCall({ initData, action: 'remove_favorite', product_id });
}
export async function listFavorites(initData) {
  const data = await favoriteCall({ initData, action: 'list_favorites' });
  return data.productIds || [];
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

// Facteurs 2 (email + mot de passe) et 3 (TOTP) de la connexion admin —
// voir js/admin.js pour le détail du déroulé.
export async function adminLoginCall(payload) {
  const res = await fetch(ADMIN_LOGIN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'admin_login_failed');
  return data;
}

// Upload direct du fichier vers Supabase Storage (ne passe pas par l'Edge Function,
// donc pas limité par sa taille de requête — jusqu'à 50 Mo, la limite du bucket).
export async function uploadToSignedUrl({ bucket, path, token, file }) {
  const url = `${SUPABASE_URL}/storage/v1/object/upload/sign/${bucket}/${path}?token=${encodeURIComponent(token)}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': file.type || 'application/octet-stream',
      'x-upsert': 'false',
    },
    body: file,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Échec de l'upload (${res.status}) — ${body}`);
  }
}
export function publicMediaUrl(bucket, path) {
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

// Validation d'un code promo — endpoint public, aucune authentification requise.
export async function validatePromoCode(code, cartTotal) {
  const res = await fetch(VALIDATE_PROMO_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, cartTotal }),
  });
  return res.json(); // { valid, reason? , type?, value?, code? }
}
