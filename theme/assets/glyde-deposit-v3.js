(() => {
  "use strict";

  const GLOBAL_KEY = "__glydeDepositV3";
  const existingRuntime = window[GLOBAL_KEY];

  // Theme Editor reloads can evaluate the same layout asset more than once.
  // Reuse the existing runtime so document-level listeners stay single-bound.
  if (existingRuntime?.init) {
    existingRuntime.init(document);
    return;
  }

  const ROOT_SELECTOR = "[data-glyde-deposit-v3]";
  const SELECTED_CLASS = "glyde-deposit-v3__gallery-thumb--selected";
  const OPEN_CLASS = "glyde-deposit-v3__faq-item--open";
  const MOBILE_BREAKPOINT = "(max-width: 900px)";
  const rootTeardowns = new WeakMap();
  const activeRoots = new Set();

  function listen(target, type, listener, options, cleanups) {
    target.addEventListener(type, listener, options);
    cleanups.push(() => target.removeEventListener(type, listener, options));
  }

  function safePlay(video) {
    try {
      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {});
      }
    } catch {
      // Unsupported media and autoplay refusal both leave the poster visible.
    }
  }

  function pauseAndReset(video) {
    video.pause();
    try {
      video.currentTime = 0;
    } catch {
      // A source that has not loaded metadata yet may not be seekable.
    }
  }

  function initializeGallery(gallery, cleanups) {
    const thumbs = Array.from(gallery.querySelectorAll("[data-gallery-thumb]"));
    const mediaItems = Array.from(gallery.querySelectorAll("[data-gallery-media]"));
    let selectedIndex = 0;

    function selectMedia(nextIndex, replaySelectedVideo = false) {
      if (!Number.isInteger(nextIndex) || nextIndex < 0 || nextIndex >= mediaItems.length) return;

      const selectedMedia = mediaItems[nextIndex];
      const isSameSelection = nextIndex === selectedIndex;

      mediaItems.forEach((media, index) => {
        const isSelected = index === nextIndex;
        media.hidden = !isSelected;

        if (media instanceof HTMLVideoElement && !isSelected) {
          pauseAndReset(media);
        }
      });

      thumbs.forEach((thumb, index) => {
        const isSelected = index === nextIndex;
        thumb.classList.toggle(SELECTED_CLASS, isSelected);
        thumb.setAttribute("aria-pressed", String(isSelected));
      });

      selectedIndex = nextIndex;

      if (selectedMedia instanceof HTMLVideoElement) {
        if (!isSameSelection || replaySelectedVideo) selectedMedia.currentTime = 0;
        safePlay(selectedMedia);
      }
    }

    thumbs.forEach((thumb) => {
      const handleClick = () => {
        const nextIndex = Number.parseInt(thumb.dataset.galleryThumb || "", 10);
        selectMedia(nextIndex, true);
      };
      listen(thumb, "click", handleClick, undefined, cleanups);
    });

    mediaItems.forEach((media) => {
      if (!(media instanceof HTMLVideoElement)) return;

      const togglePlayback = () => {
        if (media.paused) safePlay(media);
        else media.pause();
      };

      const handleKeyDown = (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        togglePlayback();
      };

      listen(media, "click", togglePlayback, undefined, cleanups);
      listen(media, "keydown", handleKeyDown, undefined, cleanups);
    });

    selectMedia(0);
  }

  function updateFaqState(root) {
    const hasOpenFaq = Boolean(
      root.querySelector(`.glyde-deposit-v3__mobile-faq .${OPEN_CLASS}`),
    );
    root.toggleAttribute("data-faq-open", hasOpenFaq);
  }

  function initializeFaq(root, list, cleanups) {
    const items = Array.from(list.querySelectorAll("[data-faq-item]"));

    items.forEach((item) => {
      const trigger = item.querySelector("[data-faq-trigger]");
      const answer = item.querySelector("[data-faq-answer]");
      if (!(trigger instanceof HTMLButtonElement) || !(answer instanceof HTMLElement)) return;

      const handleClick = () => {
        const shouldOpen = !item.classList.contains(OPEN_CLASS);

        items.forEach((candidate) => {
          const candidateTrigger = candidate.querySelector("[data-faq-trigger]");
          const candidateAnswer = candidate.querySelector("[data-faq-answer]");
          const isOpen = candidate === item && shouldOpen;

          candidate.classList.toggle(OPEN_CLASS, isOpen);
          candidateTrigger?.setAttribute("aria-expanded", String(isOpen));
          candidateAnswer?.setAttribute("aria-hidden", String(!isOpen));
        });

        updateFaqState(root);
      };

      listen(trigger, "click", handleClick, undefined, cleanups);
    });
  }

  function pauseHiddenWrapperVideos(root, mobileBreakpoint) {
    const hiddenWrapperSelector = mobileBreakpoint.matches
      ? ".glyde-deposit-v3__desktop-wrapper"
      : ".glyde-deposit-v3__mobile-wrapper";

    root.querySelectorAll(`${hiddenWrapperSelector} video`).forEach((video) => {
      if (video instanceof HTMLVideoElement) pauseAndReset(video);
    });
  }

  function initializeRoot(root) {
    if (rootTeardowns.has(root)) return;

    const cleanups = [];
    const mobileBreakpoint = window.matchMedia(MOBILE_BREAKPOINT);
    let breakpointFrame = 0;

    const syncBreakpointMedia = () => {
      breakpointFrame = 0;
      pauseHiddenWrapperVideos(root, mobileBreakpoint);
    };

    const scheduleBreakpointSync = () => {
      if (breakpointFrame) return;
      breakpointFrame = window.requestAnimationFrame(syncBreakpointMedia);
    };

    const teardown = () => {
      window.cancelAnimationFrame(breakpointFrame);
      breakpointFrame = 0;
      while (cleanups.length) cleanups.pop()();
      root.querySelectorAll("video").forEach((video) => {
        if (video instanceof HTMLVideoElement) pauseAndReset(video);
      });
      activeRoots.delete(root);
      rootTeardowns.delete(root);
    };

    rootTeardowns.set(root, teardown);
    activeRoots.add(root);

    try {
      root
        .querySelectorAll("[data-glyde-deposit-gallery]")
        .forEach((gallery) => initializeGallery(gallery, cleanups));
      root
        .querySelectorAll("[data-glyde-deposit-faq]")
        .forEach((list) => initializeFaq(root, list, cleanups));

      if (typeof mobileBreakpoint.addEventListener === "function") {
        listen(mobileBreakpoint, "change", scheduleBreakpointSync, undefined, cleanups);
      } else {
        mobileBreakpoint.addListener(scheduleBreakpointSync);
        cleanups.push(() => mobileBreakpoint.removeListener(scheduleBreakpointSync));
      }
      listen(window, "resize", scheduleBreakpointSync, { passive: true }, cleanups);

      updateFaqState(root);
      syncBreakpointMedia();
    } catch (error) {
      teardown();
      throw error;
    }
  }

  function initializeWithin(container = document) {
    if (!container || typeof container.querySelectorAll !== "function") return;
    if (container instanceof Element && container.matches(ROOT_SELECTOR)) initializeRoot(container);
    container.querySelectorAll(ROOT_SELECTOR).forEach(initializeRoot);
  }

  function destroyWithin(container) {
    if (!(container instanceof Node)) return;
    for (const root of Array.from(activeRoots)) {
      if (root === container || container.contains(root)) {
        rootTeardowns.get(root)?.();
      }
    }
  }

  const runtime = {
    init: initializeWithin,
    destroy: destroyWithin,
  };
  window[GLOBAL_KEY] = runtime;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => initializeWithin(), { once: true });
  } else {
    initializeWithin();
  }

  document.addEventListener("shopify:section:load", (event) => initializeWithin(event.target));
  document.addEventListener("shopify:section:unload", (event) => destroyWithin(event.target));
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) return;
    for (const root of activeRoots) {
      root.querySelectorAll("video").forEach((video) => video.pause());
    }
  });
})();
