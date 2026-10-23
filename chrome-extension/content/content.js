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
    active:        false,
    paused:        false,
    charIndex:     0,
    text:          '',
    totalChars:    0,
    delay:         50,
    linebreakDelay:0,
    targetElement: null,
    pauseResolve:  null,
    abortSignal:   null,
    abortController:null,
  };

  let isPicking = false;
  let pickOverlay = null;
  let highlightedEl = null;

  // ─── Helper: sleep ─────────────────────────────────────────────────────────

  function sleep(ms, signal) {
    return new Promise((resolve, reject) => {
      if (ms <= 0) { resolve(); return; }
      const id = setTimeout(resolve, ms);
      if (signal) {
        signal.addEventListener('abort', () => {
          clearTimeout(id);
          reject(new DOMException('Aborted', 'AbortError'));
        }, { once: true });
      }
    });
  }

  // ─── Helper: pausePoint ────────────────────────────────────────────────────

  function waitIfPaused() {
    if (!typingState.paused) return Promise.resolve();
    return new Promise(resolve => {
      typingState.pauseResolve = resolve;
    });
  }

  // ─── Target Element Detection ───────────────────────────────────────────────

  function isTypeable(el) {
    if (!el) return false;
    const tag = el.tagName.toLowerCase();
    if (tag === 'textarea') return true;
    if (tag === 'input') {
      const t = (el.type || 'text').toLowerCase();
      return ['text', 'search', 'url', 'email', 'password', 'number', 'tel'].includes(t);
    }
    if (el.isContentEditable) return true;
    // CodeMirror / Monaco / Ace editor detection
    if (el.closest('.CodeMirror') || el.closest('.monaco-editor') || el.closest('.ace_editor')) return true;
    return false;
  }

  function getEditorType(el) {
    if (!el) return 'unknown';
    if (el.closest('.monaco-editor')) return 'monaco';
    if (el.closest('.CodeMirror'))    return 'codemirror';
    if (el.closest('.ace_editor'))    return 'ace';
    if (el.isContentEditable)         return 'contenteditable';
    if (el.tagName.toLowerCase() === 'textarea') return 'textarea';
    return 'input';
  }

  function getElementLabel(el) {
    if (!el) return '';
    const tag   = el.tagName.toLowerCase();
    const id    = el.id ? `#${el.id}` : '';
    const cls   = el.className && typeof el.className === 'string'
      ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
    const type  = el.type ? `[${el.type}]` : '';
    return `${tag}${type}${id || cls}`.substring(0, 50);
  }

  // ─── Target Picking ─────────────────────────────────────────────────────────

  function startPicking() {
    if (isPicking) return;
    isPicking = true;

    // Overlay cursor style
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
    pickOverlay.style.pointerEvents = 'none';
    const el = document.elementFromPoint(e.clientX, e.clientY);
    pickOverlay.style.pointerEvents = 'all';

    if (el && el !== highlightedEl) {
      removeHighlight();
      if (isTypeable(el)) {
        highlightedEl = el;
        addHighlight(el);
      }
    }
  }

  function onPickClick(e) {
    e.preventDefault(); e.stopPropagation();
    pickOverlay.style.pointerEvents = 'none';
    const el = document.elementFromPoint(e.clientX, e.clientY);
    pickOverlay.style.pointerEvents = 'all';

    if (el && isTypeable(el)) {
      typingState.targetElement = el;
      const label = getElementLabel(el);
      stopPicking();
      chrome.runtime.sendMessage({ action: 'targetPicked', label });
    } else {
      showFeedback('That element is not a supported input. Try a text field or editor.', 'warning');
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
    el.style.outline        = '2px solid #4f8ef7';
    el.style.outlineOffset  = '1px';
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
    // If already typing, stop first
    if (typingState.active) {
      abortTyping();
      await sleep(50);
    }

    const { text, delay, linebreakDelay, startDelay } = config;

    if (!text) return { error: 'No text provided' };

    // Find target: use pinned target or last focused input/textarea
    let target = typingState.targetElement;
    if (!target || !document.contains(target)) {
      target = findFocusedOrLastInput();
      typingState.targetElement = target;
    }

    if (!target) {
      return { error: 'No target field selected. Click "Pick Target Field" first.' };
    }

    const ac = new AbortController();
    typingState = {
      ...typingState,
      active:         true,
      paused:         false,
      charIndex:      0,
      text:           text,
      totalChars:     text.length,
      delay:          delay || 50,
      linebreakDelay: linebreakDelay || 0,
      abortController:ac,
      abortSignal:    ac.signal,
    };

    // Run async
    runTypingLoop(target, text, startDelay, ac.signal).catch(() => {});

    return { ok: true };
  }

  async function runTypingLoop(el, text, startDelay, signal) {
    try {
      if (startDelay > 0) await sleep(startDelay, signal);

      el.focus();

      // Clear existing content if empty start
      if (getEditorType(el) === 'monaco') {
        // Monaco: use keyboard shortcuts to select all then type
        clearMonaco(el);
      } else if (el.isContentEditable) {
        // Don't clear contenteditable automatically
      } else {
        el.value = '';
        el.selectionStart = el.selectionEnd = 0;
      }

      for (let i = 0; i < text.length; i++) {
        if (signal.aborted) break;

        await waitIfPaused();
        if (signal.aborted) break;

        const ch = text[i];
        typingState.charIndex = i;

        await typeCharacter(el, ch, signal);

        // Progress update (throttled to every 50 chars for performance)
        if (i % 50 === 0 || i === text.length - 1) {
          chrome.runtime.sendMessage({
            action:     'statusUpdate',
            status:     'typing',
            charIndex:  i + 1,
            totalChars: text.length,
          });
        }

        // Delay
        const isLineBreak = ch === '\n' || ch === '\r';
        const extraDelay  = isLineBreak ? typingState.linebreakDelay : 0;
        const totalDelay  = typingState.delay + extraDelay;
        if (totalDelay > 0) await sleep(totalDelay, signal);
      }

      if (!signal.aborted) {
        typingState.active = false;
        typingState.charIndex = text.length;
        chrome.runtime.sendMessage({
          action:     'typingDone',
          totalChars: text.length,
        });
      }

    } catch (err) {
      if (err.name !== 'AbortError') {
        typingState.active = false;
        chrome.runtime.sendMessage({
          action:    'typingError',
          error:     err.message,
          charIndex: typingState.charIndex,
        });
      }
    }
  }

  async function typeCharacter(el, ch, signal) {
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
    const end   = el.selectionEnd   ?? el.value.length;

    const newValue = el.value.substring(0, start) + ch + el.value.substring(end);

    if (nativeInputValueSetter && nativeInputValueSetter.set) {
      nativeInputValueSetter.set.call(el, newValue);
    } else {
      el.value = newValue;
    }

    const newPos = start + 1;
    el.selectionStart = el.selectionEnd = newPos;

    // Fire events that frameworks (React, Vue, Angular) listen to
    el.dispatchEvent(new Event('input',  { bubbles: true, cancelable: false }));
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
      } catch {}
    }
    simulateKeyEvents(el, ch);
  }

  // ─── Keyboard Event Simulation (fallback) ───────────────────────────────────

  function simulateKeyEvents(el, ch) {
    const keyCode = ch.charCodeAt(0);
    const eventProps = {
      key:      ch,
      char:     ch,
      keyCode:  keyCode,
      which:    keyCode,
      charCode: keyCode,
      bubbles:  true,
      cancelable: true,
    };

    el.dispatchEvent(new KeyboardEvent('keydown',  eventProps));
    el.dispatchEvent(new KeyboardEvent('keypress', eventProps));

    if (el.tagName.toLowerCase() === 'textarea' || el.tagName.toLowerCase() === 'input') {
      typeInNativeInput(el, ch);
    } else if (el.isContentEditable) {
      typeInContentEditable(el, ch);
    }

    el.dispatchEvent(new KeyboardEvent('keyup', eventProps));
  }

  // ─── Helper: find last focused input ────────────────────────────────────────

  function findFocusedOrLastInput() {
    const active = document.activeElement;
    if (active && isTypeable(active)) return active;
    // Try to find any visible textarea/input
    const inputs = [...document.querySelectorAll('textarea, input[type="text"], [contenteditable="true"]')];
    return inputs.find(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }) || null;
  }

  // ─── Abort / Stop ───────────────────────────────────────────────────────────

  function abortTyping() {
    if (typingState.abortController) {
      typingState.abortController.abort();
    }
    typingState.active  = false;
    typingState.paused  = false;
    if (typingState.pauseResolve) {
      typingState.pauseResolve();
      typingState.pauseResolve = null;
    }
  }

  // ─── Feedback (minimal, non-intrusive) ─────────────────────────────────────

  let feedbackEl = null;
  function showFeedback(msg, type = 'info') {
    if (feedbackEl) feedbackEl.remove();
    feedbackEl = document.createElement('div');
    feedbackEl.textContent = msg;
    feedbackEl.style.cssText = `
      position: fixed; bottom: 16px; right: 16px; z-index: 2147483647;
      padding: 10px 14px; border-radius: 8px;
      font: 500 12px/1.4 Inter, -apple-system, sans-serif;
      max-width: 300px; pointer-events: none;
      background: ${type === 'warning' ? '#2a1a08' : type === 'error' ? '#2a0808' : '#0a1a2a'};
      border: 1px solid ${type === 'warning' ? '#f7a44f44' : type === 'error' ? '#f75c5c44' : '#4f8ef744'};
      color: ${type === 'warning' ? '#f7a44f' : type === 'error' ? '#f75c5c' : '#4f8ef7'};
      box-shadow: 0 4px 20px rgba(0,0,0,0.4);
      animation: tba-slide-up 0.2s ease;
    `;
    if (!document.querySelector('#tba-feedback-style')) {
      const style = document.createElement('style');
      style.id = 'tba-feedback-style';
      style.textContent = '@keyframes tba-slide-up { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }';
      document.head.appendChild(style);
    }
    document.body.appendChild(feedbackEl);
    setTimeout(() => { feedbackEl?.remove(); feedbackEl = null; }, 3500);
  }

  // ─── Message Listener ───────────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {

    switch (msg.action) {

      case 'getStatus':
        sendResponse({
          status:     typingState.active ? (typingState.paused ? 'paused' : 'typing') : 'idle',
          charIndex:  typingState.charIndex,
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

})();
