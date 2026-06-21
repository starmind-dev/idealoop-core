// src/app/ChangeWalkthrough.js
//
// THE RE-EVAL CHANGE SURFACE (Stage 4a) — ported from the locked, approved mockup
// `reeval-result-markers.html`. Two exports, plus one always-mounted style host:
//
//   <ChangeMarker bundle={walkthroughData?.anchors?.[key]} onOpen={setOpenWT} />
//       A glowing `!` pinned next to a changed element. Renders NOTHING when the
//       diff did not light this key (bundle absent) — restraint is structural: a
//       marker can only exist where the diff says a path moved. Clicking it opens
//       the popup for that anchor's bundle.
//
//   <ChangeWalkthrough anchor={openWT} onClose={() => setOpenWT(null)} />
//       The walkthrough popup. Mount it ONCE at the result-screen root. It ALWAYS
//       renders the shared <style> (so every <ChangeMarker> elsewhere is styled)
//       and renders the scrim + popup only when `anchor` (a diff bundle) is set.
//
// DATA CONTRACT — `anchor` is one bundle off the re-evaluate-walkthrough route's
// `anchors[key]` (the Stage-2 diff bundle + its Sonnet narration):
//   { anchor, label, color, kind:'numeric'|'qualitative'|'arithmetic',
//     shape:'direct'|'by-path'|'evidence-only'|'read-only'|'arithmetic',
//     from,to (numeric) | before,after|dq,dqf (qualitative),
//     paths:{in,ev,rd}, contributions (arithmetic), note?, narration }
//
// CODE COMPUTES THE SHAPE; THE MODEL ONLY NARRATES. The causal diagram, chips,
// paths strip, and contract line are all DERIVED from `shape` + `paths` here — the
// only generated text is `narration`. That is the whole honesty model: the lit
// nodes/edges and the IN·EV·RD ledger come from the diff, never from the writer.

import React from "react";

/* ── shape → derived diagram/chips wiring (matches the locked mockup exactly) ── */
const SHAPES = {
  direct: {
    nodes: { edit: 1, evidence: 0, read: 1 }, edges: { ee: 1, er: 0 }, loop: 0,
    chips: [["Input", "direct", 2], ["Evidence", "", 0], ["Read", "", 1]],
  },
  "by-path": {
    nodes: { edit: 1, evidence: 1, read: 1 }, edges: { ee: 1, er: 1 }, loop: 0,
    chips: [["Input", "via", 1], ["Evidence", "then", 2], ["Read", "moved", 1]],
  },
  "evidence-only": {
    nodes: { edit: 0, evidence: 1, read: 1 }, edges: { ee: 0, er: 1 }, loop: 0,
    chips: [["Input", "", 0], ["Evidence", "only", 2], ["Read", "followed", 1]],
  },
  "read-only": {
    nodes: { edit: 0, evidence: 0, read: 1 }, edges: { ee: 0, er: 0 }, loop: 1,
    chips: [["Input", "", 0], ["Evidence", "", 0], ["Read", "re-weighed", 2]],
  },
};

/* ── the contract (honesty) line per shape, numeric vs qualitative ── */
function contractFor(shape, kind) {
  const fixed = kind === "qualitative"
    ? "The split is descriptive, not scored — only this explanation is written fresh."
    : "The number is computed and fixed — only this explanation is written fresh.";
  switch (shape) {
    case "direct":
      return (<><span>This is the most direct kind of change: </span><b>you touched this part, and the read scored what you touched.</b> {fixed}</>);
    case "by-path":
      return (<>This is the <b>by-path</b> case other tools mislabel. The cause is real but indirect: edit → evidence → this read. {fixed}</>);
    case "evidence-only":
      return (<>You did not cause this one. Retrieval came back different and the read followed — <b>no edit of yours is in this path.</b> {fixed}</>);
    case "read-only":
      return (<>The honest residual: same input, same evidence, the <b>judgment itself re-weighed.</b> {fixed}</>);
    case "arithmetic":
      return (<>This number is <b>computed, not judged.</b> It can only move when MD, MO, or OR move — there is no read to narrate here, just the sum following its inputs.</>);
    default:
      return fixed;
  }
}

/* ── inline icons (lifted verbatim from the mockup) ── */
const Icon = {
  edit: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
  ),
  evidence: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
  ),
  read: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3.5" /></svg>
  ),
};

function Edge({ lit }) {
  const col = lit ? "var(--mc)" : "var(--cw-border)";
  return (
    <svg viewBox="0 0 100 14" preserveAspectRatio="none">
      <line x1="2" y1="7" x2="86" y2="7" stroke={col} strokeWidth="1.6" strokeDasharray={lit ? "0" : "4 4"} />
      <polygon points="86,2 98,7 86,12" fill={col} />
    </svg>
  );
}

/* ── normalize one arithmetic contribution row to {name,color,calc,value} ── */
function normContribution(c) {
  if (Array.isArray(c)) return { name: c[0], color: c[1], calc: c[2], value: c[3] };
  if (c && typeof c === "object") {
    return {
      name: c.name || c.label || c.metric || "",
      color: c.color || "var(--mut)",
      calc: c.calc || c.weighted || (c.score != null && c.weight != null ? `${c.score} × ${c.weight}` : ""),
      value: c.value != null ? c.value : c.contribution != null ? c.contribution : "",
    };
  }
  return { name: "", color: "var(--mut)", calc: "", value: "" };
}

/* ─────────────────────────  THE MARKER  ───────────────────────── */
export function ChangeMarker({ bundle, onOpen, title }) {
  if (!bundle) return null; // restraint: no bundle => the diff did not light this key
  const label = title || (bundle.label ? `${bundle.label} changed` : "What changed");
  return (
    <button
      type="button"
      className="cw-mk"
      style={{ "--mc": bundle.color || "var(--cw-mut)" }}
      title={label}
      aria-label={label}
      onClick={(e) => { e.stopPropagation(); onOpen && onOpen(bundle); }}
    >!</button>
  );
}

/* ─────────────────────────  THE POPUP  ───────────────────────── */
export function ChangeWalkthrough({ anchor, onClose }) {
  // Escape-to-close + body scroll lock, only while open.
  React.useEffect(() => {
    if (!anchor) return;
    const onKey = (e) => { if (e.key === "Escape" && onClose) onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [anchor, onClose]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CW_CSS }} />
      {anchor && <Popup anchor={anchor} onClose={onClose} />}
    </>
  );
}
export default ChangeWalkthrough;

function Popup({ anchor: d, onClose }) {
  const shape = d.shape || "read-only";
  const kind = d.kind || (d.from != null || d.delta ? "numeric" : "qualitative");
  const cfg = SHAPES[shape] || SHAPES["read-only"];
  const mc = d.color || "var(--cw-mut)";
  const kick = `What changed · ${d.label || "this read"}`;

  // header: numeric delta OR qualitative transition
  const from = d.from != null ? d.from : d.delta && d.delta.from;
  const to = d.to != null ? d.to : d.delta && d.delta.to;
  const note = d.note;
  const dq = d.dq || (d.before != null ? `${d.before} → ${d.after}` : d.after);
  const dqf = d.dqf;

  // paths ledger — prefer the diff's own, fall back to the shape's
  const paths = d.paths || { in: cfg.nodes.edit, ev: cfg.nodes.evidence, rd: cfg.nodes.read };

  const node = (k, lab, sub) => (
    <div className={`cw-cnode ${cfg.nodes[k] ? "lit" : ""}`}>
      <div className="cw-cdot">{Icon[k]}{cfg.loop && k === "read" && <span className="cw-loop">↻</span>}</div>
      <div className="cw-cl"><b>{lab}</b>{sub}</div>
    </div>
  );

  return (
    <div className="cw-scrim on" onClick={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}>
      <div className="cw-pop" style={{ "--mc": mc }}>
        <div className="cw-bar" />
        <button type="button" className="cw-x" onClick={onClose} aria-label="Close">✕</button>
        <div className="cw-pad">
          <div className="cw-kick">{kick}</div>

          {/* header */}
          {kind === "numeric" || shape === "arithmetic" ? (
            <div className="cw-delta">
              <span className="cw-dnum">{from}</span>
              <span className="cw-dnum">→</span>
              <span className="cw-dto">{to}</span>
              {note && <span className="cw-note">↑ {note}</span>}
            </div>
          ) : (
            <>
              <div className="cw-dq">{dq}</div>
              {dqf && <div className="cw-dqf">{dqf}</div>}
            </>
          )}

          {/* body: arithmetic breakdown OR causal diagram */}
          {shape === "arithmetic" ? (
            <div className="cw-arith">
              {(d.contributions || []).map(normContribution).map((r, i) => (
                <div className="cw-arow" key={i}>
                  <span className="cw-ad" style={{ background: r.color }} />
                  <span className="cw-anm">{r.name}</span>
                  <span className="cw-acalc">{r.calc}</span>
                  <span className="cw-aval">{r.value}</span>
                </div>
              ))}
              <div className="cw-asum">
                <span className="cw-anm">Overall</span>
                <span className="cw-acalc">weighted sum</span>
                <span className="cw-aval">{to}</span>
              </div>
              <div className="cw-aex">Technical Complexity is execution context — excluded from the overall by design.</div>
            </div>
          ) : (
            <div className="cw-cd">
              {node("edit", "Your edit", "what you changed")}
              <div className="cw-cedge"><Edge lit={!!cfg.edges.ee} /></div>
              {node("evidence", "The evidence", "what got searched")}
              <div className="cw-cedge"><Edge lit={!!cfg.edges.er} /></div>
              {node("read", "The read", "how it scored")}
            </div>
          )}

          {/* chips (not on arithmetic) */}
          {shape !== "arithmetic" && (
            <div className="cw-chips">
              {cfg.chips.map(([lab, sub, st], i) => (
                <span key={i} className={st === 2 ? "cw-fchip lead" : st === 1 ? "cw-fchip lit" : "cw-fchip"}>
                  {lab}{sub ? <span className="cw-sub"> · {sub}</span> : null}
                </span>
              ))}
            </div>
          )}

          {/* the one generated line */}
          <p className="cw-narr">{d.narration || "This element moved; the explanation isn’t available for this version."}</p>

          {/* paths-considered ledger (not on arithmetic) */}
          {shape !== "arithmetic" && (
            <div className="cw-paths">
              <span className="cw-pl">paths considered — computed from the diff, not chosen by the writer</span>
              <span className="cw-pf">
                {[["IN", paths.in], ["EV", paths.ev], ["RD", paths.rd]].map(([lab, on]) => (
                  <span key={lab} className={`cw-pi ${on ? "on" : ""}`}><span className="cw-tk">{on ? "✓" : "·"}</span>{lab}</span>
                ))}
              </span>
            </div>
          )}

          {/* contract / honesty line */}
          <div className="cw-contract">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
            <div>{contractFor(shape, kind)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────  STYLE  ─────────────────────────
   Marker (.cw-mk) is global + self-contained (only needs --mc, set inline).
   Everything else is scoped under .cw-scrim so it can never leak into the app.
   The popup is a fixed dark surface (ILC launches dark-only).                */
const CW_CSS = `
.cw-mk{width:23px;height:23px;border-radius:7px;border:1px solid var(--mc,#71758a);background:color-mix(in srgb,var(--mc,#71758a) 17%,transparent);color:var(--mc,#71758a);font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:700;font-size:13px;line-height:1;cursor:pointer;display:inline-grid;place-items:center;flex-shrink:0;vertical-align:middle;transition:.15s;animation:cw-mkp 2.8s ease-in-out infinite;padding:0}
@keyframes cw-mkp{0%,100%{box-shadow:0 0 0 0 color-mix(in srgb,var(--mc,#71758a) 55%,transparent)}55%{box-shadow:0 0 0 5px transparent}}
.cw-mk:hover{background:color-mix(in srgb,var(--mc,#71758a) 36%,transparent);transform:scale(1.09)}
.cw-mk:focus-visible{outline:2px solid var(--mc,#71758a);outline-offset:2px}

.cw-scrim{--cw-text:#ececf1;--cw-sec:#bcbfca;--cw-mut:#71758a;--cw-border:rgba(255,255,255,.09);--cw-divider:rgba(255,255,255,.06);--cw-surfAlt:rgba(255,255,255,.05);--cw-mono:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;
  display:none;position:fixed;inset:0;background:rgba(7,8,12,.74);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);z-index:1000;overflow-y:auto;padding:54px 24px;box-sizing:border-box}
.cw-scrim.on{display:flex;align-items:flex-start;justify-content:center}
.cw-scrim *{box-sizing:border-box}
.cw-pop{position:relative;background:#0e1015;border:1px solid var(--cw-border);border-radius:18px;max-width:560px;width:100%;padding:0;overflow:hidden;box-shadow:0 30px 90px rgba(0,0,0,.62)}
.cw-bar{height:3px;background:var(--mc)}
.cw-pad{padding:26px 30px 28px}
.cw-x{position:absolute;top:16px;right:16px;width:28px;height:28px;border-radius:8px;background:var(--cw-surfAlt);border:1px solid var(--cw-border);color:var(--cw-sec);cursor:pointer;display:grid;place-items:center;font-size:14px}
.cw-kick{font-family:var(--cw-mono);font-size:10.5px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--mc);margin-bottom:12px}
.cw-delta{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin-bottom:6px}
.cw-dnum{font-family:var(--cw-mono);font-size:15px;color:var(--cw-mut)}
.cw-dto{font-family:var(--cw-mono);font-size:30px;font-weight:700;color:var(--cw-text)}
.cw-dq{font-size:18px;font-weight:700;letter-spacing:-.01em;line-height:1.3;margin:0 0 4px;color:var(--cw-text)}
.cw-dqf{font-size:13px;color:var(--cw-mut);margin-bottom:4px}
.cw-note{font-family:var(--cw-mono);font-size:11px;color:var(--mc);margin-top:2px}

.cw-cd{display:flex;align-items:flex-start;justify-content:space-between;gap:6px;margin:22px 0 18px;padding:18px 8px 6px;border-radius:14px;background:rgba(255,255,255,.02);border:1px solid var(--cw-divider)}
.cw-cnode{display:flex;flex-direction:column;align-items:center;gap:8px;width:96px;text-align:center}
.cw-cdot{width:46px;height:46px;border-radius:13px;display:grid;place-items:center;border:1.5px solid var(--cw-border);color:var(--cw-mut);background:rgba(255,255,255,.02);position:relative;transition:.2s}
.cw-cnode.lit .cw-cdot{border-color:var(--mc);color:var(--mc);background:color-mix(in srgb,var(--mc) 14%,transparent);box-shadow:0 0 16px color-mix(in srgb,var(--mc) 32%,transparent)}
.cw-cl{font-size:10.5px;line-height:1.3;color:var(--cw-mut)}
.cw-cnode.lit .cw-cl{color:var(--cw-sec)}
.cw-cl b{display:block;font-size:11.5px;font-weight:600;color:var(--cw-mut)}
.cw-cnode.lit .cw-cl b{color:var(--cw-text)}
.cw-cedge{flex:1;height:46px;display:flex;align-items:center;min-width:18px}
.cw-cedge svg{width:100%;height:14px}
.cw-loop{position:absolute;top:-9px;right:-9px;width:22px;height:22px;border-radius:50%;background:var(--mc);color:#0b0d12;display:grid;place-items:center;font-size:12px;font-weight:700}

.cw-chips{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px}
.cw-fchip{display:inline-flex;align-items:center;gap:7px;font-size:11.5px;font-weight:600;padding:6px 11px;border-radius:9px;border:1px solid var(--cw-border);color:var(--cw-mut);background:rgba(255,255,255,.02)}
.cw-fchip.lit{color:var(--mc);border-color:color-mix(in srgb,var(--mc) 42%,transparent);background:color-mix(in srgb,var(--mc) 12%,transparent)}
.cw-fchip.lead{color:#0b0d12;background:var(--mc);border-color:var(--mc)}
.cw-sub{font-weight:400;opacity:.85;font-family:var(--cw-mono);font-size:10px}

.cw-narr{font-size:14.5px;line-height:1.72;color:var(--cw-sec);margin:0 0 18px}

.cw-paths{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:12px 14px;border-radius:11px;background:rgba(255,255,255,.022);border:1px solid var(--cw-divider);margin-bottom:16px}
.cw-pl{font-family:var(--cw-mono);font-size:9.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--cw-mut);max-width:230px;line-height:1.4}
.cw-pf{display:flex;gap:12px;margin-left:auto}
.cw-pi{font-family:var(--cw-mono);font-size:11px;font-weight:600;display:flex;align-items:center;gap:5px;color:var(--cw-mut)}
.cw-pi.on{color:var(--cw-text)}
.cw-pi .cw-tk{width:15px;height:15px;border-radius:5px;display:grid;place-items:center;font-size:10px;border:1px solid var(--cw-border)}
.cw-pi.on .cw-tk{border-color:var(--mc);background:color-mix(in srgb,var(--mc) 18%,transparent);color:var(--mc)}

.cw-contract{display:flex;align-items:flex-start;gap:9px;font-size:12px;color:var(--cw-mut);line-height:1.5}
.cw-contract svg{flex-shrink:0;margin-top:1px;color:var(--cw-mut)}
.cw-contract b{color:var(--cw-sec);font-weight:600}

.cw-arith{margin:6px 0 18px;padding:16px 18px;border-radius:13px;background:rgba(255,255,255,.022);border:1px solid var(--cw-divider)}
.cw-arow{display:flex;align-items:center;gap:10px;font-family:var(--cw-mono);font-size:13px;margin-bottom:9px}
.cw-ad{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.cw-anm{color:var(--cw-sec);width:130px}
.cw-acalc{color:var(--cw-mut);flex:1}
.cw-aval{color:var(--cw-text);font-weight:600;margin-left:auto}
.cw-asum{display:flex;align-items:center;gap:10px;font-family:var(--cw-mono);font-size:14px;padding-top:11px;margin-top:3px;border-top:1px solid var(--cw-divider)}
.cw-asum .cw-anm{color:var(--cw-text);font-weight:600;width:130px}
.cw-asum .cw-acalc{color:var(--cw-mut);flex:1}
.cw-asum .cw-aval{color:var(--cw-text);font-weight:700;margin-left:auto;font-size:18px}
.cw-aex{font-family:var(--cw-mono);font-size:11px;color:var(--cw-mut);margin-top:10px}
`;