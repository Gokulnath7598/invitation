(function () {
  "use strict";

  /* ---- Debug logger: app init → positioning/scroll (for mobile debugging) ---- */
  var DEBUG_VERSION = "scroll-v4-2024-03-04";
  var DEBUG_MAX_LINES = 600;
  var DEBUG_SCROLL_THROTTLE_MS = 180;
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
  var refVhAtFreeze = 0;
  /** When frozen: section 2 top in viewport = refSection2TopZero - scrollY. Used so coupleProgress is derived from scrollY (same as section 1). */
  var refSection2TopZero = 0;
  var firstScrollLogged = false;
  /** Smoothed translateY to avoid jump when scrollY leaps at unfreeze (e.g. vh change). */
  var lastAppliedTranslateY = 0;
  var lastScrollUpdateTime = 0;

  function runScrollUpdates() {
    scrollRaf = null;
    scrollScheduled = false;

    var nowMs = Date.now();
    var scrollY = window.scrollY || window.pageYOffset;
    /* iOS (and some Android) overscroll bounce can report negative scrollY at the top; clamp to avoid broken layout */
    if (scrollY < 0) {
      scrollY = 0;
      /* Nudge document back to 0 so we don't sit in overscroll (reduces blank gap) */
      if (typeof window.requestAnimationFrame !== "undefined") {
        requestAnimationFrame(function () { window.scrollTo(0, 0); });
      } else {
        window.scrollTo(0, 0);
      }
    }
    var viewportHeight = window.innerHeight;
    var isMobile = window.innerWidth < mobileBreakpoint;

    var thresholdPx = (scrollForFullVh / 100) * viewportHeight;
    var translateStart = thresholdPx - 20;
    var translateY = scrollY > translateStart ? -(scrollY - translateStart) : 0;
    /* After unfreeze, vh can be smaller than refVhAtFreeze (mobile chrome hid). Use frozen baseline for all scrollY where we could have just unfrozen (section2 just went out of view) so hero doesn't jump. */
    var unfreezeBandEnd = refSection2TopZero > 0 ? refSection2TopZero - viewportHeight : -1;
    var inUnfreezeBand = refTranslateStart > 0 && scrollY >= translateStart && scrollY <= unfreezeBandEnd;
    if (inUnfreezeBand) {
      translateY = -(scrollY - refTranslateStart);
      /* Time-based lerp: smooth towards target so touch/momentum scroll jumps don't cause a visible jump */
      var dt = lastScrollUpdateTime > 0 ? Math.min((nowMs - lastScrollUpdateTime) / 16, 3) : 1;
      lastScrollUpdateTime = nowMs;
      var lerpFactor = isMobile ? 0.2 : 0.35;
      var smooth = lastAppliedTranslateY + (translateY - lastAppliedTranslateY) * lerpFactor * dt;
      translateY = Math.abs(smooth - translateY) < 1 ? translateY : smooth;
      lastAppliedTranslateY = translateY;
    } else if (scrollY > translateStart) {
      translateY = -(scrollY - translateStart);
      lastAppliedTranslateY = translateY;
    } else {
      translateY = 0;
      lastAppliedTranslateY = translateY;
    }
    var scrollVh = (scrollY / viewportHeight) * 100;
    var progress = Math.min(scrollVh / scrollForFullVh, 1);

    /* Section 2: compute first so we know if section 1 should freeze */
    var coupleProgress = 0;
    var s2Top = null;
    var section2OutOfView = false;
    if (section2) {
      var rect = section2.getBoundingClientRect();
      var top = rect.top;
      s2Top = Math.round(top);
      var start = viewportHeight;
      var end = viewportHeight * 0.15;
      coupleProgress = 1 - (top - end) / (start - end);
      coupleProgress = Math.max(0, Math.min(1, coupleProgress));
      coupleProgress = Math.round(coupleProgress * 100) / 100;
      if (top < -50) coupleProgress = 1;
      if (isMobile) {
        if (top < viewportHeight * 0.95) {
          document.body.classList.add("section-2-in-view");
        } else {
          document.body.classList.remove("section-2-in-view");
        }
      } else {
        document.body.classList.remove("section-2-in-view");
      }
      /* Freeze section 1 only when section 2 has started AND section 1 animation is complete (progress >= 1).
         This avoids a jump: we were freezing when s2Top < vh but translateY was still 0, so we applied 0 to
         all layers while the anim path had temple/flowers at non-zero offsets. */
      if (top < viewportHeight && progress >= 1 && !section1Frozen) {
        section1Frozen = true;
        refTranslateStart = Math.round(translateStart);
        refVhAtFreeze = viewportHeight;
        refSection2TopZero = scrollY + top;
        debugLog("POSITION", "section1Frozen=true refTranslateStart=" + refTranslateStart + " refVhAtFreeze=" + refVhAtFreeze + " refSection2TopZero=" + refSection2TopZero);
      }
      if (top >= viewportHeight) {
        if (section1Frozen) debugLog("POSITION", "section1Frozen=false (section2 back out of view)");
        section1Frozen = false;
      }
      section2OutOfView = top >= viewportHeight;
    }

    /* Use frozen formula only when section 1 is actually frozen (section 2 in view and anim complete).
       When user scrolls back up and section 2 is out of view, we use the anim branch so section 1
       animates in reverse (temple shrinks, title moves up, flowers move back). */
    if (section1Frozen) {
      /* Use fractional px so section 1 moves exactly 1:1 with scroll (no rounding bounce) */
      var frozenTranslateY = scrollY > refTranslateStart ? -(scrollY - refTranslateStart) : 0;
      var flowersOffsetPx = 0.1 * refVhAtFreeze;
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
      if (titleLayer) {
        titleLayer.style.setProperty("--title-top", titleTopEnd + "%");
        titleLayer.style.transition = "none";
        titleLayer.style.transform = "translateY(-50%) translateY(" + frozenTranslateY + "px)";
      }
      templeWrap.style.transform = "translateY(" + frozenTranslateY + "px)";
      templeWrap.style.transition = "none";
      if (flowersLayer) {
        flowersLayer.style.transition = "none";
        flowersLayer.style.transform = "translateY(" + (frozenTranslateY + flowersOffsetPx) + "px)";
      }
      if (flowersInner) flowersInner.style.transform = "translateY(0)";
      if (flowersTitleGroup) flowersTitleGroup.style.transform = "translateY(0)";
      var mountains = document.querySelector(".hero__mountains");
      if (mountains) mountains.style.transform = "translateY(" + frozenTranslateY + "px)";
      if (section2 && coupleProgress !== lastCoupleProgress) {
        lastCoupleProgress = coupleProgress;
        section2.style.setProperty("--couple-progress", coupleProgress);
      }
      lastAppliedTranslateY = frozenTranslateY;
      lastScrollUpdateTime = nowMs;
      if (nowMs - debugScrollLogTime >= DEBUG_SCROLL_THROTTLE_MS) {
        debugScrollLogTime = nowMs;
        debugLog("SCROLL", "scrollY=" + scrollY + " vh=" + viewportHeight + " w=" + window.innerWidth + " isMobile=" + isMobile + " progress=" + progress.toFixed(3) + " frozen=1 coupleProgress=" + coupleProgress + " s2Top=" + (s2Top != null ? s2Top : "n/a") + " frozenTranslateY=" + Math.round(frozenTranslateY));
      }
      return;
    }

    if (hero) hero.classList.remove("hero--section1-frozen");

    /* In the unfreeze band use frozen-style layout (temple max, title end, same transforms) so only translateY changes smoothly – avoids shape jump + black gap */
    if (inUnfreezeBand) {
      var heights = getTempleHeights();
      var flowersOffsetPxBand = 0.1 * (refVhAtFreeze || viewportHeight);
      /* Use px from refVhAtFreeze so temple doesn't resize when vh changes */
      var templeHeightPxBand = (heights.max / 100) * (refVhAtFreeze || viewportHeight);
      if (titleLayer) {
        titleLayer.style.setProperty("--title-top", titleTopEnd + "%");
        titleLayer.style.transition = "none";
        titleLayer.style.transform = "translateY(-50%) translateY(" + translateY + "px)";
      }
      templeWrap.style.setProperty("--temple-height", templeHeightPxBand + "px");
      templeWrap.style.transform = "translateY(" + translateY + "px)";
      templeWrap.style.transition = "none";
      if (flowersLayer) {
        flowersLayer.style.transition = "none";
        flowersLayer.style.transform = "translateY(" + (translateY + flowersOffsetPxBand) + "px)";
      }
      if (flowersInner) flowersInner.style.transform = "translateY(0)";
      if (flowersTitleGroup) flowersTitleGroup.style.transform = "translateY(0)";
      var mountainsBand = document.querySelector(".hero__mountains");
      if (mountainsBand) mountainsBand.style.transform = "translateY(" + translateY + "px)";
      if (section2 && coupleProgress !== lastCoupleProgress) {
        lastCoupleProgress = coupleProgress;
        section2.style.setProperty("--couple-progress", coupleProgress);
      }
      lastScrollUpdateTime = nowMs;
      if (nowMs - debugScrollLogTime >= DEBUG_SCROLL_THROTTLE_MS) {
        debugScrollLogTime = nowMs;
        debugLog("SCROLL", "scrollY=" + scrollY + " vh=" + viewportHeight + " refVh=" + refVhAtFreeze + " bandEnd=" + unfreezeBandEnd + " frozen=0 band=1 translateY=" + Math.round(translateY) + " lastApplied=" + Math.round(lastAppliedTranslateY) + " lerpTarget=" + Math.round(-(scrollY - refTranslateStart)));
      }
      return;
    }

    /* Animation state: freeze at 1 when complete (temple max, title at end); still use real translateY so hero scrolls away */
    var animProgress = progress < 1 ? progress : 1;
    var useTransition = !hero || !hero.classList.contains("hero--loaded");
    var flowersLiftPx = 0.1 * viewportHeight;
    var flowersMoveDownPx = animProgress * 0.2 * viewportHeight;
    var heights = getTempleHeights();
    var heightVh = animProgress < 1
      ? heights.initial + (heights.max - heights.initial) * animProgress
      : heights.max;

    var templeTranslateY = Math.round((1 - animProgress) * 0.15 * viewportHeight + translateY);
    var flowersTranslateY = Math.round(-flowersLiftPx + flowersMoveDownPx + translateY);
    var mountainsTranslateY = Math.round(translateY);
    var titleTranslateY = Math.round(translateY);

    /* Section 1: always apply for smooth scroll; animProgress freezes animation at 1 */
    if (titleLayer) {
      var titleTop = titleTopStart + (titleTopEnd - titleTopStart) * animProgress;
      titleLayer.style.setProperty("--title-top", titleTop + "%");
      titleLayer.style.transition = useTransition ? "" : "none";
      titleLayer.style.transform = "translateY(-50%) translateY(" + titleTranslateY + "px)";
    }
    templeWrap.style.setProperty("--temple-height", heightVh + "vh");
    templeWrap.style.transform = "translateY(" + templeTranslateY + "px)";
    templeWrap.style.transition = "none";
    if (flowersLayer) {
      flowersLayer.style.transition = useTransition ? "" : "none";
      flowersLayer.style.transform = "translateY(" + flowersTranslateY + "px)";
    }
    if (flowersInner) flowersInner.style.transform = "translateY(0)";
    if (flowersTitleGroup) flowersTitleGroup.style.transform = "translateY(0)";
    var mountains = document.querySelector(".hero__mountains");
    if (mountains) mountains.style.transform = "translateY(" + mountainsTranslateY + "px)";
    if (section2 && coupleProgress !== lastCoupleProgress) {
      lastCoupleProgress = coupleProgress;
      section2.style.setProperty("--couple-progress", coupleProgress);
    }
    lastAppliedTranslateY = translateY;
    lastScrollUpdateTime = nowMs;
    if (nowMs - debugScrollLogTime >= DEBUG_SCROLL_THROTTLE_MS) {
      debugScrollLogTime = nowMs;
      debugLog("SCROLL", "scrollY=" + scrollY + " vh=" + viewportHeight + " w=" + window.innerWidth + " isMobile=" + isMobile + " progress=" + progress.toFixed(3) + " frozen=0 coupleProgress=" + coupleProgress + " s2Top=" + (s2Top != null ? s2Top : "n/a") + " translateY=" + Math.round(translateY) + " thresholdPx=" + Math.round(thresholdPx) + " heightVh=" + heightVh + " templeTy=" + templeTranslateY + " flowersTy=" + flowersTranslateY + " titleTy=" + titleTranslateY);
    }
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
    debugLog("RESIZE", "w=" + window.innerWidth + " h=" + window.innerHeight + " scrollY=" + (window.scrollY || window.pageYOffset) + " frozen=" + section1Frozen + " refVh=" + refVhAtFreeze + " refTxStart=" + refTranslateStart);
    scrollScheduled = false;
    runScrollUpdates();
  });

  /* Touch logging for mobile scroll debugging */
  var debugTouchLogTime = 0;
  window.addEventListener("touchstart", function (e) {
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
    debugLog("TOUCH", "end scrollY=" + (window.scrollY || window.pageYOffset) + " changedTouches=" + (e.changedTouches ? e.changedTouches.length : 0));
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
