// ============================================================
// Point d'entrée : bootstrap de l'application. Toute la logique
// est déportée dans state.js (état partagé), shop.js (parcours
// client) et admin-panel.js (CMS). Ce fichier ne fait que démarrer
// les deux et gérer l'écran de lancement.
// ============================================================

import { close, haptic, sheets } from './state.js?v20260723';
import { initShop } from './shop.js?v20260723';
import { initAdminPanel } from './admin-panel.js?v20260723';
import * as UI from './ui.js?v20260723';

// Bouton de fermeture générique, commun à tous les panneaux
// (boutique et admin).
document.querySelectorAll('.sheet-close').forEach(btn => {
  btn.addEventListener('click', () => { close(btn.dataset.close); haptic('light'); });
});
// Clic sur l'arrière-plan sombre = fermer le panneau ouvert.
Object.entries(sheets).forEach(([key, [, backdrop]]) => backdrop.addEventListener('click', () => close(key)));

(async function boot() {
  try {
    UI.spawnEmbers(document.getElementById('emberField'), 22);
    initAdminPanel();
    await initShop();
  } catch (err) {
    console.error('Erreur au démarrage :', err);
    document.getElementById('resultCount').textContent = 'Erreur de chargement — vérifie la connexion.';
  } finally {
    setTimeout(() => {
      document.getElementById('splash').classList.add('hide');
      haptic('rigid');
    }, 2200);
  }
})();
