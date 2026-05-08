# F1 Phase 2A — MO Tightening Test

**Hypothesis:** Replacing MO's fuzzy band descriptors with enumerable anchors eliminates MO bimodality.

Counterfactual prompt: MO commercial bands rewritten (decidable conditions per band, mirroring OR's structure). Everything else byte-identical to production.
Production sampler retained: `temperature=0` only.
Reruns per case: 10

## Result vs production baseline

| Case | σ(MD) prod → counterfactual | σ(MO) prod → counterfactual | σ(OR) prod → counterfactual | MO unique scores |
|---|---|---|---|---|
| AUDIT-L2 | 0.000 → 0.316 | 0.775 → 0.211 | 0.258 → 0.354 | [5.5,6] |
| ARC-D2 | 0.000 → 0.000 | 0.632 → 0.000 | 0.158 → 0.258 | [6] |
| AUDIT-M3 | 0.000 → 0.000 | 0.211 → 0.000 | 0.000 → 0.000 | [5.5] |

## Score arrays per case (counterfactual)

| Case | MD | MO | OR |
|---|---|---|---|
| AUDIT-L2 | 4.5, 4.5, 5.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5 | 6, 6, 6, 6, 6, 6, 6, 6, 5.5, 5.5 | 3.5, 3.5, 4.5, 4, 3.5, 3.5, 4, 4, 3.5, 3.5 |
| ARC-D2 | 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5 | 6, 6, 6, 6, 6, 6, 6, 6, 6, 6 | 4, 3.5, 3.5, 4, 4, 4, 3.5, 3.5, 4, 4 |
| AUDIT-M3 | 6, 6, 6, 6, 6, 6, 6, 6, 6, 6 | 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5 | 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5 |

## Verdict

**PARTIAL** — 2/3 bimodal cases resolved by tightening alone.
Some cases retained variance — investigate per-case explanations for remaining mechanism.

## Reasoning text spot-check (first 2 reruns per case)

### AUDIT-L2
**Run 1** (MD=4.5 MO=6 OR=3.5):
> MO: Score 6.0, rubric level 5-6. Wyzant operates with high commission rates as an established marketplace, demonstrating commission model viability in tutoring with identifiable buyers (parents) and comparable revenue mechanism. However, word-of-mouth referrals have no platform fees, creating direct pricing pressure against any commission-based model.

**Run 2** (MD=4.5 MO=6 OR=3.5):
> MO: Score 6.0, rubric level 5-6. Wyzant operates with high commission rates as an established marketplace, demonstrating commission model viability in tutoring with identifiable buyers (parents) and comparable revenue mechanism. However, word-of-mouth referrals have no platform fees, creating direct pricing pressure against any commission-based model.

### ARC-D2
**Run 1** (MD=5.5 MO=6 OR=4):
> MO: Score 6.0, rubric level 5-6. Aloan demonstrates that community banks will pay for AI commercial loan underwriting automation, providing clear willingness-to-pay evidence. The buyer (community banks $500M-$5B assets) is specified with a named comparable revenue mechanism. However, the $2.8M pre-revenue investment requirement and 18-month payment delay create structural monetization pressure before any revenue can be captured.

**Run 2** (MD=5.5 MO=6 OR=3.5):
> MO: Score 6.0, rubric level 5-6. Aloan demonstrates that community banks will pay for AI commercial loan underwriting automation, providing clear willingness-to-pay evidence. However, the $2.8M pre-revenue investment requirement and 18-month delay before any revenue significantly pressures the monetization timeline.

### AUDIT-M3
**Run 1** (MD=6 MO=5.5 OR=6.5):
> MO: Score 5.5, rubric level 5-6. AJE's professional editing service demonstrates willingness to pay for manuscript preparation in this market. However, ChatGPT provides free manuscript editing that academics already use, creating structural pricing pressure. The uncertainty around whether PhD students have budget authority for $29/month subscriptions versus requiring institutional purchasing adds monetization friction.

**Run 2** (MD=6 MO=5.5 OR=6.5):
> MO: Score 5.5, rubric level 5-6. AJE's professional editing service demonstrates willingness to pay for manuscript preparation in this market, and the $29/month student pricing is reasonable. However, ChatGPT's free manuscript editing assistance creates structural pricing pressure, and uncertainty about whether PhD students have budget authority versus requiring institutional purchasing limits monetization confidence.
