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

  if (!hero || !templeWrap) return;

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
  templeWrap.style.setProperty("--temple-height", h0.initial + "vh");
  var initialRisePx = 0.15 * (window.innerHeight || 600);
  templeWrap.style.transform = "translateY(" + initialRisePx + "px)";
  templeWrap.style.transition = "none";

  var scrollRaf = null;
  var scrollScheduled = false;
  var lastCoupleProgress = -1;
  var section1Frozen = false;
  var refTranslateStart = 0;
  var refVhAtFreeze = 0;
  /** When frozen: section 2 top in viewport = refSection2TopZero - scrollY. Used so coupleProgress is derived from scrollY (same as section 1). */
  var refSection2TopZero = 0;

  function runScrollUpdates() {
    scrollRaf = null;
    scrollScheduled = false;

    var scrollY = window.scrollY || window.pageYOffset;
    var viewportHeight = window.innerHeight;
    var isMobile = window.innerWidth < mobileBreakpoint;

    var thresholdPx = (scrollForFullVh / 100) * viewportHeight;
    var translateStart = thresholdPx - 20;
    var translateY = scrollY > translateStart ? -(scrollY - translateStart) : 0;
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
      }
      if (top >= viewportHeight) section1Frozen = false;
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
      if (titleLayer) {
        titleLayer.style.setProperty("--title-top", titleTopEnd + "%");
        titleLayer.style.transition = "none";
        titleLayer.style.transform = "translateY(-50%) translateY(" + frozenTranslateY + "px)";
      }
      templeWrap.style.setProperty("--temple-height", heights.max + "vh");
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
      return;
    }

    if (hero) hero.classList.remove("hero--section1-frozen");

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
