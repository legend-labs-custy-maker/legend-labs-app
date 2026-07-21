// ============================================================
// État partagé entre les modules boutique et admin, et utilitaires
// communs (Telegram WebApp, retour haptique, ouverture des panneaux).
// ============================================================

import * as UI from './ui.js';

export const tg = window.Telegram ? window.Telegram.WebApp : null;
if (tg) { tg.ready(); tg.expand(); tg.setHeaderColor && tg.setHeaderColor('#0A0705'); }

export function haptic(type) {
  if (tg && tg.HapticFeedback) { try { tg.HapticFeedback.impactOccurred(type || 'light'); } catch (e) { /* pas grave */ } }
  playTick();
}

// ---------- Son de l'app (réglable dans Réglages) ----------
const SOUND_KEY = 'legendlabs_sound';
let audioCtx = null;
export function isSoundEnabled() { return localStorage.getItem(SOUND_KEY) === '1'; }
export function setSoundEnabled(on) { try { localStorage.setItem(SOUND_KEY, on ? '1' : '0'); } catch { /* pas grave */ } }
function playTick() {
  if (!isSoundEnabled()) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 720;
    gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.08);
  } catch (e) { /* audio indisponible, pas grave */ }
}

export const state = {
  settings: {},
  categories: [],
  subcategories: [],
  products: [],
  contactLinks: [],
  promoCodes: [],
  reviews: [],
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
