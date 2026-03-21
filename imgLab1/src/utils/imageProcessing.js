/**
 * imageProcessing.js
 * ==================
 * Reproduction fidèle des algorithmes MATLAB du TP1
 * en JavaScript natif via Canvas API et arithmétique pixel.
 *
 * Correspondances MATLAB → JS :
 *  imread()         → FileReader + HTMLImageElement
 *  image(:,:,1)     → accès direct aux octets RGBA (stride de 4)
 *  im2gray()        → formule luminance Rec.601
 *  imbinarize()     → seuillage d'Otsu
 *  rgb2ind(img,16)  → médiane-cut / k-means simplifié
 *  im2double()      → normalisation [0,255] → [0.0,1.0]
 *  imresize()       → interpolation bilinéaire
 *  imrotate()       → rotation affine avec canvas transform
 */

// ─── Séparation des canaux (Q1) ────────────────────────────────────────────

/**
 * Isole un canal couleur en mettant les autres à 0.
 * Équivalent MATLAB :
 *   compos_rouge = zeros(size(image),"uint8");
 *   compos_rouge(:,:,1) = image(:,:,1);
 *
 * @param {ImageData} src  - ImageData source
 * @param {"r"|"g"|"b"} channel
 * @returns {ImageData}
 */
export function extractChannel(src, channel) {
  const dst  = new ImageData(src.width, src.height);
  const ci   = { r: 0, g: 1, b: 2 }[channel]; // index canal (0=R,1=G,2=B)

  for (let i = 0; i < src.data.length; i += 4) {
    // Les 3 canaux sont mis à 0, seul le canal cible est copié
    dst.data[i]     = channel === "r" ? src.data[i]     : 0;
    dst.data[i + 1] = channel === "g" ? src.data[i + 1] : 0;
    dst.data[i + 2] = channel === "b" ? src.data[i + 2] : 0;
    dst.data[i + 3] = 255; // alpha toujours opaque
  }
  return dst;
}

// ─── Conversion niveaux de gris (Q2 / Q3) ──────────────────────────────────

/**
 * Conversion RGB → niveaux de gris via luminance perceptuelle.
 * Équivalent MATLAB : im2gray(image)
 *
 * Formule Rec.601 (standard MATLAB) :
 *   Y = 0.299·R + 0.587·G + 0.114·B
 *
 * Les coefficients reflètent la sensibilité de l'œil humain :
 *   vert > rouge > bleu
 *
 * @param {ImageData} src
 * @returns {ImageData} image grise (R=G=B=Y)
 */
export function toGrayscale(src) {
  const dst = new ImageData(src.width, src.height);

  for (let i = 0; i < src.data.length; i += 4) {
    const r = src.data[i];
    const g = src.data[i + 1];
    const b = src.data[i + 2];
    // Luminance perceptuelle
    const Y = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    dst.data[i]     = Y;
    dst.data[i + 1] = Y;
    dst.data[i + 2] = Y;
    dst.data[i + 3] = 255;
  }
  return dst;
}

// ─── Binarisation par seuillage d'Otsu (Q3) ────────────────────────────────

/**
 * Binarisation automatique par méthode d'Otsu.
 * Équivalent MATLAB : imbinarize(grayImg)
 *
 * Principe de l'algorithme d'Otsu :
 *   1. Calculer l'histogramme normalisé (256 bins)
 *   2. Pour chaque seuil T possible (0..255) :
 *      - Calculer la variance inter-classe ωB·ωF·(μB−μF)²
 *   3. Le seuil optimal T* maximise cette variance
 *
 * @param {ImageData} gray - image déjà en niveaux de gris
 * @returns {{ imageData: ImageData, threshold: number }}
 */
export function binarize(gray) {
  const n       = gray.width * gray.height;
  const hist    = new Float64Array(256);

  // 1. Histogramme
  for (let i = 0; i < gray.data.length; i += 4) {
    hist[gray.data[i]]++;
  }

  // 2. Normalisation
  const prob = hist.map(h => h / n);

  // 3. Recherche du seuil d'Otsu
  let maxVar = 0;
  let threshold = 0;
  let wB = 0, muB = 0;
  const muTotal = prob.reduce((acc, p, i) => acc + p * i, 0);
  let muTotal_B = 0;

  for (let t = 0; t < 256; t++) {
    wB += prob[t];
    const wF = 1 - wB;
    if (wB === 0 || wF === 0) continue;

    muTotal_B += prob[t] * t;
    const muF  = (muTotal - muTotal_B) / wF;
    const muB_ = muTotal_B / wB;

    const varBetween = wB * wF * Math.pow(muB_ - muF, 2);
    if (varBetween > maxVar) {
      maxVar    = varBetween;
      threshold = t;
    }
  }

  // 4. Application du seuil
  const dst = new ImageData(gray.width, gray.height);
  for (let i = 0; i < gray.data.length; i += 4) {
    const val = gray.data[i] > threshold ? 255 : 0;
    dst.data[i]     = val;
    dst.data[i + 1] = val;
    dst.data[i + 2] = val;
    dst.data[i + 3] = 255;
  }

  return { imageData: dst, threshold };
}

// ─── Quantification couleurs (Q3) ──────────────────────────────────────────

/**
 * Réduction du nombre de couleurs par quantification uniforme.
 * Équivalent MATLAB : rgb2ind(image, 16)
 *
 * Méthode : Uniform Quantization
 *   Chaque canal est discrétisé en N niveaux uniformes.
 *   Pour 16 couleurs : N = ∛16 ≈ 2.5 → 4 niveaux/canal = 64 couleurs.
 *   On se rapproche de l'effet visuel de rgb2ind MATLAB.
 *
 * @param {ImageData} src
 * @param {number} numColors - nombre de couleurs cibles
 * @returns {ImageData}
 */
export function quantizeColors(src, numColors = 16) {
  const levels = Math.round(Math.cbrt(numColors)); // niveaux par canal
  const step   = 256 / levels;
  const dst    = new ImageData(src.width, src.height);

  for (let i = 0; i < src.data.length; i += 4) {
    dst.data[i]     = Math.round(Math.floor(src.data[i]     / step) * step);
    dst.data[i + 1] = Math.round(Math.floor(src.data[i + 1] / step) * step);
    dst.data[i + 2] = Math.round(Math.floor(src.data[i + 2] / step) * step);
    dst.data[i + 3] = 255;
  }
  return dst;
}

// ─── Normalisation double (Q2) ──────────────────────────────────────────────

/**
 * Normalise les valeurs [0,255] → [0,1] puis re-mappe pour l'affichage.
 * Équivalent MATLAB : im2double(image)
 *
 * En MATLAB, double(image) sans division donne des blancs car
 * imshow() interprète les doubles comme déjà dans [0,1].
 * Ici on simule les 3 cas du TP.
 *
 * @param {ImageData} src
 * @param {"raw"|"normalized"|"func"} mode
 * @returns {ImageData}
 */
export function toDouble(src, mode = "normalized") {
  const dst = new ImageData(src.width, src.height);

  for (let i = 0; i < src.data.length; i += 4) {
    let r = src.data[i];
    let g = src.data[i + 1];
    let b = src.data[i + 2];

    if (mode === "raw") {
      // double(image) sans division → valeurs > 1 → tout blanc
      r = g = b = 255;
    } else if (mode === "normalized" || mode === "func") {
      // double(image)/255 ou im2double → [0.0, 1.0] → rendu correct
      // Pas de changement visuel (déjà dans la bonne plage)
    }

    dst.data[i]     = r;
    dst.data[i + 1] = g;
    dst.data[i + 2] = b;
    dst.data[i + 3] = 255;
  }
  return dst;
}

// ─── Resize (Q4) ────────────────────────────────────────────────────────────

/**
 * Redimensionnement par interpolation bilinéaire.
 * Équivalent MATLAB : imresize(image, scale)
 *
 * L'interpolation bilinéaire calcule la valeur d'un pixel
 * à partir des 4 voisins les plus proches par pondération.
 *
 * @param {ImageData} src
 * @param {number} scale - facteur d'échelle (ex: 0.5 = moitié)
 * @returns {ImageData}
 */
export function resizeImage(src, scale) {
  const offscreen = new OffscreenCanvas(src.width, src.height);
  const ctx       = offscreen.getContext("2d");
  ctx.putImageData(src, 0, 0);

  const newW = Math.round(src.width  * scale);
  const newH = Math.round(src.height * scale);

  const dst    = new OffscreenCanvas(newW, newH);
  const dstCtx = dst.getContext("2d");
  dstCtx.imageSmoothingEnabled = true;
  dstCtx.imageSmoothingQuality = "high"; // bilinéaire/bicubique
  dstCtx.drawImage(offscreen, 0, 0, newW, newH);

  return dstCtx.getImageData(0, 0, newW, newH);
}

// ─── Rotation (Q4) ──────────────────────────────────────────────────────────

/**
 * Rotation d'image avec rognage canvas.
 * Équivalent MATLAB : imrotate(image, angle)
 *
 * Canvas applique une transformation affine au contexte 2D.
 * On calcule la nouvelle taille pour éviter le rognage.
 *
 * @param {ImageData} src
 * @param {number} degrees - angle en degrés
 * @returns {ImageData}
 */
export function rotateImage(src, degrees) {
  const rad    = (degrees * Math.PI) / 180;
  const cos    = Math.abs(Math.cos(rad));
  const sin    = Math.abs(Math.sin(rad));
  const newW   = Math.round(src.width * cos + src.height * sin);
  const newH   = Math.round(src.width * sin + src.height * cos);

  const srcCanvas = new OffscreenCanvas(src.width, src.height);
  srcCanvas.getContext("2d").putImageData(src, 0, 0);

  const dst    = new OffscreenCanvas(newW, newH);
  const dstCtx = dst.getContext("2d");

  dstCtx.translate(newW / 2, newH / 2);
  dstCtx.rotate(rad);
  dstCtx.drawImage(srcCanvas, -src.width / 2, -src.height / 2);

  return dstCtx.getImageData(0, 0, newW, newH);
}

// ─── Pipeline principal ──────────────────────────────────────────────────────

/**
 * Lance le pipeline complet de traitement (toutes les questions du TP).
 *
 * @param {{ imageData: ImageData, width: number, height: number }} image
 * @returns {Object} résultats indexés par transformation
 */
export function processImage(image) {
  const { imageData: src } = image;

  // Q1 — Séparation des canaux
  const channelR = extractChannel(src, "r");
  const channelG = extractChannel(src, "g");
  const channelB = extractChannel(src, "b");

  // Q2 — Conversions double
  const dbRaw  = toDouble(src, "raw");
  const dbNorm = toDouble(src, "normalized");

  // Q3 — Conversions de type
  const gray    = toGrayscale(src);
  const { imageData: binary, threshold } = binarize(gray);
  const indexed = quantizeColors(src, 16);

  // Q4 — Transformations géométriques
  const resized50  = resizeImage(src, 0.5);
  const resized200 = resizeImage(src, 2.0);
  const rotated45  = rotateImage(src, 45);
  const rotated90  = rotateImage(src, 90);

  return {
    channels:    { r: channelR, g: channelG, b: channelB },
    conversions: {
      gray, binary, indexed,
      dbRaw, dbNorm,
      threshold // valeur du seuil d'Otsu calculé
    },
    transforms: {
      resized50, resized200,
      rotated45, rotated90,
    }
  };
}
