// ============================================================
// Traductions de l'interface (chrome de l'app : onglets, boutons,
// titres de section). Les contenus saisis par l'admin (noms de
// produits, descriptions, avis, textes Infos...) restent dans la
// langue où ils ont été écrits — ils ne sont pas traduits
// automatiquement.
// ============================================================

const DICT = {
  fr: {
    tab_home: 'Boutique', tab_infos: 'Infos', tab_cart: 'Panier', tab_avis: 'Avis', tab_settings: 'Profil',
    cart_label: 'Panier',
    infos_title: 'Infos', infos_sub: 'Contact, paiement, livraison et questions fréquentes.',
    contact_heading: 'Contact', payment_heading: 'Paiement', shipping_heading: 'Livraison', faq_heading: 'Questions fréquentes',
    reviews_title: 'Avis clients',
    settings_title: 'Profil',
    profile_outside_telegram: "Ouvre l'app depuis Telegram pour voir ton profil.",
    member_since: 'Membre depuis',
    favorites_heading: 'Mes favoris', no_favorites: "Tu n'as encore aucun favori — tape sur 🏷️ sur un produit pour l'ajouter.",
    notif_center_title: 'Notifications',
    home_new_arrivals: 'Nouveautés', home_popular: 'Produits populaires', home_recent_reviews: 'Avis récents',
    similar_products: 'Produits similaires',
    language_heading: 'Langue',
    notifications_heading: 'Notifications', notif_new_products: 'Nouveaux produits', notif_promos: 'Promotions',
    notif_note: "Préférence enregistrée sur cet appareil. L'envoi effectif des notifications sera activé prochainement.",
    sound_heading: 'Son', sound_app: "Sons de l'app",
    media_heading: 'Médias', media_autoplay: 'Lecture automatique des vidéos', media_autoplay_note: 'Désactive pour économiser des données mobiles.',
    search_placeholder: 'Rechercher un produit...',
    filter_btn: 'Filtrer', results_suffix_plural: 'articles', results_suffix_single: 'article',
    add_to_cart: 'Ajouter au panier', choose_option: 'Choisis une option',
    cart_title: 'Mon panier', cart_empty: 'Ton panier est vide 🛒', cart_empty_sub: 'Ajoute des articles depuis la boutique.',
    promo_title: 'Code promo', promo_placeholder: 'Entrer un code promo', promo_apply: 'Appliquer', promo_applied: '✅ Code appliqué',
    subtotal: 'Sous-total', discount: 'Réduction', total: 'Total', checkout: 'Commander',
    no_results: 'Aucun article ne correspond 🔍', no_results_sub: 'Essaie un autre filtre.',
    out_of_stock: 'Épuisé', low_stock: 'Stock faible', in_stock: 'En stock',
    no_reviews: 'Aucun avis pour le moment.',
  },
  en: {
    tab_home: 'Shop', tab_infos: 'Info', tab_cart: 'Cart', tab_avis: 'Reviews', tab_settings: 'Profile',
    cart_label: 'Cart',
    infos_title: 'Info', infos_sub: 'Contact, payment, shipping and FAQ.',
    contact_heading: 'Contact', payment_heading: 'Payment', shipping_heading: 'Shipping', faq_heading: 'FAQ',
    reviews_title: 'Customer reviews',
    settings_title: 'Profile',
    profile_outside_telegram: 'Open the app from Telegram to see your profile.',
    member_since: 'Member since',
    favorites_heading: 'My favorites', no_favorites: 'No favorites yet — tap 🏷️ on a product to add it.',
    notif_center_title: 'Notifications',
    language_heading: 'Language',
    notifications_heading: 'Notifications', notif_new_products: 'New products', notif_promos: 'Promotions',
    notif_note: 'Preference saved on this device. Actual notification delivery is coming soon.',
    sound_heading: 'Sound', sound_app: 'App sounds',
    media_heading: 'Media', media_autoplay: 'Autoplay videos', media_autoplay_note: 'Turn off to save mobile data.',
    search_placeholder: 'Search a product...',
    filter_btn: 'Filter', results_suffix_plural: 'items', results_suffix_single: 'item',
    add_to_cart: 'Add to cart', choose_option: 'Choose an option',
    cart_title: 'My cart', cart_empty: 'Your cart is empty 🛒', cart_empty_sub: 'Add items from the shop.',
    promo_title: 'Promo code', promo_placeholder: 'Enter a promo code', promo_apply: 'Apply', promo_applied: '✅ Code applied',
    subtotal: 'Subtotal', discount: 'Discount', total: 'Total', checkout: 'Order',
    no_results: 'No items match 🔍', no_results_sub: 'Try a different filter.',
    out_of_stock: 'Sold out', low_stock: 'Low stock', in_stock: 'In stock',
    no_reviews: 'No reviews yet.',
  },
};

const LANG_KEY = 'legendlabs_lang';
let currentLang = localStorage.getItem(LANG_KEY) || 'fr';

export function getLang() { return currentLang; }
export function setLang(lang) {
  if (!DICT[lang]) return;
  currentLang = lang;
  try { localStorage.setItem(LANG_KEY, lang); } catch { /* stockage indisponible */ }
}

export function t(key) {
  return (DICT[currentLang] && DICT[currentLang][key]) || DICT.fr[key] || key;
}

// Applique les traductions à tous les éléments [data-i18n] du document.
export function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
}
