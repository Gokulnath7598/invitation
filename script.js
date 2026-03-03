(function () {
  "use strict";

  /* Section 1: mountain BG + temple, text, flowers. When progress >= 1, animations are "complete" (temple at max, etc.)
   * but we still apply translateY from scroll so section 1 scrolls away and section 2 can take over – we only freeze the
   * animation state, not the scroll position. */

  var hero = document.getElementById("hero");
  var templeWrap = document.getElementById("templeWrap");
  var titleLayer = document.getElementById("heroContent");
  var flowersLayer = document.querySelector(".hero__flowers-layer");
  var flowersInner = document.querySelector(".hero__flowers-inner");
  var flowersTitleGroup = document.querySelector(".hero__flowers-title-group");
  var section2 = document.getElementById("section2");

  if (!hero || !templeWrap) return;

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
  var debugLogCount = 0;

  function runScrollUpdates() {
    scrollRaf = null;
    scrollScheduled = false;

    var scrollY = window.scrollY || window.pageYOffset;
    var viewportHeight = window.innerHeight;
    var isMobile = window.innerWidth < mobileBreakpoint;
    var thresholdPx = (scrollForFullVh / 100) * viewportHeight;
    var scrollVh = (scrollY / viewportHeight) * 100;
    var progress = Math.min(scrollVh / scrollForFullVh, 1);

    /* translateY: moves section 1 content up as user scrolls past threshold, so section 1 scrolls away */
    var translateStart = thresholdPx - 20;
    var translateY = scrollY > translateStart ? -(scrollY - translateStart) : 0;

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

    /* Section 2 */
    if (section2) {
      var rect = section2.getBoundingClientRect();
      var top = rect.top;
      var start = viewportHeight;
      var end = viewportHeight * 0.15;
      var coupleProgress = 1 - (top - end) / (start - end);
      coupleProgress = Math.max(0, Math.min(1, coupleProgress));
      coupleProgress = Math.round(coupleProgress * 100) / 100;
      if (top < -50) coupleProgress = 1;
      if (coupleProgress !== lastCoupleProgress) {
        lastCoupleProgress = coupleProgress;
        section2.style.setProperty("--couple-progress", coupleProgress);
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
    }

    /* Debug (remove when you confirm it's fixed) */
    var section2Top = section2 ? section2.getBoundingClientRect().top : viewportHeight + 1;
    if (section2Top <= viewportHeight * 1.2 && section2Top >= -200) {
      debugLogCount++;
      if (debugLogCount % 2 === 0) {
        console.log("[s1->s2]", {
          progress: Math.round(progress * 100) / 100,
          animProgress: Math.round(animProgress * 100) / 100,
          scrollY: Math.round(scrollY),
          vh: viewportHeight,
          mobile: isMobile,
          section2Top: Math.round(section2Top),
          coupleProgress: section2 ? lastCoupleProgress : null
        });
      }
    } else {
      debugLogCount = 0;
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
})();
