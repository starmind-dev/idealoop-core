"use client";

// ============================================================================
// ModeTitle — the one serious title lockup for the two evaluation modes.
//
// glyph chip (compass = Explore, target = Deep — the app's canonical marks)
// + a tracked uppercase label. Identical on input and result for each mode,
// so the screen you launch from and the screen you land on name themselves
// the same way. Explore wears Dawn blue; Deep wears violet.
//
//   <ModeTitle mode="explore" />   ->  ◎ EXPLORE MODE
//   <ModeTitle mode="deep" />      ->  ◉ DEEP ANALYSIS
// ============================================================================

const MODES = {
  explore: { ac: "#7aa2ff", on: "#d2e0ff", line: "rgba(122,162,255,0.5)",  bg: "rgba(122,162,255,0.12)", label: "Explore Mode" },
  deep:    { ac: "#9a8fd8", on: "#cbc3ee", line: "rgba(138,130,194,0.55)", bg: "rgba(138,130,194,0.14)", label: "Deep Analysis" },
};

function ModeGlyph({ mode, size = 17 }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", style: { display: "block" } };
  if (mode === "deep")
    return (<svg {...p} strokeWidth="2"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.6" fill="currentColor" /></svg>);
  return (<svg {...p} strokeWidth="2" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88" fill="currentColor" stroke="none" /></svg>);
}

export function ModeTitle({ mode = "deep", style }) {
  const m = MODES[mode] || MODES.deep;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 11, ...style }}>
      <span style={{ width: 30, height: 30, flex: "0 0 30px", borderRadius: 9, display: "grid", placeItems: "center", color: m.ac, background: m.bg, border: `1px solid ${m.line}` }}>
        <ModeGlyph mode={mode} />
      </span>
      <span style={{ fontSize: 13.5, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: m.on }}>{m.label}</span>
    </span>
  );
}