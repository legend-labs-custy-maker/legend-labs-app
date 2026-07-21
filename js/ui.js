// ============================================================
// Rendu de l'interface : ce module ne fait que transformer des
// données en HTML / DOM. Aucun appel réseau ici.
// ============================================================

export function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

export function openSheet(sheet, backdrop) { backdrop.classList.add('show'); sheet.classList.add('show'); }
export function closeSheet(sheet, backdrop) { backdrop.classList.remove('show'); sheet.classList.remove('show'); }

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
  let html = `<div class="cat-pill ${activeId === 'all' ? 'active' : ''}" data-cat="all">Tout</div>`;
  categories.forEach(c => {
    html += `<div class="cat-pill ${activeId === c.id ? 'active' : ''}" data-cat="${c.id}">${escapeHtml(c.name)}</div>`;
  });
  bar.innerHTML = html;
  bar.querySelectorAll('.cat-pill').forEach(el => el.addEventListener('click', () => onSelect(el.dataset.cat)));
}

export function renderSubcategoryBar(subcategories, categoryId, activeSubId, onSelect) {
  const bar = document.getElementById('subBar');
  const subs = subcategories.filter(s => s.category_id === categoryId);
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

export function renderGrid(products, { onOpen, onQuickAdd }) {
  const grid = document.getElementById('grid');
  document.getElementById('resultCount').textContent = products.length + (products.length > 1 ? ' articles' : ' article');
  if (!products.length) {
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1;">Aucun article ne correspond 🔍<br>Essaie un autre filtre.</div>`;
    return;
  }
  grid.innerHTML = products.map(p => {
    const media = firstMedia(p);
    const variant = cheapestVariant(p);
    const outOfStock = !variant || variant.stock <= 0;
    const hasPromo = (p.variants || []).some(v => v.promo);
    const swatch = media
      ? (media.type === 'video'
        ? `<video src="${media.url}" muted loop autoplay playsinline></video>`
        : `<img src="${media.url}" alt="${escapeHtml(p.name)}" loading="lazy" decoding="async">`)
      : escapeHtml(p.name);
    return `
    <div class="pcard" data-id="${p.id}">
      ${p.is_featured && !outOfStock ? '<div class="tag new">NEW</div>' : ''}
      ${hasPromo && !outOfStock ? '<div class="tag promo">PROMO</div>' : ''}
      ${outOfStock ? '<div class="tag promo" style="background:#4a4a4a;">ÉPUISÉ</div>' : ''}
      <div class="swatch">${swatch}</div>
      <div class="info">
        <p class="pname">${escapeHtml(p.name)}</p>
        <p class="psub">${(p.variants || []).length} option${(p.variants || []).length > 1 ? 's' : ''}</p>
        <div class="price-row">
          <span class="price">${variant ? variant.price + ' €' : '—'}</span>
        </div>
      </div>
      <button class="add-btn" data-add="${p.id}" ${outOfStock ? 'disabled style="opacity:.35;"' : ''}>+</button>
    </div>`;
  }).join('');

  grid.querySelectorAll('.pcard').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('[data-add]')) return;
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
}

export function renderProductDetail(product, { selectedVariantId, onSelectVariant, onAddToCart, effectivePrice }) {
  const container = document.getElementById('productDetail');
  const media = (product.media || []).slice().sort((a, b) => a.sort_order - b.sort_order);
  const gallery = media.length
    ? `<div class="pd-gallery">${media.map(m => m.type === 'video'
        ? `<video src="${m.url}" controls playsinline></video>`
        : `<img src="${m.url}" alt="${escapeHtml(product.name)}">`).join('')}</div>`
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
        <div class="vstock">${outOfStock ? 'Épuisé' : v.stock <= 5 ? `Stock faible (${v.stock})` : 'En stock'}</div>
      </div>
      <div class="vprice">${price} €${v.old_price ? ` <span style="color:var(--muted); text-decoration:line-through; font-size:11px;">${v.old_price} €</span>` : ''}</div>
    </div>
    ${(v.lots || []).length ? (v.lots || []).map(l => `<div class="lot-row"><span>À partir de ${l.quantity}</span><span>${l.price} € (${Math.round(l.price / l.quantity * 100) / 100} €/unité)</span></div>`).join('') : ''}
    `;
  }).join('');

  container.innerHTML = `
    ${gallery}
    <h2 class="pd-name">${escapeHtml(product.name)}</h2>
    <p class="pd-desc">${escapeHtml(product.description || '')}</p>
    <div class="filter-group"><h4>Choisis une option</h4>${variantsHtml || '<p class="pd-desc">Aucune option disponible.</p>'}</div>
    <button class="primary-btn" id="pdAddBtn" ${!selected || selected.stock <= 0 ? 'disabled style="opacity:.5;"' : ''}>Ajouter au panier</button>
  `;

  container.querySelectorAll('.variant-row').forEach(row => {
    row.addEventListener('click', () => onSelectVariant(row.dataset.variant));
  });
  const addBtn = document.getElementById('pdAddBtn');
  if (addBtn) addBtn.addEventListener('click', () => onAddToCart(selected.id));
}

export function renderCartLines(lines, { onInc, onDec }) {
  const container = document.getElementById('cartLines');
  if (!lines.length) {
    container.innerHTML = `<div class="empty">Ton panier est vide 🛒<br>Ajoute des articles depuis la boutique.</div>`;
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

export function renderAdminCategories(categories, onDelete) {
  const list = document.getElementById('adminCatList');
  if (!categories.length) { list.innerHTML = `<p class="pd-desc">Aucune catégorie pour l'instant.</p>`; return; }
  list.innerHTML = categories.map(c => `
    <div class="admin-item">
      <span class="name">${escapeHtml(c.name)}</span>
      <button class="del" data-delcat="${c.id}">Suppr.</button>
    </div>`).join('');
  list.querySelectorAll('[data-delcat]').forEach(b => b.addEventListener('click', () => onDelete(b.dataset.delcat)));
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

export function renderAdminProducts(products, { onDelete, onManage }) {
  const list = document.getElementById('adminProductList');
  document.getElementById('adminProductCount').textContent = products.length;
  if (!products.length) { list.innerHTML = `<p class="pd-desc">Aucun produit pour l'instant.</p>`; return; }
  list.innerHTML = products.map(p => `
    <div class="admin-item">
      <span class="name">${escapeHtml(p.name)}</span>
      <span style="display:flex; gap:6px;">
        <button class="del" style="background:var(--card-2); border:1px solid var(--line); color:var(--ember-2);" data-manage="${p.id}">Gérer</button>
        <button class="del" data-delprod="${p.id}">Suppr.</button>
      </span>
    </div>`).join('');
  list.querySelectorAll('[data-delprod]').forEach(b => b.addEventListener('click', () => onDelete(b.dataset.delprod)));
  list.querySelectorAll('[data-manage]').forEach(b => b.addEventListener('click', () => onManage(b.dataset.manage)));
}

// ---------- Liens de contact ----------
export function renderContactLinks(links, { onOpen }) {
  const container = document.getElementById('contactLinksList');
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

// ---------- Éditeur produit détaillé (médias, variantes, lots) ----------
export function renderProductEditorTitle(product) {
  document.getElementById('peTitle').textContent = `Modifier — ${product.name}`;
}

export function renderMediaList(media, onDelete) {
  const container = document.getElementById('peMediaList');
  if (!media.length) { container.innerHTML = `<p class="pd-desc" style="margin-bottom:8px;">Aucun média pour l'instant.</p>`; return; }
  container.innerHTML = media.map(m => `
    <div class="media-thumb">
      ${m.type === 'video' ? `<video src="${m.url}" muted></video>` : `<img src="${m.url}" alt="">`}
      <button data-delmedia="${m.id}" aria-label="Supprimer">✕</button>
    </div>`).join('');
  container.querySelectorAll('[data-delmedia]').forEach(b => b.addEventListener('click', () => onDelete(b.dataset.delmedia)));
}

export function renderVariantEditor(variants, { onDeleteVariant, onAddLot, onDeleteLot }) {
  const container = document.getElementById('peVariantList');
  if (!variants.length) { container.innerHTML = `<p class="pd-desc">Aucune option pour l'instant — ajoute-en une ci-dessous.</p>`; return; }
  container.innerHTML = variants.map(v => `
    <div class="variant-edit-row" data-variant-id="${v.id}">
      <div class="variant-edit-head">
        <div>
          <b>${escapeHtml(v.name)}${v.unit ? ' ' + escapeHtml(v.unit) : ''}</b>
          <span class="vprice" style="margin-left:8px;">${v.price} €</span>
          <span style="color:var(--muted); font-size:11px; margin-left:6px;">stock: ${v.stock ?? 0}</span>
        </div>
        <button class="del" data-delvariant="${v.id}">✕</button>
      </div>
      ${(v.lots || []).map(l => `
        <div class="lot-edit-row">
          <span>À partir de ${l.quantity} → ${l.price} €</span>
          <button data-dellot="${l.id}">✕</button>
        </div>`).join('')}
      <div class="lot-add-row">
        <input type="number" min="1" placeholder="Qté" data-lotqty="${v.id}">
        <input type="number" min="0" step="0.01" placeholder="Prix total €" data-lotprice="${v.id}">
        <button data-addlot="${v.id}">+ Lot</button>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('[data-delvariant]').forEach(b => b.addEventListener('click', () => onDeleteVariant(b.dataset.delvariant)));
  container.querySelectorAll('[data-dellot]').forEach(b => b.addEventListener('click', () => onDeleteLot(b.dataset.dellot)));
  container.querySelectorAll('[data-addlot]').forEach(b => {
    const variantId = b.dataset.addlot;
    b.addEventListener('click', () => {
      const qtyInput = container.querySelector(`[data-lotqty="${variantId}"]`);
      const priceInput = container.querySelector(`[data-lotprice="${variantId}"]`);
      const qty = parseInt(qtyInput.value, 10);
      const price = parseFloat(priceInput.value);
      if (!qty || qty < 1 || isNaN(price) || price < 0) return;
      onAddLot(variantId, qty, price);
      qtyInput.value = ''; priceInput.value = '';
    });
  });
}
