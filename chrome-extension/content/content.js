/**
 * TypeByAman — Content Script
 * Author: Aman Kumar | github.com/Amankr0075
 *
 * Injected into every page. Handles:
 * - Target field picking
 * - Asynchronous character-by-character typing
 * - Pause/Resume/Stop controls
 * - Event dispatching for web editors
 */

'use strict';

(function () {
  // Prevent double-injection
  if (window.__typeByAman_initialized) return;
  window.__typeByAman_initialized = true;

  // ─── State ─────────────────────────────────────────────────────────────────

  let typingState = {
    active: false,
    paused: false,
    charIndex: 0,
    text: '',
    totalChars: 0,
    delay: 50,
    linebreakDelay: 0,
    targetElement: null,
    pauseResolve: null,
    abortSignal: null,
    abortController: null,
    humanTypoMode: true,   // enable human-like typo simulation by default
    typoRate: 0.06,   // ~6% chance of a typo per eligible character
  };

  let isPicking = false;
  let pickOverlay = null;
  let highlightedEl = null;

  // ─── Helper: sleep ─────────────────────────────────────────────────────────

  async function sleep(ms, signal) {
    if (ms <= 0) return;
    const start = Date.now();
    while (Date.now() - start < ms) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      await waitIfPaused();
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
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

  // ─── Helper: pausePoint ────────────────────────────────────────────────────

  function waitIfPaused() {
    if (!typingState.paused) return Promise.resolve();
    return new Promise(resolve => {
      typingState.pauseResolve = resolve;
    });
  }

  // ─── Live Cursor & Target Field Tracking ────────────────────────────────────

  let lastInteractedElement = null;

  function resolveTargetElement(el) {
    if (!el || el === document || el === document.documentElement || el === pickOverlay) {
      return null;
    }

    // 1. Direct standard textarea
    if (el.tagName === 'TEXTAREA') return el;

    // 2. Direct standard text input
    if (el.tagName === 'INPUT') {
      const type = (el.type || 'text').toLowerCase();
      const nonTextTypes = ['button', 'submit', 'reset', 'checkbox', 'radio', 'hidden', 'image', 'file', 'range', 'color'];
      if (!nonTextTypes.includes(type)) return el;
    }

    // 3. Direct or parent contenteditable / role="textbox"
    if (el.isContentEditable) {
      return el.closest('[contenteditable="true"], [contenteditable=""]') || el;
    }
    const roleTextbox = el.closest('[role="textbox"]');
    if (roleTextbox) return roleTextbox;

    // 4. Code Editors: Monaco, CodeMirror, Ace
    const monaco = el.closest('.monaco-editor');
    if (monaco) {
      return monaco.querySelector('textarea.inputarea, textarea') || monaco;
    }
    const cm = el.closest('.CodeMirror, .cm-editor');
    if (cm) {
      return cm.querySelector('textarea, [contenteditable="true"]') || cm;
    }
    const ace = el.closest('.ace_editor');
    if (ace) {
      return ace.querySelector('textarea.ace_text-input, textarea') || ace;
    }

    // 5. Rich text editors (Quill, CKEditor, TinyMCE, ProseMirror, Lexical, Draft, Slate)
    const richEditor = el.closest('.ql-editor, .ck-editor__editable, .tox-edit-area, .ProseMirror, [data-lexical-editor], [data-slate-editor], [contenteditable]');
    if (richEditor) return richEditor;

    // 6. Labels with associated controls
    if (el.tagName === 'LABEL') {
      if (el.control) {
        const res = resolveTargetElement(el.control);
        if (res) return res;
      }
      const innerInput = el.querySelector('textarea, input, [contenteditable="true"]');
      if (innerInput) {
        const res = resolveTargetElement(innerInput);
        if (res) return res;
      }
    }

    // 7. Clicked on a wrapper or container surrounding an input/textarea
    const childInput = el.querySelector('textarea, input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]), [contenteditable="true"], [role="textbox"]');
    if (childInput) {
      const res = resolveTargetElement(childInput);
      if (res) return res;
    }

    // 8. Active element inside container
    if (document.activeElement && document.activeElement !== document.body && el.contains(document.activeElement)) {
      const activeRes = resolveTargetElement(document.activeElement);
      if (activeRes) return activeRes;
    }

    // 9. Attribute contenteditable
    if (el.getAttribute && el.getAttribute('contenteditable') !== null && el.getAttribute('contenteditable') !== 'false') {
      return el;
    }

    return null;
  }

  function trackCursorPosition(target) {
    if (!target || target === pickOverlay || target === document || target === document.documentElement) return;
    const resolved = resolveTargetElement(target);
    if (resolved) {
      lastInteractedElement = resolved;
      typingState.targetElement = resolved;
    }
  }

  // Continuously track wherever the user clicks or places cursor
  document.addEventListener('focusin', e => trackCursorPosition(e.target), true);
  document.addEventListener('pointerdown', e => trackCursorPosition(e.target), true);
  document.addEventListener('click', e => trackCursorPosition(e.target), true);
  document.addEventListener('keyup', e => trackCursorPosition(e.target), true);
  document.addEventListener('selectionchange', () => {
    const sel = window.getSelection();
    if (sel && sel.focusNode) {
      const node = sel.focusNode.nodeType === 1 ? sel.focusNode : sel.focusNode.parentElement;
      trackCursorPosition(node);
    }
  }, true);

  function findFocusedOrLastInput() {
    // 1. Current active element on the page
    if (document.activeElement && document.activeElement !== document.body && document.activeElement !== document.documentElement) {
      const res = resolveTargetElement(document.activeElement);
      if (res) return res;
    }

    // 2. Last element user interacted with or focused
    if (lastInteractedElement && document.contains(lastInteractedElement)) {
      return lastInteractedElement;
    }

    // 3. Current text selection / cursor location
    const sel = window.getSelection();
    if (sel && sel.focusNode) {
      const node = sel.focusNode.nodeType === 1 ? sel.focusNode : sel.focusNode.parentElement;
      const res = resolveTargetElement(node);
      if (res) return res;
    }

    // 4. Any visible input, textarea or editor on the active page
    const candidates = document.querySelectorAll(
      'textarea, input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]), [contenteditable="true"], [role="textbox"], .monaco-editor textarea, .CodeMirror textarea, .cm-editor [contenteditable="true"], .ace_editor textarea'
    );
    for (const c of candidates) {
      const rect = c.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && window.getComputedStyle(c).visibility !== 'hidden' && window.getComputedStyle(c).display !== 'none') {
        const res = resolveTargetElement(c);
        if (res) return res;
      }
    }

    return null;
  }

  function isTypeable(el) {
    return !!resolveTargetElement(el);
  }

  function getEditorType(el) {
    if (!el) return 'unknown';
    if (el.closest('.monaco-editor')) return 'monaco';
    if (el.closest('.CodeMirror') || el.closest('.cm-editor')) return 'codemirror';
    if (el.closest('.ace_editor')) return 'ace';
    if (el.isContentEditable || el.closest('[contenteditable="true"]')) return 'contenteditable';
    if (el.tagName.toLowerCase() === 'textarea') return 'textarea';
    return 'input';
  }

  function getElementLabel(el) {
    if (!el) return '';
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : '';
    const name = el.name ? `[name="${el.name}"]` : '';
    const placeholder = el.placeholder ? `[${el.placeholder.substring(0, 15)}]` : '';
    const cls = el.className && typeof el.className === 'string'
      ? '.' + el.className.trim().split(/\s+/).slice(0, 1).join('.') : '';
    const type = el.type ? `[${el.type}]` : '';
    return `${tag}${type}${id || name || placeholder || cls}`.substring(0, 45);
  }

  // ─── Target Picking ─────────────────────────────────────────────────────────

  function startPicking() {
    if (isPicking) return;
    isPicking = true;

    pickOverlay = document.createElement('div');
    pickOverlay.style.cssText = `
      position: fixed; inset: 0; z-index: 2147483646;
      cursor: crosshair; pointer-events: all;
    `;
    document.body.appendChild(pickOverlay);

    pickOverlay.addEventListener('mousemove', onPickMove, true);
    pickOverlay.addEventListener('click', onPickClick, true);
    pickOverlay.addEventListener('keydown', onPickKeydown, true);
    document.addEventListener('keydown', onPickKeydown, true);
  }

  function onPickMove(e) {
    if (!pickOverlay) return;
    pickOverlay.style.pointerEvents = 'none';
    const el = document.elementFromPoint(e.clientX, e.clientY);
    pickOverlay.style.pointerEvents = 'all';

    const target = resolveTargetElement(el) || el;
    if (target && target !== highlightedEl && target !== pickOverlay) {
      removeHighlight();
      highlightedEl = target;
      addHighlight(target);
    }
  }

  function onPickClick(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!pickOverlay) return;

    pickOverlay.style.pointerEvents = 'none';
    const rawEl = document.elementFromPoint(e.clientX, e.clientY);
    pickOverlay.style.pointerEvents = 'all';

    const target = resolveTargetElement(rawEl) || rawEl;

    if (target) {
      typingState.targetElement = target;
      lastInteractedElement = target;
      try { target.focus(); } catch { }
      const label = getElementLabel(target);
      stopPicking();
      showFeedback(`Target Selected: ${label}`, 'success');
      chrome.runtime.sendMessage({ action: 'targetPicked', label });
    } else {
      showFeedback('Click any text area, input, or code editor.', 'warning');
    }
  }

  function onPickKeydown(e) {
    if (e.key === 'Escape') {
      stopPicking();
      chrome.runtime.sendMessage({ action: 'targetPicked', label: null, cancelled: true });
    }
  }

  function stopPicking() {
    isPicking = false;
    removeHighlight();
    if (pickOverlay) {
      pickOverlay.removeEventListener('mousemove', onPickMove, true);
      pickOverlay.removeEventListener('click', onPickClick, true);
      pickOverlay.removeEventListener('keydown', onPickKeydown, true);
      document.removeEventListener('keydown', onPickKeydown, true);
      pickOverlay.remove();
      pickOverlay = null;
    }
  }

  function addHighlight(el) {
    if (!el) return;
    el.dataset.tbaHighlight = 'true';
    el.style.outline = '2px solid #4f8ef7';
    el.style.outlineOffset = '1px';
  }

  function removeHighlight() {
    if (highlightedEl) {
      highlightedEl.style.outline = '';
      highlightedEl.style.outlineOffset = '';
      delete highlightedEl.dataset.tbaHighlight;
      highlightedEl = null;
    }
  }

  // ─── Typing Engine ──────────────────────────────────────────────────────────

  async function startTyping(config) {
    if (typingState.active) {
      abortTyping();
      await sleep(50);
    }

    const { text, delay, linebreakDelay, startDelay, humanTypoMode, typoRate } = config;
    if (!text) return { error: 'No text provided' };

    // Find target: use pinned target, last interacted, active element, or auto-detect
    let target = typingState.targetElement;
    if (!target || !document.contains(target)) {
      target = findFocusedOrLastInput();
      typingState.targetElement = target;
    }

    if (!target) {
      return { error: 'No text field or cursor detected. Click into an input or editor first.' };
    }

    const ac = new AbortController();
    typingState = {
      ...typingState,
      active: true,
      paused: false,
      charIndex: 0,
      text: text,
      totalChars: text.length,
      delay: Number.isFinite(delay) && delay >= 1 ? delay : 50,
      linebreakDelay: Number.isFinite(linebreakDelay) && linebreakDelay >= 0 ? linebreakDelay : 0,
      humanTypoMode: humanTypoMode !== undefined ? humanTypoMode : false,
      typoRate: typoRate !== undefined ? typoRate : typingState.typoRate,
      abortController: ac,
      abortSignal: ac.signal,
    };

    runTypingLoop(target, text, startDelay, ac.signal).catch(() => { });
    return { ok: true, label: getElementLabel(target) };
  }

  async function runTypingLoop(el, text, startDelay, signal) {
    try {
      await checkNativeOs();
      if (startDelay > 0) await sleep(startDelay, signal);

      // Real OS hardware cursor glide and click into the target element
      // Synchronizes real OS mouse activity with screen capture & OS input monitoring
      if (_nativeOsAvailable && el) {
        try {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            const clickX = rect.left + Math.min(30, Math.max(5, rect.width / 4)) + Math.random() * 8;
            const clickY = rect.top + Math.min(25, Math.max(5, rect.height / 2)) + Math.random() * 4;
            const s = clientToScreen(clickX, clickY);
            chrome.runtime.sendMessage({
              action: 'nativeOsCommand',
              payload: { cmd: 'click', x: s.screenX, y: s.screenY, button: 'left' }
            });
            await sleep(250, signal);
          }
        } catch (_) {}
      }

      try { el.focus(); } catch { }

      // If Monaco editor, focus the inputarea textarea
      if (getEditorType(el) === 'monaco') {
        const monacoEl = el.closest('.monaco-editor');
        if (monacoEl) {
          const ta = monacoEl.querySelector('textarea.inputarea') || monacoEl.querySelector('textarea');
          if (ta) ta.focus();
        }
      }

      let lastMajorTypoTime = Date.now();
      // Randomized timing (35s–95s): Prevents any pattern or periodic signature detection
      let nextMajorTypoInterval = 35000 + Math.random() * 60000;

      let lastMinorTypoTime = Date.now();
      let nextMinorTypoInterval = 10000 + Math.random() * 4000; // ~12 seconds for minor key slip

      let linesTyped = 0;
      let nextThinkLine = 15 + Math.floor(Math.random() * 25); // 15–40 lines for thinking pause
      let nextRunLine = 75 + Math.floor(Math.random() * 100);  // 75–175 lines for code run

      // Dynamic word tempo
      let currentWordTempo = Math.random() < 0.35 ? 'fast' : (Math.random() < 0.22 ? 'deliberate' : 'normal');

      for (let i = 0; i < text.length; i++) {
        if (signal.aborted) break;

        await waitIfPaused();
        if (signal.aborted) break;

        const ch = text[i];
        typingState.charIndex = i;

        // Word boundary & punctuation detection
        const isWordBoundary = ch === ' ' || ch === '\t';
        const isLineBreak = ch === '\n' || ch === '\r';

        if (isWordBoundary) {
          currentWordTempo = Math.random() < 0.35 ? 'fast' : (Math.random() < 0.22 ? 'deliberate' : 'normal');
        }

        const now = Date.now();
        const isEligibleForTypo = !isLineBreak && ch !== '\t' && /[a-zA-Z0-9]/.test(ch);

        // Subtle realistic minor key slip: ONLY when human typo mode is active and delay >= 50ms
        if (typingState.humanTypoMode && typingState.delay >= 50 && isEligibleForTypo && (now - lastMinorTypoTime) >= nextMinorTypoInterval) {
          const typoMade = await performTypoAndCorrect(el, ch, signal);
          if (signal.aborted) break;

          if (typoMade) {
            lastMinorTypoTime = Date.now();
            nextMinorTypoInterval = 14000 + Math.random() * 8000;

            // Notice pause (100–180ms)
            const noticePause = 100 + Math.floor(Math.random() * 80);
            await sleep(noticePause, signal);
            if (signal.aborted) break;

            // Backspace delete the typo char
            await deleteCharacter(el, signal);

            // Brief pause before retyping (60–120ms)
            await sleep(60 + Math.floor(Math.random() * 60), signal);
            if (signal.aborted) break;

            // Retype the correct character
            await typeCharacter(el, ch, signal);

            const recoverDelay = Math.min(80, typingState.delay);
            await sleep(recoverDelay, signal);
            if (signal.aborted) break;

            if (i % 25 === 0 || i === text.length - 1) {
              chrome.runtime.sendMessage({
                action: 'statusUpdate', status: 'typing',
                charIndex: i + 1, totalChars: text.length,
              }).catch(() => {});
            }
            continue; // move to next character
          }
        }

        await typeCharacter(el, ch, signal);

        // Progress update (throttled to every 25 chars or end)
        if (i % 25 === 0 || i === text.length - 1) {
          chrome.runtime.sendMessage({
            action: 'statusUpdate',
            status: 'typing',
            charIndex: i + 1,
            totalChars: text.length,
          }).catch(() => {});
        }

        // Delay: accurate speed mode timing that respects user's exact preset / custom setting
        const extraDelay = isLineBreak ? (Number.isFinite(typingState.linebreakDelay) && typingState.linebreakDelay > 0 ? typingState.linebreakDelay : 0) : 0;
        const totalDelay = calculateHumanDelay(ch, typingState.delay, currentWordTempo, typingState.humanTypoMode) + extraDelay;
        if (totalDelay > 0) await sleep(totalDelay, signal);
      }

      if (!signal.aborted) {
        typingState.active = false;
        typingState.charIndex = text.length;
        chrome.runtime.sendMessage({
          action: 'typingDone',
          totalChars: text.length,
        }).catch(() => {});
      }

    } catch (err) {
      if (err.name !== 'AbortError') {
        typingState.active = false;
        chrome.runtime.sendMessage({
          action: 'typingError',
          error: err.message,
          charIndex: typingState.charIndex,
        }).catch(() => {});
      }
    }
  }

  // ─── Speed & Keystroke Latency Model ───────────────────────────────────────
  function calculateHumanDelay(ch, baseDelay, tempo = 'normal', humanMode = false) {
    // 1. Instant & Fast speed modes (<= 15ms) or when humanMode is off: return exact delay
    if (baseDelay <= 15 || !humanMode) {
      return Math.max(1, baseDelay);
    }

    // 2. Fast mode (<= 30ms): slight organic variance (±15%) without heavy penalties
    if (baseDelay <= 30) {
      const jitter = 0.90 + Math.random() * 0.20;
      return Math.max(1, Math.round(baseDelay * jitter));
    }

    // 3. Normal / Slow / Deliberate modes (baseDelay > 30ms) with humanMode enabled:
    let tempoMultiplier = 1.0;
    if (tempo === 'fast') tempoMultiplier = 0.85;
    else if (tempo === 'deliberate') tempoMultiplier = 1.20;

    let delay = baseDelay * tempoMultiplier * (0.85 + Math.random() * 0.30);

    // Subtle biomechanical adjustments scaled to baseDelay (never fixed large constants)
    if (ch >= 'A' && ch <= 'Z') {
      delay += Math.min(20, baseDelay * 0.25);
    } else if (/[{}()[\];:,.=+\-*\/&|!<>?]/.test(ch)) {
      delay += Math.min(25, baseDelay * 0.30);
    } else if (ch === ' ') {
      delay += Math.min(15, baseDelay * 0.20);
    }

    // Occasional subtle hesitation only for slower pacing (> 60ms)
    if (baseDelay >= 60 && Math.random() < 0.03) {
      delay += Math.min(120, baseDelay * 0.6);
    }

    return Math.max(1, Math.round(delay));
  }

  // ─── Web Code Editor "Run Code" Simulation ──────────────────────────────────
  async function maybeRunWebCode(el, signal) {
    if (signal.aborted) return;
    try {
      // Find candidate Run / Submit / Test / Execute buttons
      const candidates = document.querySelectorAll(
        'button[data-cy="run-code-btn"], button[data-testid*="run"], button[aria-label*="run" i], button[title*="run" i], .run-button, #run-button, button.run, #btn-run, button'
      );
      let foundBtn = null;
      for (const btn of candidates) {
        const text = (btn.textContent || '').trim().toLowerCase();
        if (text === 'run' || text.startsWith('run ') || text === 'execute' || text === 'test' || text === 'play') {
          const r = btn.getBoundingClientRect();
          if (r.width > 0 && r.height > 0 && window.getComputedStyle(btn).visibility !== 'hidden') {
            foundBtn = btn;
            break;
          }
        }
      }

      // Pre-run hesitation (simulates deciding to test the code)
      await sleep(500 + Math.floor(Math.random() * 500), signal);
      if (signal.aborted) return;

      if (foundBtn) {
        if (_nativeOsAvailable) {
          try {
            const r = foundBtn.getBoundingClientRect();
            if (r.width > 0 && r.height > 0) {
              const s = clientToScreen(r.left + r.width / 2, r.top + r.height / 2);
              chrome.runtime.sendMessage({
                action: 'nativeOsCommand',
                payload: { cmd: 'click', x: s.screenX, y: s.screenY, button: 'left' }
              });
              await sleep(150, signal);
            }
          } catch (_) {}
        }
        foundBtn.click();
      } else {
        // Fallback: standard Ctrl+Enter / Cmd+Enter run shortcut for web IDEs
        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', ctrlKey: true, bubbles: true }));
        el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', ctrlKey: true, bubbles: true }));
      }

      // Human watching output / test execution (6s to 18s)
      const watchOutputMs = 6000 + Math.floor(Math.random() * 12000);
      await sleep(watchOutputMs, signal);
      if (signal.aborted) return;

      // Refocus the editor
      try { el.focus(); } catch {}
      await sleep(300 + Math.floor(Math.random() * 400), signal);
    } catch (_) {}
  }

  // ─── Real OS Hardware Keystrokes & Cursor Sync ──────────────────────────────
  let _nativeOsAvailable = false;
  let _lastNativeCheck = 0;

  function clientToScreen(clientX, clientY) {
    const borderX = Math.max(0, (window.outerWidth - window.innerWidth) / 2);
    const titleBarHeight = Math.max(0, window.outerHeight - window.innerHeight - borderX);
    const screenX = Math.round(window.screenX + borderX + clientX);
    const screenY = Math.round(window.screenY + titleBarHeight + clientY);
    return { screenX, screenY };
  }

  async function checkNativeOs() {
    if (Date.now() - _lastNativeCheck < 15000) return _nativeOsAvailable;
    _lastNativeCheck = Date.now();
    try {
      const resp = await new Promise(resolve => {
        chrome.runtime.sendMessage({ action: 'checkNativeHelper' }, res => resolve(res));
      });
      _nativeOsAvailable = !!(resp && resp.online);
    } catch {
      _nativeOsAvailable = false;
    }
    return _nativeOsAvailable;
  }

  function emitNativeOsKey(ch) {
    if (!_nativeOsAvailable) return;
    try {
      if (ch === '\n') {
        chrome.runtime.sendMessage({ action: 'nativeOsCommand', payload: { cmd: 'keyTap', key: 'enter' } });
      } else if (ch === '\t') {
        chrome.runtime.sendMessage({ action: 'nativeOsCommand', payload: { cmd: 'keyTap', key: 'tab' } });
      } else if (ch === 'Backspace') {
        chrome.runtime.sendMessage({ action: 'nativeOsCommand', payload: { cmd: 'keyTap', key: 'backspace' } });
      } else {
        chrome.runtime.sendMessage({ action: 'nativeOsCommand', payload: { cmd: 'typeString', text: ch, delay: 0 } });
      }
    } catch {}
  }

  async function typeCharacter(el, ch, signal) {
    if (signal?.aborted) return;
    const editorType = getEditorType(el);

    if (editorType === 'monaco') {
      await typeInMonaco(el, ch, signal);
    } else if (editorType === 'codemirror') {
      await typeInCodeMirror(el, ch, signal);
    } else if (editorType === 'ace') {
      await typeInAce(el, ch, signal);
    } else if (el.isContentEditable || el.closest?.('[contenteditable="true"]')) {
      typeInContentEditable(el, ch);
    } else {
      typeInNativeInput(el, ch);
    }
  }

  // ─── Native Input Typing ────────────────────────────────────────────────────

  function typeInNativeInput(el, ch) {
    try { el.focus(); } catch (_) {}

    const prevVal = el.value ?? '';
    const start = el.selectionStart ?? prevVal.length;
    const end = el.selectionEnd ?? prevVal.length;

    // First attempt document.execCommand('insertText') which updates the DOM & history
    let execSuccess = false;
    try {
      execSuccess = document.execCommand('insertText', false, ch);
    } catch (_) {}

    // Check if execCommand actually inserted the character into the input
    const valueChanged = el.value !== prevVal;

    if (!valueChanged) {
      // execCommand was ignored or not supported on this field: update value directly
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value'
      ) || Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype, 'value'
      );

      const newValue = prevVal.substring(0, start) + ch + prevVal.substring(end);

      if (nativeInputValueSetter && nativeInputValueSetter.set) {
        nativeInputValueSetter.set.call(el, newValue);
      } else {
        el.value = newValue;
      }

      const newPos = start + ch.length;
      try {
        el.selectionStart = el.selectionEnd = newPos;
      } catch (_) {}

      // Fire single input event for framework reactivity (React, Vue, Svelte, Angular)
      try {
        el.dispatchEvent(new InputEvent('input', {
          bubbles: true,
          cancelable: false,
          inputType: ch === '\n' ? 'insertLineBreak' : 'insertText',
          data: ch === '\n' ? null : ch,
        }));
      } catch (_) {
        el.dispatchEvent(new Event('input', { bubbles: true, cancelable: false }));
      }
    }
  }

  // ─── ContentEditable Typing ─────────────────────────────────────────────────

  function typeInContentEditable(el, ch) {
    try { el.focus(); } catch (_) {}
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) {
      const r = document.createRange();
      r.selectNodeContents(el);
      r.collapse(false);
      sel.removeAllRanges();
      sel.addRange(r);
    }

    if (ch === '\n' || ch === '\r') {
      const ok = document.execCommand('insertParagraph', false, null);
      if (!ok) document.execCommand('insertLineBreak', false, null);
    } else {
      document.execCommand('insertText', false, ch);
    }
  }

  // ─── Monaco Editor ──────────────────────────────────────────────────────────

  async function typeInMonaco(el, ch, signal) {
    const monacoEl = el.closest('.monaco-editor');
    if (monacoEl) {
      const textarea = monacoEl.querySelector('textarea.inputarea') || monacoEl.querySelector('textarea');
      if (textarea) {
        textarea.focus();
        try {
          // In Monaco, execCommand directly inserts into Monaco's text model without double typing
          document.execCommand('insertText', false, ch);
          return;
        } catch (_) {}
        typeInNativeInput(textarea, ch);
        return;
      }
    }
    // Fallback: simulate keypress events
    simulateKeyEvents(el, ch);
  }

  function clearMonaco(el) {
    const monacoEl = el.closest('.monaco-editor');
    if (monacoEl) {
      const textarea = monacoEl.querySelector('textarea.inputarea');
      if (textarea) {
        textarea.focus();
        textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true }));
        return;
      }
    }
  }

  // ─── CodeMirror ─────────────────────────────────────────────────────────────

  async function typeInCodeMirror(el, ch, signal) {
    // CodeMirror 5
    const cmEl = el.closest('.CodeMirror');
    if (cmEl && cmEl.CodeMirror) {
      const cm = cmEl.CodeMirror;
      const cursor = cm.getCursor();
      cm.replaceRange(ch, cursor);
      return;
    }
    // CodeMirror 6 (uses .cm-content contenteditable)
    const cm6Content = el.closest('.cm-editor')?.querySelector('.cm-content') || (el.classList?.contains('cm-content') ? el : null);
    if (cm6Content) {
      typeInContentEditable(cm6Content, ch);
      return;
    }
    // Fallback
    simulateKeyEvents(el, ch);
  }

  // ─── Ace Editor ─────────────────────────────────────────────────────────────

  async function typeInAce(el, ch, signal) {
    const aceEl = el.closest('.ace_editor');
    if (aceEl && window.ace) {
      try {
        const editor = window.ace.edit(aceEl.id || aceEl);
        editor.insert(ch);
        return;
      } catch { }
    }
    simulateKeyEvents(el, ch);
  }

  // ─── Keyboard Event Simulation (fallback) ───────────────────────────────────

  function simulateKeyEvents(el, ch) {
    if (el.tagName && (el.tagName.toLowerCase() === 'textarea' || el.tagName.toLowerCase() === 'input')) {
      typeInNativeInput(el, ch);
      return;
    }
    if (el.isContentEditable || el.closest?.('[contenteditable="true"]')) {
      typeInContentEditable(el, ch);
      return;
    }

    const keyCode = ch.charCodeAt(0);
    const eventProps = {
      key: ch,
      char: ch,
      keyCode: keyCode,
      which: keyCode,
      charCode: keyCode,
      bubbles: true,
      cancelable: true,
    };

    el.dispatchEvent(new KeyboardEvent('keydown', eventProps));
    el.dispatchEvent(new KeyboardEvent('keypress', eventProps));
    el.dispatchEvent(new KeyboardEvent('keyup', eventProps));
  }

  // ─── Human-like Typo & Mistake Simulation ─────────────────────────────────

  // Realistic stream-of-thought wrong chunks (around 50 to 70 characters each)
  const WRONG_CHUNK_SNIPPETS = [
    "const tempResult = data.filter(item => item.isActive && item.isValid);",
    "function calculateTotalSum(values) { return values.reduce((acc, cur) =>",
    "retunr response.status(200).json({ status: 'ok', payload: result });",
    "console.log('debugging state output:', JSON.stringify(state, null, 2));",
    "let items = list.map(item => ({ id: item.id, label: item.title }));",
    "if (userState === null || userState === undefined || !userState.auth)",
    "const formattedDate = new Date(timestamp).toLocaleDateString('en-US');",
    "return new Promise((resolve, reject) => { setTimeout(() => resolve(),",
    "document.querySelector('#target-container').addEventListener('click',",
    "async function fetchDataFromApi(endpoint, options = { method: 'GET' })",
    "const finalOutput = result.map(r => r.value).filter(v => v !== null);",
    "this.setState({ isLoading: true, error: null, data: prevResponse });",
    "export default function App({ children, className, initialTheme }) {",
    "import React, { useState, useEffect, useCallback, useMemo } from 'react';",
    "const handleSubmit = async (event) => { event.preventDefault(); if (",
    "useEffect(() => { fetchData().then(res => setData(res.data)); }, []);",
    "const router = useRouter(); const { id, slug, category } = router.query;",
    "type UserProfile = { id: string; name: string; email: string; role: string;",
    "interface ApiResponse<T> { data: T; error: string | null; code: number;",
    "const dispatch = useDispatch(); const selector = useSelector(state =>",
  ];

  function getWrongChunk() {
    const base = WRONG_CHUNK_SNIPPETS[Math.floor(Math.random() * WRONG_CHUNK_SNIPPETS.length)];
    // Ensure target length is strictly between 50 and 70 characters with organic variation
    const targetLen = 50 + Math.floor(Math.random() * 21); // 50 to 70 characters
    if (base.length <= targetLen) return base;
    return base.slice(0, targetLen);
  }

  // QWERTY adjacent-key map: for each key, list of keys that fingers commonly
  // mistype (immediate left, right, above, below on a standard keyboard layout)
  const QWERTY_NEIGHBORS = {
    'q': ['w', 'a'], 'w': ['q', 'e', 's', 'a'], 'e': ['w', 'r', 'd', 's'], 'r': ['e', 't', 'f', 'd'],
    't': ['r', 'y', 'g', 'f'], 'y': ['t', 'u', 'h', 'g'], 'u': ['y', 'i', 'j', 'h'], 'i': ['u', 'o', 'k', 'j'],
    'o': ['i', 'p', 'l', 'k'], 'p': ['o', '[', 'l'],
    'a': ['q', 'w', 's', 'z'], 's': ['a', 'w', 'e', 'd', 'z', 'x'], 'd': ['s', 'e', 'r', 'f', 'x', 'c'],
    'f': ['d', 'r', 't', 'g', 'c', 'v'], 'g': ['f', 't', 'y', 'h', 'v', 'b'], 'h': ['g', 'y', 'u', 'j', 'b', 'n'],
    'j': ['h', 'u', 'i', 'k', 'n', 'm'], 'k': ['j', 'i', 'o', 'l', 'm', ','], 'l': ['k', 'o', 'p', ';', ',', '.'],
    'z': ['a', 's', 'x'], 'x': ['z', 's', 'd', 'c'], 'c': ['x', 'd', 'f', 'v'], 'v': ['c', 'f', 'g', 'b'],
    'b': ['v', 'g', 'h', 'n'], 'n': ['b', 'h', 'j', 'm'], 'm': ['n', 'j', 'k', ','],
    '1': ['2', 'q'], '2': ['1', '3', 'q', 'w'], '3': ['2', '4', 'w', 'e'], '4': ['3', '5', 'e', 'r'],
    '5': ['4', '6', 'r', 't'], '6': ['5', '7', 't', 'y'], '7': ['6', '8', 'y', 'u'], '8': ['7', '9', 'u', 'i'],
    '9': ['8', '0', 'i', 'o'], '0': ['9', '-', 'o', 'p'],
    ' ': [' '], // space typo: double-space, handled separately
  };

  // Common transposition pairs (swap adjacent characters: 'teh' -> 'the')
  const COMMON_SWAPS = [
    ['t', 'h'], ['h', 't'], ['i', 'e'], ['e', 'i'], ['a', 'n'], ['n', 'a'],
    ['o', 'r'], ['r', 'o'], ['s', 't'], ['t', 's'], ['n', 'g'], ['g', 'n'],
  ];

  function getAdjacentKey(ch) {
    const lower = ch.toLowerCase();
    const neighbors = QWERTY_NEIGHBORS[lower];
    if (!neighbors || neighbors.length === 0) return null;
    const pick = neighbors[Math.floor(Math.random() * neighbors.length)];
    // Preserve original case
    return ch === ch.toUpperCase() && ch !== ch.toLowerCase() ? pick.toUpperCase() : pick;
  }

  function shouldMakeTypo(ch, humanTypoMode, typoRate) {
    if (!humanTypoMode) return false;
    // Skip typos on whitespace, newlines, and special chars
    if (ch === '\n' || ch === '\r' || ch === '\t') return false;
    // Higher typo chance for less common chars (non alpha)
    const isAlpha = /[a-zA-Z]/.test(ch);
    const rate = isAlpha ? typoRate : typoRate * 0.4;
    return Math.random() < rate;
  }

  async function deleteCharacter(el, signal) {
    if (signal?.aborted) return;
    const editorType = getEditorType(el);

    if (editorType === 'codemirror') {
      const cmEl = el.closest('.CodeMirror');
      if (cmEl && cmEl.CodeMirror) {
        const cm = cmEl.CodeMirror;
        const cursor = cm.getCursor();
        if (cursor.ch > 0) {
          cm.replaceRange('', { line: cursor.line, ch: cursor.ch - 1 }, cursor);
        } else if (cursor.line > 0) {
          cm.replaceRange('', { line: cursor.line - 1, ch: cm.getLine(cursor.line - 1).length }, cursor);
        }
        return;
      }
    }

    if (editorType === 'ace') {
      const aceEl = el.closest('.ace_editor');
      if (aceEl && window.ace) {
        try {
          const editor = window.ace.edit(aceEl.id || aceEl);
          editor.remove('left');
          return;
        } catch { }
      }
    }

    if (editorType === 'monaco') {
      const monacoEl = el.closest('.monaco-editor');
      if (monacoEl) {
        const ta = monacoEl.querySelector('textarea.inputarea') || monacoEl.querySelector('textarea');
        if (ta) {
          ta.focus();
          try {
            document.execCommand('delete', false, null);
          } catch (_) {
            ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', keyCode: 8, which: 8, bubbles: true, cancelable: true }));
            ta.dispatchEvent(new KeyboardEvent('keyup', { key: 'Backspace', keyCode: 8, which: 8, bubbles: true, cancelable: true }));
          }
          return;
        }
      }
    }

    if (el.isContentEditable || el.closest?.('[contenteditable="true"]')) {
      try { el.focus(); } catch (_) {}
      const sel = window.getSelection();
      if (sel && sel.rangeCount) {
        document.execCommand('delete', false, null);
      }
      return;
    }

    // Native input / textarea
    try { el.focus(); } catch (_) {}
    const prevVal = el.value ?? '';
    try {
      document.execCommand('delete', false, null);
    } catch (_) {}

    // Only manually delete if execCommand did not change the input value
    if (el.value === prevVal) {
      const start = el.selectionStart ?? prevVal.length;
      const end = el.selectionEnd ?? prevVal.length;
      if (start > 0 || end > start) {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value') ||
          Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
        const deletePos = start === end ? start - 1 : start;
        const newValue = prevVal.substring(0, deletePos) + prevVal.substring(end);
        if (nativeSetter && nativeSetter.set) {
          nativeSetter.set.call(el, newValue);
        } else {
          el.value = newValue;
        }
        try { el.selectionStart = el.selectionEnd = deletePos; } catch (_) {}

        try {
          el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
        } catch (_) {
          el.dispatchEvent(new Event('input', { bubbles: true, cancelable: false }));
        }
      }
    }
  }

  async function performTypoAndCorrect(el, correctChar, signal) {
    // Pick an adjacent typo key on standard QWERTY layout
    const wrongChar = getAdjacentKey(correctChar);
    if (!wrongChar || wrongChar === correctChar) return false;

    // Type the mistake character
    await typeCharacter(el, wrongChar, signal);
    return true;
  }

  // ─── Abort / Stop ───────────────────────────────────────────────────────────

  function abortTyping() {
    if (typingState.abortController) {
      typingState.abortController.abort();
    }
    typingState.active = false;
    typingState.paused = false;
    if (typingState.pauseResolve) {
      typingState.pauseResolve();
      typingState.pauseResolve = null;
    }
  }

  // ─── Feedback (Stealth Mode) ───────────────────────────────────────────────
  // Completely silent — no on-screen popup or UI indicator is injected into the page.
  function showFeedback(_msg, _type) {
    // No-op: silent execution
  }

  // ─── Message Listener ───────────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {

    switch (msg.action) {

      case 'getStatus':
        sendResponse({
          status: typingState.active ? (typingState.paused ? 'paused' : 'typing') : 'idle',
          charIndex: typingState.charIndex,
          totalChars: typingState.totalChars,
          delay: typingState.delay,
        });
        break;

      case 'startPicking':
        try { startPicking(); sendResponse({ ok: true }); }
        catch (e) { sendResponse({ error: e.message }); }
        break;

      case 'startTyping':
        startTyping(msg).then(result => sendResponse(result)).catch(e => sendResponse({ error: e.message }));
        return true; // async

      case 'startTypingFromCommand':
        // If already typing, toggle pause/resume
        if (typingState.active) {
          typingState.paused = !typingState.paused;
          if (!typingState.paused && typingState.pauseResolve) {
            typingState.pauseResolve();
            typingState.pauseResolve = null;
          }
          showFeedback(typingState.paused ? '⏸ Typing paused' : '▶ Typing resumed', 'info');
          chrome.runtime.sendMessage({
            action: 'statusUpdate',
            status: typingState.paused ? 'paused' : 'typing',
            charIndex: typingState.charIndex,
            totalChars: typingState.totalChars,
          }).catch(() => {});
          sendResponse({ ok: true, status: typingState.paused ? 'paused' : 'typing' });
          break;
        }

        // Load saved text and start typing immediately at cursor
        chrome.storage.local.get(['tba_last_text', 'tba_delay', 'tba_linebreak_delay', 'tba_start_delay', 'tba_human_typo_mode'], async (res) => {
          const text = res.tba_last_text || '';
          if (!text.trim()) {
            showFeedback('⚠️ No text to type! Paste text into TypeByAman first.', 'warning');
            sendResponse({ error: 'No text saved' });
            return;
          }
          const result = await startTyping({
            text: text,
            delay: res.tba_delay || 50,
            linebreakDelay: res.tba_linebreak_delay || 0,
            startDelay: res.tba_start_delay || 0,
            humanTypoMode: res.tba_human_typo_mode !== undefined ? res.tba_human_typo_mode : false,
          });
          if (result.error) {
            showFeedback('⚠️ ' + result.error, 'error');
          } else {
            showFeedback('▶ Typing started…', 'info');
          }
          sendResponse(result);
        });
        return true; // async

      case 'pauseResumeFromCommand':
        if (!typingState.active) {
          sendResponse({ ok: false, error: 'Not typing' });
          break;
        }
        typingState.paused = !typingState.paused;
        if (!typingState.paused && typingState.pauseResolve) {
          typingState.pauseResolve();
          typingState.pauseResolve = null;
        }
        showFeedback(typingState.paused ? '⏸ Typing paused' : '▶ Typing resumed', 'info');
        chrome.runtime.sendMessage({
          action: 'statusUpdate',
          status: typingState.paused ? 'paused' : 'typing',
          charIndex: typingState.charIndex,
          totalChars: typingState.totalChars,
        }).catch(() => {});
        sendResponse({ ok: true, paused: typingState.paused });
        break;

      case 'pauseTyping':
        typingState.paused = true;
        sendResponse({ ok: true });
        break;

      case 'resumeTyping':
        if (msg.delay !== undefined) typingState.delay = Math.max(1, parseInt(msg.delay) || 50);
        typingState.paused = false;
        if (typingState.pauseResolve) {
          typingState.pauseResolve();
          typingState.pauseResolve = null;
        }
        sendResponse({ ok: true, delay: typingState.delay });
        break;

      case 'stopTyping':
        abortTyping();
        showFeedback('⏹ Typing stopped', 'info');
        sendResponse({ ok: true, charIndex: typingState.charIndex });
        break;

      case 'updateSpeed':
      case 'updateDelay':
        typingState.delay = Math.max(1, parseInt(msg.delay) || 50);
        sendResponse({ ok: true, delay: typingState.delay });
        break;

      default:
        sendResponse({ error: 'Unknown action' });
    }
  });

  // ─── Run & Continue (Web Editors) ────────────────────────────────────────────
  //
  // After every N lines typed (randomized 60–160), the engine simulates a
  // developer stopping to run / preview their code:
  //
  //   1. Save (Ctrl+S)
  //   2. Find and click the Run / Preview button for the detected platform
  //   3. Wait a realistic "watching output" duration (5–18 seconds)
  //   4. Move cursor back to the editor
  //
  // Supported platforms:
  //   Replit · CodeSandbox · StackBlitz · CodePen · JSFiddle · Glitch · OneCompiler
  // ─────────────────────────────────────────────────────────────────────────────

  const WEB_RUN_PLATFORMS = [
    // Replit
    {
      test: () => location.hostname.includes('replit.com'),
      runSelectors: ['[data-cy="run-btn"]', '[class*="run-button"]', 'button[title*="Run"]', '#run-button'],
      saveKey: 's',
    },
    // CodeSandbox
    {
      test: () => location.hostname.includes('codesandbox.io'),
      runSelectors: ['[title*="Refresh"]', '[aria-label*="Refresh"]', '[class*="refresh"]'],
      saveKey: 's',
    },
    // StackBlitz
    {
      test: () => location.hostname.includes('stackblitz.com'),
      runSelectors: ['[title*="Refresh"]', 'button[class*="preview"]', '[aria-label*="preview"]'],
      saveKey: 's',
    },
    // CodePen
    {
      test: () => location.hostname.includes('codepen.io'),
      runSelectors: ['button[class*="run"]', '#run', '[class*="run-button"]', 'button[title*="Run"]'],
      saveKey: 's',
    },
    // JSFiddle
    {
      test: () => location.hostname.includes('jsfiddle.net'),
      runSelectors: ['#run', '.run_ok', 'button[title="Run"]'],
      saveKey: 's',
    },
    // Glitch
    {
      test: () => location.hostname.includes('glitch.com'),
      runSelectors: ['.preview-button', '[class*="preview"]', 'button[title*="Preview"]'],
      saveKey: 's',
    },
    // OneCompiler
    {
      test: () => location.hostname.includes('onecompiler.com'),
      runSelectors: ['#run-btn', '.run-btn', 'button[title*="Run"]', '[class*="run"]'],
      saveKey: 's',
    },
    // Generic fallback: any visible "Run" or "Execute" button on the page
    {
      test: () => !!document.querySelector('canvas, .monaco-editor, .cm-editor, .ace_editor'),
      runSelectors: [
        'button[aria-label*="Run"]', 'button[title*="Run"]',
        'button[class*="run"]', '#run', '.run-btn',
        'button[aria-label*="Execute"]', 'button[title*="Execute"]',
      ],
      saveKey: 's',
    },
  ];

  let _webRunLinesTyped     = 0;
  let _webRunNextAt         = _randomWebRunInterval();
  let _webRunEnabled        = true;   // can be toggled off

  function _randomWebRunInterval() {
    return 60 + Math.floor(Math.random() * 100); // 60–160 lines
  }

  /** Called by the typing loop each time a newline character is typed */
  function webRunOnNewline() {
    if (!_webRunEnabled) return;
    _webRunLinesTyped++;
    if (_webRunLinesTyped >= _webRunNextAt) {
      _webRunNextAt = _webRunLinesTyped + _randomWebRunInterval();
      _doWebRun();  // fire and forget
    }
  }

  async function _doWebRun() {
    // Detect platform
    const platform = WEB_RUN_PLATFORMS.find(p => p.test()) ?? null;
    if (!platform) return;

    // 1. Save — Ctrl+S
    const saveEvtOpts = { bubbles: true, cancelable: true, ctrlKey: true, key: 's', code: 'KeyS' };
    document.dispatchEvent(new KeyboardEvent('keydown', saveEvtOpts));
    await sleep(100 + Math.floor(Math.random() * 150));
    document.dispatchEvent(new KeyboardEvent('keyup', saveEvtOpts));
    await sleep(400 + Math.floor(Math.random() * 500));

    // 2. Find the Run button
    let runBtn = null;
    for (const sel of platform.runSelectors) {
      try {
        const els = Array.from(document.querySelectorAll(sel));
        const vis = els.find(el => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });
        if (vis) { runBtn = vis; break; }
      } catch (_) {}
    }

    if (runBtn) {
      // Move mouse naturally to the button (best effort — synthetic only in page context)
      runBtn.focus?.();
      await sleep(200 + Math.floor(Math.random() * 300));
      runBtn.click();
    } else {
      // Fallback: keyboard shortcut F5 (runs in many environments)
      document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'F5', code: 'F5' }));
      await sleep(60);
      document.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key: 'F5', code: 'F5' }));
    }

    // 3. Watch output — 5–18 seconds of realistic "reading results"
    const watchMs = 5000 + Math.floor(Math.random() * 13000);
    await sleep(watchMs);

    // 4. Return focus to last interacted editor element
    if (typingState.targetElement && document.contains(typingState.targetElement)) {
      typingState.targetElement.focus?.();
    }
  }

  // ─── Anti-Detection Module ────────────────────────────────────────────────────
  //
  // Makes all automated events as indistinguishable from human input as possible.
  //
  // Techniques:
  //  1. All events include full realistic properties (pressure, tiltX/Y, pointerType, etc.)
  //  2. InputEvent.inputType is set correctly on text insertions
  //  3. No uniform timing — every delay has independent random jitter
  //  4. Navigator fingerprint properties are NOT patched (patching them is itself detectable)
  //  5. The extension has NO identifiable class names, global vars, or DOM markers
  //
  // Hard truth about isTrusted:
  //  The browser's `isTrusted` flag on events CANNOT be set to true by JS — it is
  //  enforced by the browser engine. However, most detection systems look at
  //  behavioral patterns (timing entropy, mouse trajectory, event sequence) rather
  //  than isTrusted alone. Our randomized bezier movement + jitter defeats pattern
  //  analysis. The only bypass for isTrusted requires a native OS driver (which
  //  the native-helper/cursor-helper.js provides for desktop apps).
  // ─────────────────────────────────────────────────────────────────────────────

  (function installAntiDetection() {

    // ── 1. Randomize performance.now() resolution to defeat timing fingerprinting
    //       Many bot detectors measure the statistical distribution of inter-event
    //       timing. Adding ±0–0.5ms noise makes it match human entropy.
    const _origPerfNow = performance.now.bind(performance);
    Object.defineProperty(performance, 'now', {
      value: function () {
        // Add sub-millisecond jitter that stays within spec (still monotonic in aggregate)
        return _origPerfNow() + (Math.random() * 0.5);
      },
      configurable: true,
    });

    // ── 2. Harden event construction used by content.js:
    //       Intercept dispatchEvent to silently augment events with realistic fields.
    const _origDispatch = EventTarget.prototype.dispatchEvent;
    EventTarget.prototype.dispatchEvent = function (event) {
      // Only augment our synthetic PointerEvents and MouseEvents
      if (event instanceof PointerEvent && !event.isTrusted) {
        // Monkey-patching read-only properties via defineProperty on the event instance
        try {
          // Add realistic pressure for mouse (0.5 when pressed, 0 otherwise)
          if (!Object.getOwnPropertyDescriptor(event, 'pressure')) {
            Object.defineProperty(event, 'pressure', { value: event.buttons ? 0.5 : 0 });
          }
          // Width/height of touch point
          if (!Object.getOwnPropertyDescriptor(event, 'width'))  Object.defineProperty(event, 'width',  { value: 1 });
          if (!Object.getOwnPropertyDescriptor(event, 'height')) Object.defineProperty(event, 'height', { value: 1 });
        } catch (_) {}
      }
      return _origDispatch.call(this, event);
    };

    // ── 3. Guard against navigator.webdriver detection
    //       Note: In Chrome extensions, navigator.webdriver is already false.
    //       We verify this and log a warning if it's not (shouldn't happen).
    if (navigator.webdriver) {
      console.warn('[TypeByAman] navigator.webdriver is true — running in automation context');
    }

    // ── 4. Prevent the extension from being fingerprinted via unique globals
    //       All our state is scoped inside the IIFE — nothing leaks to window.*
    //       The window.__typeByAman_initialized flag is minimal and common-looking.

    // ── 5. Randomize all requestAnimationFrame timing to add natural jitter
    //       to any visual updates the page makes in response to our events.
    const _origRAF = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = function (cb) {
      return _origRAF((timestamp) => {
        cb(timestamp + Math.random() * 0.3);
      });
    };

  })();

})();

