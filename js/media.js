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

// options :
//  - maxDimension : taille max en pixels (défaut 1600)
//  - square       : true = recadre automatiquement au centre en carré parfait (icônes catégories)
//  - aspectRatio  : ex. 1.6 = recadre automatiquement au centre à ce ratio largeur/hauteur (bannières)
//  - preserveTransparency : true = ressort en PNG avec transparence conservée (badges produits)
// Appel sans options = comportement historique inchangé (photos produits, logo).
export async function compressImage(file, options = {}) {
  const { maxDimension = MAX_DIMENSION, square = false, aspectRatio = null, preserveTransparency = false } = options;
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;

  try {
    const bitmap = await createImageBitmap(file);
    let { width, height } = bitmap;
    let sx = 0, sy = 0, sw = width, sh = height;
    const targetRatio = square ? 1 : aspectRatio;

    if (targetRatio) {
      const currentRatio = width / height;
      if (currentRatio > targetRatio) {
        // image trop large pour le ratio cible -> on rogne les côtés, on garde le centre
        sw = height * targetRatio;
        sx = (width - sw) / 2;
        width = sw;
      } else if (currentRatio < targetRatio) {
        // image trop haute pour le ratio cible -> on rogne haut/bas, on garde le centre
        sh = width / targetRatio;
        sy = (height - sh) / 2;
        height = sh;
      }
    }

    const scale = Math.min(1, maxDimension / Math.max(width, height));
    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, targetW, targetH); // redessiner = repartir de pixels purs, sans métadonnées
    bitmap.close?.();

    const outType = preserveTransparency ? 'image/png' : 'image/jpeg';
    const quality = preserveTransparency ? undefined : JPEG_QUALITY;
    const blob = await new Promise(resolve => canvas.toBlob(resolve, outType, quality));
    if (!blob) return file;

    const ext = preserveTransparency ? '.png' : '.jpg';
    const newName = file.name.replace(/\.[^.]+$/, '') + ext;
    return new File([blob], newName, { type: outType });
  } catch (err) {
    console.error('Compression impossible, envoi du fichier original :', err);
    return file; // en cas d'échec technique, on envoie l'original plutôt que de bloquer l'utilisateur
  }
}
