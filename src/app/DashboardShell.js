"use client";

// DashboardShell.js — the new left-rail app chrome (the "Dashboard").
//
// A layout wrapper, NOT a screen: it draws the persistent left rail (brand,
// primary nav, an EVALUATE group for the two entry modes, and a footer group)
// plus a thin top bar carrying the account email + Log out, then renders the
// active screen as {children}. Today it hosts the Overview; it is built to host
// the Hub and other screens next without change.
//
// This is additive chrome — it does not replace or touch the existing top-header
// step-flow app. Wire it in page.js behind a new screen state, e.g.
//   <DashboardShell t={t} active="overview" onNavigate={handleNav}
//                   userEmail={user?.email} onLogout={handleLogout}>
//     <OverviewView t={t} onStartExplore={...} onStartDeep={...} />
//   </DashboardShell>
// and map the nav keys (overview / hub / explore / deep / settings / plan / help)
// to your routing in handleNav.
//
// Props:
//   t          — theme token bag
//   active     — key of the active nav item (highlighted)
//   onNavigate — fn(key): a rail item was clicked
//   userEmail  — string shown top-right
//   onLogout   — fn(): log out clicked
//   children   — the active screen

import { useState, useEffect } from "react";

const RAIL_W = 232;

// The brand wordmark "oo" — the gradient infinity that sits inside "IdeaL[oo]p".
// Same lemniscate geometry as the favicon / Google tile, so the rail logo, the
// browser tab, and the consent screen are all the one mark.
const LOOP_PATH =
  "M20.2,4.5 20.1,5.1 19.9,5.7 19.6,6.3 19.1,6.7 18.6,7.0 18.1,7.3 17.5,7.4 16.9,7.4 16.4,7.4 15.9,7.2 15.4,7.1 14.9,6.9 14.5,6.6 14.1,6.4 13.7,6.1 13.3,5.8 13.0,5.5 12.6,5.1 12.3,4.8 12.0,4.5 11.7,4.2 11.4,3.9 11.0,3.5 10.7,3.2 10.3,2.9 9.9,2.6 9.5,2.4 9.1,2.1 8.6,1.9 8.1,1.8 7.6,1.6 7.1,1.6 6.5,1.6 5.9,1.7 5.4,2.0 4.9,2.3 4.4,2.7 4.1,3.3 3.9,3.9 3.8,4.5 3.9,5.1 4.1,5.7 4.4,6.3 4.9,6.7 5.4,7.0 5.9,7.3 6.5,7.4 7.1,7.4 7.6,7.4 8.1,7.2 8.6,7.1 9.1,6.9 9.5,6.6 9.9,6.4 10.3,6.1 10.7,5.8 11.0,5.5 11.4,5.1 11.7,4.8 12.0,4.5 12.3,4.2 12.6,3.9 13.0,3.5 13.3,3.2 13.7,2.9 14.1,2.6 14.5,2.4 14.9,2.1 15.4,1.9 15.9,1.8 16.4,1.6 16.9,1.6 17.5,1.6 18.1,1.7 18.6,2.0 19.1,2.3 19.6,2.7 19.9,3.3 20.1,3.9 20.2,4.5Z";

const LoopMark = ({ h = 12 }) => {
  const w = (h * 24) / 9;
  return (
    <svg
      width={w} height={h} viewBox="0 0 24 9" fill="none"
      style={{ display: "block", overflow: "visible", margin: "0 1px", transform: "translateY(1.5px)" }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="ilcLoopGrad" x1="4" y1="2" x2="20" y2="7" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#7af0cf" />
          <stop offset="1" stopColor="#23c4a0" />
        </linearGradient>
      </defs>
      <path d={LOOP_PATH} stroke="url(#ilcLoopGrad)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

// The full brand lockup: serif "IdeaL" + the gradient ∞ as "oo" + "p", with the
// mono "CORE" caption beneath — the locked wordmark.
function BrandLockup({ t }) {
  return (
    <div style={{ padding: "0 8px", marginBottom: 26 }}>
      <div style={{
        display: "flex", alignItems: "baseline",
        fontFamily: "'Spectral', Georgia, serif", fontWeight: 600, fontSize: 24,
        lineHeight: 1, color: t.text, letterSpacing: "-0.01em",
      }}>
        <span>IdeaL</span>
        <LoopMark h={12} />
        <span>p</span>
      </div>
      <div style={{
        fontFamily: "'JetBrains Mono', monospace", fontSize: 8.5, fontWeight: 500,
        letterSpacing: "0.34em", color: "#34d8a8", marginTop: 4, paddingLeft: 1,
      }}>CORE</div>
    </div>
  );
}

// ── inline icons (stroke style, matches the rest of ILC) ─────────────────────
const ip = (color, size = 18) => ({
  width: size, height: size, viewBox: "0 0 24 24", fill: "none",
  stroke: color, strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round",
  "aria-hidden": true,
});
const Grid = ({ color, size = 18 }) => (
  <svg {...ip(color, size)}>
    <rect x="4" y="4" width="6.5" height="6.5" rx="1.4" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.4" />
    <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.4" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.4" />
  </svg>
);
const Stack = ({ color, size = 18 }) => (
  <svg {...ip(color, size)}>
    <path d="M12 3.5l8.5 4.2-8.5 4.2-8.5-4.2 8.5-4.2z" /><path d="M3.5 12l8.5 4.2 8.5-4.2" /><path d="M3.5 16l8.5 4.2 8.5-4.2" />
  </svg>
);
const Compass = ({ color, size = 18 }) => (
  <svg {...ip(color, size)}>
    <circle cx="12" cy="12" r="9" />
    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88" fill={color} stroke="none" />
  </svg>
);
const Target = ({ color, size = 18 }) => (
  <svg {...ip(color, size)}>
    <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.6" fill={color} stroke="none" />
  </svg>
);
const Settings = ({ color, size = 18 }) => (
  <svg {...ip(color, size)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9l-2.1 2.1M7 17l-2.1 2.1" />
  </svg>
);
const Diamond = ({ color, size = 18 }) => (
  <svg {...ip(color, size)}>
    <path d="M12 3l8 8.4-8 9.2-8-9.2L12 3z" /><path d="M4.4 11.4h15.2" />
  </svg>
);
const Help = ({ color, size = 18 }) => (
  <svg {...ip(color, size)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.6 9.2a2.5 2.5 0 0 1 4.2 1.3c0 1.6-2 2-2 3.4" /><path d="M12 17.2v.2" />
  </svg>
);

const NAV_MAIN = [
  { key: "overview", label: "Overview", Icon: Grid },
  { key: "hub", label: "My ideas hub", Icon: Stack },
];
const NAV_EVAL = [
  { key: "explore", label: "Explore mode", Icon: Compass, color: "#7aa2ff" },
  { key: "deep", label: "Deep analysis", Icon: Target, color: "#8a82c2" },
];
const NAV_FOOT = [
  { key: "settings", label: "Settings", Icon: Settings },
  { key: "plan", label: "My plan", Icon: Diamond },
  { key: "help", label: "Get help", Icon: Help },
];

function RailItem({ t, item, active, onNavigate }) {
  const [hover, setHover] = useState(false);
  const on = active === item.key;
  const fg = on ? t.text : (hover ? t.text : t.sec);
  const iconColor = on && item.color ? item.color : fg;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onNavigate && onNavigate(item.key)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onNavigate && onNavigate(item.key); } }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "9px 12px", borderRadius: 9, cursor: "pointer",
        fontSize: 14, fontWeight: on ? 600 : 450, color: fg,
        background: on ? "rgba(255,255,255,0.07)" : hover ? "rgba(255,255,255,0.035)" : "transparent",
        transition: "background 0.12s, color 0.12s",
      }}
    >
      <item.Icon color={iconColor} />
      <span>{item.label}</span>
    </div>
  );
}

export default function DashboardShell({ t, active = "overview", onNavigate, userEmail, authLoading = false, onLogin, onLogout, children }) {
  // Ensure the wordmark fonts (Spectral serif + JetBrains Mono) are present, so
  // the brand lockup renders correctly on any screen the shell hosts.
  useEffect(() => {
    const id = "ilc-brand-fonts";
    if (typeof document !== "undefined" && !document.getElementById(id)) {
      const l = document.createElement("link");
      l.id = id; l.rel = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?family=Spectral:wght@500;600&family=JetBrains+Mono:wght@500&display=swap";
      document.head.appendChild(l);
    }
  }, []);
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: t.bg, color: t.text }}>
      {/* ── left rail ── */}
      <aside
        style={{
          width: RAIL_W, flexShrink: 0, boxSizing: "border-box",
          borderRight: `1px solid ${t.border}`, background: t.bg,
          display: "flex", flexDirection: "column", padding: "22px 16px",
          position: "sticky", top: 0, height: "100vh",
        }}
      >
        <BrandLockup t={t} />

        <nav style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {NAV_MAIN.map((item) => (
            <RailItem key={item.key} t={t} item={item} active={active} onNavigate={onNavigate} />
          ))}
        </nav>

        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: t.mut, margin: "22px 0 8px", padding: "0 12px" }}>
          Evaluate
        </div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {NAV_EVAL.map((item) => (
            <RailItem key={item.key} t={t} item={item} active={active} onNavigate={onNavigate} />
          ))}
        </nav>

        <div style={{ flex: 1 }} />

        <div style={{ height: 1, background: t.divider, margin: "0 8px 10px" }} />
        <nav style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {NAV_FOOT.map((item) => (
            <RailItem key={item.key} t={t} item={item} active={active} onNavigate={onNavigate} />
          ))}
        </nav>
      </aside>

      {/* ── main column ── */}
      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <header
          style={{
            display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 18,
            height: 60, flexShrink: 0, padding: "0 32px",
            borderBottom: `1px solid ${t.border}`,
          }}
        >
          {!authLoading && (userEmail ? (
            <>
              <span style={{ fontSize: 13, color: t.sec }}>{userEmail}</span>
              <button
                onClick={onLogout}
                style={{ fontSize: 13, color: t.mut, background: "none", border: "none", cursor: "pointer", padding: "6px 4px" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = t.sec)}
                onMouseLeave={(e) => (e.currentTarget.style.color = t.mut)}
              >
                Log out
              </button>
            </>
          ) : (
            <button
              onClick={onLogin}
              style={{ fontSize: 13, color: t.link, background: "none", border: "none", cursor: "pointer", padding: "6px 4px", fontWeight: 500 }}
            >
              Log in
            </button>
          ))}
        </header>

        <div style={{ flex: 1, padding: "40px 32px 64px" }}>
          {children}
        </div>

        <footer style={{ flexShrink: 0, padding: "16px 32px", borderTop: `1px solid ${t.border}` }}>
          <p style={{ fontSize: 12, color: t.mut, margin: 0 }}>
            IdeaLoop Core — All analysis is AI-generated. Use as a guide, not a definitive assessment.
          </p>
        </footer>
      </main>
    </div>
  );
}