# F1 Test 5 — Sampler + Dominant-Signal Selection

**Hypothesis:** Adding dominant-signal-selection instruction to MO and OR (without rewriting MO bands) addresses the L2 frame-selection mechanism and the MAT2-beginner cross-metric swap.

Sampler: `temperature=0, top_k=1, top_p=0.1`
Prompt: production MO bands retained, dominant-signal blocks injected into MO and OR sections symmetrically.
Reruns per case: 10

## Result vs production AND Test 3 baselines

| Case | σ(MD) prod / T3 / T5 | σ(MO) prod / T3 / T5 | σ(OR) prod / T3 / T5 | ρ(MO,OR) T5 |
|---|---|---|---|---|
| AUDIT-L2 | 0.000 / 0.316 / **0.422** | 0.775 / 0.158 / **0.422** | 0.258 / 0.316 / **0.000** | 0.000 |
| AUDIT-MAT2-beginner | 0.000 / 0.211 / **0.211** | 0.316 / 0.615 / **0.408** | 0.316 / 0.632 / **0.675** | -0.492 |
| ARC-D2 | 0.000 / 0.000 / **0.000** | 0.632 / 0.000 / **0.725** | 0.158 / 0.258 / **0.242** | 0.429 |
| AUDIT-M3 | 0.000 / 0.000 / **0.000** | 0.211 / 0.000 / **0.000** | 0.000 / 0.000 / **0.000** | 0.000 |

## Score arrays per case

| Case | MD | MO | OR |
|---|---|---|---|
| AUDIT-L2 | 5.5, 4.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 4.5 | 4.5, 5.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 5.5 | 4, 4, 4, 4, 4, 4, 4, 4, 4, 4 |
| AUDIT-MAT2-beginner | 6, 6, 5.5, 6, 6, 6, 6, 6, 6, 5.5 | 5.5, 5.5, 6, 4.5, 5.5, 5.5, 5.5, 5.5, 5.5, 6 | 4.5, 4.5, 4.5, 5.5, 4.5, 4.5, 4.5, 4.5, 6.5, 4.5 |
| ARC-D2 | 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5 | 6, 6, 4.5, 4.5, 6, 6, 6, 6, 6, 4.5 | 4, 3.5, 3.5, 3.5, 4, 3.5, 3.5, 3.5, 4, 3.5 |
| AUDIT-M3 | 6, 6, 6, 6, 6, 6, 6, 6, 6, 6 | 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5 | 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5 |

## Decision-criterion evaluation (locked before run)

| Criterion | Threshold | Actual | Pass? |
|---|---|---|---|
| L2 σ(MO) | ≤ 0.20 | 0.422 | ❌ |
| L2 σ(MD) — no cross-metric coupling | ≤ 0.20 | 0.422 | ❌ |
| MAT2 σ(MO) | ≤ 0.20 | 0.408 | ❌ |
| MAT2 σ(OR) | ≤ 0.20 | 0.675 | ❌ |
| ARC-D2 regression check (MD,MO=0) | 0 | MD=0.000 MO=0.725 | ❌ |
| M3 regression check (all=0) | 0 | MD=0.000 MO=0.000 OR=0.000 | ✅ |

## Verdict

**REGRESSION — previously cured cases broke.** Dominant-signal instruction destabilized cases that sampler-only had cured.
Recommended ship: sampler-only (Path 1A). Do not add dominant-signal — it introduces new instability.

## Reasoning text spot-check (first 2 reruns per case)

### AUDIT-L2
σ(MD)=0.422 σ(MO)=0.422 σ(OR)=0.000 · ρ(MO,OR)=0.000

**Run 1** (MD=5.5 MO=4.5 OR=4):
> MO: Dominant signal: negative — free substitute pricing pressure. Score 4.5, rubric level 3-4 — while Wyzant demonstrates commission model viability in tutoring marketplaces, word-of-mouth referrals have no platform fees, creating direct pricing pressure against any commission-based model. The 15% commission must compete against zero-cost alternatives that parents already trust and use.

> OR: Dominant signal: replication — incumbent expansion trivial. Score 4.0, rubric level 3-4 — the core tutor-parent matching function and commission model overlaps directly with established marketplaces like Wyzant and Varsity Tutors. While retired teacher focus provides positioning differentiation, established platforms could easily add retired teacher recruitment features without architectural changes. Building exclusive partnerships with retired teacher associations or creating specialized credentialing workflows would create a moat competitors couldn't replicate with simple feature additions.

**Run 2** (MD=4.5 MO=5.5 OR=4):
> MO: Dominant signal: positive — Wyzant operates with high commission rates as an established marketplace, proving commission model viability in tutoring. Score 5.5, rubric level 5-6 — The 15% commission aligns with proven marketplace models, but word-of-mouth referrals create direct pricing pressure as they have no platform fees. Clear revenue path exists but faces structural competition from free alternatives.

> OR: Dominant signal: replication — Wyzant and Varsity Tutors could add retired teacher recruitment features with moderate product effort. Score 4.0, rubric level 3-4 — While the specific focus on retired teachers provides positioning differentiation, the core tutor-parent matching function and commission model overlaps directly with established marketplaces. Building exclusive partnerships with Boston-area teacher retirement associations would create a supply-side moat competitors couldn't replicate without similar local relationship development.

### AUDIT-MAT2-beginner
σ(MD)=0.211 σ(MO)=0.408 σ(OR)=0.675 · ρ(MO,OR)=-0.492

**Run 1** (MD=6 MO=5.5 OR=4.5):
> MO: Dominant signal: negative — free substitutes. Score 5.5, rubric level 5-6. While the 25% success fee eliminates upfront costs and only charges on recovery, small businesses currently handle disputes at no additional cost through manual processes or benefits brokers who provide dispute assistance as part of existing relationships without separate fees. The success fee model has merit but faces structural pricing pressure from established free alternatives.

> OR: Dominant signal: replication — benefits broker expansion. Score 4.5, rubric level 3-4. While no direct competitors target small business employers specifically for claim disputes, benefits brokers already serve this market with established relationships and comprehensive benefits knowledge. They could easily expand claim dispute services as a competitive response without significant architectural changes to their existing service model. Building exclusive partnerships with regional benefits brokers or developing proprietary claim outcome data across thousands of disputes would create a moat competitors couldn't replicate without 12+ months of relationship-building or data collection.

**Run 2** (MD=6 MO=5.5 OR=4.5):
> MO: Dominant signal: negative — free substitutes. Score 5.5, rubric level 5-6. While the success fee model eliminates upfront costs and only charges on recovery, small businesses currently handle disputes at no additional cost through manual processes, and benefits brokers provide dispute assistance as part of existing relationships without separate fees. The 25% success fee faces structural pricing pressure from these free alternatives.

> OR: Dominant signal: replication — benefits broker expansion. Score 4.5, rubric level 3-4. While no direct competitors target small business employers specifically for claim disputes, benefits brokers already serve this market with established relationships, comprehensive benefits knowledge, and existing trust channels. They could easily expand claim dispute services as a competitive response with moderate effort. Building a structured database of successful dispute precedents across 1,000+ small business cases would create a knowledge moat competitors couldn't replicate without significant case volume accumulation.

### ARC-D2
σ(MD)=0.000 σ(MO)=0.725 σ(OR)=0.242 · ρ(MO,OR)=0.429

**Run 1** (MD=5.5 MO=6 OR=4):
> MO: Dominant signal: positive — Aloan demonstrates proven revenue model. Score 6.0, rubric level 5-6. Aloan's existence proves community banks will pay for AI commercial loan underwriting automation, establishing clear willingness to pay in this market. However, the $2.8M pre-revenue investment requirement and banks' refusal to pay until full certification creates significant monetization friction and delays first revenue by 18 months.

> OR: Dominant signal: replication — direct competitor overlap. Score 4.0, rubric level 3-4. Aloan already offers AI commercial loan underwriting automation specifically for community banks and credit unions, representing direct overlap with the core value proposition. While regulatory barriers create entry friction, they don't differentiate against existing players who have already navigated these requirements. Building proprietary risk models trained on community bank loan performance data across 1,000+ institutions would create a defensible advantage competitors couldn't replicate without years of data collection.

**Run 2** (MD=5.5 MO=6 OR=3.5):
> MO: Dominant signal: positive — Aloan demonstrates proven revenue model. Score 6.0, rubric level 5-6. Aloan's existence proves community banks will pay for AI commercial loan underwriting automation, establishing clear willingness to pay in this market. However, the $2.8M pre-revenue investment requirement and banks' refusal to pay until full certification creates significant monetization friction and delays first revenue by 18 months.

> OR: Dominant signal: replication — direct competitor overlap. Score 3.5, rubric level 3-4. Aloan already offers AI commercial loan underwriting automation specifically for community banks and credit unions, representing direct overlap with the core value proposition. While regulatory barriers create entry friction, they don't differentiate against existing players who have already navigated these requirements. Building proprietary risk models trained on community bank loan performance data across 1,000+ institutions would create a defensible advantage competitors couldn't replicate without years of data collection.

### AUDIT-M3
σ(MD)=0.000 σ(MO)=0.000 σ(OR)=0.000 · ρ(MO,OR)=0.000

**Run 1** (MD=6 MO=4.5 OR=6.5):
> MO: Dominant signal: negative — free ChatGPT substitution. Score 4.5, rubric level 3-4. While AJE demonstrates willingness to pay for manuscript editing services, ChatGPT already provides free manuscript editing assistance that academics actively use. The $29/month pricing faces structural pressure from this free alternative, and PhD students typically lack independent budget authority for subscriptions.

> OR: Dominant signal: differentiation — discipline-specific convention gap. Score 6.5, rubric level 5-6. No existing competitor offers discipline-specific convention checking (passive vs active voice by field) or Overleaf integration. However, existing tools like Trinka or Writefull could potentially add convention rules with moderate product effort. Building a comprehensive database of field-specific writing conventions across 50+ academic disciplines would create a moat competitors couldn't replicate without 6+ months of expert linguistic curation.

**Run 2** (MD=6 MO=4.5 OR=6.5):
> MO: Dominant signal: negative — free ChatGPT substitution. Score 4.5, rubric level 3-4. While AJE demonstrates willingness to pay for manuscript editing services, ChatGPT already provides free manuscript editing assistance that academics actively use. The $29/month pricing faces structural pressure from this free alternative, and PhD students may lack budget authority for individual subscriptions.

> OR: Dominant signal: differentiation — discipline-specific convention gap. Score 6.5, rubric level 5-6. No existing competitor offers discipline-specific convention checking (passive vs active voice by field) combined with Overleaf integration. However, existing tools like Trinka or Writefull could potentially add discipline-specific rules with moderate product effort. Building a comprehensive database of field-specific writing conventions across 50+ academic disciplines would create a moat competitors couldn't replicate without 6+ months of linguistic research.
