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
  THEME: 'tba_theme',
  DELAY: 'tba_delay',
  LINEBREAK_DELAY: 'tba_linebreak_delay',
  START_DELAY: 'tba_start_delay',
  TEXT: 'tba_last_text',
  CUSTOM_MODE: 'tba_custom_mode',
};

const SPEED_PRESETS = {
  'Very Slow': 1000,
  'Slow': 250,
  'Normal': 50,
  'Fast': 20,
  'Very Fast': 5,
  'Custom': null,
};

// ─── State ──────────────────────────────────────────────────────────────────

let state = {
  status: 'idle',   // idle | typing | paused | done | error
  delay: 50,
  linebreakDelay: 0,
  startDelay: 0,
  charIndex: 0,
  totalChars: 0,
  text: '',
  customMode: false,
  targetTabId: null,
  theme: 'dark',
};

// ─── DOM References ─────────────────────────────────────────────────────────

const $ = id => document.getElementById(id);
const els = {
  body: document.body,
  btnTheme: $('btn-theme-toggle'),
  iconMoon: $('icon-moon'),
  iconSun: $('icon-sun'),
  btnSettings: $('btn-settings'),
  tabs: document.querySelectorAll('.tab-btn'),
  panels: document.querySelectorAll('.tab-panel'),
  valChars: $('val-chars'),
  valProgress: $('val-progress'),
  valSpeed: $('val-speed'),
  valStatus: $('val-status'),
  progressFill: $('progress-fill'),
  progressGlow: $('progress-glow'),
  progressBar: $('progress-bar-container'),
  textInput: $('text-input'),
  textareaInfo: $('textarea-char-count'),
  btnPaste: $('btn-paste'),
  btnClearText: $('btn-clear-text'),
  speedDisplay: $('speed-display-value'),
  presetBtns: document.querySelectorAll('.preset-btn'),
  customPanel: $('custom-speed-panel'),
  speedSlider: $('speed-slider'),
  delayChips: document.querySelectorAll('.delay-chip'),
  customDelayInput: $('custom-delay-input'),
  linebreakDelay: $('linebreak-delay'),
  startDelay: $('start-delay'),
  btnStart: $('btn-start'),
  btnPause: $('btn-pause'),
  btnResume: $('btn-resume'),
  btnStop: $('btn-stop'),
  btnRestart: $('btn-restart'),
  messageArea: $('message-area'),
  messageContent: $('message-content'),
  btnOpenOptions: $('btn-open-options'),
  statusVisualizer: $('status-visualizer'),
  creatorLink: $('creator-link'),
  btnShare: $('btn-share'),
  btnAboutShare: $('btn-about-share'),
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
      state.theme = result[STORAGE_KEYS.THEME] || 'dark';
      state.delay = parseInt(result[STORAGE_KEYS.DELAY]) || 50;
      state.linebreakDelay = parseInt(result[STORAGE_KEYS.LINEBREAK_DELAY]) || 0;
      state.startDelay = parseInt(result[STORAGE_KEYS.START_DELAY]) || 0;
      state.customMode = result[STORAGE_KEYS.CUSTOM_MODE] || false;

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
      els.startDelay.value = state.startDelay;

      if (state.customMode) {
        showCustomPanel(true);
      }

      resolve();
    });
  });
}

function saveSettings() {
  chrome.storage.local.set({
    [STORAGE_KEYS.THEME]: state.theme,
    [STORAGE_KEYS.DELAY]: state.delay,
    [STORAGE_KEYS.LINEBREAK_DELAY]: state.linebreakDelay,
    [STORAGE_KEYS.START_DELAY]: state.startDelay,
    [STORAGE_KEYS.TEXT]: els.textInput.value.substring(0, 50000),
    [STORAGE_KEYS.CUSTOM_MODE]: state.customMode,
  });
}

// ─── Theme ───────────────────────────────────────────────────────────────────

function applyTheme(theme) {
  state.theme = theme;
  els.body.setAttribute('data-theme', theme);
  if (theme === 'dark') {
    els.iconMoon.style.display = 'block';
    els.iconSun.style.display = 'none';
  } else {
    els.iconMoon.style.display = 'none';
    els.iconSun.style.display = 'block';
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

  els.speedDisplay.textContent = delay;
  els.valSpeed.textContent = `${delay} ms`;
  els.speedSlider.value = Math.min(delay, 2000);
  els.customDelayInput.value = delay;

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
  if (tabName === 'remote' && currentRemoteUrl) {
    renderQRCode(currentRemoteUrl);
  }
}

// ─── Status Updates ──────────────────────────────────────────────────────────

function updateStatus(status, charIndex, totalChars) {
  state.status = status;
  state.charIndex = charIndex !== undefined ? charIndex : state.charIndex;
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
  els.valChars.textContent = `${charIndex.toLocaleString()} / ${totalChars.toLocaleString()}`;
  els.valProgress.textContent = `${pct}%`;
  els.valSpeed.textContent = `${delay} ms`;

  // Progress bar
  els.progressFill.style.width = `${pct}%`;
  els.progressGlow.style.width = `${pct}%`;
  els.progressBar.setAttribute('aria-valuenow', pct);

  // Button states
  const isIdle = status === 'idle' || status === 'done' || status === 'error';
  const isTyping = status === 'typing';
  const isPaused = status === 'paused';

  els.btnStart.disabled = isTyping || isPaused;
  els.btnPause.disabled = !isTyping;
  els.btnResume.disabled = !isPaused;
  els.btnStop.disabled = isIdle;
  els.btnRestart.disabled = isIdle && charIndex === 0;

  // Live visualizer and body typing glow
  if (els.statusVisualizer) {
    els.statusVisualizer.classList.toggle('active', isTyping);
  }
  els.body.classList.toggle('is-typing', isTyping);
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
  els.messageArea.className = `message-area ${type}`;
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
    action: 'startTyping',
    text: text,
    delay: state.delay,
    linebreakDelay: state.linebreakDelay,
    startDelay: state.startDelay,
  };

  const response = await sendToContent(config);

  if (!response) {
    showMessage('No active page found. Open a web page, click into a text field, then click Start.', 'error');
    return;
  }
  if (response.error) {
    showMessage(`Error: ${response.error}`, 'error');
    return;
  }

  state.text = text;
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
      const end = e.target.selectionEnd;
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

  // (Pick Target removed — auto-detection handles field targeting)

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
  els.btnStart.addEventListener('click', startTyping);
  els.btnPause.addEventListener('click', pauseTyping);
  els.btnResume.addEventListener('click', resumeTyping);
  els.btnStop.addEventListener('click', stopTyping);
  els.btnRestart.addEventListener('click', restartTyping);

  // Open options
  if (els.btnOpenOptions) {
    els.btnOpenOptions.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
      window.close();
    });
  }

  // Creator GitHub repo link
  if (els.creatorLink) {
    els.creatorLink.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: 'https://github.com/Amankr0075/TypeByAman' });
    });
  }

  // Share Extension & Setup Guide
  const shareHandler = async () => {
    const shareText = `🚀 TypeByAman — The Ultimate Human-Like Typing & Code Replay Tool
Created by Aman Kumar | https://github.com/Amankr0075/TypeByAman

Replay source code and text character-by-character with natural human typing variations, automatic typo self-correction, and full editor support.

📦 Setup Instructions:

🌐 Chrome Extension:
1. Download or clone: https://github.com/Amankr0075/TypeByAman
2. Open Chrome and navigate to: chrome://extensions/
3. Turn ON "Developer mode" in the top-right corner
4. Click "Load unpacked" and select the "chrome-extension" folder
5. Shortcut: Press Alt+Shift+S in any input or editor to start typing!

💻 VS Code Extension:
1. Search "TypeByAman" in the VS Code Marketplace, OR install the VSIX from:
   https://github.com/Amankr0075/TypeByAman/releases
2. Press Alt+Shift+S to start typing or Alt+Shift+T for the Control Panel

⭐ GitHub Repository & Documentation:
https://github.com/Amankr0075/TypeByAman`;

    try {
      await navigator.clipboard.writeText(shareText);
      showMessage('✓ Copied repo link & setup instructions to clipboard!', 'success', 4000);
    } catch {
      showMessage('Share repo: https://github.com/Amankr0075/TypeByAman', 'info', 4000);
    }

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'TypeByAman — Human-Like Typing & Code Replay Tool',
          text: shareText,
          url: 'https://github.com/Amankr0075/TypeByAman',
        });
      } catch {
        // Ignored if user dismissed native share sheet
      }
    }
  };

  if (els.btnShare) {
    els.btnShare.addEventListener('click', shareHandler);
  }
  if (els.btnAboutShare) {
    els.btnAboutShare.addEventListener('click', shareHandler);
  }

  // Intercept all .about-link clicks to open in new tab safely
  document.querySelectorAll('.about-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const href = link.getAttribute('href');
      if (href) chrome.tabs.create({ url: href });
    });
  });

  // Messages from content script
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'statusUpdate') {
      updateStatus(msg.status, msg.charIndex, msg.totalChars);
    }
    if (msg.action === 'typingError') {
      updateStatus('error', msg.charIndex, state.totalChars);
      showMessage(`Typing error: ${msg.error}`, 'error');
    }
    if (msg.action === 'typingDone') {
      updateStatus('done', msg.totalChars, msg.totalChars);
      showMessage('✓ Typing complete!', 'success', 3000);
    }
    // ── Design Mode Status ──────────────────────────────────────
    if (msg.action === 'designStatus') {
      handleDesignStatus(msg.detail || {});
    }
    // ── Remote Device Connected ─────────────────────────────────
    if (msg.action === 'remoteDeviceConnected') {
      setRemoteConnected(true, msg.device);
    }
  });
}

// ─── Design Mode ─────────────────────────────────────────────────────────────

const designUI = {
  statusBadge:    null,
  platformValue:  null,
  elapsed:        null,
  remaining:      null,
  pct:            null,
  fill:           null,
  glow:           null,
  progressBar:    null,
  actions:        null,
  lastAction:     null,
  btnStart:       null,
  btnPause:       null,
  btnResume:      null,
  btnStop:        null,
  durationChips:  null,
};

let designSessionDuration    = 3600000; // default 1 hour
let designTimerInterval      = null;
let designSessionStart       = null;
let designPausedAccumulated  = 0;
let designPauseStart         = null;

function initDesignUI() {
  designUI.statusBadge   = document.getElementById('design-status-badge');
  designUI.platformValue = document.getElementById('design-platform-value');
  designUI.elapsed       = document.getElementById('design-elapsed');
  designUI.remaining     = document.getElementById('design-remaining');
  designUI.pct           = document.getElementById('design-pct');
  designUI.fill          = document.getElementById('design-progress-fill');
  designUI.glow          = document.getElementById('design-progress-glow');
  designUI.progressBar   = document.getElementById('design-progress-bar');
  designUI.actions       = document.getElementById('design-actions');
  designUI.lastAction    = document.getElementById('design-last-action');
  designUI.btnStart      = document.getElementById('design-btn-start');
  designUI.btnPause      = document.getElementById('design-btn-pause');
  designUI.btnResume     = document.getElementById('design-btn-resume');
  designUI.btnStop       = document.getElementById('design-btn-stop');
  designUI.durationChips = document.querySelectorAll('.design-duration-chips .delay-chip');

  // Duration chip selection
  designUI.durationChips.forEach(chip => {
    chip.addEventListener('click', () => {
      designUI.durationChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      designSessionDuration = parseInt(chip.dataset.duration, 10);
      // Update the remaining display
      if (designUI.remaining) designUI.remaining.textContent = formatTime(designSessionDuration);
    });
  });

  // Control buttons
  if (designUI.btnStart) designUI.btnStart.addEventListener('click', () => sendDesignCmd('start'));
  if (designUI.btnPause) designUI.btnPause.addEventListener('click', () => sendDesignCmd('pause'));
  if (designUI.btnResume) designUI.btnResume.addEventListener('click', () => sendDesignCmd('resume'));
  if (designUI.btnStop) designUI.btnStop.addEventListener('click', () => sendDesignCmd('stop'));

  // Detect platform on current tab
  detectDesignPlatform();

  // Sync state if design mode is already running or paused
  syncDesignStatus();
}

function formatTime(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

async function sendDesignCmd(cmd) {
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  // Inject the design engine if not already present
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content/design-engine.js'],
    });
  } catch (_) {
    // Already injected or injection failed — proceed anyway
  }

  // 1. Direct Chrome runtime tab messaging (Primary, reliable)
  try {
    await chrome.tabs.sendMessage(tab.id, {
      action: 'designCmd',
      cmd,
      duration: designSessionDuration,
    });
  } catch (_) {}

  // 2. Post message into the page context fallback
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (data) => window.postMessage(data, '*'),
      args: [{ tbaDesign: cmd, duration: designSessionDuration }],
    });
  } catch (_) {}

  // Optimistically update UI
  if (cmd === 'start') {
    designSessionStart = Date.now();
    designPausedAccumulated = 0;
    designPauseStart = null;
    startDesignTimer();
    setDesignButtons('running');
    setDesignBadge('running');
  } else if (cmd === 'pause') {
    designPauseStart = Date.now();
    clearDesignTimer();
    setDesignButtons('paused');
    setDesignBadge('paused');
  } else if (cmd === 'resume') {
    if (designPauseStart) {
      designPausedAccumulated += (Date.now() - designPauseStart);
      designPauseStart = null;
    }
    startDesignTimer();
    setDesignButtons('running');
    setDesignBadge('running');
  } else if (cmd === 'stop') {
    clearDesignTimer();
    designSessionStart = null;
    designPausedAccumulated = 0;
    designPauseStart = null;
    setDesignButtons('idle');
    setDesignBadge('stopped');
  }
}

function startDesignTimer() {
  clearDesignTimer();
  designTimerInterval = setInterval(() => {
    if (!designSessionStart) return;
    const now = Date.now();
    const currentPaused = designPauseStart ? (now - designPauseStart) : 0;
    const elapsed   = Math.max(0, now - designSessionStart - designPausedAccumulated - currentPaused);
    const remaining = Math.max(0, designSessionDuration - elapsed);
    const pct       = Math.min(100, Math.round((elapsed / designSessionDuration) * 100));

    if (designUI.elapsed)   designUI.elapsed.textContent   = formatTime(elapsed);
    if (designUI.remaining) designUI.remaining.textContent = formatTime(remaining);
    if (designUI.pct)       designUI.pct.textContent       = pct + '%';
    if (designUI.fill)      designUI.fill.style.width      = pct + '%';
    if (designUI.glow)      designUI.glow.style.width      = pct + '%';
    if (designUI.progressBar) designUI.progressBar.setAttribute('aria-valuenow', pct);

    if (remaining === 0) {
      clearDesignTimer();
      setDesignButtons('idle');
      setDesignBadge('done');
    }
  }, 1000);
}

function clearDesignTimer() {
  if (designTimerInterval) { clearInterval(designTimerInterval); designTimerInterval = null; }
}

function handleDesignStatus(detail) {
  const { state, elapsed, remaining, pct, totalActions, platform, lastAction } = detail;

  if (platform && designUI.platformValue) {
    designUI.platformValue.textContent = platform.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
  if (totalActions !== undefined && designUI.actions) {
    designUI.actions.textContent = totalActions;
  }
  if (lastAction && designUI.lastAction) {
    designUI.lastAction.textContent = lastAction;
  }
  if (pct !== undefined) {
    if (designUI.fill) designUI.fill.style.width = pct + '%';
    if (designUI.glow) designUI.glow.style.width = pct + '%';
    if (designUI.pct)  designUI.pct.textContent  = pct + '%';
    if (designUI.progressBar) designUI.progressBar.setAttribute('aria-valuenow', pct);
  }
  if (elapsed !== undefined && designUI.elapsed) {
    designUI.elapsed.textContent = formatTime(elapsed);
  }
  if (remaining !== undefined && designUI.remaining) {
    designUI.remaining.textContent = formatTime(remaining);
  }

  if (state === 'running') {
    setDesignButtons('running');
    setDesignBadge('running');
    if (!designTimerInterval) startDesignTimer();
  } else if (state === 'paused') {
    clearDesignTimer();
    setDesignButtons('paused');
    setDesignBadge('paused');
  } else if (state === 'done') {
    clearDesignTimer();
    setDesignButtons('idle');
    setDesignBadge('done');
  } else if (state === 'stopped') {
    clearDesignTimer();
    setDesignButtons('idle');
    setDesignBadge('stopped');
  } else if (state === 'error') {
    clearDesignTimer();
    setDesignButtons('idle');
    setDesignBadge('error');
  }
}

function setDesignBadge(status) {
  if (!designUI.statusBadge) return;
  const labels = { running: 'Running', paused: 'Paused', done: 'Done ✓', stopped: 'Stopped', idle: 'Idle', error: 'Error' };
  designUI.statusBadge.textContent = labels[status] || status;
  designUI.statusBadge.className = `design-stat-val status-badge ${status === 'running' ? 'typing' : status === 'paused' ? 'paused' : status === 'done' ? 'done' : 'idle'}`;
}

function setDesignButtons(state) {
  if (!designUI.btnStart) return;
  const running = state === 'running';
  const paused  = state === 'paused';
  const idle    = state === 'idle' || state === 'stopped' || state === 'done' || state === 'error';
  designUI.btnStart.disabled  = !idle;
  designUI.btnPause.disabled  = !running;
  designUI.btnResume.disabled = !paused;
  designUI.btnStop.disabled   = idle;
}

async function syncDesignStatus() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    const res = await chrome.tabs.sendMessage(tab.id, { action: 'designGetStatus' });
    if (res && (res.running || res.paused)) {
      if (res.sessionDuration) designSessionDuration = res.sessionDuration;
      if (res.elapsed !== undefined) {
        designSessionStart = Date.now() - res.elapsed;
        designPausedAccumulated = 0;
        designPauseStart = res.paused ? Date.now() : null;
      }
      handleDesignStatus(res);
    }
  } catch (_) {}
}

async function detectDesignPlatform() {
  if (!designUI.platformValue) return;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) return;
    const url  = new URL(tab.url);
    const host = url.hostname;
    let name = 'Generic Canvas';
    if (host.includes('canva.com'))           name = 'Canva';
    else if (host.includes('figma.com'))      name = 'Figma';
    else if (host.includes('express.adobe')) name = 'Adobe Express';
    else if (host.includes('photoshop.adobe')) name = 'Photoshop Web';
    else if (host.includes('picsart.com'))    name = 'Picsart';
    else if (host.includes('pixlr.com'))      name = 'Pixlr';
    else if (host.includes('vectr.com'))      name = 'Vectr';
    else if (host.includes('gravit.io'))      name = 'Gravit Designer';
    designUI.platformValue.textContent = name;
  } catch (_) {}
}

// ─── Remote Control & QR Code ───────────────────────────────────────────────

let currentRemoteUrl = '';
let currentRemoteSessionId = '';

const remoteUI = {
  qrContainer: $('qr-code-container'),
  sessionText: $('qr-session-text'),
  statusText: $('qr-status-text'),
  livePill: $('remote-live-pill'),
  connLabel: $('remote-conn-label'),
  btnCopyUrl: $('btn-copy-remote-url'),
  btnCopyText: $('btn-copy-remote-text'),
  btnRegenQr: $('btn-regen-qr'),
  btnOpenTab: $('btn-open-remote-tab'),
};

function renderQRCode(url) {
  if (!remoteUI.qrContainer || !url) return;
  if (typeof QRCode !== 'undefined' && typeof QRCode.toSVG === 'function') {
    remoteUI.qrContainer.innerHTML = QRCode.toSVG(url, {
      size: 170,
      color: '#0f172a',
      background: '#ffffff',
      margin: 1,
    });
  } else {
    remoteUI.qrContainer.textContent = 'Generating QR...';
  }
}

async function loadRemoteSession() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'getRemoteUrl' }, (response) => {
      if (response && response.url) {
        currentRemoteUrl = response.url;
        currentRemoteSessionId = response.sessionId;
        if (remoteUI.sessionText) remoteUI.sessionText.textContent = response.sessionId;
        renderQRCode(response.url);
        if (response.connected) {
          setRemoteConnected(true);
        }
      } else if (typeof globalThis.remoteBridge !== 'undefined') {
        const url = globalThis.remoteBridge.getRemoteUrl();
        const sid = globalThis.remoteBridge.sessionId;
        currentRemoteUrl = url;
        currentRemoteSessionId = sid;
        if (remoteUI.sessionText) remoteUI.sessionText.textContent = sid;
        renderQRCode(url);
      }
      resolve();
    });
  });
}

function setRemoteConnected(connected, deviceName) {
  if (remoteUI.livePill) {
    remoteUI.livePill.classList.toggle('connected', !!connected);
  }
  if (remoteUI.connLabel) {
    remoteUI.connLabel.textContent = connected ? 'Connected' : 'Ready';
  }
  if (remoteUI.statusText) {
    remoteUI.statusText.textContent = connected
      ? `Active: ${deviceName || 'Phone/Tablet'}`
      : 'Waiting for phone to scan...';
    remoteUI.statusText.style.color = connected ? 'var(--accent-green)' : 'var(--text-primary)';
  }
}

function initRemoteUI() {
  if (!remoteUI.qrContainer) return;

  loadRemoteSession();

  // Copy remote link button
  if (remoteUI.btnCopyUrl) {
    remoteUI.btnCopyUrl.addEventListener('click', async () => {
      if (!currentRemoteUrl) return;
      try {
        await navigator.clipboard.writeText(currentRemoteUrl);
        if (remoteUI.btnCopyText) {
          const original = remoteUI.btnCopyText.textContent;
          remoteUI.btnCopyText.textContent = 'Copied!';
          setTimeout(() => {
            remoteUI.btnCopyText.textContent = original;
          }, 2000);
        }
      } catch (_) {
        const ta = document.createElement('textarea');
        ta.value = currentRemoteUrl;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
    });
  }

  // Regenerate QR
  if (remoteUI.btnRegenQr) {
    remoteUI.btnRegenQr.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'regenerateRemoteSession' }, (res) => {
        if (res && res.url) {
          currentRemoteUrl = res.url;
          currentRemoteSessionId = res.sessionId;
          if (remoteUI.sessionText) remoteUI.sessionText.textContent = res.sessionId;
          renderQRCode(res.url);
          setRemoteConnected(false);
        }
      });
    });
  }

  // Open in browser tab
  if (remoteUI.btnOpenTab) {
    remoteUI.btnOpenTab.addEventListener('click', () => {
      if (currentRemoteUrl) {
        chrome.tabs.create({ url: currentRemoteUrl });
      }
    });
  }

  // Listen to remote bridge events
  if (typeof globalThis.remoteBridge !== 'undefined') {
    globalThis.remoteBridge.addListener((event) => {
      if (event.type === 'deviceConnected') {
        setRemoteConnected(true, event.device);
      }
    });
  }
}

// ─── Boot ────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  init();
  initDesignUI();
  initRemoteUI();
});

