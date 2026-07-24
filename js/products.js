// ============================================================
// Chargement et calculs liés au catalogue.
// ============================================================

import { restGet, rpcIncrementLikes } from './api.js?v20260726b';

export async function loadCategories() {
  return restGet('categories?select=*&order=sort_order.asc');
}
export async function loadSubcategories() {
  return restGet('subcategories?select=*&order=sort_order.asc');
}
export async function loadProducts() {
  const select = 'products?select=*,media:product_media(*),variants:product_variants(*,lots:product_lots(*))&order=sort_order.asc';
  return restGet(select);
}
export async function loadActivePromotions() {
  return restGet('active_promotions?select=*');
}
export async function loadSettings() {
  const rows = await restGet('app_settings?select=key,value');
  const out = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}
export async function loadContactLinks() {
  return restGet('contact_links?select=*&order=sort_order.asc');
}
export async function loadReviews() {
  return restGet('reviews?select=*&order=created_at.desc');
}
export async function loadNotifications() {
  return restGet('notifications?select=*&order=created_at.desc&limit=30');
}
export async function loadBanners() {
  return restGet('banners?select=*&order=sort_order.asc');
}
export function reviewsSummary(reviews) {
  const total = reviews.length;
  if (!total) return { average: 0, total: 0, counts: [0, 0, 0, 0, 0] };
  const counts = [0, 0, 0, 0, 0]; // index 0 = 1 étoile ... index 4 = 5 étoiles
  let sum = 0;
  reviews.forEach(r => { counts[r.rating - 1]++; sum += r.rating; });
  return { average: Math.round((sum / total) * 10) / 10, total, counts };
}

// Incrémente le compteur "J'aime" d'un produit (fonction serveur dédiée,
// ne permet de modifier que ce compteur, rien d'autre sur le produit).
export async function likeProduct(productId) {
  return rpcIncrementLikes(productId);
}

// Rattache à chaque variante la promotion active qui s'y applique (si elle existe)
export function attachPromotions(products, promotions) {
  return products.map(p => {
    const variants = (p.variants || []).map(v => {
      const promo = promotions.find(pr => pr.variant_id === v.id)
        || promotions.find(pr => pr.product_id === p.id && !pr.variant_id);
      return { ...v, promo: promo || null };
    });
    return { ...p, variants };
  });
}

// Prix unitaire effectif pour une variante, une quantité donnée :
// applique d'abord le meilleur palier de lot atteint, puis la promotion active.
export function effectivePrice(variant, qty = 1) {
  let unitPrice = Number(variant.price);
  const lots = (variant.lots || [])
    .filter(l => l.quantity <= qty)
    .sort((a, b) => b.quantity - a.quantity);
  if (lots.length) unitPrice = Number(lots[0].price) / lots[0].quantity;

  if (variant.promo) {
    if (variant.promo.type === 'percent') unitPrice = unitPrice * (1 - Number(variant.promo.value) / 100);
    else if (variant.promo.type === 'fixed') unitPrice = Math.max(0, unitPrice - Number(variant.promo.value));
  }
  return Math.round(unitPrice * 100) / 100;
}

export function isLowStock(variant, threshold = 5) {
  return variant.stock > 0 && variant.stock <= threshold;
}
export function isOutOfStock(variant) {
  return !variant.stock || variant.stock <= 0;
}

// Recherche + filtres instantanés (nom, description, catégorie, sous-catégorie)
export function searchProducts(products, { query = '', categoryId = 'all', subcategoryId = 'all', onlyPromo = false, onlyNew = false } = {}) {
  const q = query.trim().toLowerCase();
  return products.filter(p => {
    if (p.is_hidden) return false; // sécurité supplémentaire : jamais visible côté boutique
    if (categoryId !== 'all' && p.category_id !== categoryId) return false;
    if (subcategoryId !== 'all' && p.subcategory_id !== subcategoryId) return false;
    if (onlyPromo && !(p.variants || []).some(v => v.promo)) return false;
    if (onlyNew && !p.is_featured) return false;
    if (!q) return true;
    const haystack = `${p.name} ${p.description || ''}`.toLowerCase();
    return haystack.includes(q);
  });
}
