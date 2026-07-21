// ============================================================
// Panneau d'administration : connexion par identité Telegram,
// et gestion complète du contenu (catégories, produits, variantes,
// lots, médias, liens de contact, réglages généraux).
// Ne contient aucune logique de parcours client.
// ============================================================

import { ADMIN_TAP_TRIGGER_COUNT } from './config.js';
import { uploadToSignedUrl, publicMediaUrl } from './api.js';
import { compressImage } from './media.js';
import { state, tg, haptic, open, close } from './state.js';
import * as Admin from './admin.js';
import * as Cart from './cart.js';
import * as UI from './ui.js';
import { refreshGrid, refreshCategoryBars } from './shop.js';

// ---------- Connexion (identité Telegram, aucun mot de passe) ----------
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

async function openAdminPanel() {
  document.getElementById('adminWho').textContent = `Connecté : ${Admin.currentAdminName() || 'admin'}`;
  document.getElementById('adminTitle').value = state.settings.app_title || '';
  document.getElementById('adminWelcome').value = state.settings.welcome_message || '';
  document.getElementById('adminBanner').value = state.settings.banner_message || '';
  document.getElementById('adminContact').value = state.settings.contact_link || '';

  // Vue complète (inclut les catégories/produits masqués, invisibles en lecture publique)
  try {
    const res = await Admin.loadAdminData();
    state.categories = res.data.categories;
    state.subcategories = res.data.subcategories;
    state.products = res.data.products;
    state.contactLinks = res.data.contactLinks;
  } catch {
    haptic('warning'); alert("Impossible de charger les données à jour — celles déjà affichées peuvent être incomplètes.");
  }

  UI.fillCategorySelect(document.getElementById('npCat'), state.categories);
  UI.fillSubcategorySelect(document.getElementById('npSub'), state.subcategories, state.categories[0]?.id);
  document.getElementById('npCat').onchange = (e) => UI.fillSubcategorySelect(document.getElementById('npSub'), state.subcategories, e.target.value);
  UI.renderAdminCategories(state.categories, { onDelete: handleDeleteCategory, onMove: handleMoveCategory });
  UI.renderAdminProducts(state.products, state.expandedProducts);
  UI.renderAdminContactLinks(state.contactLinks, handleDeleteContactLink);
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
  document.querySelector('.admin-tab[data-atab="general"]').classList.add('active');
  document.querySelector('.admin-section[data-asection="general"]').classList.add('active');
  open('admin');
}

// ---------- Réglages généraux ----------
document.getElementById('saveGeneral').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  const title = document.getElementById('adminTitle').value.trim();
  const welcome = document.getElementById('adminWelcome').value.trim();
  const banner = document.getElementById('adminBanner').value.trim();
  const contact = document.getElementById('adminContact').value.trim();
  UI.setBusy(btn, true);
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
  } finally {
    UI.setBusy(btn, false);
  }
});

// ---------- Catégories ----------
document.getElementById('addCatBtn').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  const name = document.getElementById('ncName').value.trim();
  if (!name) return;
  UI.setBusy(btn, true);
  try {
    const res = await Admin.createCategory({ name, sort_order: state.categories.length });
    state.categories.push(res.data);
    document.getElementById('ncName').value = '';
    UI.renderAdminCategories(state.categories, { onDelete: handleDeleteCategory, onMove: handleMoveCategory });
    UI.fillCategorySelect(document.getElementById('npCat'), state.categories);
    refreshCategoryBars();
    haptic('success');
  } catch { haptic('warning'); alert('Impossible de créer la catégorie.'); }
  finally { UI.setBusy(btn, false); }
});
async function handleDeleteCategory(id) {
  try {
    await Admin.deleteCategory(id);
    state.categories = state.categories.filter(c => c.id !== id);
    UI.renderAdminCategories(state.categories, { onDelete: handleDeleteCategory, onMove: handleMoveCategory });
    UI.fillCategorySelect(document.getElementById('npCat'), state.categories);
    refreshCategoryBars();
    haptic('medium');
  } catch { haptic('warning'); alert('Impossible de supprimer la catégorie.'); }
}

async function handleMoveCategory(id, direction) {
  const list = state.categories;
  const index = list.findIndex(c => c.id === id);
  const targetIndex = index + direction;
  if (index === -1 || targetIndex < 0 || targetIndex >= list.length) return;
  const a = list[index], b = list[targetIndex];
  const aOrder = a.sort_order, bOrder = b.sort_order;
  try {
    await Promise.all([
      Admin.updateCategory(a.id, { sort_order: bOrder }),
      Admin.updateCategory(b.id, { sort_order: aOrder }),
    ]);
    a.sort_order = bOrder; b.sort_order = aOrder;
    list[index] = b; list[targetIndex] = a;
    UI.renderAdminCategories(state.categories, { onDelete: handleDeleteCategory, onMove: handleMoveCategory });
    refreshCategoryBars();
    haptic('light');
  } catch { haptic('warning'); alert('Impossible de réorganiser les catégories.'); }
}

// ---------- Produits ----------
document.getElementById('addProductBtn').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  const name = document.getElementById('npName').value.trim();
  const category_id = document.getElementById('npCat').value || null;
  const subcategory_id = document.getElementById('npSub').value || null;
  const description = document.getElementById('npDesc').value.trim();
  const price = parseFloat(document.getElementById('npPrice').value) || 0;
  const stock = parseInt(document.getElementById('npStock').value, 10) || 0;
  const unit = document.getElementById('npUnit').value || 'pièce';
  if (!name) { haptic('warning'); return; }
  UI.setBusy(btn, true);
  try {
    const prodRes = await Admin.createProduct({ name, description, category_id, subcategory_id, sort_order: state.products.length });
    const product = prodRes.data;
    const variantRes = await Admin.createVariant({ product_id: product.id, name: 'Standard', unit, price, stock, sort_order: 0 });
    product.variants = [{ ...variantRes.data, lots: [] }];
    product.media = [];
    state.products.push(product);
    document.getElementById('npName').value = '';
    document.getElementById('npDesc').value = '';
    document.getElementById('npPrice').value = '';
    document.getElementById('npStock').value = '';
    UI.renderAdminProducts(state.products, state.expandedProducts);
    refreshGrid();
    haptic('success');
  } catch { haptic('warning'); alert('Impossible de créer le produit.'); }
  finally { UI.setBusy(btn, false); }
});
async function handleDeleteProduct(id) {
  try {
    await Admin.deleteProduct(id);
    state.products = state.products.filter(p => p.id !== id);
    UI.renderAdminProducts(state.products, state.expandedProducts);
    refreshGrid();
    haptic('medium');
  } catch { haptic('warning'); alert('Impossible de supprimer le produit.'); }
}

async function handleToggleHidden(id) {
  const product = state.products.find(p => p.id === id);
  if (!product) return;
  const next = !product.is_hidden;
  try {
    await Admin.updateProduct(id, { is_hidden: next });
    product.is_hidden = next;
    UI.renderAdminProducts(state.products, state.expandedProducts);
    refreshGrid();
    haptic('success');
  } catch { haptic('warning'); alert("Impossible de changer la visibilité du produit."); }
}

async function handleMoveProduct(id, direction) {
  const list = state.products;
  const index = list.findIndex(p => p.id === id);
  const targetIndex = index + direction;
  if (index === -1 || targetIndex < 0 || targetIndex >= list.length) return;
  const a = list[index], b = list[targetIndex];
  const aOrder = a.sort_order, bOrder = b.sort_order;
  try {
    await Promise.all([
      Admin.updateProduct(a.id, { sort_order: bOrder }),
      Admin.updateProduct(b.id, { sort_order: aOrder }),
    ]);
    a.sort_order = bOrder; b.sort_order = aOrder;
    list[index] = b; list[targetIndex] = a;
    UI.renderAdminProducts(state.products, state.expandedProducts);
    refreshGrid();
    haptic('light');
  } catch { haptic('warning'); alert("Impossible de réorganiser les produits."); }
}

// ---------- Liens de contact ----------
document.getElementById('addContactLinkBtn').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  const label = document.getElementById('nlLabel').value.trim();
  const url = document.getElementById('nlUrl').value.trim();
  const icon = document.getElementById('nlIcon').value.trim();
  if (!label || !Cart.isSafeUrl(url)) { haptic('warning'); alert('Nom et lien valide (https://...) requis.'); return; }
  UI.setBusy(btn, true);
  try {
    const res = await Admin.createContactLink({ label, url, icon, sort_order: state.contactLinks.length });
    state.contactLinks.push(res.data);
    document.getElementById('nlLabel').value = '';
    document.getElementById('nlUrl').value = '';
    document.getElementById('nlIcon').value = '';
    UI.renderAdminContactLinks(state.contactLinks, handleDeleteContactLink);
    UI.renderContactLinks(state.contactLinks, { onOpen: (url) => Cart.goToCheckout(url, tg) });
    haptic('success');
  } catch { haptic('warning'); alert('Impossible de créer le lien.'); }
  finally { UI.setBusy(btn, false); }
});
async function handleDeleteContactLink(id) {
  try {
    await Admin.deleteContactLink(id);
    state.contactLinks = state.contactLinks.filter(l => l.id !== id);
    UI.renderAdminContactLinks(state.contactLinks, handleDeleteContactLink);
    UI.renderContactLinks(state.contactLinks, { onOpen: (url) => Cart.goToCheckout(url, tg) });
    haptic('medium');
  } catch { haptic('warning'); alert('Impossible de supprimer le lien.'); }
}

// ============================================================
// GESTION PRODUIT INTÉGRÉE (médias, variantes, lots) — liste dépliable,
// tout se passe dans l'onglet "Produits", pas de sous-panneau séparé.
// ============================================================
function findProduct(id) { return state.products.find(p => p.id === id); }

function rerenderProducts() {
  UI.renderAdminProducts(state.products, state.expandedProducts);
}

const adminProductList = document.getElementById('adminProductList');

adminProductList.addEventListener('click', async (e) => {
  const delProdBtn = e.target.closest('[data-delprod]');
  if (delProdBtn) { handleDeleteProduct(delProdBtn.dataset.delprod); return; }

  const toggleHiddenBtn = e.target.closest('[data-togglehidden]');
  if (toggleHiddenBtn) { handleToggleHidden(toggleHiddenBtn.dataset.togglehidden); return; }

  const moveUpProdBtn = e.target.closest('[data-moveupprod]');
  if (moveUpProdBtn) { handleMoveProduct(moveUpProdBtn.dataset.moveupprod, -1); return; }

  const moveDownProdBtn = e.target.closest('[data-movedownprod]');
  if (moveDownProdBtn) { handleMoveProduct(moveDownProdBtn.dataset.movedownprod, 1); return; }

  const delMediaBtn = e.target.closest('[data-delmedia]');
  if (delMediaBtn) { handleDeleteMedia(delMediaBtn.dataset.delmedia); return; }

  const delVariantBtn = e.target.closest('[data-delvariant]');
  if (delVariantBtn) { handleDeleteVariant(delVariantBtn.dataset.delvariant); return; }

  const delLotBtn = e.target.closest('[data-dellot]');
  if (delLotBtn) { handleDeleteLot(delLotBtn.dataset.dellot); return; }

  const addVariantBtn = e.target.closest('[data-addvariant]');
  if (addVariantBtn) {
    const productId = addVariantBtn.dataset.addvariant;
    const scope = addVariantBtn.closest('.admin-product-expand');
    const name = scope.querySelector(`[data-pvname="${productId}"]`).value.trim();
    const unit = scope.querySelector(`[data-pvunit="${productId}"]`).value;
    const price = parseFloat(scope.querySelector(`[data-pvprice="${productId}"]`).value);
    const stock = parseInt(scope.querySelector(`[data-pvstock="${productId}"]`).value, 10) || 0;
    if (!name || isNaN(price) || price < 0) { haptic('warning'); return; }
    UI.setBusy(addVariantBtn, true);
    await handleAddVariant(productId, { name, unit, price, stock });
    return;
  }

  const addLotBtn = e.target.closest('[data-addlot]');
  if (addLotBtn) {
    const variantId = addLotBtn.dataset.addlot;
    const row = addLotBtn.closest('.variant-edit-row');
    const qty = parseInt(row.querySelector(`[data-lotqty="${variantId}"]`).value, 10);
    const price = parseFloat(row.querySelector(`[data-lotprice="${variantId}"]`).value);
    if (!qty || qty < 1 || isNaN(price) || price < 0) { haptic('warning'); return; }
    UI.setBusy(addLotBtn, true);
    await handleAddLot(variantId, qty, price);
    return;
  }

  const toggle = e.target.closest('[data-toggle]');
  if (toggle) {
    const id = toggle.dataset.toggle;
    if (state.expandedProducts.has(id)) state.expandedProducts.delete(id);
    else state.expandedProducts.add(id);
    rerenderProducts();
    haptic('light');
  }
});

adminProductList.addEventListener('change', (e) => {
  const fileInput = e.target.closest('[data-mediainput]');
  if (fileInput) {
    const productId = fileInput.dataset.mediainput;
    handleMediaUpload(productId, fileInput.files);
  }
});

async function handleMediaUpload(productId, fileList) {
  const product = findProduct(productId);
  if (!product) return;
  product.media = product.media || [];
  const files = Array.from(fileList || []);
  const MAX_BYTES = 50 * 1024 * 1024; // 50 Mo, limite du bucket
  const statusEl = document.querySelector(`[data-mediastatus="${productId}"]`);
  const fileInput = document.querySelector(`[data-mediainput="${productId}"]`);
  if (fileInput) fileInput.disabled = true;

  let done = 0;
  for (const rawFile of files) {
    if (rawFile.size > MAX_BYTES) { alert(`"${rawFile.name}" dépasse 50 Mo, ignoré.`); continue; }
    if (statusEl) statusEl.textContent = `Envoi ${done + 1}/${files.length} — ${rawFile.name}...`;
    try {
      const file = rawFile.type.startsWith('image/') ? await compressImage(rawFile) : rawFile;
      const { data: uploadInfo } = await Admin.createUploadUrl({ product_id: productId, file_name: file.name });
      await uploadToSignedUrl({ bucket: 'product-media', path: uploadInfo.path, token: uploadInfo.token, file });
      const url = publicMediaUrl('product-media', uploadInfo.path);
      const type = file.type.startsWith('video') ? 'video' : 'image';
      const res = await Admin.createMedia({ product_id: productId, type, url, sort_order: 0 });
      product.media.push(res.data);
    } catch (err) {
      haptic('warning'); alert(`Échec de l'upload de "${rawFile.name}".`);
    }
    done++;
  }
  if (statusEl) statusEl.textContent = '';
  if (fileInput) fileInput.disabled = false;
  rerenderProducts();
  refreshGrid();
  haptic('success');
}

async function handleDeleteMedia(mediaId) {
  try {
    await Admin.deleteMedia(mediaId);
    state.products.forEach(p => { p.media = (p.media || []).filter(m => m.id !== mediaId); });
    rerenderProducts();
    refreshGrid();
    haptic('medium');
  } catch { haptic('warning'); alert('Impossible de supprimer ce média.'); }
}

async function handleAddVariant(productId, { name, unit, price, stock }) {
  const product = findProduct(productId);
  try {
    const res = await Admin.createVariant({ product_id: productId, name, unit, price, stock, sort_order: (product.variants || []).length });
    product.variants = (product.variants || []).concat({ ...res.data, lots: [] });
    haptic('success');
  } catch { haptic('warning'); alert("Impossible d'ajouter cette option."); }
  finally { rerenderProducts(); refreshGrid(); }
}

async function handleDeleteVariant(variantId) {
  try {
    await Admin.deleteVariant(variantId);
    state.products.forEach(p => { p.variants = (p.variants || []).filter(v => v.id !== variantId); });
    rerenderProducts();
    refreshGrid();
    haptic('medium');
  } catch { haptic('warning'); alert('Impossible de supprimer cette option.'); }
}

async function handleAddLot(variantId, quantity, price) {
  try {
    const res = await Admin.createLot({ variant_id: variantId, quantity, price });
    state.products.forEach(p => (p.variants || []).forEach(v => { if (v.id === variantId) v.lots = (v.lots || []).concat(res.data); }));
    haptic('success');
  } catch { haptic('warning'); alert("Impossible d'ajouter ce lot."); }
  finally { rerenderProducts(); refreshGrid(); }
}

async function handleDeleteLot(lotId) {
  try {
    await Admin.deleteLot(lotId);
    state.products.forEach(p => (p.variants || []).forEach(v => { v.lots = (v.lots || []).filter(l => l.id !== lotId); }));
    rerenderProducts();
    refreshGrid();
    haptic('medium');
  } catch { haptic('warning'); alert('Impossible de supprimer ce lot.'); }
}

// ---------- Initialisation ----------
export function initAdminPanel() {
  // Tout le câblage ci-dessus s'exécute à l'import — cette fonction
  // existe pour un point d'entrée explicite et lisible depuis app.js.
}
