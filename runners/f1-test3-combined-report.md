# F1 Test 3 — Combined Sampler Hardening + MO Tightening

**Hypothesis:** Combining sampler hardening (Layer A cure) with MO band tightening (Layer B cure) eliminates bimodality across the full bank.

Sampler: `temperature=0, top_k=1, top_p=0.1`
Prompt: MO commercial bands rewritten with enumerable anchors, all else byte-identical to production.
Reruns per case: 10

**Fully zero-variance cases: 4 / 8**

## Result vs production baseline

| Case | σ(MD) prod → combined | σ(MO) prod → combined | σ(OR) prod → combined | Unique MO |
|---|---|---|---|---|
| AUDIT-H4 | 0.000 → 0.000 | 0.000 → 0.000 | 0.000 → 0.000 | [6] |
| AUDIT-MAT2-beginner | 0.000 → 0.211 | 0.316 → 0.615 | 0.316 → 0.632 | [4.5,5.5,6] |
| ARC-D2 | 0.000 → 0.000 | 0.632 → 0.000 | 0.158 → 0.258 | [6] |
| AUDIT-L2 | 0.000 → 0.316 | 0.775 → 0.158 | 0.258 → 0.316 | [5.5,6] |
| AUDIT-MD1 | 0.000 → 0.000 | 0.000 → 0.000 | 0.000 → 0.000 | [4.5] |
| AUDIT-MAT1-intermediate | 0.000 → 0.000 | 0.000 → 0.316 | 0.000 → 0.000 | [5.5,6.5] |
| AUDIT-M3 | 0.000 → 0.000 | 0.211 → 0.000 | 0.000 → 0.000 | [5.5] |
| AUDIT-A2 | 0.000 → 0.000 | 0.000 → 0.000 | 0.000 → 0.000 | [5.5] |

## Score arrays per case (combined cure)

| Case | MD | MO | OR |
|---|---|---|---|
| AUDIT-H4 | 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5 | 6, 6, 6, 6, 6, 6, 6, 6, 6, 6 | 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5 |
| AUDIT-MAT2-beginner | 5.5, 5.5, 5.5, 6, 5.5, 5.5, 5.5, 5.5, 5.5, 6 | 4.5, 4.5, 6, 5.5, 6, 6, 6, 6, 6, 5.5 | 6, 6, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5 |
| ARC-D2 | 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5 | 6, 6, 6, 6, 6, 6, 6, 6, 6, 6 | 4, 4, 4, 4, 3.5, 4, 3.5, 4, 3.5, 3.5 |
| AUDIT-L2 | 4.5, 4.5, 5.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5 | 6, 6, 6, 6, 5.5, 6, 6, 6, 6, 6 | 4, 4, 4.5, 4, 3.5, 4, 4, 3.5, 3.5, 4 |
| AUDIT-MD1 | 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5 | 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5 | 4, 4, 4, 4, 4, 4, 4, 4, 4, 4 |
| AUDIT-MAT1-intermediate | 6, 6, 6, 6, 6, 6, 6, 6, 6, 6 | 5.5, 5.5, 6.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5 | 4, 4, 4, 4, 4, 4, 4, 4, 4, 4 |
| AUDIT-M3 | 6, 6, 6, 6, 6, 6, 6, 6, 6, 6 | 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5 | 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5 |
| AUDIT-A2 | 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5 | 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5 | 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5 |

## Verdict

**PARTIAL.** 4/8 cases fully zero-variance.
Combined intervention insufficient for substantial portion of bank. Architectural cure (MO sidecar or full split) is the remaining option.

## Reasoning text spot-check (residual-variance cases only)

### AUDIT-MAT2-beginner
σ(MD)=0.211 σ(MO)=0.615 σ(OR)=0.632 · ρ(MO,OR)=-0.791

**Run 1** (MD=5.5 MO=4.5 OR=6):
> MO: Score 4.5, rubric level 3-4. The 25% success fee eliminates upfront cost barriers and only charges on recovered claims. However, monetization is structurally pressured because small businesses currently handle disputes at no additional cost through manual processes, and benefits brokers provide dispute assistance as part of existing relationships without separate fees. The typical dollar value of recoverable claims and acceptability of 25% fees versus free alternatives remains unresolved.

**Run 2** (MD=5.5 MO=4.5 OR=6):
> MO: Score 4.5, rubric level 3-4. The 25% success fee eliminates upfront barriers and aligns payment with outcomes. However, monetization faces structural pressure from free alternatives — manual processes cost nothing additional, and benefits brokers provide dispute assistance within existing relationship management without separate fees. Success depends on claim values being high enough to justify the fee versus free options.

### ARC-D2
σ(MD)=0.000 σ(MO)=0.000 σ(OR)=0.258 · ρ(MO,OR)=0.000

**Run 1** (MD=5.5 MO=6 OR=4):
> MO: Score 6.0, rubric level 5-6. Aloan demonstrates that community banks will pay for AI commercial loan underwriting automation, providing clear willingness-to-pay evidence. The buyer (community banks $500M-$5B assets) is identified with a comparable revenue mechanism. However, the $2.8M pre-revenue investment requirement and 18-month payment delay create structural monetization pressure.

**Run 2** (MD=5.5 MO=6 OR=4):
> MO: Score 6.0, rubric level 5-6. Aloan demonstrates that community banks will pay for AI commercial loan underwriting automation, providing clear willingness-to-pay evidence. However, the $2.8M pre-revenue investment requirement and 18-month delay before any revenue significantly pressures the monetization timeline.

### AUDIT-L2
σ(MD)=0.316 σ(MO)=0.158 σ(OR)=0.316 · ρ(MO,OR)=0.465

**Run 1** (MD=4.5 MO=6 OR=4):
> MO: Score 6.0, rubric level 5-6. Wyzant demonstrates commission model viability in tutoring marketplaces, and the 15% rate aligns with established marketplace economics. Clear buyer (parents) and transaction mechanism (hourly sessions) are specified. However, word-of-mouth referrals create direct pricing pressure as they have no platform fees, requiring value justification for the commission.

**Run 2** (MD=4.5 MO=6 OR=4):
> MO: Score 6.0, rubric level 5-6. Wyzant operates with high commission rates as an established marketplace, demonstrating commission model viability in tutoring with identifiable buyers (parents) and comparable revenue mechanism (15% commission). However, word-of-mouth referrals have no platform fees, creating direct pricing pressure against any commission-based model, limiting pricing power.

### AUDIT-MAT1-intermediate
σ(MD)=0.000 σ(MO)=0.316 σ(OR)=0.000 · ρ(MO,OR)=0.000

**Run 1** (MD=6 MO=5.5 OR=4):
> MO: Score 5.5, rubric level 5-6. Rally and Lawmatics demonstrate established payment willingness for document automation workflows, and the per-firm subscription model aligns with legal practice management norms. However, the evidence indicates small firms avoid existing solutions due to cost barriers, creating pricing pressure on the $299/month model, while medium LLM substitution risk adds structural monetization headwinds.

**Run 2** (MD=6 MO=5.5 OR=4):
> MO: Score 5.5, rubric level 5-6. Rally and Lawmatics demonstrate established payment willingness for legal document automation, and the $299/month per-firm model targets an identifiable buyer. However, the evidence indicates small firms avoid existing solutions due to cost barriers, suggesting price sensitivity that pressures the proposed pricing level.
