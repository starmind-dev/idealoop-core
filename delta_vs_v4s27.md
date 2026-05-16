# IdeaLoop Core — V4S27 ↔ V4S28 Factual Delta

Generated: 2026-05-10T19:17:34.347Z

Compares each case's V4S27 baseline (from `audit-raw.json` / `audit-sections.md`) against the V4S28 run-1 result.

**Note:** Overall scores are NOT directly comparable — α formula changed in B8 (TC removed from composite, weights re-normalized).

Compare: score-band direction, metric-level consistency, structural correctness, V4S27-specific failure modes (e.g., MAT3 fabrication, SP1 imagined landscape).


---

## AUDIT-H1  *(A-high, PRO)*

**V4S27 baseline:** MD 6 · MO 6.5 · OR 4.5 · TC 8.5 · Overall 4.9 · Conf MEDIUM

**V4S28:** MD 6.5 · MO 5.5 · OR 4 · TC 8.5 · Overall 5.4 · EvStr HIGH

**Δ:** MD +0.5 · MO -1.0 · OR -0.5 · TC +0.0 · Overall +0.5 *(α formula change: Overall delta expected, do not interpret as regression)*

**New surfaces (V4S28-only):**
- Main Bottleneck: Trust/credibility
- Risk 3 archetype (founder_fit): A
- Evidence Strength: HIGH

---

## AUDIT-H2  *(A-high, PRO)*

**V4S27 baseline:** MD 6 · MO 5 · OR 4.5 · TC 7 · Overall 4.8 · Conf MEDIUM

**V4S28:** MD 6 · MO 5.5 · OR 4.5 · TC 7 · Overall 5.4 · EvStr HIGH

**Δ:** MD +0.0 · MO +0.5 · OR +0.0 · TC +0.0 · Overall +0.6 *(α formula change: Overall delta expected, do not interpret as regression)*

**New surfaces (V4S28-only):**
- Main Bottleneck: Trust/credibility
- Risk 3 archetype (founder_fit): null
- Evidence Strength: HIGH

---

## AUDIT-H3  *(A-high, PRO)*

**V4S27 baseline:** MD 6.5 · MO 7 · OR 4.5 · TC 7.5 · Overall 5.3 · Conf HIGH

**V4S28:** MD 6.5 · MO 6 · OR 4.5 · TC 7.5 · Overall 5.7 · EvStr HIGH

**Δ:** MD +0.0 · MO -1.0 · OR +0.0 · TC +0.0 · Overall +0.4 *(α formula change: Overall delta expected, do not interpret as regression)*

**New surfaces (V4S28-only):**
- Main Bottleneck: Trust/credibility
- Risk 3 archetype (founder_fit): B
- Evidence Strength: HIGH

---

## AUDIT-H4  *(A-high, PRO)*

**V4S27 baseline:** MD 6.5 · MO 5.5 · OR 4.5 · TC 7.5 · Overall 5 · Conf MEDIUM

**V4S28:** MD 6.5 · MO 6 · OR 4.5 · TC 7.5 · Overall 5.7 · EvStr HIGH

**Δ:** MD +0.0 · MO +0.5 · OR +0.0 · TC +0.0 · Overall +0.7 *(α formula change: Overall delta expected, do not interpret as regression)*

**New surfaces (V4S28-only):**
- Main Bottleneck: Technical build
- Risk 3 archetype (founder_fit): A
- Evidence Strength: HIGH

---

## AUDIT-M1  *(A-mid, PRO)*

**V4S27 baseline:** MD 5.5 · MO 4 · OR 4.5 · TC 6 · Overall 4.6 · Conf HIGH

**V4S28:** MD 5.5 · MO 4.5 · OR 3.5 · TC 6.5 · Overall 4.6 · EvStr HIGH

**Δ:** MD +0.0 · MO +0.5 · OR -1.0 · TC +0.5 · Overall +0.0 *(α formula change: Overall delta expected, do not interpret as regression)*

**New surfaces (V4S28-only):**
- Main Bottleneck: Distribution
- Risk 3 archetype (founder_fit): B
- Evidence Strength: HIGH

---

## AUDIT-M2  *(A-mid, PRO)*

**V4S27 baseline:** MD 6 · MO 4.5 · OR 4 · TC 7.5 · Overall 4.4 · Conf MEDIUM

**V4S28:** MD 6.5 · MO 6 · OR 5.5 · TC 7.5 · Overall 6 · EvStr HIGH

**Δ:** MD +0.5 · MO +1.5 · OR +1.5 · TC +0.0 · Overall +1.6 *(α formula change: Overall delta expected, do not interpret as regression)*

**New surfaces (V4S28-only):**
- Main Bottleneck: Technical build
- Risk 3 archetype (founder_fit): A
- Evidence Strength: HIGH

---

## AUDIT-M3  *(A-mid, PRO)*

**V4S27 baseline:** MD 6.5 · MO 5 · OR 6 · TC 7 · Overall 5.3 · Conf MEDIUM

**V4S28:** MD 6.5 · MO 5 · OR 4 · TC 7 · Overall 5.3 · EvStr HIGH

**Δ:** MD +0.0 · MO +0.0 · OR -2.0 · TC +0.0 · Overall +0.0 *(α formula change: Overall delta expected, do not interpret as regression)*

**New surfaces (V4S28-only):**
- Main Bottleneck: Buyer access
- Risk 3 archetype (founder_fit): B
- Evidence Strength: HIGH

---

## AUDIT-M4  *(A-mid, PRO)*

**V4S27 baseline:** MD 6 · MO 5.5 · OR 4.5 · TC 7 · Overall 4.9 · Conf HIGH

**V4S28:** MD 6 · MO 5.5 · OR 4.5 · TC 7 · Overall 5.4 · EvStr HIGH

**Δ:** MD +0.0 · MO +0.0 · OR +0.0 · TC +0.0 · Overall +0.5 *(α formula change: Overall delta expected, do not interpret as regression)*

**New surfaces (V4S28-only):**
- Main Bottleneck: Trust/credibility
- Risk 3 archetype (founder_fit): null
- Evidence Strength: HIGH

---

## AUDIT-L1  *(A-low, PRO)*

**V4S27 baseline:** MD 6 · MO 4.5 · OR 3.5 · TC 6.5 · Overall 4.5 · Conf MEDIUM

**V4S28:** 🚪 GATED at Haiku Specificity layer (V8.1) — no scoring.

This is **expected behavior** for sparse inputs. V4S27 would have produced a score on this input (potentially with fabricated content). V4S28 gates upstream — the disease (sparse-input fabrication) is cured by a different mechanism than V4S27 attempted.


---

## AUDIT-L2  *(A-low, PRO)*

**V4S27 baseline:** MD 5.5 · MO 4.5 · OR 3.5 · TC 7.5 · Overall 4.2 · Conf HIGH

**V4S28:** MD 5.5 · MO 6 · OR 4.5 · TC 7.5 · Overall 5.3 · EvStr HIGH

**Δ:** MD +0.0 · MO +1.5 · OR +1.0 · TC +0.0 · Overall +1.1 *(α formula change: Overall delta expected, do not interpret as regression)*

**New surfaces (V4S28-only):**
- Main Bottleneck: Trust/credibility
- Risk 3 archetype (founder_fit): A
- Evidence Strength: HIGH

---

## AUDIT-S2  *(A-struct, PRO)*

**V4S27 baseline:** MD 5.5 · MO 4.5 · OR 3.5 · TC 7.5 · Overall 4.2 · Conf HIGH

**V4S28:** 🚪 GATED at Haiku Specificity layer (V8.1) — no scoring.

This is **expected behavior** for sparse inputs. V4S27 would have produced a score on this input (potentially with fabricated content). V4S28 gates upstream — the disease (sparse-input fabrication) is cured by a different mechanism than V4S27 attempted.


---

## AUDIT-A1  *(B-wrapper, PRO)*

**V4S27 baseline:** MD 6 · MO 4 · OR 3.5 · TC 6.5 · Overall 4.4 · Conf HIGH

**V4S28:** 🚪 GATED at Haiku Specificity layer (V8.1) — no scoring.

This is **expected behavior** for sparse inputs. V4S27 would have produced a score on this input (potentially with fabricated content). V4S28 gates upstream — the disease (sparse-input fabrication) is cured by a different mechanism than V4S27 attempted.


---

## AUDIT-A2  *(B-marketplace, PRO)*

**V4S27 baseline:** MD 5.5 · MO 4.5 · OR 4 · TC 7 · Overall 4.4 · Conf MEDIUM

**V4S28:** MD 5.5 · MO 4.5 · OR 4 · TC 7 · Overall 4.7 · EvStr HIGH

**Δ:** MD +0.0 · MO +0.0 · OR +0.0 · TC +0.0 · Overall +0.3 *(α formula change: Overall delta expected, do not interpret as regression)*

**New surfaces (V4S28-only):**
- Main Bottleneck: Buyer access
- Risk 3 archetype (founder_fit): B
- Evidence Strength: HIGH

---

## AUDIT-A3  *(B-regulated, PRO)*

**V4S27 baseline:** MD 6.5 · MO 6 · OR 3 · TC 9 · Overall 4.4 · Conf HIGH

**V4S28:** MD 6.5 · MO 7 · OR 4 · TC 9 · Overall 5.9 · EvStr HIGH

**Δ:** MD +0.0 · MO +1.0 · OR +1.0 · TC +0.0 · Overall +1.5 *(α formula change: Overall delta expected, do not interpret as regression)*

**New surfaces (V4S28-only):**
- Main Bottleneck: Compliance
- Risk 3 archetype (founder_fit): A
- Evidence Strength: HIGH

---

## AUDIT-B1  *(C-boundary, PRO)*

**V4S27 baseline:** MD 6 · MO 5 · OR 4.5 · TC 7.5 · Overall 4.7 · Conf MEDIUM

**V4S28:** MD 6 · MO 5.5 · OR 4.5 · TC 7.5 · Overall 5.4 · EvStr HIGH

**Δ:** MD +0.0 · MO +0.5 · OR +0.0 · TC +0.0 · Overall +0.7 *(α formula change: Overall delta expected, do not interpret as regression)*

**New surfaces (V4S28-only):**
- Main Bottleneck: Technical build
- Risk 3 archetype (founder_fit): A
- Evidence Strength: HIGH

---

## AUDIT-B2  *(C-boundary, PRO)*

**V4S27 baseline:** MD 6 · MO 6.5 · OR 4.5 · TC 6.5 · Overall 5.3 · Conf MEDIUM

**V4S28:** MD 6 · MO 6.5 · OR 4.5 · TC 6.5 · Overall 5.7 · EvStr HIGH

**Δ:** MD +0.0 · MO +0.0 · OR +0.0 · TC +0.0 · Overall +0.4 *(α formula change: Overall delta expected, do not interpret as regression)*

**New surfaces (V4S28-only):**
- Main Bottleneck: Buyer access
- Risk 3 archetype (founder_fit): E
- Evidence Strength: HIGH

---

## AUDIT-B3  *(C-boundary, PRO)*

**V4S27 baseline:** MD 6.5 · MO 6 · OR 5.5 · TC 6.5 · Overall 5.5 · Conf MEDIUM

**V4S28:** MD 6 · MO 4.5 · OR 5.5 · TC 6.5 · Overall 5.4 · EvStr HIGH

**Δ:** MD -0.5 · MO -1.5 · OR +0.0 · TC +0.0 · Overall -0.1 *(α formula change: Overall delta expected, do not interpret as regression)*

**New surfaces (V4S28-only):**
- Main Bottleneck: Distribution
- Risk 3 archetype (founder_fit): A
- Evidence Strength: HIGH

---

## AUDIT-R1  *(D-cluster, PRO)*

**V4S27 baseline:** MD 6 · MO 5.5 · OR 4 · TC 7.5 · Overall 4.7 · Conf MEDIUM

**V4S28:** MD 6 · MO 5.5 · OR 4 · TC 7.5 · Overall 5.2 · EvStr MEDIUM

**Δ:** MD +0.0 · MO +0.0 · OR +0.0 · TC +0.0 · Overall +0.5 *(α formula change: Overall delta expected, do not interpret as regression)*

**New surfaces (V4S28-only):**
- Main Bottleneck: Technical build
- Risk 3 archetype (founder_fit): A
- Evidence Strength: MEDIUM — reason: "AI-powered automation features not specified — existing competitors offer digital forms and insurance verification, but the specific AI differentiatio..."

---

## AUDIT-R2  *(D-cluster, PRO)*

**V4S27 baseline:** MD 5.5 · MO 4.5 · OR 4 · TC 7 · Overall 4.4 · Conf MEDIUM

**V4S28:** MD 6 · MO 5.5 · OR 6.5 · TC 7 · Overall 6 · EvStr HIGH

**Δ:** MD +0.5 · MO +1.0 · OR +2.5 · TC +0.0 · Overall +1.6 *(α formula change: Overall delta expected, do not interpret as regression)*

**New surfaces (V4S28-only):**
- Main Bottleneck: Buyer access
- Risk 3 archetype (founder_fit): B
- Evidence Strength: HIGH

---

## AUDIT-R3  *(D-cluster, PRO)*

**V4S27 baseline:** *(none — V4S28-new case)*


**V4S28:** MD 6 · MO 5.5 · OR 4.5 · TC 8 · Overall 5.4 · EvStr HIGH

**New surfaces (V4S28-only):**
- Main Bottleneck: Technical build
- Risk 3 archetype (founder_fit): A
- Evidence Strength: HIGH

---

## AUDIT-MAT1-beginner  *(E-matrix, PRO)*

**V4S27 baseline:** MD 6 · MO 4.5 · OR 3.5 · TC 7.5 · Overall 4.3 · Conf MEDIUM

**V4S28:** MD 6 · MO 6.5 · OR 4 · TC 7.5 · Overall 5.5 · EvStr HIGH

**Δ:** MD +0.0 · MO +2.0 · OR +0.5 · TC +0.0 · Overall +1.2 *(α formula change: Overall delta expected, do not interpret as regression)*

**New surfaces (V4S28-only):**
- Main Bottleneck: Technical build
- Risk 3 archetype (founder_fit): A
- Evidence Strength: HIGH

---

## AUDIT-MAT1-intermediate  *(E-matrix, PRO)*

**V4S27 baseline:** MD 6 · MO 4.5 · OR 4 · TC 7 · Overall 4.5 · Conf HIGH

**V4S28:** MD 5.5 · MO 4.5 · OR 4 · TC 7 · Overall 4.7 · EvStr HIGH

**Δ:** MD -0.5 · MO +0.0 · OR +0.0 · TC +0.0 · Overall +0.2 *(α formula change: Overall delta expected, do not interpret as regression)*

**New surfaces (V4S28-only):**
- Main Bottleneck: Trust/credibility
- Risk 3 archetype (founder_fit): null
- Evidence Strength: HIGH

---

## AUDIT-MAT1-senior  *(E-matrix, PRO)*

**V4S27 baseline:** MD 6 · MO 5 · OR 4.5 · TC 6 · Overall 5 · Conf MEDIUM

**V4S28:** MD 5.5 · MO 4.5 · OR 3.5 · TC 6 · Overall 4.6 · EvStr HIGH

**Δ:** MD -0.5 · MO -0.5 · OR -1.0 · TC +0.0 · Overall -0.4 *(α formula change: Overall delta expected, do not interpret as regression)*

**New surfaces (V4S28-only):**
- Main Bottleneck: Buyer access
- Risk 3 archetype (founder_fit): B
- Evidence Strength: HIGH

---

## AUDIT-MAT2-beginner  *(E-matrix, PRO)*

**V4S27 baseline:** MD 6.5 · MO 6 · OR 5.5 · TC 7.5 · Overall 5.3 · Conf MEDIUM

**V4S28:** MD 6 · MO 6.5 · OR 5.5 · TC 7.5 · Overall 6 · EvStr MEDIUM

**Δ:** MD -0.5 · MO +0.5 · OR +0.0 · TC +0.0 · Overall +0.7 *(α formula change: Overall delta expected, do not interpret as regression)*

**New surfaces (V4S28-only):**
- Main Bottleneck: Technical build
- Risk 3 archetype (founder_fit): A
- Evidence Strength: MEDIUM — reason: "Buyer urgency trigger not specified — what prompts small businesses to seek external dispute help versus handling internally would materially affect M..."

---

## AUDIT-MAT2-intermediate  *(E-matrix, PRO)*

**V4S27 baseline:** MD 6 · MO 5 · OR 6.5 · TC 7 · Overall 5.3 · Conf MEDIUM

**V4S28:** MD 6.5 · MO 6 · OR 5.5 · TC 7 · Overall 6 · EvStr HIGH

**Δ:** MD +0.5 · MO +1.0 · OR -1.0 · TC +0.0 · Overall +0.7 *(α formula change: Overall delta expected, do not interpret as regression)*

**New surfaces (V4S28-only):**
- Main Bottleneck: Technical build
- Risk 3 archetype (founder_fit): A
- Evidence Strength: HIGH

---

## AUDIT-MAT2-senior  *(E-matrix, PRO)*

**V4S27 baseline:** MD 6 · MO 6.5 · OR 5.5 · TC 7.5 · Overall 5.3 · Conf MEDIUM

**V4S28:** MD 6.5 · MO 6 · OR 5.5 · TC 7.5 · Overall 6 · EvStr HIGH

**Δ:** MD +0.5 · MO -0.5 · OR +0.0 · TC +0.0 · Overall +0.7 *(α formula change: Overall delta expected, do not interpret as regression)*

**New surfaces (V4S28-only):**
- Main Bottleneck: Trust/credibility
- Risk 3 archetype (founder_fit): null
- Evidence Strength: HIGH

---

## AUDIT-MAT3-insider  *(E-matrix, PRO)*

**V4S27 baseline:** MD 6 · MO 5.5 · OR 4.5 · TC 7.5 · Overall 4.8 · Conf MEDIUM

**V4S28:** MD 6.5 · MO 5.5 · OR 4.5 · TC 7.5 · Overall 5.6 · EvStr HIGH

**Δ:** MD +0.5 · MO +0.0 · OR +0.0 · TC +0.0 · Overall +0.8 *(α formula change: Overall delta expected, do not interpret as regression)*

**New surfaces (V4S28-only):**
- Main Bottleneck: Trust/credibility
- Risk 3 archetype (founder_fit): null
- Evidence Strength: HIGH

---

## AUDIT-MAT3-tech-no-access  *(E-matrix, PRO)*

**V4S27 baseline:** MD 6.5 · MO 6 · OR 4.5 · TC 7.5 · Overall 5.1 · Conf MEDIUM

**V4S28:** MD 6 · MO 6.5 · OR 4.5 · TC 7 · Overall 5.7 · EvStr HIGH

**Δ:** MD -0.5 · MO +0.5 · OR +0.0 · TC -0.5 · Overall +0.6 *(α formula change: Overall delta expected, do not interpret as regression)*

**New surfaces (V4S28-only):**
- Main Bottleneck: Buyer access
- Risk 3 archetype (founder_fit): B
- Evidence Strength: HIGH

---

## AUDIT-MAT3-partial  *(E-matrix, PRO)*

**V4S27 baseline:** MD 6.5 · MO 5 · OR 4.5 · TC 7 · Overall 4.9 · Conf MEDIUM

**V4S28:** MD 6.5 · MO 6 · OR 4.5 · TC 7 · Overall 5.7 · EvStr HIGH

**Δ:** MD +0.0 · MO +1.0 · OR +0.0 · TC +0.0 · Overall +0.8 *(α formula change: Overall delta expected, do not interpret as regression)*

**New surfaces (V4S28-only):**
- Main Bottleneck: Buyer access
- Risk 3 archetype (founder_fit): B
- Evidence Strength: HIGH

---

## AUDIT-H2-std  *(F-freepro, FREE)*

**V4S27 baseline:** MD 7 · MO 6.5 · OR 4 · TC 7.5 · Overall 5.2 · Conf HIGH

**V4S28:** MD 6.5 · MO 6 · OR 5.5 · TC 6.5 · Overall 6 · EvStr HIGH

**Δ:** MD -0.5 · MO -0.5 · OR +1.5 · TC -1.0 · Overall +0.8 *(α formula change: Overall delta expected, do not interpret as regression)*

**New surfaces (V4S28-only):**
- Main Bottleneck: Trust/credibility
- Risk 3 archetype (founder_fit): null
- Evidence Strength: HIGH

---

## AUDIT-M1-std  *(F-freepro, FREE)*

**V4S27 baseline:** MD 6 · MO 4.5 · OR 3.5 · TC 6.5 · Overall 4.5 · Conf HIGH

**V4S28:** MD 5.5 · MO 4.5 · OR 3.5 · TC 5.5 · Overall 4.6 · EvStr HIGH

**Δ:** MD -0.5 · MO +0.0 · OR +0.0 · TC -1.0 · Overall +0.1 *(α formula change: Overall delta expected, do not interpret as regression)*

**New surfaces (V4S28-only):**
- Main Bottleneck: Distribution
- Risk 3 archetype (founder_fit): null
- Evidence Strength: HIGH

---

## AUDIT-S2-std  *(F-freepro, FREE)*

**V4S27 baseline:** MD 4.5 · MO 3.5 · OR 2.5 · TC 7.5 · Overall 3.4 · Conf HIGH

**V4S28:** 🚪 GATED at Haiku Specificity layer (V8.1) — no scoring.

This is **expected behavior** for sparse inputs. V4S27 would have produced a score on this input (potentially with fabricated content). V4S28 gates upstream — the disease (sparse-input fabrication) is cured by a different mechanism than V4S27 attempted.


---

## AUDIT-A1-std  *(F-freepro, FREE)*

**V4S27 baseline:** MD 6 · MO 4.5 · OR 3.5 · TC 6 · Overall 4.6 · Conf HIGH

**V4S28:** 🚪 GATED at Haiku Specificity layer (V8.1) — no scoring.

This is **expected behavior** for sparse inputs. V4S27 would have produced a score on this input (potentially with fabricated content). V4S28 gates upstream — the disease (sparse-input fabrication) is cured by a different mechanism than V4S27 attempted.


---

## AUDIT-SP1  *(G-trust, PRO)*

**V4S27 baseline:** MD 4.5 · MO 5 · OR 3.5 · TC 3 · Overall 4.9 · Conf LOW

**V4S28:** 🚪 GATED at Haiku Specificity layer (V8.1) — no scoring.

This is **expected behavior** for sparse inputs. V4S27 would have produced a score on this input (potentially with fabricated content). V4S28 gates upstream — the disease (sparse-input fabrication) is cured by a different mechanism than V4S27 attempted.


---

## AUDIT-MD1  *(G-trust, PRO)*

**V4S27 baseline:** MD 5.5 · MO 4.5 · OR 4 · TC 7 · Overall 4.4 · Conf MEDIUM

**V4S28:** MD 5.5 · MO 4.5 · OR 3.5 · TC 7 · Overall 4.6 · EvStr MEDIUM

**Δ:** MD +0.0 · MO +0.0 · OR -0.5 · TC +0.0 · Overall +0.2 *(α formula change: Overall delta expected, do not interpret as regression)*

**New surfaces (V4S28-only):**
- Main Bottleneck: Technical build
- Risk 3 archetype (founder_fit): A
- Evidence Strength: MEDIUM — reason: "Product scope not specified — focusing on payment automation versus building a full freelancer platform would lead to different Market Demand and Orig..."

---

## ARC-C1  *(Arc-C, PRO)*

**V4S27 baseline:** *(none — V4S28-new case)*


**V4S28:** MD 6.5 · MO 5 · OR 4.5 · TC 8.5 · Overall 5.4 · EvStr HIGH

**New surfaces (V4S28-only):**
- Main Bottleneck: Trust/credibility
- Risk 3 archetype (founder_fit): C
- Evidence Strength: HIGH

---

## ARC-D1  *(Arc-D, PRO)*

**V4S27 baseline:** *(none — V4S28-new case)*


**V4S28:** MD 6.5 · MO 6 · OR 7 · TC 8.5 · Overall 6.5 · EvStr HIGH

**New surfaces (V4S28-only):**
- Main Bottleneck: Data acquisition
- Risk 3 archetype (founder_fit): D
- Evidence Strength: HIGH

---

## ARC-D2  *(Arc-D, PRO)*

**V4S27 baseline:** *(none — V4S28-new case)*


**V4S28:** MD 5.5 · MO 4.5 · OR 3.5 · TC 8.5 · Overall 4.6 · EvStr HIGH

**New surfaces (V4S28-only):**
- Main Bottleneck: Compliance
- Risk 3 archetype (founder_fit): D
- Evidence Strength: HIGH

---

## ARC-E1  *(Arc-E, PRO)*

**V4S27 baseline:** *(none — V4S28-new case)*


**V4S28:** MD 6.5 · MO 6 · OR 4.5 · TC 8 · Overall 5.7 · EvStr HIGH

**New surfaces (V4S28-only):**
- Main Bottleneck: Buyer access
- Risk 3 archetype (founder_fit): E
- Evidence Strength: HIGH

---

## G1-LONG-1500W  *(Sherpa, PRO)*

**V4S27 baseline:** *(none — V4S28-new case)*


**V4S28:** MD 6 · MO 6.5 · OR 5.5 · TC 7 · Overall 6 · EvStr HIGH

**New surfaces (V4S28-only):**
- Main Bottleneck: Trust/credibility
- Risk 3 archetype (founder_fit): null
- Evidence Strength: HIGH

---

## GATE-A1  *(Gate, PRO)*

**V4S27 baseline:** *(none — V4S28-new case)*


**V4S28:** MD 5.5 · MO 4.5 · OR 3.5 · TC 7 · Overall 4.6 · EvStr MEDIUM

**New surfaces (V4S28-only):**
- Main Bottleneck: Buyer access
- Risk 3 archetype (founder_fit): B
- Evidence Strength: MEDIUM — reason: "Pricing model not specified — per-seat, per-usage, and freemium would each lead to different Monetization Potential reads..."

---

## GATE-D2  *(Gate, PRO)*

**V4S27 baseline:** *(none — V4S28-new case)*


**V4S28:** MD 5.5 · MO 4.5 · OR 3.5 · TC 5.5 · Overall 4.6 · EvStr MEDIUM

**New surfaces (V4S28-only):**
- Main Bottleneck: Technical build
- Risk 3 archetype (founder_fit): A
- Evidence Strength: MEDIUM — reason: "Pricing model not specified — per-seat, per-usage, and freemium would each lead to different Monetization Potential reads..."

---

## GATE-G2  *(Gate, PRO)*

**V4S27 baseline:** *(none — V4S28-new case)*


**V4S28:** 🚪 GATED at Haiku Specificity layer (V8.1) — no scoring.

This is **expected behavior** for sparse inputs. V4S27 would have produced a score on this input (potentially with fabricated content). V4S28 gates upstream — the disease (sparse-input fabrication) is cured by a different mechanism than V4S27 attempted.


---

## OPTZ-MED  *(H-evidence, PRO)*

**V4S27 baseline:** *(none — V4S28-new case)*


**V4S28:** MD 6.5 · MO 6 · OR 4.5 · TC 7 · Overall 5.7 · EvStr HIGH

**New surfaces (V4S28-only):**
- Main Bottleneck: Buyer access
- Risk 3 archetype (founder_fit): B
- Evidence Strength: HIGH

---

## SPARSE-LOW  *(H-evidence, PRO)*

**V4S27 baseline:** *(none — V4S28-new case)*


**V4S28:** MD 6 · MO 5.5 · OR 4 · TC 7 · Overall 5.2 · EvStr MEDIUM

**New surfaces (V4S28-only):**
- Main Bottleneck: Technical build
- Risk 3 archetype (founder_fit): A
- Evidence Strength: MEDIUM — reason: "Pricing model not specified — per-seat, per-usage, and freemium would each lead to different Monetization Potential reads..."

---

## SPARSE-LOW-std  *(H-evidence, FREE)*

**V4S27 baseline:** *(none — V4S28-new case)*


**V4S28:** MD 5.5 · MO 6 · OR 4 · TC 6.5 · Overall 5.2 · EvStr HIGH

**New surfaces (V4S28-only):**
- Main Bottleneck: Buyer access
- Risk 3 archetype (founder_fit): null
- Evidence Strength: HIGH

---

## DOGFOOD-IDEALOOP  *(Z-dogfood, PRO)*

**V4S27 baseline:** *(none — V4S28-new case)*


**V4S28:** MD 5.5 · MO 4.5 · OR 4 · TC 6.5 · Overall 4.7 · EvStr HIGH

**New surfaces (V4S28-only):**
- Main Bottleneck: Distribution
- Risk 3 archetype (founder_fit): null
- Evidence Strength: HIGH