// MetricProseDetail.js — V5.11 evaluation-view perception layer.
//
// Renders one MD/MO/OR metric block in the prose card:
//   (1) score-coloured header pill (unchanged behaviour)
//   (2) a per-metric "header feature" read from committed _internal / display_score
//       - MD  : demand-type ladder      (_internal.demand_archetype  → tier N of 7)
//       - MO  : finer-score transition  (display_score vs coarse score)
//       - OR  : primary-exposure line   (_internal.binding_constraint.primary_subtype)
//   (3) the prose split into labelled question -> answer blocks
//       (MD/MO = 3 questions, OR = 4), read from the raw prose fields that
//       route.js retains on each metric object alongside .explanation.
//   (4) the SourcesStrip evidence bibliography (LL1 Part 2) at the card foot,
//       resolving _internal's evidence_cited trail against Stage 1's
//       competitors via the shared resolver. Evaluation-view ONLY — it lives
//       in this default export, NOT in MetricProseBody, so the comparison
//       view and execution_reality (correctly evidence-light) are untouched.
//
// DISPLAY-ONLY. Reads fields already on the payload (V9.28 raw-fields-retained +
// V9.30 display_score + _internal restored at final assembly). Touches no score.
//
// Graceful degradation:
//   - raw prose fields absent  -> falls back to the single .explanation paragraph
//   - _internal / display_score absent -> the header feature is simply omitted;
//     the score pill + prose still render. No empty shells, never crashes.
//
// Colour discipline: the score-band colour (getScoreColor) reaches ONLY the score
// pill in the header. Everything else — question labels, arrows, ladder, MO finer
// number, OR exposure line — uses neutral theme tokens (t.text/sec/mut/barBg). A low
// score must never paint a whole section red; the score lives on the score, nowhere
// else. This is the "blue/yellow only reflects the scores" rule.

import React from "react";
import { getScoreColor } from "./components";
import { metricColor } from "./DeepResultParts";
import SourcesStrip from "./SourcesStrip";

// ---- MD demand-type ladder: archetype name -> { tier (1..7), label } ----------
const MD_ARCHETYPES = {
  speculative_need:                            { tier: 1, label: "Speculative need" },
  category_validated_entrant_unspecific:       { tier: 2, label: "Category-validated, unspecific demand" },
  clear_pain_weak_pull:                        { tier: 3, label: "Clear pain, weak pull" },
  specific_buyer_unresolved_adoption_friction: { tier: 4, label: "Specific buyer, unresolved friction" },
  specific_buyer_with_active_trigger:          { tier: 5, label: "Specific buyer, active trigger" },
  demonstrated_pull_with_friction_survival:    { tier: 6, label: "Demonstrated pull, friction survived" },
  demonstrated_pull_with_capturable_density:   { tier: 7, label: "Demonstrated pull, capturable density" },
};
const MD_LADDER_TIERS = 7;

// ---- OR exposure subtype -> plain phrase (unmapped subtypes are humanised) -----
const OR_EXPOSURE_LABELS = {
  fast_follower_replication: "Replicable by competitors",
  job_substitution_pressure: "Substitutable by an existing tool or workaround",
  none_or_minimal: "No structural exposure named",
};

// ---- MO capture-case: monetization_archetype -> plain label (6-rung twin of MD) -
// Provisional wording; lives here for a one-line native-English microcopy pass.
const MO_ARCHETYPES = {
  insufficient_evidence:        "Insufficient payment evidence",
  founder_articulated:          "Founder-stated model",
  category_grounded:            "Category-level evidence",
  partial_segment_grounded:     "Partial segment evidence",
  direct_precedent_grounded:    "Comparable priced precedent",
  sustained_adoption_evidenced: "Sustained paid adoption",
};
const humanise = (s) =>
  typeof s === "string" && s.length
    ? s.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())
    : null;

// ---- per-metric question -> raw-prose-field mapping (joinProse order) ----------
const QUESTION_SETS = {
  market_demand: [
    { q: "What demand case is this?", field: "diagnosis" },
    { q: "What stands between this buyer and adoption?", field: "binding_friction_explanation" },
    { q: "Why does it sit here, and what would move it higher?", field: "direction" },
  ],
  monetization: [
    { q: "What payment-capture case is this?", field: "diagnosis" },
    { q: "What stands between this case and durable payment capture?", field: "binding_payment_constraint_explanation" },
    { q: "Why does it sit here, and what would move it higher?", field: "direction" },
  ],
  originality: [
    { q: "What is actually different about this case?", field: "differentiation_basis_diagnosis" },
    { q: "Is that differentiation defensible?", field: "defensibility_diagnosis" },
    { q: "What primary exposure constrains the position?", field: "binding_constraint_explanation" },
    { q: "Why does it sit here, and what would move it higher?", field: "direction" },
  ],
  // Stage 3 Execution Reality — same Q→A shape as the metrics, but the source
  // object is `estimates` (not a scored metric) and there is no HeaderFeature
  // (the duration/difficulty/MB chip row is the header, rendered by EvaluationView).
  // Degrades to the joined estimates.explanation (route.js joinProse) for sparse
  // cases and older saved analyses, exactly like the metric surfaces.
  execution_reality: [
    { q: "What's the binding constraint here?", field: "constraint_diagnosis" },
    { q: "What does clearing it actually take?", field: "commitment_explanation" },
    { q: "How does your background change the work?", field: "profile_calibration" },
    { q: "Why this timeline and difficulty?", field: "position_basis" },
  ],
};

const hasText = (v) => typeof v === "string" && v.trim().length > 0;

// ================================================================ feature blocks
function MdLadder({ metric, color, t }) {
  const name = metric && metric._internal && metric._internal.demand_archetype;
  const a = name ? MD_ARCHETYPES[name] : null;
  if (!a) return null; // degrade: no ladder, just pill + prose
  const segs = [];
  for (let i = 1; i <= MD_LADDER_TIERS; i++) {
    segs.push(
      <div key={i} style={{ flex: 1, height: 6, borderRadius: 2, background: i < a.tier ? t.sec : i === a.tier ? t.text : t.barBg }} />
    );
  }
  return (
    <div style={{ border: `1px solid ${t.border}`, borderRadius: 10, padding: "14px 16px", marginBottom: 22 }}>
      <div style={{ fontSize: 11, color: t.mut, letterSpacing: "0.3px", marginBottom: 9 }}>Demand type</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{a.label}</span>
        <span style={{ fontSize: 11, color: t.mut }}>tier {a.tier} of {MD_LADDER_TIERS}</span>
      </div>
      <div style={{ display: "flex", gap: 4 }}>{segs}</div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 7 }}>
        <span style={{ fontSize: 11, color: t.mut }}>speculative</span>
        <span style={{ fontSize: 11, color: t.mut }}>demonstrated pull</span>
      </div>
    </div>
  );
}

function MoFinerScore({ metric, color, t }) {
  const coarse = metric.score;
  const display = metric.display_score;
  const moved = typeof display === "number" && display !== coarse;
  const arch = metric && metric._internal && metric._internal.monetization_archetype;
  const label = arch ? (MO_ARCHETYPES[arch] || humanise(arch)) : null;
  // always-on NAME (capture case) + conditional NUMBER (movement, folded in).
  // degrade: if neither the archetype nor a movement exists, show nothing.
  if (!label && !moved) return null;
  return (
    <div style={{ border: `1px solid ${t.border}`, borderRadius: 10, padding: "14px 16px", marginBottom: 22 }}>
      {label && (
        <>
          <div style={{ fontSize: 11, color: t.mut, letterSpacing: "0.3px", marginBottom: 5 }}>Capture case</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: moved ? 12 : 0 }}>{label}</div>
        </>
      )}
      {label && moved && <div style={{ height: 1, background: t.divider, marginBottom: 12 }} />}
      {moved && (
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 13, color: t.mut, fontFamily: "monospace", textDecoration: "line-through" }}>{coarse.toFixed(1)}</span>
            <span style={{ fontSize: 13, color: t.mut }}>→</span>
            <span style={{ fontSize: 22, fontWeight: 600, color: t.text, fontFamily: "monospace" }}>{display.toFixed(1)}</span>
          </div>
          <div style={{ flex: 1, minWidth: 200, fontSize: 11, color: t.mut, lineHeight: 1.5 }}>
            {label
              ? "Within-tier refinement — the decimal moves within the verdict, never across it."
              : `The precise within-tier value, shown when the evidence and arithmetic agree. Falls back to the round tier anchor (${coarse.toFixed(1)}) otherwise — so the decimal moves within a verdict, never across it.`}
          </div>
        </div>
      )}
    </div>
  );
}

function OrExposure({ metric, color, t }) {
  const bc = metric && metric._internal && metric._internal.binding_constraint;
  const sub = bc && bc.primary_subtype;
  if (!hasText(sub)) return null; // degrade
  const phrase = OR_EXPOSURE_LABELS[sub] || humanise(sub);
  return (
    <div style={{ border: `1px solid ${t.border}`, borderRadius: 10, padding: "14px 16px", marginBottom: 22 }}>
      <div style={{ fontSize: 11, color: t.mut, letterSpacing: "0.3px", marginBottom: 5 }}>Primary exposure</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.mut} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden="true">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        <span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{phrase}</span>
      </div>
    </div>
  );
}

function HeaderFeature({ metricKey, metric, color, t }) {
  if (metricKey === "market_demand") return <MdLadder metric={metric} color={color} t={t} />;
  if (metricKey === "monetization") return <MoFinerScore metric={metric} color={color} t={t} />;
  if (metricKey === "originality") return <OrExposure metric={metric} color={color} t={t} />;
  return null;
}

// ============================================================== shared prose body
// Header feature (ladder / capture-case / exposure) + the labelled question→answer
// split, degrading to the single joined paragraph when raw fields are absent.
// No score header — each caller supplies its own (the evaluation view uses the
// pill header; the comparison view uses its A/B score + delta header). Shared so
// the two surfaces render metric prose identically and can't drift apart.
export function MetricProseBody({ metricKey, metric, notes = [], t }) {
  const set = QUESTION_SETS[metricKey];
  const canSplit = set && set.every(({ field }) => hasText(metric[field]));

  return (
    <>
      <HeaderFeature metricKey={metricKey} metric={metric} color={null} t={t} />

      {canSplit ? (
        set.map(({ q, field }, i) => (
          <div key={field} style={{ marginBottom: i === set.length - 1 ? 0 : 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7 }}>
              <span style={{ fontSize: 13, color: t.mut, lineHeight: 1 }} aria-hidden="true">→</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{q}</span>
            </div>
            <p style={{ fontSize: 13.5, lineHeight: 1.65, color: t.sec, margin: 0 }}>{metric[field]}</p>
          </div>
        ))
      ) : (
        // degrade: raw fields missing -> the single joined paragraph, as before
        <p style={{ fontSize: 13, color: t.sec, lineHeight: 1.65, margin: 0 }}>{metric.explanation}</p>
      )}

      {notes && notes.filter(Boolean).map((note, i) => (
        <p key={i} style={{ fontSize: 12, color: t.mut, marginTop: 8, lineHeight: 1.4, fontStyle: "italic" }}>{note}</p>
      ))}
    </>
  );
}

// ============================================================== main component
export default function MetricProseDetail({ metricKey, metric, name, weight, notes = [], isGated = false, competitors = null, t }) {
  const coarse = metric.score;
  const shownScore = metricKey === "monetization" && typeof metric.display_score === "number"
    ? metric.display_score
    : coarse;
  // Fork 5 = B: colour encodes metric IDENTITY (MD green / MO blue / OR purple),
  // not the score band. The score is carried by the number in the pill, never
  // re-encoded as red. metricColor falls back to a neutral token for any key
  // without an identity colour, so execution_reality / unknown keys stay calm.
  const color = metricColor(metricKey, t) || getScoreColor(shownScore);

  const header = (
    <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
      <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: t.text }}>{name}</h3>
      <span style={{ padding: "2px 8px", background: `${color}1A`, borderRadius: 100, fontSize: 11, color, fontWeight: 600, fontFamily: "monospace" }}>
        {shownScore.toFixed(1)}/10
      </span>
      {weight && <span style={{ fontSize: 11, color: t.mut }}>{weight}</span>}
    </div>
  );

  // gated free-preview: header pill only (matches prior behaviour)
  if (isGated) return header;

  return (
    <>
      {header}
      <MetricProseBody metricKey={metricKey} metric={metric} notes={notes} t={t} />
      <SourcesStrip internal={metric._internal} competitors={competitors} t={t} />
    </>
  );
}