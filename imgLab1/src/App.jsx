import { useState, useCallback } from "react";
import ImageUploader from "./components/ImageUploader";
import ResultsGrid from "./components/ResultsGrid";
import Header from "./components/Header";
import { processImage } from "./utils/imageProcessing";
import "./styles/global.css";

/**
 * Image Processing Laboratory
 * Converts MATLAB TP1 operations to browser-native Canvas API
 * Author: Youssef Bahida — MST SIDI 2026
 */
export default function App() {
  const [originalImage, setOriginalImage] = useState(null);
  const [results, setResults]             = useState(null);
  const [isProcessing, setIsProcessing]   = useState(false);
  const [activeTab, setActiveTab]         = useState("channels");

  const handleImageLoad = useCallback(async (imageData) => {
    setOriginalImage(imageData);
    setIsProcessing(true);
    setResults(null);

    // Simulate async pipeline (keeps UI responsive)
    await new Promise(r => setTimeout(r, 60));
    const processed = processImage(imageData);
    setResults(processed);
    setIsProcessing(false);
  }, []);

  return (
    <div className="app">
      <div className="bg-grid" aria-hidden="true" />
      <div className="bg-glow" aria-hidden="true" />

      <Header />

      <main className="main-layout">
        <aside className="sidebar">
          <ImageUploader onImageLoad={handleImageLoad} />

          {originalImage && (
            <div className="original-preview">
              <span className="label">SOURCE</span>
              <canvas
                ref={el => {
                  if (!el || !originalImage) return;
                  el.width  = originalImage.width;
                  el.height = originalImage.height;
                  const ctx = el.getContext("2d");
                  ctx.putImageData(originalImage.imageData, 0, 0);
                }}
                className="preview-canvas"
              />
              <div className="image-meta">
                <span>{originalImage.width} × {originalImage.height} px</span>
                <span>{originalImage.fileSize}</span>
              </div>
            </div>
          )}
        </aside>

        <section className="content">
          {!originalImage && !isProcessing && <EmptyState />}

          {isProcessing && <LoadingState />}

          {results && !isProcessing && (
            <>
              <TabBar activeTab={activeTab} setActiveTab={setActiveTab} />
              <ResultsGrid results={results} activeTab={activeTab} />
            </>
          )}
        </section>
      </main>

      <footer className="footer">
        <span>TP1 · MST SIDI · 2026 · Youssef Bahida</span>
        <span className="footer-tech">Canvas API · React · JavaScript</span>
      </footer>
    </div>
  );
}

function TabBar({ activeTab, setActiveTab }) {
  const tabs = [
    { id: "channels",    label: "Canaux RGB",      icon: "⬡" },
    { id: "conversions", label: "Conversions",     icon: "◈" },
    { id: "transforms",  label: "Transformations", icon: "⟳" },
  ];

  return (
    <div className="tab-bar">
      {tabs.map(t => (
        <button
          key={t.id}
          className={`tab-btn ${activeTab === t.id ? "active" : ""}`}
          onClick={() => setActiveTab(t.id)}
        >
          <span className="tab-icon">{t.icon}</span>
          {t.label}
        </button>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="empty-state">
      <div className="empty-icon">⬡</div>
      <h2>Aucune image chargée</h2>
      <p>Uploadez une image pour lancer le pipeline de traitement</p>
      <div className="pipeline-steps">
        {["Lecture", "Séparation RGB", "Conversion", "Analyse"].map((s, i) => (
          <div key={s} className="pipeline-step">
            <span className="step-num">0{i + 1}</span>
            <span>{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="loading-state">
      <div className="loader-ring" />
      <span>Traitement en cours...</span>
    </div>
  );
}
