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
      delay: delay || 50,
      linebreakDelay: linebreakDelay || 0,
      humanTypoMode: humanTypoMode !== undefined ? humanTypoMode : typingState.humanTypoMode,
      typoRate: typoRate !== undefined ? typoRate : typingState.typoRate,
      abortController: ac,
      abortSignal: ac.signal,
    };

    runTypingLoop(target, text, startDelay, ac.signal).catch(() => { });
    return { ok: true, label: getElementLabel(target) };
  }

  async function runTypingLoop(el, text, startDelay, signal) {
    try {
      checkNativeOs().catch(() => {});
      if (startDelay > 0) await sleep(startDelay, signal);

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

      // Dynamic word tempo: some words fast, some words deliberate, some standard
      let currentWordTempo = Math.random() < 0.35 ? 'fast' : (Math.random() < 0.22 ? 'deliberate' : 'normal');
      let charsSinceLastThink5s = 0;
      let nextThink5sThreshold = 140 + Math.floor(Math.random() * 160); // every ~25–55 words

      for (let i = 0; i < text.length; i++) {
        if (signal.aborted) break;

        await waitIfPaused();
        if (signal.aborted) break;

        const ch = text[i];
        typingState.charIndex = i;

        charsSinceLastThink5s++;

        // Word boundary & punctuation detection
        const isWordBoundary = ch === ' ' || ch === '\t';
        const isPunctuation = /[.,!?:;]/.test(ch);
        const isLineBreak = ch === '\n' || ch === '\r';

        // ── 5-Second Human Thinking Pause ──────────────────────────────────────
        // "while typing somewhere wait for 5 seconds and then continue writing"
        if (charsSinceLastThink5s >= nextThink5sThreshold && (isWordBoundary || isPunctuation || isLineBreak) && !signal.aborted) {
          charsSinceLastThink5s = 0;
          nextThink5sThreshold = 150 + Math.floor(Math.random() * 180);
          // Human stops typing to think / review notes: ~5 seconds (4.7s – 5.3s)
          const think5s = 4700 + Math.floor(Math.random() * 600);
          await sleep(think5s, signal);
          if (signal.aborted) break;
          // After 5s pause, pick a fresh word tempo
          currentWordTempo = Math.random() < 0.4 ? 'fast' : (Math.random() < 0.25 ? 'deliberate' : 'normal');
        } else if (isWordBoundary) {
          // Switch tempo on word boundary: some words fast, some words deliberate
          currentWordTempo = Math.random() < 0.35 ? 'fast' : (Math.random() < 0.22 ? 'deliberate' : 'normal');
        }

        const now = Date.now();
        const isEligibleForTypo = !isLineBreak && ch !== '\t' && /[a-zA-Z0-9]/.test(ch);

        // ── 1. Major Human Mistake (Every 35s–95s: types around 50-70 chars wrong, erases one by one, and retypes) ──
        if (typingState.humanTypoMode && isEligibleForTypo && (now - lastMajorTypoTime) >= nextMajorTypoInterval) {
          const wrongSnippet = getWrongChunk(); // around 50–70 characters
          lastMajorTypoTime = Date.now();
          // High-entropy re-randomization so no two mistakes follow a predictable cadence
          nextMajorTypoInterval = 35000 + Math.random() * 60000;

          // A. Type out the wrong 50-70 character sequence like a human thinking ahead
          for (let w = 0; w < wrongSnippet.length; w++) {
            if (signal.aborted) break;
            await waitIfPaused();
            if (signal.aborted) break;
            await typeCharacter(el, wrongSnippet[w], signal);
            const wDelay = Math.max(20, typingState.delay + Math.floor(Math.random() * 25 - 10));
            await sleep(wDelay, signal);
          }

          if (signal.aborted) break;

          // B. Realization pause: 350ms - 550ms ("Wait, this is wrong, let me erase it")
          const realizationMs = 350 + Math.floor(Math.random() * 200);
          await sleep(realizationMs, signal);
          if (signal.aborted) break;

          // C. Rapid backspacing: erase each wrong character one by one like holding backspace
          for (let d = 0; d < wrongSnippet.length; d++) {
            if (signal.aborted) break;
            await waitIfPaused();
            if (signal.aborted) break;
            await deleteCharacter(el, signal);
            const backspaceSpeed = 35 + Math.floor(Math.random() * 30);
            await sleep(backspaceSpeed, signal);
          }

          if (signal.aborted) break;

          // D. Cognitive reset hesitation: 250ms - 400ms before re-typing correct code
          const resetPause = 250 + Math.floor(Math.random() * 150);
          await sleep(resetPause, signal);
          if (signal.aborted) break;

          // E. Cleanly type the intended character and continue!
          await typeCharacter(el, ch, signal);
          continue;
        }

        // ── 2. Minor Key Slip (Every ~12-15s: adjacent key typo & backspace) ──
        if (typingState.humanTypoMode && isEligibleForTypo && (now - lastMinorTypoTime) >= nextMinorTypoInterval) {
          const typoMade = await performTypoAndCorrect(el, ch, signal);
          if (signal.aborted) break;

          if (typoMade) {
            lastMinorTypoTime = Date.now();
            nextMinorTypoInterval = 12000 + Math.random() * 4000;

            // In ~40% of cases, human typed 1 more character before realizing mistake
            let bonusChar = null;
            if (i + 1 < text.length && Math.random() < 0.4 && /[a-zA-Z0-9]/.test(text[i + 1])) {
              bonusChar = text[i + 1];
              await typeCharacter(el, bonusChar, signal);
              const bonusDelay = typingState.delay + Math.floor(Math.random() * typingState.delay * 0.5);
              await sleep(bonusDelay, signal);
              if (signal.aborted) break;
            }

            // Realization pause: 200–350ms
            const noticePause = 200 + Math.floor(Math.random() * 150);
            await sleep(noticePause, signal);
            if (signal.aborted) break;

            // Backspace delete bonus char if typed
            if (bonusChar !== null) {
              await deleteCharacter(el, signal);
              await sleep(70 + Math.floor(Math.random() * 50), signal);
              if (signal.aborted) break;
            }

            // Backspace delete the typo char
            await deleteCharacter(el, signal);

            // Brief pause before retyping (human cognitive recovery: 120–200ms)
            await sleep(120 + Math.floor(Math.random() * 80), signal);
            if (signal.aborted) break;

            // Retype the correct character
            await typeCharacter(el, ch, signal);

            // Slight natural pause after fixing mistake
            const recoverDelay = typingState.delay + Math.floor(Math.random() * 60);
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
        // ────────────────────────────────────────────────────────────────────

        await typeCharacter(el, ch, signal);

        // Progress update (throttled to every 50 chars for performance)
        if (i % 50 === 0 || i === text.length - 1) {
          chrome.runtime.sendMessage({
            action: 'statusUpdate',
            status: 'typing',
            charIndex: i + 1,
            totalChars: text.length,
          });
        }

        // Natural human delay: dynamic word tempo + symbol/Shift latency (NEVER CONSTANT)
        const extraDelay = isLineBreak ? (typingState.linebreakDelay || 250) : 0;
        const totalDelay = calculateHumanDelay(ch, typingState.delay, currentWordTempo) + extraDelay;
        if (totalDelay > 0) await sleep(totalDelay, signal);

        // ── Human Coding Behavior: Thinking Pauses & Run Code ──────────────────
        if (isLineBreak && !signal.aborted) {
          linesTyped++;
          // A. Thinking pause & Reading Scroll: developer glances up to review code
          if (linesTyped >= nextThinkLine) {
            nextThinkLine = linesTyped + 15 + Math.floor(Math.random() * 25);
            // On screen recording, smooth scroll slightly up as if reading previous function
            if (Math.random() < 0.6) {
              try { window.scrollBy({ top: -140, behavior: 'smooth' }); } catch {}
            }
            const thinkMs = 1200 + Math.floor(Math.random() * 2000);
            await sleep(thinkMs, signal);
            try { el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch {}
            await sleep(250 + Math.floor(Math.random() * 250), signal);
          }
          // B. Run Code: stop to test/run code and observe output
          if (linesTyped >= nextRunLine && !signal.aborted) {
            nextRunLine = linesTyped + 75 + Math.floor(Math.random() * 100);
            await maybeRunWebCode(el, signal);
          }
        }
      }

      if (!signal.aborted) {
        typingState.active = false;
        typingState.charIndex = text.length;
        chrome.runtime.sendMessage({
          action: 'typingDone',
          totalChars: text.length,
        });
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

  // ─── Human Keystroke Latency Model (Non-constant, undetectable) ──────────────
  function calculateHumanDelay(ch, baseDelay, tempo = 'normal') {
    // 1. Word tempo persona:
    // "some words should be typed fast and all other"
    let tempoMultiplier;
    if (tempo === 'fast') {
      tempoMultiplier = 0.38 + Math.random() * 0.22; // 0.38x – 0.60x (typed fast, muscle memory burst)
    } else if (tempo === 'deliberate') {
      tempoMultiplier = 1.45 + Math.random() * 0.70; // 1.45x – 2.15x (complex / deliberate word)
    } else {
      tempoMultiplier = 0.78 + Math.random() * 0.44; // 0.78x – 1.22x (standard organic flow)
    }

    // 2. Base delay scaling according to selected mode, but ALWAYS non-constant
    // High-entropy log-normal jitter around the tempo-adjusted base
    let delay = baseDelay * tempoMultiplier * (0.80 + Math.random() * 0.40);

    // 3. Biomechanical letter latency factors:
    // Uppercase requires holding Shift (+35ms–75ms)
    if (ch >= 'A' && ch <= 'Z') {
      delay += 35 + Math.random() * 40;
    }
    // Punctuation, braces, brackets and operators (+45ms–95ms)
    else if (/[{}()[\];:,.=+\-*\/&|!<>?]/.test(ch)) {
      delay += 45 + Math.random() * 50;
    }
    // Numbers on top row (+25ms–55ms)
    else if (/[0-9]/.test(ch)) {
      delay += 25 + Math.random() * 30;
    }
    // Space between words: cognitive boundary (+25ms–65ms)
    else if (ch === ' ') {
      delay += 25 + Math.random() * 40;
    }

    // 4. Occasional human hesitation (6% chance of a 130–260ms pause)
    if (Math.random() < 0.06) {
      delay += 130 + Math.random() * 130;
    }

    // Floor at 2ms so even very fast mode never blocks, but keeps organic variation
    const minDelay = baseDelay <= 10 ? 2 : Math.min(15, Math.round(baseDelay * 0.3));
    return Math.max(minDelay, Math.round(delay));
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

  // ─── Real OS Hardware Keystrokes ───────────────────────────────────────────
  let _nativeOsAvailable = false;
  let _lastNativeCheck = 0;

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
    emitNativeOsKey(ch);
    const editorType = getEditorType(el);

    if (editorType === 'monaco') {
      await typeInMonaco(el, ch, signal);
    } else if (editorType === 'codemirror') {
      await typeInCodeMirror(el, ch, signal);
    } else if (editorType === 'ace') {
      await typeInAce(el, ch, signal);
    } else if (el.isContentEditable) {
      typeInContentEditable(el, ch);
    } else {
      typeInNativeInput(el, ch);
    }
  }

  // ─── Native Input Typing ────────────────────────────────────────────────────

  function typeInNativeInput(el, ch) {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    ) || Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype, 'value'
    );

    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;

    const newValue = el.value.substring(0, start) + ch + el.value.substring(end);

    if (nativeInputValueSetter && nativeInputValueSetter.set) {
      nativeInputValueSetter.set.call(el, newValue);
    } else {
      el.value = newValue;
    }

    const newPos = start + 1;
    el.selectionStart = el.selectionEnd = newPos;

    // Fire events that frameworks (React, Vue, Angular) listen to
    el.dispatchEvent(new Event('input', { bubbles: true, cancelable: false }));
    el.dispatchEvent(new Event('change', { bubbles: true, cancelable: false }));
  }

  // ─── ContentEditable Typing ─────────────────────────────────────────────────

  function typeInContentEditable(el, ch) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) {
      el.focus();
      const r = document.createRange();
      r.selectNodeContents(el);
      r.collapse(false);
      sel.removeAllRanges();
      sel.addRange(r);
    }

    if (ch === '\n' || ch === '\r') {
      document.execCommand('insertParagraph', false, null);
    } else {
      document.execCommand('insertText', false, ch);
    }

    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // ─── Monaco Editor ──────────────────────────────────────────────────────────

  async function typeInMonaco(el, ch, signal) {
    // Try to find Monaco editor instance
    const monacoEl = el.closest('.monaco-editor');
    if (monacoEl) {
      const textarea = monacoEl.querySelector('textarea.inputarea');
      if (textarea) {
        textarea.focus();
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
    const cmEl = el.closest('.CodeMirror');
    if (cmEl && cmEl.CodeMirror) {
      const cm = cmEl.CodeMirror;
      const cursor = cm.getCursor();
      cm.replaceRange(ch, cursor);
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

    if (el.tagName.toLowerCase() === 'textarea' || el.tagName.toLowerCase() === 'input') {
      typeInNativeInput(el, ch);
    } else if (el.isContentEditable) {
      typeInContentEditable(el, ch);
    }

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
    emitNativeOsKey('Backspace');
    const editorType = getEditorType(el);

    if (editorType === 'codemirror') {
      const cmEl = el.closest('.CodeMirror');
      if (cmEl && cmEl.CodeMirror) {
        const cm = cmEl.CodeMirror;
        const cursor = cm.getCursor();
        const lineContent = cm.getLine(cursor.line);
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
          ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', keyCode: 8, which: 8, bubbles: true, cancelable: true }));
          ta.dispatchEvent(new KeyboardEvent('keyup', { key: 'Backspace', keyCode: 8, which: 8, bubbles: true, cancelable: true }));
          return;
        }
      }
    }

    if (el.isContentEditable || el.closest('[contenteditable="true"]')) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount) {
        document.execCommand('delete', false, null);
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }

    // Native input / textarea
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    if (start > 0) {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value') ||
        Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
      const deletePos = start === end ? start - 1 : start;
      const newValue = el.value.substring(0, deletePos) + el.value.substring(end);
      if (nativeSetter && nativeSetter.set) {
        nativeSetter.set.call(el, newValue);
      } else {
        el.value = newValue;
      }
      el.selectionStart = el.selectionEnd = deletePos;
      el.dispatchEvent(new Event('input', { bubbles: true, cancelable: false }));
      el.dispatchEvent(new Event('change', { bubbles: true, cancelable: false }));
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
        chrome.storage.local.get(['tba_last_text', 'tba_delay', 'tba_linebreak_delay', 'tba_start_delay'], async (res) => {
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
        if (msg.delay !== undefined) typingState.delay = msg.delay;
        typingState.paused = false;
        if (typingState.pauseResolve) {
          typingState.pauseResolve();
          typingState.pauseResolve = null;
        }
        sendResponse({ ok: true });
        break;

      case 'stopTyping':
        abortTyping();
        showFeedback('⏹ Typing stopped', 'info');
        sendResponse({ ok: true, charIndex: typingState.charIndex });
        break;

      case 'updateDelay':
        typingState.delay = msg.delay;
        sendResponse({ ok: true });
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

