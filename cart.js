// ============================================================
// Panier : quantités par variante, calcul du sous-total avec
// lots dégressifs et promotions, redirection de commande.
// ============================================================

import { effectivePrice } from './products.js';

const CART_KEY = 'legendlabs_cart_v1';

export function loadCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}
export function saveCart(cart) {
  try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch { /* stockage indisponible, tant pis */ }
}

// cart shape: { [variantId]: qty }
export function addToCart(cart, variantId, qty = 1) {
  const next = { ...cart, [variantId]: (cart[variantId] || 0) + qty };
  saveCart(next);
  return next;
}
export function setQty(cart, variantId, qty) {
  const next = { ...cart };
  if (qty <= 0) delete next[variantId];
  else next[variantId] = qty;
  saveCart(next);
  return next;
}
export function clearCart() {
  saveCart({});
  return {};
}

export function findVariant(products, variantId) {
  for (const p of products) {
    const v = (p.variants || []).find(v => v.id === variantId);
    if (v) return { product: p, variant: v };
  }
  return null;
}

export function computeCartLines(cart, products) {
  return Object.entries(cart).map(([variantId, qty]) => {
    const found = findVariant(products, variantId);
    if (!found) return null;
    const { product, variant } = found;
    const unitPrice = effectivePrice(variant, qty);
    return { product, variant, qty, unitPrice, lineTotal: Math.round(unitPrice * qty * 100) / 100 };
  }).filter(Boolean);
}

export function cartTotal(lines) {
  return Math.round(lines.reduce((sum, l) => sum + l.lineTotal, 0) * 100) / 100;
}

export function isSafeUrl(url) {
  try {
    const u = new URL(url, window.location.href);
    return ['https:', 'http:', 'mailto:', 'tel:'].includes(u.protocol);
  } catch { return false; }
}

export function goToCheckout(contactLink, tg) {
  if (!isSafeUrl(contactLink)) { alert('Lien de contact invalide.'); return; }
  if (tg && tg.openLink) tg.openLink(contactLink);
  else window.open(contactLink, '_blank', 'noopener,noreferrer');
}
