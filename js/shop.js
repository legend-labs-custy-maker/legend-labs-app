// ============================================================
// Boutique : tout le parcours client (catalogue, recherche, filtres,
// fiche produit avec galerie premium, panier, commande).
// Ne contient aucune logique d'administration.
// ============================================================

import { state, tg, haptic, open, close, isSoundEnabled, setSoundEnabled } from './state.js';
import * as Products from './products.js';
import * as Cart from './cart.js';
import * as UI from './ui.js';
import { t, getLang, setLang, applyTranslations } from './i18n.js';

// ---------- Chargement du catalogue ----------
async function safeLoad(promise, fallback, label) {
  try { return await promise; }
  catch (err) { console.error(`Chargement "${label}" échoué (ignoré) :`, err); return fallback; }
}

export async function loadEverything() {
  const [settings, categories, subcategories, products, promotions, contactLinks, reviews] = await Promise.all([
    safeLoad(Products.loadSettings(), {}, 'réglages'),
    safeLoad(Products.loadCategories(), [], 'catégories'),
    safeLoad(Products.loadSubcategories(), [], 'sous-catégories'),
    safeLoad(Products.loadProducts(), [], 'produits'),
    safeLoad(Products.loadActivePromotions(), [], 'promotions'),
    safeLoad(Products.loadContactLinks(), [], 'liens de contact'),
    safeLoad(Products.loadReviews(), [], 'avis'),
  ]);
  state.settings = settings;
  state.categories = categories;
  state.subcategories = subcategories;
  state.products = Products.attachPromotions(products, promotions);
  state.contactLinks = contactLinks;
  state.reviews = reviews;

  try {
    applyTranslations();
    UI.renderHero(settings);
    UI.renderMarquee(settings.banner_message || '');
    refreshCategoryBars();
    refreshGrid();
    refreshCartUI();
    UI.renderContactLinks(state.contactLinks, {
      onOpen: (url) => Cart.goToCheckout(url, tg),
    });
    UI.renderInfoContent('infoPayment', settings.payment_info);
    UI.renderInfoContent('infoShipping', settings.shipping_info);
    UI.renderInfoContent('infoFaq', settings.faq_content);
    const summary = Products.reviewsSummary(state.reviews);
    UI.renderReviewsSummary(summary);
    UI.renderReviewsList(state.reviews);

    const signalLink = settings.contact_link;
    const linkSignal = document.getElementById('linkSignal');
    if (signalLink && Cart.isSafeUrl(signalLink)) {
      linkSignal.href = signalLink;
      linkSignal.addEventListener('click', e => { e.preventDefault(); Cart.goToCheckout(signalLink, tg); });
    }
  } catch (err) {
    console.error('Erreur d\'affichage (ignorée, le reste continue) :', err);
  }
}

// ---------- Catégories ----------
export function refreshCategoryBars() {
  UI.renderCategoryBar(state.categories, state.filters.cat, (catId) => {
    state.filters.cat = catId; state.filters.sub = 'all';
    haptic('light');
    refreshCategoryBars(); refreshGrid();
  });
  UI.renderSubcategoryBar(state.subcategories, state.filters.cat, state.filters.sub, (subId) => {
    state.filters.sub = subId;
    haptic('light');
    refreshCategoryBars(); refreshGrid();
  });
}

// ---------- Grille produits ----------
function getFilteredProducts() {
  return Products.searchProducts(state.products, {
    query: state.filters.query,
    categoryId: state.filters.cat,
    subcategoryId: state.filters.sub,
    onlyPromo: state.filters.onlyPromo,
    onlyNew: state.filters.onlyNew,
  });
}

const LIKED_KEY = 'legendlabs_liked';
function getLikedSet() {
  try { return new Set(JSON.parse(localStorage.getItem(LIKED_KEY) || '[]')); } catch { return new Set(); }
}
function markLiked(productId) {
  const set = getLikedSet();
  set.add(productId);
  try { localStorage.setItem(LIKED_KEY, JSON.stringify([...set])); } catch { /* pas grave */ }
}
async function handleLike(productId, el) {
  if (getLikedSet().has(productId)) { haptic('warning'); return; } // déjà aimé sur cet appareil
  try {
    const newCount = await Products.likeProduct(productId);
    markLiked(productId);
    const product = state.products.find(p => p.id === productId);
    if (product) product.likes = newCount;
    haptic('success');
    refreshGrid();
    if (state.currentProductId === productId) renderCurrentProduct();
  } catch { haptic('warning'); }
}

export function refreshGrid() {
  UI.renderGrid(getFilteredProducts(), {
    onOpen: (productId) => openProduct(productId),
    onQuickAdd: (productId) => {
      const product = state.products.find(p => p.id === productId);
      const variant = (product.variants || []).slice().sort((a, b) => a.price - b.price)[0];
      if (!variant || variant.stock <= 0) return;
      addToCart(variant.id);
    },
    onLike: handleLike,
  });
}

// ---------- Recherche ----------
let searchDebounce = null;
document.getElementById('searchInput').addEventListener('input', (e) => {
  clearTimeout(searchDebounce);
  const value = e.target.value;
  searchDebounce = setTimeout(() => { state.filters.query = value; refreshGrid(); }, 150);
});

// ---------- Filtres ----------
document.getElementById('openFilter').addEventListener('click', () => open('filter'));
document.getElementById('fPromo').addEventListener('click', (e) => e.currentTarget.classList.toggle('active'));
document.getElementById('fNew').addEventListener('click', (e) => e.currentTarget.classList.toggle('active'));
document.getElementById('applyFilter').addEventListener('click', () => {
  state.filters.onlyPromo = document.getElementById('fPromo').classList.contains('active');
  state.filters.onlyNew = document.getElementById('fNew').classList.contains('active');
  document.getElementById('openFilter').classList.toggle('on', state.filters.onlyPromo || state.filters.onlyNew);
  refreshGrid();
  close('filter');
  haptic('light');
});
document.getElementById('resetFilter').addEventListener('click', () => {
  document.getElementById('fPromo').classList.remove('active');
  document.getElementById('fNew').classList.remove('active');
  state.filters.onlyPromo = false; state.filters.onlyNew = false;
  document.getElementById('openFilter').classList.remove('on');
  refreshGrid();
});

// ---------- Fiche produit + galerie premium ----------
function openProduct(productId) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;
  state.currentProductId = productId;
  const firstVariant = (product.variants || [])[0];
  state.currentVariantId = firstVariant ? firstVariant.id : null;
  renderCurrentProduct();
  open('product');
}
function renderCurrentProduct() {
  const product = state.products.find(p => p.id === state.currentProductId);
  if (!product) return;
  UI.renderProductDetail(product, {
    selectedVariantId: state.currentVariantId,
    onSelectVariant: (variantId) => { state.currentVariantId = variantId; renderCurrentProduct(); },
    onAddToCart: (variantId) => { addToCart(variantId); close('product'); },
    effectivePrice: Products.effectivePrice,
    onOpenGallery: (index) => UI.openLightbox(product.media || [], index),
    onLike: handleLike,
    alreadyLiked: getLikedSet().has(product.id),
  });
}

document.getElementById('lightboxClose').addEventListener('click', () => UI.closeLightbox());
document.getElementById('lightbox').addEventListener('click', (e) => {
  if (e.target.id === 'lightbox') UI.closeLightbox();
});

// ---------- Panier ----------
let appliedPromo = null; // { code, type, value } ou null

function addToCart(variantId, qty = 1) {
  state.cart = Cart.addToCart(state.cart, variantId, qty);
  haptic('medium');
  refreshCartUI();
}
export function refreshCartUI() {
  const { cart: cleaned, changed } = Cart.pruneCart(state.cart, state.products);
  if (changed) state.cart = cleaned;

  const lines = Cart.computeCartLines(state.cart, state.products);
  const subtotal = Cart.cartTotal(lines);
  const { discount, total } = Cart.applyPromoDiscount(subtotal, appliedPromo);

  document.getElementById('cartSubtotalRow').style.display = appliedPromo ? 'flex' : 'none';
  document.getElementById('cartDiscountRow').style.display = appliedPromo ? 'flex' : 'none';
  document.getElementById('cartSubtotal').textContent = subtotal + ' €';
  document.getElementById('cartDiscount').textContent = '−' + discount + ' €';
  document.getElementById('cartTotal').textContent = total + ' €';

  UI.renderCartLines(lines, {
    onInc: (variantId) => { state.cart = Cart.setQty(state.cart, variantId, (state.cart[variantId] || 0) + 1); refreshCartUI(); },
    onDec: (variantId) => { state.cart = Cart.setQty(state.cart, variantId, (state.cart[variantId] || 0) - 1); refreshCartUI(); },
  });
  // Le badge reflète les lignes réellement affichées, jamais les données
  // brutes du panier — s'il n'y a rien à l'écran, le badge ne peut pas
  // afficher un nombre différent de zéro.
  const qtyTotal = lines.reduce((a, l) => a + l.qty, 0);
  document.getElementById('cartBadge').textContent = qtyTotal;
  document.getElementById('cartFab').classList.toggle('hidden', qtyTotal === 0);

  if (lines.length === 0 && appliedPromo) {
    // Panier vidé : on retire le code appliqué pour éviter toute confusion.
    appliedPromo = null;
    document.getElementById('promoInput').value = '';
    document.getElementById('promoMsg').textContent = '';
  }
}

document.getElementById('promoApplyBtn').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  const input = document.getElementById('promoInput');
  const msgEl = document.getElementById('promoMsg');
  const code = input.value.trim();
  if (!code) return;
  const subtotal = Cart.cartTotal(Cart.computeCartLines(state.cart, state.products));
  UI.setBusy(btn, true, '...');
  try {
    const res = await Cart.validatePromo(code, subtotal);
    if (res.valid) {
      appliedPromo = { code: res.code, type: res.type, value: res.value };
      msgEl.textContent = '✅ Code appliqué';
      msgEl.style.color = 'var(--ember-2)';
      haptic('success');
    } else {
      appliedPromo = null;
      msgEl.textContent = Cart.promoErrorMessage(res.reason, res.min_order);
      msgEl.style.color = 'var(--blood)';
      haptic('warning');
    }
  } catch {
    msgEl.textContent = 'Impossible de vérifier ce code pour le moment.';
    msgEl.style.color = 'var(--blood)';
  } finally {
    UI.setBusy(btn, false);
    refreshCartUI();
  }
});

document.getElementById('cartFab').addEventListener('click', () => open('cart'));
document.getElementById('checkoutBtn').addEventListener('click', () => {
  const lines = Cart.computeCartLines(state.cart, state.products);
  if (lines.length === 0) { haptic('warning'); return; }
  haptic('success');
  Cart.goToCheckout(state.settings.contact_link, tg);
});

// ---------- Onglets ----------
const VIEW_BY_TAB = { home: 'view-home', infos: 'view-infos', avis: 'view-avis', settings: 'view-settings' };
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const key = tab.dataset.tab;
    haptic('light');
    if (key === 'cart') { open('cart'); return; }
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(VIEW_BY_TAB[key] || 'view-home').classList.add('active');
  });
});

// ---------- Réglages (langue, notifications, son) ----------
const NOTIF_KEY = 'legendlabs_notif';
function loadNotifPrefs() {
  try { return JSON.parse(localStorage.getItem(NOTIF_KEY) || '{}'); } catch { return {}; }
}
function saveNotifPrefs(prefs) {
  try { localStorage.setItem(NOTIF_KEY, JSON.stringify(prefs)); } catch { /* pas grave */ }
}

function initSettingsTab() {
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === getLang());
    btn.addEventListener('click', () => {
      setLang(btn.dataset.lang);
      document.querySelectorAll('.lang-btn').forEach(b => b.classList.toggle('active', b.dataset.lang === btn.dataset.lang));
      applyTranslations();
      refreshGrid();
      refreshCartUI();
      haptic('light');
    });
  });

  const notifPrefs = loadNotifPrefs();
  const notifNew = document.getElementById('toggleNotifNew');
  const notifPromo = document.getElementById('toggleNotifPromo');
  if (notifNew) {
    notifNew.checked = !!notifPrefs.newProducts;
    notifNew.addEventListener('change', () => { saveNotifPrefs({ ...loadNotifPrefs(), newProducts: notifNew.checked }); haptic('light'); });
  }
  if (notifPromo) {
    notifPromo.checked = !!notifPrefs.promos;
    notifPromo.addEventListener('change', () => { saveNotifPrefs({ ...loadNotifPrefs(), promos: notifPromo.checked }); haptic('light'); });
  }

  const soundToggle = document.getElementById('toggleSound');
  if (soundToggle) {
    soundToggle.checked = isSoundEnabled();
    soundToggle.addEventListener('change', () => { setSoundEnabled(soundToggle.checked); haptic('light'); });
  }
}

// ---------- Initialisation ----------
export async function initShop() {
  state.cart = Cart.loadCart();
  try { initSettingsTab(); } catch (err) { console.error('Réglages : erreur ignorée :', err); }
  await loadEverything();
}
