# ⬡ Image Processing Laboratory

> Conversion complète du TP1 de traitement d'image (MATLAB) en application web React native — sans backend, sans dépendances de traitement d'image, 100% Canvas API.

**Auteur :** Youssef Bahida · MST SIDI · 2026  
**Stack :** React 18 · Vite · Canvas API · JavaScript ES2023

---

## 🎯 Objectif

Ce projet traduit les algorithmes MATLAB du TP1 en JavaScript natif via l'API Canvas du navigateur. Chaque opération MATLAB a son équivalent direct documenté dans le code.

| MATLAB | JavaScript (Canvas API) |
|--------|------------------------|
| `imread()` | `FileReader` + `HTMLImageElement` |
| `image(:,:,1)` | Accès direct aux bytes RGBA (stride 4) |
| `im2gray()` | Luminance Rec.601 : `Y = 0.299R + 0.587G + 0.114B` |
| `imbinarize()` | Algorithme d'Otsu (variance inter-classe maximale) |
| `rgb2ind(img, 16)` | Quantification uniforme par canal |
| `imresize()` | Interpolation bilinéaire (`imageSmoothingQuality`) |
| `imrotate()` | Transformation affine canvas (`rotate()`) |
| `subplot()` | Grille CSS Grid avec canvas par cellule |

---

## ✨ Fonctionnalités

### Question 1 — Séparation des canaux RGB
- Isolation du canal Rouge `(R, 0, 0)`
- Isolation du canal Vert  `(0, G, 0)`
- Isolation du canal Bleu  `(0, 0, B)`

### Question 2 — Normalisation double
- `double(image)` — valeurs > 1 → tout blanc
- `double(image)/255` — normalisation `[0.0, 1.0]`

### Question 3 — Conversions
- **Niveaux de gris** : formule luminance perceptuelle Rec.601
- **Image binaire** : seuillage automatique par méthode d'Otsu
- **Image indexée** : quantification à 16 couleurs

### Question 4 — Transformations géométriques
- Resize ×0.5 et ×2.0 (interpolation bilinéaire)
- Rotation 45° et 90° (transformation affine)

---

## 🔐 Sécurité

L'upload de fichiers intègre plusieurs couches de validation :

1. **Validation MIME type** — vérification du type déclaré
2. **Magic bytes** — vérification des octets de signature du fichier (JPEG: `FFD8FF`, PNG: `89504E47`, etc.) — résistant au renommage d'extension
3. **Limite de taille** — max 10 MB pour prévenir les attaques DoS
4. **Pas de serveur** — aucune donnée ne quitte le navigateur

---

## 🏗️ Architecture

```
src/
├── App.jsx                    # Composant racine, gestion d'état global
├── main.jsx                   # Point d'entrée React
├── components/
│   ├── Header.jsx             # En-tête de l'application
│   ├── ImageUploader.jsx      # Upload sécurisé avec drag & drop
│   └── ResultsGrid.jsx        # Grille de résultats (équivalent subplot)
├── utils/
│   └── imageProcessing.js     # Tous les algorithmes de traitement
└── styles/
    └── global.css             # Design system complet
```

**Principes d'architecture :**
- **Séparation des responsabilités** : la logique de traitement est totalement isolée dans `utils/`
- **Composants purs** : les composants React ne font que du rendu
- **Pas d'effets de bord** : toutes les transformations retournent un nouvel `ImageData`
- **Accessibilité** : `role`, `aria-label`, navigation clavier

---

## 🚀 Installation et lancement

```bash
# Cloner le repo
git clone https://github.com/youssefbahida/image-lab.git
cd image-lab

# Installer les dépendances
npm install

# Lancer en développement
npm run dev

# Build de production
npm run build
```

Ouvre [http://localhost:5173](http://localhost:5173) dans ton navigateur.

---

## 🌐 Déploiement (Vercel)

```bash
npm install -g vercel
vercel --prod
```

Ou connecte le repo GitHub à [vercel.com](https://vercel.com) pour un déploiement automatique à chaque push.

---

## 📚 Concepts clés

### ImageData — la structure de base
```js
// Une image RGB de 100×100 = tableau plat de 100×100×4 = 40 000 octets
// Ordre : [R, G, B, A, R, G, B, A, ...]
const pixel_i_j = i * (width * 4) + j * 4;
const R = imageData.data[pixel_i_j];
const G = imageData.data[pixel_i_j + 1];
const B = imageData.data[pixel_i_j + 2];
```

### Algorithme d'Otsu
```js
// Maximise la variance inter-classe entre fond et avant-plan
// σ²B(T) = ωB(T) · ωF(T) · [μB(T) − μF(T)]²
// T* = argmax σ²B(T)
```

---

## 🛠️ Technologies

- **React 18** — UI déclarative, hooks
- **Vite 5** — bundler ultra-rapide, HMR
- **Canvas API** — traitement pixel natif sans librairie
- **CSS Custom Properties** — design system cohérent
- **Google Fonts** — Syne (display) + JetBrains Mono (code)

---

## 📄 Licence

MIT — Youssef Bahida, 2026
