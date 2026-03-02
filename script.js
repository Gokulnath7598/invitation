(function () {
  "use strict";

  var hero = document.getElementById("hero");
  var templeWrap = document.getElementById("templeWrap");
  var titleLayer = document.getElementById("heroContent");
  var flowersLayer = document.querySelector(".hero__flowers-layer");
  var flowersInner = document.querySelector(".hero__flowers-inner");
  var flowersTitleGroup = document.querySelector(".hero__flowers-title-group");
  var section2 = document.getElementById("section2");

  if (!hero || !templeWrap) return;

  var initialTempleVh = 50;
  var maxTempleVh = 95;
  var mobileBreakpoint = 768;
  var scrollForFullVh = 55;
  var titleTopStart = 32;
  var titleTopEnd = 72;

  function getTempleHeights() {
    var isMobile = window.innerWidth < mobileBreakpoint;
    return {
      initial: isMobile ? 30 : initialTempleVh,
      max: isMobile ? 92 : maxTempleVh
    };
  }

  /* Set correct initial temple height and transform immediately so no jump on load */
  var h0 = getTempleHeights();
  templeWrap.style.setProperty("--temple-height", h0.initial + "vh");
  var initialRisePx = 0.15 * (window.innerHeight || 600);
  templeWrap.style.transform = "translateY(" + initialRisePx + "px)";
  templeWrap.style.transition = "none";

  function updateTempleReveal() {
    var scrollY = window.scrollY || window.pageYOffset;
    var viewportHeight = window.innerHeight;
    var scrollVh = (scrollY / viewportHeight) * 100;
    var progress = Math.min(scrollVh / scrollForFullVh, 1);
    /* Section 1 only: title moves down in sync with temple rising */
    if (titleLayer) {
      var titleTop = titleTopStart + (titleTopEnd - titleTopStart) * progress;
      titleLayer.style.setProperty("--title-top", titleTop + "%");
    }
  }

  function updateBgScroll() {
    var scrollY = window.scrollY || window.pageYOffset;
    var viewportHeight = window.innerHeight;
    var thresholdPx = (scrollForFullVh / 100) * viewportHeight;
    var scrollVh = (scrollY / viewportHeight) * 100;
    var progress = Math.min(scrollVh / scrollForFullVh, 1);
    var translateY = scrollY > thresholdPx ? -(scrollY - thresholdPx) : 0;
    var pastSection1 = scrollY > thresholdPx;
    var useTransition = !hero || !hero.classList.contains("hero--loaded");
    var flowersLiftPx = 0.1 * viewportHeight;
    var flowersMoveDownPx = progress * 0.2 * viewportHeight;
    var heights = getTempleHeights();
    var heightVh = progress < 1
      ? heights.initial + (heights.max - heights.initial) * progress
      : heights.max;
    var templeTranslateY = Math.round((1 - progress) * 0.15 * viewportHeight + translateY);
    templeWrap.style.setProperty("--temple-height", heightVh + "vh");
    templeWrap.style.transform = "translateY(" + templeTranslateY + "px)";
    templeWrap.style.transition = "none";
    if (flowersLayer) {
      flowersLayer.style.transition = useTransition ? "" : "none";
      flowersLayer.style.transform = "translateY(" + (-flowersLiftPx + flowersMoveDownPx + translateY) + "px)";
    }
    if (flowersInner) flowersInner.style.transform = "translateY(0)";
    if (flowersTitleGroup) flowersTitleGroup.style.transform = "translateY(0)";
    var mountains = document.querySelector(".hero__mountains");
    if (mountains) mountains.style.transform = "translateY(" + translateY + "px)";
    if (titleLayer) {
      titleLayer.style.transition = useTransition ? "" : "none";
      titleLayer.style.transform = "translateY(-50%) translateY(" + translateY + "px)";
    }
  }

  /* Section 2: groom left → center, bride right → center as we scroll in */
  var coupleProgressRaf = null;
  var lastCoupleProgress = -1;

  function updateCoupleProgress() {
    if (!section2) return;
    if (coupleProgressRaf !== null) return;
    coupleProgressRaf = requestAnimationFrame(function () {
      coupleProgressRaf = null;
      var viewportHeight = window.innerHeight;
      var rect = section2.getBoundingClientRect();
      var top = rect.top;
      var start = viewportHeight;
      var end = viewportHeight * 0.15;
      var progress = 1 - (top - end) / (start - end);
      progress = Math.max(0, Math.min(1, progress));
      /* Round to 2 decimals to avoid sub-pixel jitter; once fully in section 2 keep at 1 */
      progress = Math.round(progress * 100) / 100;
      if (top < -50) progress = 1; /* well inside section 2 – lock to 1 to prevent jump */
      if (progress !== lastCoupleProgress) {
        lastCoupleProgress = progress;
        section2.style.setProperty("--couple-progress", progress);
      }
    });
  }

  function onScroll() {
    updateTempleReveal();
    updateBgScroll();
    updateCoupleProgress();
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", function () {
    updateTempleReveal();
    updateBgScroll();
    updateCoupleProgress();
  });
  /* After a short delay, apply final position so CSS transition runs smoothly (no flicker) */
  var dropInDurationMs = 2000;
  setTimeout(function () {
    updateTempleReveal();
    updateBgScroll();
    if (titleLayer) titleLayer.style.setProperty("--title-top", titleTopStart + "%");
    var h = getTempleHeights();
    templeWrap.style.setProperty("--temple-height", h.initial + "vh");
  }, 80);
  /* After drop-in animation finishes, switch to short transition for scroll */
  setTimeout(function () {
    if (hero) {
      hero.classList.add("hero--loaded");
      hero.classList.remove("hero--drop-in");
    }
  }, 80 + dropInDurationMs);
})();
