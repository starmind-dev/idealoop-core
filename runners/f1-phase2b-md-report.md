# F1 Phase 2B — MD Loosening Test (Reverse Direction)

**Hypothesis:** Removing MD's anti-inflation caps + fuzzifying MD's band descriptors causes MD to become bimodal — proving the structural mechanism in the reverse direction.

Counterfactual prompt: MD cap-clauses removed, bands replaced with fuzzy adjectives (matching production MO's structure). Everything else byte-identical.
Production sampler retained: `temperature=0` only.
Reruns per case: 10

## Production baseline (n=10, original Phase B)
All cases listed below were observed at σ(MD)=0, σ(MO)=0, σ(OR)=0 — i.e. fully zero-variance under production prompt.

## Counterfactual results

| Case | σ(MD) | σ(MO) | σ(OR) | Unique MD scores |
|---|---|---|---|---|
| AUDIT-H4 | 0.000 | 0.000 | 0.000 | [6.5] |
| AUDIT-MD1 | 0.000 | 0.000 | 0.000 | [5.5] |
| AUDIT-MAT1-intermediate | 0.000 | 0.000 | 0.000 | [6] |
| AUDIT-A2 | 0.000 | 0.000 | 0.000 | [4.5] |

## Score arrays per case (counterfactual)

| Case | MD | MO | OR |
|---|---|---|---|
| AUDIT-H4 | 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5 | 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5 | 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5 |
| AUDIT-MD1 | 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5 | 4, 4, 4, 4, 4, 4, 4, 4, 4, 4 | 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5 |
| AUDIT-MAT1-intermediate | 6, 6, 6, 6, 6, 6, 6, 6, 6, 6 | 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5 | 4, 4, 4, 4, 4, 4, 4, 4, 4, 4 |
| AUDIT-A2 | 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5 | 5, 5, 5, 5, 5, 5, 5, 5, 5, 5 | 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5 |

## Verdict

**MECHANISM NOT REPLICATED IN REVERSE.** No cases became bimodal under loose MD. This is unexpected — interpretation: either the cap-clauses don't drive MD's stability (something else does), or these test cases have unambiguous-enough evidence that structural anchors don't matter for them. Re-examine.

## Reasoning text spot-check (first 2 reruns per case)

### AUDIT-H4
**Run 1** (MD=6.5 MO=5.5 OR=4.5):
> MD: Score 6.5, rubric level 5-6 — moderate, evident demand. Subcontractors spend 4-8 hours per bid in a recurring 3-10 weekly workflow, indicating genuine time burden. However, trust barriers exist as bidding accuracy directly impacts business survival, creating adoption friction that moderates the demand signal.

**Run 2** (MD=6.5 MO=5.5 OR=4.5):
> MD: Score 6.5, rubric level 5-6 — moderate, evident demand. Subcontractors spend 4-8 hours per bid in a recurring 3-10 weekly workflow, indicating genuine time burden. However, trust barriers exist as bidding accuracy directly impacts business survival, creating adoption friction that moderates the demand signal.

### AUDIT-MD1
**Run 1** (MD=5.5 MO=4 OR=4.5):
> MD: Score 5.5, rubric level 5-6 — moderate, evident demand. Manual spreadsheet workflows are widespread among freelancers and Invoice Payment Tracker's 500+ waitlist signups indicate active demand for payment automation solutions. However, trust barriers exist as freelancers must share sensitive client and financial data with new platforms, and switching costs from existing workflows require data migration and habit change.

**Run 2** (MD=5.5 MO=4 OR=4.5):
> MD: Score 5.5, rubric level 5-6 — moderate, evident demand. Manual spreadsheet workflows are widespread among freelancers and Invoice Payment Tracker's 500+ waitlist signups indicate active demand for payment automation solutions. However, trust barriers exist as freelancers must share sensitive client and financial data with new platforms, and switching costs from existing workflows require data migration and habit change.

### AUDIT-MAT1-intermediate
**Run 1** (MD=6 MO=5.5 OR=4):
> MD: Score 6.0, rubric level 5-6 — moderate, evident demand. Small law firms currently use manual document workflows with high error potential, indicating real demand for automation. However, the high-trust domain flag reveals significant adoption barriers, as legal document generation affects attorney-client relationships and compliance. The evidence shows demand exists but trust barriers moderate the urgency.

**Run 2** (MD=6 MO=5.5 OR=4):
> MD: Score 6.0, rubric level 5-6 — moderate, evident demand. Small law firms currently use manual document workflows with high error potential, indicating real demand for automation. However, the high-trust domain flag reveals significant adoption barriers, as legal document generation affects attorney-client relationships and compliance. The evidence shows demand exists but trust barriers moderate the urgency.

### AUDIT-A2
**Run 1** (MD=4.5 MO=5 OR=3.5):
> MD: Score 4.5, rubric level 3-4 — niche, weak demand. While Angi has weak suburban coverage indicating some unmet demand, the marketplace requires relationship displacement as seniors typically rely on word-of-mouth referrals and established local handymen. The user did not specify adoption triggers that would cause seniors to actively seek a new platform over their current methods.

**Run 2** (MD=4.5 MO=5 OR=3.5):
> MD: Score 4.5, rubric level 3-4 — niche, weak demand. While Angi has weak suburban coverage indicating some unmet demand, the marketplace requires relationship displacement as seniors typically rely on word-of-mouth referrals and established local handymen. The user did not specify adoption triggers that would cause seniors to actively seek a new platform over their current methods.
