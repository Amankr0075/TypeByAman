/**
 * TypeByAman — Design Mode Engine
 * Author: Aman Kumar | github.com/Amankr0075
 *
 * Simulates 1 hour of realistic human design activity on web-based
 * design tools (Canva, Figma, Adobe Express, Photoshop web, Picsart, etc.)
 *
 * Capabilities:
 *  - Human-like cursor movement with bezier micro-drift
 *  - Realistic click, double-click, drag & drop sequences
 *  - Keyboard shortcut bursts (Ctrl+Z undo, Ctrl+D duplicate, arrow nudges, etc.)
 *  - Tool-switching clicks in toolbars
 *  - Element selection, resizing (drag corner handles), repositioning
 *  - Color picker / panel interactions
 *  - Scrolling, zooming (Ctrl+scroll)
 *  - Thinking pauses — random idle moments between actions
 *  - Fully randomized timing so no detectable pattern exists
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
  // Identify which design tool is loaded so we can target its specific UI regions

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

  /**
   * Find an element matching one of the selectors, returning the first visible match.
   * Returns null if none found.
   */
  function findVisible(selectors) {
    for (const sel of selectors) {
      try {
        const els = Array.from(document.querySelectorAll(sel));
        const visible = els.find(el => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });
        if (visible) return visible;
      } catch (_) { /* invalid selector — skip */ }
    }
    return null;
  }

  /**
   * Get center coordinates of a DOM element (viewport-relative).
   */
  function center(el) {
    const r = el.getBoundingClientRect();
    return {
      x: r.left + r.width / 2,
      y: r.top + r.height / 2,
    };
  }

  /**
   * Get the main canvas / editable workspace area.
   * Falls back to the viewport center if nothing specific is found.
   */
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
          if (r.width > 100 && r.height > 100) return r;
        }
      } catch (_) {}
    }
    // Fallback: treat the full viewport as the canvas
    return {
      left: 0,
      top: 60,
      right: window.innerWidth,
      bottom: window.innerHeight,
      width: window.innerWidth,
      height: window.innerHeight - 60,
    };
  }

  /** Random point within a DOMRect (with optional margin) */
  function randomPointIn(rect, margin = 20) {
    return {
      x: randf(rect.left + margin, rect.right - margin),
      y: randf(rect.top + margin, rect.bottom - margin),
    };
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
      buttons: options.buttons ?? (type === 'mousedown' || type === 'mousemove' && options.dragging ? 1 : 0),
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
      code: options.code || key,
      ctrlKey: options.ctrlKey || false,
      shiftKey: options.shiftKey || false,
      altKey: options.altKey || false,
      metaKey: options.metaKey || false,
      ...options,
    });
    el.dispatchEvent(ev);
  }

  function dispatchWheel(x, y, deltaX, deltaY) {
    const el = document.elementFromPoint(x, y) || document.body;
    const ev = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      deltaX,
      deltaY,
      deltaMode: 0,
    });
    el.dispatchEvent(ev);
  }

  // ─── Human Cursor Movement ───────────────────────────────────────────────────
  // Moves the cursor from (startX, startY) to (endX, endY) along a
  // slightly curved path with randomized micro-jitter — mimics real mouse drift.

  let _cursorX = window.innerWidth / 2;
  let _cursorY = window.innerHeight / 2;

  async function moveCursorTo(toX, toY, signal, options = {}) {
    const fromX = _cursorX;
    const fromY = _cursorY;
    const dist = Math.hypot(toX - fromX, toY - fromY);
    const steps = Math.max(8, Math.min(60, Math.floor(dist / 12)));
    // Bezier control point: slight curve off the straight line
    const cpX = (fromX + toX) / 2 + randf(-dist * 0.25, dist * 0.25);
    const cpY = (fromY + toY) / 2 + randf(-dist * 0.25, dist * 0.25);
    const baseDuration = options.fast ? rand(60, 150) : rand(180, 450);

    for (let s = 1; s <= steps; s++) {
      if (signal.aborted) return;
      await waitIfPaused();

      const t = s / steps;
      // Quadratic bezier
      const x = (1 - t) * (1 - t) * fromX + 2 * (1 - t) * t * cpX + t * t * toX
               + randf(-1.5, 1.5); // micro-jitter
      const y = (1 - t) * (1 - t) * fromY + 2 * (1 - t) * t * cpY + t * t * toY
               + randf(-1.5, 1.5);

      dispatchPointer('pointermove', x, y);
      dispatchMouse('mousemove', x, y);
      _cursorX = x;
      _cursorY = y;

      const stepDelay = baseDuration / steps + randf(-3, 5);
      await sleep(Math.max(4, stepDelay), signal);
    }

    _cursorX = toX;
    _cursorY = toY;
  }

  // ─── Atomic Actions ─────────────────────────────────────────────────────────

  /** Move to a point and click it */
  async function clickAt(x, y, signal, opts = {}) {
    await moveCursorTo(x, y, signal, opts);
    if (signal.aborted) return;

    dispatchPointer('pointerdown', x, y, { buttons: 1 });
    dispatchMouse('mousedown', x, y, { buttons: 1 });
    await sleep(rand(40, 120), signal);

    dispatchPointer('pointerup', x, y, { buttons: 0 });
    dispatchMouse('mouseup', x, y, { buttons: 0 });
    dispatchMouse('click', x, y);

    if (opts.focus) {
      const el = document.elementFromPoint(x, y);
      if (el && typeof el.focus === 'function') el.focus();
    }

    await sleep(rand(50, 180), signal);
  }

  /** Double-click at a point */
  async function doubleClickAt(x, y, signal) {
    await clickAt(x, y, signal);
    await sleep(rand(60, 120), signal);
    dispatchMouse('dblclick', x, y);
    await sleep(rand(80, 200), signal);
  }

  /**
   * Drag from (fromX, fromY) to (toX, toY) — simulates moving an element
   * or drawing a shape on canvas.
   */
  async function dragFrom(fromX, fromY, toX, toY, signal, opts = {}) {
    await moveCursorTo(fromX, fromY, signal);
    if (signal.aborted) return;

    // Press
    dispatchPointer('pointerdown', fromX, fromY, { buttons: 1 });
    dispatchMouse('mousedown', fromX, fromY, { buttons: 1 });
    await sleep(rand(80, 200), signal);
    if (signal.aborted) return;

    // Drag: move in steps, simulating natural hand speed variance
    const dist = Math.hypot(toX - fromX, toY - fromY);
    const steps = Math.max(10, Math.min(80, Math.floor(dist / 8)));
    const cpX = (fromX + toX) / 2 + randf(-dist * 0.15, dist * 0.15);
    const cpY = (fromY + toY) / 2 + randf(-dist * 0.15, dist * 0.15);
    const dragDuration = opts.fast ? rand(120, 300) : rand(300, 700);

    for (let s = 1; s <= steps; s++) {
      if (signal.aborted) return;
      await waitIfPaused();

      const t = s / steps;
      // Ease-in-out on the drag: slow start, fast middle, slow end
      const tEased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      const x = (1 - tEased) * (1 - tEased) * fromX + 2 * (1 - tEased) * tEased * cpX + tEased * tEased * toX + randf(-1, 1);
      const y = (1 - tEased) * (1 - tEased) * fromY + 2 * (1 - tEased) * tEased * cpY + tEased * tEased * toY + randf(-1, 1);

      dispatchPointer('pointermove', x, y, { buttons: 1, dragging: true, pressure: 0.5 });
      dispatchMouse('mousemove', x, y, { buttons: 1, dragging: true });
      _cursorX = x;
      _cursorY = y;

      await sleep(Math.max(4, dragDuration / steps), signal);
    }

    // Release
    if (signal.aborted) return;
    dispatchPointer('pointerup', toX, toY, { buttons: 0 });
    dispatchMouse('mouseup', toX, toY, { buttons: 0 });
    _cursorX = toX;
    _cursorY = toY;
    await sleep(rand(100, 300), signal);
  }

  /** Press a keyboard shortcut (e.g. Ctrl+Z) */
  async function pressShortcut(key, mods = {}, signal) {
    const opts = { ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, ...mods };
    dispatchKeyboard('keydown', key, { ...opts, code: `Key${key.toUpperCase()}` });
    await sleep(rand(30, 80), signal);
    dispatchKeyboard('keyup', key, { ...opts, code: `Key${key.toUpperCase()}` });
    await sleep(rand(40, 100), signal);
  }

  /** Scroll on the canvas area — simulate zooming with Ctrl+wheel or panning */
  async function scrollCanvas(signal, zoom = false) {
    const ws = getWorkspaceRect();
    const x = randf(ws.left + 100, ws.right - 100);
    const y = randf(ws.top + 60, ws.bottom - 60);

    await moveCursorTo(x, y, signal, { fast: true });
    if (signal.aborted) return;

    const steps = rand(3, 8);
    for (let i = 0; i < steps; i++) {
      if (signal.aborted) return;
      const delta = randf(-80, 80);
      if (zoom) {
        // Ctrl+wheel to zoom
        const ev = new WheelEvent('wheel', {
          bubbles: true, cancelable: true,
          clientX: x, clientY: y,
          deltaY: delta, deltaMode: 0,
          ctrlKey: true,
        });
        (document.elementFromPoint(x, y) || document.body).dispatchEvent(ev);
      } else {
        dispatchWheel(x, y, 0, delta);
      }
      await sleep(rand(40, 120), signal);
    }
  }

  // ─── Thinking Pauses ────────────────────────────────────────────────────────
  // Humans stop to look at their work. These pauses are randomized so
  // they never form a detectable pattern.

  async function thinkingPause(signal, type = 'short') {
    await waitIfPaused();
    if (signal.aborted) return;

    let ms;
    switch (type) {
      case 'micro':  ms = rand(200, 600);  break;  // quick hesitation
      case 'short':  ms = rand(700, 2000); break;  // normal thinking
      case 'medium': ms = rand(2000, 5000); break; // studying the design
      case 'long':   ms = rand(5000, 12000); break; // coffee-moment / distraction
      case 'idle':   ms = rand(12000, 30000); break; // long idle (phone check etc.)
      default:       ms = rand(500, 2000);
    }

    // During a long pause, move the cursor slightly a few times (like hovering to inspect)
    if (type === 'long' || type === 'idle') {
      const cycles = rand(2, 5);
      const ws = getWorkspaceRect();
      for (let i = 0; i < cycles && !signal.aborted; i++) {
        const pt = randomPointIn(ws, 40);
        await moveCursorTo(pt.x, pt.y, signal, { fast: false });
        await sleep(rand(ms / cycles * 0.6, ms / cycles * 1.2), signal);
      }
    } else {
      await sleep(ms, signal);
    }
  }

  // ─── High-Level Design Actions ───────────────────────────────────────────────
  // Each action represents one coherent "thing a designer does".
  // Actions are weighted and randomly selected each iteration.

  /** Click a random element on the canvas — "selecting" something */
  async function actionSelectElement(signal) {
    const ws = getWorkspaceRect();
    const pt = randomPointIn(ws, 30);
    await clickAt(pt.x, pt.y, signal, { focus: true });
    designState.totalActions++;
  }

  /** Drag an element to a new position on the canvas */
  async function actionMoveElement(signal) {
    const ws = getWorkspaceRect();
    const from = randomPointIn(ws, 60);
    const to = {
      x: from.x + randf(-120, 120),
      y: from.y + randf(-80, 80),
    };
    // Clamp to workspace
    to.x = Math.max(ws.left + 20, Math.min(ws.right - 20, to.x));
    to.y = Math.max(ws.top + 20, Math.min(ws.bottom - 20, to.y));
    await dragFrom(from.x, from.y, to.x, to.y, signal);
    designState.totalActions++;
  }

  /**
   * Drag a corner/edge handle to resize — starts near the corner of a
   * randomly chosen area on the canvas.
   */
  async function actionResizeElement(signal) {
    const ws = getWorkspaceRect();
    // Pretend there's a handle near a random point
    const baseX = randf(ws.left + 80, ws.right - 80);
    const baseY = randf(ws.top + 80, ws.bottom - 80);
    const size = rand(60, 180);
    // Pick a corner
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

  /** Draw a new shape by click-drag on the canvas */
  async function actionDrawShape(signal) {
    const ws = getWorkspaceRect();
    const from = randomPointIn(ws, 80);
    const to = {
      x: from.x + randf(50, 200),
      y: from.y + randf(40, 150),
    };
    to.x = Math.min(ws.right - 20, to.x);
    to.y = Math.min(ws.bottom - 20, to.y);
    await dragFrom(from.x, from.y, to.x, to.y, signal, { fast: false });
    await thinkingPause(signal, 'micro');
    designState.totalActions++;
  }

  /** Nudge selected element with arrow keys (pixel-perfect positioning) */
  async function actionArrowNudge(signal) {
    const arrows = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
    const dir = pick(arrows);
    const times = rand(1, 8);
    const useShift = Math.random() < 0.3; // Shift = 10px nudge in most tools

    for (let i = 0; i < times; i++) {
      if (signal.aborted) return;
      dispatchKeyboard('keydown', dir, { shiftKey: useShift, code: dir });
      await sleep(rand(40, 120), signal);
      dispatchKeyboard('keyup', dir, { shiftKey: useShift, code: dir });
      await sleep(rand(30, 90), signal);
    }
    designState.totalActions++;
  }

  /**
   * Press a common design-tool keyboard shortcut.
   * Shortcuts are weighted: undo is common, complex shortcuts are rare.
   */
  async function actionKeyboardShortcut(signal) {
    const shortcuts = [
      // Very common
      { weight: 20, fn: () => pressShortcut('z', { ctrlKey: true }, signal) },  // Undo
      { weight: 8,  fn: () => pressShortcut('z', { ctrlKey: true, shiftKey: true }, signal) }, // Redo
      { weight: 10, fn: () => pressShortcut('d', { ctrlKey: true }, signal) },  // Duplicate
      { weight: 8,  fn: () => pressShortcut('a', { ctrlKey: true }, signal) },  // Select all
      { weight: 6,  fn: () => pressShortcut('c', { ctrlKey: true }, signal) },  // Copy
      { weight: 6,  fn: () => pressShortcut('v', { ctrlKey: true }, signal) },  // Paste
      // Moderate
      { weight: 4,  fn: () => pressShortcut('g', { ctrlKey: true }, signal) },  // Group
      { weight: 3,  fn: () => pressShortcut('g', { ctrlKey: true, shiftKey: true }, signal) }, // Ungroup
      { weight: 3,  fn: () => pressShortcut('[', { ctrlKey: true }, signal) },  // Send backward
      { weight: 3,  fn: () => pressShortcut(']', { ctrlKey: true }, signal) },  // Bring forward
      { weight: 4,  fn: () => pressShortcut('=', { ctrlKey: true }, signal) },  // Zoom in
      { weight: 4,  fn: () => pressShortcut('-', { ctrlKey: true }, signal) },  // Zoom out
      { weight: 3,  fn: () => pressShortcut('0', { ctrlKey: true }, signal) },  // Fit to screen
      // Rare
      { weight: 2,  fn: () => pressShortcut('Delete', {}, signal) },            // Delete element
      { weight: 2,  fn: () => pressShortcut('Escape', {}, signal) },            // Deselect
      { weight: 1,  fn: () => pressShortcut('f', {}, signal) },                 // Frame tool (Figma)
      { weight: 1,  fn: () => pressShortcut('r', {}, signal) },                 // Rectangle tool
      { weight: 1,  fn: () => pressShortcut('t', {}, signal) },                 // Text tool
      { weight: 1,  fn: () => pressShortcut('v', {}, signal) },                 // Select tool
    ];

    // Weighted random pick
    const totalWeight = shortcuts.reduce((sum, s) => sum + s.weight, 0);
    let rng = Math.random() * totalWeight;
    for (const s of shortcuts) {
      rng -= s.weight;
      if (rng <= 0) { await s.fn(); break; }
    }
    designState.totalActions++;
  }

  /** Click a toolbar button (left panel / top bar area) */
  async function actionClickToolbar(signal) {
    // Generic toolbar hit zones — top bar and left sidebar
    const zones = [
      // Top toolbar strip
      { x: randf(50, window.innerWidth * 0.8), y: randf(8, 50) },
      // Left sidebar
      { x: randf(8, 55), y: randf(80, window.innerHeight * 0.85) },
      // Right panel (properties)
      { x: randf(window.innerWidth - 260, window.innerWidth - 20), y: randf(80, window.innerHeight * 0.85) },
    ];
    const zone = pick(zones);
    await clickAt(zone.x, zone.y, signal, { fast: true });
    designState.totalActions++;
  }

  /** Scroll the canvas / viewport */
  async function actionScroll(signal) {
    const useZoom = Math.random() < 0.25;
    await scrollCanvas(signal, useZoom);
    designState.totalActions++;
  }

  /** Double-click an element to enter text editing mode, then "type" a few chars */
  async function actionEditText(signal) {
    const ws = getWorkspaceRect();
    const pt = randomPointIn(ws, 60);
    await doubleClickAt(pt.x, pt.y, signal);
    if (signal.aborted) return;

    await thinkingPause(signal, 'micro');

    // Type a few realistic characters and then stop (simulating editing a label)
    const textSamples = [
      'Heading', 'Title', 'Subtitle', 'Button', 'Label',
      'Section', 'Caption', 'Design', 'Brand', 'Logo',
      'Contact', 'About', 'Home', 'Hero', 'CTA',
    ];
    const sample = pick(textSamples);
    for (let i = 0; i < rand(3, sample.length) && !signal.aborted; i++) {
      dispatchKeyboard('keydown', sample[i], { code: `Key${sample[i].toUpperCase()}` });
      await sleep(rand(60, 180), signal);
      dispatchKeyboard('keyup', sample[i], { code: `Key${sample[i].toUpperCase()}` });
      await sleep(rand(30, 120), signal);
    }

    // 40% chance to press Escape to exit text mode
    if (Math.random() < 0.4) {
      await sleep(rand(200, 500), signal);
      dispatchKeyboard('keydown', 'Escape', { code: 'Escape' });
      await sleep(60, signal);
      dispatchKeyboard('keyup', 'Escape', { code: 'Escape' });
    }
    designState.totalActions++;
  }

  /** Click a color swatch / color panel area */
  async function actionPickColor(signal) {
    // Try to find a color panel; fall back to right-panel region
    const colorSel = findVisible([
      '[class*="color-picker"]', '[class*="colorPicker"]',
      '[class*="fill"]', '[class*="color-swatch"]',
      '[class*="colorSwatch"]', '[data-testid*="color"]',
      '[class*="color-panel"]', '[class*="palette"]',
    ]);

    if (colorSel) {
      const c = center(colorSel);
      await clickAt(c.x, c.y, signal);
    } else {
      // Click in the right panel area where colors usually live
      await clickAt(
        randf(window.innerWidth - 240, window.innerWidth - 20),
        randf(120, window.innerHeight * 0.6),
        signal, { fast: true }
      );
    }

    await thinkingPause(signal, 'short');

    // Dismiss / close any opened picker
    if (Math.random() < 0.5) {
      dispatchKeyboard('keydown', 'Escape', { code: 'Escape' });
      await sleep(80, signal);
      dispatchKeyboard('keyup', 'Escape', { code: 'Escape' });
    }
    designState.totalActions++;
  }

  /** Pan around the canvas by middle-mouse drag or spacebar+drag */
  async function actionPanCanvas(signal) {
    const ws = getWorkspaceRect();
    const from = randomPointIn(ws, 60);
    const to = {
      x: from.x + randf(-150, 150),
      y: from.y + randf(-100, 100),
    };
    // Hold space (panning in many tools)
    dispatchKeyboard('keydown', ' ', { code: 'Space' });
    await sleep(80, signal);
    await dragFrom(from.x, from.y, to.x, to.y, signal, { fast: false });
    dispatchKeyboard('keyup', ' ', { code: 'Space' });
    designState.totalActions++;
  }

  /** Multi-select by drawing a selection rectangle */
  async function actionRubberBandSelect(signal) {
    const ws = getWorkspaceRect();
    const from = randomPointIn(ws, 40);
    const size = { w: rand(80, 250), h: rand(60, 200) };
    const to = {
      x: Math.min(ws.right - 20, from.x + size.w),
      y: Math.min(ws.bottom - 20, from.y + size.h),
    };
    await dragFrom(from.x, from.y, to.x, to.y, signal, { fast: false });
    await thinkingPause(signal, 'micro');
    designState.totalActions++;
  }

  /** Hover & inspect — just move cursor slowly around the canvas */
  async function actionInspect(signal) {
    const ws = getWorkspaceRect();
    const stops = rand(2, 5);
    for (let i = 0; i < stops && !signal.aborted; i++) {
      const pt = randomPointIn(ws, 30);
      await moveCursorTo(pt.x, pt.y, signal, { fast: false });
      await thinkingPause(signal, 'micro');
    }
    designState.totalActions++;
  }

  /** Open the layers / pages panel and click around */
  async function actionLayersPanel(signal) {
    const layersSel = findVisible([
      '[class*="layers"]', '[data-testid*="layers"]',
      '[class*="page-panel"]', '[class*="panel-layers"]',
      '[aria-label*="Layers"]', '[class*="sidebar"]',
    ]);

    if (layersSel) {
      const c = center(layersSel);
      await clickAt(c.x, c.y, signal);
      await thinkingPause(signal, 'short');
      // Click a couple of items
      const clicks = rand(1, 3);
      for (let i = 0; i < clicks && !signal.aborted; i++) {
        const r = layersSel.getBoundingClientRect();
        await clickAt(randf(r.left + 10, r.right - 10), randf(r.top + 10, r.bottom - 10), signal);
        await sleep(rand(200, 600), signal);
      }
    } else {
      // Fallback: click in left sidebar area
      await clickAt(randf(8, 55), randf(100, window.innerHeight * 0.8), signal);
    }
    designState.totalActions++;
  }

  // ─── Action Pool ────────────────────────────────────────────────────────────
  // Each entry: { weight, fn }  — higher weight = more frequent

  const ACTION_POOL = [
    { weight: 20, label: 'select',     fn: actionSelectElement },
    { weight: 15, label: 'move',       fn: actionMoveElement },
    { weight: 12, label: 'shortcut',   fn: actionKeyboardShortcut },
    { weight: 10, label: 'resize',     fn: actionResizeElement },
    { weight: 10, label: 'inspect',    fn: actionInspect },
    { weight: 8,  label: 'draw',       fn: actionDrawShape },
    { weight: 8,  label: 'nudge',      fn: actionArrowNudge },
    { weight: 8,  label: 'scroll',     fn: actionScroll },
    { weight: 7,  label: 'toolbar',    fn: actionClickToolbar },
    { weight: 6,  label: 'text-edit',  fn: actionEditText },
    { weight: 5,  label: 'color',      fn: actionPickColor },
    { weight: 4,  label: 'rubber',     fn: actionRubberBandSelect },
    { weight: 3,  label: 'pan',        fn: actionPanCanvas },
    { weight: 3,  label: 'layers',     fn: actionLayersPanel },
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
  // Between actions, pick the pause type based on weighted chance so the
  // session feels natural — mostly micro pauses, occasional long stops.

  const PAUSE_WEIGHTS = [
    { type: 'micro',  weight: 40 },
    { type: 'short',  weight: 35 },
    { type: 'medium', weight: 15 },
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

    // Broadcast start
    window.dispatchEvent(new CustomEvent('tbaDesignStatus', {
      detail: { state: 'running', platform: designState.platform }
    }));

    try {
      // Brief warm-up before first action
      await sleep(rand(800, 2000), signal);

      while (!signal.aborted && designState.running) {
        // Check 1-hour session limit
        if (Date.now() - designState.sessionStartTime >= designState.sessionDuration) {
          break;
        }

        await waitIfPaused();
        if (signal.aborted) break;

        // Pick and execute a random design action
        const action = pickAction();
        try {
          await action.fn(signal);
        } catch (err) {
          if (err.name === 'AbortError') throw err;
          // Non-fatal: action threw but session continues
        }

        if (signal.aborted || !designState.running) break;

        // Compute elapsed & remaining
        const elapsed = Date.now() - designState.sessionStartTime;
        const remaining = Math.max(0, designState.sessionDuration - elapsed);
        const pct = Math.min(100, Math.round((elapsed / designState.sessionDuration) * 100));

        // Broadcast progress
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

        // Thinking pause between actions
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
    }
  }

  // ─── Public API (via window messages from content/popup) ────────────────────

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
        window.dispatchEvent(new CustomEvent('tbaDesignStatus', {
          detail: { state: 'running' }
        }));
        break;

      case 'stop':
        if (!designState.running) return;
        designState.running = false;
        designState.paused = false;
        if (designState.abortController) designState.abortController.abort();
        if (designState.pauseResolve) { designState.pauseResolve(); designState.pauseResolve = null; }
        window.dispatchEvent(new CustomEvent('tbaDesignStatus', {
          detail: { state: 'stopped', totalActions: designState.totalActions }
        }));
        break;
    }
  });

  // ─── Relay design status events → chrome.runtime for popup ─────────────────
  window.addEventListener('tbaDesignStatus', (e) => {
    try {
      chrome.runtime.sendMessage({ action: 'designStatus', detail: e.detail });
    } catch (_) {}
  });

})();
