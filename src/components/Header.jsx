export default function Header() {
  return (
    <header className="header">
      <div className="header-left">
        <div className="logo">
          <span className="logo-hex">⬡</span>
          <div>
            <span className="logo-title">IMAGE LAB</span>
            <span className="logo-sub">Vision par Ordinateur · TP1</span>
          </div>
        </div>
      </div>
      <div className="header-right">
        <div className="badge">MATLAB → JS</div>
        <div className="header-meta">
          <span>Youssef Bahida</span>
          <span className="dot">·</span>
          <span>MST SIDI 2026</span>
        </div>
      </div>
    </header>
  );
}
