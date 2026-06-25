import React, { useRef, useEffect } from "react";

/*
 * LandingView — IdeaLoop Core public marketing landing page.
 *
 * Faithful build of the approved Claude Design landing (no Tailwind, inline styles only).
 *
 * ───────────────────────────────────────────────────────────────────────────
 *  EASY-TO-FILL STUBS (left intentionally inert for now — see memory):
 *
 *  1. PRICING — the numbers below are the ONLY place pricing copy lives. When the
 *     real PAYG / free-tier model is confirmed, edit this object; the cards read
 *     from it. (Until then it mirrors the current design exactly.)
 *
 *  2. SAMPLE_LOOP_URL — set this to a real read-only sample-lineage URL to make the
 *     "View sample loop" buttons appear + work. While it is null, those buttons are
 *     hidden (the rest of the layout is unaffected). Flip one constant to ship it.
 *
 *  3. Handlers (onStartLoop / onLogIn / onStartFree / onGetCredits) are passed in as
 *     props so the routing gate in page.js decides what "enter the app" means.
 * ───────────────────────────────────────────────────────────────────────────
 */

// ── Sample loop: set to a real URL later to enable the "View sample loop" buttons.
const SAMPLE_LOOP_URL = null;

// ── Pricing config (single source of truth for the pricing section copy/numbers).
//    NOTE: reconcile against the real credit model before launch.
const PRICING = {
  free:    { price: "$0",  meta: "to start · 150 credits on sign-up" },
  credits: { price: "$19", per: "/ 1,000 credits", meta: "no subscription · never expires" },
  rates:   { explore: "≈ 20 credits", deep: "≈ 120 credits", reeval: "≈ 80 credits", compare: "included" },
};

function smoothScrollTo(el) {
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function LandingView({
  onStartLoop = () => {},
  onLogIn = () => {},
  onStartFree,
  onGetCredits,
  onViewSample,
}) {
  const boardRef = useRef(null);

  // ── Fit-scaler for the hero lineage board (1240px design → scales to container).
  useEffect(() => {
    const wrap = boardRef.current;
    if (!wrap) return;
    const fit = () => {
      const inner = wrap.firstElementChild;
      if (!inner) return;
      const avail = wrap.clientWidth || 1240;
      const s = Math.min(1, avail / 1240);
      inner.style.transform = "scale(" + s + ")";
      inner.style.left = (s >= 1 ? (avail - 1240) / 2 : 0) + "px";
      wrap.style.height = (560 * s) + "px";
    };
    fit();
    const raf = requestAnimationFrame(fit);
    window.addEventListener("resize", fit);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", fit);
    };
  }, []);

  // ── Load display + mono faces (Spectral / JetBrains Mono) once.
  useEffect(() => {
    const id = "ilc-landing-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,400;0,500;0,600;1,400&family=JetBrains+Mono:wght@400;500&display=swap";
    document.head.appendChild(link);
  }, []);

  const scrollToId = (id) => smoothScrollTo(document.getElementById(id));

  // Default the optional handlers to the primary CTA / nothing as appropriate.
  const handleStartFree = onStartFree || onStartLoop;
  const handleGetCredits = onGetCredits || onStartLoop;
  const handleViewSample =
    onViewSample || (() => { if (SAMPLE_LOOP_URL) window.open(SAMPLE_LOOP_URL, "_blank"); });

  // Local aliases used inside the markup below.
  const onStartFreeFn = handleStartFree;
  const onGetCreditsFn = handleGetCredits;
  const onViewSampleFn = handleViewSample;

  return (
        <div style={{ background: "#09090b", color: "#f4f4f5", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif", WebkitFontSmoothing: "antialiased", overflowX: "hidden" }}>
          <header style={{ position: "sticky", top: "0", zIndex: "50", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 40px", background: "rgba(9,9,11,0.82)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ color: "#34d8a8", fontSize: "21px" }}>
                ∞
              </span>
              <span style={{ fontWeight: "700", fontSize: "16px" }}>
                IdeaLoop Core
              </span>
            </div>
            <nav style={{ display: "flex", alignItems: "center", gap: "30px", fontSize: "14px", color: "#b4b4bd" }}>
              <span onClick={() => scrollToId("how-it-works")} style={{ cursor: "pointer" }}>
                How it works
              </span>
              <span onClick={() => scrollToId("the-loop")} style={{ cursor: "pointer" }}>
                The loop
              </span>
              <span onClick={() => scrollToId("pricing")} style={{ cursor: "pointer" }}>
                Pricing
              </span>
            </nav>
            <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
              <span onClick={onLogIn} style={{ fontSize: "14px", color: "#a1a1aa", cursor: "pointer" }}>
                Log in
              </span>
              <span onClick={onStartLoop} style={{ fontSize: "14px", fontWeight: "600", color: "#fff", background: "#8b7ff0", padding: "9px 18px", borderRadius: "10px", cursor: "pointer" }}>
                Start an idea loop
              </span>
            </div>
          </header>
          <section style={{ position: "relative", textAlign: "center", padding: "58px 24px 0", maxWidth: "1180px", margin: "0 auto" }}>
            <div style={{ position: "absolute", top: "-40px", left: "50%", transform: "translateX(-50%)", width: "760px", height: "380px", background: "radial-gradient(ellipse at center, rgba(52,216,168,0.10), rgba(139,127,240,0.06) 45%, transparent 70%)", pointerEvents: "none" }}></div>
            <div style={{ position: "relative" }}>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "12px", letterSpacing: ".18em", color: "#6b7280", display: "inline-flex", alignItems: "center", gap: "9px", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "999px", padding: "7px 16px" }}>
                <span style={{ color: "#34d8a8" }}>
                  ∞
                </span>
                THE DECISION WORKSPACE FOR FOUNDERS
              </div>
              <h1 style={{ fontFamily: "'Spectral',serif", fontWeight: "500", fontSize: "60px", lineHeight: "1.07", letterSpacing: "-0.02em", margin: "26px auto 0", maxWidth: "880px", color: "#fafafa" }}>
                Your startup idea needs a decision workspace, not another AI answer.
              </h1>
              <p style={{ fontFamily: "'Spectral',serif", fontStyle: "italic", fontSize: "20px", color: "#8a8a93", margin: "20px 0 0" }}>
                You asked everywhere. It remembered nowhere.
              </p>
              <p style={{ fontSize: "18px", lineHeight: "1.6", color: "#b4b4bd", margin: "22px auto 0", maxWidth: "680px" }}>
                Turn one rough product idea into a living loop: explore angles, stress-test risks, re-evaluate changes, compare versions, and decide whether to
                <span style={{ color: "#f0f0f1", fontWeight: "500" }}>
                  build, change, or kill
                </span>
                .
              </p>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "9px", flexWrap: "wrap", marginTop: "22px", fontFamily: "'JetBrains Mono',monospace", fontSize: "12px" }}>
                <span style={{ color: "#d4d4d8", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", padding: "8px 13px" }}>
                  Paste idea
                </span>
                <span style={{ color: "#52525b" }}>
                  →
                </span>
                <span style={{ color: "#8aa9f7", background: "rgba(107,147,245,0.08)", border: "1px solid rgba(107,147,245,0.22)", borderRadius: "8px", padding: "8px 13px" }}>
                  Explore
                </span>
                <span style={{ color: "#52525b" }}>
                  →
                </span>
                <span style={{ color: "#b3a3f5", background: "rgba(157,134,240,0.08)", border: "1px solid rgba(157,134,240,0.22)", borderRadius: "8px", padding: "8px 13px" }}>
                  Deep Analysis
                </span>
                <span style={{ color: "#52525b" }}>
                  →
                </span>
                <span style={{ color: "#5fe3bd", background: "rgba(52,216,168,0.07)", border: "1px solid rgba(52,216,168,0.24)", borderRadius: "8px", padding: "8px 13px" }}>
                  Re-evaluate
                </span>
                <span style={{ color: "#52525b" }}>
                  →
                </span>
                <span style={{ color: "#a6b6f5", background: "rgba(142,162,240,0.08)", border: "1px solid rgba(142,162,240,0.22)", borderRadius: "8px", padding: "8px 13px" }}>
                  Compare
                </span>
                <span style={{ color: "#52525b" }}>
                  →
                </span>
                <span style={{ color: "#08120e", background: "#5fe3bd", border: "1px solid #5fe3bd", borderRadius: "8px", padding: "8px 13px", fontWeight: "600" }}>
                  Decide
                </span>
              </div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "12px", color: "#9a9aa3", marginTop: "14px" }}>
                Paste a rough idea — one sentence is enough.
              </div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "11.5px", color: "#71717a", margin: "7px auto 0", maxWidth: "580px", lineHeight: "1.5" }}>
                Every decision becomes a handoff brief — first move, order, and the gates that send you back into the loop.
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "14px", marginTop: "26px" }}>
                <span onClick={onStartLoop} style={{ fontSize: "15.5px", fontWeight: "600", color: "#fff", background: "#8b7ff0", padding: "14px 28px", borderRadius: "12px", cursor: "pointer", boxShadow: "0 8px 30px rgba(139,127,240,0.3)" }}>
                  Start an idea loop →
                </span>
                {SAMPLE_LOOP_URL ? (
                <span onClick={onViewSampleFn} style={{ fontSize: "15.5px", fontWeight: "500", color: "#d4d4d8", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", padding: "14px 24px", borderRadius: "12px", cursor: "pointer" }}>
                  View sample loop
                </span>
                ) : null}
              </div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "12px", color: "#52525b", marginTop: "18px" }}>
                NO CARD TO START · FREE CREDITS ON SIGN-UP
              </div>
            </div>
            <div style={{ position: "relative", marginTop: "40px", borderRadius: "16px", border: "1px solid rgba(255,255,255,0.09)", background: "#0b0b0f", boxShadow: "0 40px 120px rgba(0,0,0,0.6)", overflow: "hidden", textAlign: "left" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "13px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <span style={{ width: "11px", height: "11px", borderRadius: "50%", background: "#ef6a6a", opacity: ".7" }}></span>
                <span style={{ width: "11px", height: "11px", borderRadius: "50%", background: "#e0a857", opacity: ".7" }}></span>
                <span style={{ width: "11px", height: "11px", borderRadius: "50%", background: "#34d8a8", opacity: ".7" }}></span>
                <span style={{ marginLeft: "14px", fontFamily: "'JetBrains Mono',monospace", fontSize: "11px", color: "#5b5b64" }}>
                  idealoop.core / lineage — AI procurement RFP analyzer
                </span>
              </div>
              <div style={{ padding: "14px" }}>
                <div style={{ background: "radial-gradient(120% 90% at 30% -10%, #141326 0%, #0c0c14 50%, #08080d 100%)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "18px", padding: "24px 14px 22px", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif", overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "11px", letterSpacing: ".16em", color: "#71717a" }}>
                      IDEA EVOLUTION · ONE SPARK, FIVE GENERATIONS
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "16px", fontSize: "11.5px", color: "#9a9aa3" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#8a8a93" }}></span>
                        Rough
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#6b93f5" }}></span>
                        Explore
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#9d86f0" }}></span>
                        Deep
                      </span>
                      <span style={{ width: "1px", height: "12px", background: "rgba(255,255,255,0.12)" }}></span>
                      <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#34d8a8" }}></span>
                        Active
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#e0a857" }}></span>
                        Parked
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#ef6a6a" }}></span>
                        Killed
                      </span>
                    </div>
                  </div>
                  <div style={{ position: "relative", width: "100%", height: "560px", overflow: "hidden" }} ref={boardRef}>
                    <div style={{ position: "absolute", left: "0", top: "0", width: "1240px", height: "560px", transformOrigin: "top left" }}>
                      <div style={{ position: "absolute", left: "20px", top: "6px", width: "200px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ width: "19px", height: "19px", borderRadius: "50%", border: "1px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'JetBrains Mono',monospace", fontSize: "10px", color: "#c8c8cc" }}>
                            1
                          </span>
                          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "11px", letterSpacing: ".12em", color: "#8a8a93" }}>
                            SPARK
                          </span>
                        </div>
                        <div style={{ fontSize: "11.5px", color: "#5b5b64", marginTop: "6px" }}>
                          where it began
                        </div>
                      </div>
                      <div style={{ position: "absolute", left: "262px", top: "6px", width: "170px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ width: "19px", height: "19px", borderRadius: "50%", border: "1px solid rgba(107,147,245,0.4)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'JetBrains Mono',monospace", fontSize: "10px", color: "#8aa9f7" }}>
                            2
                          </span>
                          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "11px", letterSpacing: ".12em", color: "#8aa9f7" }}>
                            EXPLORE
                          </span>
                        </div>
                        <div style={{ fontSize: "11.5px", color: "#5b5b64", marginTop: "6px" }}>
                          widened into angles
                        </div>
                      </div>
                      <div style={{ position: "absolute", left: "532px", top: "6px", width: "200px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ width: "19px", height: "19px", borderRadius: "50%", border: "1px solid rgba(157,134,240,0.4)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'JetBrains Mono',monospace", fontSize: "10px", color: "#b3a3f5" }}>
                            3
                          </span>
                          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "11px", letterSpacing: ".12em", color: "#b3a3f5" }}>
                            DEEP
                          </span>
                        </div>
                        <div style={{ fontSize: "11.5px", color: "#5b5b64", marginTop: "6px" }}>
                          put under pressure
                        </div>
                      </div>
                      <div style={{ position: "absolute", left: "812px", top: "6px", width: "200px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ width: "19px", height: "19px", borderRadius: "50%", border: "1px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'JetBrains Mono',monospace", fontSize: "10px", color: "#c8c8cc" }}>
                            4
                          </span>
                          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "11px", letterSpacing: ".12em", color: "#c8c8cc" }}>
                            EVOLVE
                          </span>
                        </div>
                        <div style={{ fontSize: "11.5px", color: "#5b5b64", marginTop: "6px" }}>
                          reshaped & forked
                        </div>
                      </div>
                      <div style={{ position: "absolute", left: "1035px", top: "6px", width: "205px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ width: "19px", height: "19px", borderRadius: "50%", border: "1px solid rgba(52,216,168,0.45)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'JetBrains Mono',monospace", fontSize: "10px", color: "#5fe3bd" }}>
                            5
                          </span>
                          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "11px", letterSpacing: ".12em", color: "#5fe3bd" }}>
                            TODAY
                          </span>
                        </div>
                        <div style={{ fontSize: "11.5px", color: "#5b5b64", marginTop: "6px" }}>
                          the one you’re backing
                        </div>
                      </div>
                      <svg viewBox="0 0 1240 560" width="1240" height="560" style={{ position: "absolute", inset: "0", overflow: "visible" }}>
                        <defs>
                          <lineargradient id="spine" x1="0" y1="0" x2="1240" y2="0" gradientUnits="userSpaceOnUse">
                            <stop offset="0%" stopColor="#8a8a93" />
                            <stop offset="22%" stopColor="#6b93f5" />
                            <stop offset="52%" stopColor="#9d86f0" />
                            <stop offset="80%" stopColor="#6b93f5" />
                            <stop offset="100%" stopColor="#34d8a8" />
                          </lineargradient>
                          <filter id="sglow" x="-30%" y="-60%" width="160%" height="220%">
                            <fegaussianblur stdDeviation="5"></fegaussianblur>
                          </filter>
                        </defs>
                        <path d="M210,300 C238,250 248,150 270,128" stroke="rgba(255,255,255,0.1)" strokeWidth="1.3" fill="none" strokeDasharray="3 5" />
                        <path d="M210,300 C238,308 248,320 270,322" stroke="rgba(255,255,255,0.1)" strokeWidth="1.3" fill="none" strokeDasharray="3 5" />
                        <path d="M210,300 C238,345 248,408 270,414" stroke="rgba(255,255,255,0.1)" strokeWidth="1.3" fill="none" strokeDasharray="3 5" />
                        <path d="M418,414 C470,420 500,424 540,424" stroke="rgba(239,106,106,0.28)" strokeWidth="1.3" fill="none" strokeDasharray="3 5" />
                        <path d="M912,272 C912,312 912,332 912,360" stroke="rgba(224,168,87,0.3)" strokeWidth="1.3" fill="none" strokeDasharray="3 5" />
                        <path d="M210,300 C238,272 250,238 270,232 M418,232 C470,236 500,242 540,242 M745,242 C775,238 795,228 820,226 M1020,226 C1027,232 1030,242 1035,248" stroke="url(#spine)" strokeWidth="7" fill="none" opacity="0.18" filter="url(#sglow)" />
                        <path d="M210,300 C238,272 250,238 270,232" stroke="url(#spine)" strokeWidth="2.4" fill="none" />
                        <path d="M418,232 C470,236 500,242 540,242" stroke="url(#spine)" strokeWidth="2.4" fill="none" />
                        <path d="M745,242 C775,238 795,228 820,226" stroke="url(#spine)" strokeWidth="2.4" fill="none" />
                        <path d="M1020,226 C1027,232 1030,242 1035,248" stroke="url(#spine)" strokeWidth="2.4" fill="none" />
                      </svg>
                      <div style={{ position: "absolute", left: "20px", top: "252px", width: "192px", background: "rgba(255,255,255,0.028)", border: "1px solid rgba(255,255,255,0.11)", borderRadius: "14px", padding: "14px 15px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ width: "22px", height: "22px", borderRadius: "7px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9a9aa3" strokeWidth="1.7">
                              <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18" />
                            </svg>
                          </span>
                          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "9px", letterSpacing: ".14em", color: "#8a8a93" }}>
                            ROUGH
                          </span>
                        </div>
                        <div style={{ fontSize: "13.5px", color: "#e4e4e7", fontWeight: "500", marginTop: "11px" }}>
                          The rough spark
                        </div>
                        <div style={{ fontSize: "12px", color: "#8a8a93", marginTop: "6px", lineHeight: "1.45" }}>
                          “An AI that reads RFP responses for government procurement teams.”
                        </div>
                      </div>
                      <div style={{ position: "absolute", left: "270px", top: "106px", width: "150px", background: "rgba(255,255,255,0.018)", border: "1px solid rgba(107,147,245,0.16)", borderRadius: "11px", padding: "10px 13px", opacity: "0.5" }}>
                        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "8.5px", letterSpacing: ".12em", color: "#8aa9f7" }}>
                          ANGLE
                        </div>
                        <div style={{ fontSize: "12.5px", color: "#bdbdc4", marginTop: "5px" }}>
                          Positioning shift
                        </div>
                        <div style={{ fontSize: "10.5px", color: "#5b5b64", marginTop: "3px" }}>
                          faded — not pursued
                        </div>
                      </div>
                      <div style={{ position: "absolute", left: "270px", top: "210px", width: "158px", background: "linear-gradient(150deg,rgba(22,28,44,0.95),rgba(13,15,23,0.95))", border: "1px solid rgba(107,147,245,0.4)", borderRadius: "11px", padding: "10px 13px", boxShadow: "0 0 24px rgba(107,147,245,0.1)" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "8.5px", letterSpacing: ".12em", color: "#8aa9f7" }}>
                            ANGLE · PURSUED
                          </span>
                          <svg width="34" height="13" viewBox="0 0 34 13" fill="none">
                            <polyline points="2,9 9,4 16,7 24,3 32,6" stroke="#6b7c9e" strokeWidth="1.1" />
                          </svg>
                        </div>
                        <div style={{ fontSize: "12.5px", color: "#e4e4e7", fontWeight: "500", marginTop: "6px" }}>
                          Target wedge
                        </div>
                        <div style={{ fontSize: "10.5px", color: "#8aa9f7", marginTop: "3px" }}>
                          municipal & county entry
                        </div>
                      </div>
                      <div style={{ position: "absolute", left: "270px", top: "300px", width: "150px", background: "rgba(255,255,255,0.018)", border: "1px solid rgba(107,147,245,0.16)", borderRadius: "11px", padding: "10px 13px", opacity: "0.5" }}>
                        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "8.5px", letterSpacing: ".12em", color: "#8aa9f7" }}>
                          ANGLE
                        </div>
                        <div style={{ fontSize: "12.5px", color: "#bdbdc4", marginTop: "5px" }}>
                          Distribution shift
                        </div>
                        <div style={{ fontSize: "10.5px", color: "#5b5b64", marginTop: "3px" }}>
                          faded — not pursued
                        </div>
                      </div>
                      <div style={{ position: "absolute", left: "270px", top: "392px", width: "150px", background: "rgba(255,255,255,0.018)", border: "1px solid rgba(107,147,245,0.16)", borderRadius: "11px", padding: "10px 13px", opacity: "0.62" }}>
                        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "8.5px", letterSpacing: ".12em", color: "#8aa9f7" }}>
                          ANGLE
                        </div>
                        <div style={{ fontSize: "12.5px", color: "#cdcdd4", marginTop: "5px" }}>
                          Use-case shift
                        </div>
                        <div style={{ fontSize: "10.5px", color: "#5b5b64", marginTop: "3px" }}>
                          led to a dead end ↓
                        </div>
                      </div>
                      <div style={{ position: "absolute", left: "540px", top: "200px", width: "205px", background: "linear-gradient(150deg,rgba(26,21,40,0.95),rgba(14,12,20,0.95))", border: "1px solid rgba(157,134,240,0.4)", borderRadius: "14px", padding: "14px 16px", boxShadow: "0 0 26px rgba(157,134,240,0.1)" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ width: "22px", height: "22px", borderRadius: "7px", background: "rgba(157,134,240,0.16)", border: "1px solid rgba(157,134,240,0.36)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#b3a3f5" strokeWidth="1.7">
                                <circle cx="12" cy="12" r="8" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                            </span>
                            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "9px", letterSpacing: ".14em", color: "#b3a3f5" }}>
                              DEEP
                            </span>
                          </div>
                          <span style={{ fontFamily: "'Spectral',serif", fontSize: "19px", color: "#e4e4e7" }}>
                            4.7
                          </span>
                        </div>
                        <div style={{ fontSize: "13.5px", color: "#e8e8ea", fontWeight: "500", marginTop: "11px" }}>
                          First verdict
                        </div>
                        <div style={{ fontSize: "12px", color: "#9a9aa3", marginTop: "5px", lineHeight: "1.45" }}>
                          Real pain, unbuilt moat, high compliance cost.
                        </div>
                      </div>
                      <div style={{ position: "absolute", left: "540px", top: "382px", width: "205px", background: "rgba(255,255,255,0.014)", border: "1px solid rgba(239,106,106,0.22)", borderRadius: "14px", padding: "14px 16px", opacity: "0.82" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ width: "22px", height: "22px", borderRadius: "7px", background: "rgba(157,134,240,0.08)", border: "1px solid rgba(157,134,240,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9d86f0" strokeWidth="1.7">
                                <circle cx="12" cy="12" r="8" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                            </span>
                            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "9px", letterSpacing: ".14em", color: "#9d86f0" }}>
                              DEEP
                            </span>
                          </div>
                          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "9px", letterSpacing: ".1em", color: "#ee8a8a", background: "rgba(239,106,106,0.12)", border: "1px solid rgba(239,106,106,0.32)", padding: "2px 8px", borderRadius: "5px" }}>
                            KILLED
                          </span>
                        </div>
                        <div style={{ fontSize: "13.5px", color: "#b8b8bd", fontWeight: "500", marginTop: "11px" }}>
                          Resale data module
                        </div>
                        <div style={{ fontSize: "12px", color: "#8a8a93", marginTop: "5px", lineHeight: "1.45" }}>
                          Public procurement data is a free substitute.
                        </div>
                      </div>
                      <div style={{ position: "absolute", left: "812px", top: "184px", width: "200px", background: "linear-gradient(150deg,rgba(22,28,44,0.95),rgba(13,15,23,0.95))", border: "1px solid rgba(107,147,245,0.4)", borderRadius: "14px", padding: "14px 16px", boxShadow: "0 0 24px rgba(107,147,245,0.09)" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ width: "22px", height: "22px", borderRadius: "7px", background: "rgba(107,147,245,0.16)", border: "1px solid rgba(107,147,245,0.36)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8aa9f7" strokeWidth="1.7">
                                <circle cx="12" cy="12" r="8" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                            </span>
                            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "9px", letterSpacing: ".14em", color: "#8aa9f7" }}>
                              EXPLORE
                            </span>
                          </div>
                          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "8.5px", letterSpacing: ".1em", color: "#5b5b64" }}>
                            FORKED
                          </span>
                        </div>
                        <div style={{ fontSize: "13.5px", color: "#e8e8ea", fontWeight: "500", marginTop: "11px" }}>
                          Tyler Munis native wedge
                        </div>
                        <div style={{ fontSize: "12px", color: "#9a9aa3", marginTop: "5px", lineHeight: "1.45" }}>
                          A positioning shift — v1 stays intact beside it.
                        </div>
                      </div>
                      <div style={{ position: "absolute", left: "812px", top: "360px", width: "200px", background: "rgba(255,255,255,0.014)", border: "1px solid rgba(224,168,87,0.24)", borderRadius: "14px", padding: "14px 16px", opacity: "0.88" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ width: "22px", height: "22px", borderRadius: "7px", background: "rgba(157,134,240,0.1)", border: "1px solid rgba(157,134,240,0.22)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9d86f0" strokeWidth="1.7">
                                <circle cx="12" cy="12" r="8" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                            </span>
                            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "9px", letterSpacing: ".14em", color: "#9d86f0" }}>
                              DEEP
                            </span>
                          </div>
                          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "9px", letterSpacing: ".1em", color: "#e7bd7a", background: "rgba(224,168,87,0.12)", border: "1px solid rgba(224,168,87,0.32)", padding: "2px 8px", borderRadius: "5px" }}>
                            PARKED 3.6
                          </span>
                        </div>
                        <div style={{ fontSize: "13.5px", color: "#c8c8cc", fontWeight: "500", marginTop: "11px" }}>
                          Protest-defense layer
                        </div>
                        <div style={{ fontSize: "12px", color: "#8a8a93", marginTop: "5px", lineHeight: "1.45" }}>
                          Set aside — structural wall. Kept revivable.
                        </div>
                      </div>
                      <div style={{ position: "absolute", left: "1035px", top: "196px", width: "205px", background: "linear-gradient(150deg,rgba(14,32,28,0.95),rgba(11,18,20,0.95))", border: "1px solid rgba(52,216,168,0.5)", borderRadius: "14px", padding: "15px 16px", boxShadow: "0 0 46px rgba(52,216,168,0.16)" }}>
                        <div style={{ position: "absolute", right: "14px", top: "-12px", fontFamily: "'JetBrains Mono',monospace", fontSize: "9px", letterSpacing: ".12em", color: "#06120e", background: "#5fe3bd", padding: "3px 9px", borderRadius: "5px", fontWeight: "500" }}>
                          LEAD
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ width: "22px", height: "22px", borderRadius: "7px", background: "rgba(107,147,245,0.16)", border: "1px solid rgba(107,147,245,0.36)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8aa9f7" strokeWidth="1.7">
                                <circle cx="12" cy="12" r="8" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                            </span>
                            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "9px", letterSpacing: ".14em", color: "#8aa9f7" }}>
                              EXPLORE
                            </span>
                          </div>
                          <span style={{ fontFamily: "'Spectral',serif", fontSize: "19px", color: "#f0f0f1" }}>
                            4.7
                          </span>
                        </div>
                        <div style={{ fontSize: "14px", color: "#f4f4f5", fontWeight: "600", marginTop: "11px" }}>
                          Munis-native integration moat
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "7px", marginTop: "9px" }}>
                          <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#34d8a8" }}></span>
                          <span style={{ fontSize: "11.5px", color: "#5fe3bd", fontFamily: "'JetBrains Mono',monospace", letterSpacing: ".04em" }}>
                            ACTIVE · G5 · YOU ARE HERE
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: "8px", textAlign: "center", fontSize: "13px", color: "#71717a" }}>
                    From one rough sentence to a backed bet —
                    <span style={{ color: "#9a9aa3" }}>
                      five generations, every angle and dead end kept on the record.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>
          <section style={{ maxWidth: "1100px", margin: "0 auto", padding: "120px 24px 0" }}>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "12px", letterSpacing: ".18em", color: "#ee8a8a" }}>
              THE PROBLEM
            </div>
            <h2 style={{ fontFamily: "'Spectral',serif", fontWeight: "500", fontSize: "40px", lineHeight: "1.12", letterSpacing: "-0.01em", margin: "14px 0 0", maxWidth: "720px", color: "#fafafa" }}>
              Your idea gets scattered — and nothing remembers.
            </h2>
            <p style={{ fontSize: "17px", lineHeight: "1.6", color: "#b4b4bd", margin: "16px 0 0", maxWidth: "640px" }}>
              ChatGPT, Claude, Reddit, notes, feedback, screenshots, half-finished thoughts. Every chat starts from zero. Every validator gives you a one-off report — then your idea changes. The thinking never compounds.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginTop: "34px" }}>
              <div style={{ opacity: ".6", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "13px 18px", transform: "rotate(-2deg)" }}>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "10px", color: "#5fe3bd", letterSpacing: ".1em" }}>
                  CHATGPT
                </span>
                <div style={{ fontSize: "13.5px", color: "#9a9aa3", marginTop: "5px" }}>
                  “Totally build this!”
                </div>
              </div>
              <div style={{ opacity: ".55", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "13px 18px", transform: "rotate(2deg)" }}>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "10px", color: "#8aa9f7", letterSpacing: ".1em" }}>
                  CLAUDE
                </span>
                <div style={{ fontSize: "13.5px", color: "#9a9aa3", marginTop: "5px" }}>
                  “6 considerations…”
                </div>
              </div>
              <div style={{ opacity: ".5", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "13px 18px", transform: "rotate(-1deg)" }}>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "10px", color: "#f0883e", letterSpacing: ".1em" }}>
                  REDDIT
                </span>
                <div style={{ fontSize: "13.5px", color: "#9a9aa3", marginTop: "5px" }}>
                  “been done”
                </div>
              </div>
              <div style={{ opacity: ".5", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "13px 18px", transform: "rotate(2deg)" }}>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "10px", color: "#71717a", letterSpacing: ".1em" }}>
                  NOTES.APP
                </span>
                <div style={{ fontSize: "13.5px", color: "#9a9aa3", marginTop: "5px" }}>
                  3 versions, all lost
                </div>
              </div>
              <div style={{ opacity: ".45", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "13px 18px", transform: "rotate(-2deg)" }}>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "10px", color: "#71717a", letterSpacing: ".1em" }}>
                  SCREENSHOTS
                </span>
                <div style={{ fontSize: "13.5px", color: "#9a9aa3", marginTop: "5px" }}>
                  somewhere in camera roll
                </div>
              </div>
              <div style={{ opacity: ".5", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "13px 18px", transform: "rotate(1deg)" }}>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "10px", color: "#71717a", letterSpacing: ".1em" }}>
                  YOUR HEAD
                </span>
                <div style={{ fontSize: "13.5px", color: "#9a9aa3", marginTop: "5px" }}>
                  “wait, why did I drop that?”
                </div>
              </div>
            </div>
          </section>
          <section id="the-loop" style={{ maxWidth: "1180px", margin: "0 auto", padding: "120px 24px 0", textAlign: "center" }}>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "12px", letterSpacing: ".18em", color: "#34d8a8" }}>
              THE LOOP
            </div>
            <h2 style={{ fontFamily: "'Spectral',serif", fontWeight: "500", fontSize: "40px", lineHeight: "1.12", margin: "14px auto 0", maxWidth: "680px", color: "#fafafa" }}>
              One idea. One loop. Every pass kept.
            </h2>
            <p style={{ fontSize: "17px", lineHeight: "1.6", color: "#b4b4bd", margin: "16px auto 0", maxWidth: "660px" }}>
              Not a one-shot verdict — a cycle you run as evidence changes, even after you ship. Once an idea, always in the loop.
            </p>
            <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", marginTop: "54px", flexWrap: "nowrap" }}>
              <div style={{ position: "absolute", left: "7%", right: "7%", top: "27px", height: "2px", background: "linear-gradient(90deg,#6b93f5,#9d86f0,#34d8a8,#8ea2f0,#f1719b,#34d8a8)", opacity: ".4" }}></div>
              <div style={{ position: "relative", flex: "1", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "54px", height: "54px", borderRadius: "50%", background: "#0c0c11", border: "1px solid rgba(107,147,245,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8aa9f7" strokeWidth="1.6">
                    <circle cx="12" cy="12" r="9" />
                    <polygon points="15.6,8.4 10.8,10.8 8.4,15.6 13.2,13.2" />
                  </svg>
                </div>
                <div style={{ fontSize: "14.5px", fontWeight: "500", color: "#e8e8ea" }}>
                  Explore
                </div>
                <div style={{ fontSize: "13.5px", color: "#a8a8b0", lineHeight: "1.45", maxWidth: "158px" }}>
                  Widen a rough idea into angles.
                </div>
              </div>
              <div style={{ position: "relative", flex: "1", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "54px", height: "54px", borderRadius: "50%", background: "#0d0c12", border: "1px solid rgba(157,134,240,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b3a3f5" strokeWidth="1.6">
                    <circle cx="12" cy="12" r="9" />
                    <circle cx="12" cy="12" r="5" />
                    <circle cx="12" cy="12" r="1.4" fill="#b3a3f5" />
                  </svg>
                </div>
                <div style={{ fontSize: "14.5px", fontWeight: "500", color: "#e8e8ea" }}>
                  Deep Analysis
                </div>
                <div style={{ fontSize: "13.5px", color: "#a8a8b0", lineHeight: "1.45", maxWidth: "158px" }}>
                  Pressure the claims, score the risks.
                </div>
              </div>
              <div style={{ position: "relative", flex: "1", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "54px", height: "54px", borderRadius: "50%", background: "#0a0f0d", border: "1px solid rgba(52,216,168,0.55)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#5fe3bd" strokeWidth="1.6">
                    <path d="M3.5 12a8.5 8.5 0 0 1 14.3-6.2L21 8" />
                    <path d="M21 4v4h-4" />
                    <path d="M20.5 12a8.5 8.5 0 0 1-14.3 6.2L3 16" />
                    <path d="M3 20v-4h4" />
                  </svg>
                </div>
                <div style={{ fontSize: "14.5px", fontWeight: "500", color: "#e8e8ea" }}>
                  Re-evaluate
                </div>
                <div style={{ fontSize: "13.5px", color: "#a8a8b0", lineHeight: "1.45", maxWidth: "158px" }}>
                  Reshape it, measure the delta.
                </div>
              </div>
              <div style={{ position: "relative", flex: "1", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "54px", height: "54px", borderRadius: "50%", background: "#0c0d12", border: "1px solid rgba(142,162,240,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a6b6f5" strokeWidth="1.6">
                    <path d="M4 9h13l-3.2-3.2" />
                    <path d="M20 15H7l3.2 3.2" />
                  </svg>
                </div>
                <div style={{ fontSize: "14.5px", fontWeight: "500", color: "#e8e8ea" }}>
                  Compare
                </div>
                <div style={{ fontSize: "13.5px", color: "#a8a8b0", lineHeight: "1.45", maxWidth: "158px" }}>
                  Weigh versions side by side.
                </div>
              </div>
              <div style={{ position: "relative", flex: "1", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "54px", height: "54px", borderRadius: "50%", background: "#120c0f", border: "1px solid rgba(241,113,155,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f590b1" strokeWidth="1.6">
                    <circle cx="6" cy="6" r="2.4" />
                    <circle cx="6" cy="18" r="2.4" />
                    <circle cx="18" cy="8" r="2.4" />
                    <path d="M6 8.4v7.2" />
                    <path d="M18 10.4c0 3.4-4.4 2.2-4.4 5.6" />
                  </svg>
                </div>
                <div style={{ fontSize: "14.5px", fontWeight: "500", color: "#e8e8ea" }}>
                  Lineage
                </div>
                <div style={{ fontSize: "13.5px", color: "#a8a8b0", lineHeight: "1.45", maxWidth: "158px" }}>
                  Every version, branched and kept.
                </div>
              </div>
              <div style={{ position: "relative", flex: "1", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "54px", height: "54px", borderRadius: "50%", background: "#0a0f0d", border: "1px solid rgba(52,216,168,0.6)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 22px rgba(52,216,168,0.2)" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5fe3bd" strokeWidth="1.7">
                    <path d="M5 12l5 5 9-11" />
                  </svg>
                </div>
                <div style={{ fontSize: "14.5px", fontWeight: "600", color: "#f0f0f1" }}>
                  Decide
                </div>
                <div style={{ fontSize: "13.5px", color: "#a8a8b0", lineHeight: "1.45", maxWidth: "158px" }}>
                  Build, change, or kill — on evidence.
                </div>
              </div>
            </div>
            <div style={{ position: "relative", height: "66px", maxWidth: "1180px", margin: "2px auto 0" }}>
              <svg viewBox="0 0 1000 66" preserveAspectRatio="none" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", overflow: "visible" }}>
                <defs>
                  <marker id="loopret" markerWidth="9" markerHeight="9" refx="4.5" refy="4.5" orient="auto">
                    <path d="M6.5,1.5 L3,4.5 L6.5,7.5" fill="none" stroke="#5fe3bd" strokeWidth="1.2" />
                  </marker>
                </defs>
                <path d="M930,2 C930,46 902,58 762,58 L238,58 C98,58 70,46 70,4" fill="none" stroke="rgba(52,216,168,0.4)" strokeWidth="1.4" strokeDasharray="2 7" marker-end="url(#loopret)" />
              </svg>
              <div style={{ position: "absolute", left: "50%", top: "58px", transform: "translate(-50%,-50%)", background: "#09090b", padding: "0 14px", fontFamily: "'JetBrains Mono',monospace", fontSize: "12px", letterSpacing: ".05em", color: "#5fe3bd", whiteSpace: "nowrap" }}>
                ↻ re-evaluate as evidence changes — even after you ship, the loop stays open
              </div>
            </div>
          </section>
          <section id="how-it-works" style={{ maxWidth: "1180px", margin: "0 auto", padding: "130px 24px 0" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "12px", letterSpacing: ".18em", color: "#8b7ff0" }}>
                INSIDE THE WORKSPACE
              </div>
              <h2 style={{ fontFamily: "'Spectral',serif", fontWeight: "500", fontSize: "40px", lineHeight: "1.12", margin: "14px auto 0", maxWidth: "680px", color: "#fafafa" }}>
                Not a chat. A cockpit for the idea.
              </h2>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "16px", marginTop: "48px" }}>
              <div style={{ background: "#0b0b0f", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", overflow: "hidden" }}>
                <div style={{ padding: "18px 18px 0" }}>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "10px", letterSpacing: ".12em", color: "#8aa9f7" }}>
                    EXPLORE
                  </div>
                  <div style={{ fontSize: "16px", color: "#f0f0f1", fontWeight: "500", marginTop: "8px" }}>
                    Discover new angles
                  </div>
                </div>
                <div style={{ padding: "16px 18px 20px", display: "flex", flexDirection: "column", gap: "9px" }}>
                  <div style={{ background: "rgba(107,147,245,0.05)", border: "1px solid rgba(107,147,245,0.18)", borderRadius: "9px", padding: "10px 12px", fontSize: "12.5px", color: "#c2c2c8" }}>
                    Positioning shift — defensibility as the frame
                  </div>
                  <div style={{ background: "rgba(107,147,245,0.05)", border: "1px solid rgba(107,147,245,0.18)", borderRadius: "9px", padding: "10px 12px", fontSize: "12.5px", color: "#c2c2c8" }}>
                    Target shift — municipal & county wedge
                  </div>
                  <div style={{ background: "rgba(107,147,245,0.05)", border: "1px solid rgba(107,147,245,0.18)", borderRadius: "9px", padding: "10px 12px", fontSize: "12.5px", color: "#c2c2c8" }}>
                    Distribution shift — partner integrator
                  </div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "10px", color: "#52525b", marginTop: "4px" }}>
                    NO SCORE · NO VERDICT · JUST WIDER
                  </div>
                </div>
              </div>
              <div style={{ background: "#0b0b0f", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", overflow: "hidden" }}>
                <div style={{ padding: "18px 18px 0" }}>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "10px", letterSpacing: ".12em", color: "#b3a3f5" }}>
                    DEEP ANALYSIS
                  </div>
                  <div style={{ fontSize: "16px", color: "#f0f0f1", fontWeight: "500", marginTop: "8px" }}>
                    The pressure read
                  </div>
                </div>
                <div style={{ padding: "16px 18px 20px" }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
                    <span style={{ fontFamily: "'Spectral',serif", fontSize: "38px", color: "#fafafa" }}>
                      4.7
                    </span>
                    <span style={{ fontSize: "13px", color: "#71717a" }}>
                      / 10 overall
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "11px", marginTop: "14px" }}>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#a1a1aa", marginBottom: "5px" }}>
                        <span>
                          Market demand
                        </span>
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#5fe3bd" }}>
                          6.0
                        </span>
                      </div>
                      <div style={{ height: "4px", borderRadius: "3px", background: "rgba(255,255,255,0.06)" }}>
                        <div style={{ width: "60%", height: "100%", borderRadius: "3px", background: "#34d8a8" }}></div>
                      </div>
                    </div>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#a1a1aa", marginBottom: "5px" }}>
                        <span>
                          Monetization
                        </span>
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#8aa9f7" }}>
                          4.7
                        </span>
                      </div>
                      <div style={{ height: "4px", borderRadius: "3px", background: "rgba(255,255,255,0.06)" }}>
                        <div style={{ width: "47%", height: "100%", borderRadius: "3px", background: "#6b93f5" }}></div>
                      </div>
                    </div>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#a1a1aa", marginBottom: "5px" }}>
                        <span>
                          Originality
                        </span>
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#b3a3f5" }}>
                          3.6
                        </span>
                      </div>
                      <div style={{ height: "4px", borderRadius: "3px", background: "rgba(255,255,255,0.06)" }}>
                        <div style={{ width: "36%", height: "100%", borderRadius: "3px", background: "#9d86f0" }}></div>
                      </div>
                    </div>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#a1a1aa", marginBottom: "5px" }}>
                        <span>
                          Build difficulty
                        </span>
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "#e7bd7a" }}>
                          8.5
                        </span>
                      </div>
                      <div style={{ height: "4px", borderRadius: "3px", background: "rgba(255,255,255,0.06)" }}>
                        <div style={{ width: "85%", height: "100%", borderRadius: "3px", background: "#e0a857" }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ background: "#0b0b0f", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", overflow: "hidden" }}>
                <div style={{ padding: "18px 18px 0" }}>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "10px", letterSpacing: ".12em", color: "#a6b6f5" }}>
                    COMPARE
                  </div>
                  <div style={{ fontSize: "16px", color: "#f0f0f1", fontWeight: "500", marginTop: "8px" }}>
                    Two bets, side by side
                  </div>
                </div>
                <div style={{ padding: "16px 18px 20px", display: "flex", gap: "12px" }}>
                  <div style={{ flex: "1", background: "rgba(107,147,245,0.05)", border: "1px solid rgba(107,147,245,0.2)", borderRadius: "10px", padding: "12px" }}>
                    <div style={{ fontSize: "12px", color: "#c2c2c8", lineHeight: "1.4" }}>
                      RFP analyzer
                    </div>
                    <div style={{ fontFamily: "'Spectral',serif", fontSize: "26px", color: "#f0f0f1", marginTop: "8px" }}>
                      4.7
                    </div>
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "9px", color: "#71717a", marginTop: "4px" }}>
                      PLATFORM RISK
                    </div>
                  </div>
                  <div style={{ flex: "1", background: "rgba(157,134,240,0.05)", border: "1px solid rgba(157,134,240,0.2)", borderRadius: "10px", padding: "12px" }}>
                    <div style={{ fontSize: "12px", color: "#c2c2c8", lineHeight: "1.4" }}>
                      Branch wedge
                    </div>
                    <div style={{ fontFamily: "'Spectral',serif", fontSize: "26px", color: "#f0f0f1", marginTop: "8px" }}>
                      4.7
                    </div>
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "9px", color: "#71717a", marginTop: "4px" }}>
                      SUBSTITUTION RISK
                    </div>
                  </div>
                </div>
                <div style={{ padding: "0 18px 18px", fontSize: "12px", color: "#9a9aa3", lineHeight: "1.5" }}>
                  Evenly matched — the call comes down to which wall you’d rather clear.
                </div>
              </div>
              <div style={{ background: "#0b0b0f", border: "1px solid rgba(52,216,168,0.2)", borderRadius: "14px", overflow: "hidden" }}>
                <div style={{ padding: "18px 18px 0" }}>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "10px", letterSpacing: ".12em", color: "#5fe3bd" }}>
                    LINEAGE
                  </div>
                  <div style={{ fontSize: "16px", color: "#f0f0f1", fontWeight: "500", marginTop: "8px" }}>
                    Every path kept
                  </div>
                </div>
                <div style={{ padding: "16px 18px 20px" }}>
                  <svg viewBox="0 0 210 96" style={{ width: "100%", height: "auto" }}>
                    <path d="M16,48 C46,44 52,22 80,20" stroke="rgba(255,255,255,0.14)" strokeWidth="1.3" fill="none" />
                    <path d="M80,20 C112,18 120,50 150,50" stroke="rgba(255,255,255,0.14)" strokeWidth="1.3" fill="none" />
                    <path d="M150,50 C176,52 184,30 198,28" stroke="rgba(224,168,87,0.32)" strokeWidth="1.3" fill="none" strokeDasharray="4 4" />
                    <path d="M150,50 C176,54 184,74 198,76" stroke="rgba(107,147,245,0.5)" strokeWidth="1.6" fill="none" />
                    <path d="M16,48 C44,60 52,84 80,80" stroke="rgba(239,106,106,0.28)" strokeWidth="1.3" fill="none" strokeDasharray="4 4" />
                    <circle cx="16" cy="48" r="5" fill="#6b93f5" />
                    <circle cx="80" cy="20" r="5" fill="#9d86f0" />
                    <circle cx="150" cy="50" r="5" fill="#6b93f5" />
                    <circle cx="198" cy="28" r="5" fill="#e0a857" />
                    <circle cx="198" cy="76" r="6" fill="#6b93f5" />
                    <circle cx="80" cy="80" r="5" fill="#ef6a6a" />
                  </svg>
                  <div style={{ fontSize: "12.5px", color: "#a8a8b0", lineHeight: "1.5", marginTop: "10px" }}>
                    Every version, branch, parked angle, and killed path stays on record — the idea’s memory.
                  </div>
                </div>
              </div>
            </div>
          </section>
          <section style={{ maxWidth: "1180px", margin: "0 auto", padding: "130px 24px 0" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "12px", letterSpacing: ".18em", color: "#8b7ff0" }}>
                EXECUTION BRIEF · THE HANDOFF
              </div>
              <h2 style={{ fontFamily: "'Spectral',serif", fontWeight: "500", fontSize: "40px", lineHeight: "1.12", margin: "14px auto 0", maxWidth: "720px", color: "#fafafa" }}>
                Where our read stops — your first move begins.
              </h2>
              <p style={{ fontSize: "17px", lineHeight: "1.6", color: "#b4b4bd", margin: "16px auto 0", maxWidth: "640px" }}>
                Most tools end at a verdict. IdeaLoop Core ends at a handoff: the one wall to clear first, the order it forces, and the gates that tell you to revise or stop. From your idea, across the evidence, toward execution.
              </p>
            </div>
            <div style={{ marginTop: "44px", borderRadius: "16px", border: "1px solid rgba(255,255,255,0.09)", background: "#0b0b0f", boxShadow: "0 30px 80px rgba(0,0,0,0.5)", overflow: "hidden", textAlign: "left" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "13px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <span style={{ width: "11px", height: "11px", borderRadius: "50%", background: "#ef6a6a", opacity: ".7" }}></span>
                <span style={{ width: "11px", height: "11px", borderRadius: "50%", background: "#e0a857", opacity: ".7" }}></span>
                <span style={{ width: "11px", height: "11px", borderRadius: "50%", background: "#34d8a8", opacity: ".7" }}></span>
                <span style={{ marginLeft: "14px", fontFamily: "'JetBrains Mono',monospace", fontSize: "11px", color: "#5b5b64" }}>
                  idealoop.core / handoff — execution brief
                </span>
              </div>
              <div style={{ padding: "26px 30px 30px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0", flexWrap: "wrap", marginBottom: "30px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                    <span style={{ width: "22px", height: "22px", borderRadius: "50%", border: "1px solid rgba(52,216,168,0.6)", color: "#5fe3bd", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px" }}>
                      ✓
                    </span>
                    <span style={{ fontSize: "13px", color: "#9a9aa3" }}>
                      Idea
                    </span>
                  </div>
                  <span style={{ width: "34px", height: "1px", background: "rgba(255,255,255,0.12)", margin: "0 12px" }}></span>
                  <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                    <span style={{ width: "22px", height: "22px", borderRadius: "50%", border: "1px solid rgba(52,216,168,0.6)", color: "#5fe3bd", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px" }}>
                      ✓
                    </span>
                    <span style={{ fontSize: "13px", color: "#9a9aa3" }}>
                      Deep Analysis
                    </span>
                  </div>
                  <span style={{ width: "34px", height: "1px", background: "rgba(255,255,255,0.12)", margin: "0 12px" }}></span>
                  <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                    <span style={{ width: "22px", height: "22px", borderRadius: "50%", border: "1px solid rgba(52,216,168,0.6)", color: "#5fe3bd", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px" }}>
                      ✓
                    </span>
                    <span style={{ fontSize: "13px", color: "#9a9aa3" }}>
                      Evidence & Reality
                    </span>
                  </div>
                  <span style={{ width: "34px", height: "1px", background: "rgba(139,127,240,0.5)", margin: "0 12px" }}></span>
                  <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                    <span style={{ width: "24px", height: "24px", borderRadius: "50%", background: "#8b7ff0", color: "#0b0b0d", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "700" }}>
                      4
                    </span>
                    <span style={{ fontSize: "13px", color: "#f0f0f1", fontWeight: "600" }}>
                      Handoff
                    </span>
                  </div>
                  <span style={{ width: "34px", height: "1px", background: "rgba(255,255,255,0.1)", margin: "0 12px" }}></span>
                  <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                    <span style={{ width: "22px", height: "22px", borderRadius: "50%", border: "1px solid rgba(255,255,255,0.18)", color: "#71717a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px" }}>
                      5
                    </span>
                    <span style={{ fontSize: "13px", color: "#71717a" }}>
                      Evolve
                    </span>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px", alignItems: "start" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div style={{ borderLeft: "2px solid #34d8a8", background: "rgba(52,216,168,0.04)", borderRadius: "0 12px 12px 0", padding: "16px 20px" }}>
                      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "10.5px", letterSpacing: ".14em", color: "#5fe3bd" }}>
                        IDEA · THE BET
                      </div>
                      <div style={{ fontFamily: "'Spectral',serif", fontStyle: "italic", fontSize: "16.5px", lineHeight: "1.5", color: "#e8e8ea", marginTop: "10px" }}>
                        The wall here is the build — the ERP integration and audit-trail infrastructure that give the product its only defensible position. The first move is whether that build can be owned, not whether agencies want it.
                      </div>
                    </div>
                    <div style={{ border: "1px solid rgba(107,147,245,0.22)", borderRadius: "12px", padding: "18px 20px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                        <span style={{ width: "24px", height: "24px", borderRadius: "7px", background: "rgba(107,147,245,0.14)", border: "1px solid rgba(107,147,245,0.3)", display: "flex", alignItems: "center", justifyContent: "center", color: "#8aa9f7", fontSize: "13px" }}>
                          ⚗
                        </span>
                        <span style={{ fontSize: "15px", color: "#f0f0f1", fontWeight: "600" }}>
                          What you have to prove next
                        </span>
                      </div>
                      <div style={{ fontSize: "13.5px", lineHeight: "1.55", color: "#b4b4bd", marginTop: "11px" }}>
                        Whether the regulated-infrastructure engineering to build and certify live PeopleSoft and Tyler Munis integrations can be secured — via a technical co-founder, lead, or vendor partnership — before any other workstream is meaningful.
                      </div>
                      <div style={{ marginTop: "14px", background: "rgba(255,255,255,0.025)", borderRadius: "9px", padding: "12px 14px" }}>
                        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "9.5px", letterSpacing: ".12em", color: "#71717a" }}>
                          WHAT COUNTS AS ENOUGH
                        </div>
                        <div style={{ fontSize: "12.5px", lineHeight: "1.5", color: "#9a9aa3", marginTop: "6px" }}>
                          A credentialed technical owner committed to the project — not a contractor scoped for one sprint, not an LLM-assisted prototype of the surrounding logic.
                        </div>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "18px 20px" }}>
                      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "10.5px", letterSpacing: ".14em", color: "#a6b6f5" }}>
                        THE ORDER THIS FORCES
                      </div>
                      <div style={{ display: "flex", gap: "12px", marginTop: "14px" }}>
                        <span style={{ width: "22px", height: "22px", flexShrink: "0", borderRadius: "50%", border: "1px solid rgba(139,127,240,0.4)", color: "#b3a3f5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px" }}>
                          1
                        </span>
                        <div>
                          <div style={{ fontSize: "13.5px", color: "#e4e4e7", lineHeight: "1.45" }}>
                            Secure a technical co-founder or lead with government ERP integration experience — before any build begins.
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "12px", marginTop: "14px" }}>
                        <span style={{ width: "22px", height: "22px", flexShrink: "0", borderRadius: "50%", border: "1px solid rgba(139,127,240,0.4)", color: "#b3a3f5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px" }}>
                          2
                        </span>
                        <div>
                          <div style={{ fontSize: "13.5px", color: "#e4e4e7", lineHeight: "1.45" }}>
                            Build the leaner first version: a standalone, protest-defensible scoring rationale generator from manually uploaded PDFs — no ERP connectivity yet.
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "12px", marginTop: "14px" }}>
                        <span style={{ width: "22px", height: "22px", flexShrink: "0", borderRadius: "50%", border: "1px solid rgba(139,127,240,0.4)", color: "#b3a3f5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px" }}>
                          3
                        </span>
                        <div>
                          <div style={{ fontSize: "13.5px", color: "#e4e4e7", lineHeight: "1.45" }}>
                            Gated behind a working prototype: open a certified integration pathway at one named agency willing to pilot the connected version.
                          </div>
                        </div>
                      </div>
                    </div>
                    <div style={{ border: "1px solid rgba(224,168,87,0.22)", borderRadius: "12px", padding: "18px 20px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                        <span style={{ width: "24px", height: "24px", borderRadius: "7px", background: "rgba(224,168,87,0.12)", border: "1px solid rgba(224,168,87,0.3)", display: "flex", alignItems: "center", justifyContent: "center", color: "#e7bd7a", fontSize: "13px" }}>
                          ⎆
                        </span>
                        <span style={{ fontSize: "15px", color: "#f0f0f1", fontWeight: "600" }}>
                          Decision gates
                        </span>
                      </div>
                      <div style={{ marginTop: "13px" }}>
                        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "10px", letterSpacing: ".1em", color: "#e7bd7a" }}>
                          REVISE IF
                        </div>
                        <div style={{ fontSize: "12.5px", lineHeight: "1.5", color: "#9a9aa3", marginTop: "5px" }}>
                          After six months of outreach, no technical co-founder commits — the path re-cuts toward a vendor or systems-integrator arrangement.
                        </div>
                      </div>
                      <div style={{ marginTop: "13px" }}>
                        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "10px", letterSpacing: ".1em", color: "#ef6a6a" }}>
                          STOP IF
                        </div>
                        <div style={{ fontSize: "12.5px", lineHeight: "1.5", color: "#9a9aa3", marginTop: "5px" }}>
                          Eighteen months in, the ERP layer is unbuilt and no certified pathway is active at a named account — the build wall has not moved despite a genuine attempt.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: "22px", paddingTop: "18px", borderTop: "1px solid rgba(255,255,255,0.06)", fontFamily: "'Spectral',serif", fontStyle: "italic", fontSize: "15px", color: "#8b7ff0" }}>
                  The read ends here — the build is the first move, and what happens next belongs to you.
                </div>
              </div>
            </div>
          </section>
          <section style={{ maxWidth: "1100px", margin: "0 auto", padding: "130px 24px 0" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "12px", letterSpacing: ".18em", color: "#6b7280" }}>
                WHY NOT JUST CHATGPT?
              </div>
              <h2 style={{ fontFamily: "'Spectral',serif", fontWeight: "500", fontSize: "40px", lineHeight: "1.12", margin: "14px auto 0", maxWidth: "640px", color: "#fafafa" }}>
                Answers fade. Decisions compound.
              </h2>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "18px", marginTop: "48px" }}>
              <div style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "16px", padding: "26px" }}>
                <div style={{ fontSize: "16px", color: "#d4d4d8", fontWeight: "600" }}>
                  A chat assistant
                </div>
                <div style={{ fontSize: "13.5px", color: "#71717a", marginTop: "6px" }}>
                  ChatGPT, Claude
                </div>
                <div style={{ height: "1px", background: "rgba(255,255,255,0.06)", margin: "18px 0" }}></div>
                <div style={{ display: "flex", flexDirection: "column", gap: "11px", fontSize: "13.5px", color: "#b4b4bd" }}>
                  <div>
                    × Forgets structure between chats
                  </div>
                  <div>
                    × No versions, no lineage
                  </div>
                  <div>
                    × Optimizes for answers, not pressure-testing
                  </div>
                </div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "16px", padding: "26px" }}>
                <div style={{ fontSize: "16px", color: "#d4d4d8", fontWeight: "600" }}>
                  An idea validator
                </div>
                <div style={{ fontSize: "13.5px", color: "#71717a", marginTop: "6px" }}>
                  one-off scoring tools
                </div>
                <div style={{ height: "1px", background: "rgba(255,255,255,0.06)", margin: "18px 0" }}></div>
                <div style={{ display: "flex", flexDirection: "column", gap: "11px", fontSize: "13.5px", color: "#b4b4bd" }}>
                  <div>
                    × Hands you a static report
                  </div>
                  <div>
                    × Dies the moment the idea changes
                  </div>
                  <div>
                    × No way to branch or re-judge
                  </div>
                </div>
              </div>
              <div style={{ background: "linear-gradient(180deg,rgba(52,216,168,0.06),rgba(255,255,255,0.012))", border: "1px solid rgba(52,216,168,0.3)", borderRadius: "16px", padding: "26px", boxShadow: "0 0 50px rgba(52,216,168,0.07)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ color: "#34d8a8", fontSize: "17px" }}>
                    ∞
                  </span>
                  <span style={{ fontSize: "16px", color: "#f4f4f5", fontWeight: "600" }}>
                    IdeaLoop Core
                  </span>
                </div>
                <div style={{ fontSize: "13.5px", color: "#5fe3bd", marginTop: "6px" }}>
                  the decision workspace
                </div>
                <div style={{ height: "1px", background: "rgba(52,216,168,0.18)", margin: "18px 0" }}></div>
                <div style={{ display: "flex", flexDirection: "column", gap: "11px", fontSize: "13.5px", color: "#c8c8cc" }}>
                  <div style={{ color: "#5fe3bd" }}>
                    ✓ Keeps the reasoning alive
                  </div>
                  <div style={{ color: "#5fe3bd" }}>
                    ✓ Every version branched & kept
                  </div>
                  <div style={{ color: "#5fe3bd" }}>
                    ✓ Re-evaluates as evidence changes
                  </div>
                </div>
              </div>
            </div>
          </section>
          <section style={{ maxWidth: "1100px", margin: "0 auto", padding: "130px 24px 0" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "12px", letterSpacing: ".18em", color: "#34d8a8" }}>
                WHEN TO OPEN A LOOP
              </div>
              <h2 style={{ fontFamily: "'Spectral',serif", fontWeight: "500", fontSize: "40px", lineHeight: "1.12", margin: "14px auto 0", maxWidth: "640px", color: "#fafafa" }}>
                Before you commit.
              </h2>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "16px", marginTop: "48px" }}>
              <div style={{ background: "rgba(255,255,255,0.018)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "22px" }}>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "11px", color: "#5fe3bd" }}>
                  01
                </div>
                <div style={{ fontSize: "17px", color: "#f0f0f1", fontWeight: "500", marginTop: "10px" }}>
                  Before building
                </div>
                <div style={{ fontSize: "13.5px", color: "#9a9aa3", marginTop: "7px", lineHeight: "1.5" }}>
                  Is the pain real, the moat buildable, the buyer reachable?
                </div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.018)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "22px" }}>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "11px", color: "#8aa9f7" }}>
                  02
                </div>
                <div style={{ fontSize: "17px", color: "#f0f0f1", fontWeight: "500", marginTop: "10px" }}>
                  Before pivoting
                </div>
                <div style={{ fontSize: "13.5px", color: "#9a9aa3", marginTop: "7px", lineHeight: "1.5" }}>
                  Fork the idea, re-judge it, measure the delta before you turn.
                </div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.018)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "22px" }}>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "11px", color: "#b3a3f5" }}>
                  03
                </div>
                <div style={{ fontSize: "17px", color: "#f0f0f1", fontWeight: "500", marginTop: "10px" }}>
                  Before writing code
                </div>
                <div style={{ fontSize: "13.5px", color: "#9a9aa3", marginTop: "7px", lineHeight: "1.5" }}>
                  Check whether the pain, buyer, and route to market deserve a build — before momentum turns into sunk cost.
                </div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.018)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "22px" }}>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "11px", color: "#8ea2f0" }}>
                  04
                </div>
                <div style={{ fontSize: "17px", color: "#f0f0f1", fontWeight: "500", marginTop: "10px" }}>
                  Before hiring
                </div>
                <div style={{ fontSize: "13.5px", color: "#9a9aa3", marginTop: "7px", lineHeight: "1.5" }}>
                  Know the binding constraint before you staff against it.
                </div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.018)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "22px" }}>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "11px", color: "#e7bd7a" }}>
                  05
                </div>
                <div style={{ fontSize: "17px", color: "#f0f0f1", fontWeight: "500", marginTop: "10px" }}>
                  Before launching
                </div>
                <div style={{ fontSize: "13.5px", color: "#a8a8b0", marginTop: "7px", lineHeight: "1.5" }}>
                  Check whether the market, wedge, and risks still hold before you expose it.
                </div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.018)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "22px" }}>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "11px", color: "#ee8a8a" }}>
                  06
                </div>
                <div style={{ fontSize: "17px", color: "#f0f0f1", fontWeight: "500", marginTop: "10px" }}>
                  Before killing an idea
                </div>
                <div style={{ fontSize: "13.5px", color: "#9a9aa3", marginTop: "7px", lineHeight: "1.5" }}>
                  Kill it with a reason on record — and keep it revivable.
                </div>
              </div>
            </div>
          </section>
          <section id="pricing" style={{ maxWidth: "1000px", margin: "0 auto", padding: "130px 24px 0" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "12px", letterSpacing: ".18em", color: "#6b7280" }}>
                PRICING
              </div>
              <h2 style={{ fontFamily: "'Spectral',serif", fontWeight: "500", fontSize: "40px", lineHeight: "1.12", margin: "14px auto 0", color: "#fafafa" }}>
                Pay as you think.
              </h2>
              <p style={{ fontSize: "16.5px", color: "#a1a1aa", margin: "14px auto 0", maxWidth: "560px", lineHeight: "1.6" }}>
                Every Explore, Deep Analysis, and Re-evaluation spends credits. Start free, top up only when you’re actually moving.
              </p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px", marginTop: "44px" }}>
              <div style={{ background: "rgba(255,255,255,0.018)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "18px", padding: "30px" }}>
                <div style={{ fontSize: "15px", color: "#d4d4d8", fontWeight: "600" }}>
                  Free
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "6px", marginTop: "14px" }}>
                  <span style={{ fontFamily: "'Spectral',serif", fontSize: "42px", color: "#fafafa" }}>
                    $0
                  </span>
                </div>
                <div style={{ fontSize: "13.5px", color: "#9a9aa3", marginTop: "4px" }}>
                  to start · 150 credits on sign-up
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "20px", fontSize: "13.5px", color: "#9a9aa3" }}>
                  <div>
                    ✓ Your first idea loop
                  </div>
                  <div>
                    ✓ Explore + one Deep Analysis
                  </div>
                  <div>
                    ✓ Full lineage & memory
                  </div>
                </div>
                <div onClick={onStartFreeFn} style={{ marginTop: "24px", textAlign: "center", fontSize: "14px", fontWeight: "600", color: "#e8e8ea", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "11px", padding: "12px", cursor: "pointer" }}>
                  Start free
                </div>
              </div>
              <div style={{ background: "linear-gradient(180deg,rgba(139,127,240,0.08),rgba(255,255,255,0.012))", border: "1px solid rgba(139,127,240,0.32)", borderRadius: "18px", padding: "30px", boxShadow: "0 0 50px rgba(139,127,240,0.08)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "15px", color: "#f4f4f5", fontWeight: "600" }}>
                    Credits
                  </span>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "10px", color: "#bdb4f0", background: "rgba(139,127,240,0.16)", border: "1px solid rgba(139,127,240,0.3)", padding: "3px 9px", borderRadius: "5px" }}>
                    PAY AS YOU GO
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "6px", marginTop: "14px" }}>
                  <span style={{ fontFamily: "'Spectral',serif", fontSize: "42px", color: "#fafafa" }}>
                    $19
                  </span>
                  <span style={{ fontSize: "14px", color: "#71717a" }}>
                    / 1,000 credits
                  </span>
                </div>
                <div style={{ fontSize: "13.5px", color: "#9a9aa3", marginTop: "4px" }}>
                  no subscription · never expires
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "20px", fontSize: "13.5px", color: "#c8c8cc" }}>
                  <div style={{ color: "#bdb4f0" }}>
                    ✓ Unlimited saved ideas & branches
                  </div>
                  <div style={{ color: "#bdb4f0" }}>
                    ✓ Credits only spent when you run analysis
                  </div>
                  <div style={{ color: "#bdb4f0" }}>
                    ✓ Deep Analysis with verified sources
                  </div>
                </div>
                <div onClick={onGetCreditsFn} style={{ marginTop: "24px", textAlign: "center", fontSize: "14px", fontWeight: "600", color: "#fff", background: "#8b7ff0", borderRadius: "11px", padding: "12px", cursor: "pointer" }}>
                  Get credits
                </div>
              </div>
            </div>
            <div style={{ marginTop: "24px", display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "10px" }}>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "12px", color: "#a1a1aa", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", padding: "8px 13px" }}>
                Explore
                <span style={{ color: "#8aa9f7" }}>
                  ≈ 20 credits
                </span>
              </span>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "12px", color: "#a1a1aa", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", padding: "8px 13px" }}>
                Deep Analysis
                <span style={{ color: "#b3a3f5" }}>
                  ≈ 120 credits
                </span>
              </span>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "12px", color: "#a1a1aa", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", padding: "8px 13px" }}>
                Re-evaluate
                <span style={{ color: "#5fe3bd" }}>
                  ≈ 80 credits
                </span>
              </span>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "12px", color: "#a1a1aa", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", padding: "8px 13px" }}>
                Compare
                <span style={{ color: "#a6b6f5" }}>
                  included
                </span>
              </span>
            </div>
          </section>
          <section style={{ maxWidth: "900px", margin: "0 auto", padding: "140px 24px 0", textAlign: "center" }}>
            <div style={{ position: "relative", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "24px", padding: "64px 40px", overflow: "hidden", background: "radial-gradient(120% 140% at 50% 0%, rgba(52,216,168,0.08), rgba(139,127,240,0.05) 40%, transparent 70%)" }}>
              <h2 style={{ fontFamily: "'Spectral',serif", fontWeight: "500", fontSize: "46px", lineHeight: "1.1", letterSpacing: "-0.01em", color: "#fafafa" }}>
                Start your first idea loop.
              </h2>
              <p style={{ fontSize: "17px", color: "#a1a1aa", margin: "16px auto 0", maxWidth: "500px", lineHeight: "1.6" }}>
                Bring one rough idea. Leave with a build, change, or kill decision you can defend.
              </p>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "14px", marginTop: "30px" }}>
                <span onClick={onStartLoop} style={{ fontSize: "16px", fontWeight: "600", color: "#fff", background: "#8b7ff0", padding: "15px 30px", borderRadius: "12px", cursor: "pointer", boxShadow: "0 8px 30px rgba(139,127,240,0.3)" }}>
                  Start an idea loop →
                </span>
                {SAMPLE_LOOP_URL ? (
                <span onClick={onViewSampleFn} style={{ fontSize: "16px", fontWeight: "500", color: "#d4d4d8", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", padding: "15px 26px", borderRadius: "12px", cursor: "pointer" }}>
                  View sample loop
                </span>
                ) : null}
              </div>
            </div>
          </section>
          <footer style={{ maxWidth: "1180px", margin: "0 auto", padding: "80px 24px 50px", display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: "120px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ color: "#34d8a8", fontSize: "18px" }}>
                ∞
              </span>
              <span style={{ fontWeight: "700", fontSize: "15px" }}>
                IdeaLoop Core
              </span>
            </div>
            <div style={{ display: "flex", gap: "26px", fontSize: "13.5px", color: "#9a9aa3" }}>
              <span>
                How it works
              </span>
              <span>
                Pricing
              </span>
              <span>
                Sample loop
              </span>
              <span>
                Log in
              </span>
            </div>
            <div style={{ fontSize: "13px", color: "#52525b" }}>
              © 2026 IdeaLoop Core
            </div>
          </footer>
        </div>
  );
}