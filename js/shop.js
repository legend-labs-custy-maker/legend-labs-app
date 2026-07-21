// ============================================================
// Boutique : tout le parcours client (catalogue, recherche, filtres,
// fiche produit avec galerie premium, panier, commande).
// Ne contient aucune logique d'administration.
// ============================================================

import { state, tg, haptic, open, close } from './state.js';
import * as Products from './products.js';
import * as Cart from './cart.js';
import * as UI from './ui.js';

// ---------- Chargement du catalogue ----------
export async function loadEverything() {
  const [settings, categories, subcategories, products, promotions, contactLinks] = await Promise.all([
    Products.loadSettings(),
    Products.loadCategories(),
    Products.loadSubcategories(),
    Products.loadProducts(),
    Products.loadActivePromotions(),
    Products.loadContactLinks(),
  ]);
  state.settings = settings;
  state.categories = categories;
  state.subcategories = subcategories;
  state.products = Products.attachPromotions(products, promotions);
  state.contactLinks = contactLinks;

  UI.renderHero(settings);
  UI.renderMarquee(settings.banner_message || '');
  refreshCategoryBars();
  refreshGrid();
  refreshCartUI();
  UI.renderContactLinks(state.contactLinks, {
    onOpen: (url) => Cart.goToCheckout(url, tg),
  });

  const signalLink = settings.contact_link;
  const linkSignal = document.getElementById('linkSignal');
  if (signalLink && Cart.isSafeUrl(signalLink)) {
    linkSignal.href = signalLink;
    linkSignal.addEventListener('click', e => { e.preventDefault(); Cart.goToCheckout(signalLink, tg); });
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

export function refreshGrid() {
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
  });
}

document.getElementById('lightboxClose').addEventListener('click', () => UI.closeLightbox());
document.getElementById('lightbox').addEventListener('click', (e) => {
  if (e.target.id === 'lightbox') UI.closeLightbox();
});

// ---------- Panier ----------
function addToCart(variantId, qty = 1) {
  state.cart = Cart.addToCart(state.cart, variantId, qty);
  haptic('medium');
  refreshCartUI();
}
export function refreshCartUI() {
  const { cart: cleaned, changed } = Cart.pruneCart(state.cart, state.products);
  if (changed) state.cart = cleaned;

  const lines = Cart.computeCartLines(state.cart, state.products);
  const total = Cart.cartTotal(lines);
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
}
document.getElementById('cartFab').addEventListener('click', () => open('cart'));
document.getElementById('checkoutBtn').addEventListener('click', () => {
  const lines = Cart.computeCartLines(state.cart, state.products);
  if (lines.length === 0) { haptic('warning'); return; }
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

// ---------- Initialisation ----------
export async function initShop() {
  state.cart = Cart.loadCart();
  await loadEverything();
}
