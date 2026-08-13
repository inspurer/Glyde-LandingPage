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
    lengthPicker: "[data-glyde-length-picker]",
    lengthPickerViewport: "[data-glyde-length-picker-viewport]",
    lengthPickerOption: "[data-glyde-length-option]",
    lengthPickerOutput: "[data-glyde-length-picker-output]",
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

  function clampValue(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
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
      const track = viewport?.querySelector(".designTrack");
      const next = section.querySelector(selectors.designNext);
      const cards = Array.from(section.querySelectorAll(selectors.designCard));
      if (!viewport || !track || !next || cards.length === 0) return;
      if (!markInitialized(section, "design")) return;

      next.setAttribute("aria-controls", ensureId(viewport, "glyde-design-viewport"));
      viewport.setAttribute("aria-roledescription", "carousel");

      const status = document.createElement("span");
      status.className = "srOnly";
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      status.setAttribute("aria-atomic", "true");
      section.append(status);

      cards.forEach((card, index) => {
        card.setAttribute("role", "group");
        card.setAttribute("aria-roledescription", "slide");
        card.setAttribute("aria-label", `${index + 1} of ${cards.length}`);
      });

      const featuredIndex = Math.max(
        0,
        cards.findIndex((card) => card.classList.contains("featuredDesignCard")),
      );
      let active = clampIndex(
        Number.parseInt(section.dataset.glydeActive || String(featuredIndex), 10) || 0,
        cards.length,
      );
      let lastDirection = 0;
      let announceChanges = false;

      const relativeSlot = (index, activeIndex) => {
        let slot = clampIndex(index - activeIndex, cards.length);
        if (slot > Math.floor(cards.length / 2)) slot -= cards.length;
        return slot;
      };

      const render = (requestedIndex, direction = 0) => {
        const previous = active;
        active = clampIndex(requestedIndex, cards.length);
        section.dataset.glydeActive = String(active);

        cards.forEach((card, index) => {
          const previousSlot = Number.parseInt(card.dataset.glydeSlot || "", 10);
          const slot = relativeSlot(index, active);
          const wrapsForward = direction > 0 && previousSlot === -2 && slot === 2;
          const wrapsBackward = direction < 0 && previousSlot === 2 && slot === -2;

          if (previous !== active && (wrapsForward || wrapsBackward)) {
            card.dataset.glydeWrapping = "true";
          }

          card.dataset.glydeSlot = String(slot);
          card.dataset.glydeActive = String(index === active);
          card.classList.toggle("featuredDesignCard", index === active);
          if (index === active) card.setAttribute("aria-current", "true");
          else card.removeAttribute("aria-current");
        });

        // A card crossing the circular seam is moved behind the deck and faded
        // back in, instead of visibly flying across all five slots.
        cards.forEach((card) => {
          if (card.dataset.glydeWrapping !== "true") return;
          void card.offsetWidth;
          requestAnimationFrame(() => {
            requestAnimationFrame(() => delete card.dataset.glydeWrapping);
          });
        });

        const heading = cards[active].querySelector("h3")?.textContent?.trim();
        next.setAttribute(
          "aria-label",
          `Show next design detail, ${clampIndex(active + 1, cards.length) + 1} of ${cards.length}`,
        );
        if (announceChanges) {
          status.textContent = `Design detail ${active + 1} of ${cards.length}${heading ? `: ${heading}` : ""}`;
        }
      };

      const select = (requestedIndex, direction) => {
        announceChanges = true;
        lastDirection = direction;
        render(requestedIndex, direction);
      };

      next.addEventListener("click", () => select(active + 1, 1));

      viewport.addEventListener("keydown", (event) => {
        let requestedIndex;
        let direction = 0;

        switch (event.key) {
          case "ArrowRight":
          case "PageDown":
            requestedIndex = active + 1;
            direction = 1;
            break;
          case "ArrowLeft":
          case "PageUp":
            requestedIndex = active - 1;
            direction = -1;
            break;
          case "Home":
            requestedIndex = 0;
            direction = -1;
            break;
          case "End":
            requestedIndex = cards.length - 1;
            direction = 1;
            break;
          default:
            return;
        }

        event.preventDefault();
        select(requestedIndex, direction);
      });

      let wheelLocked = false;
      viewport.addEventListener(
        "wheel",
        (event) => {
          if (Math.abs(event.deltaX) <= Math.abs(event.deltaY) || Math.abs(event.deltaX) < 18) return;
          event.preventDefault();
          if (wheelLocked) return;
          wheelLocked = true;
          const direction = event.deltaX > 0 ? 1 : -1;
          select(active + direction, direction);
          window.setTimeout(() => {
            wheelLocked = false;
          }, reducedMotion.matches ? 80 : 520);
        },
        { passive: false },
      );

      let pointerId = null;
      let startX = 0;
      let startY = 0;
      let lastX = 0;
      let lastTime = 0;
      let velocityX = 0;
      let horizontalDrag = false;

      const resetDrag = () => {
        pointerId = null;
        horizontalDrag = false;
        track.style.removeProperty("transform");
        delete viewport.dataset.glydeDragging;
      };

      viewport.addEventListener("pointerdown", (event) => {
        if (!event.isPrimary || event.button !== 0) return;
        pointerId = event.pointerId;
        startX = event.clientX;
        startY = event.clientY;
        lastX = event.clientX;
        lastTime = event.timeStamp;
        velocityX = 0;
        horizontalDrag = false;
        viewport.setPointerCapture(pointerId);
      });

      viewport.addEventListener("pointermove", (event) => {
        if (event.pointerId !== pointerId) return;
        const deltaX = event.clientX - startX;
        const deltaY = event.clientY - startY;

        if (!horizontalDrag) {
          if (Math.abs(deltaX) < 7) return;
          if (Math.abs(deltaY) > Math.abs(deltaX)) {
            resetDrag();
            return;
          }
          horizontalDrag = true;
          viewport.dataset.glydeDragging = "true";
        }

        event.preventDefault();
        const elapsed = Math.max(1, event.timeStamp - lastTime);
        velocityX = (event.clientX - lastX) / elapsed;
        lastX = event.clientX;
        lastTime = event.timeStamp;
        const resistance = 0.82;
        track.style.transform = `translate3d(${deltaX * resistance}px, 0, 0)`;
      });

      const finishDrag = (event) => {
        if (event.pointerId !== pointerId) return;
        const deltaX = event.clientX - startX;
        const threshold = Math.min(96, Math.max(42, viewport.clientWidth * 0.08));
        const shouldAdvance = horizontalDrag && (Math.abs(deltaX) >= threshold || Math.abs(velocityX) > 0.45);

        resetDrag();
        if (shouldAdvance) {
          const direction = deltaX < 0 ? 1 : -1;
          select(active + direction, direction);
        }
      };

      viewport.addEventListener("pointerup", finishDrag);
      viewport.addEventListener("pointercancel", finishDrag);
      viewport.addEventListener("lostpointercapture", (event) => {
        if (event.pointerId === pointerId) resetDrag();
      });

      section.addEventListener("glyde:select", (event) => {
        const index = Number(event.detail?.index);
        if (!Number.isFinite(index)) return;
        const forwardDistance = clampIndex(index - active, cards.length);
        const backwardDistance = clampIndex(active - index, cards.length);
        select(index, forwardDistance <= backwardDistance ? 1 : -1);
        if (event.detail?.focus) viewport.focus({ preventScroll: true });
      });

      render(active, lastDirection);
      requestAnimationFrame(() => {
        section.dataset.glydeReady = "true";
      });
    });
  }

  function initLengthPicker(root) {
    const geometry = [
      { offset: 0, scale: 1, opacity: 1 },
      { offset: 126, scale: 0.75, opacity: 0.6 },
      { offset: 219.5, scale: 0.55, opacity: 0.3 },
      { offset: 281, scale: 0.3, opacity: 0.3 },
    ];

    const interpolate = (start, end, progress) => start + (end - start) * progress;

    const visualAtDistance = (distance) => {
      const absoluteDistance = Math.abs(distance);

      if (absoluteDistance >= geometry.length - 1) {
        const overflow = absoluteDistance - (geometry.length - 1);
        return {
          offset: geometry[3].offset + overflow * 48,
          scale: Math.max(0.16, geometry[3].scale - overflow * 0.08),
          opacity: Math.max(0, geometry[3].opacity - overflow * 0.3),
        };
      }

      const lowerIndex = Math.floor(absoluteDistance);
      const upperIndex = Math.ceil(absoluteDistance);
      const progress = absoluteDistance - lowerIndex;
      const lower = geometry[lowerIndex];
      const upper = geometry[upperIndex];

      return {
        offset: interpolate(lower.offset, upper.offset, progress),
        scale: interpolate(lower.scale, upper.scale, progress),
        opacity: interpolate(lower.opacity, upper.opacity, progress),
      };
    };

    findAll(root, selectors.lengthPicker).forEach((picker) => {
      const viewport = picker.querySelector(selectors.lengthPickerViewport);
      const options = Array.from(picker.querySelectorAll(selectors.lengthPickerOption));
      const output = picker.querySelector(selectors.lengthPickerOutput);

      if (!viewport || options.length === 0) return;
      if (!markInitialized(picker, "length-picker")) return;

      const maximumIndex = options.length - 1;
      let position = Math.max(
        0,
        options.findIndex((option) => option.getAttribute("aria-selected") === "true"),
      );
      let activeIndex = Math.round(position);
      let renderedActiveIndex = -1;
      let animationFrame = 0;
      let pointerId = null;
      let pointerStartY = 0;
      let pointerStartPosition = position;
      let pointerMoved = false;
      let pointerTapIndex = null;
      let pointerSamples = [];
      let suppressClickUntil = 0;
      let wheelTimer = 0;
      let wheelVelocity = 0;
      let lastWheelTime = 0;
      let heightScale = (viewport.getBoundingClientRect().height || 591) / 591;

      viewport.setAttribute("aria-orientation", "vertical");

      options.forEach((option, index) => {
        option.dataset.index = option.dataset.index || String(index);
        option.setAttribute("aria-label", `${option.dataset.value || option.textContent.trim()} inches`);
        option.setAttribute("aria-posinset", String(index + 1));
        option.setAttribute("aria-setsize", String(options.length));
      });

      const stopAnimation = () => {
        if (!animationFrame) return;
        window.cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      };

      const clearWheel = () => {
        if (!wheelTimer) return;
        window.clearTimeout(wheelTimer);
        wheelTimer = 0;
      };

      const resetWheel = () => {
        clearWheel();
        wheelVelocity = 0;
        lastWheelTime = 0;
      };

      const boundedWithResistance = (nextPosition) => {
        if (nextPosition < 0) return nextPosition * 0.22;
        if (nextPosition > maximumIndex) {
          return maximumIndex + (nextPosition - maximumIndex) * 0.22;
        }
        return nextPosition;
      };

      const render = (nextPosition) => {
        position = nextPosition;
        activeIndex = clampValue(Math.round(position), 0, maximumIndex);

        options.forEach((option, index) => {
          const distance = index - position;
          const visual = visualAtDistance(distance);
          const offset = Math.sign(distance) * visual.offset * heightScale;

          option.style.setProperty("--length-picker-y", `${offset.toFixed(3)}px`);
          option.style.setProperty("--length-picker-scale", visual.scale.toFixed(4));
          option.style.setProperty("--length-picker-opacity", visual.opacity.toFixed(4));
          option.style.setProperty("--length-picker-z", String(Math.max(1, 10 - Math.round(Math.abs(distance) * 2))));
        });

        if (activeIndex !== renderedActiveIndex) {
          options.forEach((option, index) => {
            const isActive = index === activeIndex;
            option.classList.toggle("is-selected", isActive);
            option.setAttribute("aria-selected", String(isActive));
          });

          const activeOption = options[activeIndex];
          viewport.setAttribute("aria-activedescendant", activeOption.id);
          picker.dataset.glydeValue = activeOption.dataset.value || activeOption.textContent.trim();
          renderedActiveIndex = activeIndex;
        }
      };

      const commit = (requestedIndex, announce = true) => {
        const index = clampValue(Math.round(requestedIndex), 0, maximumIndex);
        position = index;
        render(position);

        const option = options[index];
        const value = option.dataset.value || option.textContent.trim();
        if (announce && output) output.textContent = `${value} inches`;

        picker.dispatchEvent(
          new CustomEvent("glyde:length-change", {
            bubbles: true,
            detail: { index, value: Number.parseFloat(value) },
          }),
        );
      };

      const animateTo = (requestedIndex, initialVelocity = 0, announce = true) => {
        const target = clampValue(Math.round(requestedIndex), 0, maximumIndex);
        stopAnimation();

        if (reducedMotion.matches) {
          commit(target, announce);
          return;
        }

        let velocity = clampValue(initialVelocity, -8, 8);
        let previousTime = performance.now();

        const tick = (time) => {
          const deltaTime = Math.min(0.032, Math.max(0.001, (time - previousTime) / 1000));
          previousTime = time;

          const acceleration = (target - position) * 185 - velocity * 27;
          velocity += acceleration * deltaTime;
          position += velocity * deltaTime;
          render(position);

          if (Math.abs(target - position) < 0.0015 && Math.abs(velocity) < 0.018) {
            animationFrame = 0;
            commit(target, announce);
            return;
          }

          animationFrame = window.requestAnimationFrame(tick);
        };

        animationFrame = window.requestAnimationFrame(tick);
      };

      const pointerVelocity = () => {
        if (pointerSamples.length < 2) return 0;
        const first = pointerSamples[0];
        const last = pointerSamples[pointerSamples.length - 1];
        const elapsed = (last.time - first.time) / 1000;
        if (elapsed <= 0) return 0;
        return clampValue((last.position - first.position) / elapsed, -8, 8);
      };

      const optionNearestToY = (clientY) => {
        const bounds = viewport.getBoundingClientRect();
        heightScale = (bounds.height || 591) / 591;
        const pointerOffset = clientY - (bounds.top + bounds.height / 2);
        let nearestIndex = activeIndex;
        let nearestDistance = Number.POSITIVE_INFINITY;

        options.forEach((option, index) => {
          const distance = index - position;
          const visual = visualAtDistance(distance);
          const optionOffset = Math.sign(distance) * visual.offset * heightScale;
          const distanceFromPointer = Math.abs(pointerOffset - optionOffset);

          if (distanceFromPointer < nearestDistance) {
            nearestDistance = distanceFromPointer;
            nearestIndex = index;
          }
        });

        return nearestIndex;
      };

      const finishPointer = (event, cancelled = false) => {
        if (pointerId === null || event.pointerId !== pointerId) return;

        if (viewport.hasPointerCapture(pointerId)) viewport.releasePointerCapture(pointerId);
        pointerId = null;
        viewport.classList.remove("is-dragging");

        if (!cancelled && !pointerMoved && pointerTapIndex !== null) {
          suppressClickUntil = performance.now() + 350;
          animateTo(pointerTapIndex, 0, true);
          pointerTapIndex = null;
          return;
        }

        const velocity = cancelled ? 0 : pointerVelocity();
        const projectedPosition = position + velocity * 0.18;
        if (pointerMoved) suppressClickUntil = performance.now() + 350;
        pointerTapIndex = null;
        animateTo(projectedPosition, velocity, pointerMoved);
      };

      viewport.addEventListener("pointerdown", (event) => {
        if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;

        stopAnimation();
        resetWheel();
        pointerId = event.pointerId;
        pointerStartY = event.clientY;
        pointerStartPosition = position;
        pointerMoved = false;
        const tappedOption = event.target.closest(selectors.lengthPickerOption);
        const tappedIndex = tappedOption
          ? Number.parseInt(tappedOption.dataset.index || "", 10)
          : Number.NaN;
        pointerTapIndex = Number.isFinite(tappedIndex)
          ? tappedIndex
          : optionNearestToY(event.clientY);
        pointerSamples = [{ time: performance.now(), position }];
        viewport.setPointerCapture(pointerId);
        viewport.classList.add("is-dragging");
        viewport.focus({ preventScroll: true });
      });

      viewport.addEventListener("pointermove", (event) => {
        if (pointerId === null || event.pointerId !== pointerId) return;
        event.preventDefault();

        const delta = event.clientY - pointerStartY;
        if (Math.abs(delta) > 4) pointerMoved = true;

        const step = Math.max(64, 126 * heightScale);
        const nextPosition = pointerStartPosition - delta / step;
        render(boundedWithResistance(nextPosition));

        const time = performance.now();
        pointerSamples.push({ time, position });
        pointerSamples = pointerSamples.filter((sample) => time - sample.time <= 100);
      });

      viewport.addEventListener("pointerup", (event) => finishPointer(event));
      viewport.addEventListener("pointercancel", (event) => finishPointer(event, true));

      viewport.addEventListener("click", (event) => {
        if (performance.now() < suppressClickUntil) return;
        const option = event.target.closest(selectors.lengthPickerOption);
        if (!option || !picker.contains(option)) return;

        const index = Number.parseInt(option.dataset.index || "", 10);
        if (Number.isFinite(index)) animateTo(index, 0, true);
      });

      viewport.addEventListener(
        "wheel",
        (event) => {
          if (Math.abs(event.deltaY) < 0.01) return;
          event.preventDefault();
          stopAnimation();
          clearWheel();

          const direction = Math.sign(event.deltaY);
          if (reducedMotion.matches) {
            wheelVelocity = 0;
            lastWheelTime = 0;
            commit(activeIndex + direction, true);
            return;
          }

          const modeMultiplier = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1;
          const pixelDelta = clampValue(event.deltaY * modeMultiplier, -160, 160);
          const positionDelta = pixelDelta / 150;
          const time = performance.now();
          const elapsed = lastWheelTime ? Math.max(0.016, (time - lastWheelTime) / 1000) : 0.05;
          lastWheelTime = time;

          wheelVelocity = clampValue(wheelVelocity * 0.35 + (positionDelta / elapsed) * 0.65, -8, 8);
          render(boundedWithResistance(position + positionDelta));

          wheelTimer = window.setTimeout(() => {
            wheelTimer = 0;
            animateTo(position + wheelVelocity * 0.12, wheelVelocity, true);
            wheelVelocity = 0;
            lastWheelTime = 0;
          }, 72);
        },
        { passive: false },
      );

      viewport.addEventListener("keydown", (event) => {
        const current = clampValue(Math.round(position), 0, maximumIndex);
        let requestedIndex;

        switch (event.key) {
          case "ArrowUp":
            requestedIndex = current - 1;
            break;
          case "ArrowDown":
            requestedIndex = current + 1;
            break;
          case "PageUp":
            requestedIndex = current - 2;
            break;
          case "PageDown":
            requestedIndex = current + 2;
            break;
          case "Home":
            requestedIndex = 0;
            break;
          case "End":
            requestedIndex = maximumIndex;
            break;
          default:
            return;
        }

        event.preventDefault();
        resetWheel();
        animateTo(requestedIndex, 0, true);
      });

      if (typeof ResizeObserver !== "undefined") {
        const resizeObserver = new ResizeObserver((entries) => {
          heightScale = (entries[0]?.contentRect.height || viewport.clientHeight || 591) / 591;
          render(position);
        });
        resizeObserver.observe(viewport);
      }

      const handleMotionPreference = () => {
        if (!reducedMotion.matches) return;
        resetWheel();
        stopAnimation();
        commit(position, false);
      };
      reducedMotion.addEventListener?.("change", handleMotionPreference);

      commit(position, false);
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
    initLengthPicker(root);
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
