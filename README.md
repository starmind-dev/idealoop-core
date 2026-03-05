# IdeaValidator

**Portfolio Case Study — Emre, March 2026**

**Live:** https://idea-validator-pink-zeta.vercel.app/

---

## 1. What It Is

My app evaluates ideas based on four metrics: market demand, monetization potential, originality, and technical complexity. The app is for people who have ideas but don't know if the time spent on them is worth it. It requires your familiarity with AI, with coding, your profession, and finally your idea. After your input, a comparison part, an execution part, and finally an evaluation part comes. The app changes its technical complexity ratings based on your profile input.

---

## 2. Architecture Decisions

All of the structure-related decisions were made by AI while I observed. Here is the structure and why it works:

**Single-File Frontend.** A single-file frontend and shared state pattern was used to avoid complexity in the frontend. In an app this size, where all screens share the same data—profile, idea text, analysis results—a single file keeps everything accessible without passing data between separate components.

**Server-Side Score Calculation.** The server-side score calculation was sent to JS instead of letting the LLM compute math, because LLMs predict math rather than calculating it. The alternative—letting Claude calculate the overall score inside the prompt—would risk inconsistent results, since an LLM might round differently across runs.

**Inline Styles Over Tailwind.** Tailwind is a CSS framework that applies styles through class names. The layout broke visually on phones, and the fix was removing the Tailwind classes and writing the styles directly on the elements as inline styles.

---

## 3. Prompt Engineering

**Temperature 0.** We decided to set the temperature at 0 to prevent the randomness that AI created, to prevent inconsistent results in the results page. Before this change, the same input produced overall scores ranging from 5.7 to 6.2 across five runs. After setting temperature to 0, three runs produced identical results every time.

**Structured JSON Output.** We designed a structured JSON output so that the frontend knows what to put and where to put it in a structured way, without having to guess. Without JSON, the LLM could phrase its response differently each time, and the code wouldn't be able to reliably extract scores, competitor names, or phase details.

**Calibration Anchors.** Calibration anchors are designed to prevent inconsistent scores and false high or wrong low points. We also set the bar high—getting a 9–10 is nearly impossible. The app doesn't give out random 8s or 10s that are originally 5s or 7s. We added weights (30/25/25/20) for the metrics to give the user a proper evaluation, prioritizing market demand as the strongest signal.

**Ethics Filter.** The ethics filter is set to prevent anything unethical in words or means. The app is for people who have ideas and want to know their potential. We can't allow harm's way in an app related to hope.

---

## 4. Scoring Rubric Design

We used the four metrics—market demand, monetization potential, originality, and technical complexity—because these four cover every need to evaluate an idea. Is the market needing this idea? Can this idea make money? Is this done before? Is it hard to do? Those four questions are everybody's questions when an idea pops into their head.

We gave market demand the highest weight because without market demand, your idea is not applicable. We gave technical complexity the lowest weight because this is an idea validator—it's about people's hope. No matter how hard the technical complexity is, it shouldn't affect that much a person who is committed to their idea firmly. Of course, we did that but kept our ground with reality.

We tested our rubric with four different AI models because we were trying to build a trustworthy, non-guessing, solid rubric. Later tests proved we were on the right track—we got the same results with most of the AI models we used (70% of metrics within 0.5 gap across models).

Technical complexity is the only metric where a higher score is worse for the user. The formula inverts it: (10 − TC). A high market demand is good, a high originality is good, but a high technical complexity means the idea is harder to build. About the naming—we tried "technical feasibility" but it didn't quite work. That was a personal decision rather than a rational decision.

---

## 5. What Went Wrong

**Hydration Flash.** The hydration problem occurred because the profile page was popping out before the idea page could have a chance to load. This happens because the app couldn't instantly detect that saved profiles were in localStorage and skip through to the idea screen. The page renders first, then JavaScript runs, then useEffect checks localStorage. During that gap, the profile screen appears for a split second. It's cosmetic—nothing breaks.

**LLM-Generated Competitors.** V1 is LLM-generated, and the users are right to have this concern. Having an LLM-generated competitor list is not 100% trustworthy data, and the LLM might create a competitor that doesn't exist. A user could search a competitor from the app, find nothing, and immediately lose trust in the entire evaluation. To prevent this, I'm planning to work with the Product Hunt API, GitHub API, and Google API to search live data.

**Vercel Timeout Risk.** Vercel's free tier has a 10-second limit on server functions. We tested with 8,000+ word inputs, and Vercel servers and Anthropic servers were working fine—the output didn't fail. But if Vercel servers are a little slow or if Anthropic has latency, we can't guarantee that the user's request won't time out. The fix would be upgrading to Vercel Pro or switching to streaming responses.

---

## 6. What I Learned

Before this project, I felt intimidated by the technical jargon, but it got easier to handle. I thought the AI was going to hallucinate and give wrong answers, but the output was a lot better after I optimized for my approach—this is for Claude specifically; I had problems with ChatGPT. My prompt engineering skills changed in input: I can tell a lot more with fewer words. I thought AI relied on me for co-working, but the truth was the opposite. When I hit usage limits, I didn't know what to do.

---

## 7. What's Next

For V2, we are thinking of upgrading the comparison feature. Instead of LLM output, we intend to replace it with the Product Hunt API, GitHub API, and Google API for live data. For V3, we are thinking of adding a My Ideas Hub for saving your evaluated ideas, and for paid users, we are thinking of branching them and using AI as guidance to improve their idea—and also a progress tracking feature for users that want to follow their idea's progress. Our direction is ideas and the possibilities of those ideas becoming real. Our improvements will be centered around those two concepts.

---

**Stack:** Next.js + Anthropic API (claude-sonnet-4-20250514) + Tailwind CSS