import { useState, useRef, useCallback } from "react";

/**
 * ImageUploader
 * =============
 * Composant d'upload sécurisé avec :
 *  - Validation du type MIME (magic bytes, pas juste l'extension)
 *  - Limite de taille (10 MB)
 *  - Drag & drop
 *  - Feedback visuel d'état
 */

// Types MIME autorisés avec leurs magic bytes
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_SIZE_MB  = 10;

/**
 * Vérifie les magic bytes du fichier (plus fiable que l'extension).
 * Sécurité : un attaquant pourrait renommer un .exe en .jpg.
 */
async function validateMagicBytes(file) {
  const buffer = await file.slice(0, 4).arrayBuffer();
  const bytes  = new Uint8Array(buffer);

  const signatures = {
    jpeg: [0xFF, 0xD8, 0xFF],
    png:  [0x89, 0x50, 0x4E, 0x47],
    webp: [0x52, 0x49, 0x46, 0x46], // "RIFF"
    gif:  [0x47, 0x49, 0x46],       // "GIF"
  };

  return Object.values(signatures).some(sig =>
    sig.every((byte, i) => bytes[i] === byte)
  );
}

export default function ImageUploader({ onImageLoad }) {
  const [isDragging, setIsDragging]   = useState(false);
  const [error, setError]             = useState(null);
  const [isLoading, setIsLoading]     = useState(false);
  const inputRef                      = useRef(null);

  const processFile = useCallback(async (file) => {
    setError(null);

    // 1. Validation MIME type
    if (!ALLOWED_MIME.includes(file.type)) {
      setError(`Format non supporté : ${file.type || "inconnu"}. Formats acceptés : JPG, PNG, WebP, GIF`);
      return;
    }

    // 2. Validation taille
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > MAX_SIZE_MB) {
      setError(`Fichier trop lourd : ${sizeMB.toFixed(1)} MB. Maximum : ${MAX_SIZE_MB} MB`);
      return;
    }

    // 3. Validation magic bytes (sécurité supplémentaire)
    const isValid = await validateMagicBytes(file);
    if (!isValid) {
      setError("Le fichier ne semble pas être une image valide.");
      return;
    }

    setIsLoading(true);

    // 4. Lecture et décodage de l'image
    const reader  = new FileReader();
    reader.onload = (e) => {
      const img   = new Image();
      img.onload  = () => {
        // Décodage dans un canvas offscreen pour extraire ImageData
        const canvas = document.createElement("canvas");
        canvas.width  = img.width;
        canvas.height = img.height;
        const ctx     = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);

        onImageLoad({
          imageData,
          width:    img.width,
          height:   img.height,
          fileSize: `${(file.size / 1024).toFixed(1)} KB`,
          fileName: file.name,
        });
        setIsLoading(false);
      };
      img.onerror = () => {
        setError("Impossible de décoder l'image.");
        setIsLoading(false);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }, [onImageLoad]);

  // Drag & Drop handlers
  const onDragOver  = (e) => { e.preventDefault(); setIsDragging(true);  };
  const onDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const onDrop      = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };
  const onChange = (e) => {
    const file = e.target.files[0];
    if (file) processFile(file);
    e.target.value = ""; // reset pour re-upload du même fichier
  };

  return (
    <div className="uploader-wrapper">
      <div
        className={`drop-zone ${isDragging ? "dragging" : ""} ${isLoading ? "loading" : ""}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => !isLoading && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Zone d'upload d'image"
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={onChange}
          style={{ display: "none" }}
          aria-hidden="true"
        />

        {isLoading ? (
          <div className="uploader-loading">
            <div className="loader-ring small" />
            <span>Décodage...</span>
          </div>
        ) : (
          <>
            <div className="upload-icon">⬡</div>
            <span className="upload-label">
              {isDragging ? "Déposer l'image" : "Cliquer ou glisser une image"}
            </span>
            <span className="upload-hint">JPG · PNG · WebP · GIF — max {MAX_SIZE_MB} MB</span>
          </>
        )}
      </div>

      {error && (
        <div className="upload-error" role="alert">
          <span>⚠</span> {error}
        </div>
      )}
    </div>
  );
}
