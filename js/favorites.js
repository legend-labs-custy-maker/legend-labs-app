// ============================================================
// Favoris : liste synchronisée avec le compte Telegram du visiteur
// (contrairement aux "likes", qui sont anonymes et par appareil).
// Nécessite d'être ouvert depuis Telegram — indisponible sinon.
// ============================================================

import { addFavorite, removeFavorite, listFavorites } from './api.js?v20260726';

let favoriteIds = new Set();
let loaded = false;

export function isFavorite(productId) {
  return favoriteIds.has(productId);
}
export function getFavoriteIds() {
  return new Set(favoriteIds);
}

// Charge la liste depuis Supabase (à appeler une fois au démarrage,
// uniquement si l'app tourne bien dans Telegram).
export async function loadFavorites(initData) {
  if (!initData) return;
  try {
    const ids = await listFavorites(initData);
    favoriteIds = new Set(ids);
    loaded = true;
  } catch (err) {
    console.error('Chargement des favoris ignoré :', err);
  }
}

// Bascule un produit (ajouté <-> retiré), avec mise à jour optimiste de
// l'état local puis confirmation serveur — en cas d'échec réseau, on
// annule le changement local pour rester cohérent avec le serveur.
export async function toggleFavorite(initData, productId) {
  if (!initData) throw new Error('not_in_telegram');
  const wasFavorite = favoriteIds.has(productId);
  if (wasFavorite) favoriteIds.delete(productId); else favoriteIds.add(productId);

  try {
    if (wasFavorite) await removeFavorite(initData, productId);
    else await addFavorite(initData, productId);
    return !wasFavorite;
  } catch (err) {
    // on annule le changement optimiste si le serveur a refusé
    if (wasFavorite) favoriteIds.add(productId); else favoriteIds.delete(productId);
    throw err;
  }
}

export function favoritesLoaded() {
  return loaded;
}
