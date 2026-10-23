/**
 * TypeByAman — Chrome Extension Popup Script
 * Author: Aman Kumar | github.com/Amankr0075
 *
 * Handles all popup UI logic: speed control, controls,
 * communication with content script, settings persistence.
 */

'use strict';

// ─── Constants ─────────────────────────────────────────────────────────────

const STORAGE_KEYS = {
  THEME:           'tba_theme',
  DELAY:           'tba_delay',
  LINEBREAK_DELAY: 'tba_linebreak_delay',
  START_DELAY:     'tba_start_delay',
  TEXT:            'tba_last_text',
  CUSTOM_MODE:     'tba_custom_mode',
};

const SPEED_PRESETS = {
  'Very Slow': 1000,
  'Slow':      250,
  'Normal':    50,
  'Fast':      20,
  'Very Fast': 5,
  'Custom':    null,
};

// ─── State ──────────────────────────────────────────────────────────────────

let state = {
  status:        'idle',   // idle | typing | paused | done | error
  delay:         50,
  linebreakDelay:0,
  startDelay:    0,
  charIndex:     0,
  totalChars:    0,
  text:          '',
  customMode:    false,
  targetTabId:   null,
  theme:         'dark',
};

// ─── DOM References ─────────────────────────────────────────────────────────

const $ = id => document.getElementById(id);
const els = {
  body:              document.body,
  btnTheme:          $('btn-theme-toggle'),
  iconMoon:          $('icon-moon'),
  iconSun:           $('icon-sun'),
  btnSettings:       $('btn-settings'),
  tabs:              document.querySelectorAll('.tab-btn'),
  panels:            document.querySelectorAll('.tab-panel'),
  valChars:          $('val-chars'),
  valProgress:       $('val-progress'),
  valSpeed:          $('val-speed'),
  valStatus:         $('val-status'),
  progressFill:      $('progress-fill'),
  progressGlow:      $('progress-glow'),
  progressBar:       $('progress-bar-container'),
  textInput:         $('text-input'),
  textareaInfo:      $('textarea-char-count'),
  btnPaste:          $('btn-paste'),
  btnClearText:      $('btn-clear-text'),
  btnPickTarget:     $('btn-pick-target'),
  targetDot:         $('target-dot'),
  targetLabel:       $('target-label'),
  speedDisplay:      $('speed-display-value'),
  presetBtns:        document.querySelectorAll('.preset-btn'),
  customPanel:       $('custom-speed-panel'),
  speedSlider:       $('speed-slider'),
  delayChips:        document.querySelectorAll('.delay-chip'),
  customDelayInput:  $('custom-delay-input'),
  linebreakDelay:    $('linebreak-delay'),
  startDelay:        $('start-delay'),
  btnStart:          $('btn-start'),
  btnPause:          $('btn-pause'),
  btnResume:         $('btn-resume'),
  btnStop:           $('btn-stop'),
  btnRestart:        $('btn-restart'),
  messageArea:       $('message-area'),
  messageContent:    $('message-content'),
  btnOpenOptions:    $('btn-open-options'),
};

// ─── Initialization ──────────────────────────────────────────────────────────

async function init() {
  await loadSettings();
  bindEvents();
  updateUI();
  syncWithContentScript();
}

// ─── Settings ────────────────────────────────────────────────────────────────

async function loadSettings() {
  return new Promise(resolve => {
    chrome.storage.local.get(Object.values(STORAGE_KEYS), result => {
      state.theme          = result[STORAGE_KEYS.THEME] || 'dark';
      state.delay          = parseInt(result[STORAGE_KEYS.DELAY]) || 50;
      state.linebreakDelay = parseInt(result[STORAGE_KEYS.LINEBREAK_DELAY]) || 0;
      state.startDelay     = parseInt(result[STORAGE_KEYS.START_DELAY]) || 0;
      state.customMode     = result[STORAGE_KEYS.CUSTOM_MODE] || false;

      const savedText = result[STORAGE_KEYS.TEXT] || '';
      if (savedText) {
        els.textInput.value = savedText;
        updateCharCount(savedText.length);
        state.text = savedText;
        state.totalChars = savedText.length;
      }

      applyTheme(state.theme);
      applyDelay(state.delay, false);
      els.linebreakDelay.value = state.linebreakDelay;
      els.startDelay.value     = state.startDelay;

      if (state.customMode) {
        showCustomPanel(true);
      }

      resolve();
    });
  });
}

function saveSettings() {
  chrome.storage.local.set({
    [STORAGE_KEYS.THEME]:           state.theme,
    [STORAGE_KEYS.DELAY]:           state.delay,
    [STORAGE_KEYS.LINEBREAK_DELAY]: state.linebreakDelay,
    [STORAGE_KEYS.START_DELAY]:     state.startDelay,
    [STORAGE_KEYS.TEXT]:            els.textInput.value.substring(0, 50000),
    [STORAGE_KEYS.CUSTOM_MODE]:     state.customMode,
  });
}

// ─── Theme ───────────────────────────────────────────────────────────────────

function applyTheme(theme) {
  state.theme = theme;
  els.body.setAttribute('data-theme', theme);
  if (theme === 'dark') {
    els.iconMoon.style.display = 'block';
    els.iconSun.style.display  = 'none';
  } else {
    els.iconMoon.style.display = 'none';
    els.iconSun.style.display  = 'block';
  }
}

function toggleTheme() {
  applyTheme(state.theme === 'dark' ? 'light' : 'dark');
  saveSettings();
}

// ─── Speed Control ───────────────────────────────────────────────────────────

function applyDelay(delay, save = true) {
  delay = Math.max(1, Math.min(9999, parseInt(delay) || 50));
  state.delay = delay;

  els.speedDisplay.textContent  = delay;
  els.valSpeed.textContent      = `${delay} ms`;
  els.speedSlider.value         = Math.min(delay, 2000);
  els.customDelayInput.value    = delay;

  // Highlight matching preset
  els.presetBtns.forEach(btn => {
    const d = btn.dataset.delay;
    const isCustom = d === 'custom';
    const matches = !isCustom && parseInt(d) === delay;
    btn.classList.toggle('active', matches);
  });

  // Highlight matching chip
  els.delayChips.forEach(chip => {
    chip.classList.toggle('active', parseInt(chip.dataset.delay) === delay);
  });

  if (save) saveSettings();
}

function showCustomPanel(show) {
  state.customMode = show;
  els.customPanel.style.display = show ? 'block' : 'none';
  if (show) {
    document.getElementById('btn-custom-speed').classList.add('active');
  }
}

// ─── Tabs ────────────────────────────────────────────────────────────────────

function switchTab(tabName) {
  els.tabs.forEach(btn => {
    const isActive = btn.dataset.tab === tabName;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', isActive);
  });
  els.panels.forEach(panel => {
    const isActive = panel.id === `panel-${tabName}`;
    panel.style.display = isActive ? 'block' : 'none';
    panel.classList.toggle('active', isActive);
  });
}

// ─── Status Updates ──────────────────────────────────────────────────────────

function updateStatus(status, charIndex, totalChars) {
  state.status    = status;
  state.charIndex = charIndex  !== undefined ? charIndex  : state.charIndex;
  state.totalChars = totalChars !== undefined ? totalChars : state.totalChars;
  updateUI();
}

function updateUI() {
  const { status, charIndex, totalChars, delay } = state;

  // Status badge
  const badge = els.valStatus;
  badge.className = `status-value status-badge ${status}`;
  badge.textContent = status.charAt(0).toUpperCase() + status.slice(1);

  // Chars & progress
  const pct = totalChars > 0 ? Math.round((charIndex / totalChars) * 100) : 0;
  els.valChars.textContent    = `${charIndex.toLocaleString()} / ${totalChars.toLocaleString()}`;
  els.valProgress.textContent = `${pct}%`;
  els.valSpeed.textContent    = `${delay} ms`;

  // Progress bar
  els.progressFill.style.width = `${pct}%`;
  els.progressGlow.style.width = `${pct}%`;
  els.progressBar.setAttribute('aria-valuenow', pct);

  // Button states
  const isIdle    = status === 'idle' || status === 'done' || status === 'error';
  const isTyping  = status === 'typing';
  const isPaused  = status === 'paused';

  els.btnStart.disabled   = isTyping || isPaused;
  els.btnPause.disabled   = !isTyping;
  els.btnResume.disabled  = !isPaused;
  els.btnStop.disabled    = isIdle;
  els.btnRestart.disabled = isIdle && charIndex === 0;
}

// ─── Character Count ─────────────────────────────────────────────────────────

function updateCharCount(count) {
  els.textareaInfo.textContent = count > 0
    ? `${count.toLocaleString()} character${count !== 1 ? 's' : ''}`
    : '0 characters';
}

// ─── Messages ────────────────────────────────────────────────────────────────

let messageTimer = null;

function showMessage(text, type = 'info', duration = 4000) {
  clearTimeout(messageTimer);
  els.messageArea.className   = `message-area ${type}`;
  els.messageContent.textContent = text;
  els.messageArea.style.display = 'block';
  if (duration > 0) {
    messageTimer = setTimeout(() => {
      els.messageArea.style.display = 'none';
    }, duration);
  }
}

function hideMessage() {
  clearTimeout(messageTimer);
  els.messageArea.style.display = 'none';
}

// ─── Content Script Communication ────────────────────────────────────────────

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function sendToContent(message) {
  const tab = await getActiveTab();
  if (!tab?.id) return null;
  try {
    return await chrome.tabs.sendMessage(tab.id, message);
  } catch (e) {
    return null;
  }
}

async function syncWithContentScript() {
  const response = await sendToContent({ action: 'getStatus' });
  if (response) {
    updateStatus(response.status, response.charIndex, response.totalChars);
  }
}

// ─── Target Picking ──────────────────────────────────────────────────────────

let isPicking = false;

async function startPickTarget() {
  if (isPicking) {
    stopPickTarget();
    return;
  }
  isPicking = true;
  els.btnPickTarget.classList.add('picking');
  els.btnPickTarget.textContent = '⬡ Click a field…';
  els.targetDot.className = 'target-dot picking';
  els.targetLabel.textContent = 'Click any input on the page…';

  const response = await sendToContent({ action: 'startPicking' });
  if (!response || response.error) {
    stopPickTarget();
    showMessage('Could not activate field picker on this page. Try refreshing.', 'error');
  }
}

function stopPickTarget() {
  isPicking = false;
  els.btnPickTarget.classList.remove('picking');
  els.btnPickTarget.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M1 12h3M20 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/></svg>
    Pick Target Field`;
}

function setTargetConnected(label) {
  stopPickTarget();
  els.targetDot.className = 'target-dot connected';
  els.targetLabel.textContent = label || 'Target selected';
}

// ─── Typing Controls ─────────────────────────────────────────────────────────

async function startTyping() {
  const text = els.textInput.value;
  if (!text.trim()) {
    showMessage('Please enter some text or code to type.', 'error');
    return;
  }
  if (text.length > 5_000_000) {
    showMessage('Text is very large. For best performance, consider splitting into chunks.', 'warning', 5000);
  }

  hideMessage();

  const config = {
    action:        'startTyping',
    text:          text,
    delay:         state.delay,
    linebreakDelay:state.linebreakDelay,
    startDelay:    state.startDelay,
  };

  const response = await sendToContent(config);

  if (!response) {
    showMessage('No target page detected. Make sure a web page is open and a target field is selected.', 'error');
    return;
  }
  if (response.error) {
    showMessage(`Error: ${response.error}`, 'error');
    return;
  }

  state.text       = text;
  state.totalChars = text.length;
  saveSettings();
  updateStatus('typing', 0, text.length);
}

async function pauseTyping() {
  const r = await sendToContent({ action: 'pauseTyping' });
  if (r && !r.error) updateStatus('paused');
}

async function resumeTyping() {
  const r = await sendToContent({ action: 'resumeTyping', delay: state.delay });
  if (r && !r.error) updateStatus('typing');
}

async function stopTyping() {
  const r = await sendToContent({ action: 'stopTyping' });
  if (r && !r.error) updateStatus('idle', 0, state.totalChars);
}

async function restartTyping() {
  await sendToContent({ action: 'stopTyping' });
  await new Promise(r => setTimeout(r, 100));
  startTyping();
}

async function updateSpeedOnTheFly() {
  await sendToContent({ action: 'updateDelay', delay: state.delay });
}

// ─── Event Bindings ──────────────────────────────────────────────────────────

function bindEvents() {

  // Theme toggle
  els.btnTheme.addEventListener('click', toggleTheme);

  // Settings → open options page
  els.btnSettings.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
    window.close();
  });

  // Tabs
  els.tabs.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Textarea
  els.textInput.addEventListener('input', () => {
    const len = els.textInput.value.length;
    updateCharCount(len);
    state.totalChars = len;
    els.valChars.textContent = `${state.charIndex.toLocaleString()} / ${len.toLocaleString()}`;
    // Debounced save
    clearTimeout(window._saveTimer);
    window._saveTimer = setTimeout(saveSettings, 1000);
  });

  // Handle Tab key in textarea (insert tab instead of focus change)
  els.textInput.addEventListener('keydown', e => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.target.selectionStart;
      const end   = e.target.selectionEnd;
      e.target.value = e.target.value.substring(0, start) + '\t' + e.target.value.substring(end);
      e.target.selectionStart = e.target.selectionEnd = start + 1;
      els.textInput.dispatchEvent(new Event('input'));
    }
  });

  // Paste
  els.btnPaste.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        els.textInput.value = text;
        els.textInput.dispatchEvent(new Event('input'));
        showMessage('Pasted from clipboard.', 'success', 2000);
      }
    } catch {
      showMessage('Clipboard access denied. Please paste manually.', 'warning');
    }
  });

  // Clear text
  els.btnClearText.addEventListener('click', () => {
    els.textInput.value = '';
    els.textInput.dispatchEvent(new Event('input'));
    hideMessage();
  });

  // Pick target
  els.btnPickTarget.addEventListener('click', startPickTarget);

  // Speed presets
  els.presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const d = btn.dataset.delay;
      if (d === 'custom') {
        // Remove active from all presets, show custom panel
        els.presetBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        showCustomPanel(true);
      } else {
        showCustomPanel(false);
        els.presetBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        applyDelay(parseInt(d));
        if (state.status === 'typing') updateSpeedOnTheFly();
      }
    });
  });

  // Slider
  els.speedSlider.addEventListener('input', () => {
    applyDelay(parseInt(els.speedSlider.value));
    if (state.status === 'typing') updateSpeedOnTheFly();
  });

  // Delay chips
  els.delayChips.forEach(chip => {
    chip.addEventListener('click', () => {
      applyDelay(parseInt(chip.dataset.delay));
      if (state.status === 'typing') updateSpeedOnTheFly();
    });
  });

  // Custom delay number input
  els.customDelayInput.addEventListener('change', () => {
    const v = parseInt(els.customDelayInput.value);
    if (!isNaN(v) && v >= 1) {
      applyDelay(v);
      if (state.status === 'typing') updateSpeedOnTheFly();
    }
  });

  // Line-break delay
  els.linebreakDelay.addEventListener('change', () => {
    const v = parseInt(els.linebreakDelay.value);
    state.linebreakDelay = isNaN(v) ? 0 : Math.max(0, v);
    els.linebreakDelay.value = state.linebreakDelay;
    saveSettings();
  });

  // Start delay
  els.startDelay.addEventListener('change', () => {
    const v = parseInt(els.startDelay.value);
    state.startDelay = isNaN(v) ? 0 : Math.max(0, v);
    els.startDelay.value = state.startDelay;
    saveSettings();
  });

  // Control buttons
  els.btnStart.addEventListener('click',   startTyping);
  els.btnPause.addEventListener('click',   pauseTyping);
  els.btnResume.addEventListener('click',  resumeTyping);
  els.btnStop.addEventListener('click',    stopTyping);
  els.btnRestart.addEventListener('click', restartTyping);

  // Open options
  if (els.btnOpenOptions) {
    els.btnOpenOptions.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
      window.close();
    });
  }

  // Messages from content script
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'statusUpdate') {
      updateStatus(msg.status, msg.charIndex, msg.totalChars);
    }
    if (msg.action === 'targetPicked') {
      setTargetConnected(msg.label);
    }
    if (msg.action === 'typingError') {
      updateStatus('error', msg.charIndex, state.totalChars);
      showMessage(`Typing error: ${msg.error}`, 'error');
    }
    if (msg.action === 'typingDone') {
      updateStatus('done', msg.totalChars, msg.totalChars);
      showMessage('✓ Typing complete!', 'success', 3000);
    }
  });
}

// ─── Boot ────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', init);
