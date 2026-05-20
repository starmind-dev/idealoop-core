// ============================================================================
// stage2b-qc-orchestrator.js — V4S32 Layer
// ============================================================================
//
// Orchestrates the prosecutor + repair quality-control layer between Stage 2b
// and Stage 2c. Pure orchestration — no prompt content lives here, no HTTP
// client lives here. Receives a `callAnthropicSonnet` function injected by the
// route handler so this module stays infrastructure-agnostic.
//
// What this module does:
//   1. Evaluate triggers per metric (md/mo/or)
//   2. Parallel prosecutor calls for metrics whose triggers fired
//   3. Parallel repair calls for metrics whose prosecutor returned FAIL
//   4. Parallel re-prosecution of repaired outputs
//   5. Merge results into ev with quality_control metadata per metric
//   6. Compute payload-level quality_control_summary
//   7. Return updated ev + qc_events for Supabase logging
//
// What this module does NOT do:
//   - Strip quality_control before Stage 2c (caller's responsibility)
//   - Restore quality_control at final payload assembly (caller's responsibility)
//   - Call Supabase (caller's responsibility — qc_events returned for logging)
//   - SSE events (caller's responsibility — frontend coordination)
//
// Feature flag:
//   STAGE2B_QC_MODE = 'off' | 'log_only' | 'repair'
//   - off:       returns ev unchanged, qc_events empty, summary marked disabled
//   - log_only:  runs prosecutor, logs verdicts, does NOT repair, does NOT mutate ev
//   - repair:    full production behavior
//
// Boundary rule (matches V4S31 score_adjudication pattern):
//   Stage 2c never sees quality_control metadata. Strip before stringifying
//   for Stage 2c input. Restore at final assembly so the frontend payload
//   includes it.
// ============================================================================

import {
  PROSECUTOR_SYSTEM_PROMPT,
  buildProsecutorUserMessage,
  parseProsecutorResponse,
  PROSECUTOR_PROMPT_VERSION,
} from "./prompt-stage2b-prosecutor.js";
import {
  REPAIR_SYSTEM_PROMPT,
  buildRepairUserMessage,
  parseRepairResponse,
  REPAIR_PROMPT_VERSION,
} from "./prompt-stage2b-repair.js";
import { evaluateAllTriggers } from "./stage2b-qc-triggers.js";

const QC_LAYER_VERSION = "v1.0";
const METRIC_TO_PACKET_KEY = {
  md: "market_demand",
  mo: "monetization",
  or: "originality",
};

/**
 * Main entry point. Run the QC layer over a Stage 2b ev.
 *
 * @param {object} args
 * @param {object} args.ev                  Stage 2b output (will not be mutated)
 * @param {object} args.evidencePackets     Stage 2a evidence_packets
 * @param {Function} args.callSonnet        async (systemPrompt, userMessage) => rawText
 * @param {string} args.evaluationId        For logging correlation
 * @param {string} [args.qcMode]            'off' | 'log_only' | 'repair'
 *                                          Defaults to env STAGE2B_QC_MODE or 'repair'
 * @returns {Promise<{
 *   ev: object,
 *   qc_events: Array<object>,
 *   quality_control_summary: object
 * }>}
 */
export async function runStage2bQualityControl({
  ev,
  evidencePackets,
  callSonnet,
  evaluationId,
  qcMode,
}) {
  const mode = qcMode || process.env.STAGE2B_QC_MODE || "repair";

  // --------------------------------------------------------------------------
  // Mode: off — bypass entirely
  // --------------------------------------------------------------------------
  if (mode === "off") {
    return {
      ev,
      qc_events: [],
      quality_control_summary: {
        qc_layer_version: QC_LAYER_VERSION,
        qc_mode: "off",
        checked_metrics: 0,
        repaired_metrics: 0,
        borderline_metrics: 0,
        double_fail_metrics: 0,
        qc_unavailable_metrics: 0,
        total_qc_latency_ms: 0,
      },
    };
  }

  const t0 = Date.now();

  // --------------------------------------------------------------------------
  // Phase 1: trigger evaluation (sync, instant)
  // --------------------------------------------------------------------------
 const triggers = evaluateAllTriggers(ev);

// V4S32 — optional trigger-evaluation diagnostic.
// Off by default in production. Set DEBUG_V4S32_TRIGGERS=1 in env to enable.
// Useful when investigating "why didn't the QC layer fire" without grepping
// Supabase. Costs nothing when disabled.
if (process.env.DEBUG_V4S32_TRIGGERS) {
  console.log(`[V4S32] mode=${mode} triggers:`, {
    md: { fire: triggers.md.shouldProsecute, reasons: triggers.md.triggers_fired },
    mo: { fire: triggers.mo.shouldProsecute, reasons: triggers.mo.triggers_fired },
    or: { fire: triggers.or.shouldProsecute, reasons: triggers.or.triggers_fired },
  });
}

  // --------------------------------------------------------------------------
  // Phase 2: parallel prosecutor calls (only for metrics whose triggers fired)
  // --------------------------------------------------------------------------
  const metrics = ["md", "mo", "or"];
  const prosecutorResults = await Promise.all(
    metrics.map(async (m) => {
      const trig = triggers[m];
      if (!trig.shouldProsecute) {
        return { metric: m, status: "skipped", trig };
      }
      const metricKey = METRIC_TO_PACKET_KEY[m];
      const metricObj = ev[metricKey] || {};
      const packet = evidencePackets[metricKey];

      const pT0 = Date.now();
      try {
        const userMessage = buildProsecutorUserMessage({
          metric: m,
          packet,
          adjudication: metricObj.score_adjudication,
          score: metricObj.score,
          explanation: metricObj.explanation,
        });
        const rawText = await callSonnet(PROSECUTOR_SYSTEM_PROMPT, userMessage);
        const parsed = parseProsecutorResponse(rawText);
        return {
          metric: m,
          status: "called",
          trig,
          parsed,
          latency_ms: Date.now() - pT0,
        };
      } catch (err) {
        return {
          metric: m,
          status: "qc_unavailable",
          trig,
          error: err.message || String(err),
          latency_ms: Date.now() - pT0,
        };
      }
    })
  );

  // --------------------------------------------------------------------------
  // Phase 3: parallel repair calls (only in 'repair' mode, only for FAILs)
  // --------------------------------------------------------------------------
  let repairResults = [];
  let reProsecutions = [];

  if (mode === "repair") {
    const failsToRepair = prosecutorResults
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => r.status === "called" && r.parsed && r.parsed.verdict === "FAIL");

    repairResults = await Promise.all(
      failsToRepair.map(async ({ r }) => {
        const m = r.metric;
        const metricKey = METRIC_TO_PACKET_KEY[m];
        const metricObj = ev[metricKey] || {};
        const packet = evidencePackets[metricKey];

        const rT0 = Date.now();
        try {
          const userMessage = buildRepairUserMessage({
            metric: m,
            packet,
            originalAdjudication: metricObj.score_adjudication,
            originalScore: metricObj.score,
            originalExplanation: metricObj.explanation,
            prosecutorFinding: r.parsed,
          });
          const rawText = await callSonnet(REPAIR_SYSTEM_PROMPT, userMessage);
          const parsed = parseRepairResponse(rawText);
          return {
            metric: m,
            status: parsed.ok ? "repaired" : "repair_failed",
            parsed,
            error: parsed.ok ? null : parsed.error,
            latency_ms: Date.now() - rT0,
          };
        } catch (err) {
          return {
            metric: m,
            status: "repair_failed",
            parsed: null,
            error: err.message || String(err),
            latency_ms: Date.now() - rT0,
          };
        }
      })
    );

    // ------------------------------------------------------------------------
    // Phase 4: parallel re-prosecution of successful repairs
    // ------------------------------------------------------------------------
    const successfulRepairs = repairResults.filter((r) => r.status === "repaired");

    reProsecutions = await Promise.all(
      successfulRepairs.map(async (rep) => {
        const m = rep.metric;
        const metricKey = METRIC_TO_PACKET_KEY[m];
        const packet = evidencePackets[metricKey];

        const rpT0 = Date.now();
        try {
          const userMessage = buildProsecutorUserMessage({
            metric: m,
            packet,
            adjudication: rep.parsed.score_adjudication,
            score: rep.parsed.score,
            explanation: rep.parsed.explanation,
          });
          const rawText = await callSonnet(PROSECUTOR_SYSTEM_PROMPT, userMessage);
          const parsed = parseProsecutorResponse(rawText);
          return {
            metric: m,
            verdict: parsed.verdict,
            parsed,
            latency_ms: Date.now() - rpT0,
          };
        } catch (err) {
          return {
            metric: m,
            verdict: "REPROSECUTION_UNAVAILABLE",
            error: err.message || String(err),
            latency_ms: Date.now() - rpT0,
          };
        }
      })
    );
  }

  // --------------------------------------------------------------------------
  // Phase 5: merge per-metric quality_control metadata + decide ev updates
  // --------------------------------------------------------------------------
  const updatedEv = deepClone(ev);
  const qc_events = [];

  let checked_metrics = 0;
  let repaired_metrics = 0;
  let borderline_metrics = 0;
  let double_fail_metrics = 0;
  let qc_unavailable_metrics = 0;

  for (const proseRes of prosecutorResults) {
    const m = proseRes.metric;
    const metricKey = METRIC_TO_PACKET_KEY[m];
    const metricObj = updatedEv[metricKey] || {};

    // Helpers
    const baseQc = {
      qc_layer_version: QC_LAYER_VERSION,
      qc_mode: mode,
      prosecutor_prompt_version: PROSECUTOR_PROMPT_VERSION,
      repair_prompt_version: REPAIR_PROMPT_VERSION,
      triggers_fired: proseRes.trig.triggers_fired,
      mid_band_anchor_risk_detected: proseRes.trig.mid_band_anchor_risk_detected,
      flaw_category: null,
      repair_attempted: false,
      repair_succeeded: false,
      original_score: null,
      close_call_framing: null,
      prosecutor_latency_ms: proseRes.latency_ms || 0,
      repair_latency_ms: null,
      reprosecution_latency_ms: null,
    };

    // ------- Case A: prosecutor was not called (no trigger fired) -------
    if (proseRes.status === "skipped") {
      metricObj.quality_control = {
        ...baseQc,
        prosecutor_verdict: "SKIPPED_NO_TRIGGER",
      };
      updatedEv[metricKey] = metricObj;
      continue;
    }

    // ------- Case B: prosecutor call failed technically -------
    if (proseRes.status === "qc_unavailable" || (proseRes.parsed && proseRes.parsed.verdict === "PARSE_ERROR")) {
      qc_unavailable_metrics += 1;
      const errDetail = proseRes.error || (proseRes.parsed && proseRes.parsed.fatal_flaw) || "unknown";
      metricObj.quality_control = {
        ...baseQc,
        prosecutor_verdict: "QC_UNAVAILABLE",
        qc_error: errDetail,
      };
      updatedEv[metricKey] = metricObj;
      qc_events.push(buildQcEvent({ evaluationId, metric: m, originalEv: ev, mode, proseRes }));
      continue;
    }

    // From here on prosecutor returned a real verdict
    checked_metrics += 1;
    const verdict = proseRes.parsed.verdict;

    // ------- Case C: PASS -------
    if (verdict === "PASS") {
      metricObj.quality_control = {
        ...baseQc,
        prosecutor_verdict: "PASS",
      };
      updatedEv[metricKey] = metricObj;
      continue;
    }

    // ------- Case D: BORDERLINE -------
    if (verdict === "BORDERLINE") {
      borderline_metrics += 1;
      metricObj.quality_control = {
        ...baseQc,
        prosecutor_verdict: "BORDERLINE",
        flaw_category: proseRes.parsed.flaw_category || null,
        close_call_framing: proseRes.parsed.alternative_reading || null,
      };
      updatedEv[metricKey] = metricObj;
      qc_events.push(
        buildQcEvent({ evaluationId, metric: m, originalEv: ev, mode, proseRes })
      );
      continue;
    }

    // ------- Case E: FAIL -------
    if (verdict === "FAIL") {
      // In log_only mode: log the FAIL, do NOT repair, do NOT mutate ev
      if (mode === "log_only") {
        metricObj.quality_control = {
          ...baseQc,
          prosecutor_verdict: "PASS", // mode hides the FAIL from downstream
          _log_only_verdict: "FAIL",
          flaw_category: proseRes.parsed.flaw_category || null,
        };
        updatedEv[metricKey] = metricObj;
        qc_events.push(
          buildQcEvent({ evaluationId, metric: m, originalEv: ev, mode, proseRes })
        );
        continue;
      }

      // In repair mode: find the repair + re-prosecution for this metric
      const rep = repairResults.find((r) => r.metric === m);
      const rePros = reProsecutions.find((r) => r.metric === m);

      // Repair call itself failed (timeout, parse, etc) → DOUBLE_FAIL category,
      // keep original ev unchanged.
      if (!rep || rep.status !== "repaired") {
        double_fail_metrics += 1;
        metricObj.quality_control = {
          ...baseQc,
          prosecutor_verdict: "DOUBLE_FAIL",
          flaw_category: proseRes.parsed.flaw_category || null,
          repair_attempted: true,
          repair_succeeded: false,
          repair_latency_ms: rep ? rep.latency_ms : null,
          qc_error: rep ? rep.error : "repair_not_attempted",
        };
        updatedEv[metricKey] = metricObj;
        qc_events.push(
          buildQcEvent({
            evaluationId,
            metric: m,
            originalEv: ev,
            mode,
            proseRes,
            repairResult: rep,
            reProsecutionResult: rePros,
          })
        );
        continue;
      }

      // Re-prosecution returned PASS or BORDERLINE → FAIL_REPAIRED, mutate ev
      if (rePros && (rePros.verdict === "PASS" || rePros.verdict === "BORDERLINE")) {
        repaired_metrics += 1;
        const originalScore = metricObj.score;
        // Apply the repair
        metricObj.score = rep.parsed.score;
        metricObj.explanation = rep.parsed.explanation;
        metricObj.score_adjudication = rep.parsed.score_adjudication;
        metricObj.quality_control = {
          ...baseQc,
          prosecutor_verdict: "FAIL_REPAIRED",
          flaw_category: proseRes.parsed.flaw_category || null,
          repair_attempted: true,
          repair_succeeded: true,
          original_score: originalScore,
          repair_latency_ms: rep.latency_ms,
          reprosecution_latency_ms: rePros.latency_ms,
          close_call_framing:
            rePros.verdict === "BORDERLINE"
              ? rePros.parsed && rePros.parsed.alternative_reading
              : null,
        };
        updatedEv[metricKey] = metricObj;
        qc_events.push(
          buildQcEvent({
            evaluationId,
            metric: m,
            originalEv: ev,
            mode,
            proseRes,
            repairResult: rep,
            reProsecutionResult: rePros,
          })
        );
        continue;
      }

      // Re-prosecution also returned FAIL (or was unavailable) → DOUBLE_FAIL,
      // keep original ev unchanged.
      double_fail_metrics += 1;
      metricObj.quality_control = {
        ...baseQc,
        prosecutor_verdict: "DOUBLE_FAIL",
        flaw_category: proseRes.parsed.flaw_category || null,
        repair_attempted: true,
        repair_succeeded: false,
        repair_latency_ms: rep.latency_ms,
        reprosecution_latency_ms: rePros ? rePros.latency_ms : null,
        qc_error: rePros
          ? `reprosecution_verdict=${rePros.verdict}`
          : "reprosecution_not_attempted",
      };
      updatedEv[metricKey] = metricObj;
      qc_events.push(
        buildQcEvent({
          evaluationId,
          metric: m,
          originalEv: ev,
          mode,
          proseRes,
          repairResult: rep,
          reProsecutionResult: rePros,
        })
      );
    }
  }

  // --------------------------------------------------------------------------
  // Phase 6: payload-level summary + quality_failure flag
  // --------------------------------------------------------------------------
  const summary = {
    qc_layer_version: QC_LAYER_VERSION,
    qc_mode: mode,
    checked_metrics,
    repaired_metrics,
    borderline_metrics,
    double_fail_metrics,
    qc_unavailable_metrics,
    total_qc_latency_ms: Date.now() - t0,
    // Per locked decision: 2-of-3 DOUBLE_FAIL flags the whole evaluation
    quality_failure: double_fail_metrics >= 2,
  };

  return { ev: updatedEv, qc_events, quality_control_summary: summary };
}

// ============================================================================
// Strip / restore helpers — Stage 2c boundary discipline
// ============================================================================

/**
 * Remove `quality_control` from each metric on ev before stringifying for
 * Stage 2c. Matches V4S31 pattern for score_adjudication stripping.
 * Returns a NEW object — does not mutate input.
 */
export function stripQualityControlForStage2c(ev) {
  const stripped = deepClone(ev);
  for (const metricKey of ["market_demand", "monetization", "originality"]) {
    if (stripped[metricKey] && stripped[metricKey].quality_control) {
      delete stripped[metricKey].quality_control;
    }
  }
  return stripped;
}

/**
 * Restore `quality_control` from the post-QC ev back onto the final assembly
 * payload (Stage 2c may have produced its own fields but quality_control
 * lives on the ev metrics).
 */
export function restoreQualityControl(targetEv, postQcEv) {
  for (const metricKey of ["market_demand", "monetization", "originality"]) {
    const qc = postQcEv && postQcEv[metricKey] && postQcEv[metricKey].quality_control;
    if (qc && targetEv[metricKey]) {
      targetEv[metricKey].quality_control = qc;
    }
  }
  return targetEv;
}

// ============================================================================
// Internal helpers
// ============================================================================

function deepClone(o) {
  return JSON.parse(JSON.stringify(o));
}

function buildQcEvent({
  evaluationId,
  metric,
  originalEv,
  mode,
  proseRes,
  repairResult,
  reProsecutionResult,
}) {
  const metricKey = METRIC_TO_PACKET_KEY[metric];
  const originalMetric = (originalEv && originalEv[metricKey]) || {};
  const verdict = (proseRes.parsed && proseRes.parsed.verdict) || proseRes.status;

  return {
    evaluation_id: evaluationId,
    metric,
    qc_mode: mode,
    prosecutor_prompt_version: PROSECUTOR_PROMPT_VERSION,
    repair_prompt_version: REPAIR_PROMPT_VERSION,
    triggers_fired: proseRes.trig ? proseRes.trig.triggers_fired : [],
    mid_band_anchor_risk_detected: proseRes.trig
      ? proseRes.trig.mid_band_anchor_risk_detected
      : false,

    prosecutor_verdict: verdict,
    flaw_category: (proseRes.parsed && proseRes.parsed.flaw_category) || null,
    fatal_flaw: (proseRes.parsed && proseRes.parsed.fatal_flaw) || null,
    invalid_anchor_cited: (proseRes.parsed && proseRes.parsed.invalid_anchor_used) || null,
    omitted_packet_fact: (proseRes.parsed && proseRes.parsed.omitted_packet_fact) || null,
    recommended_action: (proseRes.parsed && proseRes.parsed.recommended_action) || null,

    original_score: originalMetric.score ?? null,
    original_explanation: originalMetric.explanation ?? null,
    final_score:
      repairResult && repairResult.parsed && repairResult.parsed.ok
        ? repairResult.parsed.score
        : originalMetric.score ?? null,
    repaired_explanation:
      repairResult && repairResult.parsed && repairResult.parsed.ok
        ? repairResult.parsed.explanation
        : null,

    reprosecution_verdict: reProsecutionResult ? reProsecutionResult.verdict : null,
    reprosecution_flaw:
      reProsecutionResult && reProsecutionResult.parsed
        ? reProsecutionResult.parsed.flaw_category
        : null,

    prosecutor_latency_ms: proseRes.latency_ms || null,
    repair_latency_ms: repairResult ? repairResult.latency_ms : null,
    reprosecution_latency_ms: reProsecutionResult ? reProsecutionResult.latency_ms : null,

    qc_error:
      proseRes.error ||
      (repairResult && repairResult.error) ||
      (reProsecutionResult && reProsecutionResult.error) ||
      null,

    timestamp: new Date().toISOString(),
  };
}
