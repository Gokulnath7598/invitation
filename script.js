(function () {
  "use strict";

  /* ---- Debug logger: app init → positioning/scroll (for mobile debugging) ---- */
  var DEBUG_VERSION = "scroll-v14-2026-04-01-hero-released";
  var DEBUG_MAX_LINES = 1400;
  var DEBUG_SCROLL_THROTTLE_MS = 50;
  /** Set false to only log summary lines (no per-element RECT/XFORM rows) */
  var DEBUG_LOG_EACH_ELEMENT = true;
  var debugLines = [];
  var debugScrollLogTime = 0;

  function debugLog(cat, msg) {
    var ts = new Date().toISOString();
    var line = ts + " [" + cat + "] " + msg;
    debugLines.push(line);
    if (debugLines.length > DEBUG_MAX_LINES) debugLines.shift();
  }

  function debugGetText() {
    return debugLines.join("\n") || "[No logs yet]";
  }

  function shortRect(el) {
    if (!el) return "n/a";
    var b = el.getBoundingClientRect();
    return "t=" + b.top.toFixed(1) + " b=" + b.bottom.toFixed(1) + " l=" + b.left.toFixed(1) + " r=" + b.right.toFixed(1) + " w=" + b.width.toFixed(0) + " h=" + b.height.toFixed(0);
  }

  function readCssVarPx(el, name) {
    if (!el) return "";
    var cs = window.getComputedStyle(el);
    var v = cs.getPropertyValue(name).trim();
    return v || "(unset)";
  }

  /**
   * Throttled detailed layout log: scroll math + each hero layer + section2 (position/size + applied motion).
   */
  function debugLogScrollLayout(nowMs, kind, o) {
    if (nowMs - debugScrollLogTime < DEBUG_SCROLL_THROTTLE_MS) return;
    debugScrollLogTime = nowMs;
    var sum = kind
      + " sy=" + o.scrollY.toFixed(1)
      + " dSy=" + o.scrollDelta.toFixed(2)
      + " rawY=" + o.rawScrollY.toFixed(1)
      + " vh=" + o.viewportH
      + " layoutVh=" + o.layoutVh.toFixed(0)
      + " stableVh=" + (o.stableVh != null ? o.stableVh.toFixed(0) : "n/a")
      + " mobile=" + o.isMobile
      + " touch=" + o.touch
      + " frozen=" + (o.frozen ? 1 : 0)
      + " path=" + o.path
      + " prog=" + o.progress.toFixed(4)
      + " thrPx=" + o.thresholdPx.toFixed(1)
      + " tStart=" + o.translateStart.toFixed(1)
      + " transY=" + o.translateY.toFixed(2)
      + " pull=" + o.pull.toFixed(2);
    if (o.animProgress != null) sum += " animP=" + o.animProgress.toFixed(4);
    if (o.refTS != null) sum += " refTS=" + o.refTS + " refVhF=" + o.refVhF + " refS2Z=" + o.refS2Z;
    if (o.s2Top != null) sum += " s2Top=" + o.s2Top + " s2Out=" + (o.s2Out ? 1 : 0);
    if (o.couple != null) sum += " couple=" + o.couple.toFixed(4);
    debugLog("SUMMARY", sum);

    if (!DEBUG_LOG_EACH_ELEMENT) return;

    var m = o.mountains;
    var tl = o.titleLayer;
    var tw = o.templeWrap;
    var fl = o.flowersLayer;
    var s2 = o.section2;
    var hr = o.hero;
    var sc = o.scrollArea;

    debugLog("RECT", "hero " + shortRect(hr) + " | scrollArea " + shortRect(sc));
    debugLog("RECT", "mountains " + shortRect(m) + " | titleLayer " + shortRect(tl) + " | templeWrap " + shortRect(tw));
    debugLog("RECT", "flowersLayer " + shortRect(fl) + " | section2 " + shortRect(s2));

    var titleTopVar = readCssVarPx(tl, "--title-top");
    var templeHVar = readCssVarPx(tw, "--temple-height");
    var coupleVar = s2 ? readCssVarPx(s2, "--couple-progress") : "";

    var coupleDisp = o.couple != null ? o.couple.toFixed(4) : (coupleVar || "n/a");
    debugLog(
      "XFORM",
      "mtnTy=" + o.mtnTy.toFixed(2)
        + " titleTop%=" + (o.titleTopPct != null ? o.titleTopPct.toFixed(2) : titleTopVar)
        + " titleTy=" + o.titleTy.toFixed(2)
        + " templeH=" + templeHVar
        + " templeTy=" + o.templeTy.toFixed(2)
        + " flwTy=" + o.flwTy.toFixed(2)
        + " s2--couple=" + coupleDisp
    );
  }

  function debugCopy() {
    var btn = document.getElementById("debugLogsCopy");
    var text = debugGetText();
    var label = btn && btn.querySelector(".debug-logs-copy__label");
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        if (label) label.textContent = "Copied!";
        setTimeout(function () { if (label) label.textContent = "Copy logs"; }, 2000);
      }).catch(function () {
        if (label) label.textContent = "Copy failed";
        setTimeout(function () { if (label) label.textContent = "Copy logs"; }, 2000);
      });
    } else {
      if (label) label.textContent = "Copy failed";
      setTimeout(function () { if (label) label.textContent = "Copy logs"; }, 2000);
    }
  }

  debugLog("INIT", "version=" + DEBUG_VERSION + " | UA=" + (navigator.userAgent || "").substring(0, 60));
  debugLog("INIT", "viewport meta: " + (document.querySelector('meta[name="viewport"]') ? document.querySelector('meta[name="viewport"]').getAttribute("content") : "none"));

  /* On load/refresh: scroll to top and restart the page (fall animation from the beginning) */
  if (typeof history !== "undefined" && "scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
  debugLog("INIT", "scrollTo(0,0) done | scrollY=" + (window.scrollY || window.pageYOffset) + " docEl.scrollTop=" + document.documentElement.scrollTop + " body.scrollTop=" + document.body.scrollTop);

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
    debugLog("INIT", "ABORT: missing hero or templeWrap");
    return;
  }

  /* Ensure hero starts in drop-in state so the fall animation runs again */
  hero.classList.remove("hero--loaded");
  hero.classList.add("hero--drop-in");
  debugLog("INIT", "hero state: hero--drop-in set");

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
  debugLog("INIT", "innerWidth=" + window.innerWidth + " innerHeight=" + vh0 + " isMobile=" + (window.innerWidth < mobileBreakpoint) + " templeHeights=" + h0.initial + "vh/" + h0.max + "vh initialRisePx=" + initialRisePx);

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
  var firstScrollLogged = false;
  /** Smoothed translateY to avoid jump when scrollY leaps at unfreeze (e.g. vh change). */
  var lastAppliedTranslateY = 0;
  /** For time-based lerp: initialized to now so first dt is reasonable */
  var lastScrollUpdateTime = Date.now();
  /** On mobile: max vh seen, so section 1 doesn't resize when address bar shows/hides. */
  var stableVh = window.innerHeight || 600;
  /** Track last scrollY to detect direction and sudden jumps */
  var lastScrollY = 0;
  /** Is touch currently active */
  var isTouchActive = false;

  function runScrollUpdates() {
    scrollRaf = null;
    scrollScheduled = false;

    var nowMs = Date.now();
    var rawScrollY = window.scrollY || window.pageYOffset;
    var scrollY = rawScrollY;
    /* iOS overscroll (pull-to-refresh) can report negative scrollY; clamp only for our layout */
    if (scrollY < 0) scrollY = 0;
    /* Track scroll delta for debugging */
    var scrollDelta = scrollY - lastScrollY;
    lastScrollY = scrollY;
    /* On mobile with touch active, ignore small negative values that cause jitter */
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

    var thresholdPx = (scrollForFullVh / 100) * layoutVh;
    var translateStart = thresholdPx;
    var translateY = scrollY > translateStart ? -(scrollY - translateStart) : 0;
    /* Check if section 2 is out of view for freeze/unfreeze logic */
    var section2OutOfView = false;
    var s2Rect = null;
    if (section2) {
      s2Rect = section2.getBoundingClientRect();
      section2OutOfView = s2Rect.top >= viewportHeight;
    }
    var pathTaken = "anim";

    /* Simple translateY calculation - direct mapping to scroll position, no smoothing */
    if (scrollY > translateStart) {
      pathTaken = "trans";
      translateY = -(scrollY - translateStart);
    } else {
      pathTaken = "zero";
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
      var start = viewportHeight;
      var end = viewportHeight * 0.15;
      coupleProgress = 1 - (top - end) / (start - end);
      coupleProgress = Math.max(0, Math.min(1, coupleProgress));
      coupleProgress = Math.round(coupleProgress * 100) / 100;
      if (top < -50) coupleProgress = 1;
      /* Rect often snaps to 0 when section 2 is just below the fold after unfreeze; keep last applied value */
      if (lastCoupleProgress > 0 && coupleProgress === 0 && top >= viewportHeight) {
        coupleProgress = lastCoupleProgress;
      }
      if (isMobile) {
        if (top < viewportHeight * 0.95) {
          document.body.classList.add("section-2-in-view");
        } else {
          document.body.classList.remove("section-2-in-view");
        }
      } else {
        document.body.classList.remove("section-2-in-view");
      }
      /* Freeze section 1 only when section 2 has started AND section 1 animation is nearly complete (>= 0.98 avoids float edge cases).
         This avoids a jump: we were freezing when s2Top < vh but translateY was still 0, so we applied 0 to
         all layers while the anim path had temple/flowers at non-zero offsets. */
      if (top < viewportHeight && progress >= 0.98 && !section1Frozen) {
        section1Frozen = true;
        /* Exact threshold (no Math.round): rounded refTS caused frozen vs ANIM translate mismatch near thrPx */
        refTranslateStart = translateStart;
        refVhAtFreeze = viewportHeight;
        refSection2TopZero = Math.round(scrollY + top);
        refScrollYAtFreeze = scrollY;
        debugLog("FREEZE", "section1Frozen=true scrollY=" + scrollY + " refScrollYAtFreeze=" + refScrollYAtFreeze + " s2Top=" + s2Top + " refTranslateStart=" + refTranslateStart + " refVhAtFreeze=" + refVhAtFreeze + " refSection2TopZero=" + refSection2TopZero);
        if (hero && !hero.classList.contains("hero--released")) {
          hero.classList.add("hero--released");
          debugLog("STATE", "hero--released: layers leave fixed → scroll with hero (no overlap with section 2)");
        }
      }
      /* Hysteresis: avoid unfreeze snap when section 2 barely clears the viewport */
      if (top >= viewportHeight + 40) {
        if (section1Frozen) debugLog("FREEZE", "section1Frozen=false (section2 back out of view, +40px) scrollY=" + scrollY + " s2Top=" + s2Top);
        section1Frozen = false;
        if (hero) hero.classList.remove("hero--released");
      }
      /* section2OutOfView already set above */
    }

    /* Use frozen formula only when section 1 is actually frozen (section 2 in view and anim complete).
       When user scrolls back up and section 2 is out of view, we use the anim branch so section 1
       animates in reverse (temple shrinks, title moves up, flowers move back). */
    if (section1Frozen && refScrollYAtFreeze > 0 && scrollY < refScrollYAtFreeze - 10) {
      section1Frozen = false;
      if (hero) hero.classList.remove("hero--released");
      debugLog("FREEZE", "section1Frozen=false (scrolled back above threshold) scrollY=" + scrollY + " refScrollYAtFreeze=" + refScrollYAtFreeze);
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
      var logTy = heroReleased ? 0 : frozenTranslateY;
      var logPull = heroReleased ? 0 : pullOffsetPx;
      lastAppliedTranslateY = logTy;
      lastScrollUpdateTime = nowMs;
      debugLogScrollLayout(nowMs, heroReleased ? "FROZEN_REL" : "FROZEN", {
        scrollY: scrollY,
        scrollDelta: scrollDelta,
        rawScrollY: rawScrollY,
        viewportH: viewportHeight,
        layoutVh: layoutVh,
        stableVh: isMobile ? stableVh : null,
        isMobile: isMobile,
        touch: isTouchActive,
        frozen: true,
        path: pathTaken,
        progress: progress,
        thresholdPx: thresholdPx,
        translateStart: translateStart,
        translateY: logTy,
        pull: logPull,
        animProgress: null,
        refTS: refTranslateStart,
        refVhF: refVhAtFreeze,
        refS2Z: refSection2TopZero,
        s2Top: s2Top,
        s2Out: section2OutOfView,
        couple: coupleProgress,
        mtnTy: logTy + logPull,
        titleTopPct: titleTopEnd,
        titleTy: logTy + logPull,
        templeTy: logTy + logPull,
        flwTy: logTy + (heroReleased ? 0 : flowersOffsetPx) + logPull,
        mountains: mountains,
        titleLayer: titleLayer,
        templeWrap: templeWrap,
        flowersLayer: flowersLayer,
        section2: section2,
        hero: hero,
        scrollArea: heroScrollArea
      });
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
    debugLogScrollLayout(nowMs, "ANIM", {
      scrollY: scrollY,
      scrollDelta: scrollDelta,
      rawScrollY: rawScrollY,
      viewportH: viewportHeight,
      layoutVh: layoutVh,
      stableVh: isMobile ? stableVh : null,
      isMobile: isMobile,
      touch: isTouchActive,
      frozen: false,
      path: pathTaken,
      progress: progress,
      thresholdPx: thresholdPx,
      translateStart: translateStart,
      translateY: translateY,
      pull: pullOffsetPx,
      animProgress: animProgress,
      refTS: refTranslateStart,
      refVhF: refVhAtFreeze,
      refS2Z: refSection2TopZero,
      s2Top: s2Top,
      s2Out: section2OutOfView,
      couple: coupleProgress,
      mtnTy: mountainsTranslateY,
      titleTopPct: titleTopPctAnim,
      titleTy: titleTranslateY,
      templeTy: templeTranslateY,
      flwTy: flowersTranslateY,
      mountains: mountains,
      titleLayer: titleLayer,
      templeWrap: templeWrap,
      flowersLayer: flowersLayer,
      section2: section2,
      hero: hero,
      scrollArea: heroScrollArea
    });
  }

  function scheduleScrollUpdate() {
    if (!firstScrollLogged) {
      firstScrollLogged = true;
      var raw = window.scrollY || window.pageYOffset;
      debugLog("SCROLL", "first scroll event scrollY=" + raw + (raw < 0 ? " (will clamp to 0)" : ""));
    }
    if (scrollScheduled) return;
    scrollScheduled = true;
    if (scrollRaf !== null) return;
    scrollRaf = requestAnimationFrame(runScrollUpdates);
  }

  window.addEventListener("scroll", scheduleScrollUpdate, { passive: true });
  window.addEventListener("resize", function () {
    var sy = window.scrollY || window.pageYOffset;
    debugLog("RESIZE", "w=" + window.innerWidth + " h=" + window.innerHeight + " scrollY=" + sy + " frozen=" + section1Frozen + " refVh=" + refVhAtFreeze + " refTxStart=" + refTranslateStart);
    scrollScheduled = false;
    runScrollUpdates();
    var m = mountainsEl || document.querySelector(".hero__mountains");
    debugLog("RESIZE_LAYERS", "hero " + shortRect(hero) + " | scrollArea " + shortRect(heroScrollArea));
    debugLog("RESIZE_LAYERS", "mountains " + shortRect(m) + " | title " + shortRect(titleLayer) + " | temple " + shortRect(templeWrap));
    debugLog("RESIZE_LAYERS", "flowers " + shortRect(flowersLayer) + " | section2 " + shortRect(section2));
  });

  /* Touch tracking for mobile scroll stability */
  var debugTouchLogTime = 0;
  window.addEventListener("touchstart", function (e) {
    isTouchActive = true;
    var t = e.touches[0];
    debugLog("TOUCH", "start clientX=" + (t ? t.clientX : "") + " clientY=" + (t ? t.clientY : "") + " scrollY=" + (window.scrollY || window.pageYOffset));
  }, { passive: true });
  window.addEventListener("touchmove", function (e) {
    var now = Date.now();
    if (now - debugTouchLogTime < 200) return;
    debugTouchLogTime = now;
    var t = e.touches[0];
    debugLog("TOUCH", "move clientX=" + (t ? t.clientX : "") + " clientY=" + (t ? t.clientY : "") + " scrollY=" + (window.scrollY || window.pageYOffset));
  }, { passive: true });
  window.addEventListener("touchend", function (e) {
    isTouchActive = false;
    debugLog("TOUCH", "end scrollY=" + (window.scrollY || window.pageYOffset) + " changedTouches=" + (e.changedTouches ? e.changedTouches.length : 0));
  }, { passive: true });
  window.addEventListener("touchcancel", function () {
    isTouchActive = false;
  }, { passive: true });

  setTimeout(function () {
    debugLog("INIT", "setTimeout(80): runScrollUpdates + initial title/temple set");
    scrollScheduled = false;
    runScrollUpdates();
    if (titleLayer) titleLayer.style.setProperty("--title-top", titleTopStart + "%");
    templeWrap.style.setProperty("--temple-height", getTempleHeights().initial + "vh");
    if (hero) {
      var hr = hero.getBoundingClientRect();
      debugLog("POSITION", "hero getBoundingClientRect top=" + hr.top + " left=" + hr.left + " height=" + hr.height + " width=" + hr.width);
    }
    if (section2) {
      var s2r = section2.getBoundingClientRect();
      debugLog("POSITION", "section2 getBoundingClientRect top=" + s2r.top + " left=" + s2r.left + " height=" + s2r.height + " width=" + s2r.width);
    }
  }, 80);

  setTimeout(function () {
    if (hero) {
      hero.classList.add("hero--loaded");
      hero.classList.remove("hero--drop-in");
      debugLog("ANIM", "hero--loaded set (drop-in complete)");
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

  /* Copy debug logs button */
  (function () {
    var btn = document.getElementById("debugLogsCopy");
    if (btn) btn.addEventListener("click", debugCopy);
  })();
})();
