"use client";

// ============================================================================
// ExploreView — the Explore (LL2) results screen.
//
// Sibling to EvaluationView. Renders the four locked Explore surfaces from a
// live `ll2_explore_v1` payload (see /api/analyze-explore route.js):
//
//   read       { reflection, clear[], open[], branchability{state,reason_type,reason} }
//   angles[]   { id, title, concept, branch_idea_text, basis{primary,secondary},
//                identity_guard{preserves,changes,drift_risk},
//                justification{ opening{text,evidence_refs[],trust}, bet{text,rests_on}, disconfirmer },
//                readiness, lane_ref }
//   terrain    { lanes[{id,label,status,lane_type,reference_items[{name,type}],
//                substitute_tell{exists,signal},demand_question}], firms_up_fastest{text,angle_refs[]} }
//   next_move  { dominant_uncertainty{type,text}, recommendation, primary_action,
//                targets{angle_ids,use_original_idea}, actions[{type,enabled,target_angle_ids,use_original_idea,label}] }
//
//   envelope   { mode:"explore", schema_version, idea, fan_state:"empty|thin|rich", ... }
//
// Identity = "Dawn": cornflower base, rose->blue discovery gradient on the fan
// connectors. Deliberately NOT teal/score-ramp/Deep-purple — Explore owns its
// own palette so the two modes read apart.
//
// INTEGRATION (page.js), not done here:
//   • endpoint: analyzeWithStream(idea, profile, "/api/analyze-explore")
//   • new screen: currentScreen === "explore" -> <ExploreView .../>
//   • the gate early-exit emits snake `specificity_insufficient` (Deep uses camel) —
//     handle in the shared SSE consumer's baseOf/step mapping.
// ============================================================================

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { PageContainer, AuthModal } from "./components";

// ---- Dawn identity (locked) ------------------------------------------------
const EX = {
  base: "#7aa2ff",
  bright: "#bcd2ff",
  line: "rgba(122,162,255,0.46)",
  dim: "rgba(122,162,255,0.12)",
  gradA: "#fb7185", // discovery gradient: rose, at the idea
  gradB: "#60a5fa", // sky, at each new angle
};

// ---- small SVG helpers -----------------------------------------------------
const Svg = ({ d, w = 14, sw = 1.8, fill = "none", children, style }) => (
  <svg width={w} height={w} viewBox="0 0 24 24" fill={fill} stroke={fill === "none" ? "currentColor" : "none"}
    strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={{ display: "block", flexShrink: 0, ...style }}>
    {children || (d ? <path d={d} /> : null)}
  </svg>
);

const SectionIcon = {
  read: () => <Svg><circle cx="12" cy="12" r="4.2" /><path d="M12 3v2M12 19v2M4.5 4.5 6 6M18 18l1.5 1.5M3 12h2M19 12h2M4.5 19.5 6 18M18 6l1.5-1.5" /></Svg>,
  dir: () => <Svg><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" /><path d="M12 12 5 8M12 12 6 15M12 12l4 7M12 12 20 9" /></Svg>,
  terr: () => <Svg><path d="M3 17h18" /><path d="M7 17a5 5 0 0 1 10 0" /></Svg>,
  next: () => <Svg><path d="M5 21V5l8-2v18M5 21h13M9 12h.5" /></Svg>,
  node: () => <Svg w={13}><circle cx="12" cy="12" r="3" /><path d="M12 4v2M12 18v2M4 12h2M18 12h2M6.5 6.5 8 8M16 16l1.5 1.5M6.5 17.5 8 16M16 8l1.5-1.5" /></Svg>,
};

const RoadIc = () => <Svg w={13} sw={2}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>;
const BetIc = () => <Svg w={13} sw={2}><circle cx="12" cy="12" r="8" /><path d="M12 8v4l2 2" /></Svg>;
const RockIc = () => <Svg w={13} sw={2}><path d="M4 18h16M7 18l3-9 4 5 2-3 2 7" /></Svg>;
const QIc = () => <Svg w={13} sw={2}><path d="M9 9a3 3 0 1 1 4 2.8c-.8.4-1 .8-1 1.7M12 17h.01" /></Svg>;
const ReadLinesIc = () => <Svg w={13} sw={2}><path d="M4 6h16M4 12h10M4 18h7" /></Svg>;
const BoltIc = () => <Svg w={15}><path d="M13 2 4 14h7l-1 8 9-12h-7z" /></Svg>;
const PlusIc = () => <Svg w={12} sw={2}><path d="M12 5v14M5 12h14" /></Svg>;
const CmpIc = () => <Svg w={12} sw={2}><rect x="4" y="4" width="7" height="16" rx="1" /><rect x="14" y="4" width="6" height="16" rx="1" /></Svg>;

const ReadyGlyph = {
  ready_for_deep: () => <Svg w={15}><path d="M14 4h5v16h-5" /><path d="M3 12h11M10 8l4 4-4 4" /></Svg>,
  worth_shaping: () => <Svg w={15}><path d="M5 19 16 8M14 6l4 4M12 8l-7 7v4h4" /></Svg>,
  probably_thin: () => <Svg w={15} sw={1.8}><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" opacity="0.6" /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" opacity="0.3" /></Svg>,
};

function StatusShape({ status }) {
  if (status === "crowded")
    return <Svg w={12} fill="var(--exmut)" style={{ color: "var(--exmut)" }}><g fill="currentColor" stroke="none"><circle cx="6" cy="7" r="2.4" /><circle cx="12" cy="7" r="2.4" /><circle cx="18" cy="7" r="2.4" /><circle cx="9" cy="14" r="2.4" /><circle cx="15" cy="14" r="2.4" /></g></Svg>;
  if (status === "open")
    return <Svg w={12} sw={2}><circle cx="12" cy="12" r="8" strokeDasharray="3 3.2" /></Svg>;
  return <Svg w={12}><g fill="currentColor" stroke="none"><circle cx="8" cy="12" r="2.4" /><circle cx="15" cy="9" r="2.4" opacity="0.5" /></g></Svg>;
}

// ---- label maps ------------------------------------------------------------
const READY_LABEL = { ready_for_deep: "Ready for Deep", worth_shaping: "Worth shaping", probably_thin: "Lightly grounded" };

const SHIFT_LABEL = {
  target_shift: "Target shift", buyer_shift: "Buyer shift", mechanism_shift: "Mechanism shift",
  use_case_shift: "Use-case shift", positioning_shift: "Positioning shift", distribution_shift: "Distribution shift",
};

const LANE_TYPE_PHRASE = {
  crowded_with_gap: "Crowded — but a stated gap none of them cover.",
  crowded_free_tools: "Busy, but the crowd is free tools, not paying ones.",
  open_with_substitute: "Open — people work around it by hand today.",
  open_without_substitute: "Open — and no one's even working around it.",
  niche_with_buyer_tell: "Narrow — but a specific buyer is already paying.",
  emerging_unclear: "Still forming — too fresh to read with confidence.",
};

const ZONES = [
  ["crowded", "Crowded"],
  ["lightly_served", "Lightly served"],
  ["open", "Open"],
];

const BRANCH_LABEL = (state, reasonType) => {
  if (state === "branchable") return "Branchable";
  if (state === "partially_branchable") return "Partially branchable";
  if (reasonType === "already_specific") return "Ready to judge";
  if (reasonType === "evidence_too_thin") return "Too thin to branch";
  if (reasonType === "too_vague" || reasonType === "too_broad") return "Too broad to fan yet";
  return "Not branchable";
};

const ACTION_META = {
  save_branch: { label: "Save branch", desc: "Keep this exploration to build on later.", ic: <PlusIc /> },
  compare_selected: { label: "Compare directions", desc: "Hold the clearest contrasts side by side.", ic: <CmpIc /> },
  take_to_deep: { label: "Take to Deep", desc: "Hand it to the verdict mode as it stands.", ic: "→", deep: true },
  explore_variation: { label: "Explore a variation", desc: "New angle, same problem space.", ic: "◇" },
  park: { label: "Park for later", desc: "Set it down without losing it.", ic: "◷" },
  edit_read: { label: "Edit the read", desc: "Sharpen the idea, then the fan can widen.", ic: "✎" },
};

const TRUST_OPACITY = { strong: 1, moderate: 0.55, weak: 0.28 };

// ============================================================================
// Section eyebrow
// ============================================================================
function Eyebrow({ num, icon, title, sub, t, right }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 20 }}>
      <span style={{
        width: 22, height: 22, borderRadius: "50%", border: `1px solid ${EX.line}`, color: EX.bright,
        fontSize: 11, fontFamily: "monospace", display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, boxShadow: `0 0 0 3px ${EX.dim}, 0 0 14px -2px ${EX.base}`, alignSelf: "center",
      }}>{num}</span>
      <span style={{ display: "flex", alignItems: "center", color: EX.bright, alignSelf: "center" }}>{icon}</span>
      <span style={{ fontFamily: "monospace", fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: t.sec }}>{title}</span>
      <span style={{ fontSize: 12.5, color: t.sec }}>{sub}</span>
      {right && <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 16 }}>{right}</div>}
    </div>
  );
}

// ============================================================================
// 1 · Our read
// ============================================================================
function ReadSurface({ read, t }) {
  if (!read) return null;
  const b = read.branchability || {};
  const clear = Array.isArray(read.clear) ? read.clear : [];
  const open = Array.isArray(read.open) ? read.open : [];
  return (
    <section style={{ marginTop: 48 }}>
      <Eyebrow num="1" icon={<SectionIcon.read />} title="Our read" sub="How we understood your idea" t={t} />
      <div style={{
        background: `linear-gradient(90deg, ${EX.dim}, transparent 22%), ${t.surface}`,
        border: `1px solid var(--exborder-soft)`, borderRadius: 14, padding: "26px 30px 22px",
      }}>
        <p style={{ fontSize: 15.5, fontWeight: 300, lineHeight: 1.62, color: "#e9ebef", letterSpacing: "0.1px", margin: "0 0 22px", maxWidth: 760 }}>
          {read.reflection}
        </p>
        {(clear.length > 0 || open.length > 0) && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 34, borderTop: `1px solid ${t.divider}`, paddingTop: 20 }}>
            <ReadColumn label="Clear enough to build on" icon={<RoadIc />} iconColor={EX.base} items={clear} kind="clear" t={t} />
            <ReadColumn label="Still open" icon={<QIc />} iconColor={EX.base} items={open} kind="open" t={t} />
          </div>
        )}
        {(b.state || b.reason) && (
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, borderTop: `1px solid ${t.divider}`, marginTop: 22, paddingTop: 16 }}>
            <span style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 7, fontFamily: "monospace", fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: EX.bright, border: `1px solid ${EX.line}`, borderRadius: 20, padding: "4px 11px" }}>
              <span style={{ width: 7, height: 7, border: `1.5px solid ${EX.base}`, transform: "rotate(45deg)", display: "inline-block" }} /> {BRANCH_LABEL(b.state, b.reason_type)}
            </span>
            <span style={{ fontSize: 12.5, color: t.sec, lineHeight: 1.5 }}>{b.reason}</span>
          </div>
        )}
      </div>
    </section>
  );
}

function ReadColumn({ label, icon, iconColor, items, kind, t }) {
  if (!items.length) return <div />;
  return (
    <div>
      <div style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: t.mut, marginBottom: 13, display: "flex", alignItems: "center", gap: 7 }}>
        <span style={{ color: iconColor, display: "flex" }}>{icon}</span> {label}
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 9 }}>
        {items.map((it, i) => (
          <li key={i} style={{ display: "flex", gap: 9, fontSize: 12.5, color: t.sec, lineHeight: 1.45 }}>
            {kind === "open"
              ? <span style={{ flexShrink: 0, color: EX.base, fontSize: 12.5, fontWeight: 600, lineHeight: 1.3 }}>?</span>
              : <span style={{ flexShrink: 0, marginTop: 6, width: 4, height: 4, borderRadius: "50%", background: EX.base, opacity: 0.7 }} />}
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ============================================================================
// 2 · Where it could go — the fan
// ============================================================================
function EssenceCard({ angle, active, dimmed, onEnter, onLeave, onClick }) {
  const opening = angle.justification?.opening || {};
  const ReadyG = ReadyGlyph[angle.readiness];
  return (
    <div data-aid={angle.id} onMouseEnter={onEnter} onMouseLeave={onLeave} onClick={onClick} style={{
      flex: 1, minWidth: 0, cursor: "default", display: "flex", flexDirection: "column",
      borderRadius: 13, padding: "22px 22px 16px",
      border: `1px solid ${active ? EX.line : "var(--exborder)"}`,
      background: active ? "var(--exsurf2)" : "var(--exsurface)",
      boxShadow: active ? "0 16px 38px -22px rgba(0,0,0,0.8)" : "none",
      transform: active ? "translateY(-5px)" : "none",
      position: active ? "relative" : "static",
      zIndex: active ? 5 : "auto",
      opacity: dimmed ? 0.55 : 1,
      transition: "border-color .18s, box-shadow .25s, transform .25s, opacity .2s",
    }}>
      <span style={{ fontFamily: "monospace", fontSize: 9.5, letterSpacing: "0.13em", textTransform: "uppercase", color: "var(--exmut)", border: "1px solid var(--exborder-soft)", borderRadius: 5, padding: "3px 7px", display: "inline-block", alignSelf: "flex-start", marginBottom: 13 }}>
        {SHIFT_LABEL[angle.basis?.primary] || "New angle"}
      </span>
      <h3 style={{ fontSize: 15.5, fontWeight: 600, margin: "0 0 8px", color: "var(--extext)", letterSpacing: "0.1px", lineHeight: 1.3 }}>{angle.title}</h3>
      <p style={{ fontSize: 12.5, color: "var(--exsec)", lineHeight: 1.6, margin: "0 0 16px", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{angle.concept}</p>
      <div style={{ display: "flex", gap: 9, marginBottom: 18, minWidth: 0 }}>
        <span style={{ flexShrink: 0, color: EX.base, opacity: 0.9, marginTop: 1, display: "flex" }}><RoadIc /></span>
        <span style={{ flex: 1, minWidth: 0, fontSize: 13, lineHeight: 1.55, color: "#cdd0d6", overflowWrap: "anywhere", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{opening.text}</span>
      </div>
      <div style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, borderTop: "1px solid var(--exdivider)", paddingTop: 14 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11.5, color: "var(--exsec)", fontWeight: 500, minWidth: 0 }}>
          {ReadyG && <ReadyG />}{READY_LABEL[angle.readiness]}
        </span>
        <span style={{ flexShrink: 0, fontSize: 11.5, color: active ? EX.bright : "var(--exmut)", fontWeight: 500, whiteSpace: "nowrap" }}>look closer ›</span>
      </div>
    </div>
  );
}

function Affordance({ children, onClick }) {
  const [h, setH] = useState(false);
  return (
    <span onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ fontSize: 11.5, color: h ? "var(--exsec)" : "var(--exmut)", display: "inline-flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
      {children}
    </span>
  );
}

function SaveAffordance({ state, onClick }) {
  const [h, setH] = useState(false);
  const saved = state === "saved", saving = state === "saving", err = state === "error";
  const label = saved ? "saved" : saving ? "saving…" : err ? "retry" : "save";
  const color = saved ? EX.bright : err ? "#fca5a5" : (h ? "var(--exsec)" : "var(--exmut)");
  return (
    <span onClick={saving ? undefined : onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ fontSize: 11.5, color, display: "inline-flex", gap: 6, alignItems: "center", cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1 }}>
      {saved ? <Svg w={12} sw={2}><path d="M5 13l4 4L19 7" /></Svg> : <PlusIc />} {label}
    </span>
  );
}

function FanSurface({ idea, angles, fanState, t, onSave, saveState, onCompare, onTakeToDeep, branchReason }) {
  const fanRef = useRef(null);
  const nodeRef = useRef(null);
  const rowRef = useRef(null);
  const wellRef = useRef(null);
  const innerRef = useRef(null);
  const hideTimer = useRef(null);
  const dwellTimer = useRef(null);
  const hoverRef = useRef(true);
  const [paths, setPaths] = useState("");
  const [vb, setVb] = useState("0 0 0 0");
  const [activeId, setActiveId] = useState(null);
  const [panelAngle, setPanelAngle] = useState(null);
  const [wellH, setWellH] = useState(0);
  const [caretLeft, setCaretLeft] = useState(0);

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia) {
      hoverRef.current = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    }
  }, []);

  const draw = useCallback(() => {
    const fanEl = fanRef.current, nodeEl = nodeRef.current, rowEl = rowRef.current;
    if (!fanEl || !nodeEl || !rowEl) return;
    const fan = fanEl.getBoundingClientRect();
    const nb = nodeEl.getBoundingClientRect();
    const x1 = nb.left + nb.width / 2 - fan.left, y1 = nb.bottom - fan.top;
    const any = !!activeId;
    let p = "";
    [...rowEl.children].forEach((c) => {
      const cb = c.getBoundingClientRect();
      const x2 = cb.left + cb.width / 2 - fan.left, y2 = cb.top - fan.top;
      const dy = y2 - y1, c1 = y1 + dy * 0.55, c2 = y2 - dy * 0.55;
      const bez = `M ${x1} ${y1} C ${x1} ${c1}, ${x2} ${c2}, ${x2} ${y2}`;
      const on = c.getAttribute("data-aid") === activeId;
      const o1 = on ? 0.28 : 0.2;
      const o2 = on ? 0.85 : (any ? 0.22 : 0.58);
      p += `<path d="${bez}" fill="none" stroke="url(#exlg)" stroke-width="2" opacity="${o1}" filter="url(#exgl)"/>`;
      p += `<path d="${bez}" fill="none" stroke="url(#exlg)" stroke-width="${on ? 1.3 : 1.1}" opacity="${o2}"/>`;
      p += `<circle cx="${x2}" cy="${y2}" r="6" fill="${EX.gradB}" opacity="0.16"/>`;
      p += `<circle cx="${x2}" cy="${y2}" r="${on ? 3.6 : 3}" fill="${EX.gradB}" opacity="${on ? 1 : (any ? 0.5 : 1)}"/>`;
    });
    p += `<circle cx="${x1}" cy="${y1}" r="3.5" fill="${EX.gradA}"/>`;
    setPaths(p);
    setVb(`0 0 ${fan.width} ${fan.height}`);
  }, [activeId]);

  const positionWell = useCallback(() => {
    const wellEl = wellRef.current, rowEl = rowRef.current, innerEl = innerRef.current;
    if (!wellEl || !rowEl) return;
    if (activeId) {
      const cardEl = rowEl.querySelector(`[data-aid="${activeId}"]`);
      const wr = wellEl.getBoundingClientRect();
      if (cardEl) {
        const cr = cardEl.getBoundingClientRect();
        setCaretLeft(cr.left + cr.width / 2 - wr.left);
      }
      if (innerEl) setWellH(innerEl.offsetHeight);
    } else {
      setWellH(0);
    }
  }, [activeId]);

  const cancelHide = () => {
    if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; }
  };
  const cancelDwell = () => {
    if (dwellTimer.current) { clearTimeout(dwellTimer.current); dwellTimer.current = null; }
  };
  const showActive = (id) => {
    cancelHide(); cancelDwell();
    setActiveId(id);
    setPanelAngle(angles.find((a) => a.id === id) || null);
  };
  const scheduleHide = () => {
    cancelHide();
    hideTimer.current = setTimeout(() => { hideTimer.current = null; setActiveId(null); }, 150);
  };
  const closeNow = () => { cancelHide(); cancelDwell(); setActiveId(null); };
  const onEnter = (id) => {
    if (!hoverRef.current) return;
    cancelHide();
    if (activeId) { showActive(id); return; } // already open: switch with no dwell
    cancelDwell();
    dwellTimer.current = setTimeout(() => { dwellTimer.current = null; showActive(id); }, 120);
  };
  const onLeave = () => { if (!hoverRef.current) return; cancelDwell(); scheduleHide(); };
  const onTap = (id) => { cancelDwell(); if (activeId === id) closeNow(); else showActive(id); };

  useLayoutEffect(() => { draw(); }, [draw, fanState, angles.length]);
  useLayoutEffect(() => { positionWell(); }, [positionWell, panelAngle]);

  useEffect(() => {
    if (fanState === "empty") return;
    const onResize = () => { draw(); positionWell(); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [draw, positionWell, fanState]);

  useEffect(() => {
    if (!activeId) return;
    const onDown = (e) => {
      const fanEl = fanRef.current, wellEl = wellRef.current;
      if (fanEl && fanEl.contains(e.target)) return;
      if (wellEl && wellEl.contains(e.target)) return;
      closeNow();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [activeId]);

  useEffect(() => () => { cancelHide(); cancelDwell(); }, []);

  const pa = panelAngle;
  const bet = pa?.justification?.bet || {};

  const node = (
    <div ref={nodeRef} style={{
      width: 252, border: `1px solid ${EX.line}`, borderRadius: 14,
      background: `radial-gradient(120% 150% at 50% 0%, ${EX.dim}, transparent 62%), ${t.surfAlt}`,
      padding: "18px 20px 20px", position: "relative", boxShadow: `0 0 46px -14px ${EX.base}`,
    }}>
      <div style={{ position: "absolute", left: "50%", bottom: -6, width: 11, height: 11, borderRadius: "50%", background: EX.gradA, boxShadow: `0 0 0 5px ${EX.dim}, 0 0 16px 2px ${EX.gradA}`, transform: "translateX(-50%)" }} />
      <div style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: EX.bright, display: "flex", gap: 7, alignItems: "center", marginBottom: 9 }}>
        <SectionIcon.node /> your rough idea
      </div>
      <div style={{ fontSize: 13, color: t.text, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{idea}</div>
    </div>
  );

  const right = fanState !== "empty"
    ? <span style={{ fontSize: 11, color: t.mut, fontFamily: "monospace", letterSpacing: "0.03em" }}>fan order · not ranked</span>
    : null;

  const lead = { fontFamily: "monospace", fontSize: 9.5, letterSpacing: "0.13em", textTransform: "uppercase", flex: "0 0 66px", marginTop: 2 };

  return (
    <section style={{ marginTop: 48 }} className="ex-scope">
      <Eyebrow num="2" icon={<SectionIcon.dir />} title="Where it could go" sub="Directions the evidence supports" t={t} right={right} />
      {fanState === "empty" ? (
        <div style={{ display: "grid", gridTemplateColumns: "252px 1fr", gap: 30, alignItems: "center" }}>
          {node}
          <div style={{ border: `1px dashed ${t.border}`, borderRadius: 13, padding: "34px 36px", background: t.surfAlt }}>
            <p style={{ fontSize: 16, color: t.text, fontWeight: 400, lineHeight: 1.5, margin: "0 0 10px" }}>No separate roads to fan from here — and that's a finding, not a dead end.</p>
            <p style={{ fontSize: 13, color: t.sec, lineHeight: 1.6, margin: 0 }}>{branchReason || "When an idea is already this pointed, exploration has nothing to widen. The honest next move is to judge it, not to branch it."}</p>
            <div onClick={() => onTakeToDeep && onTakeToDeep(null, { useOriginalIdea: true })} style={{ marginTop: 14, fontSize: 12.5, color: EX.bright, display: "inline-flex", gap: 8, alignItems: "center", cursor: "pointer" }}>take it to Deep as it stands →</div>
          </div>
        </div>
      ) : (
        <>
          {fanState === "thin" && (
            <div style={{ fontSize: 12, color: t.mut, margin: "4px 0 8px" }}>The directions the evidence supports, shown in fan order.</div>
          )}
          <div ref={fanRef} style={{ position: "relative" }}>
            <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }} viewBox={vb}
              dangerouslySetInnerHTML={{ __html: `<defs><linearGradient id="exlg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${EX.gradA}"/><stop offset="1" stop-color="${EX.gradB}"/></linearGradient><filter id="exgl" x="-40%" y="-20%" width="180%" height="140%"><feGaussianBlur stdDeviation="2.4"/></filter></defs>${paths}` }} />
            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{ display: "flex", justifyContent: "center" }}>{node}</div>
              <div ref={rowRef} style={{ display: "flex", gap: 22, marginTop: 92, alignItems: "stretch" }}>
                {angles.map((a) => (
                  <EssenceCard key={a.id} angle={a}
                    active={a.id === activeId}
                    dimmed={!!activeId && a.id !== activeId}
                    onEnter={() => onEnter(a.id)}
                    onLeave={onLeave}
                    onClick={() => onTap(a.id)} />
                ))}
              </div>
            </div>
          </div>

          <div ref={wellRef}
            onMouseEnter={() => { if (hoverRef.current) cancelHide(); }}
            onMouseLeave={() => { if (hoverRef.current) scheduleHide(); }}
            style={{ overflow: "hidden", height: wellH, transition: "height .3s cubic-bezier(.3,.8,.35,1)" }}>
            <div ref={innerRef} style={{ paddingTop: 18 }}>
              {pa && (
                <div style={{ position: "relative", border: "1px solid var(--exborder)", borderTop: `1px solid ${EX.line}`, borderRadius: 12, background: "var(--exsurf2)", padding: "18px 24px 13px", boxShadow: "0 18px 44px -26px rgba(0,0,0,0.8)" }}>
                  <span style={{ position: "absolute", top: -6, left: caretLeft, width: 11, height: 11, background: "var(--exsurf2)", borderLeft: `1px solid ${EX.line}`, borderTop: `1px solid ${EX.line}`, transform: "translateX(-50%) rotate(45deg)" }} />
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 15, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "monospace", fontSize: 9.5, letterSpacing: "0.13em", textTransform: "uppercase", color: EX.bright, border: `1px solid ${EX.line}`, borderRadius: 5, padding: "3px 7px" }}>{SHIFT_LABEL[pa.basis?.primary] || "New angle"}</span>
                    <span style={{ fontSize: 14.5, fontWeight: 600, color: "var(--extext)", letterSpacing: "0.1px" }}>{pa.title}</span>
                  </div>
                  <div style={{ display: "flex", gap: 16, marginBottom: 13 }}>
                    <span style={{ ...lead, color: EX.bright }}>the bet</span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13, lineHeight: 1.58, color: "#e3e5e9" }}>Works only if {bet.text}.{bet.rests_on && (
                      <span style={{ fontFamily: "monospace", fontSize: 9.5, letterSpacing: "0.06em", color: "var(--exmut)", border: "1px solid var(--exborder-soft)", borderRadius: 4, padding: "1px 6px", marginLeft: 7, whiteSpace: "nowrap", textTransform: "uppercase" }}>{bet.rests_on}</span>
                    )}</span>
                  </div>
                  <div style={{ display: "flex", gap: 16, marginBottom: 13 }}>
                    <span style={{ ...lead, color: "var(--exmut)" }}>the limit</span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, lineHeight: 1.58, color: "var(--exsec)" }}>{pa.justification?.disconfirmer}</span>
                  </div>
                  <div style={{ display: "flex", gap: 18, alignItems: "center", borderTop: "1px solid var(--exdivider)", paddingTop: 12, marginTop: 2, flexWrap: "wrap" }}>
                    <SaveAffordance state={(saveState || {})[pa.id]} onClick={() => onSave && onSave(pa)} />
                    <Affordance onClick={() => onCompare && onCompare(pa)}><CmpIc /> compare</Affordance>
                    <span onClick={() => onTakeToDeep && onTakeToDeep(pa.id, { useOriginalIdea: false })} style={{ fontSize: 12, color: EX.bright, fontWeight: 500, display: "inline-flex", gap: 7, alignItems: "center", cursor: "pointer", whiteSpace: "nowrap" }}>take to Deep →</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

// ============================================================================
// 3 · Where this could fit — terrain (map + reader)
// ============================================================================
function TerrainSurface({ terrain, angles, t }) {
  const lanes = Array.isArray(terrain?.lanes) ? terrain.lanes : [];
  const firms = terrain?.firms_up_fastest || null;

  // lanes that the fastest angle(s) sit in (firms_up_fastest references angles)
  const fastLaneIds = new Set();
  if (firms && Array.isArray(firms.angle_refs)) {
    firms.angle_refs.forEach((aid) => {
      const a = angles.find((x) => x.id === aid);
      if (a?.lane_ref) fastLaneIds.add(a.lane_ref);
    });
  }

  const defaultLane = (lanes.find((l) => l.status === "open") || lanes[0] || null);
  const [selId, setSelId] = useState(defaultLane?.id || null);
  useEffect(() => { setSelId(defaultLane?.id || null); /* eslint-disable-next-line */ }, [lanes.length]);
  const sel = lanes.find((l) => l.id === selId) || defaultLane;

  if (lanes.length === 0) return null;

  return (
    <section style={{ marginTop: 48 }}>
      <Eyebrow num="3" icon={<SectionIcon.terr />} title="Where this could fit" sub="The market around these directions" t={t} />
      <div style={{ display: "grid", gridTemplateColumns: "296px 1fr", border: `1px solid ${t.border}`, borderRadius: 14, overflow: "hidden", minHeight: 300 }}>
        <div style={{ borderRight: `1px solid ${t.divider}`, background: t.surfAlt }}>
          {ZONES.map(([zkey, zlabel], i) => {
            const inZone = lanes.filter((l) => l.status === zkey);
            return (
              <div key={zkey} style={{ padding: "15px 16px", borderTop: i === 0 ? "none" : `1px solid ${t.divider}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "monospace", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: t.mut, marginBottom: 11 }}>
                  <span style={{ color: t.mut, display: "flex" }}><StatusShape status={zkey} /></span>{zlabel}
                </div>
                {inZone.length ? inZone.map((l) => (
                  <LaneNode key={l.id} lane={l} selected={l.id === selId} t={t} onSelect={() => setSelId(l.id)} />
                )) : (
                  <div style={{ fontSize: 12, color: t.faint, fontStyle: "italic", padding: "4px 2px" }}>— {zkey === "open" ? "open ground, nothing here" : "nothing here"}</div>
                )}
              </div>
            );
          })}
        </div>
        <div style={{ padding: "30px 32px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          {sel && <LaneReader lane={sel} fast={fastLaneIds.has(sel.id)} t={t} />}
        </div>
      </div>
      {firms?.text && (
        <div style={{ marginTop: 18, display: "flex", gap: 15, alignItems: "flex-start", borderLeft: `2px solid ${EX.line}`, padding: "4px 0 4px 18px" }}>
          <span style={{ flexShrink: 0, color: EX.bright, marginTop: 1 }}><BoltIc /></span>
          <div>
            <div style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: EX.bright, marginBottom: 6 }}>Firms up fastest</div>
            <div style={{ fontSize: 13, color: t.sec, lineHeight: 1.6, maxWidth: 760 }}>{firms.text}</div>
          </div>
        </div>
      )}
    </section>
  );
}

function LaneNode({ lane, selected, t, onSelect }) {
  const [h, setH] = useState(false);
  const on = selected || h;
  return (
    <button
      onClick={onSelect} onMouseEnter={() => { setH(true); onSelect(); }} onMouseLeave={() => setH(false)}
      style={{
        display: "block", width: "100%", textAlign: "left", background: on ? t.surf3 : "transparent",
        border: `1px solid ${selected ? EX.line : "transparent"}`, borderRadius: 9, padding: "9px 11px",
        color: on ? t.text : t.sec, fontSize: 13.5, cursor: "pointer", transition: "0.13s", marginTop: 5, fontFamily: "inherit",
      }}>
      {lane.label}
    </button>
  );
}

function LaneReader({ lane, fast, t }) {
  const answered = lane.demand_question == null;
  const typePhrase = lane.lane_type ? LANE_TYPE_PHRASE[lane.lane_type] : null;
  // Crowded lane (demand_question null): lead with the lane_type read — real
  // backend content — rather than a canned sentence. Open lane: the
  // demand_question is the hero, lane_type rides under it as characterization.
  const hero = answered
    ? (typePhrase || "Demand is evidenced by the paying incumbents — the open question is how you'd differ, not whether anyone wants it.")
    : lane.demand_question;
  const refs = Array.isArray(lane.reference_items) ? lane.reference_items.map((r) => r.name).filter(Boolean) : [];
  return (
    <>
      {fast && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "monospace", fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase", color: EX.bright, border: `1px solid ${EX.line}`, borderRadius: 20, padding: "3px 9px", marginBottom: 15, alignSelf: "flex-start" }}>
          <BoltIc /> Firms up fastest
        </span>
      )}
      <div style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.13em", textTransform: "uppercase", color: t.mut, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
        {answered ? <ReadLinesIc /> : <QIc />}{answered ? "The read" : "The open question"}
      </div>
      <div style={{ fontSize: 17, fontWeight: 300, lineHeight: 1.5, color: answered ? t.sec : EX.bright, letterSpacing: "0.1px" }}>{hero}</div>
      {!answered && typePhrase && (
        <div style={{ fontSize: 12.5, color: t.mut, lineHeight: 1.55, marginTop: 12, fontStyle: "italic" }}>{typePhrase}</div>
      )}
      {lane.substitute_tell?.signal && <div style={{ fontSize: 12.5, color: t.sec, lineHeight: 1.55, marginTop: 16 }}>Today, {lane.substitute_tell.signal}.</div>}
      {refs.length > 0 && <div style={{ fontSize: 12, color: t.mut, marginTop: 9 }}>Alongside {refs.join(", ")}</div>}
    </>
  );
}

// ============================================================================
// 4 · From here — next move
// ============================================================================
function NextMoveSurface({ nextMove, t, handlers }) {
  if (!nextMove) return null;
  const du = nextMove.dominant_uncertainty || {};
  const actions = Array.isArray(nextMove.actions) ? nextMove.actions.filter((a) => a.enabled !== false) : [];
  const primary = nextMove.primary_action;

  // primary first, then the rest in contract order
  const ordered = [...actions].sort((a, b) => (a.type === primary ? -1 : b.type === primary ? 1 : 0));

  return (
    <section style={{ marginTop: 48 }}>
      <Eyebrow num="4" icon={<SectionIcon.next />} title="From here" sub="Your options from here" t={t} />
      <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 14, padding: "34px 36px" }}>
        <div style={{ borderLeft: `2px solid ${EX.line}`, paddingLeft: 18, marginBottom: 26 }}>
          <div style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: t.mut, marginBottom: 7 }}>The open question</div>
          <div style={{ fontSize: 15, color: t.text, lineHeight: 1.55, fontWeight: 300 }}>{du.text}</div>
        </div>
        {nextMove.recommendation && (
          <div style={{ fontSize: 13.5, color: t.sec, lineHeight: 1.6, marginBottom: 28, maxWidth: 760 }}>{nextMove.recommendation}</div>
        )}
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          {ordered.map((a, i) => (
            <MoveButton key={a.type + i} action={a} isPrimary={a.type === primary} t={t} handlers={handlers} />
          ))}
        </div>
        <div style={{ marginTop: 26, fontSize: 11.5, color: t.mut, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <b style={{ color: t.mut, fontWeight: 500 }}>While exploring:</b> open more than one path in Deep · look for patterns across directions · follow curiosity, not commitment.
        </div>
      </div>
    </section>
  );
}

function MoveButton({ action, isPrimary, t, handlers }) {
  const [h, setH] = useState(false);
  const meta = ACTION_META[action.type] || { label: action.label || action.type, desc: "", ic: "→" };
  const m = handlers || {};
  const targets = action.target_angle_ids || [];
  const sState = m.saveState || {};
  const allSaved = action.type === "save_branch" && targets.length > 0 && targets.every((id) => sState[id] === "saved");
  const anySaving = action.type === "save_branch" && targets.some((id) => sState[id] === "saving");
  const label = allSaved ? "Saved ✓" : anySaving ? "Saving…" : (action.label || meta.label);
  const fire = () => {
    if (action.type === "take_to_deep") m.onTakeToDeep && m.onTakeToDeep(targets[0] || null, { useOriginalIdea: !!action.use_original_idea, angleIds: targets });
    else if (action.type === "compare_selected") m.onCompare && m.onCompare(targets);
    else if (action.type === "save_branch") (m.saveBranch ? m.saveBranch(targets) : (m.onSaveBranch && m.onSaveBranch(targets)));
    else if (action.type === "explore_variation") m.onExploreVariation && m.onExploreVariation();
    else if (action.type === "park") m.onPark && m.onPark();
    else if (action.type === "edit_read") m.onEditRead && m.onEditRead();
  };
  return (
    <button onClick={fire} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{
      flex: 1, minWidth: 150, borderRadius: 11, padding: "18px 18px", cursor: "pointer", transition: "0.15s", textAlign: "left",
      border: `1px solid ${isPrimary || h || allSaved ? EX.line : t.border}`,
      background: isPrimary || allSaved ? EX.dim : t.surface,
    }}>
      <div style={{ fontSize: 13, color: isPrimary || allSaved ? EX.bright : t.text, fontWeight: 500, display: "flex", gap: 9, alignItems: "center", marginBottom: 5 }}>
        <span style={{ display: "inline-flex" }}>{meta.ic}</span>{label}
      </div>
      <div style={{ fontSize: 11.5, color: meta.deep ? t.sec : t.mut, lineHeight: 1.45 }}>{meta.desc}</div>
    </button>
  );
}

// ============================================================================
// ExploreView — screen shell + the four surfaces
// ============================================================================
export default function ExploreView({
  screen,
  t,
  analysis,
  user,
  authLoading,
  viewingFromSaved,
  showAuthModal,
  headerStyle,
  setCurrentScreen,
  setShowAuthModal,
  setUser,
  setViewingFromSaved,
  goToMyIdeas,
  handleLogout,
  // explore action handlers (all optional)
  onTakeToDeep,
  onSaveBranch,
  onCompare,
  onExploreVariation,
  onPark,
  onEditRead,
  onExpandIdea,
}) {
  if (!analysis || analysis.schema_version !== "ll2_explore_v1") return null;

  const { idea, fan_state: fanState, read, angles = [], terrain, next_move: nextMove } = analysis;

  const [saveState, setSaveState] = useState({}); // { [angleId]: "saving" | "saved" | "error" }
  const saveBranch = useCallback(async (ids) => {
    const list = ids && ids.length ? ids : [];
    if (!list.length || !onSaveBranch) return;
    setSaveState((s) => { const n = { ...s }; list.forEach((id) => { if (n[id] !== "saved") n[id] = "saving"; }); return n; });
    try {
      await onSaveBranch(list);
      setSaveState((s) => { const n = { ...s }; list.forEach((id) => { n[id] = "saved"; }); return n; });
    } catch (e) {
      setSaveState((s) => { const n = { ...s }; list.forEach((id) => { if (n[id] !== "saved") n[id] = "error"; }); return n; });
    }
  }, [onSaveBranch]);

  const handlers = { onTakeToDeep, onSaveBranch, onCompare, onExploreVariation, onPark, onEditRead, saveBranch, saveState };

  // Explore neutral surface palette — pinned to the locked mockup
  // (explore-mode-final.html), which uses faintly blue-tinted darks for cohesion
  // with Dawn. The app's generic T.dark tokens are neutral/translucent grays;
  // that mismatch is what made Section 3 (terrain nav + lanes, heavy on
  // surf2/surf3/divider) read off vs the mockup. Every surface gets xt.
  const xt = {
    ...t,
    bg: "#0a0d13", surface: "#0e1117", surfAlt: "#12161d", surf3: "#161b24",
    border: "rgba(55,55,55,0.42)", text: "#f0f0f0", sec: "#a0a0a0",
    mut: "#6b6f78", faint: "#474b54", divider: "#1d2027",
  };

  // CSS-var scope so nested cards inherit explore-aware tokens without prop drilling
  const scopeVars = {
    "--extext": xt.text, "--exsec": xt.sec, "--exmut": xt.mut, "--exfaint": xt.faint,
    "--exsurface": xt.surface, "--exsurf2": xt.surfAlt, "--exborder": xt.border,
    "--exborder-soft": "rgba(55,55,55,0.24)", "--exdivider": xt.divider,
  };

  return (
    <div style={{ minHeight: "100vh", background: xt.bg, color: xt.text, display: "flex", flexDirection: "column", overflowX: "hidden", ...scopeVars }}>
      <header style={headerStyle}>
        <PageContainer wide>
          <div style={{ padding: "16px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <h1 onClick={() => setCurrentScreen && setCurrentScreen("input")} style={{ fontSize: 14, fontFamily: "monospace", letterSpacing: "0.1em", textTransform: "uppercase", color: t.mut, margin: 0, cursor: "pointer" }}>IdeaLoop Core</h1>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, color: EX.bright, fontFamily: "monospace", letterSpacing: "0.04em" }}>
                <span style={{ width: 9, height: 9, border: `1.5px solid ${EX.base}`, transform: "rotate(45deg)", boxShadow: `0 0 10px -1px ${EX.base}` }} /> explore
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button onClick={() => { if (viewingFromSaved) { setViewingFromSaved && setViewingFromSaved(false); goToMyIdeas && goToMyIdeas(); } else { setCurrentScreen && setCurrentScreen("input"); } }} style={{ fontSize: 12, color: t.mut, background: "none", border: "none", cursor: "pointer" }}>
                {viewingFromSaved ? "← Back to My Ideas" : "← Back to idea"}
              </button>
              {!authLoading && (user ? (
                <>
                  <span style={{ color: t.divider }}>|</span>
                  {!viewingFromSaved && (
                    <>
                      <button onClick={goToMyIdeas} style={{ fontSize: 12, color: t.link, background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}>My Ideas</button>
                      <span style={{ color: t.divider }}>|</span>
                    </>
                  )}
                  <span style={{ fontSize: 12, color: t.mut }}>{user.email}</span>
                  <button onClick={handleLogout} style={{ fontSize: 12, color: t.mut, background: "none", border: "none", cursor: "pointer" }}>Log out</button>
                </>
              ) : (
                <>
                  <span style={{ color: t.divider }}>|</span>
                  <button onClick={() => setShowAuthModal && setShowAuthModal(true)} style={{ fontSize: 12, color: t.link, background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}>Log in to save</button>
                </>
              ))}
            </div>
          </div>
        </PageContainer>
      </header>

      {showAuthModal && <AuthModal onClose={() => setShowAuthModal && setShowAuthModal(false)} onAuth={(u) => setUser && setUser(u)} t={t} />}

      <main style={{ flex: 1, paddingBottom: 80 }}>
        <PageContainer wide>
          <ReadSurface read={read} t={xt} />
          <FanSurface idea={idea} angles={angles} fanState={fanState} t={xt}
            onSave={(a) => saveBranch([a.id])} saveState={saveState} onCompare={(a) => onCompare && onCompare([a.id])}
            onTakeToDeep={onTakeToDeep} branchReason={read?.branchability?.reason} />
          <TerrainSurface terrain={terrain} angles={angles} t={xt} />
          <NextMoveSurface nextMove={nextMove} t={xt} handlers={handlers} />
          <div style={{ marginTop: 30, paddingTop: 18, borderTop: `1px solid ${t.border}`, fontSize: 11, color: "#474b54", textAlign: "center", fontFamily: "monospace", letterSpacing: "0.04em" }}>
            EXPLORE — WIDENS A ROUGH IDEA · NO SCORE, NO RANK, NO VERDICT
          </div>
        </PageContainer>
      </main>
    </div>
  );
}