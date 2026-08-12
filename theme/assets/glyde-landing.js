(() => {
  "use strict";

  const state = window.__glydeLandingState || {
    documentBound: false,
    id: 0,
    initialized: new WeakMap(),
  };
  window.__glydeLandingState = state;

  const initialized = state.initialized;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const selectors = {
    landing: "[data-glyde-landing]",
    results: "[data-glyde-results], [data-results]",
    resultsTrack: "[data-glyde-results-track], [data-results-track]",
    resultsNext: "[data-glyde-results-next], [data-results-next]",
    resultsCount: "[data-glyde-results-count], [data-results-count]",
    resultSlide: "[data-glyde-result], [data-result-card]",
    autoFade: "[data-glyde-auto-fade], [data-auto-fade]",
    autoFadeVisual: "[data-glyde-auto-fade-visual], [data-auto-visual]",
    autoFadeTab: "[data-glyde-auto-fade-tab], [data-auto-step]",
    design: "[data-glyde-design], [data-design]",
    designViewport: "[data-glyde-design-viewport], [data-design-viewport]",
    designNext: "[data-glyde-design-next], [data-design-next]",
    designCard: "[data-glyde-design-card], [data-design-card], .designCard",
    faq: "[data-glyde-faq], [data-faq]",
    faqItem: "[data-glyde-faq-item], [data-faq-item]",
    faqButton: "[data-glyde-faq-button], [data-faq-toggle]",
    faqAnswer: "[data-glyde-faq-answer], [data-faq-answer]",
  };

  function markInitialized(element, feature) {
    let features = initialized.get(element);

    if (!features) {
      features = new Set();
      initialized.set(element, features);
    }

    if (features.has(feature)) return false;
    features.add(feature);
    return true;
  }

  function findAll(root, selector) {
    const matches = root instanceof Element && root.matches(selector) ? [root] : [];
    return matches.concat(Array.from(root.querySelectorAll(selector)));
  }

  function ensureId(element, prefix) {
    if (!element.id) {
      state.id += 1;
      element.id = `${prefix}-${state.id}`;
    }
    return element.id;
  }

  function clampIndex(index, count) {
    if (!count) return 0;
    return ((index % count) + count) % count;
  }

  function numericIndex(element, fallback) {
    const explicit = element.dataset.glydeIndex;
    const oneBasedStep = element.dataset.autoStep;
    const value = Number.parseInt(explicit || oneBasedStep || "", 10);
    if (!Number.isFinite(value)) return fallback;
    return explicit ? value : value - 1;
  }

  function initResults(root) {
    findAll(root, selectors.results).forEach((section) => {
      const track = section.querySelector(selectors.resultsTrack);
      const next = section.querySelector(selectors.resultsNext);
      const count = section.querySelector(selectors.resultsCount);
      const slides = Array.from(section.querySelectorAll(selectors.resultSlide));

      if (!track || !next || slides.length === 0) return;
      if (!markInitialized(section, "results")) return;

      next.setAttribute("aria-controls", ensureId(track, "glyde-results-track"));
      if (count) count.setAttribute("aria-live", "polite");

      let active = clampIndex(
        Number.parseInt(section.dataset.glydeActive || "0", 10) || 0,
        slides.length,
      );

      const render = (requestedIndex, focusSlide = false) => {
        active = clampIndex(requestedIndex, slides.length);
        section.dataset.glydeActive = String(active);
        track.style.setProperty("--active-result", String(active));

        // More than one result card is intentionally visible on wide screens,
        // so do not hide the non-primary cards from assistive technology.
        slides.forEach((slide, index) => {
          slide.dataset.glydeActive = String(index === active);
        });

        if (count) {
          count.textContent = `${String(active + 1).padStart(2, "0")} / ${String(slides.length).padStart(2, "0")}`;
        }

        next.setAttribute(
          "aria-label",
          `Show result ${clampIndex(active + 1, slides.length) + 1} of ${slides.length}`,
        );

        if (focusSlide) {
          slides[active].setAttribute("tabindex", "-1");
          slides[active].focus({ preventScroll: true });
        }
      };

      next.addEventListener("click", () => render(active + 1));
      section.addEventListener("glyde:select", (event) => {
        const index = Number(event.detail?.index);
        if (Number.isFinite(index)) render(index, Boolean(event.detail?.focus));
      });

      render(active);
    });
  }

  function initAutoFade(root) {
    findAll(root, selectors.autoFade).forEach((section) => {
      const visual = section.querySelector(selectors.autoFadeVisual);
      const tabs = Array.from(section.querySelectorAll(selectors.autoFadeTab));
      if (tabs.length === 0) return;
      if (!markInitialized(section, "auto-fade")) return;

      const visualId = visual ? ensureId(visual, "glyde-auto-fade-visual") : "";

      let active = clampIndex(
        Number.parseInt(section.dataset.glydeActive || "0", 10) || 0,
        tabs.length,
      );

      const render = (requestedIndex, focusTab = false) => {
        active = clampIndex(requestedIndex, tabs.length);
        section.dataset.glydeActive = String(active);
        if (visual) visual.dataset.step = String(active + 1);

        tabs.forEach((tab, index) => {
          const isActive = index === active;
          tab.setAttribute("aria-pressed", String(isActive));
          tab.setAttribute("tabindex", isActive ? "0" : "-1");
          tab.classList.toggle("is-active", isActive);
          tab.classList.toggle("activeTab", isActive);
          tab.dataset.glydeActive = String(isActive);
          if (visualId) tab.setAttribute("aria-controls", visualId);
        });

        if (focusTab) tabs[active].focus();
      };

      tabs.forEach((tab, fallbackIndex) => {
        const index = numericIndex(tab, fallbackIndex);
        tab.addEventListener("click", () => render(index));
        tab.addEventListener("keydown", (event) => {
          let nextIndex;

          switch (event.key) {
            case "ArrowRight":
            case "ArrowDown":
              nextIndex = active + 1;
              break;
            case "ArrowLeft":
            case "ArrowUp":
              nextIndex = active - 1;
              break;
            case "Home":
              nextIndex = 0;
              break;
            case "End":
              nextIndex = tabs.length - 1;
              break;
            default:
              return;
          }

          event.preventDefault();
          render(nextIndex, true);
        });
      });

      section.addEventListener("glyde:select", (event) => {
        const index = Number(event.detail?.index);
        if (Number.isFinite(index)) render(index, Boolean(event.detail?.focus));
      });

      render(active);
    });
  }

  function initDesign(root) {
    findAll(root, selectors.design).forEach((section) => {
      const viewport = section.querySelector(selectors.designViewport);
      const next = section.querySelector(selectors.designNext);
      const cards = Array.from(section.querySelectorAll(selectors.designCard));
      if (!viewport || !next) return;
      if (!markInitialized(section, "design")) return;

      next.setAttribute("aria-controls", ensureId(viewport, "glyde-design-viewport"));

      const advance = () => {
        viewport.scrollBy({
          left: 420,
          behavior: reducedMotion.matches ? "auto" : "smooth",
        });
      };

      next.addEventListener("click", advance);
    });
  }

  function initFaq(root) {
    findAll(root, selectors.faq).forEach((section) => {
      const items = Array.from(section.querySelectorAll(selectors.faqItem));
      if (items.length === 0 || !markInitialized(section, "faq")) return;

      const setExpanded = (item, expanded) => {
        const button = item.querySelector(selectors.faqButton);
        const answer = item.querySelector(selectors.faqAnswer);
        if (!button || !answer) return;

        const buttonId = ensureId(button, "glyde-faq-button");
        const answerId = ensureId(answer, "glyde-faq-answer");

        button.setAttribute("aria-controls", answerId);
        button.setAttribute("aria-expanded", String(expanded));
        answer.setAttribute("aria-labelledby", buttonId);
        answer.setAttribute("role", "region");
        answer.setAttribute("aria-hidden", String(!expanded));
        answer.toggleAttribute("inert", !expanded);
        item.classList.toggle("is-open", expanded);
        item.classList.toggle("faqOpen", expanded);
        item.dataset.glydeOpen = String(expanded);
      };

      const closeAll = (except = null) => {
        items.forEach((item) => setExpanded(item, item === except));
      };

      // Product requirement: every FAQ starts collapsed, including after a
      // Shopify Theme Editor section reload.
      closeAll();

      items.forEach((item, fallbackIndex) => {
        const button = item.querySelector(selectors.faqButton);
        if (!button) return;

        button.addEventListener("click", () => {
          const wasExpanded = button.getAttribute("aria-expanded") === "true";
          closeAll(wasExpanded ? null : item);
        });

        item.dataset.glydeIndex = item.dataset.glydeIndex || String(fallbackIndex);
      });

      section.addEventListener("glyde:select", (event) => {
        const index = Number(event.detail?.index);
        if (!Number.isFinite(index) || !items[index]) return;
        closeAll(items[index]);
        if (event.detail?.focus) {
          items[index].querySelector(selectors.faqButton)?.focus();
        }
      });
    });
  }

  function init(root = document) {
    initResults(root);
    initAutoFade(root);
    initDesign(root);
    initFaq(root);
  }

  function rootFromShopifyEvent(event) {
    const target = event.target;
    if (!(target instanceof Element)) return document;
    return target.matches(selectors.landing)
      ? target
      : target.querySelector(selectors.landing) || target;
  }

  function featureForBlock(block) {
    if (block.matches(selectors.resultSlide) || block.querySelector(selectors.resultSlide)) {
      return selectors.results;
    }
    if (block.matches(selectors.autoFadeTab) || block.querySelector(selectors.autoFadeTab)) {
      return selectors.autoFade;
    }
    if (block.matches(selectors.designCard) || block.querySelector(selectors.designCard)) {
      return selectors.design;
    }
    if (block.matches(selectors.faqItem) || block.querySelector(selectors.faqItem)) {
      return selectors.faq;
    }
    return null;
  }

  if (!state.documentBound) {
    state.documentBound = true;

    document.addEventListener("DOMContentLoaded", () => init());

    document.addEventListener("shopify:section:load", (event) => {
      init(rootFromShopifyEvent(event));
    });

    document.addEventListener("shopify:block:select", (event) => {
      const block = event.target;
      if (!(block instanceof Element)) return;

      const featureSelector = featureForBlock(block);
      const feature = featureSelector
        ? block.closest(featureSelector) || block.querySelector(featureSelector)
        : block.querySelector(selectors.results) ||
          block.querySelector(selectors.autoFade) ||
          block.querySelector(selectors.design) ||
          block.querySelector(selectors.faq);
      if (!feature) return;

      const resolvedFeatureSelector = feature.matches(selectors.results)
        ? selectors.results
        : feature.matches(selectors.autoFade)
          ? selectors.autoFade
          : feature.matches(selectors.design)
            ? selectors.design
            : selectors.faq;

      const siblings = Array.from(
        feature.querySelectorAll(
          resolvedFeatureSelector === selectors.results
            ? selectors.resultSlide
            : resolvedFeatureSelector === selectors.autoFade
              ? selectors.autoFadeTab
              : resolvedFeatureSelector === selectors.design
                ? selectors.designCard
                : selectors.faqItem,
        ),
      );
      const selected = featureSelector
        ? block.matches(
            resolvedFeatureSelector === selectors.results
              ? selectors.resultSlide
              : resolvedFeatureSelector === selectors.autoFade
                ? selectors.autoFadeTab
                : resolvedFeatureSelector === selectors.design
                  ? selectors.designCard
                  : selectors.faqItem,
          )
          ? block
          : block.querySelector(
              resolvedFeatureSelector === selectors.results
                ? selectors.resultSlide
                : resolvedFeatureSelector === selectors.autoFade
                  ? selectors.autoFadeTab
                  : resolvedFeatureSelector === selectors.design
                    ? selectors.designCard
                    : selectors.faqItem,
            )
        : block.querySelector(
            resolvedFeatureSelector === selectors.results
              ? selectors.resultSlide
              : resolvedFeatureSelector === selectors.autoFade
                ? selectors.autoFadeTab
                : resolvedFeatureSelector === selectors.design
                  ? selectors.designCard
                  : selectors.faqItem,
          );
      const index = Math.max(0, siblings.indexOf(selected));

      feature.dispatchEvent(
        new CustomEvent("glyde:select", {
          detail: { index, focus: false },
        }),
      );
    });
  }

  // Scripts loaded with defer execute after parsing but before
  // DOMContentLoaded; scripts dynamically injected by the Theme Editor may
  // execute afterwards. Cover both without binding listeners twice.
  if (document.readyState !== "loading") init();
})();
