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
    sessionDuration: 60 * 60 * 1000, // 1 hour in ms
    pauseResolve: null,
    totalActions: 0,
    platform: 'unknown',
  };

  // ─── Platform Detection ─────────────────────────────────────────────────────

  const PLATFORM_SIGNATURES = [
    { name: 'canva',         test: () => location.hostname.includes('canva.com') },
    { name: 'figma',         test: () => location.hostname.includes('figma.com') },
    { name: 'adobe-express', test: () => location.hostname.includes('express.adobe.com') || location.hostname.includes('adobeexpress.com') },
    { name: 'photoshop-web', test: () => location.hostname.includes('photoshop.adobe.com') },
    { name: 'picsart',       test: () => location.hostname.includes('picsart.com') },
    { name: 'pixlr',         test: () => location.hostname.includes('pixlr.com') },
    { name: 'vectr',         test: () => location.hostname.includes('vectr.com') },
    { name: 'gravit',        test: () => location.hostname.includes('designer.gravit.io') },
    { name: 'generic-canvas',test: () => !!document.querySelector('canvas') },
  ];

  function detectPlatform() {
    for (const sig of PLATFORM_SIGNATURES) {
      if (sig.test()) return sig.name;
    }
    return 'generic';
  }

  // ─── Utilities ──────────────────────────────────────────────────────────────

  /** Abortable sleep */
  function sleep(ms, signal) {
    return new Promise((resolve, reject) => {
      if (ms <= 0) { resolve(); return; }
      const id = setTimeout(resolve, ms);
      if (signal) {
        signal.addEventListener('abort', () => {
          clearTimeout(id);
          reject(new DOMException('Design mode aborted', 'AbortError'));
        }, { once: true });
      }
    });
  }

  /** Wait if paused */
  function waitIfPaused() {
    if (!designState.paused) return Promise.resolve();
    return new Promise(resolve => { designState.pauseResolve = resolve; });
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
      } catch (_) {}
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
    halo.className = `tba-click-halo ${
      styleVariant === 'purple' ? 'tba-halo-secondary' :
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
  // Moves the single virtual cursor along a natural bezier curve with micro-drift.

  async function moveCursorTo(toX, toY, signal, options = {}) {
    const fromX = _cursorX;
    const fromY = _cursorY;
    const dist = Math.hypot(toX - fromX, toY - fromY);
    const steps = Math.max(8, Math.min(55, Math.floor(dist / 14)));

    // Bezier control point with slight natural curve
    const cpX = (fromX + toX) / 2 + randf(-dist * 0.22, dist * 0.22);
    const cpY = (fromY + toY) / 2 + randf(-dist * 0.22, dist * 0.22);
    const baseDuration = options.fast ? rand(70, 160) : rand(180, 420);

    for (let s = 1; s <= steps; s++) {
      if (signal.aborted) return;
      await waitIfPaused();

      const t = s / steps;
      // Quadratic bezier + human micro-jitter
      const x = (1 - t) * (1 - t) * fromX + 2 * (1 - t) * t * cpX + t * t * toX + randf(-1.2, 1.2);
      const y = (1 - t) * (1 - t) * fromY + 2 * (1 - t) * t * cpY + t * t * toY + randf(-1.2, 1.2);

      dispatchPointer('pointermove', x, y);
      dispatchMouse('mousemove', x, y);
      _cursorX = x;
      _cursorY = y;
      renderCursorPosition(x, y, false);

      const stepDelay = baseDuration / steps + randf(-3, 4);
      await sleep(Math.max(4, stepDelay), signal);
    }

    _cursorX = toX;
    _cursorY = toY;
    renderCursorPosition(toX, toY, false);
  }

  // ─── Atomic Actions with Visible Click & Drag Feedback ───────────────────────

  /** Move to point, depress cursor, spawn click ripple halo, dispatch click */
  async function clickAt(x, y, signal, opts = {}) {
    await moveCursorTo(x, y, signal, opts);
    if (signal.aborted) return;

    // Visual feedback: depress cursor and spawn click halo
    renderCursorPosition(x, y, true);
    showClickHalo(x, y, opts.haloVariant || 'blue');

    dispatchPointer('pointerdown', x, y, { buttons: 1 });
    dispatchMouse('mousedown', x, y, { buttons: 1 });
    await sleep(rand(45, 110), signal);

    // Release cursor
    renderCursorPosition(x, y, false);
    dispatchPointer('pointerup', x, y, { buttons: 0 });
    dispatchMouse('mouseup', x, y, { buttons: 0 });
    dispatchMouse('click', x, y);

    if (opts.focus) {
      const el = document.elementFromPoint(x, y);
      if (el && typeof el.focus === 'function') el.focus();
    }

    await sleep(rand(50, 160), signal);
  }

  /** Double-click with dual-stage expanding ripples */
  async function doubleClickAt(x, y, signal) {
    await clickAt(x, y, signal, { haloVariant: 'blue' });
    await sleep(rand(60, 110), signal);

    // Second click pulse with secondary halo
    renderCursorPosition(x, y, true);
    showClickHalo(x, y, 'purple', 40);

    dispatchPointer('pointerdown', x, y, { buttons: 1 });
    dispatchMouse('mousedown', x, y, { buttons: 1 });
    await sleep(rand(40, 80), signal);

    renderCursorPosition(x, y, false);
    dispatchPointer('pointerup', x, y, { buttons: 0 });
    dispatchMouse('mouseup', x, y, { buttons: 0 });
    dispatchMouse('click', x, y);
    dispatchMouse('dblclick', x, y);
    await sleep(rand(80, 200), signal);
  }

  /** Drag with continuous glowing drag halo and organic ease-in-out */
  async function dragFrom(fromX, fromY, toX, toY, signal, opts = {}) {
    await moveCursorTo(fromX, fromY, signal);
    if (signal.aborted) return;

    // Press down & activate drag halo
    renderCursorPosition(fromX, fromY, true);
    showClickHalo(fromX, fromY, 'blue', 28);
    updateDragHalo(fromX, fromY, true);

    dispatchPointer('pointerdown', fromX, fromY, { buttons: 1 });
    dispatchMouse('mousedown', fromX, fromY, { buttons: 1 });
    await sleep(rand(80, 180), signal);
    if (signal.aborted) {
      updateDragHalo(0, 0, false);
      renderCursorPosition(fromX, fromY, false);
      return;
    }

    const dist = Math.hypot(toX - fromX, toY - fromY);
    const steps = Math.max(12, Math.min(80, Math.floor(dist / 8)));
    const cpX = (fromX + toX) / 2 + randf(-dist * 0.16, dist * 0.16);
    const cpY = (fromY + toY) / 2 + randf(-dist * 0.16, dist * 0.16);
    const dragDuration = opts.fast ? rand(140, 280) : rand(320, 680);

    for (let s = 1; s <= steps; s++) {
      if (signal.aborted) {
        updateDragHalo(0, 0, false);
        renderCursorPosition(_cursorX, _cursorY, false);
        return;
      }
      await waitIfPaused();

      const t = s / steps;
      // Smooth human ease-in-out
      const tEased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      const x = (1 - tEased) * (1 - tEased) * fromX + 2 * (1 - tEased) * tEased * cpX + tEased * tEased * toX + randf(-1, 1);
      const y = (1 - tEased) * (1 - tEased) * fromY + 2 * (1 - tEased) * tEased * cpY + tEased * tEased * toY + randf(-1, 1);

      dispatchPointer('pointermove', x, y, { buttons: 1, dragging: true, pressure: 0.5 });
      dispatchMouse('mousemove', x, y, { buttons: 1, dragging: true });
      _cursorX = x;
      _cursorY = y;
      renderCursorPosition(x, y, true);
      updateDragHalo(x, y, true);

      await sleep(Math.max(4, dragDuration / steps), signal);
    }

    if (signal.aborted) {
      updateDragHalo(0, 0, false);
      renderCursorPosition(_cursorX, _cursorY, false);
      return;
    }

    // Release mouse
    updateDragHalo(0, 0, false);
    renderCursorPosition(toX, toY, false);
    showClickHalo(toX, toY, 'purple', 32);

    dispatchPointer('pointerup', toX, toY, { buttons: 0 });
    dispatchMouse('mouseup', toX, toY, { buttons: 0 });
    _cursorX = toX;
    _cursorY = toY;
    await sleep(rand(90, 240), signal);
  }

  /** Press a keyboard shortcut */
  async function pressShortcut(key, mods = {}, signal) {
    const opts = { ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, ...mods };
    const code = key.length === 1 ? `Key${key.toUpperCase()}` : key;
    dispatchKeyboard('keydown', key, { ...opts, code });
    await sleep(rand(35, 85), signal);
    dispatchKeyboard('keyup', key, { ...opts, code });
    await sleep(rand(45, 110), signal);
  }

  /** Scroll or zoom on canvas */
  async function scrollCanvas(signal, zoom = false) {
    const ws = getWorkspaceRect();
    const x = randf(ws.left + 80, ws.right - 80);
    const y = randf(ws.top + 50, ws.bottom - 50);

    await moveCursorTo(x, y, signal, { fast: true });
    if (signal.aborted) return;

    const steps = rand(3, 7);
    for (let i = 0; i < steps; i++) {
      if (signal.aborted) return;
      const delta = randf(-80, 80);
      dispatchWheel(x, y, 0, delta, zoom);
      await sleep(rand(40, 110), signal);
    }
  }

  // ─── Thinking Pauses ────────────────────────────────────────────────────────
  // Authentic hesitation and inspection pauses mimicking real design cognition.

  async function thinkingPause(signal, type = 'short') {
    await waitIfPaused();
    if (signal.aborted) return;

    let ms;
    switch (type) {
      case 'micro':  ms = rand(220, 600);   break;
      case 'short':  ms = rand(700, 2000);  break;
      case 'medium': ms = rand(2000, 4800); break;
      case 'long':   ms = rand(5000, 11000); break;
      case 'idle':   ms = rand(12000, 28000); break;
      default:       ms = rand(500, 2000);
    }

    if (type === 'long' || type === 'idle') {
      const cycles = rand(2, 4);
      const ws = getWorkspaceRect();
      for (let i = 0; i < cycles && !signal.aborted; i++) {
        const pt = randomPointIn(ws, 40);
        await moveCursorTo(pt.x, pt.y, signal, { fast: false });
        await sleep(rand(ms / cycles * 0.5, ms / cycles * 1.1), signal);
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

    // Realistic typing cadence loop
    for (let i = 0; i < charsToType && !signal.aborted; i++) {
      const char = sample[i];

      // 15% chance of making a 1-character typo, noticing, and correcting!
      if (Math.random() < 0.15 && i > 1) {
        const typoChar = String.fromCharCode(char.charCodeAt(0) + rand(-1, 1));
        dispatchKeyboard('keydown', typoChar);
        await sleep(rand(40, 90), signal);
        dispatchKeyboard('keyup', typoChar);

        // Human hesitation upon noticing the typo
        await sleep(rand(220, 480), signal);

        // Hit backspace to delete the mistaken character
        dispatchKeyboard('keydown', 'Backspace', { code: 'Backspace' });
        await sleep(rand(45, 95), signal);
        dispatchKeyboard('keyup', 'Backspace', { code: 'Backspace' });
        await sleep(rand(140, 260), signal);
      }

      // Type correct character
      dispatchKeyboard('keydown', char);
      await sleep(rand(45, 120), signal);
      dispatchKeyboard('keyup', char);

      // Variable inter-keystroke intervals (longer pauses after spaces/punctuation)
      let pauseMs = rand(55, 140);
      if (char === ' ') pauseMs += rand(70, 180);
      if (char === ',' || char === '.') pauseMs += rand(180, 360);
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
      { weight: 8,  fn: () => pressShortcut('z', { ctrlKey: true, shiftKey: true }, signal) },
      { weight: 10, fn: () => pressShortcut('d', { ctrlKey: true }, signal) },
      { weight: 8,  fn: () => pressShortcut('a', { ctrlKey: true }, signal) },
      { weight: 6,  fn: () => pressShortcut('c', { ctrlKey: true }, signal) },
      { weight: 6,  fn: () => pressShortcut('v', { ctrlKey: true }, signal) },
      { weight: 5,  fn: () => pressShortcut(']', { ctrlKey: true }, signal) },
      { weight: 5,  fn: () => pressShortcut('[', { ctrlKey: true }, signal) },
      { weight: 4,  fn: () => pressShortcut('g', { ctrlKey: true }, signal) },
      { weight: 4,  fn: () => pressShortcut('Escape', {}, signal) },
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

  // ─── Action Pool ────────────────────────────────────────────────────────────
  // Weighted to heavily feature color changing, text editing, background adjustment,
  // shape addition, rotation, and organic undo/redo exploration.

  const ACTION_POOL = [
    { weight: 14, label: 'edit-text',         fn: actionEditText },
    { weight: 13, label: 'change-color',      fn: actionChangeColor },
    { weight: 11, label: 'change-background', fn: actionChangeBackground },
    { weight: 10, label: 'add-shape',         fn: actionAddShapeOrGraphic },
    { weight: 11, label: 'select',            fn: actionSelectElement },
    { weight: 11, label: 'move',              fn: actionMoveElement },
    { weight: 8,  label: 'rotate',            fn: actionRotateElement },
    { weight: 8,  label: 'undo-explore',      fn: actionUndoRedoExploration },
    { weight: 8,  label: 'zoom-inspect',      fn: actionZoomAndInspect },
    { weight: 8,  label: 'resize',            fn: actionResizeElement },
    { weight: 7,  label: 'shortcut',          fn: actionKeyboardShortcut },
    { weight: 6,  label: 'draw',              fn: actionDrawShape },
    { weight: 6,  label: 'nudge',             fn: actionArrowNudge },
    { weight: 6,  label: 'toolbar',           fn: actionClickToolbar },
    { weight: 5,  label: 'layers',            fn: actionLayersPanel },
    { weight: 4,  label: 'rubber-select',     fn: actionRubberBandSelect },
    { weight: 4,  label: 'pan',               fn: actionPanCanvas },
    { weight: 4,  label: 'scroll',            fn: actionScroll },
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
    { type: 'micro',  weight: 38 },
    { type: 'short',  weight: 36 },
    { type: 'medium', weight: 16 },
    { type: 'long',   weight: 8  },
    { type: 'idle',   weight: 2  },
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
    designState.totalActions = 0;
    designState.platform = detectPlatform();

    // Lock single-cursor mode and inject click halo overlay
    initCursorOverlay();

    // Broadcast start status
    window.dispatchEvent(new CustomEvent('tbaDesignStatus', {
      detail: { state: 'running', platform: designState.platform }
    }));

    try {
      // Brief human warm-up pause before first action
      await sleep(rand(800, 1800), signal);

      while (!signal.aborted && designState.running) {
        // Enforce session duration limit
        if (Date.now() - designState.sessionStartTime >= designState.sessionDuration) {
          break;
        }

        await waitIfPaused();
        if (signal.aborted) break;

        // Pick and execute human design action
        const action = pickAction();
        try {
          await action.fn(signal);
        } catch (err) {
          if (err.name === 'AbortError') throw err;
          // Non-fatal error; continue session gracefully
        }

        if (signal.aborted || !designState.running) break;

        const elapsed = Date.now() - designState.sessionStartTime;
        const remaining = Math.max(0, designState.sessionDuration - elapsed);
        const pct = Math.min(100, Math.round((elapsed / designState.sessionDuration) * 100));

        // Broadcast live progress
        window.dispatchEvent(new CustomEvent('tbaDesignStatus', {
          detail: {
            state: 'running',
            elapsed,
            remaining,
            pct,
            totalActions: designState.totalActions,
            platform: designState.platform,
            lastAction: action.label,
          }
        }));

        // Human thinking pause between actions
        await thinkingPause(signal, pickPauseType());
      }

      if (!signal.aborted) {
        designState.running = false;
        window.dispatchEvent(new CustomEvent('tbaDesignStatus', {
          detail: { state: 'done', totalActions: designState.totalActions }
        }));
      }

    } catch (err) {
      if (err.name !== 'AbortError') {
        window.dispatchEvent(new CustomEvent('tbaDesignStatus', {
          detail: { state: 'error', message: err.message }
        }));
      }
    } finally {
      // Clean up cursor overlay and restore standard browser cursor
      destroyCursorOverlay();
    }
  }

  // ─── Public API (via window messages) ──────────────────────────────────────

  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data || e.data.tbaDesign === undefined) return;
    const { tbaDesign: cmd } = e.data;

    switch (cmd) {
      case 'start':
        if (designState.running) return;
        designState.running = true;
        designState.paused = false;
        designState.abortController = new AbortController();
        if (e.data.duration) designState.sessionDuration = e.data.duration;
        runDesignLoop().catch(() => {});
        break;

      case 'pause':
        if (!designState.running || designState.paused) return;
        designState.paused = true;
        window.dispatchEvent(new CustomEvent('tbaDesignStatus', {
          detail: { state: 'paused' }
        }));
        break;

      case 'resume':
        if (!designState.paused) return;
        designState.paused = false;
        if (designState.pauseResolve) {
          designState.pauseResolve();
          designState.pauseResolve = null;
        }
        initCursorOverlay();
        window.dispatchEvent(new CustomEvent('tbaDesignStatus', {
          detail: { state: 'running' }
        }));
        break;

      case 'stop':
        if (!designState.running) return;
        designState.running = false;
        designState.paused = false;
        if (designState.abortController) designState.abortController.abort();
        if (designState.pauseResolve) {
          designState.pauseResolve();
          designState.pauseResolve = null;
        }
        destroyCursorOverlay();
        window.dispatchEvent(new CustomEvent('tbaDesignStatus', {
          detail: { state: 'stopped', totalActions: designState.totalActions }
        }));
        break;
    }
  });

  // ─── Relay design status events → chrome.runtime for popup UI ───────────────
  window.addEventListener('tbaDesignStatus', (e) => {
    try {
      chrome.runtime.sendMessage({ action: 'designStatus', detail: e.detail });
    } catch (_) {}
  });

})();
