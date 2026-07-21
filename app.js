// ============================================================
// Point d'entrée : bootstrap, état de l'application, câblage
// des événements entre les modules.
// ============================================================

import { ADMIN_TAP_TRIGGER_COUNT } from './config.js';
import * as Products from './products.js';
import * as Cart from './cart.js';
import * as Admin from './admin.js';
import * as UI from './ui.js';

const tg = window.Telegram ? window.Telegram.WebApp : null;
if (tg) { tg.ready(); tg.expand(); tg.setHeaderColor && tg.setHeaderColor('#0A0705'); }
function haptic(type) { if (tg && tg.HapticFeedback) { try { tg.HapticFeedback.impactOccurred(type || 'light'); } catch (e) { /* pas grave */ } } }

const state = {
  settings: {},
  categories: [],
  subcategories: [],
  products: [],
  filters: { cat: 'all', sub: 'all', query: '', onlyPromo: false, onlyNew: false },
  cart: Cart.loadCart(),
  currentProductId: null,
  currentVariantId: null,
};

// ---------- Sheets génériques ----------
const sheets = {
  filter: [document.getElementById('sheetFilter'), document.getElementById('backdropFilter')],
  cart: [document.getElementById('sheetCart'), document.getElementById('backdropCart')],
  product: [document.getElementById('sheetProduct'), document.getElementById('backdropProduct')],
  adminLogin: [document.getElementById('sheetAdminLogin'), document.getElementById('backdropAdminLogin')],
  admin: [document.getElementById('sheetAdmin'), document.getElementById('backdropAdmin')],
};
function open(key) { UI.openSheet(...sheets[key]); }
function close(key) { UI.closeSheet(...sheets[key]); }
document.querySelectorAll('.sheet-close').forEach(btn => {
  btn.addEventListener('click', () => { close(btn.dataset.close); haptic('light'); });
});
Object.entries(sheets).forEach(([key, [, backdrop]]) => backdrop.addEventListener('click', () => close(key)));

// ---------- Chargement du catalogue ----------
async function loadEverything() {
  const [settings, categories, subcategories, products, promotions] = await Promise.all([
    Products.loadSettings(),
    Products.loadCategories(),
    Products.loadSubcategories(),
    Products.loadProducts(),
    Products.loadActivePromotions(),
  ]);
  state.settings = settings;
  state.categories = categories;
  state.subcategories = subcategories;
  state.products = Products.attachPromotions(products, promotions);

  UI.renderHero(settings);
  UI.renderMarquee(settings.banner_message || '');
  refreshCategoryBars();
  refreshGrid();
  refreshCartUI();

  const signalLink = settings.contact_link;
  const linkSignal = document.getElementById('linkSignal');
  if (signalLink && Cart.isSafeUrl(signalLink)) {
    linkSignal.href = signalLink;
    linkSignal.addEventListener('click', e => { e.preventDefault(); Cart.goToCheckout(signalLink, tg); });
  }
}

function refreshCategoryBars() {
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

function getFilteredProducts() {
  return Products.searchProducts(state.products, {
    query: state.filters.query,
    categoryId: state.filters.cat,
    subcategoryId: state.filters.sub,
    onlyPromo: state.filters.onlyPromo,
    onlyNew: state.filters.onlyNew,
  });
}

function refreshGrid() {
  UI.renderGrid(getFilteredProducts(), {
    onOpen: (productId) => openProduct(productId),
    onQuickAdd: (productId) => {
      const product = state.products.find(p => p.id === productId);
      const variant = (product.variants || []).slice().sort((a, b) => a.price - b.price)[0];
      if (!variant || variant.stock <= 0) return;
      addToCart(variant.id);
    },
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

// ---------- Fiche produit ----------
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
  });
}

// ---------- Panier ----------
function addToCart(variantId, qty = 1) {
  state.cart = Cart.addToCart(state.cart, variantId, qty);
  haptic('medium');
  refreshCartUI();
}
function refreshCartUI() {
  const lines = Cart.computeCartLines(state.cart, state.products);
  const total = Cart.cartTotal(lines);
  document.getElementById('cartTotal').textContent = total + ' €';
  UI.renderCartLines(lines, {
    onInc: (variantId) => { state.cart = Cart.setQty(state.cart, variantId, (state.cart[variantId] || 0) + 1); refreshCartUI(); },
    onDec: (variantId) => { state.cart = Cart.setQty(state.cart, variantId, (state.cart[variantId] || 0) - 1); refreshCartUI(); },
  });
  const qtyTotal = Object.values(state.cart).reduce((a, b) => a + b, 0);
  document.getElementById('cartBadge').textContent = qtyTotal;
  document.getElementById('cartFab').classList.toggle('hidden', qtyTotal === 0);
}
document.getElementById('cartFab').addEventListener('click', () => open('cart'));
document.getElementById('checkoutBtn').addEventListener('click', () => {
  const qtyTotal = Object.values(state.cart).reduce((a, b) => a + b, 0);
  if (qtyTotal === 0) { haptic('warning'); return; }
  haptic('success');
  Cart.goToCheckout(state.settings.contact_link, tg);
});

// ---------- Onglets ----------
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const key = tab.dataset.tab;
    haptic('light');
    if (key === 'cart') { open('cart'); return; }
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(key === 'contact' ? 'view-contact' : 'view-home').classList.add('active');
  });
});

// ============================================================
// ADMIN
// ============================================================
let tapCount = 0, tapTimer = null;
document.getElementById('adminTrigger').addEventListener('click', async () => {
  tapCount++;
  clearTimeout(tapTimer);
  tapTimer = setTimeout(() => { tapCount = 0; }, 1200);
  if (tapCount < ADMIN_TAP_TRIGGER_COUNT) return;
  tapCount = 0;
  haptic('rigid');

  if (Admin.isAdminLoggedIn()) { openAdminPanel(); return; }

  open('adminLogin');
  const statusEl = document.getElementById('adminLoginStatus');
  try {
    if (!tg || !tg.initData) {
      statusEl.textContent = "Ouvre l'app depuis Telegram pour accéder à l'administration.";
      return;
    }
    statusEl.textContent = 'Vérification de ton identité Telegram...';
    await Admin.tryAdminLogin(tg);
    statusEl.textContent = 'Identité confirmée ✅';
    haptic('success');
    setTimeout(() => { close('adminLogin'); openAdminPanel(); }, 400);
  } catch (err) {
    haptic('warning');
    if (String(err.message).includes('not_admin')) statusEl.textContent = "Ce compte Telegram n'est pas autorisé à administrer cette boutique.";
    else if (String(err.message).includes('too_many_attempts')) statusEl.textContent = 'Trop de tentatives, réessaie dans quelques minutes.';
    else statusEl.textContent = "Impossible de vérifier ton identité pour le moment.";
  }
});

document.querySelectorAll('.admin-tab').forEach(tabBtn => {
  tabBtn.addEventListener('click', () => {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
    tabBtn.classList.add('active');
    document.querySelector(`.admin-section[data-asection="${tabBtn.dataset.atab}"]`).classList.add('active');
    haptic('light');
  });
});
document.getElementById('lockAdmin').addEventListener('click', () => { Admin.logoutAdmin(); close('admin'); });

function openAdminPanel() {
  document.getElementById('adminWho').textContent = `Connecté : ${Admin.currentAdminName() || 'admin'}`;
  document.getElementById('adminTitle').value = state.settings.app_title || '';
  document.getElementById('adminWelcome').value = state.settings.welcome_message || '';
  document.getElementById('adminBanner').value = state.settings.banner_message || '';
  document.getElementById('adminContact').value = state.settings.contact_link || '';
  UI.fillCategorySelect(document.getElementById('npCat'), state.categories);
  UI.fillSubcategorySelect(document.getElementById('npSub'), state.subcategories, state.categories[0]?.id);
  document.getElementById('npCat').onchange = (e) => UI.fillSubcategorySelect(document.getElementById('npSub'), state.subcategories, e.target.value);
  UI.renderAdminCategories(state.categories, handleDeleteCategory);
  UI.renderAdminProducts(state.products, handleDeleteProduct);
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
  document.querySelector('.admin-tab[data-atab="general"]').classList.add('active');
  document.querySelector('.admin-section[data-asection="general"]').classList.add('active');
  open('admin');
}

document.getElementById('saveGeneral').addEventListener('click', async () => {
  const title = document.getElementById('adminTitle').value.trim();
  const welcome = document.getElementById('adminWelcome').value.trim();
  const banner = document.getElementById('adminBanner').value.trim();
  const contact = document.getElementById('adminContact').value.trim();
  try {
    if (title) { await Admin.saveSetting('app_title', title); state.settings.app_title = title; }
    if (welcome) { await Admin.saveSetting('welcome_message', welcome); state.settings.welcome_message = welcome; }
    if (banner) { await Admin.saveSetting('banner_message', banner); state.settings.banner_message = banner; }
    if (contact && Cart.isSafeUrl(contact)) { await Admin.saveSetting('contact_link', contact); state.settings.contact_link = contact; }
    UI.renderHero(state.settings);
    UI.renderMarquee(state.settings.banner_message || '');
    haptic('success');
  } catch (err) {
    haptic('warning');
    alert("Erreur lors de l'enregistrement — reconnecte-toi si le problème persiste.");
  }
});

document.getElementById('addCatBtn').addEventListener('click', async () => {
  const name = document.getElementById('ncName').value.trim();
  if (!name) return;
  try {
    const res = await Admin.createCategory({ name, sort_order: state.categories.length });
    state.categories.push(res.data);
    document.getElementById('ncName').value = '';
    UI.renderAdminCategories(state.categories, handleDeleteCategory);
    UI.fillCategorySelect(document.getElementById('npCat'), state.categories);
    refreshCategoryBars();
    haptic('success');
  } catch { haptic('warning'); alert('Impossible de créer la catégorie.'); }
});
async function handleDeleteCategory(id) {
  try {
    await Admin.deleteCategory(id);
    state.categories = state.categories.filter(c => c.id !== id);
    UI.renderAdminCategories(state.categories, handleDeleteCategory);
    UI.fillCategorySelect(document.getElementById('npCat'), state.categories);
    refreshCategoryBars();
    haptic('medium');
  } catch { haptic('warning'); alert('Impossible de supprimer la catégorie.'); }
}

document.getElementById('addProductBtn').addEventListener('click', async () => {
  const name = document.getElementById('npName').value.trim();
  const category_id = document.getElementById('npCat').value || null;
  const subcategory_id = document.getElementById('npSub').value || null;
  const description = document.getElementById('npDesc').value.trim();
  const price = parseFloat(document.getElementById('npPrice').value) || 0;
  const stock = parseInt(document.getElementById('npStock').value, 10) || 0;
  if (!name) { haptic('warning'); return; }
  try {
    const prodRes = await Admin.createProduct({ name, description, category_id, subcategory_id, sort_order: state.products.length });
    const product = prodRes.data;
    const variantRes = await Admin.createVariant({ product_id: product.id, name: 'Standard', price, stock, sort_order: 0 });
    product.variants = [variantRes.data];
    product.media = [];
    state.products.push(product);
    document.getElementById('npName').value = '';
    document.getElementById('npDesc').value = '';
    document.getElementById('npPrice').value = '';
    document.getElementById('npStock').value = '';
    UI.renderAdminProducts(state.products, handleDeleteProduct);
    refreshGrid();
    haptic('success');
  } catch { haptic('warning'); alert('Impossible de créer le produit.'); }
});
async function handleDeleteProduct(id) {
  try {
    await Admin.deleteProduct(id);
    state.products = state.products.filter(p => p.id !== id);
    UI.renderAdminProducts(state.products, handleDeleteProduct);
    refreshGrid();
    haptic('medium');
  } catch { haptic('warning'); alert('Impossible de supprimer le produit.'); }
}

// ============================================================
// DÉMARRAGE
// ============================================================
(async function boot() {
  try {
    spawnEmbersOnSplash();
    await loadEverything();
  } catch (err) {
    console.error('Erreur au démarrage :', err);
    document.getElementById('resultCount').textContent = 'Erreur de chargement — vérifie la connexion.';
  } finally {
    setTimeout(() => { document.getElementById('splash').classList.add('hide'); haptic('rigid'); }, 2200);
  }
})();

function spawnEmbersOnSplash() {
  UI.spawnEmbers(document.getElementById('emberField'), 22);
}
