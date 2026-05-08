# F1 Test 4 — MAT2-beginner under MO Tightening

**Hypothesis:** MO band tightening eliminates the MO↔OR swap pattern observed in production at 1/10 rate.

Production baseline (n=10): σ(MO)=0.316, σ(OR)=0.316, ρ(MO,OR)=−1.000. Run 8 outlier: MO 5.5→4.5, OR 4.5→5.5.

## Counterfactual results (n=10)

| Metric | σ counterfactual | σ production | Outcome |
|---|---|---|---|
| MD | 0.158 | 0.000 | (no change expected) |
| MO | 0.707 | 0.316 | persisted |
| OR | 0.725 | 0.316 | persisted |
| ρ(MO,OR) | -0.913 | -1.000 | altered |

## Score arrays

MD: 5.5, 5.5, 5.5, 5.5, 6, 5.5, 5.5, 5.5, 5.5, 5.5
MO: 4.5, 6, 6, 4.5, 5.5, 6, 6, 4.5, 6, 6
OR: 6, 4.5, 4.5, 6, 4.5, 4.5, 4.5, 6, 4.5, 4.5

## Verdict

**ALTERED PATTERN.** Variance present but the swap correlation has changed shape. Inspect explanations to characterize new mechanism.

## Reasoning text per run

### Run 1 (MD=5.5 MO=4.5 OR=6)
**MO:** Score 4.5, rubric level 3-4. The 25% success fee eliminates upfront cost barriers and only charges on successful recoveries. However, monetization is structurally pressured because small businesses currently handle disputes at no additional cost through manual processes, and benefits brokers provide dispute assistance as part of existing relationships without separate fees. The typical dollar value of recoverable claims and acceptability of 25% fees versus free alternatives remains unresolved.

**OR:** Score 6.0, rubric level 5-6. Real differentiation exists as no direct competitors target small business employers specifically for insurance disputes - Authsnap, Counterforce, and Rivet Resolve focus on healthcare providers or individual patients. However, benefits brokers already serve small businesses with established relationships and comprehensive benefits knowledge, making it moderately difficult but not impossible for them to expand into specialized claim dispute services. Building a structured database of successful dispute precedents across 10,000+ small business cases would create a knowledge moat that benefits brokers couldn't replicate without significant case volume investment.

### Run 2 (MD=5.5 MO=6 OR=4.5)
**MO:** Score 5-6, identifiable buyer with comparable revenue mechanism. Success fee model eliminates upfront costs and only charges on recovered claims, addressing cost sensitivity. However, small businesses currently handle disputes at no additional cost through manual processes, and benefits brokers provide dispute assistance without separate fees, creating pricing pressure against free alternatives.

**OR:** Score 3-4, minor twist with trivial replication path. While no direct competitors target small business employers specifically (Authsnap, Counterforce, Rivet Resolve focus on providers/patients), benefits brokers already serve small businesses with established relationships and comprehensive benefits knowledge. They could easily expand claim dispute services as a competitive response without significant architectural changes. Building a structured database of successful dispute precedents across insurance carriers would create a knowledge moat that benefits brokers couldn't replicate without extensive case history collection.

### Run 3 (MD=5.5 MO=6 OR=4.5)
**MO:** Score 5-6, identifiable buyer with comparable revenue mechanism. Small business employers are named buyers, success fee model eliminates upfront costs unlike software licensing approaches, and the 25% fee structure is specified. However, free alternatives exist through manual processes and benefits brokers who provide dispute assistance without separate fees, creating pricing pressure against the success fee model.

**OR:** Score 3-4, minor twist with trivial replication path. While no direct competitors target small business employers specifically (Authsnap, Counterforce, Rivet Resolve focus on providers/patients), benefits brokers already serve small businesses with established relationships and comprehensive benefits knowledge. These incumbents could easily expand claim dispute services as a competitive response without significant architectural changes. Building specialized regulatory expertise in multi-state insurance dispute procedures would create a more defensible position against benefits broker expansion.

### Run 4 (MD=5.5 MO=4.5 OR=6)
**MO:** Score 4.5, rubric level 3-4. The 25% success fee eliminates upfront cost barriers and only charges on successful recoveries. However, monetization faces structural pressure from free alternatives - small businesses currently handle disputes at no additional cost through manual processes, and benefits brokers provide dispute assistance as part of existing relationships without separate fees. Success depends on claim values being high enough to justify the fee versus free options.

**OR:** Score 6.0, rubric level 5-6. Real differentiation exists as no direct competitors target small business employers specifically - Authsnap, Counterforce, and Rivet Resolve focus on healthcare providers or individual patients. However, benefits brokers already serve small businesses with established relationships and comprehensive benefits knowledge, making expansion into specialized claim dispute services a moderate effort rather than fundamental redesign. Building proprietary data on small business claim patterns and success rates across insurance carriers would create a moat benefits brokers couldn't replicate without significant case volume.

### Run 5 (MD=6 MO=5.5 OR=4.5)
**MO:** Score 5-6, rubric level 5-6. Success fee model eliminates upfront costs and only charges on recovery, addressing buyer concerns about risk. However, small businesses currently handle disputes at no additional cost through manual processes, and benefits brokers provide dispute assistance as part of existing relationships without separate fees, creating structural pricing pressure against the 25% fee.

**OR:** Score 3-4, rubric level 3-4. While no direct competitors target small business employers specifically (Authsnap, Counterforce, Rivet Resolve focus on providers/patients), benefits brokers already serve this market with established relationships and comprehensive benefits knowledge. They could easily expand claim dispute services as a competitive response. Building a structured database of successful dispute precedents across 1,000+ small business cases would create a knowledge moat benefits brokers couldn't replicate without significant case volume.

### Run 6 (MD=5.5 MO=6 OR=4.5)
**MO:** Score 5-6, identifiable buyer with comparable revenue mechanism. The 25% success fee eliminates upfront costs and only charges on recovery, addressing a clear willingness-to-pay signal. However, small businesses currently handle disputes at no additional cost, and benefits brokers provide dispute assistance without separate fees, creating pricing pressure against free alternatives.

**OR:** Score 3-4, minor differentiation but easily replicable. While no direct competitors target small business employers specifically (Authsnap, Counterforce, Rivet Resolve focus on providers/patients), benefits brokers already serve this market with established relationships and comprehensive benefits knowledge. They could easily expand claim dispute services with moderate effort. Building a structured database of successful dispute precedents across 1,000+ small business cases would create a knowledge moat competitors couldn't replicate without significant case volume.

### Run 7 (MD=5.5 MO=6 OR=4.5)
**MO:** Score 5-6, identifiable buyer with comparable revenue mechanism. The 25% success fee eliminates upfront costs and only charges on recovery, addressing a clear willingness-to-pay signal. However, small businesses currently handle disputes at no additional cost, and benefits brokers provide dispute assistance without separate fees, creating pricing pressure against free alternatives.

**OR:** Score 3-4, minor twist with trivial replication path. While no direct competitors target small business employers specifically (Authsnap, Counterforce, Rivet Resolve focus on providers/patients), benefits brokers already serve this market with established relationships and comprehensive benefits knowledge. They could easily expand claim dispute services as a competitive response. Building a structured database of successful dispute precedents across insurance carriers and claim types would create a knowledge moat that benefits brokers couldn't replicate without significant case volume investment.

### Run 8 (MD=5.5 MO=4.5 OR=6)
**MO:** Score 4.5, rubric level 3-4. The 25% success fee eliminates upfront cost barriers and only charges on recovery, but monetization is structurally pressured by free alternatives. Small businesses currently handle disputes at no additional cost through manual processes, and benefits brokers provide dispute assistance as part of existing relationships without separate fees. Success depends on claim values being high enough to justify the fee versus free options.

**OR:** Score 6.0, rubric level 5-6. Real differentiation exists as no direct competitors target small business employers specifically, with Authsnap, Counterforce, and Rivet Resolve focused on healthcare providers or individual patients. However, benefits brokers already serve small businesses with established relationships and comprehensive benefits knowledge, making expansion into specialized claim dispute services a moderate effort rather than fundamental redesign. Building a structured database of small business claim patterns and recovery precedents across 1,000+ cases would create a knowledge moat benefits brokers couldn't replicate without significant case volume investment.

### Run 9 (MD=5.5 MO=6 OR=4.5)
**MO:** Score 5-6, identifiable buyer with comparable revenue mechanism. The 25% success fee eliminates upfront costs and only charges on recovery, addressing a clear willingness-to-pay signal. However, small businesses currently handle disputes at no additional cost, and benefits brokers provide dispute assistance as part of existing relationships without separate fees, creating pricing pressure.

**OR:** Score 3-4, minor twist with trivial replication path. While no direct competitors target small business employers specifically (Authsnap, Counterforce, Rivet Resolve focus on providers/patients), benefits brokers already serve this market with established relationships and comprehensive benefits knowledge. They could easily expand claim dispute services as a competitive response. Building a structured database of successful dispute precedents across insurance carriers would create a knowledge moat that benefits brokers couldn't replicate without significant case volume investment.

### Run 10 (MD=5.5 MO=6 OR=4.5)
**MO:** Score 5-6, identifiable buyer with comparable revenue mechanism. Success fee model eliminates upfront costs and only charges on recovered claims, addressing small business budget constraints. However, businesses currently handle disputes at no additional cost through manual processes, and benefits brokers provide dispute assistance without separate fees, creating pricing pressure against free alternatives.

**OR:** Score 3-4, minor differentiation but easily replicable. While no direct competitors target small business employers specifically (Authsnap, Counterforce, Rivet Resolve focus on providers/patients), benefits brokers already serve small businesses with established relationships and comprehensive benefits knowledge. They could easily expand claim dispute services as a competitive response. Building a structured database of successful dispute precedents across 1,000+ small business cases would create a knowledge moat competitors couldn't replicate without significant case volume.
