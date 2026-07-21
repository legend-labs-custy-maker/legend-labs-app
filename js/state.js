// ============================================================
// État partagé entre les modules boutique et admin, et utilitaires
// communs (Telegram WebApp, retour haptique, ouverture des panneaux).
// ============================================================

import * as UI from './ui.js';

export const tg = window.Telegram ? window.Telegram.WebApp : null;
if (tg) { tg.ready(); tg.expand(); tg.setHeaderColor && tg.setHeaderColor('#0A0705'); }

export function haptic(type) {
  if (tg && tg.HapticFeedback) { try { tg.HapticFeedback.impactOccurred(type || 'light'); } catch (e) { /* pas grave */ } }
}

export const state = {
  settings: {},
  categories: [],
  subcategories: [],
  products: [],
  contactLinks: [],
  expandedProducts: new Set(),
  filters: { cat: 'all', sub: 'all', query: '', onlyPromo: false, onlyNew: false },
  cart: {},
  currentProductId: null,
  currentVariantId: null,
};

export const sheets = {
  filter: [document.getElementById('sheetFilter'), document.getElementById('backdropFilter')],
  cart: [document.getElementById('sheetCart'), document.getElementById('backdropCart')],
  product: [document.getElementById('sheetProduct'), document.getElementById('backdropProduct')],
  adminLogin: [document.getElementById('sheetAdminLogin'), document.getElementById('backdropAdminLogin')],
  admin: [document.getElementById('sheetAdmin'), document.getElementById('backdropAdmin')],
};

export function open(key) { UI.openSheet(...sheets[key]); }
export function close(key) { UI.closeSheet(...sheets[key]); }
