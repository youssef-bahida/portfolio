import { useEffect, useRef } from "react";

/**
 * ResultsGrid
 * ===========
 * Équivalent de la commande subplot() de MATLAB.
 * Affiche les résultats du pipeline en grille avec canvas.
 */
export default function ResultsGrid({ results, activeTab }) {
  if (!results) return null;

  if (activeTab === "channels")    return <ChannelsTab    results={results} />;
  if (activeTab === "conversions") return <ConversionsTab results={results} />;
  if (activeTab === "transforms")  return <TransformsTab  results={results} />;
  return null;
}

// ─── Tab : Canaux RGB ────────────────────────────────────────────────────────

function ChannelsTab({ results }) {
  const { channels } = results;
  return (
    <div className="results-section">
      <div className="section-header">
        <span className="section-tag">Q1</span>
        <div>
          <h3>Séparation des canaux RGB</h3>
          <p className="section-desc">
            Chaque composante isole un plan de couleur — les deux autres canaux sont mis à zéro.
            Équivalent MATLAB : <code>compos_rouge(:,:,1) = image(:,:,1)</code>
          </p>
        </div>
      </div>
      <div className="grid-3">
        <CanvasCard imageData={channels.r} label="Canal Rouge" tag="R"   accent="#ff4444" code="image(:,:,1)" />
        <CanvasCard imageData={channels.g} label="Canal Vert"  tag="G"   accent="#44ff88" code="image(:,:,2)" />
        <CanvasCard imageData={channels.b} label="Canal Bleu"  tag="B"   accent="#4488ff" code="image(:,:,3)" />
      </div>
    </div>
  );
}

// ─── Tab : Conversions ───────────────────────────────────────────────────────

function ConversionsTab({ results }) {
  const { conversions } = results;
  return (
    <div className="results-section">
      <div className="section-header">
        <span className="section-tag">Q2–Q3</span>
        <div>
          <h3>Conversions de type et d'espace couleur</h3>
          <p className="section-desc">
            Niveaux de gris (Rec.601), binarisation par seuillage d'Otsu, quantification couleurs.
          </p>
        </div>
      </div>
      <div className="grid-3">
        <CanvasCard
          imageData={conversions.gray}
          label="Niveaux de gris"
          tag="Y"
          accent="#aaaaaa"
          code="im2gray(image)"
          info="Y = 0.299R + 0.587G + 0.114B"
        />
        <CanvasCard
          imageData={conversions.binary}
          label="Image binaire"
          tag="01"
          accent="#00ffcc"
          code="imbinarize(gray)"
          info={`Seuil d'Otsu : ${conversions.threshold}`}
        />
        <CanvasCard
          imageData={conversions.indexed}
          label="Indexée (16 couleurs)"
          tag="IDX"
          accent="#ffaa00"
          code="rgb2ind(image, 16)"
          info="Quantification uniforme"
        />
      </div>

      <div className="section-divider">
        <span>Normalisation double — Q2</span>
      </div>
      <div className="grid-2">
        <CanvasCard
          imageData={conversions.dbRaw}
          label="double(image)"
          tag="×1"
          accent="#ff4444"
          code="double(image)"
          info="Valeurs > 1.0 → tout blanc"
        />
        <CanvasCard
          imageData={conversions.dbNorm}
          label="double(image) / 255"
          tag="÷255"
          accent="#44ff88"
          code="double(image)/255"
          info="Valeurs dans [0.0, 1.0]"
        />
      </div>
    </div>
  );
}

// ─── Tab : Transformations ───────────────────────────────────────────────────

function TransformsTab({ results }) {
  const { transforms } = results;
  return (
    <div className="results-section">
      <div className="section-header">
        <span className="section-tag">Q4</span>
        <div>
          <h3>Transformations géométriques</h3>
          <p className="section-desc">
            Redimensionnement par interpolation bilinéaire et rotation affine.
          </p>
        </div>
      </div>
      <div className="grid-2">
        <CanvasCard
          imageData={transforms.resized50}
          label="Resize × 0.5"
          tag="↙"
          accent="#aa88ff"
          code="imresize(image, 0.5)"
          info={`${transforms.resized50.width} × ${transforms.resized50.height} px`}
        />
        <CanvasCard
          imageData={transforms.resized200}
          label="Resize × 2"
          tag="↗"
          accent="#ffaa00"
          code="imresize(image, 2.0)"
          info={`${transforms.resized200.width} × ${transforms.resized200.height} px`}
        />
        <CanvasCard
          imageData={transforms.rotated45}
          label="Rotation 45°"
          tag="↻"
          accent="#00ffcc"
          code="imrotate(image, 45)"
          info="Fond noir (hors-cadre)"
        />
        <CanvasCard
          imageData={transforms.rotated90}
          label="Rotation 90°"
          tag="⟳"
          accent="#ff4488"
          code="imrotate(image, 90)"
          info="Transposition H/V"
        />
      </div>
    </div>
  );
}

// ─── Composant Canvas Card ───────────────────────────────────────────────────

/**
 * Rend un ImageData dans un <canvas> avec métadonnées.
 * Optimisé : n'écrit dans le canvas que quand imageData change.
 */
function CanvasCard({ imageData, label, tag, accent = "#00ffcc", code, info }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !imageData) return;
    const canvas  = canvasRef.current;
    canvas.width  = imageData.width;
    canvas.height = imageData.height;
    const ctx     = canvas.getContext("2d");
    ctx.putImageData(imageData, 0, 0);
  }, [imageData]);

  return (
    <div className="canvas-card" style={{ "--accent": accent }}>
      <div className="card-tag" style={{ color: accent }}>{tag}</div>
      <div className="canvas-wrapper">
        <canvas ref={canvasRef} className="result-canvas" />
      </div>
      <div className="card-footer">
        <span className="card-label">{label}</span>
        {code && <code className="card-code">{code}</code>}
        {info && <span className="card-info">{info}</span>}
      </div>
    </div>
  );
}
