// ============================================================
// Administration : connexion par identité Telegram vérifiée
// côté serveur (aucun mot de passe), puis actions sécurisées
// via l'Edge Function admin-api.
// ============================================================

import { telegramLogin, adminCall } from './api.js';

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

// Tente une connexion admin en utilisant les données Telegram signées
// disponibles automatiquement quand l'app tourne dans Telegram.
export async function tryAdminLogin(tg) {
  if (!tg || !tg.initData) {
    throw new Error('not_in_telegram');
  }
  const result = await telegramLogin(tg.initData);
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

// ---------- Médias (photos / vidéos) ----------
export function createUploadUrl({ product_id, file_name }) {
  return callAdmin({ action: 'create_upload_url', product_id, file_name });
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
