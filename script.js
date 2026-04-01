(function () {
  "use strict";

  /* On load/refresh: scroll to top and restart the page (fall animation from the beginning) */
  if (typeof history !== "undefined" && "scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;

  var hero = document.getElementById("hero");
  var templeWrap = document.getElementById("templeWrap");
  var titleLayer = document.getElementById("heroContent");
  var flowersLayer = document.querySelector(".hero__flowers-layer");
  var flowersInner = document.querySelector(".hero__flowers-inner");
  var flowersTitleGroup = document.querySelector(".hero__flowers-title-group");
  var section2 = document.getElementById("section2");
  var heroScrollArea = document.getElementById("heroScrollArea");
  var mountainsEl = document.querySelector(".hero__mountains");

  if (!hero || !templeWrap) {
    return;
  }

  /* Ensure hero starts in drop-in state so the fall animation runs again */
  hero.classList.remove("hero--loaded");
  hero.classList.add("hero--drop-in");

  var mobileBreakpoint = 768;
  var scrollForFullVh = 55;  /* scroll over this many vh to complete section 1 */
  var titleTopStart = 32;
  var titleTopEnd = 72;
  var initialTempleVh = 50;
  var maxTempleVh = 95;

  function getTempleHeights() {
    var isMobile = window.innerWidth < mobileBreakpoint;
    return {
      initial: isMobile ? 30 : initialTempleVh,
      max: isMobile ? 92 : maxTempleVh
    };
  }

  /* Initial hero state */
  var h0 = getTempleHeights();
  var vh0 = window.innerHeight || 600;
  templeWrap.style.setProperty("--temple-height", h0.initial + "vh");
  var initialRisePx = 0.15 * vh0;
  templeWrap.style.transform = "translateY(" + initialRisePx + "px)";
  templeWrap.style.transition = "none";

  var scrollRaf = null;
  var scrollScheduled = false;
  var lastCoupleProgress = -1;
  var section1Frozen = false;
  var refTranslateStart = 0;
  /** Document scrollY when freeze engaged — frozen parallax is anchored here so fixed layers track section 2 1:1 */
  var refScrollYAtFreeze = 0;
  var refVhAtFreeze = 0;
  /** When frozen: section 2 top in viewport = refSection2TopZero - scrollY. Used so coupleProgress is derived from scrollY (same as section 1). */
  var refSection2TopZero = 0;
  /** Smoothed translateY to avoid jump when scrollY leaps at unfreeze (e.g. vh change). */
  var lastAppliedTranslateY = 0;
  /** For time-based lerp: initialized to now so first dt is reasonable */
  var lastScrollUpdateTime = Date.now();
  /** On mobile: max vh seen, so section 1 doesn't resize when address bar shows/hides. */
  var stableVh = window.innerHeight || 600;
  function runScrollUpdates() {
    scrollRaf = null;
    scrollScheduled = false;

    var nowMs = Date.now();
    var rawScrollY = window.scrollY || window.pageYOffset;
    var scrollY = rawScrollY;
    /* iOS overscroll (pull-to-refresh) can report negative scrollY; clamp only for our layout */
    if (scrollY < 0) scrollY = 0;
    var pullOffsetPx = 0;
    if (rawScrollY < 0 && rawScrollY > -100) {
      pullOffsetPx = rawScrollY * 0.5; /* Dampen the pull effect */
    }
    var viewportHeight = window.innerHeight;
    var isMobile = window.innerWidth < mobileBreakpoint;
    /* Update stableVh: on mobile use max vh seen; on desktop use current */
    if (isMobile) {
      stableVh = Math.max(stableVh || viewportHeight, viewportHeight);
    }
    var layoutVh = isMobile ? stableVh : viewportHeight;
    /* Section 2 visibility / couple range: on mobile use stable vh so URL-bar height changes do not jitter thresholds frame-to-frame */
    var vhForS2 = isMobile ? layoutVh : viewportHeight;

    var thresholdPx = (scrollForFullVh / 100) * layoutVh;
    var translateStart = thresholdPx;
    var translateY = scrollY > translateStart ? -(scrollY - translateStart) : 0;
    var s2Rect = null;
    if (section2) {
      s2Rect = section2.getBoundingClientRect();
    }
    /* Simple translateY calculation - direct mapping to scroll position, no smoothing */
    if (scrollY > translateStart) {
      translateY = -(scrollY - translateStart);
    } else {
      translateY = 0;
    }
    lastAppliedTranslateY = translateY;
    var scrollVh = (scrollY / layoutVh) * 100;
    var progress = Math.min(scrollVh / scrollForFullVh, 1);

    /* Section 2: compute first so we know if section 1 should freeze */
    var coupleProgress = lastCoupleProgress > 0 ? lastCoupleProgress : 0;
    var s2Top = null;
    if (section2) {
      var rect = s2Rect != null ? s2Rect : section2.getBoundingClientRect();
      var top = rect.top;
      s2Top = Math.round(top);
      var start = vhForS2;
      var end = vhForS2 * 0.15;
      coupleProgress = 1 - (top - end) / (start - end);
      coupleProgress = Math.max(0, Math.min(1, coupleProgress));
      if (isMobile) {
        coupleProgress = Math.round(coupleProgress * 1000) / 1000;
      } else {
        coupleProgress = Math.round(coupleProgress * 100) / 100;
      }
      if (top < -50) coupleProgress = 1;
      /* Rect often snaps to 0 when section 2 is just below the fold after unfreeze; keep last applied value */
      if (lastCoupleProgress > 0 && coupleProgress === 0 && top >= vhForS2) {
        coupleProgress = lastCoupleProgress;
      }
      if (isMobile) {
        /* Hysteresis: avoid toggling class when top hovers near threshold during fast fling */
        var s2Enter = vhForS2 * 0.95;
        var s2Exit = vhForS2 * 0.97;
        if (top < s2Enter) {
          document.body.classList.add("section-2-in-view");
        } else if (top > s2Exit) {
          document.body.classList.remove("section-2-in-view");
        }
      } else {
        document.body.classList.remove("section-2-in-view");
      }
      /* Freeze section 1 only when section 2 has started AND section 1 animation is nearly complete (>= 0.98 avoids float edge cases).
         This avoids a jump: we were freezing when s2Top < vh but translateY was still 0, so we applied 0 to
         all layers while the anim path had temple/flowers at non-zero offsets. */
      if (top < vhForS2 && progress >= 0.98 && !section1Frozen) {
        section1Frozen = true;
        /* Exact threshold (no Math.round): rounded refTS caused frozen vs ANIM translate mismatch near thrPx */
        refTranslateStart = translateStart;
        refVhAtFreeze = isMobile ? layoutVh : viewportHeight;
        refSection2TopZero = Math.round(scrollY + top);
        refScrollYAtFreeze = scrollY;
        if (hero && !hero.classList.contains("hero--released")) {
          hero.classList.add("hero--released");
        }
      }
      /* Hysteresis: avoid unfreeze snap when section 2 barely clears the viewport */
      if (top >= vhForS2 + 40) {
        section1Frozen = false;
        if (hero) hero.classList.remove("hero--released");
      }
    }

    /* Use frozen formula only when section 1 is actually frozen (section 2 in view and anim complete).
       When user scrolls back up and section 2 is out of view, we use the anim branch so section 1
       animates in reverse (temple shrinks, title moves up, flowers move back). */
    if (section1Frozen && refScrollYAtFreeze > 0 && scrollY < refScrollYAtFreeze - 10) {
      section1Frozen = false;
      if (hero) hero.classList.remove("hero--released");
    }
    if (section1Frozen) {
      /* Anchor to scroll at freeze so fixed layers move in lockstep with section 2 (not translateStart, which can differ by a few px) */
      var frozenTranslateY = -(scrollY - refScrollYAtFreeze);
      var flowersOffsetPx = 0.1 * refVhAtFreeze;
      var heroReleased = !!(hero && hero.classList.contains("hero--released"));
      /* Derive coupleProgress from scrollY so section 2 content stays in phase with section 1 (avoids getBoundingClientRect layout lag) */
      if (section2 && refSection2TopZero > 0) {
        var startF = refVhAtFreeze;
        var endF = refVhAtFreeze * 0.15;
        var topFromScroll = refSection2TopZero - scrollY;
        coupleProgress = 1 - (topFromScroll - endF) / (startF - endF);
        coupleProgress = Math.max(0, Math.min(1, coupleProgress));
      }
      if (hero) hero.classList.add("hero--section1-frozen");
      var heights = getTempleHeights();
      /* Use px from refVhAtFreeze so temple doesn't resize when address bar shows/hides (vh change) */
      var templeHeightPx = (heights.max / 100) * refVhAtFreeze;
      templeWrap.style.setProperty("--temple-height", templeHeightPx + "px");
      var mountains = mountainsEl || document.querySelector(".hero__mountains");
      if (!heroReleased) {
        if (titleLayer) {
          titleLayer.style.setProperty("--title-top", titleTopEnd + "%");
          titleLayer.style.transition = "none";
          titleLayer.style.transform = "translateY(-50%) translateY(" + (frozenTranslateY + pullOffsetPx) + "px)";
        }
        templeWrap.style.transform = "translateY(" + (frozenTranslateY + pullOffsetPx) + "px)";
        templeWrap.style.transition = "none";
        if (flowersLayer) {
          flowersLayer.style.transition = "none";
          flowersLayer.style.transform = "translateY(" + (frozenTranslateY + flowersOffsetPx + pullOffsetPx) + "px)";
        }
        if (mountains) mountains.style.transform = "translateY(" + (frozenTranslateY + pullOffsetPx) + "px)";
      } else {
        /* position:absolute inside .hero — scroll moves the stack; clear JS transforms */
        if (titleLayer) {
          titleLayer.style.setProperty("--title-top", titleTopEnd + "%");
          titleLayer.style.transition = "none";
          titleLayer.style.transform = "";
        }
        templeWrap.style.transition = "none";
        templeWrap.style.transform = "";
        if (flowersLayer) {
          flowersLayer.style.transition = "none";
          flowersLayer.style.transform = "";
        }
        if (mountains) mountains.style.transform = "";
      }
      if (flowersInner) flowersInner.style.transform = "translateY(0)";
      if (flowersTitleGroup) flowersTitleGroup.style.transform = "translateY(0)";
      if (section2 && coupleProgress !== lastCoupleProgress) {
        lastCoupleProgress = coupleProgress;
        section2.style.setProperty("--couple-progress", coupleProgress);
      }
      lastAppliedTranslateY = heroReleased ? 0 : frozenTranslateY;
      lastScrollUpdateTime = nowMs;
      return;
    }

    if (hero) hero.classList.remove("hero--section1-frozen");

    /* Match freeze threshold (0.98): past that, hero geometry matches "complete" so unfreeze from FROZEN does not pop temple/title */
    var animProgress = progress >= 0.98 ? 1 : progress;
    var useTransition = !hero || !hero.classList.contains("hero--loaded");
    var layoutVhAnim = isMobile ? layoutVh : viewportHeight;
    var nearFreezeBoundary = Math.abs(scrollY - translateStart) < 60;
    var flowersLiftPx = 0.1 * layoutVhAnim;
    var flowersMoveDownPx = animProgress * 0.2 * layoutVhAnim;
    var heights = getTempleHeights();
    var heightVh = animProgress < 1
      ? heights.initial + (heights.max - heights.initial) * animProgress
      : heights.max;

    /* Use fractional pixels (no Math.round) for smooth subpixel positioning on mobile */
    var templeTranslateY = (1 - animProgress) * 0.15 * layoutVhAnim + translateY + pullOffsetPx;
    var flowersTranslateY = -flowersLiftPx + flowersMoveDownPx + translateY + pullOffsetPx;
    var mountainsTranslateY = translateY + pullOffsetPx;
    var titleTranslateY = translateY + pullOffsetPx;
    var titleTopPctAnim = titleTopStart + (titleTopEnd - titleTopStart) * animProgress;

    /* Section 1: always apply for smooth scroll; animProgress freezes animation at 1 */
    if (titleLayer) {
      var titleTop = titleTopPctAnim;
      titleLayer.style.setProperty("--title-top", titleTop + "%");
      titleLayer.style.transition = useTransition ? "" : "none";
      titleLayer.style.transform = "translateY(-50%) translateY(" + titleTranslateY + "px)";
    }
    if (isMobile || nearFreezeBoundary) {
      templeWrap.style.setProperty("--temple-height", ((heightVh / 100) * layoutVhAnim) + "px");
    } else {
      templeWrap.style.setProperty("--temple-height", heightVh + "vh");
    }
    templeWrap.style.transform = "translateY(" + templeTranslateY + "px)";
    templeWrap.style.transition = "none";
    if (flowersLayer) {
      flowersLayer.style.transition = useTransition ? "" : "none";
      flowersLayer.style.transform = "translateY(" + flowersTranslateY + "px)";
    }
    if (flowersInner) flowersInner.style.transform = "translateY(0)";
    if (flowersTitleGroup) flowersTitleGroup.style.transform = "translateY(0)";
    var mountains = mountainsEl || document.querySelector(".hero__mountains");
    if (mountains) mountains.style.transform = "translateY(" + mountainsTranslateY + "px)";
    if (section2 && coupleProgress !== lastCoupleProgress) {
      lastCoupleProgress = coupleProgress;
      section2.style.setProperty("--couple-progress", coupleProgress);
    }
    lastAppliedTranslateY = translateY;
    lastScrollUpdateTime = nowMs;
  }

  function scheduleScrollUpdate() {
    if (scrollScheduled) return;
    scrollScheduled = true;
    if (scrollRaf !== null) return;
    scrollRaf = requestAnimationFrame(runScrollUpdates);
  }

  window.addEventListener("scroll", scheduleScrollUpdate, { passive: true });
  window.addEventListener("resize", function () {
    scrollScheduled = false;
    runScrollUpdates();
  });

  setTimeout(function () {
    scrollScheduled = false;
    runScrollUpdates();
    if (titleLayer) titleLayer.style.setProperty("--title-top", titleTopStart + "%");
    templeWrap.style.setProperty("--temple-height", getTempleHeights().initial + "vh");
  }, 80);

  setTimeout(function () {
    if (hero) {
      hero.classList.add("hero--loaded");
      hero.classList.remove("hero--drop-in");
    }
  }, 80 + 2000);

  /* Background music: play on play tap, pause on pause tap */
  (function () {
    var audio = document.getElementById("bgMusic");
    var btn = document.getElementById("musicToggle");
    var icon = btn && btn.querySelector(".music-toggle__icon");
    if (!audio || !btn) return;

    function updateButton() {
      var paused = audio.paused;
      btn.classList.toggle("is-paused", paused);
      btn.setAttribute("aria-label", paused ? "Play background music" : "Pause background music");
      btn.setAttribute("title", paused ? "Play music" : "Pause music");
      if (icon) icon.textContent = paused ? "▶" : "❚❚";
    }

    btn.addEventListener("click", function () {
      if (audio.paused) {
        audio.play().catch(function () {});
      } else {
        audio.pause();
      }
      updateButton();
    });

    audio.addEventListener("play", updateButton);
    audio.addEventListener("pause", updateButton);

    updateButton();
    /* Try autoplay on start; if allowed → button shows pause, else stays play; user can toggle anytime */
    audio.play().catch(function () {});
  })();
})();
