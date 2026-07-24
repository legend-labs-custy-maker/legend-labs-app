// ============================================================
// Administration : authentification à 3 facteurs.
//   1. Identité Telegram vérifiée côté serveur (tryAdminLogin)
//   2. Email + mot de passe (adminLoginStart)
//   3. TOTP — enrôlement la première fois (adminVerifyEnrollment),
//      code à chaque connexion suivante (adminVerifyMfa)
// La vraie session admin (utilisée pour admin-api) n'est délivrée
// qu'après le succès des 3 facteurs.
// ============================================================

import { telegramLogin, adminLoginCall, adminCall } from './api.js?v20260726';

let session = null; // { token, expires_at, name } — en mémoire uniquement, jamais persisté

export function isAdminLoggedIn() {
  return !!(session && new Date(session.expires_at) > new Date());
}
export function currentAdminName() {
  return session?.name || null;
}
export function logoutAdmin() {
  session = null;
}

// Facteur 1 : identité Telegram. Ne délivre plus de session admin —
// seulement un "challenge" de courte durée prouvant que ce Telegram ID
// vient d'être vérifié, à utiliser pour les Facteurs 2 et 3.
export async function tryAdminLogin(tg) {
  if (!tg || !tg.initData) {
    throw new Error('not_in_telegram');
  }
  return await telegramLogin(tg.initData); // { challenge_token, expires_at, requires_admin_login }
}

// Facteur 2 : email + mot de passe. Retourne soit un besoin
// d'enrôlement TOTP (première connexion), soit un challenge TOTP
// classique (connexions suivantes) — jamais directement une session.
export async function adminLoginStart(challengeToken, email, password) {
  return await adminLoginCall({ action: 'start', challenge_token: challengeToken, email, password });
}

// Facteur 3a : confirme le tout premier enrôlement TOTP -> session admin
export async function adminVerifyEnrollment(challengeToken, accessToken, factorId, code) {
  const result = await adminLoginCall({ action: 'verify_enrollment', challenge_token: challengeToken, access_token: accessToken, factor_id: factorId, code });
  session = result;
  return result;
}

// Facteur 3b : vérifie un code TOTP classique -> session admin
export async function adminVerifyMfa(challengeToken, accessToken, factorId, mfaChallengeId, code) {
  const result = await adminLoginCall({ action: 'verify_mfa', challenge_token: challengeToken, access_token: accessToken, factor_id: factorId, mfa_challenge_id: mfaChallengeId, code });
  session = result;
  return result;
}

async function callAdmin(payload) {
  if (!isAdminLoggedIn()) throw new Error('session_expired');
  try {
    return await adminCall(session.token, payload);
  } catch (err) {
    if (String(err.message).includes('session_expired')) session = null;
    throw err;
  }
}

// ---------- Réglages généraux ----------
export function saveSetting(key, value) {
  return callAdmin({ table: 'app_settings', action: 'upsert', data: { key, value } });
}

// Vue complète (catégories/produits masqués inclus) — à utiliser à
// l'ouverture du panneau admin, jamais pour l'affichage public.
export function loadAdminData() {
  return callAdmin({ action: 'list_admin_data' });
}

// Statistiques du tableau de bord — jamais de chiffre d'affaires,
// uniquement des compteurs d'usage/contenu.
export function loadDashboardStats() {
  return callAdmin({ action: 'dashboard_stats' });
}

// ---------- Catégories ----------
export function createCategory(data) {
  return callAdmin({ table: 'categories', action: 'insert', data });
}
export function updateCategory(id, data) {
  return callAdmin({ table: 'categories', action: 'update', id, data });
}
export function deleteCategory(id) {
  return callAdmin({ table: 'categories', action: 'delete', id });
}
export function createSubcategory(data) {
  return callAdmin({ table: 'subcategories', action: 'insert', data });
}
export function deleteSubcategory(id) {
  return callAdmin({ table: 'subcategories', action: 'delete', id });
}

// ---------- Produits ----------
export function createProduct(data) {
  return callAdmin({ table: 'products', action: 'insert', data });
}
export function updateProduct(id, data) {
  return callAdmin({ table: 'products', action: 'update', id, data });
}
export function deleteProduct(id) {
  return callAdmin({ table: 'products', action: 'delete', id });
}

// ---------- Variantes / lots / promotions ----------
export function createVariant(data) {
  return callAdmin({ table: 'product_variants', action: 'insert', data });
}
export function updateVariant(id, data) {
  return callAdmin({ table: 'product_variants', action: 'update', id, data });
}
export function deleteVariant(id) {
  return callAdmin({ table: 'product_variants', action: 'delete', id });
}
export function createLot(data) {
  return callAdmin({ table: 'product_lots', action: 'insert', data });
}
export function deleteLot(id) {
  return callAdmin({ table: 'product_lots', action: 'delete', id });
}
export function createPromotion(data) {
  return callAdmin({ table: 'promotions', action: 'insert', data });
}
export function deletePromotion(id) {
  return callAdmin({ table: 'promotions', action: 'delete', id });
}

// ---------- Liens de contact ----------
export function createContactLink(data) {
  return callAdmin({ table: 'contact_links', action: 'insert', data });
}
export function deleteContactLink(id) {
  return callAdmin({ table: 'contact_links', action: 'delete', id });
}

// ---------- Codes promo ----------
export function createPromoCode(data) {
  return callAdmin({ table: 'promo_codes', action: 'insert', data });
}
export function deletePromoCode(id) {
  return callAdmin({ table: 'promo_codes', action: 'delete', id });
}

// ---------- Bannières ----------
export function createBanner(data) {
  return callAdmin({ table: 'banners', action: 'insert', data });
}
export function updateBanner(id, data) {
  return callAdmin({ table: 'banners', action: 'update', id, data });
}
export function deleteBanner(id) {
  return callAdmin({ table: 'banners', action: 'delete', id });
}

// ---------- Notifications ----------
export function createNotification(data) {
  return callAdmin({ table: 'notifications', action: 'insert', data });
}
export function updateNotification(id, data) {
  return callAdmin({ table: 'notifications', action: 'update', id, data });
}
export function deleteNotification(id) {
  return callAdmin({ table: 'notifications', action: 'delete', id });
}

// ---------- Avis clients ----------
export function createReview(data) {
  return callAdmin({ table: 'reviews', action: 'insert', data });
}
export function updateReview(id, data) {
  return callAdmin({ table: 'reviews', action: 'update', id, data });
}
export function deleteReview(id) {
  return callAdmin({ table: 'reviews', action: 'delete', id });
}

// ---------- Médias (photos / vidéos) ----------
export function createUploadUrl({ product_id, folder, file_name }) {
  return callAdmin({ action: 'create_upload_url', product_id, folder, file_name });
}
export function createMedia(data) {
  return callAdmin({ table: 'product_media', action: 'insert', data });
}
export function uploadMedia({ product_id, file_base64, file_name, content_type }) {
  return callAdmin({ action: 'upload_media', product_id, file_base64, file_name, content_type });
}
export function deleteMedia(id) {
  return callAdmin({ action: 'delete_media', id });
}
