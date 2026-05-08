# F1 Phase 2C — Sampler Hardening Test

**Hypothesis:** top_k=1 + top_p=0.1 collapses the MO bimodality observed in production Phase B.

Sampler used: `temperature=0, top_k=1, top_p=0.1`
Reruns per case: 10
Bank median Spearman: 0.000

**Fully zero-variance cases: 6 / 8**

## Per-case stddev + Spearman

| Case | Runs | σ(MD) | σ(MO) | σ(OR) | ρ(MD,MO) | ρ(MD,OR) | ρ(MO,OR) | median ρ |
|---|---|---|---|---|---|---|---|---|
| AUDIT-H4 | 10 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| AUDIT-MAT2-beginner | 10 | 0.000 | 0.316 | 0.316 | 0.000 | 0.000 | -1.000 | 0.000 |
| ARC-D2 | 10 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| AUDIT-L2 | 10 | 0.000 | 0.753 | 0.264 | 0.000 | 0.000 | 0.962 | 0.000 |
| AUDIT-MD1 | 10 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| AUDIT-MAT1-intermediate | 10 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| AUDIT-M3 | 10 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| AUDIT-A2 | 10 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |

## Score arrays per case

| Case | MD | MO | OR |
|---|---|---|---|
| AUDIT-H4 | 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5 | 6, 6, 6, 6, 6, 6, 6, 6, 6, 6 | 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5 |
| AUDIT-MAT2-beginner | 6, 6, 6, 6, 6, 6, 6, 6, 6, 6 | 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 4.5, 5.5, 5.5 | 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 5.5, 4.5, 4.5 |
| ARC-D2 | 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5 | 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5 | 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5 |
| AUDIT-L2 | 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5 | 6, 4.5, 6, 4.5, 4.5, 6, 6, 6, 5, 4.5 | 4.5, 4, 4.5, 4, 4, 4.5, 4.5, 4.5, 4, 4 |
| AUDIT-MD1 | 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5 | 4, 4, 4, 4, 4, 4, 4, 4, 4, 4 | 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5 |
| AUDIT-MAT1-intermediate | 6, 6, 6, 6, 6, 6, 6, 6, 6, 6 | 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5 | 4, 4, 4, 4, 4, 4, 4, 4, 4, 4 |
| AUDIT-M3 | 6, 6, 6, 6, 6, 6, 6, 6, 6, 6 | 5, 5, 5, 5, 5, 5, 5, 5, 5, 5 | 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5 |
| AUDIT-A2 | 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5 | 5, 5, 5, 5, 5, 5, 5, 5, 5, 5 | 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5 |

## Comparison vs production Phase B (n=10)

Production Phase B observed: σ(MO) up to 0.78 (L2), 0.63 (ARC-D2), 0.21 (M3); MAT2-beginner had ρ(MO,OR)=−1 outlier.

**PARTIAL EFFECT.** Sampler hardening reduced variance on most cases but did not fully eliminate it. Layered fix likely required (sampler + prompt structure).