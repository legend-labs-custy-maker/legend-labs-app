// ============================================================
// Point d'entrée : bootstrap de l'application. Toute la logique
// est déportée dans state.js (état partagé), shop.js (parcours
// client) et admin-panel.js (CMS). Ce fichier ne fait que démarrer
// les deux et gérer l'écran de lancement.
// ============================================================

import { close, haptic, sheets } from './state.js?v20260726';
import { initShop } from './shop.js?v20260726';
import { initAdminPanel } from './admin-panel.js?v20260726';
import * as UI from './ui.js?v20260726';
import { submitGlobalPassword } from './access.js?v20260726';

// Bouton de fermeture générique, commun à tous les panneaux
// (boutique et admin).
document.querySelectorAll('.sheet-close').forEach(btn => {
  btn.addEventListener('click', () => { close(btn.dataset.close); haptic('light'); });
});
// Clic sur l'arrière-plan sombre = fermer le panneau ouvert.
Object.entries(sheets).forEach(([key, [, backdrop]]) => backdrop.addEventListener('click', () => close(key)));

// Anime la barre de progression et le compteur de pourcentage du splash,
// de façon synchronisée (remplace l'ancienne animation CSS indépendante).
function animateSplashProgress(durationMs = 1800) {
  const fill = document.getElementById('splashBarFill');
  const percentEl = document.getElementById('splashPercent');
  if (!fill || !percentEl) return;
  const start = performance.now();
  function tick(now) {
    const elapsed = now - start;
    const pct = Math.min(100, Math.round((elapsed / durationMs) * 100));
    fill.style.width = pct + '%';
    percentEl.textContent = pct + '%';
    if (pct < 100) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

async function boot() {
  try {
    UI.spawnEmbers(document.getElementById('emberField'), 22);
    animateSplashProgress();
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
}

// ---- Verrou mot de passe global : rien ne démarre avant ----
(function wireAccessLock() {
  const lockEl = document.getElementById('accessLock');
  const input = document.getElementById('accessPasswordInput');
  const btn = document.getElementById('accessSubmitBtn');
  const errorEl = document.getElementById('accessLockError');

  function tryUnlock() {
    const password = input.value;
    if (!password) return;
    errorEl.textContent = '';
    UI.setBusy(btn, true);
    submitGlobalPassword(password)
      .then(() => {
        lockEl.classList.add('hide');
        haptic('success');
        setTimeout(() => { lockEl.remove(); boot(); }, 400);
      })
      .catch((err) => {
        UI.setBusy(btn, false);
        haptic('warning');
        errorEl.textContent = String(err.message).includes('too_many_attempts')
          ? 'Trop de tentatives — réessaie dans quelques minutes.'
          : 'Mot de passe incorrect.';
        input.value = '';
        input.focus();
      });
  }

  btn.addEventListener('click', tryUnlock);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') tryUnlock(); });
  input.focus();
})();
