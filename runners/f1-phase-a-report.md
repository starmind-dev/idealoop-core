# F1 Phase A — Stage 2a Stability Report

**VERDICT:** PASS — overall median Jaccard 1.000 ≥ 0.7

- Pass threshold: median Jaccard ≥ 0.7
- Reruns per case: 5
- Overall median Jaccard: 1.000

## Per-case Jaccard medians

| Case | Runs | Median (all packets) | MD | MO | OR |
|---|---|---|---|---|---|
| AUDIT-H4 | 5 | 1.000 | 1.000 | 1.000 | 1.000 |
| AUDIT-MAT2-beginner | 5 | 0.833 | 1.000 | 0.286 | 1.000 |
| ARC-D2 | 5 | 1.000 | 1.000 | 1.000 | 1.000 |
| AUDIT-L2 | 5 | 1.000 | 1.000 | 1.000 | 0.333 |
| AUDIT-MD1 | 5 | 1.000 | 1.000 | 1.000 | 1.000 |

## Fact counts per rerun

| Case | MD counts | MO counts | OR counts |
|---|---|---|---|
| AUDIT-H4 | 5, 5, 5, 5, 5 | 4, 4, 4, 4, 4 | 5, 5, 5, 5, 5 |
| AUDIT-MAT2-beginner | 5, 5, 5, 5, 5 | 5, 4, 4, 4, 5 | 5, 5, 5, 5, 5 |
| ARC-D2 | 5, 5, 5, 5, 5 | 5, 5, 5, 5, 5 | 5, 5, 5, 5, 5 |
| AUDIT-L2 | 4, 4, 4, 4, 4 | 4, 4, 4, 4, 4 | 4, 4, 4, 4, 4 |
| AUDIT-MD1 | 5, 5, 5, 5, 5 | 4, 4, 4, 4, 4 | 5, 5, 5, 5, 5 |

## Interpretation

Stage 2a is sufficiently stable across reruns. Phase B can proceed and will measure Stage 2b's independence with confidence that variance flowing into Stage 2b reruns is not Stage 2a-driven.