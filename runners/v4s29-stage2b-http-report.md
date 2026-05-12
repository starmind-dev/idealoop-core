# V4S29 Stage 2b Rigor Template — HTTP Verification Report

**OVERALL VERDICT: ❌ FAIL**

### Headline numbers
- Cases passing: **4 of 7** (need ≥ 7)
- N/A (excluded): **1** of 8
- B2 false-positive guard: **❌ FAIL**
- M2 false-positive guard: **✅ pass**
- Hard failures: **2** (need 0)
  - ❌ AUDIT-A3: MD 7.0+ or MO 7.0+ event(s): MD=[6.5,7.5,6.5,6.5,6] MO=[6,6.5,6,6,6.5]
  - ❌ AUDIT-MAT2-senior: OR 7.0+ event(s): OR=[5.5,5.5,7,4.5,5.5]
- Watch zones (soft, not failing): **2**
  - ⚠️ AUDIT-MAT3-tech-no-access: Mostly 6.5 not 6.0 — hedge discipline fired but Row 8 partial
  - ⚠️ AUDIT-MAT2-beginner: Mostly 6.5 not 6.0 — 'success-fee aligns' invalid-base rule partial
- Reruns per case: 5

### Overall pass requirements (all must be true)
1. ❌ 4 of 7 cases passed (need ≥ 7)
2. ❌ No hard failures
3. ❌ B2 false-positive guard passed
4. ✅ M2 false-positive guard passed

## Per-case results

| Case | Label | Status |
|---|---|---|
| AUDIT-B2 | Mixed CONTROL (false-positive guard, MO 6.5 defensible) | ❌ fail |
| AUDIT-A3 | Generous (MD 6.5 trigger uncertainty) | ❌ HARD FAIL |
| AUDIT-MAT3-tech-no-access | Generous (MO 7.0 'requires critical mass' hedge attacks core) | ✅ pass ⚠️ watch |
| AUDIT-MAT2-beginner | Generous (MO 7.0 success-fee structural alignment) | ✅ pass ⚠️ watch |
| AUDIT-MAT2-senior | OR volatility canonical (May 5 Layer E event 5.5→7.0→5.5) | ❌ HARD FAIL |
| AUDIT-L1 | Anchor disease (likely gates upstream) | 🚪 N/A |
| AUDIT-L2 | Anchor disease (MO at cap boundary) | ✅ pass |
| AUDIT-M2 | Well-justified CONTROL (false-positive guard, domain-relevant founder) | ✅ pass |

## Score arrays per case

| Case | MD | MO | OR | Gated? |
|---|---|---|---|---|
| AUDIT-B2 | 6.5, 6, 6, 6, 6 | 5.5, 6.5, 5.5, 5.5, 6.5 | 4.5, 4.5, 4.5, 4.5, 5 | 0 / 5 |
| AUDIT-A3 | 6.5, 7.5, 6.5, 6.5, 6 | 6, 6.5, 6, 6, 6.5 | 4, 4.5, 4.5, 4.5, 4 | 0 / 5 |
| AUDIT-MAT3-tech-no-access | 6, 6, 6, 6, 6 | 6.5, 5.5, 5.5, 6.5, 5.5 | 4.5, 4.5, 4, 4.5, 4.5 | 0 / 5 |
| AUDIT-MAT2-beginner | 6, 6.5, 6, 6, 6.5 | 6.5, 6, 6.5, 6.5, 6 | 5.5, 6.5, 5.5, 5.5, 5.5 | 0 / 5 |
| AUDIT-MAT2-senior | 6, 6.5, 6.5, 6, 6 | 6.5, 6, 6, 6.5, 6.5 | 5.5, 5.5, 7, 4.5, 5.5 | 0 / 5 |
| AUDIT-L1 | G, G, G, G, G | G, G, G, G, G | G, G, G, G, G | 5 / 5 |
| AUDIT-L2 | 6, 5.5, 5.5, 6, 5.5 | 6.5, 6, 6, 6.5, 6 | 4.5, 4.5, 4.5, 4, 4.5 | 0 / 5 |
| AUDIT-M2 | 6, 6, 6, 6, 6 | 5.5, 5.5, 5.5, 6.5, 5 | 4.5, 4.5, 4.5, 4.5, 4 | 0 / 5 |

## Per-case verdicts

### AUDIT-B2 — ❌ FAIL
**Label:** Mixed CONTROL (false-positive guard, MO 6.5 defensible)

**Expectation:** 4/5 MO in [6.0, 6.5]; no MO < 5.0 (downward FP); no MO ≥ 7.0 (upward FP).

**Detail:** `{"mo":[5.5,6.5,5.5,5.5,6.5],"inBand":2,"noDownFP":true,"noUpFP":true}`

### AUDIT-A3 — ❌ HARD FAIL
**Label:** Generous (MD 6.5 trigger uncertainty)

**Expectation:** Hard pass: no MD 7.0+ AND no MO 7.0+. Strong pass: 4/5 runs MD ≤ 6.0 AND MO ≤ 6.0.

**Hard failure:** MD 7.0+ or MO 7.0+ event(s): MD=[6.5,7.5,6.5,6.5,6] MO=[6,6.5,6,6,6.5]

**Detail:** `{"md":[6.5,7.5,6.5,6.5,6],"mo":[6,6.5,6,6,6.5],"mdLowCount":1,"moLowCount":3,"moOKCount":5,"noHigh":false,"strongPass":false}`

### AUDIT-MAT3-tech-no-access — ✅ PASS (⚠️ WATCH ZONE)
**Label:** Generous (MO 7.0 'requires critical mass' hedge attacks core)

**Expectation:** Hard pass: no MO 7.0+. Strong pass: 4/5 MO ≤ 6.0.

**Watch zone:** Mostly 6.5 not 6.0 — hedge discipline fired but Row 8 partial

**Detail:** `{"mo":[6.5,5.5,5.5,6.5,5.5],"moOKCount":5,"moLowCount":3,"noHigh":true,"strongPass":false}`

### AUDIT-MAT2-beginner — ✅ PASS (⚠️ WATCH ZONE)
**Label:** Generous (MO 7.0 success-fee structural alignment)

**Expectation:** Hard pass: no MO 7.0+. Strong pass: 4/5 MO ≤ 6.0.

**Watch zone:** Mostly 6.5 not 6.0 — 'success-fee aligns' invalid-base rule partial

**Detail:** `{"mo":[6.5,6,6.5,6.5,6],"moOKCount":5,"moLowCount":2,"noHigh":true,"strongPass":false}`

### AUDIT-MAT2-senior — ❌ HARD FAIL
**Label:** OR volatility canonical (May 5 Layer E event 5.5→7.0→5.5)

**Expectation:** No OR 7.0+ events; OR stays 5.0-6.5

**Hard failure:** OR 7.0+ event(s): OR=[5.5,5.5,7,4.5,5.5]

**Detail:** `{"or":[5.5,5.5,7,4.5,5.5],"noHigh":false,"inBand":3}`

### AUDIT-L1 — 🚪 N/A
**Label:** Anchor disease (likely gates upstream)

**Expectation:** If gates: N/A (excluded from denominator). If scores: MO ≤ 6.0.

**Detail:** `{"gated":5,"reason":"all runs gated upstream"}`

### AUDIT-L2 — ✅ PASS
**Label:** Anchor disease (MO at cap boundary)

**Expectation:** Hard pass: no MO 7.0+ events.

**Detail:** `{"mo":[6.5,6,6,6.5,6],"noHigh":true}`

### AUDIT-M2 — ✅ PASS
**Label:** Well-justified CONTROL (false-positive guard, domain-relevant founder)

**Expectation:** Baseline May 10: MD=6.5 MO=5.25 OR=4.5. 4/5 within ±0.5; no metric drops ≥1.0 in more than 1 run.

**Detail:** `{"md":[6,6,6,6,6],"mo":[5.5,5.5,5.5,6.5,5],"or":[4.5,4.5,4.5,4.5,4],"allWithinBand":4,"dropEventCount":0,"baseline":{"md":6.5,"mo":5.25,"or":4.5}}`

## Next steps

- ❌ Verification FAILED. Do NOT ship.
- 2 hard failure(s) — these are catastrophic; diagnose each before iterating.
- B2 guard failed: prompt may be over- or under-firing. Check MO direction.