# IdeaValidator

**Portfolio Case Study — Emre, March 2026**

**Live:** https://idea-validator-pink-zeta.vercel.app/

---

# IdeaValidator

**Portfolio Case Study — Emre, March 2026**

**Live:** https://idea-validator-pink-zeta.vercel.app/
**Repo:** https://github.com/starmind-dev/idea-validator-

---

## 1. What It Is

My app uses live data from Google & GitHub to validate your idea with real data. It gives you real competitors and shows how your idea differs from them, then evaluates your idea across four metrics: market demand, originality, monetization potential, and technical complexity. From there it generates an execution roadmap for putting your idea into practice, recommends tools tailored to that roadmap, and finishes with an estimated time and difficulty.

---

## 2. Architecture Decisions

**Single-File Frontend.** A single-file frontend and shared state pattern was used to avoid complexity in the frontend. In an app this size, where all screens share the same data — profile, idea text, analysis results — a single file keeps everything accessible without passing data between separate components.

**Server-Side Score Calculation.** The server-side score calculation was sent to JS instead of letting the LLM compute math, because LLMs predict math rather than calculating it. The alternative — letting Claude calculate the overall score inside the prompt — would risk inconsistent results, since an LLM might round differently across runs.

**Inline Styles Over Tailwind.** Tailwind is a CSS framework that applies styles through class names. The layout broke visually on phones, and the fix was removing the Tailwind classes and writing the styles directly on the elements as inline styles.

**Haiku for Keyword Extraction.** At first our plan was to write a keyword extraction function, but when we ran tests, results were consistently wrong and inconsistent. The problem was that an incorrect competitor list creates a chain reaction all the way to the execution phase. Compound concepts got split — "machine learning" became "machine" and "learning" separately. Verbs and adverbs ranked the same as nouns, which polluted the search queries. We had two options: redesign the function or use a single fast, cheap call to Claude. The cheapest model was Haiku.

---

## 3. Prompt Engineering

**Temperature 0.** Before this change, the same input produced overall scores ranging from 5.7 to 6.2 across five runs. After setting temperature to 0, three runs produced identical results every time. In V2 this changed — the competitor list now comes from live GitHub and Google data, which shifts over time. Two runs of the same idea might return different competitors and produce a slightly different overall score. A difference of under 1 point between runs is not meaningful. It doesn't mean the idea got worse — it means the live data returned different results that day.

**Structured JSON Output.** We designed a structured JSON output so that the frontend knows what to put and where to put it in a structured way, without having to guess. Without JSON, the LLM could phrase its response differently each time, and the code wouldn't be able to reliably extract scores, competitor names, or phase details.

**Calibration Anchors.** Calibration anchors are designed to prevent inconsistent scores and false high or wrong low points. We also set the bar high — getting a 9–10 is nearly impossible. The app doesn't give out random 8s or 10s that are originally 5s or 7s. We added weights (30/25/25/20) for the metrics to give the user a proper evaluation, prioritizing market demand as the strongest signal.

**Ethics Filter.** The ethics filter is set to prevent anything unethical in words or means. The app is for people who have ideas and want to know their potential. We can't allow harm's way in an app related to hope.

**Multi-Query Coverage.** One search query wasn't enough for complex ideas with many distinct concepts. Haiku extracts 5 keywords from the idea, and those keywords generate 4 different search queries — 2 for GitHub and 2 for Google — each using a different combination of keywords. All 4 run simultaneously so there's no extra time cost. Different combinations catch different competitors. Running one query against the whole keyword set would miss things that a different combination would find.

---

## 4. Scoring Rubric Design

We used the four metrics — market demand, monetization potential, originality, and technical complexity — because these four cover every need to evaluate an idea. Is the market needing this idea? Can this idea make money? Is this done before? Is it hard to do? Those four questions are everybody's questions when an idea pops into their head.

We gave market demand the highest weight because without market demand, your idea is not applicable. We gave technical complexity the lowest weight because this is an idea validator — it's about people's hope. No matter how hard the technical complexity is, it shouldn't affect that much a person who is committed to their idea firmly. Of course, we did that but kept our ground with reality.

We tested our rubric with four different AI models because we were trying to build a trustworthy, non-guessing, solid rubric. Later tests proved we were on the right track — we got the same results with most of the AI models we used (70% of metrics within 0.5 gap across models).

Technical complexity is the only metric where a higher score is worse for the user. The formula inverts it: (10 − TC). A high market demand is good, a high originality is good, but a high technical complexity means the idea is harder to build. About the naming — we tried "technical feasibility" but it didn't quite work. That was a personal decision rather than a rational decision.

---

## 5. What Went Wrong

**Hydration Flash.** The hydration problem occurred because the profile page was popping out before the idea page could have a chance to load. This happens because the app couldn't instantly detect that saved profiles were in localStorage and skip through to the idea screen. The page renders first, then JavaScript runs, then useEffect checks localStorage. During that gap, the profile screen appears for a split second. It's cosmetic — nothing breaks.

**LLM-Generated Competitors.** V1 is LLM-generated, and the users are right to have this concern. Having an LLM-generated competitor list is not 100% trustworthy data, and the LLM might create a competitor that doesn't exist. A user could search a competitor from the app, find nothing, and immediately lose trust in the entire evaluation.

*V2 Resolution:* V2 deployment redefined our app entirely. Instead of LLM generated competitor data, now it's Google & GitHub verified data. The results themselves can be noisy due to irrelevant repos, SEO optimized landing pages, etc. That's our limitation, we can't guarantee that you are going to get 100% real data. At least we are getting real data instead of LLM generated.

**Vercel Timeout Risk.** Vercel's free tier has a 10-second limit on server functions. We tried it with a 10,000 word input on the live Vercel URL and it loaded for 40-50 seconds, then returned results successfully. No server failures were noted during tests. But it doesn't mean it won't cause failures in the future. We are going to keep testing and if we find errors, we are going to try to fix it.

---

## 6. What I Learned

Before this project, I felt intimidated by the technical jargon, but it got easier to handle. I thought the AI was going to hallucinate and give wrong answers, but the output was a lot better after I optimized for my approach — this is for Claude specifically; I had problems with ChatGPT. My prompt engineering skills changed in input: I can tell a lot more with fewer words. I thought AI relied on me for co-working, but the truth was the opposite. When I hit usage limits, I didn't know what to do.

I learned that using an LLM for language problems is a better approach than a hand-coded approach. We first tried keyword extraction as a function but the results were inconsistent. So we changed our approach and went for a single fast cheap call from the cheapest model, Haiku, for keyword extraction. We adjusted the amount of keywords and how to extract them properly — compound concepts, verbs and adverbs, etc.

---

## 7. What's Next

Our planned features for V3: 1) Save your evaluations after you're done. Track progress on saved ideas — mark phases complete, add notes. 2) Re-evaluate an idea when the roadmap feels outdated. 3) Compare any two saved ideas side by side. All of these require a database and user authentication which we intend to implement in V3.

After V3: Chained API — competition informs scoring, scoring informs roadmap, smarter analysis. Idea branching — take a suggestion, apply it, re-evaluate automatically. The monetization engine. B2B tier: sell the evaluation framework to incubators and accelerators.

---

**Stack:** Next.js · Anthropic API (claude-haiku-4-5-20251001 + claude-sonnet-4-20250514) · GitHub API · Serper.dev · Inline CSS · Vercel