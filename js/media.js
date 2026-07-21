// ============================================================
// Compression d'image côté navigateur avant upload.
// Réduit le poids des photos envoyées depuis un téléphone (souvent
// 5-20 Mo) pour que la boutique reste rapide pour tous les visiteurs.
//
// Effet de bord volontaire et important pour la vie privée : redessiner
// l'image sur un <canvas> puis la ré-exporter supprime systématiquement
// toutes les métadonnées EXIF d'origine (position GPS exacte, modèle
// d'appareil, date/heure précise...) qui peuvent être présentes dans une
// photo prise au téléphone. Comme les médias sont publics une fois en
// ligne, cette suppression s'applique à TOUTE image, y compris les
// petites déjà légères — jamais d'envoi du fichier original tel quel.
//
// Les vidéos et GIF ne sont pas touchés (pas de méthode fiable côté
// navigateur sans librairie lourde) — voir la remarque plus bas.
// ============================================================

const MAX_DIMENSION = 1600;   // largeur/hauteur max en pixels
const JPEG_QUALITY = 0.82;    // qualité de compression (0-1)

export async function compressImage(file) {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;

  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;

    const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, targetW, targetH); // redessiner = repartir de pixels purs, sans métadonnées
    bitmap.close?.();

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
    if (!blob) return file;

    const newName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], newName, { type: 'image/jpeg' });
  } catch (err) {
    console.error('Compression impossible, envoi du fichier original :', err);
    return file; // en cas d'échec technique, on envoie l'original plutôt que de bloquer l'utilisateur
  }
}
