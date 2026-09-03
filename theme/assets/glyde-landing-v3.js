(() => {
  "use strict";

  const GLOBAL_KEY = "__glydeLandingV3";
  const existingRuntime = window[GLOBAL_KEY];

  // Shopify can evaluate the same asset again after a Theme Editor reload.
  // Reuse the first runtime instead of binding document listeners twice.
  if (existingRuntime?.init) {
    existingRuntime.init(document);
    return;
  }

  const controllerMap = new WeakMap();
  const controllers = new Set();
  let generatedId = 0;

  const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");

  const SELECTORS = {
    landing: "[data-glyde-landing]",
    heroVideo: ".heroV2Video",
    topNav: ".topNav",
    waitlist: ".waitlistForm, [data-glyde-waitlist]",
    loopingVideo:
      "video[data-glyde-looping-video], .s2SmartMedia video[loop], .s2AutoFadeMedia video[loop]",
    results: ".s2Results",
    resultCard: ".s2ResultSlot",
    manual: ".s2Manual",
    craft: ".s2Craft",
    faq: "[data-glyde-faq], .faq",
  };

  function findAll(root, selector) {
    const matches = root instanceof Element && root.matches(selector) ? [root] : [];
    if (typeof root.querySelectorAll !== "function") return matches;
    return matches.concat(Array.from(root.querySelectorAll(selector)));
  }

  function ensureId(element, prefix) {
    if (!element.id) {
      generatedId += 1;
      element.id = `${prefix}-${generatedId}`;
    }
    return element.id;
  }

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function wrapIndex(index, count) {
    return count ? ((index % count) + count) % count : 0;
  }

  function track(name, detail = {}) {
    document.dispatchEvent(
      new CustomEvent("glyde:track", { detail: { name, ...detail } }),
    );
  }

  function createController(element, key, setup) {
    let elementControllers = controllerMap.get(element);
    if (!elementControllers) {
      elementControllers = new Map();
      controllerMap.set(element, elementControllers);
    }
    if (elementControllers.has(key)) return elementControllers.get(key);

    const cleanups = [];
    const timeouts = new Set();
    const frames = new Set();
    let destroyed = false;

    const controller = {
      element,
      key,
      get destroyed() {
        return destroyed;
      },
      on(target, type, listener, options) {
        target.addEventListener(type, listener, options);
        cleanups.push(() => target.removeEventListener(type, listener, options));
      },
      timeout(callback, delay) {
        const id = window.setTimeout(() => {
          timeouts.delete(id);
          if (!destroyed) callback();
        }, delay);
        timeouts.add(id);
        return id;
      },
      clearTimeout(id) {
        if (!id) return;
        window.clearTimeout(id);
        timeouts.delete(id);
      },
      frame(callback) {
        const id = window.requestAnimationFrame((time) => {
          frames.delete(id);
          if (!destroyed) callback(time);
        });
        frames.add(id);
        return id;
      },
      cancelFrame(id) {
        if (!id) return;
        window.cancelAnimationFrame(id);
        frames.delete(id);
      },
      cleanup(callback) {
        cleanups.push(callback);
      },
      destroy() {
        if (destroyed) return;
        destroyed = true;
        for (const id of timeouts) window.clearTimeout(id);
        for (const id of frames) window.cancelAnimationFrame(id);
        timeouts.clear();
        frames.clear();
        while (cleanups.length) {
          try {
            cleanups.pop()();
          } catch {
            // A removed Theme Editor section must not strand other controls.
          }
        }
        elementControllers.delete(key);
        controllers.delete(controller);
      },
    };

    elementControllers.set(key, controller);
    controllers.add(controller);

    try {
      setup(controller);
    } catch (error) {
      controller.destroy();
      // Keep a single malformed optional section from breaking the landing page.
      console.error(`[GLYDE] ${key} initialization failed`, error);
    }

    return controller;
  }

  function destroyWithin(root) {
    if (!(root instanceof Node)) return;
    for (const controller of Array.from(controllers)) {
      if (controller.element === root || root.contains(controller.element)) {
        controller.destroy();
      }
    }
  }

  function listenToMediaQuery(controller, media, listener) {
    if (typeof media.addEventListener === "function") {
      controller.on(media, "change", listener);
      return;
    }
    media.addListener(listener);
    controller.cleanup(() => media.removeListener(listener));
  }

  function safePlay(video) {
    try {
      const promise = video.play();
      if (promise && typeof promise.catch === "function") {
        promise.catch(() => undefined);
      }
    } catch {
      // Autoplay refusal and unsupported sources both resolve to the poster.
    }
  }

  function initHeroVideos(root) {
    findAll(root, SELECTORS.heroVideo).forEach((video) => {
      if (!(video instanceof HTMLVideoElement)) return;

      createController(video, "hero-video", (controller) => {
        video.muted = true;
        video.playsInline = true;

        const syncPlayback = () => {
          if (motionPreference.matches || document.visibilityState === "hidden") {
            video.pause();
          } else {
            safePlay(video);
          }
        };

        syncPlayback();
        listenToMediaQuery(controller, motionPreference, syncPlayback);
        controller.on(document, "visibilitychange", syncPlayback);
        controller.on(window, "pageshow", syncPlayback);
        controller.cleanup(() => video.pause());
      });
    });
  }

  function initLoopingVideos(root) {
    findAll(root, SELECTORS.loopingVideo).forEach((video) => {
      if (!(video instanceof HTMLVideoElement) || video.matches(SELECTORS.heroVideo)) return;

      createController(video, "looping-video", (controller) => {
        let visible = false;
        video.muted = true;
        video.playsInline = true;

        const syncPlayback = () => {
          if (
            !visible ||
            motionPreference.matches ||
            document.visibilityState === "hidden"
          ) {
            video.pause();
          } else {
            safePlay(video);
          }
        };

        let observer = null;
        if ("IntersectionObserver" in window) {
          observer = new IntersectionObserver(
            (entries) => {
              visible = entries.some((entry) => entry.isIntersecting);
              syncPlayback();
            },
            { threshold: 0.15 },
          );
          observer.observe(video);
        } else {
          visible = true;
        }

        syncPlayback();
        listenToMediaQuery(controller, motionPreference, syncPlayback);
        controller.on(document, "visibilitychange", syncPlayback);
        controller.on(window, "pageshow", syncPlayback);
        controller.cleanup(() => {
          observer?.disconnect();
          video.pause();
        });
      });
    });
  }

  function initTopNavs(root) {
    findAll(root, SELECTORS.topNav).forEach((nav) => {
      createController(nav, "top-nav", (controller) => {
        const landing = nav.closest(SELECTORS.landing) || document;
        const hero = landing.querySelector?.(".heroV2") || document.querySelector(".heroV2");
        const reserve = nav.querySelector(".topNavReserve");
        const focusable = Array.from(nav.querySelectorAll("a, button"));
        if (!hero) return;

        let visible = false;
        let updateFrame = 0;
        let focusRestoreFrame = 0;

        const renderVisibility = (nextVisible) => {
          visible = nextVisible;
          nav.dataset.visible = String(visible);
          nav.setAttribute("aria-hidden", String(!visible));
          focusable.forEach((element) => {
            element.tabIndex = visible ? 0 : -1;
          });
        };

        const update = () => {
          controller.cancelFrame(updateFrame);
          updateFrame = controller.frame(() => {
            updateFrame = 0;
            const narrowRevealOffset = window.matchMedia("(max-width: 900px)").matches
              ? 64
              : 0;
            renderVisibility(
              window.scrollY >= hero.offsetTop + hero.offsetHeight + narrowRevealOffset - 1,
            );
          });
        };

        const restoreTriggerFocus = (event) => {
          let oldHash = "";
          let newHash = "";
          try {
            oldHash = new URL(event.oldURL).hash;
            newHash = new URL(event.newURL).hash;
          } catch {
            return;
          }
          if (oldHash !== "#hero-email" || newHash === "#hero-email") return;

          controller.cancelFrame(focusRestoreFrame);
          let attempts = 0;
          const focusWhenRestored = () => {
            const email = document.querySelector("#hero-email");
            if (!(email instanceof HTMLInputElement) || !reserve || document.activeElement !== email) {
              return;
            }

            const restoredBelowHero = window.scrollY >= hero.offsetTop + hero.offsetHeight - 1;
            if (visible && restoredBelowHero) {
              reserve.focus({ preventScroll: true });
              return;
            }

            attempts += 1;
            if (attempts < 180) focusRestoreFrame = controller.frame(focusWhenRestored);
          };
          focusRestoreFrame = controller.frame(focusWhenRestored);
        };

        update();
        controller.on(window, "scroll", update, { passive: true });
        controller.on(window, "resize", update, { passive: true });
        controller.on(window, "pageshow", update);
        controller.on(window, "hashchange", restoreTriggerFocus);
        controller.on(document, "shopify:section:reorder", update);
        controller.cleanup(() => {
          controller.cancelFrame(updateFrame);
          controller.cancelFrame(focusRestoreFrame);
        });
      });
    });
  }

  const MOBILE_VIEWPORT_QUERY = "(max-width: 900px)";
  const KEYBOARD_SAFE_GAP = 20;
  const KEYBOARD_MIN_SHRINK = 40;
  const KEYBOARD_RECOVERY_TOLERANCE = 8;
  const KEYBOARD_CLOSE_RECOVERY_RATIO = 0.8;
  const VIEWPORT_STABLE_EPSILON = 1;
  const VIEWPORT_STABLE_FRAMES = 2;
  const KEYBOARD_OPEN_TRACK_MS = 720;
  const KEYBOARD_CLOSE_TRACK_MS = 1600;
  const POINTER_SNAPSHOT_TTL = 1200;
  const USER_SCROLL_SLOP = 12;
  const KEYBOARD_PREDICTION_MIN = 240;
  const KEYBOARD_PREDICTION_MAX = 420;
  const WAITLIST_ENDPOINT = "https://glydeclipper.online/api/subscribe";
  // The .online route has its own 10s Shopify upstream deadline. Waiting two
  // seconds beyond it avoids falling back while that first write is still
  // legitimately in flight.
  const WAITLIST_REQUEST_TIMEOUT_MS = 12000;
  const keyboardInsetMemory = { portrait: 0, landscape: 0 };

  function initWaitlistForms(root) {
    findAll(root, SELECTORS.waitlist).forEach((form) => {
      if (!(form instanceof HTMLFormElement)) return;

      createController(form, "waitlist", (controller) => {
        const input = form.querySelector('input[type="email"], input[name="contact[email]"]');
        if (!(input instanceof HTMLInputElement)) return;

        const mobileViewport = window.matchMedia(MOBILE_VIEWPORT_QUERY);
        const visualViewport = window.visualViewport;
        const submitControls = Array.from(
          form.querySelectorAll('button[type="submit"], input[type="submit"]'),
        );
        let session = null;
        let pointerSnapshot = null;
        let touchStart = null;
        let navigationPending = false;
        let externalPending = false;
        let nativeFallback = false;
        let requestAbortController = null;
        let requestTimeout = 0;
        let submitResetTimer = 0;
        let restingViewportHeight = visualViewport?.height ?? window.innerHeight;
        let restingViewportOffsetTop = visualViewport?.offsetTop ?? 0;
        let syncFrame = 0;
        let keyboardSpacer = null;

        const viewportMetrics = () => ({
          height: window.visualViewport?.height ?? window.innerHeight,
          offsetTop: window.visualViewport?.offsetTop ?? 0,
          pageTop: window.visualViewport?.pageTop ?? window.scrollY,
          scale: window.visualViewport?.scale ?? 1,
          width: window.innerWidth,
        });

        const editableHasFocus = () =>
          document.activeElement instanceof HTMLElement &&
          document.activeElement.matches(
            'input, textarea, select, [contenteditable="true"]',
          );

        const orientationFor = (width, height) =>
          width > height ? "landscape" : "portrait";

        const predictedKeyboardInset = (height, orientation) => {
          const remembered = keyboardInsetMemory[orientation];
          if (remembered > 0) return remembered;
          return Math.min(
            KEYBOARD_PREDICTION_MAX,
            Math.max(KEYBOARD_PREDICTION_MIN, height * 0.42),
          );
        };

        const setSpacerHeight = (height) => {
          if (!keyboardSpacer) {
            keyboardSpacer = document.createElement("div");
            keyboardSpacer.dataset.glydeKeyboardSpacer = "";
            keyboardSpacer.setAttribute("aria-hidden", "true");
            keyboardSpacer.style.width = "1px";
            keyboardSpacer.style.overflowAnchor = "none";
            keyboardSpacer.style.pointerEvents = "none";
            keyboardSpacer.style.visibility = "hidden";
            document.body.append(keyboardSpacer);
          }
          keyboardSpacer.style.height = `${Math.max(0, Math.ceil(height))}px`;
        };

        const removeSpacer = () => {
          keyboardSpacer?.remove();
          keyboardSpacer = null;
        };

        const cancelScheduledWork = () => {
          controller.cancelFrame(syncFrame);
          syncFrame = 0;
        };

        const finishSession = () => {
          const finishedSession = session;
          cancelScheduledWork();
          session = null;
          pointerSnapshot = null;
          touchStart = null;
          form.removeAttribute("data-keyboard-tracking");
          removeSpacer();

          const metrics = viewportMetrics();
          const keyboardIsStillReducingViewport =
            finishedSession?.keyboardSeen &&
            metrics.height <
              finishedSession.baselineViewportHeight - KEYBOARD_RECOVERY_TOLERANCE;

          if (
            metrics.scale <= 1.05 &&
            !editableHasFocus() &&
            !keyboardIsStillReducingViewport
          ) {
            restingViewportHeight = metrics.height;
            restingViewportOffsetTop = metrics.offsetTop;
          }
        };

        const syncPosition = () => {
          syncFrame = 0;
          const currentSession = session;
          if (!currentSession || !mobileViewport.matches) return;

          let metrics = viewportMetrics();
          const now = performance.now();

          if (metrics.width !== currentSession.baselineViewportWidth || navigationPending) {
            finishSession();
            return;
          }

          const focusedElement = document.activeElement;
          const anotherEditableHasFocus =
            focusedElement !== input &&
            focusedElement instanceof HTMLElement &&
            focusedElement.matches(
              'input, textarea, select, [contenteditable="true"]',
            );

          if (anotherEditableHasFocus || metrics.scale > 1.05) {
            finishSession();
            return;
          }

          const previousHeight = currentSession.lastViewportHeight;
          let positionAligned = !currentSession.keyboardSeen;
          const keyboardInset = Math.max(
            0,
            currentSession.baselineViewportHeight - metrics.height,
          );
          currentSession.minViewportHeight = Math.min(
            currentSession.minViewportHeight,
            metrics.height,
          );

          if (keyboardInset >= KEYBOARD_MIN_SHRINK) {
            currentSession.keyboardSeen = true;
            keyboardInsetMemory[currentSession.orientation] = Math.max(
              keyboardInsetMemory[currentSession.orientation],
              keyboardInset,
            );
          }

          const totalKeyboardShrink =
            currentSession.baselineViewportHeight - currentSession.minViewportHeight;
          const recoveredFromMinimum = metrics.height - currentSession.minViewportHeight;
          const keyboardIsAlmostClosed =
            recoveredFromMinimum >=
              Math.max(
                KEYBOARD_MIN_SHRINK,
                totalKeyboardShrink * KEYBOARD_CLOSE_RECOVERY_RATIO,
              ) || keyboardInset <= KEYBOARD_RECOVERY_TOLERANCE;

          if (
            !currentSession.closing &&
            currentSession.keyboardSeen &&
            !currentSession.gestureActive &&
            keyboardIsAlmostClosed &&
            (metrics.height - previousHeight > KEYBOARD_RECOVERY_TOLERANCE ||
              keyboardInset <= KEYBOARD_RECOVERY_TOLERANCE)
          ) {
            currentSession.closing = true;
            currentSession.trackingDeadline = now + KEYBOARD_CLOSE_TRACK_MS;
            currentSession.stableFrames = 0;
          }

          const spacerInset = currentSession.keyboardSeen
            ? currentSession.closing
              ? keyboardInset
              : Math.max(keyboardInset, currentSession.predictedKeyboardInset)
            : currentSession.closing
              ? 0
              : currentSession.predictedKeyboardInset;
          setSpacerHeight(spacerInset + (spacerInset > 0 ? KEYBOARD_SAFE_GAP : 0));
          metrics = viewportMetrics();

          if (currentSession.keyboardSeen && !currentSession.gestureActive) {
            const topNav = document.querySelector('.topNav[data-visible="true"]');
            const safeTop = Math.max(
              KEYBOARD_SAFE_GAP,
              topNav
                ? topNav.getBoundingClientRect().bottom -
                    metrics.offsetTop +
                    KEYBOARD_SAFE_GAP
                : KEYBOARD_SAFE_GAP,
            );
            const safeBottom = Math.max(safeTop, metrics.height - KEYBOARD_SAFE_GAP);
            const maximumVisualTop = Math.max(
              safeTop,
              safeBottom - currentSession.targetHeight,
            );
            const desiredVisualTop = Math.min(
              maximumVisualTop,
              Math.max(safeTop, currentSession.preferredVisualTop),
            );
            const desiredPageTop = currentSession.targetDocumentTop - desiredVisualTop;
            const pageDelta = desiredPageTop - metrics.pageTop;

            currentSession.lastTargetPageTop = desiredPageTop;

            if (Math.abs(pageDelta) >= 0.75) {
              const maximumScrollY = Math.max(
                0,
                Math.max(
                  document.documentElement.scrollHeight,
                  document.body.scrollHeight,
                ) - window.innerHeight,
              );
              const targetScrollY = Math.min(
                maximumScrollY,
                Math.max(0, window.scrollY + pageDelta),
              );

              if (Math.abs(window.scrollY - targetScrollY) >= 0.75) {
                window.scrollTo({ top: targetScrollY, left: 0, behavior: "instant" });
              }
            }

            metrics = viewportMetrics();
            positionAligned = Math.abs(metrics.pageTop - desiredPageTop) <= 1.25;
          }

          const viewportRecovered =
            metrics.height >=
              currentSession.baselineViewportHeight - KEYBOARD_RECOVERY_TOLERANCE &&
            Math.abs(metrics.offsetTop - currentSession.baselineViewportOffsetTop) <=
              KEYBOARD_RECOVERY_TOLERANCE;
          const viewportStable =
            Math.abs(metrics.height - currentSession.lastViewportHeight) <=
              VIEWPORT_STABLE_EPSILON &&
            Math.abs(metrics.offsetTop - currentSession.lastViewportOffsetTop) <=
              VIEWPORT_STABLE_EPSILON &&
            Math.abs(metrics.pageTop - currentSession.lastViewportPageTop) <=
              VIEWPORT_STABLE_EPSILON &&
            positionAligned;

          currentSession.lastViewportHeight = metrics.height;
          currentSession.lastViewportOffsetTop = metrics.offsetTop;
          currentSession.lastViewportPageTop = metrics.pageTop;

          if (currentSession.closing) {
            currentSession.stableFrames =
              viewportRecovered && viewportStable ? currentSession.stableFrames + 1 : 0;

            if (
              !currentSession.keyboardSeen ||
              currentSession.stableFrames >= VIEWPORT_STABLE_FRAMES
            ) {
              finishSession();
              return;
            }

            if (now >= currentSession.trackingDeadline) {
              const maximumScrollY = Math.max(
                0,
                Math.max(
                  document.documentElement.scrollHeight,
                  document.body.scrollHeight,
                ) - window.innerHeight,
              );
              window.scrollTo({
                top: Math.min(
                  maximumScrollY,
                  Math.max(0, currentSession.originPageTop - metrics.offsetTop),
                ),
                left: 0,
                behavior: "instant",
              });
              finishSession();
              return;
            }
          }

          if (
            !currentSession.keyboardSeen &&
            !currentSession.closing &&
            now >= currentSession.trackingDeadline
          ) {
            setSpacerHeight(0);
          }

          if (now < currentSession.trackingDeadline) {
            syncFrame = controller.frame(syncPosition);
          }
        };

        const scheduleSync = () => {
          if (!syncFrame) syncFrame = controller.frame(syncPosition);
        };

        const beginSession = () => {
          cancelScheduledWork();

          const metrics = viewportMetrics();
          const currentRect = form.getBoundingClientRect();
          const snapshot =
            pointerSnapshot &&
            performance.now() - pointerSnapshot.capturedAt <= POINTER_SNAPSHOT_TTL
              ? pointerSnapshot
              : null;
          const baselineViewportHeight = snapshot
            ? Math.max(snapshot.viewportHeight, restingViewportHeight)
            : Math.max(metrics.height, restingViewportHeight);
          const snapshotIsAtRest =
            snapshot &&
            snapshot.viewportHeight >=
              restingViewportHeight - KEYBOARD_RECOVERY_TOLERANCE;
          const baselineViewportOffsetTop = snapshotIsAtRest
            ? snapshot.offsetTop
            : restingViewportOffsetTop;
          const orientation = orientationFor(metrics.width, baselineViewportHeight);
          const currentTargetDocumentTop = window.scrollY + currentRect.top;
          const scrollMarginTop =
            Number.parseFloat(getComputedStyle(input).scrollMarginTop) || 0;
          const anchorOriginScrollY =
            input.id === "hero-email" && window.location.hash === "#hero-email"
              ? window.scrollY + input.getBoundingClientRect().top - scrollMarginTop
              : window.scrollY;
          const originScrollY = snapshot
            ? snapshot.scrollY
            : Math.max(0, anchorOriginScrollY);
          const originPageTop = snapshotIsAtRest
            ? snapshot.pageTop
            : originScrollY + baselineViewportOffsetTop;
          const targetDocumentTop = snapshot?.targetDocumentTop ?? currentTargetDocumentTop;
          const targetHeight = snapshot?.targetHeight ?? currentRect.height;
          const preferredVisualTop = snapshot
            ? snapshot.preferredVisualTop
            : targetDocumentTop - originPageTop;

          session = {
            originScrollY,
            originPageTop,
            baselineViewportHeight,
            baselineViewportOffsetTop,
            baselineViewportWidth: snapshot?.viewportWidth ?? metrics.width,
            targetDocumentTop,
            targetHeight,
            preferredVisualTop,
            minViewportHeight: metrics.height,
            predictedKeyboardInset: predictedKeyboardInset(
              baselineViewportHeight,
              orientation,
            ),
            orientation,
            keyboardSeen: false,
            closing: false,
            trackingDeadline: performance.now() + KEYBOARD_OPEN_TRACK_MS,
            stableFrames: 0,
            lastViewportHeight: metrics.height,
            lastViewportOffsetTop: metrics.offsetTop,
            lastViewportPageTop: metrics.pageTop,
            lastTargetPageTop: originPageTop,
            gestureActive: false,
            gestureMoved: false,
          };
          pointerSnapshot = null;
          form.dataset.keyboardTracking = "true";
          setSpacerHeight(session.predictedKeyboardInset + KEYBOARD_SAFE_GAP);
          scheduleSync();
        };

        const beginClosing = () => {
          if (!session || session.closing) return;
          session.closing = true;
          session.trackingDeadline = performance.now() + KEYBOARD_CLOSE_TRACK_MS;
          session.stableFrames = 0;
          scheduleSync();
        };

        const handlePointerDown = () => {
          if (!mobileViewport.matches || (session && !session.closing)) return;

          const metrics = viewportMetrics();
          const rect = form.getBoundingClientRect();
          pointerSnapshot = {
            scrollY: session?.closing ? session.originScrollY : window.scrollY,
            pageTop: session?.closing ? session.originPageTop : metrics.pageTop,
            offsetTop: session?.closing
              ? session.baselineViewportOffsetTop
              : metrics.offsetTop,
            viewportHeight: session?.closing
              ? Math.max(metrics.height, session.baselineViewportHeight)
              : metrics.height,
            viewportWidth: metrics.width,
            targetDocumentTop: session?.closing
              ? session.targetDocumentTop
              : window.scrollY + rect.top,
            targetHeight: rect.height,
            preferredVisualTop: session?.closing
              ? session.preferredVisualTop
              : rect.top - metrics.offsetTop,
            capturedAt: performance.now(),
          };

          if (document.activeElement === input) beginSession();
        };

        const handleFocus = () => {
          if (!mobileViewport.matches) return;
          if (!session || session.closing) beginSession();
        };

        const handleViewportChange = () => {
          if (!session) {
            const metrics = viewportMetrics();
            if (metrics.scale <= 1.05 && !editableHasFocus()) {
              restingViewportHeight = metrics.height;
              restingViewportOffsetTop = metrics.offsetTop;
            }
            return;
          }

          if (window.innerWidth !== session.baselineViewportWidth) {
            finishSession();
            return;
          }
          scheduleSync();
        };

        const handleTouchStart = (event) => {
          if (!session || event.touches.length !== 1) return;
          touchStart = {
            x: event.touches[0].clientX,
            y: event.touches[0].clientY,
          };
          session.gestureActive = true;
          session.gestureMoved = false;
        };

        const handleTouchMove = (event) => {
          if (!session || !touchStart || event.touches.length !== 1) return;
          const deltaX = Math.abs(event.touches[0].clientX - touchStart.x);
          const deltaY = Math.abs(event.touches[0].clientY - touchStart.y);
          if (deltaY > USER_SCROLL_SLOP && deltaY >= deltaX) {
            session.gestureMoved = true;
          }
        };

        const handleTouchEnd = () => {
          const currentSession = session;
          touchStart = null;
          if (!currentSession) return;

          currentSession.gestureActive = false;
          if (currentSession.gestureMoved) {
            const metrics = viewportMetrics();
            const manualPageDelta = metrics.pageTop - currentSession.lastTargetPageTop;
            currentSession.originScrollY = Math.max(
              0,
              currentSession.originScrollY + manualPageDelta,
            );
            currentSession.originPageTop = Math.max(
              0,
              currentSession.originPageTop + manualPageDelta,
            );
            currentSession.preferredVisualTop =
              currentSession.targetDocumentTop - currentSession.originPageTop;
            currentSession.lastTargetPageTop = metrics.pageTop;
          }
          currentSession.gestureMoved = false;
          scheduleSync();
        };

        const handlePageShow = () => {
          requestAbortController?.abort();
          requestAbortController = null;
          controller.clearTimeout(requestTimeout);
          requestTimeout = 0;
          controller.clearTimeout(submitResetTimer);
          submitResetTimer = 0;
          navigationPending = false;
          externalPending = false;
          nativeFallback = false;
          form.removeAttribute("data-submitting");
          form.removeAttribute("data-submit-channel");
          form.removeAttribute("aria-busy");
          submitControls.forEach((control) => {
            control.disabled = false;
          });
        };

        const handlePageHide = () => {
          externalPending = false;
          requestAbortController?.abort();
          requestAbortController = null;
          controller.clearTimeout(requestTimeout);
          requestTimeout = 0;
          finishSession();
        };

        const returnDestination = () => {
          const hiddenReturnTo = form.querySelector('input[name="return_to"]');
          const configured =
            form.dataset.glydeReturnTo || hiddenReturnTo?.value || "/pages/deposit";
          try {
            const destination = new URL(configured, window.location.origin);
            if (destination.protocol === "http:" || destination.protocol === "https:") {
              return destination.href;
            }
          } catch {
            // A malformed theme setting must never prevent the native fallback.
          }
          return new URL("/pages/deposit", window.location.origin).href;
        };

        const armNavigationTimeout = () => {
          controller.clearTimeout(submitResetTimer);
          submitResetTimer = controller.timeout(handlePageShow, 15000);
        };

        const submitNatively = (submitter, failureStatus) => {
          if (controller.destroyed) return;
          externalPending = false;
          nativeFallback = true;
          form.dataset.submitChannel = "shopify-fallback";
          form.removeAttribute("data-submitting");
          form.removeAttribute("aria-busy");
          submitControls.forEach((control) => {
            control.disabled = false;
          });
          track("waitlist_external_fallback", {
            label: form.dataset.glydeSource || form.dataset.source || "waitlist",
            value: failureStatus,
            props: { channel: "shopify_customer_form" },
          });

          // requestSubmit starts a fresh, valid native submit event. The
          // nativeFallback latch lets that event pass through untouched, so
          // Shopify captcha/customer handlers retain their normal lifecycle.
          if (typeof form.requestSubmit === "function") {
            const usableSubmitter =
              (submitter instanceof HTMLButtonElement ||
                submitter instanceof HTMLInputElement) &&
              submitter.isConnected
                ? submitter
                : undefined;
            form.requestSubmit(usableSubmitter);
          } else {
            HTMLFormElement.prototype.submit.call(form);
          }
        };

        const handleSubmit = async (event) => {
          const source = form.dataset.glydeSource || form.dataset.source || "waitlist";

          if (nativeFallback) {
            navigationPending = true;
            form.dataset.submitting = "true";
            form.dataset.submitChannel = "shopify-fallback";
            form.setAttribute("aria-busy", "true");
            finishSession();
            armNavigationTimeout();
            // Deliberately do not preventDefault. This is the resilient
            // Shopify customer-form path and must keep its original action,
            // hidden fields, captcha integration, and return_to value.
            return;
          }

          event.preventDefault();
          if (externalPending) return;

          externalPending = true;
          form.dataset.submitting = "true";
          form.dataset.submitChannel = "online-api";
          form.setAttribute("aria-busy", "true");
          submitControls.forEach((control) => {
            control.disabled = true;
          });
          track("waitlist_submit", {
            label: source,
            props: { channel: "online-api" },
          });

          const website = form.querySelector('input[name="website"]');
          const activeRequest = new AbortController();
          requestAbortController = activeRequest;
          requestTimeout = controller.timeout(
            () => requestAbortController?.abort(),
            WAITLIST_REQUEST_TIMEOUT_MS,
          );

          let failureStatus = 0;
          try {
            const response = await fetch(WAITLIST_ENDPOINT, {
              method: "POST",
              mode: "cors",
              credentials: "omit",
              cache: "no-store",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email: input.value,
                source,
                website: website instanceof HTMLInputElement ? website.value : "",
              }),
              signal: activeRequest.signal,
            });
            failureStatus = response.status;
            const result = await response.json().catch(() => null);

            if (
              controller.destroyed ||
              requestAbortController !== activeRequest ||
              !externalPending
            ) {
              return;
            }

            if (
              response.ok &&
              result?.ok &&
              (result.shopifyStatus === "success" ||
                result.shopifyStatus === "suppressed")
            ) {
              controller.clearTimeout(requestTimeout);
              requestTimeout = 0;
              requestAbortController = null;
              externalPending = false;
              navigationPending = true;
              track("waitlist_success", {
                label: source,
                props: {
                  channel: "online-api",
                  shopify_status: result.shopifyStatus,
                },
              });
              finishSession();
              window.location.assign(returnDestination());
              return;
            }
          } catch {
            failureStatus = 0;
          }

          if (
            controller.destroyed ||
            requestAbortController !== activeRequest ||
            !externalPending
          ) {
            return;
          }

          controller.clearTimeout(requestTimeout);
          requestTimeout = 0;
          requestAbortController = null;
          submitNatively(event.submitter, failureStatus);
        };

        controller.on(input, "pointerdown", handlePointerDown, { passive: true });
        controller.on(input, "focus", handleFocus);
        controller.on(input, "blur", beginClosing);
        if (visualViewport) {
          controller.on(visualViewport, "resize", handleViewportChange);
          controller.on(visualViewport, "scroll", handleViewportChange);
        }
        controller.on(window, "resize", handleViewportChange, { passive: true });
        controller.on(window, "scroll", handleViewportChange, { passive: true });
        controller.on(window, "touchstart", handleTouchStart, { passive: true });
        controller.on(window, "touchmove", handleTouchMove, { passive: true });
        controller.on(window, "touchend", handleTouchEnd, { passive: true });
        controller.on(window, "touchcancel", handleTouchEnd, { passive: true });
        controller.on(window, "orientationchange", finishSession);
        controller.on(window, "pagehide", handlePageHide);
        controller.on(window, "pageshow", handlePageShow);
        controller.on(form, "submit", handleSubmit);
        controller.cleanup(() => {
          requestAbortController?.abort();
          requestAbortController = null;
          controller.clearTimeout(requestTimeout);
          controller.clearTimeout(submitResetTimer);
          finishSession();
        });
      });
    });
  }

  const RESULT_VIDEOS = {
    1: {
      id: "PKtwA1m1qLM",
      title: "GLYDE Auto-Fade Haircut | Before & After",
    },
    2: {
      id: "XFo8fvejvvU",
      title: "1M YouTuber CyrusJanssen tried GLYDE at our office",
    },
    3: {
      id: "HCN69rdEesY",
      title: "See What GLYDE Can Do on a First Try",
    },
    4: {
      id: "QYMGFUHt1Zg",
      title: "GLYDE's first seed user cuts his own hair at home",
    },
    5: {
      id: "YoZhPBRnH9Q",
      title: "A Great Fade Made Simple | GLYDE Before & After",
    },
  };

  const RESULT_STEP_MS = 420;
  const RESULT_WRAP_MS = 120;
  const RESULT_DRAG_LOCK = 8;
  const RESULT_AXIS_DOMINANCE = 1.2;
  const RESULT_DRAG_RESISTANCE = 0.82;
  const RESULT_VELOCITY_THRESHOLD = 0.45;
  const RESULT_MIN_FLICK = 24;
  const RESULT_CLICK_SUPPRESSION_MS = 450;
  const RESULT_WHEEL_THRESHOLD = 18;
  const RESULT_WHEEL_END_MS = 180;

  function shortestDistance(from, to, count) {
    const forward = wrapIndex(to - from, count);
    return forward > count / 2 ? forward - count : forward;
  }

  function resultSlotFor(itemIndex, centerIndex, count) {
    return shortestDistance(centerIndex, itemIndex, count);
  }

  function initResults(root) {
    findAll(root, SELECTORS.results).forEach((section) => {
      createController(section, "results", (controller) => {
        const viewport = section.querySelector(".s2ResultsViewport");
        const trackNode = section.querySelector(".s2ResultsTrack, .s2ResultsRing");
        const cards = Array.from(section.querySelectorAll(SELECTORS.resultCard));
        const countNode = section.querySelector(".s2Count");
        if (!viewport || !trackNode || cards.length < 2) return;

        const metadata = cards.map((card, index) => {
          const fallbackNumber = index + 1;
          const parsedNumber = Number.parseInt(card.dataset.videoNumber || "", 10);
          const number = Number.isFinite(parsedNumber) ? parsedNumber : fallbackNumber;
          const known = RESULT_VIDEOS[number] || {};
          return {
            number,
            id: card.dataset.videoId || known.id || `result-${number}`,
            title:
              card.dataset.videoTitle ||
              known.title ||
              card.getAttribute("aria-label") ||
              `GLYDE result ${number}`,
          };
        });

        const originalFacades = new Map();
        cards.forEach((card) => {
          const facade = card.querySelector(".s2ResultFacade");
          if (facade) originalFacades.set(card, facade);
        });

        let centerIndex = Math.max(
          0,
          cards.findIndex((card) => card.dataset.center === "true"),
        );
        if (!cards[centerIndex]) centerIndex = Math.min(2, cards.length - 1);
        if (!cards.some((card) => card.dataset.center === "true")) {
          centerIndex = Math.min(2, cards.length - 1);
        }

        let destinationIndex = centerIndex;
        let playingId = null;
        let motion = null;
        let moving = false;
        let queuedMove = null;
        let motionToken = 0;
        let pointerDrag = null;
        let suppressClickUntil = 0;
        let wheelGestureActive = false;
        let wheelGestureTimer = 0;

        trackNode.style.setProperty("--result-step-duration", `${RESULT_STEP_MS}ms`);
        trackNode.style.setProperty("--result-wrap-duration", `${RESULT_WRAP_MS}ms`);

        viewport.setAttribute("role", viewport.getAttribute("role") || "region");
        viewport.setAttribute("aria-roledescription", "carousel");
        viewport.setAttribute(
          "aria-label",
          viewport.getAttribute("aria-label") || "GLYDE haircut result videos",
        );
        if (!viewport.hasAttribute("tabindex")) viewport.tabIndex = 0;

        const renderCount = () => {
          if (!countNode) return;
          const bold = document.createElement("b");
          bold.textContent = String(metadata[centerIndex].number).padStart(2, "0");
          countNode.replaceChildren(
            bold,
            document.createTextNode(` / ${String(cards.length).padStart(2, "0")}`),
          );
          countNode.setAttribute("aria-live", "polite");
          countNode.setAttribute("aria-atomic", "true");
        };

        const render = () => {
          section.dataset.carouselAnimating = String(moving);
          section.dataset.carouselDirection = motion
            ? motion.direction === 1
              ? "next"
              : "previous"
            : "none";
          section.dataset.reducedMotion = String(motionPreference.matches);
          viewport.setAttribute("aria-busy", String(moving));
          trackNode.dataset.motionPhase = motion?.phase || "idle";
          trackNode.dataset.motionToken = String(motion?.token || 0);

          cards.forEach((card, itemIndex) => {
            const slot = resultSlotFor(itemIndex, centerIndex, cards.length);
            const isCenter = slot === 0;
            const isPlaying = isCenter && playingId === metadata[itemIndex].id;
            const isWrapping = motion?.wrappingId === metadata[itemIndex].id;
            const fromSlot = motion
              ? resultSlotFor(itemIndex, motion.fromCenter, cards.length)
              : slot;
            const toSlot = motion
              ? resultSlotFor(itemIndex, motion.toCenter, cards.length)
              : slot;
            const wrapDirection = isWrapping
              ? motion.direction === 1
                ? "start-to-end"
                : "end-to-start"
              : "none";

            card.classList.toggle("s2ResultCard--center", isCenter);
            card.classList.toggle("s2ResultCard--playing", isPlaying);
            card.classList.toggle("s2ResultCard--wrapping", Boolean(isWrapping));
            card.dataset.center = String(isCenter);
            card.dataset.fromSlot = String(fromSlot);
            card.dataset.motionPhase = motion?.phase || "idle";
            card.dataset.playing = String(isPlaying);
            card.dataset.slot = String(slot);
            card.dataset.toSlot = String(toSlot);
            card.dataset.wrap = wrapDirection;
            card.dataset.videoId = metadata[itemIndex].id;
            card.dataset.videoNumber = String(metadata[itemIndex].number);
            card.style.setProperty("--result-from-slot", String(fromSlot));
            card.style.setProperty("--result-slot", String(slot));
            card.style.setProperty("--result-to-slot", String(toSlot));
            card.setAttribute(
              "aria-label",
              `Result ${metadata[itemIndex].number} of ${cards.length}: ${metadata[itemIndex].title}`,
            );
            if (isCenter) card.setAttribute("aria-current", "true");
            else card.removeAttribute("aria-current");

            const facade = originalFacades.get(card);
            if (facade) {
              facade.setAttribute(
                "aria-label",
                isCenter
                  ? `Play: ${metadata[itemIndex].title}`
                  : `Move to centre and play: ${metadata[itemIndex].title}`,
              );
            }
          });

          renderCount();
        };

        const stopPlayback = () => {
          playingId = null;
          cards.forEach((card) => {
            const player = card.querySelector(".s2ResultPlayer");
            const facade = originalFacades.get(card);
            if (player && facade) player.replaceWith(facade);
            else player?.remove();
          });
        };

        const startPlayback = (index, trigger) => {
          const card = cards[index];
          const video = metadata[index];
          if (!card || centerIndex !== index) return;

          stopPlayback();
          const facade = originalFacades.get(card);
          if (!facade) return;

          const player = document.createElement("iframe");
          player.className = "s2ResultPlayer";
          player.src = `https://www.youtube.com/embed/${encodeURIComponent(video.id)}?autoplay=1&playsinline=1&rel=0&modestbranding=1`;
          player.title = video.title;
          player.allow =
            "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
          player.referrerPolicy = "strict-origin-when-cross-origin";
          player.allowFullscreen = true;
          playingId = video.id;
          facade.replaceWith(player);
          render();

          track("video_play", {
            label: video.title,
            props: { id: video.id, provider: "youtube", trigger },
          });
        };

        const delay = (milliseconds) =>
          new Promise((resolve) => controller.timeout(resolve, milliseconds));
        const nextFrame = () =>
          new Promise((resolve) => controller.frame(() => resolve()));

        const animateStep = async (direction) => {
          const fromCenter = centerIndex;
          const toCenter = wrapIndex(fromCenter + direction, cards.length);
          const outgoingSlot = direction === 1 ? -2 : 2;
          const wrappingIndex = cards.findIndex(
            (_, itemIndex) =>
              resultSlotFor(itemIndex, fromCenter, cards.length) === outgoingSlot,
          );
          const token = motionToken + 1;
          motionToken = token;
          const baseMotion = {
            direction,
            fromCenter,
            toCenter,
            token,
            wrappingId: metadata[wrappingIndex]?.id,
          };

          motion = { ...baseMotion, phase: "exit" };
          render();
          await delay(RESULT_WRAP_MS);
          if (controller.destroyed || motionToken !== token) return false;

          centerIndex = toCenter;
          motion = { ...baseMotion, phase: "relocate" };
          render();
          await nextFrame();
          if (controller.destroyed || motionToken !== token) return false;

          motion = { ...baseMotion, phase: "enter" };
          render();
          await delay(RESULT_STEP_MS);
          if (controller.destroyed || motionToken !== token) return false;

          motion = null;
          render();
          return true;
        };

        const drainMoveQueue = async () => {
          if (moving || controller.destroyed) return;
          moving = true;
          render();

          try {
            while (!controller.destroyed && queuedMove) {
              const request = queuedMove;
              queuedMove = null;

              if (motionPreference.matches) {
                centerIndex = request.targetIndex;
                motion = null;
                render();
              } else {
                while (
                  !controller.destroyed &&
                  centerIndex !== request.targetIndex &&
                  !queuedMove
                ) {
                  const distance = shortestDistance(
                    centerIndex,
                    request.targetIndex,
                    cards.length,
                  );
                  const completed = await animateStep(distance > 0 ? 1 : -1);
                  if (!completed) break;
                }
              }

              if (
                !queuedMove &&
                centerIndex === request.targetIndex &&
                request.playAfterMove
              ) {
                startPlayback(request.targetIndex, "moved-card");
              }
            }
          } finally {
            moving = false;
            if (!controller.destroyed) {
              motion = null;
              render();
              if (queuedMove) void drainMoveQueue();
            }
          }
        };

        const requestMove = (targetIndex, playAfterMove) => {
          const normalizedTarget = wrapIndex(targetIndex, cards.length);
          destinationIndex = normalizedTarget;

          if (!moving && centerIndex === normalizedTarget) {
            if (playAfterMove) startPlayback(normalizedTarget, "center-card");
            return;
          }

          stopPlayback();
          queuedMove = { playAfterMove, targetIndex: normalizedTarget };
          render();
          void drainMoveQueue();
        };

        const moveRelative = (direction, trigger) => {
          const fromIndex = destinationIndex;
          const targetIndex = wrapIndex(fromIndex + direction, cards.length);
          track("carousel_navigate", {
            label: "See The Results",
            value: metadata[targetIndex].number,
            props: {
              direction: direction === 1 ? "next" : "previous",
              from: metadata[fromIndex].number,
              method: trigger,
              to: metadata[targetIndex].number,
            },
          });
          requestMove(targetIndex, false);
        };

        const resetPointerDrag = (
          suppressClick,
          eventTime,
          continueIntoStep = false,
        ) => {
          const gesture = pointerDrag;
          pointerDrag = null;
          viewport.scrollLeft = 0;
          if (gesture) {
            try {
              if (viewport.hasPointerCapture(gesture.pointerId)) {
                viewport.releasePointerCapture(gesture.pointerId);
              }
            } catch {
              // Capture may already have been released by browser navigation.
            }
          }
          viewport.removeAttribute("data-dragging");
          if (continueIntoStep) viewport.dataset.dragCommitted = "true";
          else viewport.removeAttribute("data-drag-committed");
          trackNode.style.setProperty("--result-drag-offset", "0px");
          if (suppressClick) {
            suppressClickUntil = eventTime + RESULT_CLICK_SUPPRESSION_MS;
          }
        };

        const handlePointerDown = (event) => {
          if (!event.isPrimary || event.button !== 0) return;
          if (
            event.pointerType !== "mouse" &&
            !(event.target instanceof Element && event.target.closest(SELECTORS.resultCard))
          ) {
            return;
          }
          viewport.scrollLeft = 0;
          viewport.removeAttribute("data-drag-committed");

          const bounds = viewport.getBoundingClientRect();
          if (
            event.pointerType !== "mouse" &&
            (event.clientX - bounds.left < 20 || bounds.right - event.clientX < 20)
          ) {
            return;
          }

          pointerDrag = {
            axis: "pending",
            lastTime: event.timeStamp,
            lastX: event.clientX,
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            velocityX: 0,
          };
        };

        const handlePointerMove = (event) => {
          const gesture = pointerDrag;
          if (!gesture || event.pointerId !== gesture.pointerId) return;

          const deltaX = event.clientX - gesture.startX;
          const deltaY = event.clientY - gesture.startY;
          const absoluteX = Math.abs(deltaX);
          const absoluteY = Math.abs(deltaY);

          if (gesture.axis === "pending") {
            if (Math.max(absoluteX, absoluteY) < RESULT_DRAG_LOCK) return;
            if (absoluteY > absoluteX * RESULT_AXIS_DOMINANCE) {
              pointerDrag = null;
              return;
            }
            if (absoluteX <= absoluteY * RESULT_AXIS_DOMINANCE) return;

            gesture.axis = "horizontal";
            if (event.pointerType === "mouse") {
              viewport.setPointerCapture(event.pointerId);
            }
            viewport.dataset.dragging = "true";
          }

          if (event.cancelable) event.preventDefault();
          const elapsed = Math.max(1, event.timeStamp - gesture.lastTime);
          gesture.velocityX = (event.clientX - gesture.lastX) / elapsed;
          gesture.lastX = event.clientX;
          gesture.lastTime = event.timeStamp;

          const maximumOffset = Math.min(420, viewport.clientWidth * 0.28);
          const resistedOffset = clamp(
            deltaX * RESULT_DRAG_RESISTANCE,
            -maximumOffset,
            maximumOffset,
          );
          trackNode.style.setProperty("--result-drag-offset", `${resistedOffset}px`);
        };

        const handlePointerUp = (event) => {
          const gesture = pointerDrag;
          if (!gesture || event.pointerId !== gesture.pointerId) return;

          const deltaX = event.clientX - gesture.startX;
          const absoluteX = Math.abs(deltaX);
          const threshold = Math.min(96, Math.max(42, viewport.clientWidth * 0.08));
          const wasHorizontal = gesture.axis === "horizontal";
          const shouldMove =
            wasHorizontal &&
            (absoluteX >= threshold ||
              (absoluteX >= RESULT_MIN_FLICK &&
                Math.abs(gesture.velocityX) > RESULT_VELOCITY_THRESHOLD));

          resetPointerDrag(
            wasHorizontal,
            event.timeStamp,
            shouldMove && !moving,
          );
          if (shouldMove) moveRelative(deltaX < 0 ? 1 : -1, "swipe");
        };

        const handlePointerCancel = (event) => {
          const gesture = pointerDrag;
          if (!gesture || event.pointerId !== gesture.pointerId) return;
          resetPointerDrag(gesture.axis === "horizontal", event.timeStamp);
        };

        const handleClick = (event) => {
          if (event.timeStamp <= suppressClickUntil) {
            suppressClickUntil = 0;
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          if (!(event.target instanceof Element)) return;
          const facade = event.target.closest(".s2ResultFacade");
          const card = facade?.closest(SELECTORS.resultCard);
          if (!facade || !card || !section.contains(card)) return;
          event.preventDefault();
          const index = cards.indexOf(card);
          if (index >= 0) requestMove(index, true);
        };

        const handleKeyDown = (event) => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
          event.preventDefault();
          moveRelative(event.key === "ArrowRight" ? 1 : -1, "keyboard");
        };

        const handleWheel = (event) => {
          const absoluteX = Math.abs(event.deltaX);
          const absoluteY = Math.abs(event.deltaY);
          if (absoluteX <= absoluteY || absoluteX < RESULT_WHEEL_THRESHOLD) return;

          event.preventDefault();
          controller.clearTimeout(wheelGestureTimer);
          wheelGestureTimer = controller.timeout(() => {
            wheelGestureActive = false;
            wheelGestureTimer = 0;
          }, RESULT_WHEEL_END_MS);
          if (wheelGestureActive) return;

          wheelGestureActive = true;
          moveRelative(event.deltaX > 0 ? 1 : -1, "trackpad");
        };

        const handleTransitionEnd = (event) => {
          if (event.target !== trackNode || event.propertyName !== "transform") return;
          viewport.removeAttribute("data-drag-committed");
          viewport.scrollLeft = 0;
        };

        const handleSelect = (event) => {
          const index = Number(event.detail?.index);
          if (!Number.isFinite(index) || !cards[index]) return;
          requestMove(index, false);
          if (event.detail?.focus) viewport.focus({ preventScroll: true });
        };

        const syncMotionPreference = () => {
          section.dataset.reducedMotion = String(motionPreference.matches);
        };

        controller.on(viewport, "pointerdown", handlePointerDown);
        controller.on(viewport, "pointermove", handlePointerMove, { passive: false });
        controller.on(viewport, "pointerup", handlePointerUp);
        controller.on(viewport, "pointercancel", handlePointerCancel);
        controller.on(viewport, "lostpointercapture", handlePointerCancel);
        controller.on(viewport, "click", handleClick, true);
        controller.on(viewport, "keydown", handleKeyDown);
        controller.on(viewport, "wheel", handleWheel, { passive: false });
        controller.on(trackNode, "transitionend", handleTransitionEnd);
        controller.on(section, "glyde:select", handleSelect);
        listenToMediaQuery(controller, motionPreference, syncMotionPreference);
        controller.cleanup(() => {
          motionToken += 1;
          queuedMove = null;
          stopPlayback();
          trackNode.style.removeProperty("--result-drag-offset");
          viewport.removeAttribute("data-dragging");
          viewport.removeAttribute("data-drag-committed");
        });

        render();
      });
    });
  }

  const MANUAL_DEFAULT_INDEX = 3;
  const MANUAL_WHEEL_PIXEL_NOTCH = 100;
  const MANUAL_WHEEL_LINE_NOTCH = 3;
  const MANUAL_WHEEL_IDLE_MS = 180;
  const MANUAL_WHEEL_STEP_MS = 90;
  const MANUAL_DISSOLVE_MS = 360;
  const MANUAL_POINTER_LOCK = 6;
  const MANUAL_TICK_OFFSETS = [25, 100, 200, 300, 400, 500, 575];
  const MANUAL_RULER_TOP = 6;
  const MANUAL_WHEEL_HEIGHT = 591;
  const MANUAL_UPPER_GEOMETRY = [
    { offset: 0, scale: 1, opacity: 1 },
    { offset: 126.5, scale: 0.75, opacity: 0.6 },
    { offset: 220, scale: 0.55, opacity: 0.3 },
    { offset: 281.5, scale: 0.3, opacity: 0.3 },
  ];
  const MANUAL_LOWER_GEOMETRY = [
    { offset: 0, scale: 1, opacity: 1 },
    { offset: 125.5, scale: 0.75, opacity: 0.6 },
    { offset: 219, scale: 0.55, opacity: 0.3 },
    { offset: 280.5, scale: 0.3, opacity: 0.3 },
  ];

  function manualPlacement(distance) {
    const absoluteDistance = Math.abs(distance);
    const geometry = distance < 0 ? MANUAL_UPPER_GEOMETRY : MANUAL_LOWER_GEOMETRY;
    if (absoluteDistance >= geometry.length - 1) {
      const overflow = absoluteDistance - (geometry.length - 1);
      return {
        offset: geometry[3].offset + overflow * 48,
        scale: Math.max(0.16, geometry[3].scale - overflow * 0.08),
        opacity: Math.max(0, geometry[3].opacity - overflow * 0.3),
      };
    }

    const lower = Math.floor(absoluteDistance);
    const upper = Math.ceil(absoluteDistance);
    const progress = absoluteDistance - lower;
    const interpolate = (from, to) => from + (to - from) * progress;
    return {
      offset: interpolate(geometry[lower].offset, geometry[upper].offset),
      scale: interpolate(geometry[lower].scale, geometry[upper].scale),
      opacity: interpolate(geometry[lower].opacity, geometry[upper].opacity),
    };
  }

  function manualCursorTop(position, maximumIndex) {
    const clamped = clamp(position, 0, maximumIndex);
    const lowerIndex = Math.floor(clamped);
    const upperIndex = Math.ceil(clamped);
    const progress = clamped - lowerIndex;
    const lowerOffset = MANUAL_TICK_OFFSETS[lowerIndex] ?? MANUAL_TICK_OFFSETS[0];
    const upperOffset = MANUAL_TICK_OFFSETS[upperIndex] ?? lowerOffset;
    const offset = lowerOffset + (upperOffset - lowerOffset) * progress;
    return ((MANUAL_RULER_TOP + offset) / MANUAL_WHEEL_HEIGHT) * 100;
  }

  function manualWheelNotches(event) {
    if (event.deltaMode === 1) return event.deltaY / MANUAL_WHEEL_LINE_NOTCH;
    if (event.deltaMode === 2) return event.deltaY;
    return event.deltaY / MANUAL_WHEEL_PIXEL_NOTCH;
  }

  function manualDragStep(wheelHeight) {
    return Math.max(32, wheelHeight * (126 / MANUAL_WHEEL_HEIGHT));
  }

  function easeOutQuart(progress) {
    return 1 - (1 - progress) ** 4;
  }

  function initManualModes(root) {
    findAll(root, SELECTORS.manual).forEach((section) => {
      createController(section, "manual-mode", (controller) => {
        const grid = section.querySelector(".s2ManualGrid");
        const device = section.querySelector(".s2ManualDevice");
        const wheel = section.querySelector(".s2Wheel");
        const cursor = section.querySelector(".s2WheelCursor");
        const status = section.querySelector("#manual-picker-status, [data-manual-status]");
        const options = Array.from(section.querySelectorAll(".s2WheelOption"));
        const frames = Array.from(section.querySelectorAll(".s2ManualFrame"));
        if (!grid || !device || !wheel || !cursor || options.length === 0) return;

        const maximumIndex = options.length - 1;
        const values = options.map((option, index) =>
          (option.dataset.value || option.textContent || String(index)).trim(),
        );
        const initialIndex = clamp(
          Number.parseInt(section.dataset.index || String(MANUAL_DEFAULT_INDEX), 10) || 0,
          0,
          maximumIndex,
        );

        let position = initialIndex;
        let visualPosition = initialIndex;
        let visualTarget = initialIndex;
        let pendingVisualPosition = initialIndex;
        let visualAnimationFrame = 0;
        let overflowScroll = 0;
        let overflowScrollFrame = 0;
        let drag = null;
        let wheelAccumulator = 0;
        let wheelAccumulatorDirection = 0;
        let wheelLastInputAt = 0;
        let wheelLastStepAt = -Infinity;
        let wheelDrainTimer = 0;
        const readyFrames = frames.map(() => false);
        const decodingFrames = frames.map(() => false);

        wheel.setAttribute("role", "listbox");
        wheel.setAttribute("aria-orientation", "vertical");
        wheel.setAttribute(
          "aria-label",
          wheel.getAttribute("aria-label") || "Manual blade length setting",
        );
        wheel.setAttribute(
          "aria-keyshortcuts",
          "ArrowLeft ArrowRight ArrowUp ArrowDown PageUp PageDown Home End",
        );
        if (!wheel.hasAttribute("tabindex")) wheel.tabIndex = 0;
        wheel.style.touchAction = "pan-x pinch-zoom";

        options.forEach((option, index) => {
          option.dataset.index = String(index);
          option.dataset.value = values[index];
          option.setAttribute("role", "option");
          option.setAttribute("aria-label", `Setting ${values[index]} millimeters`);
          ensureId(option, `manual-blade-${values[index]}`);
        });

        const cancelVisualAnimation = () => {
          controller.cancelFrame(visualAnimationFrame);
          visualAnimationFrame = 0;
        };

        const renderFrames = () => {
          const frameBase = Math.floor(visualPosition);
          const frameFraction = visualPosition - frameBase;
          const selectedIndex = Math.round(position);

          frames.forEach((image, index) => {
            const opacity =
              index === frameBase ? 1 : index === frameBase + 1 ? frameFraction : 0;
            image.style.opacity = String(opacity);
            image.style.transition = "none";
            image.dataset.active = String(index === selectedIndex);
            image.setAttribute("aria-hidden", String(index !== selectedIndex));
            image.alt =
              index === selectedIndex
                ? `GLYDE Manual Mode setting ${values[selectedIndex]}`
                : "";
          });
        };

        const commitVisualPosition = (nextPosition) => {
          visualPosition = nextPosition;
          renderFrames();
        };

        const queueVisualPosition = (nextPosition) => {
          const target = clamp(nextPosition, 0, maximumIndex);
          pendingVisualPosition = target;

          const firstRequiredFrame = Math.floor(Math.min(visualPosition, target));
          const lastRequiredFrame = Math.ceil(Math.max(visualPosition, target));
          for (
            let index = firstRequiredFrame;
            index <= lastRequiredFrame;
            index += 1
          ) {
            if (frames[index] && !readyFrames[index]) return;
          }

          const changeImmediately = motionPreference.matches || drag?.moved === true;
          if (changeImmediately || Math.abs(target - visualPosition) < 0.0001) {
            cancelVisualAnimation();
            visualTarget = target;
            commitVisualPosition(target);
            return;
          }

          if (visualAnimationFrame && visualTarget === target) return;
          cancelVisualAnimation();
          visualTarget = target;
          const animationStart = performance.now();
          const animationFrom = visualPosition;

          const animate = (now) => {
            const progress = Math.min(1, (now - animationStart) / MANUAL_DISSOLVE_MS);
            const next =
              animationFrom + (target - animationFrom) * easeOutQuart(progress);
            commitVisualPosition(progress === 1 ? target : next);
            if (progress < 1) {
              visualAnimationFrame = controller.frame(animate);
            } else {
              visualAnimationFrame = 0;
            }
          };
          visualAnimationFrame = controller.frame(animate);
        };

        const renderPosition = () => {
          const selectedIndex = clamp(Math.round(position), 0, maximumIndex);

          section.dataset.index = String(selectedIndex);
          section.dataset.value = values[selectedIndex];
          grid.dataset.index = String(selectedIndex);
          grid.dataset.value = values[selectedIndex];
          grid.dataset.reducedMotion = String(motionPreference.matches);
          device.dataset.index = String(selectedIndex);
          device.dataset.value = values[selectedIndex];
          wheel.dataset.index = String(selectedIndex);
          wheel.dataset.value = values[selectedIndex];

          options.forEach((option, index) => {
            const distance = index - position;
            const placement = manualPlacement(distance);
            const direction = distance === 0 ? 0 : distance > 0 ? 1 : -1;
            option.style.opacity = String(placement.opacity);
            option.style.transform = `translateY(calc(-50% + ${direction * placement.offset} * var(--wheel-unit))) scale(${placement.scale})`;
            if (motionPreference.matches) option.style.transition = "none";
            else option.style.removeProperty("transition");
            option.dataset.active = String(index === selectedIndex);
            option.setAttribute("aria-selected", String(index === selectedIndex));
          });

          wheel.setAttribute("aria-activedescendant", options[selectedIndex].id);
          cursor.dataset.value = values[selectedIndex];
          cursor.style.top = `${manualCursorTop(position, maximumIndex)}%`;
          if (status) {
            status.textContent = `Setting ${values[selectedIndex]} millimeters selected.`;
          }

          frames.forEach((image, index) => {
            image.dataset.active = String(index === selectedIndex);
            image.setAttribute("aria-hidden", String(index !== selectedIndex));
            image.alt =
              index === selectedIndex
                ? `GLYDE Manual Mode setting ${values[selectedIndex]}`
                : "";
          });

          queueVisualPosition(position);
        };

        const updatePosition = (next) => {
          position = clamp(
            typeof next === "function" ? next(position) : next,
            0,
            maximumIndex,
          );
          renderPosition();
        };

        const updateIndex = (next) => {
          const currentIndex = Math.round(position);
          updatePosition(
            typeof next === "function" ? next(currentIndex) : next,
          );
        };

        const markFrameReady = (index) => {
          readyFrames[index] = true;
          queueVisualPosition(pendingVisualPosition);
        };

        const prepareFrame = (image, index) => {
          if (
            readyFrames[index] ||
            decodingFrames[index] ||
            !image.complete ||
            image.naturalWidth === 0
          ) {
            return;
          }

          if (typeof image.decode !== "function") {
            markFrameReady(index);
            return;
          }

          decodingFrames[index] = true;
          image.decode().then(
            () => {
              if (controller.destroyed) return;
              decodingFrames[index] = false;
              markFrameReady(index);
            },
            () => {
              if (controller.destroyed) return;
              decodingFrames[index] = false;
              markFrameReady(index);
            },
          );
        };

        frames.forEach((image, index) => {
          image.dataset.index = String(index);
          image.dataset.value = values[index] || String(index);
          image.loading = "eager";
          image.decoding = "async";
          image.draggable = false;
          controller.on(image, "load", () => prepareFrame(image, index));
          prepareFrame(image, index);
        });

        const queuePageScroll = (deltaY) => {
          overflowScroll += deltaY;
          if (overflowScrollFrame) return;
          overflowScrollFrame = controller.frame(() => {
            const pending = overflowScroll;
            overflowScroll = 0;
            overflowScrollFrame = 0;
            window.scrollBy({ top: pending, left: 0, behavior: "instant" });
          });
        };

        const clearQueuedWheelSteps = () => {
          controller.clearTimeout(wheelDrainTimer);
          wheelDrainTimer = 0;
          wheelAccumulator = 0;
          wheelAccumulatorDirection = 0;
        };

        const resetWheel = () => {
          clearQueuedWheelSteps();
          wheelLastInputAt = 0;
        };

        function drainWheel() {
          if (Math.abs(wheelAccumulator) < 1) return;
          const direction = wheelAccumulator > 0 ? 1 : -1;
          const currentIndex = Math.round(position);
          const canMove =
            direction > 0 ? currentIndex < maximumIndex : currentIndex > 0;
          if (!canMove) {
            clearQueuedWheelSteps();
            return;
          }

          updateIndex(currentIndex + direction);
          wheelAccumulator -= direction;
          wheelLastStepAt = performance.now();
          scheduleWheelDrain();
        }

        function scheduleWheelDrain() {
          if (wheelDrainTimer || Math.abs(wheelAccumulator) < 1) return;
          const delay = Math.max(
            0,
            MANUAL_WHEEL_STEP_MS - (performance.now() - wheelLastStepAt),
          );
          if (delay === 0) {
            drainWheel();
            return;
          }
          wheelDrainTimer = controller.timeout(() => {
            wheelDrainTimer = 0;
            drainWheel();
          }, delay);
        }

        const handleWheel = (event) => {
          if (
            drag ||
            event.ctrlKey ||
            Math.abs(event.deltaX) > Math.abs(event.deltaY)
          ) {
            return;
          }

          const normalized = manualWheelNotches(event);
          if (!Number.isFinite(normalized) || normalized === 0) return;

          const direction = normalized > 0 ? 1 : -1;
          const now = performance.now();
          const idle =
            wheelLastInputAt === 0 || now - wheelLastInputAt >= MANUAL_WHEEL_IDLE_MS;
          const directionChanged =
            wheelAccumulatorDirection !== 0 &&
            wheelAccumulatorDirection !== direction;
          const currentIndex = Math.round(position);

          if (motionPreference.matches) {
            if (directionChanged || (idle && Math.abs(wheelAccumulator) < 1)) {
              clearQueuedWheelSteps();
            }
            wheelAccumulatorDirection = direction;
            wheelLastInputAt = now;

            const remainingSteps =
              direction > 0 ? maximumIndex - currentIndex : currentIndex;
            const capacity = Math.max(
              0,
              remainingSteps - Math.abs(wheelAccumulator),
            );
            if (capacity === 0) return;

            wheelAccumulator += direction * Math.min(capacity, Math.abs(normalized));
            const immediateSteps = Math.trunc(wheelAccumulator);
            if (immediateSteps !== 0) {
              updateIndex(currentIndex + immediateSteps);
              wheelAccumulator -= immediateSteps;
              wheelLastStepAt = now;
            }
            return;
          }

          const remainingSteps =
            direction > 0 ? maximumIndex - currentIndex : currentIndex;
          if (remainingSteps === 0) {
            // The outward packet remains native at both ends, so the same
            // wheel/trackpad gesture continues the page in either direction.
            resetWheel();
            return;
          }

          if (directionChanged || (idle && Math.abs(wheelAccumulator) < 1)) {
            clearQueuedWheelSteps();
          }
          wheelAccumulatorDirection = direction;
          wheelLastInputAt = now;

          const capacity = Math.max(
            0,
            remainingSteps - Math.abs(wheelAccumulator),
          );
          event.preventDefault();
          if (capacity === 0) return;

          wheelAccumulator += direction * Math.min(capacity, Math.abs(normalized));
          scheduleWheelDrain();
        };

        const handleKeyDown = (event) => {
          const deltas = {
            ArrowLeft: -1,
            ArrowUp: -1,
            ArrowRight: 1,
            ArrowDown: 1,
            PageUp: -2,
            PageDown: 2,
          };

          if (event.key === "Home" || event.key === "End") {
            event.preventDefault();
            resetWheel();
            updateIndex(event.key === "Home" ? 0 : maximumIndex);
            return;
          }
          if (!(event.key in deltas)) return;
          event.preventDefault();
          resetWheel();
          updateIndex((current) => current + deltas[event.key]);
        };

        const handlePointerDown = (event) => {
          if (drag || !event.isPrimary) return;
          if (event.pointerType === "mouse" && event.button !== 0) return;
          if (!(event.target instanceof Node) || !wheel.contains(event.target)) return;

          const captureTarget =
            event.target instanceof HTMLElement ? event.target : wheel;
          resetWheel();
          drag = {
            axis: event.pointerType === "mouse" ? "vertical" : "pending",
            captureTarget,
            lastY: event.clientY,
            pointerId: event.pointerId,
            pointerType: event.pointerType,
            startedOnWheel: true,
            startX: event.clientX,
            startY: event.clientY,
            step: manualDragStep(wheel.getBoundingClientRect().height),
            moved: false,
          };

          if (event.pointerType === "mouse") {
            wheel.focus({ preventScroll: true });
            captureTarget.setPointerCapture(event.pointerId);
            if (event.cancelable) event.preventDefault();
          }
        };

        const handlePointerMove = (event) => {
          const activeDrag = drag;
          if (!activeDrag || activeDrag.pointerId !== event.pointerId) return;

          const travelX = event.clientX - activeDrag.startX;
          const travelY = event.clientY - activeDrag.startY;
          if (activeDrag.axis === "pending") {
            if (
              Math.max(Math.abs(travelX), Math.abs(travelY)) < MANUAL_POINTER_LOCK
            ) {
              return;
            }
            if (Math.abs(travelX) >= Math.abs(travelY)) {
              drag = null;
              return;
            }
            activeDrag.axis = "vertical";
            activeDrag.captureTarget.setPointerCapture(event.pointerId);
          }

          const deltaY = event.clientY - activeDrag.lastY;
          if (!activeDrag.moved && Math.abs(travelY) <= 8) return;
          if (deltaY === 0) return;

          if (!activeDrag.moved) {
            activeDrag.moved = true;
            grid.dataset.dragging = "true";
          }
          if (event.cancelable) event.preventDefault();

          const currentPosition = position;
          const rawPosition = currentPosition - deltaY / activeDrag.step;
          const clampedPosition = clamp(rawPosition, 0, maximumIndex);
          const nextPosition = motionPreference.matches
            ? Math.round(clampedPosition)
            : clampedPosition;
          updatePosition(nextPosition);

          const consumedDeltaY = (currentPosition - clampedPosition) * activeDrag.step;
          const overflowDeltaY = deltaY - consumedDeltaY;
          if (Math.abs(overflowDeltaY) > 0.01) {
            queuePageScroll(-overflowDeltaY);
          }
          activeDrag.lastY = event.clientY;
        };

        const finishPointer = (event) => {
          const activeDrag = drag;
          if (!activeDrag || activeDrag.pointerId !== event.pointerId) return;
          drag = null;
          try {
            if (activeDrag.captureTarget.hasPointerCapture(event.pointerId)) {
              activeDrag.captureTarget.releasePointerCapture(event.pointerId);
            }
          } catch {
            // The browser may release capture before pointercancel is delivered.
          }

          if (activeDrag.pointerType !== "mouse") {
            controller.frame(() => {
              if (document.activeElement === wheel) wheel.blur();
            });
          }

          grid.dataset.dragging = "false";
          if (activeDrag.moved) {
            updateIndex(Math.round(position));
            return;
          }

          if (event.type !== "pointerup" || !activeDrag.startedOnWheel) return;
          let nearestIndex = -1;
          let nearestDistance = Infinity;
          options.forEach((option) => {
            if (Number(getComputedStyle(option).opacity) < 0.25) return;
            const bounds = option.getBoundingClientRect();
            const distance = Math.abs(
              bounds.top + bounds.height / 2 - activeDrag.startY,
            );
            if (distance >= nearestDistance) return;
            nearestDistance = distance;
            nearestIndex = Number(option.dataset.index ?? -1);
          });
          if (nearestIndex >= 0) updateIndex(nearestIndex);
        };

        const syncMotionPreference = () => {
          resetWheel();
          grid.dataset.reducedMotion = String(motionPreference.matches);
          if (motionPreference.matches) cancelVisualAnimation();
          queueVisualPosition(pendingVisualPosition);
          renderPosition();
        };

        controller.on(section, "wheel", handleWheel, { passive: false });
        controller.on(wheel, "keydown", handleKeyDown);
        controller.on(section, "pointerdown", handlePointerDown, { passive: false });
        controller.on(section, "pointermove", handlePointerMove, { passive: false });
        controller.on(section, "pointerup", finishPointer);
        controller.on(section, "pointercancel", finishPointer);
        controller.on(section, "lostpointercapture", finishPointer);
        listenToMediaQuery(controller, motionPreference, syncMotionPreference);
        controller.cleanup(() => {
          cancelVisualAnimation();
          resetWheel();
          controller.cancelFrame(overflowScrollFrame);
          grid.removeAttribute("data-dragging");
        });

        commitVisualPosition(visualPosition);
        renderPosition();
      });
    });
  }

  function initDesignCraft(root) {
    findAll(root, SELECTORS.craft).forEach((section) => {
      createController(section, "design-craft", (controller) => {
        const viewport = section.querySelector(".s2CraftViewport");
        const trackNode = section.querySelector(".s2CraftTrack");
        const tabs = Array.from(section.querySelectorAll(".s2CraftTab"));
        const cards = Array.from(section.querySelectorAll(".s2CraftCard"));
        const nextButton = section.querySelector(".s2CraftTabsArrow");
        if (!viewport || !trackNode || cards.length === 0) return;

        const defaultStarts = [0, 4, 8];
        const tabStarts = tabs.map((tab, index) => {
          const explicit = Number.parseInt(tab.dataset.start || "", 10);
          return Number.isFinite(explicit) ? explicit : defaultStarts[index] || 0;
        });
        const visibleCards = Number.parseInt(section.dataset.visibleCards || "5", 10);
        const maximumIndex = Math.max(
          0,
          cards.length - (Number.isFinite(visibleCards) ? visibleCards : 5) + 1,
        );
        let index = clamp(
          Number.parseInt(section.dataset.index || "0", 10) || 0,
          0,
          maximumIndex,
        );
        let scrollingTo = false;
        let scrollingTimer = 0;
        let lastScrollCheck = 0;

        viewport.setAttribute("aria-roledescription", "carousel");
        tabs.forEach((tab) => tab.setAttribute("role", "tab"));
        cards.forEach((card, cardIndex) => {
          card.setAttribute("role", "group");
          card.setAttribute("aria-roledescription", "slide");
          card.setAttribute("aria-label", `${cardIndex + 1} of ${cards.length}`);
        });

        const selectedTabIndex = () => {
          let selected = 0;
          tabStarts.forEach((start, tabIndex) => {
            if (index >= start) selected = tabIndex;
          });
          return selected;
        };

        const render = () => {
          section.dataset.index = String(index);
          trackNode.style.transform = `translateX(calc(${-index} * (352 / 1920 * 100vw + var(--gap))))`;
          trackNode.style.transition = motionPreference.matches ? "none" : "";
          const selected = selectedTabIndex();
          tabs.forEach((tab, tabIndex) => {
            const isSelected = selected === tabIndex;
            tab.setAttribute("aria-selected", String(isSelected));
            tab.tabIndex = isSelected ? 0 : -1;
          });
        };

        const goTo = (next, focusTab = false) => {
          index = clamp(Math.round(next), 0, maximumIndex);
          render();

          const card = cards[index];
          if (viewport.scrollWidth > viewport.clientWidth && card) {
            scrollingTo = true;
            controller.clearTimeout(scrollingTimer);
            const scrollPadding =
              Number.parseFloat(getComputedStyle(viewport).scrollPaddingLeft) || 0;
            viewport.scrollTo({
              left:
                viewport.scrollLeft +
                card.getBoundingClientRect().left -
                viewport.getBoundingClientRect().left -
                scrollPadding,
              behavior: motionPreference.matches ? "auto" : "smooth",
            });
            scrollingTimer = controller.timeout(() => {
              scrollingTo = false;
              scrollingTimer = 0;
            }, motionPreference.matches ? 0 : 600);
          }

          if (focusTab) tabs[selectedTabIndex()]?.focus({ preventScroll: true });
        };

        const handleScroll = () => {
          if (scrollingTo) return;
          const now = Date.now();
          if (now - lastScrollCheck < 120) return;
          lastScrollCheck = now;

          const edge = viewport.getBoundingClientRect().left;
          let nearest = 0;
          let best = Infinity;
          cards.forEach((card, cardIndex) => {
            const distance = Math.abs(card.getBoundingClientRect().left - edge);
            if (distance >= best) return;
            best = distance;
            nearest = cardIndex;
          });
          index = clamp(nearest, 0, maximumIndex);
          render();
        };

        tabs.forEach((tab, tabIndex) => {
          controller.on(tab, "click", () => goTo(tabStarts[tabIndex]));
          controller.on(tab, "keydown", (event) => {
            let requestedTab = tabIndex;
            if (event.key === "ArrowRight" || event.key === "ArrowDown") {
              requestedTab = wrapIndex(tabIndex + 1, tabs.length);
            } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
              requestedTab = wrapIndex(tabIndex - 1, tabs.length);
            } else if (event.key === "Home") {
              requestedTab = 0;
            } else if (event.key === "End") {
              requestedTab = tabs.length - 1;
            } else {
              return;
            }
            event.preventDefault();
            goTo(tabStarts[requestedTab], true);
          });
        });

        if (nextButton) {
          controller.on(nextButton, "click", () => {
            goTo(index >= maximumIndex ? 0 : index + 1);
          });
        }
        controller.on(viewport, "scroll", handleScroll, { passive: true });
        controller.on(section, "glyde:select", (event) => {
          const next = Number(event.detail?.index);
          if (Number.isFinite(next)) goTo(next, Boolean(event.detail?.focus));
        });
        listenToMediaQuery(controller, motionPreference, render);
        controller.cleanup(() => {
          controller.clearTimeout(scrollingTimer);
          trackNode.style.removeProperty("transform");
        });

        render();
      });
    });
  }

  function initFaqs(root) {
    findAll(root, SELECTORS.faq).forEach((section) => {
      createController(section, "faq", (controller) => {
        const items = Array.from(
          section.querySelectorAll("[data-glyde-faq-item], .faqItem"),
        );
        if (items.length === 0) return;

        const setExpanded = (item, expanded) => {
          const button = item.querySelector(
            "[data-glyde-faq-button], .faqItem h3 button, .faqToggle",
          );
          const answer = item.querySelector(
            "[data-glyde-faq-answer], .faqAnswer",
          );
          if (!button || !answer) return;

          const buttonId = ensureId(button, "glyde-faq-button");
          const answerId = ensureId(answer, "glyde-faq-answer");
          button.setAttribute("aria-controls", answerId);
          button.setAttribute("aria-expanded", String(expanded));
          answer.setAttribute("aria-labelledby", buttonId);
          answer.setAttribute("role", "region");
          answer.setAttribute("aria-hidden", String(!expanded));
          if (expanded) answer.removeAttribute("inert");
          else answer.setAttribute("inert", "");
          item.classList.toggle("is-open", expanded);
          item.classList.toggle("faqOpen", expanded);
          item.dataset.glydeOpen = String(expanded);
        };

        const closeAll = (except = null) => {
          items.forEach((item) => setExpanded(item, item === except));
        };

        const syncMotionPreference = () => {
          items.forEach((item) => {
            const answer = item.querySelector(
              "[data-glyde-faq-answer], .faqAnswer",
            );
            if (answer) answer.style.transition = motionPreference.matches ? "none" : "";
          });
        };

        // Product requirement: all answers start collapsed, including after a
        // Shopify section reload in the Theme Editor.
        closeAll();

        items.forEach((item, index) => {
          item.dataset.glydeIndex = item.dataset.glydeIndex || String(index);
          const button = item.querySelector(
            "[data-glyde-faq-button], .faqItem h3 button, .faqToggle",
          );
          if (!button) return;
          controller.on(button, "click", () => {
            const wasExpanded = button.getAttribute("aria-expanded") === "true";
            closeAll(wasExpanded ? null : item);
          });
        });

        controller.on(section, "glyde:select", (event) => {
          const index = Number(event.detail?.index);
          if (!Number.isFinite(index) || !items[index]) return;
          closeAll(items[index]);
          if (event.detail?.focus) {
            items[index]
              .querySelector("[data-glyde-faq-button], .faqItem h3 button, .faqToggle")
              ?.focus({ preventScroll: true });
          }
        });
        listenToMediaQuery(controller, motionPreference, syncMotionPreference);
        syncMotionPreference();
      });
    });
  }

  function init(root = document) {
    initHeroVideos(root);
    initLoopingVideos(root);
    initTopNavs(root);
    initWaitlistForms(root);
    initResults(root);
    initManualModes(root);
    initDesignCraft(root);
    initFaqs(root);
  }

  function rootFromShopifyEvent(event) {
    return event.target instanceof Element ? event.target : document;
  }

  function selectThemeEditorBlock(block) {
    const resultCard = block.matches(SELECTORS.resultCard)
      ? block
      : block.querySelector(SELECTORS.resultCard);
    if (resultCard) {
      const section = resultCard.closest(SELECTORS.results);
      const cards = section
        ? Array.from(section.querySelectorAll(SELECTORS.resultCard))
        : [];
      section?.dispatchEvent(
        new CustomEvent("glyde:select", {
          detail: { index: cards.indexOf(resultCard), focus: false },
        }),
      );
      return;
    }

    const faqItem = block.matches("[data-glyde-faq-item], .faqItem")
      ? block
      : block.querySelector("[data-glyde-faq-item], .faqItem");
    if (faqItem) {
      const section = faqItem.closest(SELECTORS.faq);
      const items = section
        ? Array.from(
            section.querySelectorAll("[data-glyde-faq-item], .faqItem"),
          )
        : [];
      section?.dispatchEvent(
        new CustomEvent("glyde:select", {
          detail: { index: items.indexOf(faqItem), focus: false },
        }),
      );
      return;
    }

    const craftCard = block.matches(".s2CraftCard")
      ? block
      : block.querySelector(".s2CraftCard");
    if (craftCard) {
      const section = craftCard.closest(SELECTORS.craft);
      const cards = section
        ? Array.from(section.querySelectorAll(".s2CraftCard"))
        : [];
      section?.dispatchEvent(
        new CustomEvent("glyde:select", {
          detail: { index: cards.indexOf(craftCard), focus: false },
        }),
      );
    }
  }

  const runtime = {
    init,
    destroy: destroyWithin,
  };
  window[GLOBAL_KEY] = runtime;

  document.addEventListener("shopify:section:load", (event) => {
    init(rootFromShopifyEvent(event));
  });
  document.addEventListener("shopify:section:unload", (event) => {
    destroyWithin(rootFromShopifyEvent(event));
  });
  document.addEventListener("shopify:block:select", (event) => {
    if (event.target instanceof Element) selectThemeEditorBlock(event.target);
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => init(), { once: true });
  } else {
    init();
  }
})();
