# IdeaLoop Core — B10a Launch Gate Summary

Generated: 2026-05-10T19:17:34.349Z

**Overall verdict:** B10A_FAIL


## Gate roll-up

**Hard gates:** 15 PASS · 7 FAIL · 1 INCONCLUSIVE / 23 total
**Soft gates:** 3 PASS · 0 FAIL · 3 OBSERVE / 6 total


## Hard gate details

| Gate | Result | Detail |
|---|---|---|
| G_PIPELINE_COMPLETION | ✅ PASS | {"totalRuns":97,"failures":0,"failureIds":[]} |
| G_PARSE_NO_FAILURE | ✅ PASS | {"parseErrors":0,"ids":[]} |
| G_REQUIRED_SECTIONS_PRESENT | ❌ FAIL | {"failedRuns":1,"examples":[{"id":"AUDIT-M1__run3","missing":["summary","failureRisks"]}]} |
| G_GATE_A1_PASS | ✅ PASS | {"runs":2,"gated":0} |
| G_GATE_B1_FAIL | ✅ PASS | {"runs":2,"leakedThroughGate":0,"note":"SP1 should gate (Haiku specificity_insufficient: true). If it passes, V8.1 floor regressed."} |
| G_GATE_D2_PASS | ✅ PASS | {"runs":2,"gated":0,"note":"Collapse-pattern rescue should silently rescue. If it gates, v3 rescue layer regressed."} |
| G_TC_MAT1 | ✅ PASS | {"tc":{"beg":7.5,"int":7,"sen":6},"canonical":{"beginner":7.5,"intermediate":7,"senior":6},"spread":1.5,"monotonic":true,"inTolerance":true,"v9_1_trigger":false,"note":"TC matrix profile-aware scoring |
| G_ALPHA_ARITHMETIC | ✅ PASS | {"totalChecked":77,"failed":0,"examples":[]} |
| G_FREE_THIN_DIMENSIONS | ⚠️ INCONCLUSIVE | {"reason":"expected LOW but got HIGH","evLevel":"HIGH"} |
| G_OPTION_Z_MEDIUM | ❌ FAIL | {"evLevel":"HIGH","reason":"The $299/month pricing against VWO's $300+ benchmark and zero-code positioning versus developer-required competitors provide concrete evaluation anchors.","isMedium":false, |
| G_MAT3_NO_FABRICATION | ✅ PASS | {"totalChecked":2,"violations":0,"examples":[]} |
| G_SPARSE_NO_IMAGINATION | ✅ PASS | {"reason":"all SP1 runs gated upstream — no fabrication possible","runs":2} |
| G_MB_REACHABILITY | ✅ PASS | {"fired":["Trust/credibility","Technical build","Distribution","Buyer access","Compliance","Data acquisition"],"enumValues":["Technical build","Buyer access","Trust/credibility","Compliance","Distribu |
| G_ARC_D_RISK3 | ✅ PASS | {"archetypeFired":"D","expected":"D","risk3Text":"This idea requires $1.4M in pre-revenue investment for hardware tooling, inventory, and EPA certification before any meaningful revenue validation, ex |
| G_ENUM_COMPLIANCE | ✅ PASS | {"violations":0,"examples":[]} |
| G_EVIDENCE_NO_NULL | ✅ PASS | {"violations":0,"examples":[]} |
| G_VARIANCE_EVIDENCE_NO_FLIP | ✅ PASS | {"violations":0,"examples":[],"note":"LOW ↔ HIGH flips are catastrophic. HIGH/MEDIUM flips tracked in S_BIMODALITY_RATE."} |
| G_VARIANCE_RISK3_ARCHETYPE | ❌ FAIL | {"violations":10,"examples":[{"caseId":"AUDIT-H3","run1":"B","run2":null},{"caseId":"AUDIT-B2","run1":"E","run2":null},{"caseId":"AUDIT-B3","run1":"A","run2":"B"},{"caseId":"AUDIT-R2","run1":"B","run2 |
| G_VARIANCE_MAIN_BOTTLENECK | ❌ FAIL | {"violations":16,"examples":[{"caseId":"AUDIT-L2","run1":"Trust/credibility","run2":"Distribution"},{"caseId":"AUDIT-A3","run1":"Compliance","run2":"Technical build"},{"caseId":"AUDIT-B2","run1":"Buye |
| G_VARIANCE_ALPHA | ❌ FAIL | {"violations":9,"examples":[{"caseId":"AUDIT-A2","run1":4.7,"run2":5.4,"delta":"0.70"},{"caseId":"AUDIT-A3","run1":5.9,"run2":5.5,"delta":"0.40"},{"caseId":"AUDIT-R1","run1":5.2,"run2":5.7,"delta":"0. |
| G_STAGE1_BLINDNESS | ❌ FAIL | {"profileLeaks":0,"competitorSetDiffs":7,"examples":[{"trio":"MAT1","profileA":"AUDIT-MAT1-beginner","profileB":"AUDIT-MAT1-senior","differingCompetitors":["manual document workflow","manual template  |
| G_STAGE_TC_PARSE | ✅ PASS | {"runs":2,"failed":0,"examples":[]} |
| G_TRADEOFFS_DELTA_GREP | ❌ FAIL | {"passed":null,"reason":"IDEALOOP_REPO_ROOT not set or path missing — static grep check skipped"} |

## Soft gate details

| Gate | Result | Detail |
|---|---|---|
| S_LAYERED_MB_COMPLIANCE | ✅ PASS | {"risk3Archetype":"D","mb":"Compliance","layeredCaseFired":true,"note":"Soft gate. Risk 3 = D firing is the hard test (G_ARC_D_RISK3 covers it for ARC-D1)."} |
| S_EVIDENCE_HIGH_MED_STABLE | 🔍 OBSERVE | {"triples":[{"caseId":"AUDIT-H2","levels":["HIGH","HIGH","HIGH"],"stable":true},{"caseId":"AUDIT-M1","levels":["HIGH","HIGH","MEDIUM"],"stable":false},{"caseId":"OPTZ-MED","levels":["HIGH","HIGH","HIG |
| S_TEMPLATE_LEAD_VARIATION | ✅ PASS | {"cases":["AUDIT-R1","AUDIT-R2","AUDIT-R3"],"leads":["Dentrix already offers digitized patient intake with mobile-...","AutogenAI already specializes in long-form proposal content ...","TaxExact alrea |
| S_OR_ACTIONABILITY_HOOK | 🔍 OBSERVE | {"totalChecked":37,"withHook":0,"hookRate":"0.00","examplesMissing":[{"caseId":"AUDIT-H1","excerpt":"Score 4.0, rubric level 3-4. Rialtes already provides AI solutions specifically for rare disease cl |
| S_BIMODALITY_RATE | ✅ PASS | {"pairs":40,"flips":5,"rate":"0.125","v4s27_baseline_rate":0.62,"interpretation":"P8-S2 fix landed cleanly (flip rate <15%)."} |
| S_DELTA_VS_V4S27 | 🔍 OBSERVE | {"note":"Comparison artifact emitted as delta_vs_v4s27.md for B10b consumption. Soft gate — informational only."} |

## Bank statistics

- Run 1: 47 calls (47 success, 7 gated, 0 error)
- Run 2: 47 calls (47 success, 7 gated, 0 error)
- Run 3 (tier-3 boundary triples): 3 calls

## Next steps (Phase 2)

1. Open `B10a-lens-review-template.md` and fill in V4S28 observations + diagnostic verdicts + escalations per case × lens.
2. For LAUNCH_BLOCKING findings: fix before launch. Re-run runner with `--resume`.
3. For B10B_REQUIRED findings: roll into B10b session.
4. For UI_PRODUCT_POLISH: defer to UI rework session.
5. For POST_LAUNCH_MONITORED: document and accept; track in real-user feedback.
6. For FALSE_ALARM: dismiss with rationale.

If overallVerdict is B10A_PASS and no LAUNCH_BLOCKING findings surface in Phase 2, the engine is ship-stable. Proceed to B10b.