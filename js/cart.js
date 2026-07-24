// ============================================================
// Panier : quantités par variante, calcul du sous-total avec
// lots dégressifs et promotions, redirection de commande.
// ============================================================

import { effectivePrice } from './products.js?v20260725b';
import { validatePromoCode } from './api.js?v20260725b';

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

// Retire du panier les entrées dont le produit/la variante n'existe plus
// (supprimé ou modifié entre-temps) — évite un total affiché qui ne
// correspond plus à aucune ligne visible.
export function pruneCart(cart, products) {
  let changed = false;
  const next = {};
  for (const [variantId, qty] of Object.entries(cart)) {
    if (findVariant(products, variantId)) {
      next[variantId] = qty;
    } else {
      changed = true;
    }
  }
  if (changed) saveCart(next);
  return { cart: next, changed };
}

export function cartTotal(lines) {
  return Math.round(lines.reduce((sum, l) => sum + l.lineTotal, 0) * 100) / 100;
}

// Applique une réduction de code promo { type: 'percent'|'fixed', value } à un sous-total.
export function applyPromoDiscount(subtotal, promo) {
  if (!promo) return { discount: 0, total: subtotal };
  let discount = promo.type === 'percent' ? subtotal * (promo.value / 100) : promo.value;
  discount = Math.max(0, Math.min(discount, subtotal)); // jamais négatif, jamais plus que le sous-total
  discount = Math.round(discount * 100) / 100;
  return { discount, total: Math.round((subtotal - discount) * 100) / 100 };
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

export async function validatePromo(code, cartSubtotal) {
  return validatePromoCode(code, cartSubtotal);
}

export function promoErrorMessage(reason, minOrder) {
  switch (reason) {
    case 'not_found': return 'Code promo invalide.';
    case 'inactive': return "Ce code n'est plus actif.";
    case 'expired': return 'Ce code a expiré.';
    case 'not_started': return "Ce code n'est pas encore actif.";
    case 'max_uses_reached': return 'Ce code a atteint sa limite d\'utilisation.';
    case 'min_order': return `Montant minimum de ${minOrder} € requis pour ce code.`;
    default: return 'Impossible de vérifier ce code.';
  }
}
