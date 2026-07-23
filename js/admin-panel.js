// ============================================================
// Panneau d'administration : connexion par identité Telegram,
// et gestion complète du contenu (catégories, produits, variantes,
// lots, médias, liens de contact, réglages généraux).
// Ne contient aucune logique de parcours client.
// ============================================================

import { ADMIN_TAP_TRIGGER_COUNT } from './config.js?v20260723';
import { uploadToSignedUrl, publicMediaUrl } from './api.js?v20260723';
import { compressImage } from './media.js?v20260723';
import { state, tg, haptic, open, close } from './state.js?v20260723';
import * as Admin from './admin.js?v20260723';
import * as Cart from './cart.js?v20260723';
import * as UI from './ui.js?v20260723';
import * as Products from './products.js?v20260723';
import { refreshGrid, refreshCategoryBars, refreshCategoryTiles, refreshHomeSections, updateMaintenanceScreen, openProduct } from './shop.js?v20260723';

// ---------- Connexion (identité Telegram, aucun mot de passe) ----------
let tapCount = 0, tapTimer = null;
async function handleAdminTriggerTap() {
  tapCount++;
  clearTimeout(tapTimer);
  tapTimer = setTimeout(() => { tapCount = 0; }, 1200);
  if (tapCount < ADMIN_TAP_TRIGGER_COUNT) return;
  tapCount = 0;
  haptic('rigid');

  if (Admin.isAdminLoggedIn()) { document.getElementById('maintenanceScreen').classList.remove('show'); openAdminPanel(); return; }

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
    document.getElementById('maintenanceScreen').classList.remove('show');
    setTimeout(() => { close('adminLogin'); openAdminPanel(); }, 400);
  } catch (err) {
    haptic('warning');
    if (String(err.message).includes('not_admin')) statusEl.textContent = "Ce compte Telegram n'est pas autorisé à administrer cette boutique.";
    else if (String(err.message).includes('too_many_attempts')) statusEl.textContent = 'Trop de tentatives, réessaie dans quelques minutes.';
    else statusEl.textContent = "Impossible de vérifier ton identité pour le moment.";
  }
}
document.getElementById('adminTrigger').addEventListener('click', handleAdminTriggerTap);
document.getElementById('maintenanceAdminTrigger').addEventListener('click', handleAdminTriggerTap);

document.querySelectorAll('.admin-tab').forEach(tabBtn => {
  tabBtn.addEventListener('click', () => {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
    tabBtn.classList.add('active');
    document.querySelector(`.admin-section[data-asection="${tabBtn.dataset.atab}"]`)?.classList.add('active');
    haptic('light');
    if (tabBtn.dataset.atab === 'dashboard') loadDashboard();
  });
});
document.getElementById('lockAdmin').addEventListener('click', () => { Admin.logoutAdmin(); close('admin'); });

async function openAdminPanel() {
  document.getElementById('adminWho').textContent = `Connecté : ${Admin.currentAdminName() || 'admin'}`;
  document.getElementById('adminTitle').value = state.settings.app_title || '';
  document.getElementById('adminWelcome').value = state.settings.welcome_message || '';
  document.getElementById('adminBanner').value = state.settings.banner_message || '';
  document.getElementById('adminContact').value = state.settings.contact_link || '';
  document.getElementById('adminPaymentInfo').value = state.settings.payment_info || '';
  document.getElementById('adminShippingInfo').value = state.settings.shipping_info || '';
  document.getElementById('adminFaqInfo').value = state.settings.faq_content || '';
  document.getElementById('adminMaintenanceToggle').checked = state.settings.maintenance_enabled === true || state.settings.maintenance_enabled === 'true';
  document.getElementById('adminMaintenanceTitle').value = state.settings.maintenance_title || '';
  document.getElementById('adminMaintenanceMessage').value = state.settings.maintenance_message || '';
  document.getElementById('adminAccentColor').value = state.settings.accent_color || '#FF7A1A';
  document.getElementById('featureAvis').checked = state.settings.feature_avis !== false;
  document.getElementById('featureNotif').checked = state.settings.feature_notifications !== false;
  document.getElementById('featureFavoris').checked = state.settings.feature_favoris !== false;
  document.getElementById('featurePromo').checked = state.settings.feature_promo !== false;
  const logoPreview = document.getElementById('logoPreview');
  logoPreview.innerHTML = state.settings.logo_url ? `<img src="${state.settings.logo_url}" style="width:100%;height:100%;object-fit:cover;">` : '';

  // Vue complète (inclut les catégories/produits masqués, invisibles en lecture publique)
  try {
    const res = await Admin.loadAdminData();
    state.categories = res.data.categories;
    state.subcategories = res.data.subcategories;
    state.products = res.data.products;
    state.contactLinks = res.data.contactLinks;
    state.promoCodes = res.data.promoCodes || [];
    state.reviews = res.data.reviews || [];
    state.notifications = res.data.notifications || [];
    state.banners = res.data.banners || [];
  } catch {
    haptic('warning'); alert("Impossible de charger les données à jour — celles déjà affichées peuvent être incomplètes.");
  }

  UI.fillCategorySelect(document.getElementById('npCat'), state.categories);
  UI.fillSubcategorySelect(document.getElementById('npSub'), state.subcategories, state.categories[0]?.id);
  document.getElementById('npCat').onchange = (e) => UI.fillSubcategorySelect(document.getElementById('npSub'), state.subcategories, e.target.value);
  UI.fillProductSelect(document.getElementById('bnProduct'), state.products);
  UI.renderAdminCategories(state.categories, { onDelete: handleDeleteCategory, onMove: handleMoveCategory, onIconChange: handleCategoryIconChange });
  UI.renderAdminProducts(state.products, state.expandedProducts);
  UI.renderAdminContactLinks(state.contactLinks, handleDeleteContactLink);
  UI.renderAdminPromoCodes(state.promoCodes, handleDeletePromoCode);
  UI.renderAdminReviews(state.reviews, { onToggleHidden: handleToggleReviewHidden, onDelete: handleDeleteReview });
  UI.renderAdminNotifications(state.notifications, handleDeleteNotification);
  UI.renderAdminBanners(state.banners, { onToggleActive: handleToggleBanner, onDelete: handleDeleteBanner, onSaveButton: handleSaveBannerButton });
  UI.renderAdminStocks(state.products);
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
  document.querySelector('.admin-tab[data-atab="dashboard"]')?.classList.add('active');
  document.querySelector('.admin-section[data-asection="dashboard"]')?.classList.add('active');
  open('admin');
  loadDashboard();
}

async function loadDashboard() {
  const el = document.getElementById('dashboardStats');
  if (!el) return;
  el.innerHTML = `<p class="pd-desc">Chargement...</p>`;
  try {
    const res = await Admin.loadDashboardStats();
    UI.renderDashboard(res.data, state.reviews);
  } catch {
    el.innerHTML = `<p class="pd-desc">Impossible de charger les statistiques pour le moment.</p>`;
  }
}

// ---------- Réglages généraux ----------
document.getElementById('saveGeneral').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  const title = document.getElementById('adminTitle').value.trim();
  const welcome = document.getElementById('adminWelcome').value.trim();
  const banner = document.getElementById('adminBanner').value.trim();
  const contact = document.getElementById('adminContact').value.trim();
  const paymentInfo = document.getElementById('adminPaymentInfo').value.trim();
  const shippingInfo = document.getElementById('adminShippingInfo').value.trim();
  const faqInfo = document.getElementById('adminFaqInfo').value.trim();
  const maintenanceEnabled = document.getElementById('adminMaintenanceToggle').checked;
  const maintenanceTitle = document.getElementById('adminMaintenanceTitle').value.trim();
  const maintenanceMessage = document.getElementById('adminMaintenanceMessage').value.trim();
  const accentColor = document.getElementById('adminAccentColor').value;
  const featureAvis = document.getElementById('featureAvis').checked;
  const featureNotif = document.getElementById('featureNotif').checked;
  const featureFavoris = document.getElementById('featureFavoris').checked;
  const featurePromo = document.getElementById('featurePromo').checked;
  UI.setBusy(btn, true);
  try {
    if (title) { await Admin.saveSetting('app_title', title); state.settings.app_title = title; }
    if (welcome) { await Admin.saveSetting('welcome_message', welcome); state.settings.welcome_message = welcome; }
    if (banner) { await Admin.saveSetting('banner_message', banner); state.settings.banner_message = banner; }
    if (contact && Cart.isSafeUrl(contact)) { await Admin.saveSetting('contact_link', contact); state.settings.contact_link = contact; }
    await Admin.saveSetting('payment_info', paymentInfo); state.settings.payment_info = paymentInfo;
    await Admin.saveSetting('shipping_info', shippingInfo); state.settings.shipping_info = shippingInfo;
    await Admin.saveSetting('faq_content', faqInfo); state.settings.faq_content = faqInfo;
    await Admin.saveSetting('maintenance_enabled', maintenanceEnabled); state.settings.maintenance_enabled = maintenanceEnabled;
    await Admin.saveSetting('maintenance_title', maintenanceTitle); state.settings.maintenance_title = maintenanceTitle;
    await Admin.saveSetting('maintenance_message', maintenanceMessage); state.settings.maintenance_message = maintenanceMessage;
    await Admin.saveSetting('accent_color', accentColor); state.settings.accent_color = accentColor;
    await Admin.saveSetting('feature_avis', featureAvis); state.settings.feature_avis = featureAvis;
    await Admin.saveSetting('feature_notifications', featureNotif); state.settings.feature_notifications = featureNotif;
    await Admin.saveSetting('feature_favoris', featureFavoris); state.settings.feature_favoris = featureFavoris;
    await Admin.saveSetting('feature_promo', featurePromo); state.settings.feature_promo = featurePromo;
    UI.renderHero(state.settings);
    UI.renderMarquee(state.settings.banner_message || '');
    UI.renderInfoContent('infoPayment', state.settings.payment_info);
    UI.renderInfoContent('infoShipping', state.settings.shipping_info);
    UI.renderInfoContent('infoFaq', state.settings.faq_content);
    UI.applyBranding(state.settings);
    UI.applyFeatureToggles(state.settings);
    // On ne réaffiche pas l'écran de maintenance par-dessus l'admin lui-même
    // (sinon tu te bloquerais toi-même après activation) — il s'appliquera
    // au prochain chargement pour les visiteurs.
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
  const iconFile = document.getElementById('ncIconFile').files[0];
  const statusEl = document.getElementById('ncStatus');
  UI.setBusy(btn, true);
  try {
    let icon_image_url = null;
    if (iconFile) {
      statusEl.textContent = 'Envoi de l\'icône...';
      const compressed = await compressImage(iconFile);
      const { data: uploadInfo } = await Admin.createUploadUrl({ folder: 'category-icons', file_name: compressed.name });
      await uploadToSignedUrl({ bucket: 'product-media', path: uploadInfo.path, token: uploadInfo.token, file: compressed });
      icon_image_url = publicMediaUrl('product-media', uploadInfo.path);
    }
    const res = await Admin.createCategory({ name, icon_image_url, sort_order: state.categories.length });
    state.categories.push(res.data);
    document.getElementById('ncName').value = '';
    document.getElementById('ncIconFile').value = '';
    statusEl.textContent = '';
    UI.renderAdminCategories(state.categories, { onDelete: handleDeleteCategory, onMove: handleMoveCategory, onIconChange: handleCategoryIconChange });
    UI.fillCategorySelect(document.getElementById('npCat'), state.categories);
    refreshCategoryTiles();
    refreshCategoryBars();
    haptic('success');
  } catch { statusEl.textContent = ''; haptic('warning'); alert('Impossible de créer la catégorie.'); }
  finally { UI.setBusy(btn, false); }
});
async function handleCategoryIconChange(id, file) {
  const category = state.categories.find(c => c.id === id);
  if (!category || !file) return;
  try {
    const compressed = await compressImage(file);
    const { data: uploadInfo } = await Admin.createUploadUrl({ folder: 'category-icons', file_name: compressed.name });
    await uploadToSignedUrl({ bucket: 'product-media', path: uploadInfo.path, token: uploadInfo.token, file: compressed });
    const icon_image_url = publicMediaUrl('product-media', uploadInfo.path);
    await Admin.updateCategory(id, { icon_image_url });
    category.icon_image_url = icon_image_url;
    UI.renderAdminCategories(state.categories, { onDelete: handleDeleteCategory, onMove: handleMoveCategory, onIconChange: handleCategoryIconChange });
    refreshCategoryTiles();
    haptic('success');
  } catch { haptic('warning'); alert("Impossible de mettre à jour l'icône."); }
}
async function handleDeleteCategory(id) {
  try {
    await Admin.deleteCategory(id);
    state.categories = state.categories.filter(c => c.id !== id);
    UI.renderAdminCategories(state.categories, { onDelete: handleDeleteCategory, onMove: handleMoveCategory, onIconChange: handleCategoryIconChange });
    UI.fillCategorySelect(document.getElementById('npCat'), state.categories);
    refreshCategoryTiles();
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
    UI.renderAdminCategories(state.categories, { onDelete: handleDeleteCategory, onMove: handleMoveCategory, onIconChange: handleCategoryIconChange });
    refreshCategoryTiles();
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
  const highlights = document.getElementById('npHighlights').value.trim();
  const price = parseFloat(document.getElementById('npPrice').value) || 0;
  const stock = parseInt(document.getElementById('npStock').value, 10) || 0;
  const unit = document.getElementById('npUnit').value || 'pièce';
  if (!name) { haptic('warning'); return; }
  UI.setBusy(btn, true);
  try {
    const prodRes = await Admin.createProduct({ name, description, highlights, category_id, subcategory_id, sort_order: state.products.length });
    const product = prodRes.data;
    const variantRes = await Admin.createVariant({ product_id: product.id, name: 'Standard', unit, price, stock, sort_order: 0 });
    product.variants = [{ ...variantRes.data, lots: [] }];
    product.media = [];
    state.products.push(product);
    document.getElementById('npName').value = '';
    document.getElementById('npDesc').value = '';
    document.getElementById('npHighlights').value = '';
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

async function handleSaveHighlights(id, highlights) {
  const product = state.products.find(p => p.id === id);
  if (!product) return;
  try {
    await Admin.updateProduct(id, { highlights });
    product.highlights = highlights;
    refreshGrid();
    haptic('success');
  } catch { haptic('warning'); alert('Impossible d\'enregistrer les badges.'); }
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

  const saveHighlightsBtn = e.target.closest('[data-savehighlights]');
  if (saveHighlightsBtn) {
    const productId = saveHighlightsBtn.dataset.savehighlights;
    const input = document.querySelector(`[data-highlights="${productId}"]`);
    handleSaveHighlights(productId, input.value.trim());
    return;
  }

  const toggleHiddenBtn = e.target.closest('[data-togglehidden]');
  if (toggleHiddenBtn) { handleToggleHidden(toggleHiddenBtn.dataset.togglehidden); return; }

  const moveUpProdBtn = e.target.closest('[data-moveupprod]');
  if (moveUpProdBtn) { handleMoveProduct(moveUpProdBtn.dataset.moveupprod, -1); return; }

  const moveDownProdBtn = e.target.closest('[data-movedownprod]');
  if (moveDownProdBtn) { handleMoveProduct(moveDownProdBtn.dataset.movedownprod, 1); return; }

  const delMediaBtn = e.target.closest('[data-delmedia]');
  if (delMediaBtn) { handleDeleteMedia(delMediaBtn.dataset.delmedia); return; }

  const delBadgeBtn = e.target.closest('[data-delbadge]');
  if (delBadgeBtn) { handleDeleteBadge(delBadgeBtn.dataset.delbadge); return; }

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
    return;
  }
  const badgeInput = e.target.closest('[data-badgeinput]');
  if (badgeInput) {
    const productId = badgeInput.dataset.badgeinput;
    const file = badgeInput.files[0];
    if (file) handleBadgeUpload(productId, file);
  }
});

async function handleBadgeUpload(productId, file) {
  const product = findProduct(productId);
  if (!product) return;
  try {
    const compressed = await compressImage(file);
    const { data: uploadInfo } = await Admin.createUploadUrl({ folder: 'product-badges', file_name: compressed.name });
    await uploadToSignedUrl({ bucket: 'product-media', path: uploadInfo.path, token: uploadInfo.token, file: compressed });
    const badge_image_url = publicMediaUrl('product-media', uploadInfo.path);
    await Admin.updateProduct(productId, { badge_image_url });
    product.badge_image_url = badge_image_url;
    rerenderProducts();
    refreshGrid();
    refreshHomeSections();
    haptic('success');
  } catch { haptic('warning'); alert("Impossible d'envoyer ce badge."); }
}

async function handleDeleteBadge(productId) {
  const product = findProduct(productId);
  if (!product) return;
  try {
    await Admin.updateProduct(productId, { badge_image_url: null });
    product.badge_image_url = null;
    rerenderProducts();
    refreshGrid();
    refreshHomeSections();
    haptic('medium');
  } catch { haptic('warning'); alert('Impossible de supprimer ce badge.'); }
}

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

// ---------- Codes promo ----------
document.getElementById('addPromoBtn').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  const code = document.getElementById('pcCode').value.trim().toUpperCase();
  const type = document.getElementById('pcType').value;
  const value = parseFloat(document.getElementById('pcValue').value);
  const maxUsesRaw = document.getElementById('pcMaxUses').value.trim();
  const minOrderRaw = document.getElementById('pcMinOrder').value.trim();
  const expiresRaw = document.getElementById('pcExpires').value;
  if (!code || isNaN(value) || value <= 0) { haptic('warning'); alert('Code et valeur requis.'); return; }

  const data = {
    code, type, value,
    max_uses: maxUsesRaw ? parseInt(maxUsesRaw, 10) : null,
    min_order: minOrderRaw ? parseFloat(minOrderRaw) : 0,
    ends_at: expiresRaw ? new Date(expiresRaw + 'T23:59:59').toISOString() : null,
  };
  UI.setBusy(btn, true);
  try {
    const res = await Admin.createPromoCode(data);
    state.promoCodes = [res.data, ...state.promoCodes];
    document.getElementById('pcCode').value = '';
    document.getElementById('pcValue').value = '';
    document.getElementById('pcMaxUses').value = '';
    document.getElementById('pcMinOrder').value = '';
    document.getElementById('pcExpires').value = '';
    UI.renderAdminPromoCodes(state.promoCodes, handleDeletePromoCode);
    haptic('success');
  } catch (err) {
    haptic('warning');
    alert(String(err.message).includes('duplicate') ? 'Ce code existe déjà.' : 'Impossible de créer ce code promo.');
  } finally {
    UI.setBusy(btn, false);
  }
});

async function handleDeletePromoCode(id) {
  try {
    await Admin.deletePromoCode(id);
    state.promoCodes = state.promoCodes.filter(p => p.id !== id);
    UI.renderAdminPromoCodes(state.promoCodes, handleDeletePromoCode);
    haptic('medium');
  } catch { haptic('warning'); alert('Impossible de supprimer ce code.'); }
}

// ---------- Avis clients ----------
function refreshPublicReviews() {
  const visible = state.reviews.filter(r => !r.is_hidden);
  UI.renderReviewsSummary(Products.reviewsSummary(visible));
  UI.renderReviewsList(visible);
}

document.getElementById('addReviewBtn').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  const author_name = document.getElementById('rvName').value.trim();
  const rating = parseInt(document.getElementById('rvRating').value, 10);
  const comment = document.getElementById('rvComment').value.trim();
  if (!author_name) { haptic('warning'); alert('Nom du client requis.'); return; }
  UI.setBusy(btn, true);
  try {
    const res = await Admin.createReview({ author_name, rating, comment, is_hidden: false });
    state.reviews = [res.data, ...state.reviews];
    document.getElementById('rvName').value = '';
    document.getElementById('rvComment').value = '';
    UI.renderAdminReviews(state.reviews, { onToggleHidden: handleToggleReviewHidden, onDelete: handleDeleteReview });
    refreshPublicReviews();
    haptic('success');
  } catch { haptic('warning'); alert("Impossible d'ajouter cet avis."); }
  finally { UI.setBusy(btn, false); }
});

async function handleToggleReviewHidden(id) {
  const review = state.reviews.find(r => r.id === id);
  if (!review) return;
  const next = !review.is_hidden;
  try {
    await Admin.updateReview(id, { is_hidden: next });
    review.is_hidden = next;
    UI.renderAdminReviews(state.reviews, { onToggleHidden: handleToggleReviewHidden, onDelete: handleDeleteReview });
    refreshPublicReviews();
    haptic('success');
  } catch { haptic('warning'); alert("Impossible de changer la visibilité de l'avis."); }
}

async function handleDeleteReview(id) {
  try {
    await Admin.deleteReview(id);
    state.reviews = state.reviews.filter(r => r.id !== id);
    UI.renderAdminReviews(state.reviews, { onToggleHidden: handleToggleReviewHidden, onDelete: handleDeleteReview });
    refreshPublicReviews();
    haptic('medium');
  } catch { haptic('warning'); alert('Impossible de supprimer cet avis.'); }
}

// ---------- Notifications ----------
function refreshPublicNotifs() {
  UI.renderNotifList(state.notifications);
}

document.getElementById('addNotifBtn').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  const title = document.getElementById('nfTitle').value.trim();
  const message = document.getElementById('nfMessage').value.trim();
  const type = document.getElementById('nfType').value;
  if (!title) { haptic('warning'); alert('Titre requis.'); return; }
  UI.setBusy(btn, true);
  try {
    const res = await Admin.createNotification({ title, message, type, is_published: true });
    state.notifications = [res.data, ...state.notifications];
    document.getElementById('nfTitle').value = '';
    document.getElementById('nfMessage').value = '';
    UI.renderAdminNotifications(state.notifications, handleDeleteNotification);
    refreshPublicNotifs();
    haptic('success');
  } catch { haptic('warning'); alert('Impossible de publier cette notification.'); }
  finally { UI.setBusy(btn, false); }
});

async function handleDeleteNotification(id) {
  try {
    await Admin.deleteNotification(id);
    state.notifications = state.notifications.filter(n => n.id !== id);
    UI.renderAdminNotifications(state.notifications, handleDeleteNotification);
    refreshPublicNotifs();
    haptic('medium');
  } catch { haptic('warning'); alert('Impossible de supprimer cette notification.'); }
}

// ---------- Bannières accueil ----------
function refreshPublicBanners() {
  UI.renderBannerRow(state.banners.filter(b => b.is_active), (banner) => {
    if (banner.product_id && state.products.some(p => p.id === banner.product_id)) {
      openProduct(banner.product_id);
      close('admin');
    } else if (banner.link_url) {
      Cart.goToCheckout(banner.link_url, tg);
    }
  });
}

document.getElementById('bnFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const statusEl = document.getElementById('bnStatus');
  const linkUrl = document.getElementById('bnLink').value.trim();
  const productId = document.getElementById('bnProduct').value || null;
  const buttonText = document.getElementById('bnButtonText').value.trim();
  const showButton = document.getElementById('bnShowButton').checked;
  statusEl.textContent = 'Envoi en cours...';
  try {
    const compressed = await compressImage(file);
    const { data: uploadInfo } = await Admin.createUploadUrl({ folder: 'banners', file_name: compressed.name });
    await uploadToSignedUrl({ bucket: 'product-media', path: uploadInfo.path, token: uploadInfo.token, file: compressed });
    const image_url = publicMediaUrl('product-media', uploadInfo.path);
    const res = await Admin.createBanner({ image_url, link_url: productId ? null : (linkUrl || null), product_id: productId, button_text: buttonText || null, show_button: showButton, sort_order: state.banners.length, is_active: true });
    state.banners.push(res.data);
    document.getElementById('bnLink').value = '';
    document.getElementById('bnProduct').value = '';
    document.getElementById('bnButtonText').value = '';
    document.getElementById('bnShowButton').checked = true;
    e.target.value = '';
    statusEl.textContent = '';
    UI.renderAdminBanners(state.banners, { onToggleActive: handleToggleBanner, onDelete: handleDeleteBanner, onSaveButton: handleSaveBannerButton });
    refreshPublicBanners();
    haptic('success');
  } catch (err) {
    statusEl.textContent = "Échec de l'envoi.";
    haptic('warning');
  }
});

async function handleToggleBanner(id) {
  const banner = state.banners.find(b => b.id === id);
  if (!banner) return;
  const next = !banner.is_active;
  try {
    await Admin.updateBanner(id, { is_active: next });
    banner.is_active = next;
    UI.renderAdminBanners(state.banners, { onToggleActive: handleToggleBanner, onDelete: handleDeleteBanner, onSaveButton: handleSaveBannerButton });
    refreshPublicBanners();
    haptic('success');
  } catch { haptic('warning'); alert('Impossible de modifier cette bannière.'); }
}

async function handleSaveBannerButton(id, data) {
  const banner = state.banners.find(b => b.id === id);
  if (!banner) return;
  try {
    await Admin.updateBanner(id, data);
    Object.assign(banner, data);
    refreshPublicBanners();
    haptic('success');
  } catch { haptic('warning'); alert('Impossible de mettre à jour ce bouton.'); }
}

async function handleDeleteBanner(id) {
  try {
    await Admin.deleteBanner(id);
    state.banners = state.banners.filter(b => b.id !== id);
    UI.renderAdminBanners(state.banners, { onToggleActive: handleToggleBanner, onDelete: handleDeleteBanner, onSaveButton: handleSaveBannerButton });
    refreshPublicBanners();
    haptic('medium');
  } catch { haptic('warning'); alert('Impossible de supprimer cette bannière.'); }
}

// ---------- Logo ----------
document.getElementById('logoFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const statusEl = document.getElementById('logoStatus');
  statusEl.textContent = 'Envoi en cours...';
  try {
    const compressed = await compressImage(file);
    const { data: uploadInfo } = await Admin.createUploadUrl({ folder: 'branding', file_name: compressed.name });
    await uploadToSignedUrl({ bucket: 'product-media', path: uploadInfo.path, token: uploadInfo.token, file: compressed });
    const logo_url = publicMediaUrl('product-media', uploadInfo.path);
    await Admin.saveSetting('logo_url', logo_url);
    await Admin.saveSetting('logo_small_url', logo_url);
    state.settings.logo_url = logo_url;
    state.settings.logo_small_url = logo_url;
    document.getElementById('logoPreview').innerHTML = `<img src="${logo_url}" style="width:100%;height:100%;object-fit:cover;">`;
    UI.applyBranding(state.settings);
    statusEl.textContent = 'Logo mis à jour ✅';
    e.target.value = '';
    haptic('success');
  } catch (err) {
    statusEl.textContent = "Échec de l'envoi.";
    haptic('warning');
  }
});
