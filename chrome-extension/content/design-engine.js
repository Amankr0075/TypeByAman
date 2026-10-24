/**
 * TypeByAman — Autonomous Human Design Engine
 * Author: Aman Kumar | github.com/Amankr0075
 *
 * Simulates hours of realistic human design activity on web-based
 * design tools (Canva, Figma, Adobe Express, Photoshop web, Picsart, Pixlr, etc.)
 *
 * Key Capabilities:
 *  - 100% Single-Pointer Lock: Browser native cursor hidden via `cursor: none !important;`
 *    so NO TWO CURSORS ever appear on screen or screen recordings.
 *  - High-Fidelity SVG Pointer with dynamic click depression & smooth physics.
 *  - Visual Click Halos: Animated expanding ripples on clicks, dual ripples on double-clicks,
 *    and persistent glowing drag halos during moves and shape drawing.
 *  - Rich Human Design Operations:
 *      * Changing colors & swatch palette exploration
 *      * Editing text with human keystroke intervals, typos & auto-correction
 *      * Changing canvas & artboard backgrounds (solid & gradients)
 *      * Adding shapes, graphics & stickers from sidebar
 *      * Rotating elements via circular arc drag on rotation handles
 *      * Layer ordering & precision alignment
 *      * Human undo/redo exploration cycles (Ctrl+Z / Ctrl+Shift+Z)
 *      * Zoom & detail inspection passes
 *  - Micro-pauses and variable thinking breaks mimicking authentic human designers.
 */

'use strict';

(function () {
  // ─── Guard: prevent double-injection ───────────────────────────────────────
  if (window.__tbaDesignEngine) return;
  window.__tbaDesignEngine = true;

  // ─── State ─────────────────────────────────────────────────────────────────

  const designState = {
    running: false,
    paused: false,
    abortController: null,
    sessionStartTime: null,
    totalPausedTime: 0,
    pauseStartTime: null,
    sessionDuration: 60 * 60 * 1000, // 1 hour in ms
    pauseResolve: null,
    totalActions: 0,
    platform: 'unknown',
    lastAction: null,
    cursorSpeed: 1.0,      // Multiplier (0.4 to 3.5), default 1.0 (Normal)
    operationSpeed: 1.0,   // Multiplier (0.4 to 4.0), default 1.0 (Normal)
  };

  function parseSpeed(val, defaultVal = 1.0) {
    if (typeof val === 'number' && !isNaN(val)) return Math.max(0.2, Math.min(5.0, val));
    if (typeof val === 'string') {
      const s = val.toLowerCase().trim();
      if (s === 'slow' || s === 'very slow') return 0.6;
      if (s === 'normal') return 1.0;
      if (s === 'fast') return 1.8;
      if (s === 'very-fast' || s === 'very fast' || s === 'turbo') return 2.8;
      const num = parseFloat(s);
      if (!isNaN(num) && num > 0) return Math.max(0.2, Math.min(5.0, num));
    }
    return defaultVal;
  }

  function getCursorMult() {
    return Math.max(0.3, parseSpeed(designState.cursorSpeed, 1.0));
  }

  function getOpMult() {
    return Math.max(0.3, parseSpeed(designState.operationSpeed, 1.0));
  }

  // ─── Platform Detection ─────────────────────────────────────────────────────

  const PLATFORM_SIGNATURES = [
    { name: 'canva', test: () => location.hostname.includes('canva.com') },
    { name: 'figma', test: () => location.hostname.includes('figma.com') },
    { name: 'adobe-express', test: () => location.hostname.includes('express.adobe.com') || location.hostname.includes('adobeexpress.com') },
    { name: 'photoshop-web', test: () => location.hostname.includes('photoshop.adobe.com') },
    { name: 'picsart', test: () => location.hostname.includes('picsart.com') },
    { name: 'pixlr', test: () => location.hostname.includes('pixlr.com') },
    { name: 'vectr', test: () => location.hostname.includes('vectr.com') },
    { name: 'gravit', test: () => location.hostname.includes('designer.gravit.io') },
    { name: 'generic-canvas', test: () => !!document.querySelector('canvas') },
  ];

  function detectPlatform() {
    for (const sig of PLATFORM_SIGNATURES) {
      if (sig.test()) return sig.name;
    }
    return 'generic';
  }

  // ─── Utilities ──────────────────────────────────────────────────────────────

  /** Abortable and pause-aware sleep */
  async function sleep(ms, signal) {
    if (ms <= 0) return;
    const start = Date.now();
    while (Date.now() - start < ms) {
      if (signal?.aborted) throw new DOMException('Design mode aborted', 'AbortError');
      await waitIfPaused(signal);
      if (signal?.aborted) throw new DOMException('Design mode aborted', 'AbortError');
      const elapsed = Date.now() - start;
      const remaining = ms - elapsed;
      if (remaining <= 0) break;
      const slice = Math.min(35, remaining);
      await new Promise((resolve) => {
        const id = setTimeout(resolve, slice);
        if (signal) {
          signal.addEventListener('abort', () => {
            clearTimeout(id);
            resolve();
          }, { once: true });
        }
      });
    }
  }

  /** Wait if paused */
  async function waitIfPaused(signal) {
    while (designState.paused && !signal?.aborted) {
      await new Promise(resolve => { designState.pauseResolve = resolve; });
    }
    if (signal?.aborted) {
      throw new DOMException('Design mode aborted', 'AbortError');
    }
  }

  /** Random int between [min, max] inclusive */
  function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /** Random float between [min, max] */
  function randf(min, max) {
    return Math.random() * (max - min) + min;
  }

  /** Pick a random item from an array */
  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /** Find first visible element matching one of the selectors */
  function findVisible(selectors) {
    for (const sel of selectors) {
      try {
        const els = Array.from(document.querySelectorAll(sel));
        const visible = els.find(el => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });
        if (visible) return visible;
      } catch (_) { /* skip invalid selector */ }
    }
    return null;
  }

  /** Get center coordinates of a DOM element */
  function center(el) {
    const r = el.getBoundingClientRect();
    return {
      x: r.left + r.width / 2,
      y: r.top + r.height / 2,
    };
  }

  /** Get the main canvas / editable workspace area */
  function getWorkspaceRect() {
    const candidates = [
      'canvas',
      '[class*="canvas"]',
      '[class*="workspace"]',
      '[class*="artboard"]',
      '[class*="editor-canvas"]',
      '[class*="design-canvas"]',
      '[data-testid*="canvas"]',
      '[data-testid*="artboard"]',
      '.stage',
      '#canvas',
      '#artboard',
    ];
    for (const sel of candidates) {
      try {
        const el = document.querySelector(sel);
        if (el) {
          const r = el.getBoundingClientRect();
          if (r.width > 120 && r.height > 120) return r;
        }
      } catch (_) { }
    }
    return {
      left: 60,
      top: 70,
      right: window.innerWidth - 60,
      bottom: window.innerHeight - 50,
      width: window.innerWidth - 120,
      height: window.innerHeight - 120,
    };
  }

  /** Random point within a DOMRect (with safety margin) */
  function randomPointIn(rect, margin = 25) {
    return {
      x: randf(rect.left + margin, rect.right - margin),
      y: randf(rect.top + margin, rect.bottom - margin),
    };
  }

  // ─── Single-Cursor & Click Halo System ──────────────────────────────────────
  // Guarantees:
  //  1. Browser native cursor is 100% hidden so NO TWO MOUSE POINTERS appear.
  //  2. Only ONE single crisp OS-style SVG pointer is rendered.
  //  3. Physical mouse movement seamlessly syncs with this single pointer.
  //  4. Every click and drag produces visible, professional ripple halos.

  let _cursorX = window.innerWidth / 2;
  let _cursorY = window.innerHeight / 2;
  let _cursorContainer = null;
  let _pointerEl = null;
  let _dragHaloEl = null;
  let _styleEl = null;
  let _physicalMouseMoveHandler = null;

  function initCursorOverlay() {
    if (document.getElementById('tba-design-style')) return;

    // 1. Enforce cursor: none across everything to eliminate the second pointer
    _styleEl = document.createElement('style');
    _styleEl.id = 'tba-design-style';
    _styleEl.textContent = `
      html.tba-design-active,
      html.tba-design-active *,
      html.tba-design-active *::before,
      html.tba-design-active *::after {
        cursor: none !important;
      }

      #tba-cursor-container {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        pointer-events: none !important;
        z-index: 2147483647 !important;
        overflow: hidden !important;
      }

      .tba-virtual-pointer {
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        width: 24px !important;
        height: 24px !important;
        pointer-events: none !important;
        transform-origin: 0 0 !important;
        transform: translate3d(50vw, 50vh, 0) scale(1);
        transition: transform 0.04s cubic-bezier(0, 0, 0.2, 1);
        will-change: transform;
        filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5));
      }

      .tba-click-halo {
        position: absolute !important;
        border-radius: 50% !important;
        pointer-events: none !important;
        transform: translate(-50%, -50%) scale(0.25);
        animation: tbaHaloPulse 0.42s cubic-bezier(0.16, 1, 0.3, 1) forwards !important;
        will-change: transform, opacity;
        background: radial-gradient(circle, rgba(59, 130, 246, 0.3) 0%, rgba(37, 99, 235, 0.1) 60%, transparent 100%) !important;
        border: 2.5px solid rgba(59, 130, 246, 0.95) !important;
        box-shadow: 0 0 12px rgba(59, 130, 246, 0.6), inset 0 0 6px rgba(59, 130, 246, 0.35) !important;
      }

      .tba-click-halo.tba-halo-secondary {
        border-color: rgba(168, 85, 247, 0.95) !important;
        background: radial-gradient(circle, rgba(168, 85, 247, 0.3) 0%, transparent 100%) !important;
        box-shadow: 0 0 12px rgba(168, 85, 247, 0.6) !important;
        animation-duration: 0.48s !important;
      }

      .tba-click-halo.tba-halo-amber {
        border-color: rgba(245, 158, 11, 0.95) !important;
        background: radial-gradient(circle, rgba(245, 158, 11, 0.3) 0%, transparent 100%) !important;
        box-shadow: 0 0 12px rgba(245, 158, 11, 0.6) !important;
      }

      @keyframes tbaHaloPulse {
        0% {
          transform: translate(-50%, -50%) scale(0.2);
          opacity: 0.95;
          border-width: 3.5px;
        }
        50% {
          opacity: 0.8;
        }
        100% {
          transform: translate(-50%, -50%) scale(2.6);
          opacity: 0;
          border-width: 1px;
        }
      }

      .tba-drag-halo {
        position: absolute !important;
        width: 26px !important;
        height: 26px !important;
        border-radius: 50% !important;
        pointer-events: none !important;
        transform: translate(-50%, -50%) scale(1);
        background: radial-gradient(circle, rgba(59, 130, 246, 0.45) 0%, rgba(37, 99, 235, 0.15) 70%, transparent 100%) !important;
        border: 2px solid rgba(96, 165, 250, 0.9) !important;
        box-shadow: 0 0 14px rgba(59, 130, 246, 0.7) !important;
        animation: tbaDragBreath 0.75s ease-in-out infinite alternate !important;
        will-change: transform, opacity;
      }

      @keyframes tbaDragBreath {
        from { transform: translate(-50%, -50%) scale(0.85); opacity: 0.75; }
        to   { transform: translate(-50%, -50%) scale(1.3);  opacity: 1; }
      }
    `;
    (document.head || document.documentElement).appendChild(_styleEl);
    document.documentElement.classList.add('tba-design-active');

    // 2. Inject single virtual cursor container
    _cursorContainer = document.createElement('div');
    _cursorContainer.id = 'tba-cursor-container';

    _pointerEl = document.createElement('div');
    _pointerEl.className = 'tba-virtual-pointer';
    // Authentic OS arrow with tip hot-spot strictly at (0, 0)
    _pointerEl.innerHTML = `
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M0 0L0 17.5L4.5 13.5L8.5 21.5L11.5 20L7.5 12.2L13.5 12L0 0Z" fill="#0f172a" stroke="#000000" stroke-width="0.8" stroke-linejoin="round"/>
        <path d="M1.2 2.2L1.2 15.2L4.8 12.1L8.8 19.8L10.2 19.1L6.2 11.5L11.2 11.3L1.2 2.2Z" fill="#ffffff"/>
      </svg>
    `;
    _cursorContainer.appendChild(_pointerEl);
    (document.body || document.documentElement).appendChild(_cursorContainer);

    renderCursorPosition(_cursorX, _cursorY, false);

    // 3. Keep single-cursor in sync if user moves physical mouse
    _physicalMouseMoveHandler = (e) => {
      _cursorX = e.clientX;
      _cursorY = e.clientY;
      renderCursorPosition(_cursorX, _cursorY, false);
    };
    window.addEventListener('mousemove', _physicalMouseMoveHandler, { passive: true, capture: true });
  }

  function destroyCursorOverlay() {
    document.documentElement.classList.remove('tba-design-active');
    if (_styleEl && _styleEl.parentNode) _styleEl.parentNode.removeChild(_styleEl);
    _styleEl = null;

    if (_cursorContainer && _cursorContainer.parentNode) _cursorContainer.parentNode.removeChild(_cursorContainer);
    _cursorContainer = null;
    _pointerEl = null;
    _dragHaloEl = null;

    if (_physicalMouseMoveHandler) {
      window.removeEventListener('mousemove', _physicalMouseMoveHandler, { capture: true });
      _physicalMouseMoveHandler = null;
    }
  }

  /** Render position and depression scale of the virtual cursor */
  function renderCursorPosition(x, y, depressed = false) {
    if (!_pointerEl) return;
    const scale = depressed ? 0.86 : 1;
    _pointerEl.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
  }

  /** Spawn an expanding ripple halo at click coordinates */
  function showClickHalo(x, y, styleVariant = 'blue', size = 34) {
    if (!_cursorContainer) return;
    const halo = document.createElement('div');
    halo.className = `tba-click-halo ${styleVariant === 'purple' ? 'tba-halo-secondary' :
        styleVariant === 'amber' ? 'tba-halo-amber' : ''
      }`;
    halo.style.left = `${x}px`;
    halo.style.top = `${y}px`;
    halo.style.width = `${size}px`;
    halo.style.height = `${size}px`;
    _cursorContainer.appendChild(halo);
    setTimeout(() => {
      if (halo.parentNode) halo.parentNode.removeChild(halo);
    }, 500);
  }

  /** Update or toggle the continuous drag halo */
  function updateDragHalo(x, y, active) {
    if (!_cursorContainer) return;
    if (!active) {
      if (_dragHaloEl && _dragHaloEl.parentNode) {
        _dragHaloEl.parentNode.removeChild(_dragHaloEl);
      }
      _dragHaloEl = null;
      return;
    }
    if (!_dragHaloEl) {
      _dragHaloEl = document.createElement('div');
      _dragHaloEl.className = 'tba-drag-halo';
      _cursorContainer.appendChild(_dragHaloEl);
    }
    _dragHaloEl.style.left = `${x}px`;
    _dragHaloEl.style.top = `${y}px`;
  }

  // ─── Low-Level Event Dispatch ────────────────────────────────────────────────

  function dispatchMouse(type, x, y, options = {}) {
    const el = document.elementFromPoint(x, y) || document.body;
    const ev = new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: x,
      clientY: y,
      screenX: x + window.screenX,
      screenY: y + window.screenY,
      buttons: options.buttons ?? (type === 'mousedown' || (type === 'mousemove' && options.dragging) ? 1 : 0),
      button: 0,
      ...options,
    });
    el.dispatchEvent(ev);
    return el;
  }

  function dispatchPointer(type, x, y, options = {}) {
    const el = document.elementFromPoint(x, y) || document.body;
    const ev = new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: x,
      clientY: y,
      screenX: x + window.screenX,
      screenY: y + window.screenY,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      pressure: options.pressure ?? (type === 'pointermove' && options.dragging ? 0.5 : 0),
      buttons: options.buttons ?? (type === 'pointerdown' || (type === 'pointermove' && options.dragging) ? 1 : 0),
      ...options,
    });
    el.dispatchEvent(ev);
    return el;
  }

  function dispatchKeyboard(type, key, options = {}) {
    const el = document.activeElement || document.body;
    const ev = new KeyboardEvent(type, {
      bubbles: true,
      cancelable: true,
      key,
      code: options.code || (key.length === 1 ? `Key${key.toUpperCase()}` : key),
      ctrlKey: options.ctrlKey || false,
      shiftKey: options.shiftKey || false,
      altKey: options.altKey || false,
      metaKey: options.metaKey || false,
      ...options,
    });
    el.dispatchEvent(ev);
  }

  function dispatchWheel(x, y, deltaX, deltaY, ctrlKey = false) {
    const el = document.elementFromPoint(x, y) || document.body;
    const ev = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      deltaX,
      deltaY,
      deltaMode: 0,
      ctrlKey,
    });
    el.dispatchEvent(ev);
  }

  // ─── Human Cursor Movement ───────────────────────────────────────────────────
  // Moves the virtual cursor with organic non-linear speed variation,
  // asymmetric bell-curve velocity, acceleration, decelerating target-homing, and micro-tremor.
  // Dynamic cursor speed is configurable via cursorSpeed (Slow, Normal, Fast, Very Fast/Custom).

  async function moveCursorTo(toX, toY, signal, options = {}) {
    const fromX = _cursorX;
    const fromY = _cursorY;
    const dist = Math.hypot(toX - fromX, toY - fromY);
    if (dist < 0.5) {
      _cursorX = toX;
      _cursorY = toY;
      renderCursorPosition(toX, toY, false);
      return;
    }

    const cMult = getCursorMult();

    // Natural human designer pacing scaled by cursorSpeed multiplier
    // Normal (1.0x): 240ms–580ms for typical moves; Fast (1.8x): ~140ms–320ms; Very Fast (2.8x): ~80ms–190ms
    const rawDuration = options.fast
      ? rand(150, 280)
      : Math.round(240 + Math.pow(dist, 0.54) * randf(9, 16) + rand(50, 140));
    const baseDuration = Math.max(50, Math.round(rawDuration / cMult));

    // Steps adapted to speed for fluid rendering without lag
    const maxSteps = cMult > 2.0 ? 40 : (cMult > 1.3 ? 60 : 90);
    const minSteps = cMult > 2.0 ? 10 : 16;
    const steps = Math.max(minSteps, Math.min(maxSteps, Math.floor(dist / (3.2 * Math.sqrt(cMult)))));

    // Curved Bezier trajectory with natural human curvature
    const curvature = randf(0.08, 0.22) * (Math.random() < 0.5 ? 1 : -1);
    const midX = (fromX + toX) / 2;
    const midY = (fromY + toY) / 2;
    const normalX = -(toY - fromY) / (dist || 1);
    const normalY = (toX - fromX) / (dist || 1);
    const cpX = midX + normalX * dist * curvature + randf(-6, 6);
    const cpY = midY + normalY * dist * curvature + randf(-6, 6);

    // Dynamic velocity persona for this stroke to ensure zero predictability:
    const rhythmType = pick(['bell', 'front-loaded', 'back-loaded', 'hesitant']);
    const speedSineFreq = randf(2.0, 4.5);
    const speedSineAmp = randf(0.18, 0.36);

    for (let s = 1; s <= steps; s++) {
      if (signal?.aborted) return;
      await waitIfPaused(signal);
      if (signal?.aborted) return;

      const t = s / steps;

      // Asymmetric human velocity curve
      let v;
      if (rhythmType === 'front-loaded') {
        v = Math.sin(Math.pow(t, 0.75) * Math.PI);
      } else if (rhythmType === 'back-loaded') {
        v = Math.sin(Math.pow(t, 1.35) * Math.PI);
      } else if (rhythmType === 'hesitant' && t > 0.35 && t < 0.65) {
        v = Math.max(0.25, Math.sin(t * Math.PI) * 0.6);
      } else {
        v = Math.sin(t * Math.PI);
      }

      // Smooth step easing with sinusoidal variation (never constant velocity)
      const tEased = (1 - Math.cos(t * Math.PI)) / 2;
      const microJitter = randf(-0.5, 0.5);
      const x = (1 - tEased) * (1 - tEased) * fromX + 2 * (1 - tEased) * tEased * cpX + tEased * tEased * toX + microJitter;
      const y = (1 - tEased) * (1 - tEased) * fromY + 2 * (1 - tEased) * tEased * cpY + tEased * tEased * toY + microJitter;

      dispatchPointer('pointermove', x, y);
      dispatchMouse('mousemove', x, y);
      _cursorX = x;
      _cursorY = y;
      renderCursorPosition(x, y, false);

      // Dynamically varied step delay: non-constant rhythm throughout
      const velocityMod = Math.max(0.24, (v * (1 + Math.sin(t * Math.PI * speedSineFreq) * speedSineAmp)));
      const baseStepDelay = baseDuration / steps;
      const dynamicStepDelay = (baseStepDelay / velocityMod) * randf(0.85, 1.2);

      await sleep(Math.max(3, Math.round(dynamicStepDelay)), signal);
    }

    _cursorX = toX;
    _cursorY = toY;
    renderCursorPosition(toX, toY, false);
  }

  // ─── Atomic Actions with Visible Click & Drag Feedback ───────────────────────

  /** Move to point, depress cursor, spawn click ripple halo, dispatch click */
  async function clickAt(x, y, signal, opts = {}) {
    await moveCursorTo(x, y, signal, opts);
    if (signal?.aborted) return;
    await waitIfPaused(signal);

    const opMult = getOpMult();

    // Visual feedback: depress cursor and spawn click halo
    renderCursorPosition(x, y, true);
    showClickHalo(x, y, opts.haloVariant || 'blue');

    dispatchPointer('pointerdown', x, y, { buttons: 1 });
    dispatchMouse('mousedown', x, y, { buttons: 1 });
    await sleep(Math.max(15, Math.round(rand(35, 75) / opMult)), signal);

    // Release cursor
    renderCursorPosition(x, y, false);
    dispatchPointer('pointerup', x, y, { buttons: 0 });
    dispatchMouse('mouseup', x, y, { buttons: 0 });
    dispatchMouse('click', x, y);

    if (opts.focus) {
      const el = document.elementFromPoint(x, y);
      if (el && typeof el.focus === 'function') el.focus();
    }

    await sleep(Math.max(20, Math.round(rand(40, 110) / opMult)), signal);
  }

  /** Double-click with dual-stage expanding ripples */
  async function doubleClickAt(x, y, signal) {
    await clickAt(x, y, signal, { haloVariant: 'blue' });
    if (signal?.aborted) return;
    const opMult = getOpMult();
    await sleep(Math.max(20, Math.round(rand(45, 90) / opMult)), signal);
    if (signal?.aborted) return;

    // Second click pulse with secondary halo
    renderCursorPosition(x, y, true);
    showClickHalo(x, y, 'purple', 40);

    dispatchPointer('pointerdown', x, y, { buttons: 1 });
    dispatchMouse('mousedown', x, y, { buttons: 1 });
    await sleep(Math.max(15, Math.round(rand(30, 65) / opMult)), signal);

    renderCursorPosition(x, y, false);
    dispatchPointer('pointerup', x, y, { buttons: 0 });
    dispatchMouse('mouseup', x, y, { buttons: 0 });
    dispatchMouse('click', x, y);
    dispatchMouse('dblclick', x, y);
    await sleep(Math.max(25, Math.round(rand(50, 130) / opMult)), signal);
  }

  /** Drag with continuous glowing drag halo and organic variable speed */
  async function dragFrom(fromX, fromY, toX, toY, signal, opts = {}) {
    await moveCursorTo(fromX, fromY, signal);
    if (signal?.aborted) return;
    await waitIfPaused(signal);

    const cMult = getCursorMult();
    const opMult = getOpMult();

    // Press down & activate drag halo
    renderCursorPosition(fromX, fromY, true);
    showClickHalo(fromX, fromY, 'blue', 28);
    updateDragHalo(fromX, fromY, true);

    dispatchPointer('pointerdown', fromX, fromY, { buttons: 1 });
    dispatchMouse('mousedown', fromX, fromY, { buttons: 1 });
    await sleep(Math.max(25, Math.round(rand(65, 140) / opMult)), signal);
    if (signal?.aborted) {
      updateDragHalo(0, 0, false);
      renderCursorPosition(fromX, fromY, false);
      return;
    }

    const dist = Math.hypot(toX - fromX, toY - fromY);
    const maxSteps = cMult > 2.0 ? 38 : (cMult > 1.3 ? 55 : 80);
    const steps = Math.max(12, Math.min(maxSteps, Math.floor(dist / (3.4 * Math.sqrt(cMult)))));
    const cpX = (fromX + toX) / 2 + randf(-dist * 0.12, dist * 0.12);
    const cpY = (fromY + toY) / 2 + randf(-dist * 0.12, dist * 0.12);

    // Deliberate human drag duration scaled by cursorSpeed
    const rawDragDuration = opts.fast
      ? rand(260, 480)
      : Math.round(420 + Math.pow(dist, 0.54) * randf(11, 20) + rand(90, 220));
    const dragDuration = Math.max(70, Math.round(rawDragDuration / cMult));

    for (let s = 1; s <= steps; s++) {
      if (signal?.aborted) {
        updateDragHalo(0, 0, false);
        renderCursorPosition(_cursorX, _cursorY, false);
        return;
      }
      await waitIfPaused(signal);
      if (signal?.aborted) return;

      const t = s / steps;
      // Smooth human ease-in-out with deceleration near alignment point
      const tEased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      const x = (1 - tEased) * (1 - tEased) * fromX + 2 * (1 - tEased) * tEased * cpX + tEased * tEased * toX + randf(-0.6, 0.6);
      const y = (1 - tEased) * (1 - tEased) * fromY + 2 * (1 - tEased) * tEased * cpY + tEased * tEased * toY + randf(-0.6, 0.6);

      dispatchPointer('pointermove', x, y, { buttons: 1, dragging: true, pressure: 0.5 });
      dispatchMouse('mousemove', x, y, { buttons: 1, dragging: true });
      _cursorX = x;
      _cursorY = y;
      renderCursorPosition(x, y, true);
      updateDragHalo(x, y, true);

      // Non-constant variable drag step delay
      const v = Math.max(0.3, Math.sin(t * Math.PI) * (1 + Math.sin(t * Math.PI * 3) * 0.22));
      const stepDelay = (dragDuration / steps) * (1 / v) * randf(0.85, 1.2);
      await sleep(Math.max(3, Math.round(stepDelay)), signal);
    }

    if (signal?.aborted) {
      updateDragHalo(0, 0, false);
      renderCursorPosition(_cursorX, _cursorY, false);
      return;
    }

    // Release mouse and deactivate drag halo
    await sleep(Math.max(20, Math.round(rand(45, 100) / opMult)), signal);
    renderCursorPosition(toX, toY, false);
    updateDragHalo(0, 0, false);
    showClickHalo(toX, toY, 'purple', 32);
    dispatchPointer('pointerup', toX, toY, { buttons: 0 });
    dispatchMouse('mouseup', toX, toY, { buttons: 0 });
    _cursorX = toX;
    _cursorY = toY;
    await sleep(Math.max(25, Math.round(rand(50, 130) / opMult)), signal);
  }

  /** Press a keyboard shortcut */
  async function pressShortcut(key, mods = {}, signal) {
    const opts = { ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, ...mods };
    const code = key.length === 1 ? `Key${key.toUpperCase()}` : key;
    const opMult = getOpMult();
    dispatchKeyboard('keydown', key, { ...opts, code });
    await sleep(Math.max(15, Math.round(rand(25, 65) / opMult)), signal);
    dispatchKeyboard('keyup', key, { ...opts, code });
    await sleep(Math.max(20, Math.round(rand(30, 80) / opMult)), signal);
  }

  /** Scroll or zoom on canvas */
  async function scrollCanvas(signal, zoom = false) {
    const ws = getWorkspaceRect();
    const x = randf(ws.left + 80, ws.right - 80);
    const y = randf(ws.top + 50, ws.bottom - 50);
    const opMult = getOpMult();

    await moveCursorTo(x, y, signal, { fast: true });
    if (signal.aborted) return;

    const steps = rand(3, 6);
    for (let i = 0; i < steps; i++) {
      if (signal.aborted) return;
      const delta = randf(-80, 80);
      dispatchWheel(x, y, 0, delta, zoom);
      await sleep(Math.max(20, Math.round(rand(30, 80) / opMult)), signal);
    }
  }

  // ─── Thinking Pauses ────────────────────────────────────────────────────────
  // Authentic hesitation and inspection pauses mimicking real design cognition.
  // Scaled dynamically by operationSpeed.

  async function thinkingPause(signal, type = 'short') {
    await waitIfPaused();
    if (signal.aborted) return;

    const opMult = getOpMult();
    let rawMs;
    switch (type) {
      case 'micro': rawMs = rand(90, 240); break;
      case 'short': rawMs = rand(300, 800); break;
      case 'medium': rawMs = rand(800, 1800); break;
      case 'long': rawMs = rand(1800, 4200); break;
      case 'idle': rawMs = rand(4000, 8500); break;
      default: rawMs = rand(250, 700);
    }
    const ms = Math.max(30, Math.round(rawMs / opMult));

    if ((type === 'long' || type === 'idle') && opMult < 1.8) {
      const cycles = rand(2, 3);
      const ws = getWorkspaceRect();
      for (let i = 0; i < cycles && !signal.aborted; i++) {
        const pt = randomPointIn(ws, 40);
        await moveCursorTo(pt.x, pt.y, signal, { fast: false });
        await sleep(Math.max(25, Math.round(rand(ms / cycles * 0.4, ms / cycles * 0.9))), signal);
      }
    } else {
      await sleep(ms, signal);
    }
  }

  // ─── Specialized Human Design Operations ─────────────────────────────────────

  /**
   * 1. Changing Colour:
   * Selects an element, opens color swatch/palette, browses hues, applies new color.
   */
  async function actionChangeColor(signal) {
    const ws = getWorkspaceRect();

    // Step A: Select an element on the canvas first
    const pt = randomPointIn(ws, 50);
    await clickAt(pt.x, pt.y, signal, { focus: true });
    if (signal.aborted) return;
    await thinkingPause(signal, 'micro');

    // Step B: Locate a color swatch or inspector fill button
    const colorBtn = findVisible([
      '[class*="color-swatch"]',
      '[class*="colorPicker"]',
      '[class*="color-picker"]',
      '[class*="fill-picker"]',
      '[data-testid*="color"]',
      '[aria-label*="Color" i]',
      '[aria-label*="Fill" i]',
      '[class*="palette"]',
      '[class*="swatch"]',
    ]);

    let swatchX, swatchY;
    if (colorBtn) {
      const c = center(colorBtn);
      swatchX = c.x;
      swatchY = c.y;
    } else {
      // Realistic UI coordinates: top toolbar or right inspector panel
      if (Math.random() < 0.5) {
        swatchX = randf(180, 360);
        swatchY = randf(52, 78);
      } else {
        swatchX = randf(window.innerWidth - 220, window.innerWidth - 40);
        swatchY = randf(140, 290);
      }
    }

    // Click color swatch (showing ripple halo)
    await clickAt(swatchX, swatchY, signal, { haloVariant: 'amber' });
    if (signal.aborted) return;
    await thinkingPause(signal, 'short');

    // Step C: Move across color palette swatches like human deciding
    const paletteBaseX = swatchX + randf(-60, 60);
    const paletteBaseY = Math.min(window.innerHeight - 80, swatchY + randf(60, 160));

    // Hover over 1-2 swatches
    await moveCursorTo(paletteBaseX + randf(-30, 30), paletteBaseY + randf(-20, 20), signal);
    await sleep(rand(180, 420), signal);

    // Pick new color swatch with visible click
    await clickAt(paletteBaseX + randf(-40, 40), paletteBaseY + randf(-30, 30), signal, { haloVariant: 'purple' });
    if (signal.aborted) return;

    // 35% chance to tweak hue or opacity slider slightly
    if (Math.random() < 0.35) {
      await sleep(rand(150, 300), signal);
      const sliderX = paletteBaseX + randf(-40, 40);
      const sliderY = paletteBaseY + 50;
      await dragFrom(sliderX, sliderY, sliderX + randf(-25, 25), sliderY, signal, { fast: true });
    }

    // Step D: Dismiss palette (click canvas or press Escape)
    await sleep(rand(200, 500), signal);
    if (Math.random() < 0.6) {
      await clickAt(randf(ws.left + 40, ws.right - 40), randf(ws.top + 40, ws.bottom - 40), signal);
    } else {
      await pressShortcut('Escape', {}, signal);
    }

    // Thinking pause: designer admiring the updated color composition
    await thinkingPause(signal, 'medium');
    designState.totalActions++;
  }

  /**
   * 2. Edit Texts:
   * Double-clicks text box, selects all, types modern design copy with realistic
   * human keystrokes, occasional typos & backspace corrections, and formatting.
   */
  async function actionEditText(signal) {
    const ws = getWorkspaceRect();
    const pt = randomPointIn(ws, 70);

    // Double click to enter text edit mode (shows double halo)
    await doubleClickAt(pt.x, pt.y, signal);
    if (signal.aborted) return;
    await thinkingPause(signal, 'micro');

    // 40% chance to select all old text
    if (Math.random() < 0.4) {
      await pressShortcut('a', { ctrlKey: true }, signal);
      await sleep(rand(120, 300), signal);
    }

    // Rich catalog of realistic human graphic design texts
    const designTexts = [
      'SUMMER COLLECTION 2026',
      'NEW ARRIVALS NOW LIVE',
      'MINIMALIST DESIGN STUDIO',
      'ANNUAL CREATIVE REPORT',
      'SPECIAL OFFER 50% OFF',
      'ELEVATE YOUR VISION',
      'CRAFTED WITH PRECISION',
      'PREMIUM QUALITY GEAR',
      'DISCOVER THE HORIZON',
      'LIMITED EDITION DROP',
      'EXPLORE MODERN ARCHITECTURE',
      'Join over 100,000 satisfied creators worldwide',
      'Designed for creators, engineers, and visionaries',
      'Exclusive handmade collection available online now',
      'Shop Exclusive Collection →',
      'Explore Our Portfolio',
      'Get Started Today',
      'Read Full Case Study',
    ];

    const sample = pick(designTexts);
    const charsToType = rand(Math.min(5, sample.length), sample.length);

    // Realistic variable typing cadence: alternate fast burst words and deliberate words
    let inFastBurst = Math.random() < 0.4;
    for (let i = 0; i < charsToType && !signal.aborted; i++) {
      await waitIfPaused(signal);
      if (signal.aborted) break;

      const char = sample[i];
      if (char === ' ') {
        inFastBurst = Math.random() < 0.45;
      }

      // 15% chance of making a 1-character typo, noticing, and correcting!
      if (Math.random() < 0.15 && i > 1) {
        const typoChar = String.fromCharCode(char.charCodeAt(0) + rand(-1, 1));
        dispatchKeyboard('keydown', typoChar);
        await sleep(rand(35, 75), signal);
        dispatchKeyboard('keyup', typoChar);

        // Human hesitation upon noticing the typo
        await sleep(rand(200, 420), signal);

        // Hit backspace to delete the mistaken character
        dispatchKeyboard('keydown', 'Backspace', { code: 'Backspace' });
        await sleep(rand(35, 75), signal);
        dispatchKeyboard('keyup', 'Backspace', { code: 'Backspace' });
        await sleep(rand(120, 240), signal);
      }

      // Type correct character with varied velocity
      const keyPressDuration = inFastBurst ? rand(25, 60) : rand(55, 110);
      dispatchKeyboard('keydown', char);
      await sleep(keyPressDuration, signal);
      dispatchKeyboard('keyup', char);

      // Variable inter-keystroke intervals (fast burst words type quickly; others vary)
      let pauseMs = inFastBurst ? rand(25, 65) : rand(65, 160);
      if (char === ' ') pauseMs += rand(80, 220);
      if (char === ',' || char === '.') pauseMs += rand(200, 450);
      await sleep(pauseMs, signal);
    }

    // 35% chance to toggle Bold (Ctrl+B) or Italic (Ctrl+I)
    if (Math.random() < 0.35 && !signal.aborted) {
      await sleep(rand(150, 350), signal);
      const styleKey = Math.random() < 0.7 ? 'b' : 'i';
      await pressShortcut(styleKey, { ctrlKey: true }, signal);
    }

    // Exit text editing mode
    await sleep(rand(200, 500), signal);
    if (Math.random() < 0.5) {
      await pressShortcut('Escape', {}, signal);
    } else {
      // Click outside text element on canvas
      await clickAt(randf(ws.left + 20, ws.right - 20), randf(ws.top + 20, ws.bottom - 20), signal);
    }

    await thinkingPause(signal, 'short');
    designState.totalActions++;
  }

  /**
   * 3. Changing Background:
   * Selects artboard boundary/canvas margin, opens background palette, applies new tone.
   */
  async function actionChangeBackground(signal) {
    const ws = getWorkspaceRect();

    // Step A: Click outer canvas margin to select background layer
    const marginX = Math.random() < 0.5 ? ws.left + randf(10, 30) : ws.right - randf(10, 30);
    const marginY = ws.top + randf(15, 60);
    await clickAt(marginX, marginY, signal, { haloVariant: 'amber' });
    if (signal.aborted) return;
    await thinkingPause(signal, 'micro');

    // Step B: Target background toolbar tab or sidebar icon
    const bgControl = findVisible([
      '[aria-label*="Background" i]',
      '[data-testid*="background" i]',
      '[class*="background-tab"]',
      '[class*="background-picker"]',
      '[class*="page-background"]',
    ]);

    if (bgControl) {
      const c = center(bgControl);
      await clickAt(c.x, c.y, signal, { haloVariant: 'purple' });
    } else {
      // Realistic background tab location on left sidebar or top property strip
      if (Math.random() < 0.6) {
        await clickAt(randf(18, 50), randf(240, 380), signal, { haloVariant: 'purple' });
      } else {
        await clickAt(randf(180, 320), randf(50, 75), signal, { haloVariant: 'purple' });
      }
    }

    await thinkingPause(signal, 'short');

    // Step C: Click a background preset/gradient swatch in sidebar/popover
    const swatchX = randf(90, 220);
    const swatchY = randf(150, 380);
    await clickAt(swatchX, swatchY, signal, { haloVariant: 'blue' });
    if (signal.aborted) return;

    // Step D: Return to canvas center and observe background contrast
    await sleep(rand(300, 700), signal);
    await clickAt(ws.left + ws.width / 2 + randf(-50, 50), ws.top + ws.height / 2 + randf(-50, 50), signal);

    await thinkingPause(signal, 'medium');
    designState.totalActions++;
  }

  /**
   * 4. Add Shape, Graphic, or Sticker:
   * Clicks elements tab on sidebar, drags a shape onto canvas, nudges into place.
   */
  async function actionAddShapeOrGraphic(signal) {
    const ws = getWorkspaceRect();

    // Step A: Click "Elements" or "Shapes" tab on left sidebar
    const elementsTab = findVisible([
      '[aria-label*="Elements" i]',
      '[data-testid*="elements" i]',
      '[class*="elements-tab"]',
      '[aria-label*="Shapes" i]',
    ]);

    if (elementsTab) {
      const c = center(elementsTab);
      await clickAt(c.x, c.y, signal, { haloVariant: 'purple' });
    } else {
      // Sidebar icons usually reside in left 8-55px, y 110-240px
      await clickAt(randf(16, 48), randf(110, 220), signal, { haloVariant: 'purple' });
    }

    await thinkingPause(signal, 'short');

    // Step B: Drag a shape from the sidebar panel onto the canvas
    const shapeFromX = randf(100, 220);
    const shapeFromY = randf(160, 360);
    const dropToX = ws.left + randf(ws.width * 0.2, ws.width * 0.7);
    const dropToY = ws.top + randf(ws.height * 0.2, ws.height * 0.7);

    await dragFrom(shapeFromX, shapeFromY, dropToX, dropToY, signal);
    if (signal.aborted) return;

    // Step C: 40% chance to nudge with arrow keys for precision alignment
    if (Math.random() < 0.4) {
      await sleep(rand(100, 250), signal);
      const arrow = pick(['ArrowUp', 'ArrowLeft', 'ArrowRight', 'ArrowDown']);
      for (let i = 0; i < rand(2, 6); i++) {
        dispatchKeyboard('keydown', arrow);
        await sleep(rand(40, 80), signal);
        dispatchKeyboard('keyup', arrow);
        await sleep(rand(30, 70), signal);
      }
    }

    await thinkingPause(signal, 'short');
    designState.totalActions++;
  }

  /**
   * 5. Rotate Element:
   * Selects element, grabs top/bottom rotation handle, drags along circular arc.
   */
  async function actionRotateElement(signal) {
    const ws = getWorkspaceRect();
    const centerX = ws.left + randf(ws.width * 0.25, ws.width * 0.75);
    const centerY = ws.top + randf(ws.height * 0.25, ws.height * 0.75);

    // Click to select element
    await clickAt(centerX, centerY, signal, { focus: true });
    if (signal.aborted) return;
    await thinkingPause(signal, 'micro');

    // Rotation handle is typically 30-45px above or below the selection
    const handleDist = 40;
    const startAngle = -Math.PI / 2; // top handle
    const handleStartX = centerX + Math.cos(startAngle) * handleDist;
    const handleStartY = centerY + Math.sin(startAngle) * handleDist;

    // Target rotation: 15° to 35° arc
    const arcAngle = (rand(15, 35) * Math.PI / 180) * (Math.random() < 0.5 ? 1 : -1);
    const endAngle = startAngle + arcAngle;
    const handleEndX = centerX + Math.cos(endAngle) * handleDist;
    const handleEndY = centerY + Math.sin(endAngle) * handleDist;

    await dragFrom(handleStartX, handleStartY, handleEndX, handleEndY, signal, { fast: true });
    await thinkingPause(signal, 'short');
    designState.totalActions++;
  }

  /**
   * 6. Undo/Redo Exploration:
   * Authentic designer exploration: moves/resizes element, evaluates, undos with Ctrl+Z.
   */
  async function actionUndoRedoExploration(signal) {
    const ws = getWorkspaceRect();
    const from = randomPointIn(ws, 60);
    const to = {
      x: from.x + randf(-90, 90),
      y: from.y + randf(-70, 70),
    };

    // Make an experimental move
    await dragFrom(from.x, from.y, to.x, to.y, signal);
    if (signal.aborted) return;

    // Contemplative thinking pause: evaluating whether this change looks good
    await thinkingPause(signal, 'medium');
    if (signal.aborted) return;

    // Dislike change -> hit Ctrl+Z to undo
    await pressShortcut('z', { ctrlKey: true }, signal);
    await thinkingPause(signal, 'short');

    // 40% chance to hit Ctrl+Shift+Z (redo) or try another nudge
    if (Math.random() < 0.4) {
      await pressShortcut('z', { ctrlKey: true, shiftKey: true }, signal);
      await sleep(rand(300, 600), signal);
    }

    designState.totalActions++;
  }

  /**
   * 7. Zoom & Detail Inspection:
   * Zooms in, inspects fine canvas corners with cursor, pans around, resets zoom.
   */
  async function actionZoomAndInspect(signal) {
    const ws = getWorkspaceRect();

    // Zoom in with Ctrl++
    await pressShortcut('=', { ctrlKey: true }, signal);
    await sleep(rand(200, 400), signal);

    // Slowly inspect 2-3 visual details
    const points = rand(2, 3);
    for (let i = 0; i < points && !signal.aborted; i++) {
      const pt = randomPointIn(ws, 40);
      await moveCursorTo(pt.x, pt.y, signal, { fast: false });
      await sleep(rand(350, 700), signal);
    }

    // Pan with Spacebar + drag
    const panFrom = randomPointIn(ws, 60);
    const panTo = { x: panFrom.x + randf(-120, 120), y: panFrom.y + randf(-80, 80) };
    dispatchKeyboard('keydown', ' ', { code: 'Space' });
    await sleep(60, signal);
    await dragFrom(panFrom.x, panFrom.y, panTo.x, panTo.y, signal, { fast: false });
    dispatchKeyboard('keyup', ' ', { code: 'Space' });

    // Reset zoom with Ctrl+0
    await sleep(rand(300, 600), signal);
    await pressShortcut('0', { ctrlKey: true }, signal);

    await thinkingPause(signal, 'short');
    designState.totalActions++;
  }

  /** Click an element on canvas to select it */
  async function actionSelectElement(signal) {
    const ws = getWorkspaceRect();
    const pt = randomPointIn(ws, 30);
    await clickAt(pt.x, pt.y, signal, { focus: true });
    designState.totalActions++;
  }

  /** Drag an element to a new position */
  async function actionMoveElement(signal) {
    const ws = getWorkspaceRect();
    const from = randomPointIn(ws, 60);
    const to = {
      x: Math.max(ws.left + 20, Math.min(ws.right - 20, from.x + randf(-120, 120))),
      y: Math.max(ws.top + 20, Math.min(ws.bottom - 20, from.y + randf(-80, 80))),
    };
    await dragFrom(from.x, from.y, to.x, to.y, signal);
    designState.totalActions++;
  }

  /** Drag corner handles to resize element */
  async function actionResizeElement(signal) {
    const ws = getWorkspaceRect();
    const baseX = randf(ws.left + 80, ws.right - 80);
    const baseY = randf(ws.top + 80, ws.bottom - 80);
    const size = rand(50, 160);
    const corners = [
      { x: baseX + size, y: baseY + size },
      { x: baseX - size, y: baseY + size },
      { x: baseX + size, y: baseY - size },
      { x: baseX - size, y: baseY - size },
    ];
    const corner = pick(corners);
    const dragTo = {
      x: corner.x + randf(-40, 40),
      y: corner.y + randf(-40, 40),
    };
    await dragFrom(corner.x, corner.y, dragTo.x, dragTo.y, signal, { fast: true });
    designState.totalActions++;
  }

  /** Draw a new shape by click-drag */
  async function actionDrawShape(signal) {
    const ws = getWorkspaceRect();
    const from = randomPointIn(ws, 80);
    const to = {
      x: Math.min(ws.right - 20, from.x + randf(60, 200)),
      y: Math.min(ws.bottom - 20, from.y + randf(40, 160)),
    };
    await dragFrom(from.x, from.y, to.x, to.y, signal, { fast: false });
    await thinkingPause(signal, 'micro');
    designState.totalActions++;
  }

  /** Pixel-nudge with arrow keys */
  async function actionArrowNudge(signal) {
    const dir = pick(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);
    const times = rand(1, 8);
    const useShift = Math.random() < 0.3;

    for (let i = 0; i < times && !signal.aborted; i++) {
      dispatchKeyboard('keydown', dir, { shiftKey: useShift, code: dir });
      await sleep(rand(35, 90), signal);
      dispatchKeyboard('keyup', dir, { shiftKey: useShift, code: dir });
      await sleep(rand(25, 75), signal);
    }
    designState.totalActions++;
  }

  /** Common design shortcuts */
  async function actionKeyboardShortcut(signal) {
    const shortcuts = [
      { weight: 18, fn: () => pressShortcut('z', { ctrlKey: true }, signal) },
      { weight: 8, fn: () => pressShortcut('z', { ctrlKey: true, shiftKey: true }, signal) },
      { weight: 10, fn: () => pressShortcut('d', { ctrlKey: true }, signal) },
      { weight: 8, fn: () => pressShortcut('a', { ctrlKey: true }, signal) },
      { weight: 6, fn: () => pressShortcut('c', { ctrlKey: true }, signal) },
      { weight: 6, fn: () => pressShortcut('v', { ctrlKey: true }, signal) },
      { weight: 5, fn: () => pressShortcut(']', { ctrlKey: true }, signal) },
      { weight: 5, fn: () => pressShortcut('[', { ctrlKey: true }, signal) },
      { weight: 4, fn: () => pressShortcut('g', { ctrlKey: true }, signal) },
      { weight: 4, fn: () => pressShortcut('Escape', {}, signal) },
    ];
    const totalWeight = shortcuts.reduce((sum, s) => sum + s.weight, 0);
    let rng = Math.random() * totalWeight;
    for (const s of shortcuts) {
      rng -= s.weight;
      if (rng <= 0) { await s.fn(); break; }
    }
    designState.totalActions++;
  }

  /** Click toolbar items */
  async function actionClickToolbar(signal) {
    const zones = [
      { x: randf(60, window.innerWidth * 0.75), y: randf(10, 50) },
      { x: randf(10, 50), y: randf(80, window.innerHeight * 0.8) },
      { x: randf(window.innerWidth - 240, window.innerWidth - 30), y: randf(80, window.innerHeight * 0.8) },
    ];
    const zone = pick(zones);
    await clickAt(zone.x, zone.y, signal, { fast: true });
    designState.totalActions++;
  }

  /** Scroll viewport */
  async function actionScroll(signal) {
    const useZoom = Math.random() < 0.25;
    await scrollCanvas(signal, useZoom);
    designState.totalActions++;
  }

  /** Rubber-band selection box */
  async function actionRubberBandSelect(signal) {
    const ws = getWorkspaceRect();
    const from = randomPointIn(ws, 40);
    const size = { w: rand(80, 240), h: rand(60, 180) };
    const to = {
      x: Math.min(ws.right - 20, from.x + size.w),
      y: Math.min(ws.bottom - 20, from.y + size.h),
    };
    await dragFrom(from.x, from.y, to.x, to.y, signal, { fast: false });
    await thinkingPause(signal, 'micro');
    designState.totalActions++;
  }

  /** Middle-mouse / Spacebar pan */
  async function actionPanCanvas(signal) {
    const ws = getWorkspaceRect();
    const from = randomPointIn(ws, 60);
    const to = {
      x: from.x + randf(-140, 140),
      y: from.y + randf(-90, 90),
    };
    dispatchKeyboard('keydown', ' ', { code: 'Space' });
    await sleep(60, signal);
    await dragFrom(from.x, from.y, to.x, to.y, signal, { fast: false });
    dispatchKeyboard('keyup', ' ', { code: 'Space' });
    designState.totalActions++;
  }

  /** Layers panel interaction */
  async function actionLayersPanel(signal) {
    const layersSel = findVisible([
      '[class*="layers"]', '[data-testid*="layers"]',
      '[class*="page-panel"]', '[class*="panel-layers"]',
      '[aria-label*="Layers" i]', '[class*="sidebar"]',
    ]);

    if (layersSel) {
      const c = center(layersSel);
      await clickAt(c.x, c.y, signal, { haloVariant: 'purple' });
      await thinkingPause(signal, 'short');
      const r = layersSel.getBoundingClientRect();
      await clickAt(randf(r.left + 10, r.right - 10), randf(r.top + 10, r.bottom - 10), signal);
    } else {
      await clickAt(randf(12, 50), randf(100, window.innerHeight * 0.8), signal);
    }
    designState.totalActions++;
  }

  // ─── Actual Impressive Designing Pipelines ─────────────────────────────────
  // Actively constructs modern layouts: Hero Banners, CTA components, Feature Grids,
  // Typography, and direct high-DPI rendering when real HTML5 canvases are present.

  function drawOnCanvasIfPresent(renderFn) {
    try {
      const canvases = Array.from(document.querySelectorAll('canvas')).filter(c => {
        const r = c.getBoundingClientRect();
        return r.width > 80 && r.height > 80;
      });
      if (canvases.length === 0) return false;

      for (const canvas of canvases) {
        let ctx = null;
        try { ctx = canvas.getContext('2d'); } catch (_) { }
        if (!ctx) continue;

        ctx.save();
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / (rect.width || canvas.width || 1);
        const scaleY = canvas.height / (rect.height || canvas.height || 1);

        renderFn(ctx, rect, scaleX, scaleY);
        ctx.restore();
        return true;
      }
    } catch (_) { }
    return false;
  }

  /**
   * Helper: Type text into current focused element with variable human velocity
   */
  async function typeDesignText(text, signal) {
    let inFastBurst = Math.random() < 0.45;
    for (let i = 0; i < text.length && !signal.aborted; i++) {
      await waitIfPaused(signal);
      if (signal.aborted) break;

      const char = text[i];
      if (char === ' ') inFastBurst = Math.random() < 0.5;

      // Occasional human typo & quick backspace fix
      if (Math.random() < 0.12 && i > 1) {
        const typoChar = String.fromCharCode(char.charCodeAt(0) + rand(-1, 1));
        dispatchKeyboard('keydown', typoChar);
        await sleep(rand(30, 60), signal);
        dispatchKeyboard('keyup', typoChar);
        await sleep(rand(180, 320), signal);
        dispatchKeyboard('keydown', 'Backspace', { code: 'Backspace' });
        await sleep(rand(30, 60), signal);
        dispatchKeyboard('keyup', 'Backspace', { code: 'Backspace' });
        await sleep(rand(100, 200), signal);
      }

      const keyDur = inFastBurst ? rand(20, 50) : rand(50, 95);
      dispatchKeyboard('keydown', char);
      await sleep(keyDur, signal);
      dispatchKeyboard('keyup', char);

      let pauseMs = inFastBurst ? rand(25, 60) : rand(60, 140);
      if (char === ' ') pauseMs += rand(70, 180);
      if (char === '→' || char === '—') pauseMs += rand(150, 300);
      await sleep(pauseMs, signal);
    }
  }

  /**
   * 1. Create Complete Hero Banner Composition:
   * Actively builds a modern glassmorphic hero card, selects gradient/fill,
   * adds headline typography, bold styling, and a secondary action pill.
   */
  async function actionCreateHeroBanner(signal) {
    const ws = getWorkspaceRect();
    const bannerW = Math.round(ws.width * randf(0.72, 0.82));
    const bannerH = Math.round(ws.height * randf(0.32, 0.40));
    const bannerX = Math.round(ws.left + (ws.width - bannerW) / 2);
    const bannerY = Math.round(ws.top + ws.height * 0.12);

    // Step A: Activate Rectangle / Frame tool via universal shortcut 'r'
    await pressShortcut('r', {}, signal);
    await sleep(rand(150, 320), signal);

    // Step B: Drag across workspace creating the hero container frame
    await dragFrom(bannerX, bannerY, bannerX + bannerW, bannerY + bannerH, signal, { fast: false });
    if (signal.aborted) return;
    await thinkingPause(signal, 'micro');

    // Step C: Color swatch exploration for the hero container
    const colorBtn = findVisible(['[aria-label*="Color" i]', '[data-testid*="color" i]', '[class*="swatch"]']);
    if (colorBtn) {
      const c = center(colorBtn);
      await clickAt(c.x, c.y, signal, { haloVariant: 'amber' });
      await sleep(rand(200, 400), signal);
      await clickAt(c.x + randf(-30, 50), c.y + randf(60, 120), signal, { haloVariant: 'purple' });
    }

    // Step D: Activate Text tool ('t') to place impactful hero typography
    await pressShortcut('t', {}, signal);
    await sleep(rand(150, 300), signal);

    const titleX = Math.round(bannerX + bannerW * 0.5);
    const titleY = Math.round(bannerY + bannerH * 0.36);
    await clickAt(titleX, titleY, signal, { haloVariant: 'blue', focus: true });
    if (signal.aborted) return;

    const heroHeadlines = [
      'DESIGNING THE FUTURE',
      'NEXT-GEN CREATIVE STUDIO',
      'ELEVATE DIGITAL CRAFT',
      'MINIMALIST ARCHITECTURE',
      'INNOVATION IN EVERY PIXEL',
      'BEYOND BOUNDARIES 2026',
    ];
    const headline = pick(heroHeadlines);
    await typeDesignText(headline, signal);
    if (signal.aborted) return;

    // Bold formatting (Ctrl+A, Ctrl+B)
    await pressShortcut('a', { ctrlKey: true }, signal);
    await sleep(rand(100, 200), signal);
    await pressShortcut('b', { ctrlKey: true }, signal);
    await sleep(rand(150, 300), signal);

    // Step E: Create CTA pill button inside hero banner
    await pressShortcut('r', {}, signal);
    await sleep(rand(120, 250), signal);

    const btnW = 160;
    const btnH = 42;
    const btnX = Math.round(bannerX + (bannerW - btnW) / 2);
    const btnY = Math.round(bannerY + bannerH * 0.70);

    await dragFrom(btnX, btnY, btnX + btnW, btnY + btnH, signal, { fast: true });
    if (signal.aborted) return;

    // Type CTA copy inside button
    await pressShortcut('t', {}, signal);
    await sleep(rand(100, 200), signal);
    await clickAt(btnX + btnW / 2, btnY + btnH / 2, signal, { focus: true });
    await typeDesignText('Explore Now →', signal);

    // Step F: If an HTML5 canvas is present, physically render the design
    drawOnCanvasIfPresent((ctx, rect, sx, sy) => {
      const relX = (bannerX - rect.left) * sx;
      const relY = (bannerY - rect.top) * sy;
      const relW = bannerW * sx;
      const relH = bannerH * sy;
      const radius = 18 * sx;

      // Hero Card Background Gradient
      const grad = ctx.createLinearGradient(relX, relY, relX + relW, relY + relH);
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(0.5, '#1e1b4b');
      grad.addColorStop(1, '#020617');

      ctx.fillStyle = grad;
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.6)';
      ctx.lineWidth = 2 * sx;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
      ctx.shadowBlur = 25 * sx;

      if (typeof ctx.roundRect === 'function') {
        ctx.beginPath();
        ctx.roundRect(relX, relY, relW, relH, radius);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillRect(relX, relY, relW, relH);
        ctx.strokeRect(relX, relY, relW, relH);
      }

      // Title Typography
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.round(22 * sx)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(headline, relX + relW / 2, relY + relH * 0.36);

      // Subtitle
      ctx.fillStyle = '#94a3b8';
      ctx.font = `${Math.round(12 * sx)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.fillText('Crafted with precision & modern aesthetics', relX + relW / 2, relY + relH * 0.52);

      // Pill Button
      const bRelX = (btnX - rect.left) * sx;
      const bRelY = (btnY - rect.top) * sy;
      const bRelW = btnW * sx;
      const bRelH = btnH * sy;

      const btnGrad = ctx.createLinearGradient(bRelX, bRelY, bRelX + bRelW, bRelY);
      btnGrad.addColorStop(0, '#3b82f6');
      btnGrad.addColorStop(1, '#8b5cf6');

      ctx.fillStyle = btnGrad;
      ctx.shadowColor = 'rgba(59, 130, 246, 0.5)';
      ctx.shadowBlur = 12 * sx;

      if (typeof ctx.roundRect === 'function') {
        ctx.beginPath();
        ctx.roundRect(bRelX, bRelY, bRelW, bRelH, bRelH / 2);
        ctx.fill();
      } else {
        ctx.fillRect(bRelX, bRelY, bRelW, bRelH);
      }

      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.round(12 * sx)}px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.fillText('Explore Now →', bRelX + bRelW / 2, bRelY + bRelH / 2);
    });

    // Designer step back to admire composition
    await thinkingPause(signal, 'medium');
    designState.totalActions += 3;
  }

  /**
   * 2. Create Modern CTA Button Component:
   * Selects Rectangle/Shape tool, creates sleek pill button, picks accent color,
   * adds centered action copy, and applies bold styling.
   */
  async function actionCreateCTAButton(signal) {
    const ws = getWorkspaceRect();
    const btnW = rand(170, 210);
    const btnH = rand(44, 52);
    const btnX = Math.round(ws.left + ws.width * randf(0.3, 0.5));
    const btnY = Math.round(ws.top + ws.height * randf(0.5, 0.75));

    // Rectangle tool
    await pressShortcut('r', {}, signal);
    await sleep(rand(120, 250), signal);

    await dragFrom(btnX, btnY, btnX + btnW, btnY + btnH, signal, { fast: true });
    if (signal.aborted) return;
    await thinkingPause(signal, 'micro');

    // Pick vibrant accent color (electric blue / emerald / amber)
    const colorBtn = findVisible(['[aria-label*="Color" i]', '[data-testid*="color" i]', '[class*="swatch"]']);
    if (colorBtn) {
      const c = center(colorBtn);
      await clickAt(c.x, c.y, signal, { haloVariant: 'amber' });
      await sleep(rand(180, 350), signal);
      await clickAt(c.x + randf(20, 60), c.y + randf(60, 100), signal, { haloVariant: 'blue' });
    }

    // Text tool
    await pressShortcut('t', {}, signal);
    await sleep(rand(100, 200), signal);

    await clickAt(btnX + btnW / 2, btnY + btnH / 2, signal, { focus: true });
    if (signal.aborted) return;

    const ctaLabels = [
      'Get Started Free →',
      'Claim Early Access',
      'Launch Studio Beta',
      'Download Portfolio',
      'Join 100K+ Creators',
    ];
    const label = pick(ctaLabels);
    await typeDesignText(label, signal);
    if (signal.aborted) return;

    await pressShortcut('a', { ctrlKey: true }, signal);
    await sleep(rand(100, 200), signal);
    await pressShortcut('b', { ctrlKey: true }, signal);

    // Direct Canvas Rendering
    drawOnCanvasIfPresent((ctx, rect, sx, sy) => {
      const bX = (btnX - rect.left) * sx;
      const bY = (btnY - rect.top) * sy;
      const bW = btnW * sx;
      const bH = btnH * sy;

      const grad = ctx.createLinearGradient(bX, bY, bX + bW, bH);
      grad.addColorStop(0, '#2563eb');
      grad.addColorStop(1, '#7c3aed');

      ctx.fillStyle = grad;
      ctx.shadowColor = 'rgba(37, 99, 235, 0.4)';
      ctx.shadowBlur = 15 * sx;

      if (typeof ctx.roundRect === 'function') {
        ctx.beginPath();
        ctx.roundRect(bX, bY, bW, bH, bH / 2);
        ctx.fill();
      } else {
        ctx.fillRect(bX, bY, bW, bH);
      }

      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.round(13 * sx)}px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, bX + bW / 2, bY + bH / 2);
    });

    await thinkingPause(signal, 'short');
    designState.totalActions += 2;
  }

  /**
   * 3. Create Multi-Card Feature Grid:
   * Constructs 3 modular product cards in a structured layout with icon badge circles,
   * feature headers, and descriptive typography.
   */
  async function actionCreateFeatureCardGrid(signal) {
    const ws = getWorkspaceRect();
    const cols = 3;
    const cardGap = Math.round(ws.width * 0.03);
    const totalGap = cardGap * (cols - 1);
    const usableW = Math.round(ws.width * 0.82);
    const cardW = Math.round((usableW - totalGap) / cols);
    const cardH = Math.round(ws.height * randf(0.28, 0.34));
    const startX = Math.round(ws.left + (ws.width - usableW) / 2);
    const cardY = Math.round(ws.top + ws.height * 0.52);

    const features = [
      { icon: '⚡', title: 'Lightning Fast', desc: 'Ultra-low latency rendering' },
      { icon: '🛡️', title: 'Bank-Grade Safe', desc: 'Full client-side encryption' },
      { icon: '☁️', title: 'Cloud Synced', desc: 'Real-time multi-device relay' },
    ];

    for (let c = 0; c < cols && !signal.aborted; c++) {
      const curX = startX + c * (cardW + cardGap);
      const feat = features[c];

      // Draw Card Container
      await pressShortcut('r', {}, signal);
      await sleep(rand(100, 200), signal);
      await dragFrom(curX, cardY, curX + cardW, cardY + cardH, signal, { fast: true });
      if (signal.aborted) break;

      // Draw Icon Circle
      await pressShortcut('o', {}, signal);
      await sleep(rand(100, 200), signal);
      const iconX = curX + 25;
      const iconY = cardY + 25;
      await dragFrom(iconX, iconY, iconX + 36, iconY + 36, signal, { fast: true });

      // Type Feature Title
      await pressShortcut('t', {}, signal);
      await sleep(rand(100, 200), signal);
      await clickAt(curX + cardW / 2, cardY + cardH * 0.55, signal, { focus: true });
      await typeDesignText(feat.title, signal);

      await sleep(rand(150, 300), signal);
    }

    // Direct Canvas Rendering
    drawOnCanvasIfPresent((ctx, rect, sx, sy) => {
      for (let c = 0; c < cols; c++) {
        const curX = startX + c * (cardW + cardGap);
        const feat = features[c];
        const relX = (curX - rect.left) * sx;
        const relY = (cardY - rect.top) * sy;
        const relW = cardW * sx;
        const relH = cardH * sy;
        const r = 14 * sx;

        // Card Body
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1.5 * sx;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
        ctx.shadowBlur = 14 * sx;

        if (typeof ctx.roundRect === 'function') {
          ctx.beginPath();
          ctx.roundRect(relX, relY, relW, relH, r);
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.fillRect(relX, relY, relW, relH);
          ctx.strokeRect(relX, relY, relW, relH);
        }

        // Icon Circle
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(59, 130, 246, 0.15)';
        ctx.strokeStyle = '#3b82f6';
        ctx.beginPath();
        ctx.arc(relX + 36 * sx, relY + 36 * sy, 18 * sx, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.font = `${Math.round(16 * sx)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(feat.icon, relX + 36 * sx, relY + 37 * sy);

        // Title
        ctx.fillStyle = '#f8fafc';
        ctx.font = `bold ${Math.round(14 * sx)}px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillText(feat.title, relX + 22 * sx, relY + relH * 0.62);

        // Description
        ctx.fillStyle = '#94a3b8';
        ctx.font = `${Math.round(11 * sx)}px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.fillText(feat.desc, relX + 22 * sx, relY + relH * 0.78);
      }
    });

    await thinkingPause(signal, 'medium');
    designState.totalActions += 4;
  }

  /**
   * 4. Draw Vector Artwork / Fluid Bezier Curve:
   * Uses pen/line tool to trace artistic harmonic curves across the canvas.
   */
  async function actionDrawVectorArtwork(signal) {
    const ws = getWorkspaceRect();
    const p1 = randomPointIn(ws, 80);
    const p2 = { x: p1.x + randf(80, 160), y: p1.y + randf(-80, 80) };
    const p3 = { x: p2.x + randf(60, 140), y: p2.y + randf(-60, 100) };

    await pressShortcut('p', {}, signal); // Pen tool
    await sleep(rand(120, 250), signal);

    await clickAt(p1.x, p1.y, signal, { haloVariant: 'purple' });
    await dragFrom(p1.x, p1.y, p2.x, p2.y, signal, { fast: false });
    await dragFrom(p2.x, p2.y, p3.x, p3.y, signal, { fast: false });

    // Canvas Render
    drawOnCanvasIfPresent((ctx, rect, sx, sy) => {
      const x1 = (p1.x - rect.left) * sx;
      const y1 = (p1.y - rect.top) * sy;
      const x2 = (p2.x - rect.left) * sx;
      const y2 = (p2.y - rect.top) * sy;
      const x3 = (p3.x - rect.left) * sx;
      const y3 = (p3.y - rect.top) * sy;

      const grad = ctx.createLinearGradient(x1, y1, x3, y3);
      grad.addColorStop(0, '#38bdf8');
      grad.addColorStop(1, '#c084fc');

      ctx.strokeStyle = grad;
      ctx.lineWidth = 3 * sx;
      ctx.lineCap = 'round';
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 10 * sx;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.bezierCurveTo(x1 + 40 * sx, y1 - 30 * sy, x2 - 40 * sx, y2 + 30 * sy, x2, y2);
      ctx.bezierCurveTo(x2 + 40 * sx, y2 - 20 * sy, x3 - 40 * sx, y3 + 20 * sy, x3, y3);
      ctx.stroke();
    });

    await thinkingPause(signal, 'short');
    designState.totalActions++;
  }

  /**
   * 5. Platform-Smart Actual Design: Canva & Web-based Tools
   * Specifically triggers real element creation buttons (Add a heading, Elements, etc.)
   */
  async function actionPlatformSmartDesign(signal) {
    // 1. Check if Canva "Text" tab exists
    const textTab = findVisible([
      'button[aria-label*="Text" i]',
      '[data-testid*="text-button"]',
      '[data-testid="side-panel-button-text"]',
    ]);

    if (textTab) {
      const tc = center(textTab);
      await clickAt(tc.x, tc.y, signal, { haloVariant: 'purple' });
      await sleep(rand(350, 700), signal);

      // In Canva, find "Add a heading" button
      const headingBtn = Array.from(document.querySelectorAll('button, div[role="button"]')).find(el => {
        const t = (el.textContent || '').toLowerCase();
        return t.includes('add a heading') || t.includes('heading') || t.includes('add a text box');
      });

      if (headingBtn) {
        const hc = center(headingBtn);
        await clickAt(hc.x, hc.y, signal, { haloVariant: 'blue' });
        await sleep(rand(400, 800), signal);
        await typeDesignText(pick(['SUMMER EDITORIAL 2026', 'DESIGN BEYOND BOUNDARIES', 'PREMIUM CRAFTSMANSHIP']), signal);
        designState.totalActions += 2;
        return;
      }
    }

    // 2. Check if Canva "Elements" tab exists
    const elementsTab = findVisible([
      'button[aria-label*="Elements" i]',
      '[data-testid*="elements-button"]',
    ]);
    if (elementsTab) {
      const ec = center(elementsTab);
      await clickAt(ec.x, ec.y, signal, { haloVariant: 'purple' });
      await sleep(rand(350, 650), signal);
      await clickAt(randf(100, 220), randf(160, 280), signal, { haloVariant: 'amber' });
      designState.totalActions++;
      return;
    }

    // Fallback: Default to Hero Banner construction
    await actionCreateHeroBanner(signal);
  }

  // ─── Action Pool ────────────────────────────────────────────────────────────
  // Weighted to prioritize real, impressive generative design: Hero banners,
  // CTA buttons, feature grids, platform-smart creation, and typography.

  const ACTION_POOL = [
    { weight: 20, label: 'hero-banner', fn: actionCreateHeroBanner },
    { weight: 16, label: 'cta-button', fn: actionCreateCTAButton },
    { weight: 16, label: 'feature-grid', fn: actionCreateFeatureCardGrid },
    { weight: 14, label: 'platform-smart', fn: actionPlatformSmartDesign },
    { weight: 12, label: 'edit-text', fn: actionEditText },
    { weight: 11, label: 'change-color', fn: actionChangeColor },
    { weight: 10, label: 'vector-artwork', fn: actionDrawVectorArtwork },
    { weight: 9, label: 'change-background', fn: actionChangeBackground },
    { weight: 8, label: 'add-shape', fn: actionAddShapeOrGraphic },
    { weight: 7, label: 'rotate', fn: actionRotateElement },
    { weight: 6, label: 'undo-explore', fn: actionUndoRedoExploration },
    { weight: 6, label: 'zoom-inspect', fn: actionZoomAndInspect },
    { weight: 5, label: 'draw', fn: actionDrawShape },
    { weight: 4, label: 'move', fn: actionMoveElement },
    { weight: 4, label: 'resize', fn: actionResizeElement },
    { weight: 3, label: 'nudge', fn: actionArrowNudge },
    { weight: 3, label: 'shortcut', fn: actionKeyboardShortcut },
    { weight: 3, label: 'select', fn: actionSelectElement },
    { weight: 2, label: 'toolbar', fn: actionClickToolbar },
    { weight: 2, label: 'layers', fn: actionLayersPanel },
  ];

  const TOTAL_WEIGHT = ACTION_POOL.reduce((s, a) => s + a.weight, 0);

  function pickAction() {
    let rng = Math.random() * TOTAL_WEIGHT;
    for (const action of ACTION_POOL) {
      rng -= action.weight;
      if (rng <= 0) return action;
    }
    return ACTION_POOL[0];
  }

  // ─── Thinking Pause Scheduler ────────────────────────────────────────────────

  const PAUSE_WEIGHTS = [
    { type: 'micro', weight: 38 },
    { type: 'short', weight: 36 },
    { type: 'medium', weight: 16 },
    { type: 'long', weight: 8 },
    { type: 'idle', weight: 2 },
  ];
  const PAUSE_TOTAL = PAUSE_WEIGHTS.reduce((s, p) => s + p.weight, 0);

  function pickPauseType() {
    let rng = Math.random() * PAUSE_TOTAL;
    for (const p of PAUSE_WEIGHTS) {
      rng -= p.weight;
      if (rng <= 0) return p.type;
    }
    return 'short';
  }

  // ─── Main Design Loop ────────────────────────────────────────────────────────

  async function runDesignLoop() {
    const signal = designState.abortController.signal;
    designState.sessionStartTime = Date.now();
    designState.totalPausedTime = 0;
    designState.pauseStartTime = null;
    designState.totalActions = 0;
    designState.platform = detectPlatform();

    // Lock single-cursor mode and inject click halo overlay
    initCursorOverlay();

    // Broadcast start status
    window.dispatchEvent(new CustomEvent('tbaDesignStatus', {
      detail: { state: 'running', platform: designState.platform }
    }));
    try {
      chrome.runtime.sendMessage({
        action: 'designStatus',
        detail: { state: 'running', platform: designState.platform }
      });
    } catch (_) { }

    try {
      // Brief human warm-up pause before first action
      await sleep(rand(800, 1800), signal);

      while (!signal.aborted && designState.running) {
        // Enforce session duration limit
        const currentPaused = designState.pauseStartTime ? (Date.now() - designState.pauseStartTime) : 0;
        const currentElapsed = Date.now() - designState.sessionStartTime - designState.totalPausedTime - currentPaused;
        if (currentElapsed >= designState.sessionDuration) {
          break;
        }

        await waitIfPaused(signal);
        if (signal.aborted) break;

        // Pick and execute human design action
        const action = pickAction();
        designState.lastAction = action.label;
        try {
          await action.fn(signal);
        } catch (err) {
          if (err.name === 'AbortError') throw err;
          // Non-fatal error; continue session gracefully
        }

        if (signal.aborted || !designState.running) break;

        const pausedNow = designState.pauseStartTime ? (Date.now() - designState.pauseStartTime) : 0;
        const elapsed = Math.max(0, Date.now() - designState.sessionStartTime - designState.totalPausedTime - pausedNow);
        const remaining = Math.max(0, designState.sessionDuration - elapsed);
        const pct = Math.min(100, Math.round((elapsed / designState.sessionDuration) * 100));

        // Broadcast live progress
        const statusDetail = {
          state: 'running',
          elapsed,
          remaining,
          pct,
          totalActions: designState.totalActions,
          platform: designState.platform,
          lastAction: action.label,
          sessionDuration: designState.sessionDuration,
        };
        window.dispatchEvent(new CustomEvent('tbaDesignStatus', { detail: statusDetail }));
        try {
          chrome.runtime.sendMessage({ action: 'designStatus', detail: statusDetail });
        } catch (_) { }

        // Human thinking pause between actions
        await thinkingPause(signal, pickPauseType());
      }

      if (!signal.aborted && designState.running) {
        designState.running = false;
        const doneDetail = { state: 'done', totalActions: designState.totalActions };
        window.dispatchEvent(new CustomEvent('tbaDesignStatus', { detail: doneDetail }));
        try {
          chrome.runtime.sendMessage({ action: 'designStatus', detail: doneDetail });
        } catch (_) { }
      }

    } catch (err) {
      if (err.name !== 'AbortError') {
        const errDetail = { state: 'error', message: err.message };
        window.dispatchEvent(new CustomEvent('tbaDesignStatus', { detail: errDetail }));
        try {
          chrome.runtime.sendMessage({ action: 'designStatus', detail: errDetail });
        } catch (_) { }
      }
    } finally {
      // Clean up cursor overlay and restore standard browser cursor
      destroyCursorOverlay();
    }
  }

  // ─── Public Command Handler ─────────────────────────────────────────────────

  function handleDesignCommand(cmd, duration, cursorSpeed, operationSpeed) {
    if (cursorSpeed !== undefined) designState.cursorSpeed = parseSpeed(cursorSpeed, designState.cursorSpeed);
    if (operationSpeed !== undefined) designState.operationSpeed = parseSpeed(operationSpeed, designState.operationSpeed);

    switch (cmd) {
      case 'start':
        if (designState.running) {
          if (designState.paused) {
            handleDesignCommand('resume');
          }
          return;
        }
        designState.running = true;
        designState.paused = false;
        designState.totalPausedTime = 0;
        designState.pauseStartTime = null;
        designState.abortController = new AbortController();
        if (duration) designState.sessionDuration = duration;
        runDesignLoop().catch(() => { });
        break;

      case 'pause':
        if (!designState.running || designState.paused) return;
        designState.paused = true;
        designState.pauseStartTime = Date.now();
        window.dispatchEvent(new CustomEvent('tbaDesignStatus', {
          detail: { state: 'paused' }
        }));
        try {
          chrome.runtime.sendMessage({ action: 'designStatus', detail: { state: 'paused' } });
        } catch (_) { }
        break;

      case 'resume':
        if (!designState.paused) return;
        designState.paused = false;
        if (designState.pauseStartTime) {
          designState.totalPausedTime += (Date.now() - designState.pauseStartTime);
          designState.pauseStartTime = null;
        }
        if (designState.pauseResolve) {
          designState.pauseResolve();
          designState.pauseResolve = null;
        }
        initCursorOverlay();
        window.dispatchEvent(new CustomEvent('tbaDesignStatus', {
          detail: { state: 'running' }
        }));
        try {
          chrome.runtime.sendMessage({ action: 'designStatus', detail: { state: 'running' } });
        } catch (_) { }
        break;

      case 'stop':
        designState.running = false;
        designState.paused = false;
        if (designState.pauseStartTime) {
          designState.totalPausedTime += (Date.now() - designState.pauseStartTime);
          designState.pauseStartTime = null;
        }
        if (designState.abortController) {
          try { designState.abortController.abort(); } catch (_) { }
        }
        if (designState.pauseResolve) {
          designState.pauseResolve();
          designState.pauseResolve = null;
        }
        destroyCursorOverlay();
        window.dispatchEvent(new CustomEvent('tbaDesignStatus', {
          detail: { state: 'stopped', totalActions: designState.totalActions }
        }));
        try {
          chrome.runtime.sendMessage({
            action: 'designStatus',
            detail: { state: 'stopped', totalActions: designState.totalActions }
          });
        } catch (_) { }
        break;
    }
  }

  // ─── Chrome Extension runtime message listener ──────────────────────────────
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg.action === 'designCmd') {
        handleDesignCommand(msg.cmd, msg.duration, msg.cursorSpeed, msg.operationSpeed);
        sendResponse({
          ok: true,
          state: designState.running ? (designState.paused ? 'paused' : 'running') : 'idle',
          cursorSpeed: designState.cursorSpeed,
          operationSpeed: designState.operationSpeed
        });
        return true;
      }
      if (msg.action === 'designUpdateSpeed') {
        if (msg.cursorSpeed !== undefined) designState.cursorSpeed = parseSpeed(msg.cursorSpeed, designState.cursorSpeed);
        if (msg.operationSpeed !== undefined) designState.operationSpeed = parseSpeed(msg.operationSpeed, designState.operationSpeed);
        sendResponse({
          ok: true,
          cursorSpeed: designState.cursorSpeed,
          operationSpeed: designState.operationSpeed
        });
        return true;
      }
      if (msg.action === 'designGetStatus') {
        const currentPaused = designState.pauseStartTime ? (Date.now() - designState.pauseStartTime) : 0;
        const elapsed = designState.sessionStartTime
          ? Math.max(0, Date.now() - designState.sessionStartTime - designState.totalPausedTime - currentPaused)
          : 0;
        const remaining = Math.max(0, designState.sessionDuration - elapsed);
        const pct = Math.min(100, Math.round((elapsed / designState.sessionDuration) * 100));
        sendResponse({
          running: designState.running,
          paused: designState.paused,
          elapsed,
          remaining,
          pct,
          totalActions: designState.totalActions,
          platform: designState.platform,
          lastAction: designState.lastAction || 'Ready',
          sessionDuration: designState.sessionDuration,
          cursorSpeed: designState.cursorSpeed,
          operationSpeed: designState.operationSpeed,
        });
        return true;
      }
    });
  }

  // ─── Window message listener (ExecuteScript postMessage fallback) ───────────
  window.addEventListener('message', (e) => {
    if (!e.data || e.data.tbaDesign === undefined) return;
    const { tbaDesign: cmd, duration, cursorSpeed, operationSpeed } = e.data;
    handleDesignCommand(cmd, duration, cursorSpeed, operationSpeed);
  });

  // ─── Relay design status events → chrome.runtime for popup UI ───────────────
  window.addEventListener('tbaDesignStatus', (e) => {
    try {
      chrome.runtime.sendMessage({ action: 'designStatus', detail: e.detail });
    } catch (_) { }
  });

})();
