// ============================================================
// Rendu de l'interface : ce module ne fait que transformer des
// données en HTML / DOM. Aucun appel réseau ici.
// ============================================================

import { t } from './i18n.js';
export function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

export function openSheet(sheet, backdrop) { backdrop.classList.add('show'); sheet.classList.add('show'); }
export function closeSheet(sheet, backdrop) { backdrop.classList.remove('show'); sheet.classList.remove('show'); }

// Bascule un bouton en état "en cours" (désactivé, libellé temporaire, spinner CSS).
// Réutilisé par toutes les actions admin asynchrones (créer, uploader, etc.).
export function setBusy(el, busy, busyLabel) {
  if (!el) return;
  if (busy) {
    if (el.dataset.originalText === undefined) el.dataset.originalText = el.textContent;
    el.disabled = true;
    el.classList.add('is-busy');
    if (busyLabel) el.textContent = busyLabel;
  } else {
    el.disabled = false;
    el.classList.remove('is-busy');
    if (el.dataset.originalText !== undefined) el.textContent = el.dataset.originalText;
  }
}

export function spawnEmbers(container, count = 22) {
  for (let i = 0; i < count; i++) {
    const e = document.createElement('div');
    e.className = 'ember-particle';
    const size = 2 + Math.random() * 4;
    e.style.width = size + 'px'; e.style.height = size + 'px';
    e.style.left = (Math.random() * 100) + '%';
    e.style.setProperty('--drift', (Math.random() * 60 - 30) + 'px');
    e.style.animationDuration = (2.4 + Math.random() * 2.2) + 's';
    e.style.animationDelay = (Math.random() * 2.5) + 's';
    container.appendChild(e);
  }
}

export function renderMarquee(text) {
  document.getElementById('marqueeText').textContent = text;
  document.getElementById('marqueeText2').textContent = text;
}

export function renderHero(settings) {
  document.title = settings.app_title || document.title;
  const splashTitle = document.getElementById('splashTitle');
  const heroTitle = document.getElementById('heroTitle');
  const welcome = document.getElementById('welcomeMsg');
  if (settings.app_title) { splashTitle.textContent = settings.app_title; heroTitle.textContent = settings.app_title; }
  if (settings.welcome_message) welcome.textContent = settings.welcome_message;
}

export function renderCategoryBar(categories, activeId, onSelect) {
  const bar = document.getElementById('catBar');
  const visible = categories.filter(c => !c.is_hidden);
  let html = `<div class="cat-pill ${activeId === 'all' ? 'active' : ''}" data-cat="all">Tout</div>`;
  visible.forEach(c => {
    html += `<div class="cat-pill ${activeId === c.id ? 'active' : ''}" data-cat="${c.id}">${escapeHtml(c.name)}</div>`;
  });
  bar.innerHTML = html;
  bar.querySelectorAll('.cat-pill').forEach(el => el.addEventListener('click', () => onSelect(el.dataset.cat)));
}

export function renderSubcategoryBar(subcategories, categoryId, activeSubId, onSelect) {
  const bar = document.getElementById('subBar');
  const subs = subcategories.filter(s => s.category_id === categoryId && !s.is_hidden);
  if (categoryId === 'all' || !subs.length) { bar.innerHTML = ''; bar.style.display = 'none'; return; }
  bar.style.display = 'flex';
  let html = `<div class="sub-chip ${activeSubId === 'all' ? 'active' : ''}" data-sub="all">Tout</div>`;
  subs.forEach(s => {
    html += `<div class="sub-chip ${activeSubId === s.id ? 'active' : ''}" data-sub="${s.id}">${escapeHtml(s.name)}</div>`;
  });
  bar.innerHTML = html;
  bar.querySelectorAll('.sub-chip').forEach(el => el.addEventListener('click', () => onSelect(el.dataset.sub)));
}

function firstMedia(product) {
  return (product.media || []).slice().sort((a, b) => a.sort_order - b.sort_order)[0] || null;
}
function cheapestVariant(product) {
  return (product.variants || []).slice().sort((a, b) => a.price - b.price)[0] || null;
}

export function renderGrid(products, { onOpen, onQuickAdd, onLike, onFavorite, isFavorite, videoAutoplay = true }) {
  const grid = document.getElementById('grid');
  document.getElementById('resultCount').textContent = products.length + ' ' + (products.length > 1 ? t('results_suffix_plural') : t('results_suffix_single'));
  if (!products.length) {
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1;">${t('no_results')}<br>${t('no_results_sub')}</div>`;
    return;
  }
  grid.innerHTML = products.map(p => {
    const media = firstMedia(p);
    const variant = cheapestVariant(p);
    const outOfStock = !variant || variant.stock <= 0;
    const hasPromo = (p.variants || []).some(v => v.promo);
    const swatch = media
      ? (media.type === 'video'
        ? `<video src="${media.url}" muted loop playsinline ${videoAutoplay ? 'autoplay' : ''}></video>`
        : `<img src="${media.url}" alt="${escapeHtml(p.name)}" loading="lazy" decoding="async">`)
      : escapeHtml(p.name);
    const favActive = isFavorite && isFavorite(p.id);
    return `
    <div class="pcard" data-id="${p.id}">
      ${p.is_featured && !outOfStock ? '<div class="tag new">NEW</div>' : ''}
      ${hasPromo && !outOfStock ? '<div class="tag promo">PROMO</div>' : ''}
      ${outOfStock ? '<div class="tag promo" style="background:#4a4a4a;">ÉPUISÉ</div>' : ''}
      <button class="fav-mini ${favActive ? 'active' : ''}" data-fav="${p.id}" aria-label="Favori">${favActive ? '🔖' : '🏷️'}</button>
      <div class="swatch">${swatch}</div>
      <div class="info">
        <p class="pname">${escapeHtml(p.name)}</p>
        <p class="psub">${(p.variants || []).length} option${(p.variants || []).length > 1 ? 's' : ''}</p>
        <div class="price-row">
          <span class="price">${variant ? variant.price + ' €' : '—'}</span>
          <span class="like-mini" data-like="${p.id}">🤍 ${p.likes || 0}</span>
        </div>
      </div>
      <button class="add-btn" data-add="${p.id}" ${outOfStock ? 'disabled style="opacity:.35;"' : ''}>+</button>
    </div>`;
  }).join('');

  grid.querySelectorAll('.pcard').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('[data-add]') || e.target.closest('[data-fav]')) return;
      onOpen(card.dataset.id);
    });
  });
  grid.querySelectorAll('[data-add]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (btn.disabled) return;
      onQuickAdd(btn.dataset.add);
    });
  });
  grid.querySelectorAll('[data-like]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      onLike(el.dataset.like, el);
    });
  });
  if (onFavorite) {
    grid.querySelectorAll('[data-fav]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        onFavorite(btn.dataset.fav, btn);
      });
    });
  }
}

export function renderProductDetail(product, { selectedVariantId, onSelectVariant, onAddToCart, effectivePrice, onOpenGallery, onLike, alreadyLiked, onFavorite, isFavorited }) {
  const container = document.getElementById('productDetail');
  const media = (product.media || []).slice().sort((a, b) => a.sort_order - b.sort_order);
  const gallery = media.length
    ? `<div class="pd-gallery">${media.map((m, i) => m.type === 'video'
        ? `<div class="pd-gallery-item" data-galleryidx="${i}"><video src="${m.url}" muted playsinline></video><span class="pd-play">▶</span></div>`
        : `<div class="pd-gallery-item" data-galleryidx="${i}"><img src="${m.url}" alt="${escapeHtml(product.name)}" loading="lazy"></div>`).join('')}</div>`
    : '';

  const variants = product.variants || [];
  const selected = variants.find(v => v.id === selectedVariantId) || variants[0];

  const variantsHtml = variants.map(v => {
    const outOfStock = v.stock <= 0;
    const price = effectivePrice(v, 1);
    return `
    <div class="variant-row ${selected && v.id === selected.id ? 'selected' : ''}" data-variant="${v.id}" style="${outOfStock ? 'opacity:.4;' : ''}">
      <div>
        <div class="vname">${escapeHtml(v.name)}${v.unit ? ' ' + escapeHtml(v.unit) : ''}</div>
        <div class="vstock">${outOfStock ? t('out_of_stock') : v.stock <= 5 ? `${t('low_stock')} (${v.stock})` : t('in_stock')}</div>
      </div>
      <div class="vprice">${price} €${v.old_price ? ` <span style="color:var(--muted); text-decoration:line-through; font-size:11px;">${v.old_price} €</span>` : ''}</div>
    </div>
    ${(v.lots || []).length ? (v.lots || []).map(l => `<div class="lot-row"><span>À partir de ${l.quantity}</span><span>${l.price} € (${Math.round(l.price / l.quantity * 100) / 100} €/unité)</span></div>`).join('') : ''}
    `;
  }).join('');

  container.innerHTML = `
    ${gallery}
    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
      <h2 class="pd-name" style="margin:0;">${escapeHtml(product.name)}</h2>
      <div style="display:flex; gap:6px; flex:0 0 auto;">
        ${onFavorite ? `<button class="like-btn ${isFavorited ? 'liked' : ''}" id="pdFavBtn">${isFavorited ? '🔖' : '🏷️'}</button>` : ''}
        <button class="like-btn ${alreadyLiked ? 'liked' : ''}" id="pdLikeBtn">${alreadyLiked ? '❤️' : '🤍'} <span id="pdLikeCount">${product.likes || 0}</span></button>
      </div>
    </div>
    <p class="pd-desc">${escapeHtml(product.description || '')}</p>
    <div class="filter-group"><h4>${t('choose_option')}</h4>${variantsHtml || '<p class="pd-desc">Aucune option disponible.</p>'}</div>
    <button class="primary-btn" id="pdAddBtn" ${!selected || selected.stock <= 0 ? 'disabled style="opacity:.5;"' : ''}>${t('add_to_cart')}</button>
    <div id="pdSimilar" style="margin-top:22px;"></div>
  `;

  if (onOpenGallery) {
    container.querySelectorAll('[data-galleryidx]').forEach(el => {
      el.addEventListener('click', () => onOpenGallery(parseInt(el.dataset.galleryidx, 10)));
    });
  }
  container.querySelectorAll('.variant-row').forEach(row => {
    row.addEventListener('click', () => onSelectVariant(row.dataset.variant));
  });
  const addBtn = document.getElementById('pdAddBtn');
  if (addBtn) addBtn.addEventListener('click', () => onAddToCart(selected.id));
  const favBtn = document.getElementById('pdFavBtn');
  if (favBtn && onFavorite) favBtn.addEventListener('click', () => onFavorite(product.id, favBtn));
  const likeBtn = document.getElementById('pdLikeBtn');
  if (likeBtn && onLike) likeBtn.addEventListener('click', () => onLike(product.id, likeBtn));
}

// ---------- Galerie plein écran (lightbox) : swipe entre médias, zoom photo ----------
export function openLightbox(media, startIndex = 0) {
  if (!media.length) return;
  const track = document.getElementById('lightboxTrack');
  track.innerHTML = media.map(m => `
    <div class="lightbox-item">
      ${m.type === 'video'
        ? `<video src="${m.url}" controls playsinline></video>`
        : `<img src="${m.url}" alt="">`}
    </div>`).join('');

  document.getElementById('lightbox').classList.add('show');

  requestAnimationFrame(() => {
    const items = track.querySelectorAll('.lightbox-item');
    if (items[startIndex]) items[startIndex].scrollIntoView({ behavior: 'instant', inline: 'center', block: 'nearest' });
  });

  // Double-tap pour zoomer/dézoomer une photo (les vidéos ont leurs propres contrôles).
  track.querySelectorAll('img').forEach(img => {
    let lastTap = 0;
    img.addEventListener('click', () => {
      const now = Date.now();
      if (now - lastTap < 320) img.classList.toggle('zoomed');
      lastTap = now;
    });
  });
}

export function closeLightbox() {
  const lb = document.getElementById('lightbox');
  lb.classList.remove('show');
  // Coupe le son/lecture des vidéos en cours avant de vider le contenu.
  document.getElementById('lightboxTrack').querySelectorAll('video').forEach(v => v.pause());
  document.getElementById('lightboxTrack').innerHTML = '';
}

export function renderCartLines(lines, { onInc, onDec }) {
  const container = document.getElementById('cartLines');
  if (!lines.length) {
    container.innerHTML = `<div class="empty">${t('cart_empty')}<br>${t('cart_empty_sub')}</div>`;
    document.getElementById('cartTotal').textContent = '0 €';
    return;
  }
  container.innerHTML = lines.map(l => {
    const media = firstMedia(l.product);
    return `
    <div class="cart-line" data-variant="${l.variant.id}">
      <div class="sw">${media && media.type === 'image' ? `<img src="${media.url}" alt="">` : ''}</div>
      <div class="meta">
        <p class="n">${escapeHtml(l.product.name)} — ${escapeHtml(l.variant.name)}</p>
        <p class="p">${l.unitPrice} € / unité · ${l.lineTotal} €</p>
      </div>
      <div class="qty">
        <button data-dec="${l.variant.id}">–</button>
        <span>${l.qty}</span>
        <button data-inc="${l.variant.id}">+</button>
      </div>
    </div>`;
  }).join('');
  container.querySelectorAll('[data-inc]').forEach(b => b.addEventListener('click', () => onInc(b.dataset.inc)));
  container.querySelectorAll('[data-dec]').forEach(b => b.addEventListener('click', () => onDec(b.dataset.dec)));
}

export function renderAdminCategories(categories, { onDelete, onMove }) {
  const list = document.getElementById('adminCatList');
  if (!categories.length) { list.innerHTML = `<p class="pd-desc">Aucune catégorie pour l'instant.</p>`; return; }
  list.innerHTML = categories.map((c, i) => `
    <div class="admin-item">
      <span class="name">${escapeHtml(c.name)}</span>
      <span style="display:flex; gap:5px; align-items:center; flex-wrap:wrap; justify-content:flex-end;">
        <button class="reorder-btn" data-moveupcat="${c.id}" ${i === 0 ? 'disabled' : ''} aria-label="Monter">▲</button>
        <button class="reorder-btn" data-movedowncat="${c.id}" ${i === categories.length - 1 ? 'disabled' : ''} aria-label="Descendre">▼</button>
        <button class="del" data-delcat="${c.id}">Suppr.</button>
      </span>
    </div>`).join('');
  list.querySelectorAll('[data-delcat]').forEach(b => b.addEventListener('click', () => onDelete(b.dataset.delcat)));
  list.querySelectorAll('[data-moveupcat]').forEach(b => b.addEventListener('click', () => onMove(b.dataset.moveupcat, -1)));
  list.querySelectorAll('[data-movedowncat]').forEach(b => b.addEventListener('click', () => onMove(b.dataset.movedowncat, 1)));
}

export function fillCategorySelect(selectEl, categories) {
  selectEl.innerHTML = categories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
}
export function fillSubcategorySelect(selectEl, subcategories, categoryId) {
  const subs = subcategories.filter(s => s.category_id === categoryId);
  selectEl.innerHTML = subs.length
    ? subs.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')
    : `<option value="">(aucune sous-catégorie)</option>`;
}

function mediaThumbHtml(m) {
  return `<div class="media-thumb">
    ${m.type === 'video' ? `<video src="${m.url}" muted></video>` : `<img src="${m.url}" alt="">`}
    <button data-delmedia="${m.id}" aria-label="Supprimer">✕</button>
  </div>`;
}

function variantEditHtml(v) {
  const lotsHtml = (v.lots || []).map(l => `
    <div class="lot-edit-row">
      <span>À partir de ${l.quantity} → ${l.price} €</span>
      <button data-dellot="${l.id}">✕</button>
    </div>`).join('');
  return `
  <div class="variant-edit-row">
    <div class="variant-edit-head">
      <div>
        <b>${escapeHtml(v.name)}${v.unit ? ' ' + escapeHtml(v.unit) : ''}</b>
        <span class="vprice" style="margin-left:8px;">${v.price} €</span>
        <span style="color:var(--muted); font-size:11px; margin-left:6px;">stock: ${v.stock ?? 0}</span>
      </div>
      <button class="del" data-delvariant="${v.id}">✕</button>
    </div>
    ${lotsHtml}
    <div class="lot-add-row">
      <input type="number" min="1" placeholder="Qté" data-lotqty="${v.id}">
      <input type="number" min="0" step="0.01" placeholder="Prix total €" data-lotprice="${v.id}">
      <button data-addlot="${v.id}">+ Lot</button>
    </div>
  </div>`;
}

// Liste des produits, dépliable : médias + options de prix (variantes) + lots
// intégrés directement dans l'onglet Produits (pas de sous-panneau séparé).
// Les clics sont gérés par délégation d'événements côté app.js.
export function renderAdminProducts(products, expandedIds) {
  const list = document.getElementById('adminProductList');
  document.getElementById('adminProductCount').textContent = products.length;
  if (!products.length) { list.innerHTML = `<p class="pd-desc">Aucun produit pour l'instant.</p>`; return; }

  list.innerHTML = products.map((p, i) => {
    const isOpen = expandedIds.has(p.id);
    return `
    <div class="admin-product-card ${p.is_hidden ? 'is-hidden-product' : ''}">
      <div class="admin-item admin-product-toggle" data-toggle="${p.id}">
        <span class="name">${escapeHtml(p.name)}${p.is_hidden ? ' <span class="hidden-badge">masqué</span>' : ''}</span>
        <span style="display:flex; gap:5px; align-items:center; flex-wrap:wrap; justify-content:flex-end;">
          <button class="reorder-btn" data-moveupprod="${p.id}" ${i === 0 ? 'disabled' : ''} aria-label="Monter">▲</button>
          <button class="reorder-btn" data-movedownprod="${p.id}" ${i === products.length - 1 ? 'disabled' : ''} aria-label="Descendre">▼</button>
          <button class="del" style="background:var(--card-2); border:1px solid var(--line); color:var(--ember-2);" data-togglehidden="${p.id}">${p.is_hidden ? 'Afficher' : 'Masquer'}</button>
          <button class="del" data-delprod="${p.id}">Suppr.</button>
          <span style="color:var(--ember-2); font-size:12px;">${isOpen ? '▴' : '▾'}</span>
        </span>
      </div>
      <div class="admin-product-expand" data-expand="${p.id}" style="${isOpen ? '' : 'display:none;'}">
        <h4 style="margin-top:14px;">Médias (photos / vidéos)</h4>
        <div class="media-thumb-row">${(p.media || []).map(mediaThumbHtml).join('') || '<p class="pd-desc" style="margin-bottom:0;">Aucun média.</p>'}</div>
        <input type="file" accept="image/*,video/*" multiple data-mediainput="${p.id}">
        <p class="media-status" data-mediastatus="${p.id}" style="color:var(--ember-2); font-size:11px; margin:5px 0 0; min-height:14px;"></p>
        <p style="color:var(--muted); font-size:11px; margin:2px 0 16px;">50 Mo max par fichier — les photos sont automatiquement optimisées.</p>

        <h4>Options de prix</h4>
        <p style="color:var(--muted); font-size:11.5px; margin:-6px 0 10px;">Ex : "5g" à 50€, "10g" à 90€ — chaque option a son propre prix et son propre stock.</p>
        <div>${(p.variants || []).map(variantEditHtml).join('') || '<p class="pd-desc">Aucune option — ajoute-en une ci-dessous.</p>'}</div>
        <div class="admin-add-box">
          <div style="display:flex; gap:8px;">
            <input type="text" maxlength="30" placeholder="Nom (ex: 5g, 1 pièce)" data-pvname="${p.id}">
            <select data-pvunit="${p.id}">
              <option value="pièce">pièce(s)</option>
              <option value="g">grammes (g)</option>
              <option value="kg">kilos (kg)</option>
            </select>
          </div>
          <div style="display:flex; gap:8px;">
            <input type="number" min="0" step="0.01" placeholder="Prix €" data-pvprice="${p.id}">
            <input type="number" min="0" step="1" placeholder="Stock" data-pvstock="${p.id}">
          </div>
          <button class="primary-btn" data-addvariant="${p.id}">+ Ajouter cette option</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ---------- Liens de contact ----------
export function renderContactLinks(links, { onOpen }) {
  const container = document.getElementById('contactLinksList');
  if (!container) return;
  if (!links.length) {
    container.innerHTML = `<p class="pd-desc">Aucun lien de contact configuré pour le moment.</p>`;
    return;
  }
  container.innerHTML = links.map(l => `
    <a class="contact-card" data-link="${l.id}" href="#">
      <div class="icon" style="background:rgba(255,122,26,.12); color:var(--ember-2);">${l.icon ? escapeHtml(l.icon) : '🔗'}</div>
      <div class="txt"><b>${escapeHtml(l.label)}</b></div>
    </a>`).join('');
  container.querySelectorAll('[data-link]').forEach(a => {
    const link = links.find(l => l.id === a.dataset.link);
    a.addEventListener('click', (e) => { e.preventDefault(); onOpen(link.url); });
  });
}

export function renderAdminContactLinks(links, onDelete) {
  const list = document.getElementById('adminContactLinksList');
  if (!links.length) { list.innerHTML = `<p class="pd-desc">Aucun lien pour l'instant.</p>`; return; }
  list.innerHTML = links.map(l => `
    <div class="admin-item">
      <span class="name">${l.icon ? escapeHtml(l.icon) + ' ' : ''}${escapeHtml(l.label)}</span>
      <button class="del" data-dellink="${l.id}">Suppr.</button>
    </div>`).join('');
  list.querySelectorAll('[data-dellink]').forEach(b => b.addEventListener('click', () => onDelete(b.dataset.dellink)));
}

export function renderAdminPromoCodes(promoCodes, onDelete) {
  const list = document.getElementById('adminPromoList');
  if (!promoCodes.length) { list.innerHTML = `<p class="pd-desc">Aucun code promo pour l'instant.</p>`; return; }
  const now = new Date();
  list.innerHTML = promoCodes.map(p => {
    const expired = p.ends_at && new Date(p.ends_at) < now;
    const usedUp = p.max_uses != null && p.used_count >= p.max_uses;
    const status = !p.is_active ? 'désactivé' : expired ? 'expiré' : usedUp ? 'épuisé' : 'actif';
    const statusColor = status === 'actif' ? 'var(--ember-2)' : 'var(--muted)';
    const valueLabel = p.type === 'percent' ? `${p.value}%` : `${p.value} €`;
    return `
    <div class="admin-item">
      <span class="name">${escapeHtml(p.code)} <span style="color:var(--muted); font-weight:500;">— ${valueLabel}</span>
        <span class="hidden-badge" style="color:${statusColor}; border-color:${statusColor};">${status}</span>
        <span style="display:block; font-size:10px; color:var(--muted); font-family:'JetBrains Mono'; margin-top:2px;">${p.used_count || 0}${p.max_uses != null ? '/' + p.max_uses : ''} utilisé(s)</span>
      </span>
      <button class="del" data-delpromo="${p.id}">Suppr.</button>
    </div>`;
  }).join('');
  list.querySelectorAll('[data-delpromo]').forEach(b => b.addEventListener('click', () => onDelete(b.dataset.delpromo)));
}

// ---------- Avis clients ----------
export function renderReviewsSummary(summary) {
  const el = document.getElementById('reviewsSummary');
  if (!el) return;
  const stars = (n) => '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n));
  el.innerHTML = summary.total ? `
    <div class="review-summary-box">
      <div class="review-avg">${summary.average}</div>
      <div>
        <div class="review-stars-big">${stars(summary.average)}</div>
        <div class="review-count">${summary.total} avis</div>
      </div>
    </div>` : '';
}

export function renderReviewsList(reviews) {
  const el = document.getElementById('reviewsList');
  if (!el) return;
  if (!reviews.length) { el.innerHTML = `<p class="pd-desc">${t('no_reviews')}</p>`; return; }
  const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);
  el.innerHTML = reviews.map(r => `
    <div class="review-card">
      <div class="review-head">
        <b>${escapeHtml(r.author_name)}</b>
        <span class="review-stars">${stars(r.rating)}</span>
      </div>
      ${r.comment ? `<p class="review-comment">${escapeHtml(r.comment)}</p>` : ''}
    </div>`).join('');
}

export function renderAdminReviews(reviews, { onToggleHidden, onDelete }) {
  const list = document.getElementById('adminReviewsList');
  if (!reviews.length) { list.innerHTML = `<p class="pd-desc">Aucun avis pour l'instant.</p>`; return; }
  list.innerHTML = reviews.map(r => `
    <div class="admin-item">
      <span class="name">${escapeHtml(r.author_name)} — ${'★'.repeat(r.rating)}${r.is_hidden ? ' <span class="hidden-badge">masqué</span>' : ''}</span>
      <span style="display:flex; gap:6px;">
        <button class="del" style="background:var(--card-2); border:1px solid var(--line); color:var(--ember-2);" data-togglereview="${r.id}">${r.is_hidden ? 'Publier' : 'Masquer'}</button>
        <button class="del" data-delreview="${r.id}">Suppr.</button>
      </span>
    </div>`).join('');
  list.querySelectorAll('[data-togglereview]').forEach(b => b.addEventListener('click', () => onToggleHidden(b.dataset.togglereview)));
  list.querySelectorAll('[data-delreview]').forEach(b => b.addEventListener('click', () => onDelete(b.dataset.delreview)));
}

// ---------- Onglet Infos (contenu texte éditable) ----------
export function renderInfoContent(elId, text) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = text || '';
}

// ---------- Profil membre ----------
export function renderProfileHeader(user) {
  const headerEl = document.getElementById('profileHeader');
  const outsideEl = document.getElementById('profileOutsideTelegram');
  if (!headerEl || !outsideEl) return;

  if (!user) {
    headerEl.style.display = 'none';
    outsideEl.style.display = 'block';
    return;
  }
  outsideEl.style.display = 'none';
  headerEl.style.display = 'flex';

  const avatarEl = document.getElementById('profileAvatar');
  const initial = (user.first_name || user.username || '?').charAt(0).toUpperCase();
  avatarEl.innerHTML = user.photo_url ? `<img src="${user.photo_url}" alt="">` : initial;

  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Sans nom';
  document.getElementById('profileName').textContent = fullName;
  document.getElementById('profileUsername').textContent = user.username ? '@' + user.username : '';

  const joined = user.created_at ? new Date(user.created_at).toLocaleDateString() : '—';
  document.getElementById('profileMeta').textContent = `${t('member_since')} ${joined} · ID ${user.telegram_id}`;
}

export function renderProfileFavorites(products, onOpen) {
  const el = document.getElementById('profileFavorites');
  if (!el) return;
  if (!products.length) { el.innerHTML = `<p class="pd-desc">${t('no_favorites')}</p>`; return; }
  el.innerHTML = `<div class="profile-fav-row">${products.map(p => {
    const media = firstMedia(p);
    return `
    <div class="profile-fav-card" data-favopen="${p.id}">
      <div class="sw">${media && media.type === 'image' ? `<img src="${media.url}" alt="">` : ''}</div>
      <p>${escapeHtml(p.name)}</p>
    </div>`;
  }).join('')}</div>`;
  el.querySelectorAll('[data-favopen]').forEach(card => {
    card.addEventListener('click', () => onOpen(card.dataset.favopen));
  });
}

// ---------- Centre de notifications ----------
const NOTIF_ICONS = { info: 'ℹ️', new_product: '✨', promo: '🔥' };

export function renderNotifBadge(count) {
  const el = document.getElementById('notifBadge');
  if (!el) return;
  el.textContent = count > 9 ? '9+' : String(count);
  el.classList.toggle('hidden', count <= 0);
}

export function renderNotifList(notifications) {
  const el = document.getElementById('notifList');
  if (!el) return;
  if (!notifications.length) { el.innerHTML = `<p class="pd-desc">Aucune notification pour le moment.</p>`; return; }
  el.innerHTML = notifications.map(n => `
    <div class="notif-card">
      <span class="icon">${NOTIF_ICONS[n.type] || 'ℹ️'}</span>
      <div>
        <b>${escapeHtml(n.title)}</b>
        ${n.message ? `<p>${escapeHtml(n.message)}</p>` : ''}
        <span class="date">${new Date(n.created_at).toLocaleDateString()}</span>
      </div>
    </div>`).join('');
}

export function renderAdminNotifications(notifications, onDelete) {
  const list = document.getElementById('adminNotifList');
  if (!list) return;
  if (!notifications.length) { list.innerHTML = `<p class="pd-desc">Aucune notification pour l'instant.</p>`; return; }
  list.innerHTML = notifications.map(n => `
    <div class="admin-item">
      <span class="name">${NOTIF_ICONS[n.type] || 'ℹ️'} ${escapeHtml(n.title)}</span>
      <button class="del" data-delnotif="${n.id}">Suppr.</button>
    </div>`).join('');
  list.querySelectorAll('[data-delnotif]').forEach(b => b.addEventListener('click', () => onDelete(b.dataset.delnotif)));
}

// ---------- Tableau de bord admin ----------
function formatBytes(bytes) {
  if (!bytes) return '0 Mo';
  const mb = bytes / (1024 * 1024);
  return mb < 1024 ? `${mb.toFixed(1)} Mo` : `${(mb / 1024).toFixed(2)} Go`;
}

// ---------- Bannières accueil ----------
export function renderBannerRow(banners, onOpen) {
  const el = document.getElementById('bannerRow');
  if (!el) return;
  el.innerHTML = banners.map(b => `<img src="${b.image_url}" data-banner="${b.id}" alt="">`).join('');
  el.querySelectorAll('[data-banner]').forEach(img => {
    const banner = banners.find(b => b.id === img.dataset.banner);
    if (banner?.link_url) img.addEventListener('click', () => onOpen(banner.link_url));
  });
}

export function renderAdminBanners(banners, { onToggleActive, onDelete }) {
  const el = document.getElementById('adminBannerList');
  if (!el) return;
  if (!banners.length) { el.innerHTML = `<p class="pd-desc">Aucune bannière pour l'instant.</p>`; return; }
  el.innerHTML = banners.map(b => `
    <div class="admin-item" style="flex-direction:column; align-items:stretch;">
      <img class="admin-banner-thumb" src="${b.image_url}" alt="">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span class="name" style="font-size:11px; color:var(--muted);">${b.link_url ? escapeHtml(b.link_url) : 'Aucun lien'}${!b.is_active ? ' · désactivée' : ''}</span>
        <span style="display:flex; gap:6px;">
          <button class="del" style="background:var(--card-2); border:1px solid var(--line); color:var(--ember-2);" data-togglebanner="${b.id}">${b.is_active ? 'Désactiver' : 'Activer'}</button>
          <button class="del" data-delbanner="${b.id}">Suppr.</button>
        </span>
      </div>
    </div>`).join('');
  el.querySelectorAll('[data-togglebanner]').forEach(b => b.addEventListener('click', () => onToggleActive(b.dataset.togglebanner)));
  el.querySelectorAll('[data-delbanner]').forEach(b => b.addEventListener('click', () => onDelete(b.dataset.delbanner)));
}

// ---------- Branding (logo, couleur) et activation des fonctionnalités ----------
export function applyBranding(settings) {
  const accent = settings.accent_color;
  if (accent) {
    document.documentElement.style.setProperty('--ember', accent);
  }
  const logo = settings.logo_url;
  if (logo) {
    document.querySelectorAll('.logo-wrap img, .brand-mark img, .maintenance-logo img').forEach(img => { img.src = logo; });
    const bgLogo = document.querySelector('.bg-logo');
    if (bgLogo) bgLogo.style.backgroundImage = `url('${logo}')`;
  }
}

export function applyFeatureToggles(settings) {
  const toggle = (selector, enabled) => document.querySelectorAll(selector).forEach(el => { el.style.display = enabled ? '' : 'none'; });
  toggle('[data-tab="avis"]', settings.feature_avis !== false);
  toggle('#notifBell', settings.feature_notifications !== false);
  toggle('.promo-box', settings.feature_promo !== false);
  // Favoris : masque juste les boutons, sans casser le reste de la carte/fiche
  toggle('.fav-mini, #pdFavBtn', settings.feature_favoris !== false);
}

export function renderDashboard(stats, reviews) {
  const el = document.getElementById('dashboardStats');
  if (!el) return;

  const statCard = (label, value) => `
    <div class="dash-stat"><b>${value}</b><span>${label}</span></div>`;

  const favList = (stats.topFavorited || []).length
    ? stats.topFavorited.map(f => `<div class="dash-row"><span>${escapeHtml(f.name)}</span><span class="dash-count">🔖 ${f.count}</span></div>`).join('')
    : `<p class="pd-desc">Aucun favori enregistré pour l'instant.</p>`;

  const usersList = (stats.latestUsers || []).length
    ? stats.latestUsers.map(u => `<div class="dash-row"><span>${escapeHtml(u.first_name || 'Sans nom')}${u.username ? ' @' + escapeHtml(u.username) : ''}</span><span class="dash-count">${new Date(u.created_at).toLocaleDateString()}</span></div>`).join('')
    : `<p class="pd-desc">Aucun visiteur enregistré pour l'instant.</p>`;

  const latestReviews = (reviews || []).slice(0, 5);
  const reviewsList = latestReviews.length
    ? latestReviews.map(r => `<div class="dash-row"><span>${escapeHtml(r.author_name)} — ${'★'.repeat(r.rating)}</span><span class="dash-count">${new Date(r.created_at).toLocaleDateString()}</span></div>`).join('')
    : `<p class="pd-desc">Aucun avis pour l'instant.</p>`;

  const actionsList = (stats.latestActions || []).length
    ? stats.latestActions.map(a => `<div class="dash-row"><span>${escapeHtml(a.action)}</span><span class="dash-count">${new Date(a.created_at).toLocaleDateString()} ${new Date(a.created_at).toLocaleTimeString().slice(0, 5)}</span></div>`).join('')
    : `<p class="pd-desc">Aucune action récente.</p>`;

  el.innerHTML = `
    <div class="dash-status">🟢 Services opérationnels (Supabase connecté)</div>
    <div class="dash-grid">
      ${statCard('Produits', stats.productCount ?? '—')}
      ${statCard('Catégories', stats.categoryCount ?? '—')}
      ${statCard('Utilisateurs Telegram', stats.userCount ?? '—')}
      ${statCard('Stockage utilisé', formatBytes(stats.storageBytes))}
    </div>

    <h4 class="info-section-h">🔖 Produits les plus favoris</h4>
    ${favList}

    <h4 class="info-section-h">👤 Derniers utilisateurs</h4>
    ${usersList}

    <h4 class="info-section-h">⭐ Derniers avis</h4>
    ${reviewsList}

    <h4 class="info-section-h">📋 Dernières actions admin</h4>
    ${actionsList}
  `;
}

// ---------- Sections d'accueil premium (nouveautés, populaires, avis) ----------
function miniProductCard(p) {
  const media = firstMedia(p);
  const variant = cheapestVariant(p);
  const swatch = media
    ? (media.type === 'video'
      ? `<video src="${media.url}" muted loop playsinline></video>`
      : `<img src="${media.url}" alt="${escapeHtml(p.name)}" loading="lazy">`)
    : '';
  return `
  <div class="home-card" data-homeopen="${p.id}">
    <div class="home-card-sw">${swatch}</div>
    <p class="home-card-name">${escapeHtml(p.name)}</p>
    <p class="home-card-price">${variant ? variant.price + ' €' : '—'}</p>
  </div>`;
}

function wireHomeCards(container, onOpen) {
  container.querySelectorAll('[data-homeopen]').forEach(card => {
    card.addEventListener('click', () => onOpen(card.dataset.homeopen));
  });
}

export function renderHomeSections(products, reviews, onOpen) {
  const el = document.getElementById('homeSections');
  if (!el) return;

  const visible = products.filter(p => !p.is_hidden);
  const featured = visible.filter(p => p.is_featured).slice(0, 8);
  const popular = visible.slice().sort((a, b) => (b.likes || 0) - (a.likes || 0)).filter(p => p.likes > 0).slice(0, 8);
  const recentReviews = (reviews || []).slice(0, 4);

  const section = (titleKey, defaultTitle, items) => items.length ? `
    <div class="home-section">
      <h3 class="home-section-title" data-i18n="${titleKey}">${defaultTitle}</h3>
      <div class="home-row">${items.map(miniProductCard).join('')}</div>
    </div>` : '';

  const reviewSection = recentReviews.length ? `
    <div class="home-section">
      <h3 class="home-section-title" data-i18n="home_recent_reviews">Avis récents</h3>
      <div class="home-row">${recentReviews.map(r => `
        <div class="home-review-card">
          <span class="review-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>
          <p>${escapeHtml(r.comment || '')}</p>
          <b>${escapeHtml(r.author_name)}</b>
        </div>`).join('')}</div>
    </div>` : '';

  el.innerHTML = section('home_new_arrivals', 'Nouveautés', featured)
    + section('home_popular', 'Produits populaires', popular)
    + reviewSection;

  el.querySelectorAll('.home-row').forEach(row => wireHomeCards(row, onOpen));
}

export function renderSimilarProducts(products, currentProduct, onOpen) {
  const container = document.getElementById('pdSimilar');
  if (!container) return;
  const similar = products
    .filter(p => p.id !== currentProduct.id && !p.is_hidden && p.category_id === currentProduct.category_id)
    .slice(0, 6);
  if (!similar.length) { container.innerHTML = ''; return; }
  container.innerHTML = `
    <h4 class="info-section-h" data-i18n="similar_products">Produits similaires</h4>
    <div class="home-row">${similar.map(miniProductCard).join('')}</div>
  `;
  wireHomeCards(container, onOpen);
}
