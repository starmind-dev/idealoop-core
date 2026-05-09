# Bundle 2 Verification — Full Pipeline

Sampler hardening on Stage 2a/2b/TC. Stage 2c and Stage 3 unchanged.
3 reruns/case across 4 cases.
Total pipeline errors: **0**

## Decision criteria (locked before run)

| Case | Threshold | Pass? |
|---|---|---|
| ARC-D2 | σ all metrics ≤ 0.20 | ❌ |
| AUDIT-L2 | σ(MO) ≤ 0.50; σ(MD,OR,TC) ≤ 0.30 | ❌ |
| AUDIT-MAT2-beginner | σ(MO)+σ(OR) ≤ 1.20; σ(MD,TC) ≤ 0.30 | ✅ |
| DOGFOOD-IDEALOOP | Reported only | 📊 observational |

## Score variance per case

| Case | σ(MD) | σ(MO) | σ(OR) | σ(TC) | Range MO |
|---|---|---|---|---|---|
| ARC-D2 | 0.471 | 1.027 | 0.408 | 0.000 | 2.500 |
| AUDIT-L2 | 0.236 | 0.707 | 0.236 | 0.000 | 1.500 |
| AUDIT-MAT2-beginner | 0.236 | 0.624 | 0.236 | 0.000 | 1.500 |
| DOGFOOD-IDEALOOP | 0.236 | 0.236 | 0.408 | 0.000 | 0.500 |

## Score arrays per case

| Case | MD | MO | OR | TC |
|---|---|---|---|---|
| ARC-D2 | 5.5, 5.5, 4.5 | 6, 4.5, 3.5 | 4, 3.5, 3 | 8.5, 8.5, 8.5 |
| AUDIT-L2 | 6, 5.5, 5.5 | 4.5, 4.5, 6 | 4, 4, 4.5 | 7.5, 7.5, 7.5 |
| AUDIT-MAT2-beginner | 6.5, 6, 6.5 | 6, 4.5, 5.5 | 5.5, 5.5, 6 | 7.5, 7.5, 7.5 |
| DOGFOOD-IDEALOOP | 6, 5.5, 5.5 | 4.5, 4, 4 | 4, 3.5, 4.5 | 6.5, 6.5, 6.5 |

## Out-of-scope variance (informational — Bundle 2 did not address)

These come from Stage 2c (failure_risks, summary, evidence_strength) and Stage 3 (main_bottleneck), which were intentionally not hardened. Variance here is expected and tracked as separate B10a findings.

| Case | evidence_strength | failure_risks count | failure_risks slots (per run) | main_bottleneck |
|---|---|---|---|---|
| ARC-D2 | HIGH×2, MEDIUM×1 | 3×3 | [market_category|trust_adoption|founder_fit:D] [market_category|trust_adoption|founder_fit:D] [market_category|trust_adoption|founder_fit:D] | Compliance×3 |
| AUDIT-L2 | MEDIUM×1, HIGH×2 | 3×3 | [market_category|trust_adoption|founder_fit:A] [market_category|trust_adoption|founder_fit:A] [market_category|trust_adoption|founder_fit:A] | Technical build×2, Distribution×1 |
| AUDIT-MAT2-beginner | HIGH×1, MEDIUM×2 | 3×3 | [market_category|trust_adoption|founder_fit:A] [market_category|trust_adoption|founder_fit:A] [market_category|trust_adoption|founder_fit:B] | Trust/credibility×3 |
| DOGFOOD-IDEALOOP | HIGH×3 | 2×1, 3×2 | [market_category|trust_adoption|founder_fit:B] [market_category|trust_adoption] [market_category|trust_adoption|founder_fit:B] | Buyer access×2, Distribution×1 |

## Pipeline health

| Case | runs ✓ | errors | avg duration | overall score range |
|---|---|---|---|---|
| ARC-D2 | 3 | 0 | 171.6s | 3.70 – 5.20 |
| AUDIT-L2 | 3 | 0 | 149.5s | 4.70 – 5.30 |
| AUDIT-MAT2-beginner | 3 | 0 | 146.5s | 5.40 – 6.00 |
| DOGFOOD-IDEALOOP | 3 | 0 | 160.3s | 4.40 – 4.90 |

## Verdict

**PARTIAL** — 1/3 per-case thresholds met. Inspect failing cases above.

If failures are on residual cases (L2, MAT2-beginner) at slightly higher variance than predicted: residual is real but the cure still works on its target class. Decision call.
If ARC-D2 failed: sampler hardening did not deliver in production. Investigate.

## DOGFOOD-IDEALOOP detail (observational)

This is your idea evaluated under the cure. No threshold — reported for product judgment.

- σ(MD)=0.236 σ(MO)=0.236 σ(OR)=0.408 σ(TC)=0.000
- Range: MD=0.500 MO=0.500 OR=1.000 TC=0.000
- evidence_strength: HIGH×3
- main_bottleneck: Buyer access×2, Distribution×1
- failure_risks (per run): [market_category|trust_adoption|founder_fit:B] [market_category|trust_adoption] [market_category|trust_adoption|founder_fit:B]
- overall scores: 4.90, 4.40, 4.70
