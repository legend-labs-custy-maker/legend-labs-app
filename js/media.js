// ============================================================
// Compression d'image côté navigateur avant upload.
// Réduit le poids des photos envoyées depuis un téléphone (souvent
// 5-20 Mo) pour que la boutique reste rapide pour tous les visiteurs.
// Les vidéos et GIF ne sont pas touchés (pas de compression fiable
// possible côté navigateur sans librairie lourde).
// ============================================================

const MAX_DIMENSION = 1600;   // largeur/hauteur max en pixels
const JPEG_QUALITY = 0.82;    // qualité de compression (0-1)
const SKIP_IF_UNDER_BYTES = 1.5 * 1024 * 1024; // ne recompresse pas si déjà petit

export async function compressImage(file) {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;

  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;

    if (width <= MAX_DIMENSION && height <= MAX_DIMENSION && file.size < SKIP_IF_UNDER_BYTES) {
      bitmap.close?.();
      return file; // déjà raisonnable, inutile de retoucher
    }

    const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    bitmap.close?.();

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
    if (!blob) return file;

    const newName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], newName, { type: 'image/jpeg' });
  } catch (err) {
    console.error('Compression impossible, envoi du fichier original :', err);
    return file; // en cas d'échec, on envoie l'original plutôt que de bloquer l'utilisateur
  }
}
