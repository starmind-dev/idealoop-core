# V4S29 Stage 2a Rigor Template — HTTP Verification Report

**OVERALL VERDICT: ❌ FAIL**

Layer 2 (score stability) gates the verdict. Layer 1 (Stage 2a behavioral) is diagnostic — documents whether predicted behavioral compression occurred.

## Layer 2 — Score stability (verdict gate)

### Headline numbers
- Cases passing: **5 of 7** (need ≥ 7)
- N/A (excluded): **1** of 8
- B2 false-positive guard: **✅ pass**
- M2 false-positive guard: **❌ FAIL**
- Hard failures: **1** (need 0)
  - ❌ AUDIT-A3: MD 7.0+ or MO 7.0+ event(s): MD=[6,6.5,7.5,6,6.5] MO=[6.5,6,6,5.5,5.5]
- Watch zones (soft, not failing): **1**
  - ⚠️ AUDIT-MAT2-beginner: Mostly 6.5 not 6.0 — 'success-fee aligns' anchor blocked but ceiling not down to 6.0
- Reruns per case: 5

### Overall pass requirements (all must be true)
1. ❌ 5 of 7 cases passed (need ≥ 7)
2. ❌ No hard failures
3. ✅ B2 false-positive guard passed
4. ❌ M2 false-positive guard passed

### Per-case score-stability results

| Case | Label | Status |
|---|---|---|
| AUDIT-B2 | Mixed CONTROL (false-positive guard, MO 6.5 defensible) | ✅ pass |
| AUDIT-A3 | Generous (MD 6.5 trigger uncertainty) | ❌ HARD FAIL |
| AUDIT-MAT3-tech-no-access | Generous (MO 7.0 'requires critical mass' hedge attacks core) | ✅ pass |
| AUDIT-MAT2-beginner | Generous (MO 7.0 success-fee structural alignment) | ✅ pass ⚠️ watch |
| AUDIT-MAT2-senior | OR volatility canonical (Stage 2b 1-in-5 spike to 7.0 watch zone) | ✅ pass |
| AUDIT-L1 | Anchor disease (likely gates upstream) | 🚪 N/A |
| AUDIT-L2 | Anchor disease (MO at cap boundary) | ✅ pass |
| AUDIT-M2 | Well-justified CONTROL (false-positive guard, domain-relevant founder) | ❌ fail |

### Score arrays per case

| Case | MD | MO | OR | Gated? |
|---|---|---|---|---|
| AUDIT-B2 | 6.5, 6, 6.5, 6, 6 | 6, 6.5, 6, 5, 6.5 | 5.5, 4.5, 5.5, 5.5, 5 | 0 / 5 |
| AUDIT-A3 | 6, 6.5, 7.5, 6, 6.5 | 6.5, 6, 6, 5.5, 5.5 | 4.5, 4.5, 4.5, 4.5, 4.5 | 0 / 5 |
| AUDIT-MAT3-tech-no-access | 6, 6, 6, 6, 5.5 | 5.5, 5.5, 5.5, 6.5, 6 | 4.5, 4.5, 4.5, 4.5, 4.5 | 0 / 5 |
| AUDIT-MAT2-beginner | 6, 6, 6, 6, 6 | 6.5, 6.5, 6.5, 5.5, 6.5 | 5.5, 5.5, 5.5, 6.5, 6.5 | 0 / 5 |
| AUDIT-MAT2-senior | 6.5, 5.5, 6, 6, 6 | 6, 6, 6.5, 6.5, 6.5 | 5.5, 6.5, 5.5, 5.5, 5.5 | 0 / 5 |
| AUDIT-L1 | G, G, G, G, G | G, G, G, G, G | G, G, G, G, G | 5 / 5 |
| AUDIT-L2 | 6, 6, 6, 6, 5.5 | 6, 6, 6, 6, 6 | 4.5, 4.5, 4.5, 4.5, 4.5 | 0 / 5 |
| AUDIT-M2 | 6, 6, 6, 6.5, 6 | 5.5, 5, 5.5, 5.5, 5 | 5, 5.5, 4.5, 6, 6.5 | 0 / 5 |

## Layer 1 — Stage 2a behavioral analysis (diagnostic)

These measures document whether locked rows produced predicted behavioral compression. They do NOT gate the verdict but flag rows where compression may be partial.

### Anchor stability (Row 5)
Distinct anchor count across reruns. Stable = ≤ 2 distinct fingerprints out of 5 runs.

| Case | MD sp / sn | MO sp / sn | OR sp / sn |
|---|---|---|---|
| AUDIT-B2 | 4✗ / 5✗ | 5✗ / 5✗ | 5✗ / 4✗ |
| AUDIT-A3 | 2✓ / 4✗ | 4✗ / 5✗ | 4✗ / 4✗ |
| AUDIT-MAT3-tech-no-access | 3✗ / 2✓ | 3✗ / 3✗ | 3✗ / 4✗ |
| AUDIT-MAT2-beginner | 4✗ / 5✗ | 5✗ / 5✗ | 5✗ / 5✗ |
| AUDIT-MAT2-senior | 4✗ / 5✗ | 4✗ / 5✗ | 5✗ / 5✗ |
| AUDIT-L1 | (skipped) | | |
| AUDIT-L2 | 2✓ / 3✗ | 3✗ / 3✗ | 3✗ / 3✗ |
| AUDIT-M2 | 3✗ / 4✗ | 3✗ / 5✗ | 5✗ / 4✗ |

### Lens consistency (Row 6)
Unresolved-uncertainty lens classification across reruns. Stable = all reruns same lens.

| Case | MD lens (count) | MO lens (count) | OR lens (count) |
|---|---|---|---|
| AUDIT-B2 | MARKET-SIDE (1d)✓ | MARKET-SIDE (1d)✓ | MARKET-SIDE (1d)✓ |
| AUDIT-A3 | MARKET-SIDE (1d)✓ | MARKET-SIDE (1d)✓ | MARKET-SIDE (1d)✓ |
| AUDIT-MAT3-tech-no-access | MARKET-SIDE (1d)✓ | MARKET-SIDE (1d)✓ | MARKET-SIDE (1d)✓ |
| AUDIT-MAT2-beginner | MARKET-SIDE (1d)✓ | MARKET-SIDE (1d)✓ | MARKET-SIDE (1d)✓ |
| AUDIT-MAT2-senior | MARKET-SIDE (1d)✓ | MARKET-SIDE (1d)✓ | MARKET-SIDE (1d)✓ |
| AUDIT-L1 | (skipped) | | |
| AUDIT-L2 | MARKET-SIDE (1d)✓ | MARKET-SIDE (1d)✓ | MARKET-SIDE (1d)✓ |
| AUDIT-M2 | MARKET-SIDE (1d)✓ | MARKET-SIDE (1d)✓ | MARKET-SIDE (1d)✓ |

### Fact-density distribution (Row 7)
Hard cap is 4 facts (non-sparse). Pre-session: 0% of MD/OR packets at 2-3 facts. Post-session prediction: bulk at 3-4, zero at 5.

Total packets analyzed: **105**
Hard-cap violations (>4 facts): **0** (should be 0)

Distribution per packet (count of packets at N facts):

- **market_demand**: 4=35
- **monetization**: 3=10, 4=25
- **originality**: 3=2, 4=33

### Primary-framing test compliance (Row 1 + Row 3)
strongest_positive entries scanned against Row 1 negation patterns. Predicted: 0 violations (down from MAT2-senior R1 success-fee disease).

Total anchors scanned: **105**
Violations: **0**

### Anchor diversity / no monoculture (Row 8 Item 11)
Detect runs where the same competitor anchors strongest_positive in all three packets.

Monoculture instances: **0** (pre-session corpus baseline: 1/78 ≈ 1.3%)

### Tag determinism (Row 4 — focused probe on A3 OR)
Stability test for the canonical [domain_flag] ↔ [narrative_field] drift on A3 OR regulatory-barriers fact.

- **A3 OR regulatory-barriers fact tag stability**: 4 distinct tag(s) across 11 observations — ❌ drifted
  - run 1: [narrative_field]
  - run 2: [idea_description]
  - run 2: [domain_flag]
  - run 3: [competitor]
  - run 3: [idea_description]
  - run 3: [domain_flag]
  - run 3: [competitor]
  - run 4: [narrative_field]
  - run 4: [idea_description]
  - run 5: [idea_description]
  - run 5: [domain_flag]

## Per-case verdicts (Layer 2 detail)

### AUDIT-B2 — ✅ PASS
**Label:** Mixed CONTROL (false-positive guard, MO 6.5 defensible)

**Expectation:** 4/5 MO in [6.0, 6.5]; no MO < 5.0 (downward FP); no MO ≥ 7.0 (upward FP). Stage 2a should NOT regress this case.

**Detail:** `{"mo":[6,6.5,6,5,6.5],"inBand":4,"noDownFP":true,"noUpFP":true}`

### AUDIT-A3 — ❌ HARD FAIL
**Label:** Generous (MD 6.5 trigger uncertainty)

**Expectation:** Hard pass: no MD 7.0+ AND no MO 7.0+. Strong pass: 4/5 runs MD ≤ 6.0 AND MO ≤ 6.0. Stage 2a session should compress MD spike (was watch zone in 2b verify).

**Hard failure:** MD 7.0+ or MO 7.0+ event(s): MD=[6,6.5,7.5,6,6.5] MO=[6.5,6,6,5.5,5.5]

**Detail:** `{"md":[6,6.5,7.5,6,6.5],"mo":[6.5,6,6,5.5,5.5],"mdLowCount":2,"moLowCount":4,"moOKCount":5,"noHigh":false,"strongPass":false}`

### AUDIT-MAT3-tech-no-access — ✅ PASS
**Label:** Generous (MO 7.0 'requires critical mass' hedge attacks core)

**Expectation:** Hard pass: no MO 7.0+. Strong pass: 4/5 MO ≤ 6.0.

**Detail:** `{"mo":[5.5,5.5,5.5,6.5,6],"moOKCount":5,"moLowCount":4,"noHigh":true,"strongPass":true}`

### AUDIT-MAT2-beginner — ✅ PASS (⚠️ WATCH ZONE)
**Label:** Generous (MO 7.0 success-fee structural alignment)

**Expectation:** Hard pass: no MO 7.0+. Strong pass: 4/5 MO ≤ 6.0. Stage 2a Row 1 negation + Row 3 primary-framing should compound with 2b Row 4 to lock this.

**Watch zone:** Mostly 6.5 not 6.0 — 'success-fee aligns' anchor blocked but ceiling not down to 6.0

**Detail:** `{"mo":[6.5,6.5,6.5,5.5,6.5],"moOKCount":5,"moLowCount":1,"noHigh":true,"strongPass":false}`

### AUDIT-MAT2-senior — ✅ PASS
**Label:** OR volatility canonical (Stage 2b 1-in-5 spike to 7.0 watch zone)

**Expectation:** No OR 7.0+ events; OR stays 5.0-6.5. Stage 2a Row 5 anchor stability should resolve the 1-in-5 spike.

**Detail:** `{"or":[5.5,6.5,5.5,5.5,5.5],"noHigh":true,"inBand":5}`

### AUDIT-L1 — 🚪 N/A
**Label:** Anchor disease (likely gates upstream)

**Expectation:** If gates: N/A (excluded from denominator). If scores: MO ≤ 6.0.

**Detail:** `{"gated":5,"reason":"all runs gated upstream"}`

### AUDIT-L2 — ✅ PASS
**Label:** Anchor disease (MO at cap boundary)

**Expectation:** Hard pass: no MO 7.0+ events.

**Detail:** `{"mo":[6,6,6,6,6],"noHigh":true}`

### AUDIT-M2 — ❌ FAIL
**Label:** Well-justified CONTROL (false-positive guard, domain-relevant founder)

**Expectation:** Baseline May 10: MD=6.5 MO=5.25 OR=4.5. 4/5 within ±0.5; no metric drops ≥1.0 in more than 1 run. Stage 2a should NOT regress this case.

**Detail:** `{"md":[6,6,6,6.5,6],"mo":[5.5,5,5.5,5.5,5],"or":[5,5.5,4.5,6,6.5],"allWithinBand":2,"dropEventCount":0,"baseline":{"md":6.5,"mo":5.25,"or":4.5}}`

## Next steps

- ❌ Verification FAILED. Do NOT ship prompt-stage2a.js until issues are addressed.
- 1 hard failure(s) — these are catastrophic; diagnose each before iterating.
- M2 guard failed: well-justified case being unfairly downgraded. Check whether Stage 2a admissibility tightening over-pruned legitimate facts.
- Cross-reference Layer 1 behavioral data: rows showing high anchor variance or many primary-framing violations are likely the source of Layer 2 failures.