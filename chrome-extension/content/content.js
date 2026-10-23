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
    if (el.closest('.ace_editor'))    return 'ace';
    if (el.isContentEditable || el.closest('[contenteditable="true"]')) return 'contenteditable';
    if (el.tagName.toLowerCase() === 'textarea') return 'textarea';
    return 'input';
  }

  function getElementLabel(el) {
    if (!el) return '';
    const tag   = el.tagName.toLowerCase();
    const id    = el.id ? `#${el.id}` : '';
    const name  = el.name ? `[name="${el.name}"]` : '';
    const placeholder = el.placeholder ? `[${el.placeholder.substring(0, 15)}]` : '';
    const cls   = el.className && typeof el.className === 'string'
      ? '.' + el.className.trim().split(/\s+/).slice(0, 1).join('.') : '';
    const type  = el.type ? `[${el.type}]` : '';
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
      try { target.focus(); } catch {}
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
    if (typingState.active) {
      abortTyping();
      await sleep(50);
    }

    const { text, delay, linebreakDelay, startDelay } = config;
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

    runTypingLoop(target, text, startDelay, ac.signal).catch(() => {});
    return { ok: true, label: getElementLabel(target) };
  }

  async function runTypingLoop(el, text, startDelay, signal) {
    try {
      if (startDelay > 0) await sleep(startDelay, signal);

      try { el.focus(); } catch {}

      // If Monaco editor, focus the inputarea textarea
      if (getEditorType(el) === 'monaco') {
        const monacoEl = el.closest('.monaco-editor');
        if (monacoEl) {
          const ta = monacoEl.querySelector('textarea.inputarea') || monacoEl.querySelector('textarea');
          if (ta) ta.focus();
        }
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
