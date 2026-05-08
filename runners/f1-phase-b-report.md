# F1 Phase B — Stage 2b Independence Report

**VERDICT:** AMBIGUOUS — neither signature fully fired — escalate via --tier-2 (10 reruns/case)

- Reruns per case: 10
- Bank median Spearman: 0.000

## Per-case stddev + Spearman

| Case | Runs | σ(MD) | σ(MO) | σ(OR) | ρ(MD,MO) | ρ(MD,OR) | ρ(MO,OR) | median ρ |
|---|---|---|---|---|---|---|---|---|
| AUDIT-H4 | 10 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| AUDIT-MAT2-beginner | 10 | 0.000 | 0.316 | 0.316 | 0.000 | 0.000 | -1.000 | 0.000 |
| ARC-D2 | 10 | 0.000 | 0.632 | 0.158 | 0.000 | 0.000 | 0.667 | 0.000 |
| AUDIT-L2 | 10 | 0.000 | 0.775 | 0.258 | 0.000 | 0.000 | 1.000 | 0.000 |
| AUDIT-MD1 | 10 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| AUDIT-MAT1-intermediate | 10 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| AUDIT-M3 | 10 | 0.000 | 0.211 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| AUDIT-A2 | 10 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |

## Score arrays (per rerun)

| Case | MD | MO | OR |
|---|---|---|---|
| AUDIT-H4 | 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5 | 6, 6, 6, 6, 6, 6, 6, 6, 6, 6 | 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5 |
| AUDIT-MAT2-beginner | 6, 6, 6, 6, 6, 6, 6, 6, 6, 6 | 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 4.5, 5.5, 5.5 | 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 5.5, 4.5, 4.5 |
| ARC-D2 | 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5 | 4.5, 4.5, 6, 6, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5 | 3.5, 3.5, 4, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5 |
| AUDIT-L2 | 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5 | 4.5, 6, 6, 6, 4.5, 6, 6, 6, 4.5, 4.5 | 4, 4.5, 4.5, 4.5, 4, 4.5, 4.5, 4.5, 4, 4 |
| AUDIT-MD1 | 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5 | 4, 4, 4, 4, 4, 4, 4, 4, 4, 4 | 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5 |
| AUDIT-MAT1-intermediate | 6, 6, 6, 6, 6, 6, 6, 6, 6, 6 | 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5 | 4, 4, 4, 4, 4, 4, 4, 4, 4, 4 |
| AUDIT-M3 | 6, 6, 6, 6, 6, 6, 6, 6, 6, 6 | 5, 4.5, 4.5, 5, 5, 5, 5, 5, 5, 5 | 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5 |
| AUDIT-A2 | 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5 | 5, 5, 5, 5, 5, 5, 5, 5, 5, 5 | 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5 |

## Verdict signature trace

```json
{
  "v1b": {
    "v1b_arcd2_oronly": false,
    "v1b_l2_moonly": false,
    "v1b_bankspearman": true,
    "fired": false
  },
  "v1a": {
    "v1a_arcd2": false,
    "v1a_h4": false,
    "v1a_m3": false,
    "v1a_bankspearman": false,
    "fired": false
  },
  "bankSpearman": 0,
  "arcd2_stddev": {
    "md": 0,
    "mo": 0.6324555320336759,
    "or": 0.15811388300841894
  },
  "l2_stddev": {
    "md": 0,
    "mo": 0.7745966692414834,
    "or": 0.2581988897471611
  },
  "h4_medianSpearman": 0,
  "m3_medianSpearman": 0
}
```

## Cure direction

**Escalate to Tier-2 verification.** Re-run with `--tier-2 --resume` to extend 5 reruns/case to 10 reruns/case. Tier-2 may resolve the ambiguity by tightening confidence intervals on the per-case stddev and Spearman estimates.

If Tier-2 still produces AMBIGUOUS, the architectural conversation re-opens with this data — the verdict logic needs design review, not threshold relaxation (per Methodology Principle 6).