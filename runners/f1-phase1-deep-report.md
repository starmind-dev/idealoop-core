# F1 Phase 1 — Deep Capture Report

Goal: compare reasoning text across score modes within bimodal cases.
If different modes cite different rubric language, band-boundary fuzziness is the cause.

---
## AUDIT-L2
Total reruns: 10 · Distinct score modes: 3

**MULTIMODAL** — 3 distinct score tuples observed.

### Mode 1: MD=5.5 · MO=4.5 · OR=4  (6/10 runs · runs 1, 3, 4, 8, 9, 10)

**MD explanation:**
> Score 5.5, rubric level 5-6. Clear target audience with demonstrated need - parents seek tutors and word-of-mouth referrals dominate but have limited reach and inefficient matching. However, the marketplace must displace established trust-based discovery patterns where parents typically rely on personal referrals, creating meaningful adoption friction that caps the score.

**MO explanation:**
> Score 4.5, rubric level 3-4. Wyzant demonstrates commission model viability in tutoring marketplaces, supporting the 15% structure. However, word-of-mouth referrals have no platform fees, creating direct pricing pressure against any commission-based model. The monetization path exists but faces structural headwinds from free substitutes.

**OR explanation:**
> Score 4.0, rubric level 3-4. The core tutor-parent matching function and commission model overlaps directly with established marketplaces like Wyzant and Varsity Tutors. While the specific focus on retired teachers provides differentiation, this is positioning rather than a structural barrier - established platforms could add retired teacher recruitment features with moderate effort. Building exclusive partnerships with specific teacher retirement associations or pension systems would create a supply moat competitors couldn't replicate without similar institutional relationships.

**Evidence strength:** HIGH — The 15% commission structure, retired-teacher supply focus, and Boston geographic start provide concrete evaluation anchors against Wyzant and Varsity Tutors.

### Mode 2: MD=5.5 · MO=6 · OR=4.5  (2/10 runs · runs 2, 5)

**MD explanation:**
> Score 5.5, rubric level 5-6. Clear target audience of parents seeking tutors with demonstrated need, as evidenced by established word-of-mouth referral patterns. However, the marketplace must displace trust-based discovery networks where parents already rely on personal referrals, creating meaningful adoption friction. The Boston retired-teacher population provides addressable supply, but demand capture depends on overcoming established referral preferences.

**MO explanation:**
> Score 6.0, rubric level 5-6. The 15% commission model has proven viability as demonstrated by Wyzant's high commission rates in the established tutoring marketplace. Clear willingness to pay exists for tutoring services. However, word-of-mouth referrals create direct pricing pressure as they have no platform fees, requiring the marketplace to justify its commission through superior matching or convenience value.

**OR explanation:**
> Score 4.5, rubric level 3-4. The core tutor-parent matching function and commission model overlaps directly with established marketplaces like Wyzant and Varsity Tutors. While focusing specifically on retired teachers provides some differentiation, this is positioning rather than a structural barrier - established platforms could easily add retired teacher recruitment features or create dedicated sections. Building exclusive partnerships with specific retired teacher associations or creating specialized credentialing for career educators would create a moat competitors couldn't replicate without significant relationship-building effort.

**Evidence strength:** HIGH — The 15% commission model, retired-teacher supply focus, and Boston geographic start provide concrete evaluation anchors against Wyzant and Varsity Tutors comparisons.

### Mode 3: MD=5.5 · MO=5 · OR=4  (2/10 runs · runs 6, 7)

**MD explanation:**
> Score 5.5, rubric level 5-6. Clear target audience with demonstrated need - parents seek tutors and word-of-mouth referrals dominate but have limited reach and inefficient matching. However, the marketplace must displace established trust-based discovery patterns where parents typically rely on personal referrals, creating meaningful adoption friction that caps the score.

**MO explanation:**
> Score 5.0, rubric level 5-6. Proven revenue model with identifiable willingness to pay - Wyzant operates with high commission rates demonstrating commission model viability in tutoring. However, word-of-mouth referrals have no platform fees creating direct pricing pressure against the 15% commission, moderating pricing power.

**OR explanation:**
> Score 4.0, rubric level 3-4. Minor twist on established marketplace model - the specific focus on retired teachers provides differentiation compared to broader platforms like Wyzant and Varsity Tutors. However, the core tutor-parent matching function and commission model overlaps directly with these established competitors, who could replicate retired teacher recruitment with moderate effort. Building exclusive partnerships with specific teacher retirement systems or pension boards would create a supply-side moat that general marketplaces couldn't easily replicate.

**Evidence strength:** HIGH — The 15% commission structure, retired-teacher supply focus, and Boston geographic start provide concrete evaluation anchors against Wyzant and Varsity Tutors comparisons.

### Cross-mode reasoning diff for AUDIT-L2

Differs on: MO (4.5 vs 6), OR (4 vs 4.5)

---
## ARC-D2
Total reruns: 10 · Distinct score modes: 2

**MULTIMODAL** — 2 distinct score tuples observed.

### Mode 1: MD=5.5 · MO=4.5 · OR=3.5  (9/10 runs · runs 1, 2, 3, 4, 5, 7, 8, 9, 10)

**MD explanation:**
> Score 5.5, rubric level 5-6. Manual underwriting workflows remain standard in community banking with documented inefficiencies, indicating clear target audience with demonstrated need. However, the 18-month pre-revenue requirement creates significant adoption friction, and specific triggers that would cause banks to actively seek AI solutions are not identified. The gap between need and urgency limits capturable demand.

**MO explanation:**
> Score 4.5, rubric level 3-4. Aloan demonstrates that community banks will pay for AI underwriting automation, proving the revenue model exists. However, the $2.8M pre-revenue investment requirement with no payment until certifications complete creates a weak initial revenue path. The specific pricing model and revenue per customer remain unspecified, limiting assessment of pricing power.

**OR explanation:**
> Score 3.5, rubric level 3-4. Aloan already offers direct AI commercial loan underwriting automation for the same community bank target market, representing near-exact overlap. While regulatory barriers create entry friction, they don't differentiate against existing compliant competitors. LLM substitution risk is appropriately low, but this doesn't address incumbent replication. Building proprietary credit risk models trained on community bank loan performance data across 1,000+ institutions would create a defensible advantage competitors couldn't replicate without years of data collection.

**Evidence strength:** MEDIUM — Competitive positioning not articulated — Aloan already serves community banks with AI commercial loan underwriting, but the differentiation against this direct competitor is not stated

### Mode 2: MD=5.5 · MO=6 · OR=3.5  (1/10 runs · runs 6)

**MD explanation:**
> Score 5.5, rubric level 5-6. Manual underwriting workflows remain standard in community banking with documented inefficiencies, indicating clear target audience with demonstrated need. However, the 18-month pre-revenue requirement creates substantial adoption friction, and specific triggers that would cause banks to actively seek AI solutions are not identified. The gap between need and capturable demand is significant due to regulatory barriers.

**MO explanation:**
> Score 6.0, rubric level 5-6. Aloan demonstrates proven revenue model with community banks paying for AI commercial loan underwriting automation. However, the $2.8M pre-revenue investment requirement and banks' unwillingness to pay until full certification creates substantial monetization friction. The revenue path is proven but structurally delayed by regulatory requirements.

**OR explanation:**
> Score 3.5, rubric level 3-4. Aloan already offers direct AI commercial loan underwriting automation for the same target market of community banks and credit unions. While LLM substitution risk is low due to regulatory requirements, this represents a minor positioning twist rather than structural differentiation. Building a proprietary dataset of community bank loan performance patterns across 1,000+ institutions would create a data moat that competitors like Aloan couldn't replicate without years of customer acquisition.

**Evidence strength:** MEDIUM — Competitive positioning not articulated — Aloan already serves community banks with AI commercial loan underwriting, but the differentiation against this direct competitor is not stated

### Cross-mode reasoning diff for ARC-D2

Differs on: MO (4.5 vs 6)

---
## AUDIT-M3
Total reruns: 10 · Distinct score modes: 1

**MONOMODAL** — all reruns produced identical scores. No reasoning split to inspect.

Scores: MD=6 · MO=5 · OR=6.5

**MO explanation:**
> Score 5.0, rubric level 5-6. AJE's professional editing service demonstrates willingness to pay for manuscript preparation in this market. However, ChatGPT provides free/low-cost editing assistance that academics already use, creating significant pricing pressure. The $29/month student pricing faces uncertainty around budget authority - PhD students may lack discretionary spending power and require institutional purchasing approval.

---
## AUDIT-MAT2-beginner
Total reruns: 10 · Distinct score modes: 2

**MULTIMODAL** — 2 distinct score tuples observed.

### Mode 1: MD=6 · MO=5.5 · OR=4.5  (7/10 runs · runs 1, 2, 3, 4, 6, 7, 8)

**MD explanation:**
> Score 5-6, rubric level 5-6 — Small businesses face genuine pain with manual claim disputes requiring specialized insurance expertise they lack. However, demand is filtered by relationship displacement barriers with existing benefits brokers who already serve this market and may handle disputes as part of broader relationship management. The frequency and dollar value of denied claims that would justify external help remains uncertain.

**MO explanation:**
> Score 5-6, rubric level 5-6 — The 25% success fee eliminates upfront barriers and only charges on recovery, creating clear willingness to pay when value is delivered. However, monetization faces structural pressure from free alternatives: manual processes cost nothing additional, and benefits brokers provide dispute assistance within existing relationships without separate fees. Success depends on recovering claims large enough to justify the fee premium over free options.

**OR explanation:**
> Score 3-4, rubric level 3-4 — While no direct competitors target small business employers specifically (Authsnap, Counterforce, Rivet Resolve focus on providers/patients), benefits brokers already serve this market with established relationships and comprehensive benefits knowledge. They could easily expand claim dispute services as a competitive response without significant product redesign. Building proprietary data on small business claim patterns across specific insurance carriers would create a moat competitors couldn't replicate without 12+ months of case history collection.

**Evidence strength:** HIGH — The 25% success fee structure and small business employer focus provide concrete evaluation anchors, while benefits broker competition evidence establishes clear competitive dynamics.

### Mode 2: MD=6 · MO=4.5 · OR=5.5  (3/10 runs · runs 5, 9, 10)

**MD explanation:**
> Score 5-6, rubric level 5-6. Small businesses face genuine pain handling insurance disputes manually through time-intensive processes requiring specialized expertise they lack. However, demand is filtered by relationship displacement barriers - benefits brokers already serve this market and may handle disputes as part of broader relationship management. The biggest uncertainty is claim frequency and whether businesses would seek external help versus working through existing broker relationships.

**MO explanation:**
> Score 3-4, rubric level 3-4. The 25% success fee eliminates upfront barriers and only charges on recovery, which is structurally sound. However, strong free substitutes exist - businesses currently handle disputes at no additional cost manually, and benefits brokers provide dispute assistance as part of existing relationships without separate fees. Pricing power is constrained by these free alternatives, and the typical dollar value of recoverable claims for small businesses remains uncertain.

**OR explanation:**
> Score 5-6, rubric level 5-6. Real differentiation exists as no direct competitors target small business employers specifically - Authsnap, Counterforce, and Rivet Resolve focus on healthcare providers or individual patients. However, benefits brokers already serve small businesses with established relationships and comprehensive benefits knowledge, making expansion into specialized claim dispute services a moderate effort rather than fundamental redesign. Building a proprietary database of successful dispute strategies across thousands of small business cases would create a knowledge moat that benefits brokers couldn't replicate without significant case volume investment.

**Evidence strength:** HIGH — The 25% success fee structure and small business employer focus provide concrete evaluation anchors, while benefits broker competition evidence establishes clear competitive dynamics.

### Cross-mode reasoning diff for AUDIT-MAT2-beginner

Differs on: MO (5.5 vs 4.5), OR (4.5 vs 5.5)

---
## How to read this report

For each multimodal case, compare the explanation text between modes:
- **If different modes cite different rubric levels** ("rubric 5-6" vs "rubric 7-8"), or use different anchor language ("moderate pricing" vs "clear, strong"): the model is selecting between two coherent rubric-level interpretations. **Band-boundary fuzziness confirmed.**
- **If both modes cite the same rubric level** with similar language, just differing on the 0.5-step score: the cause is closer to discretization or near-tied probability collapse, not boundary fuzziness.
- **If explanations describe different facts being weighted**: the model is making different evidence-weighting choices per run. Different mechanism — could indicate prompt instructions are not constraining evidence-weighting tightly enough.