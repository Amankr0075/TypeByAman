/**
 * TypeByAman — Interactive Web Typing & Replay Studio
 * Author: Aman Kumar | https://github.com/Amankr0075
 * 100% Free, Local, No Server Required.
 */

(() => {
  'use strict';

  // --- Preset Code Snippets ---
  const PRESETS = {
    javascript: {
      filename: 'asyncFibonacci.js',
      text: `/**
 * TypeByAman — Asynchronous Fibonacci Stream
 * Author: Aman Kumar (github.com/Amankr0075)
 */
async function* generateFibonacci(limit = 10) {
  let [prev, curr] = [0, 1];
  for (let i = 0; i < limit; i++) {
    yield curr;
    [prev, curr] = [curr, prev + curr];
    await new Promise(r => setTimeout(r, 100));
  }
}

async function runDemo() {
  console.log("Starting Fibonacci Sequence...");
  for await (const n of generateFibonacci(8)) {
    console.log("Fibonacci:", n);
  }
  console.log("Demonstration complete!");
}

runDemo();`
    },
    python: {
      filename: 'neural_layer.py',
      text: `"""
TypeByAman — Dense Neural Layer Implementation
Author: Aman Kumar (github.com/Amankr0075)
"""
import numpy as np

class DenseLayer:
    def __init__(self, n_inputs: int, n_neurons: int):
        # Initialize weights and biases
        self.weights = 0.01 * np.random.randn(n_inputs, n_neurons)
        self.biases = np.zeros((1, n_neurons))

    def forward(self, inputs: np.ndarray) -> np.ndarray:
        self.output = np.dot(inputs, self.weights) + self.biases
        return np.maximum(0, self.output) # ReLU activation

layer = DenseLayer(n_inputs=4, n_neurons=8)
features = np.random.randn(1, 4)
output = layer.forward(features)
print(f"Layer Output Shape: {output.shape}")`
    },
    react: {
      filename: 'useGlassCounter.jsx',
      text: `import React, { useState, useEffect } from 'react';

/**
 * TypeByAman — Modern Glassmorphic Counter Hook
 * Created by Aman Kumar
 */
export function useGlassCounter(initialValue = 0, step = 1) {
  const [count, setCount] = useState(initialValue);
  const [history, setHistory] = useState([]);

  const increment = () => {
    setCount(prev => prev + step);
    setHistory(h => [...h.slice(-9), count + step]);
  };

  const decrement = () => {
    setCount(prev => Math.max(0, prev - step));
  };

  return { count, increment, decrement, history };
}`
    },
    html: {
      filename: 'cyberpunk.html',
      text: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>TypeByAman Demo</title>
  <style>
    body {
      background: #0b0f19;
      color: #06b6d4;
      font-family: system-ui, sans-serif;
      display: grid;
      place-items: center;
      min-height: 100vh;
    }
    .glowing-card {
      border: 1px solid rgba(6, 182, 212, 0.4);
      padding: 2rem 3rem;
      border-radius: 1rem;
      box-shadow: 0 0 30px rgba(6, 182, 212, 0.2);
    }
  </style>
</head>
<body>
  <div class="glowing-card">
    <h1>Type. Replay. Create.</h1>
    <p>Created by Aman Kumar</p>
  </div>
</body>
</html>`
    },
    markdown: {
      filename: 'PROJECT_NOTES.md',
      text: `# TypeByAman

> **Type. Replay. Create.**
> Crafted with precision by **Aman Kumar** (github.com/Amankr0075)

### Highlights:
- **100% Free**: No subscriptions, no telemetry, no sign-ups.
- **Configurable Speed**: From 1ms to 5000ms delay.
- **Zero Server Footprint**: Runs completely in your local browser and editor.
- **Multi-Platform**: Available as Chrome Extension & VS Code Extension.`
    },
    custom: {
      filename: 'custom_script.txt',
      text: `Hello, World!\nWelcome to TypeByAman — created by Aman Kumar.\n\nType. Replay. Create.`
    }
  };

  // --- Sound Synthesizer (Web Audio API) ---
  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.enabled = true;
    }

    init() {
      if (!this.ctx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          this.ctx = new AudioContext();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    playClick(char) {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const isSpace = char === ' ' || char === '\n';

      // Oscillator for bottom-out click
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      // Pitch shift based on key type
      const baseFreq = isSpace ? 160 : 380 + (Math.random() * 80 - 40);
      osc.type = isSpace ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + (isSpace ? 0.05 : 0.035));

      // Click envelope
      const volume = isSpace ? 0.08 : 0.05;
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + (isSpace ? 0.06 : 0.04));

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + (isSpace ? 0.06 : 0.04));
    }
  }

  // --- Syntax Tokenizer ---
  function highlightSnippet(text) {
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    return escaped
      // Comments (single & multi)
      .replace(/(\/\*[\s\S]*?\*\/|\/\/[^\n]*|#[^\n]*)/g, '<span class="token-comment">$1</span>')
      // Strings
      .replace(/("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)/g, '<span class="token-string">$1</span>')
      // Keywords
      .replace(/\b(async|await|function|class|return|const|let|var|if|else|for|while|import|from|export|def|self|yield|try|catch)\b/g, '<span class="token-keyword">$1</span>')
      // Numbers
      .replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="token-number">$1</span>');
  }

  // --- State ---
  const state = {
    currentText: PRESETS.javascript.text,
    charIndex: 0,
    status: 'idle', // 'idle' | 'countdown' | 'typing' | 'paused' | 'done'
    charDelay: 50,
    lineBreakDelay: 150,
    startDelaySec: 0,
    preserveIndentation: true,
    autoScroll: true,
    humanTypoMode: true,
    timerStart: null,
    timerInterval: null,
    activeTimeout: null,
    countdownInterval: null
  };

  const sound = new SoundEngine();

  // --- DOM Elements ---
  const el = {
    snippetSelect: document.getElementById('snippet-select'),
    presetBadge: document.getElementById('preset-badge'),
    presetButtons: document.querySelectorAll('.preset-btn'),
    charDelaySlider: document.getElementById('char-delay-slider'),
    charDelayNum: document.getElementById('char-delay-num'),
    lineDelaySlider: document.getElementById('line-delay-slider'),
    lineDelayNum: document.getElementById('line-delay-num'),
    startDelaySlider: document.getElementById('start-delay-slider'),
    startDelayNum: document.getElementById('start-delay-num'),
    toggleHumanTypo: document.getElementById('toggle-human-typo'),
    toggleSound: document.getElementById('toggle-sound'),
    toggleIndent: document.getElementById('toggle-indent'),
    toggleAutoScroll: document.getElementById('toggle-auto-scroll'),
    btnEditSource: document.getElementById('btn-edit-source'),
    sourceDrawer: document.getElementById('source-drawer'),
    rawTextInput: document.getElementById('raw-text-input'),
    btnClearSource: document.getElementById('btn-clear-source'),
    btnSaveSource: document.getElementById('btn-save-source'),
    tabName: document.getElementById('tab-name'),
    statusDot: document.getElementById('status-dot'),
    btnCopyOutput: document.getElementById('btn-copy-output'),
    btnFullscreen: document.getElementById('btn-fullscreen'),
    editorContainer: document.getElementById('editor-container'),
    editorBody: document.getElementById('editor-body'),
    lineNumbers: document.getElementById('line-numbers'),
    codeTarget: document.getElementById('code-target'),
    engineStatusBadge: document.getElementById('engine-status-badge'),
    statProgress: document.getElementById('stat-progress'),
    statChars: document.getElementById('stat-chars'),
    statWpm: document.getElementById('stat-wpm'),
    statCpm: document.getElementById('stat-cpm'),
    statTime: document.getElementById('stat-time'),
    progressBar: document.getElementById('progress-bar'),
    btnPlay: document.getElementById('btn-play'),
    playText: document.getElementById('play-text'),
    btnPause: document.getElementById('btn-pause'),
    btnStop: document.getElementById('btn-stop'),
    btnRestart: document.getElementById('btn-restart'),
    btnStep: document.getElementById('btn-step'),
    countdownDisplay: document.getElementById('countdown-display'),
    countdownVal: document.getElementById('countdown-val'),
    btnJumpStudio: document.getElementById('btn-jump-studio'),
    webApiKeyInput: document.getElementById('web-api-key-input'),
    btnSaveWebKey: document.getElementById('btn-save-web-key'),
    keyHintText: document.getElementById('key-hint-text'),
    btnToggleKeyVisibility: document.getElementById('btn-toggle-key-visibility'),
    aiCategorySelect: document.getElementById('ai-category-select'),
    aiCustomPromptContainer: document.getElementById('ai-custom-prompt-container'),
    aiCustomPromptInput: document.getElementById('ai-custom-prompt-input'),
    btnGenerateAi: document.getElementById('btn-generate-ai'),
    btnGenerateAiText: document.getElementById('btn-generate-ai-text'),
    webOsBridgeCard: document.getElementById('web-os-bridge-card'),
    webBridgeDot: document.getElementById('web-bridge-dot'),
    webBridgeTitle: document.getElementById('web-bridge-title'),
    webBridgeDesc: document.getElementById('web-bridge-desc'),
  };

  // --- Helper Functions ---
  function updateLineNumbers(text) {
    const lines = (text.slice(0, state.charIndex).match(/\n/g) || []).length + 1;
    let html = '';
    for (let i = 1; i <= Math.max(lines, 1); i++) {
      html += i + '\n';
    }
    el.lineNumbers.textContent = html;
  }

  function updateStatus(newStatus) {
    state.status = newStatus;
    el.engineStatusBadge.className = `badge-status ${newStatus}`;
    el.engineStatusBadge.textContent = newStatus.charAt(0).toUpperCase() + newStatus.slice(1);

    if (newStatus === 'typing') {
      el.statusDot.classList.add('active');
      el.btnPlay.disabled = true;
      el.btnPause.disabled = false;
      el.btnStop.disabled = false;
      el.playText.textContent = 'Typing...';
    } else if (newStatus === 'paused') {
      el.statusDot.classList.remove('active');
      el.btnPlay.disabled = false;
      el.btnPause.disabled = true;
      el.btnStop.disabled = false;
      el.playText.textContent = 'Resume';
    } else if (newStatus === 'done') {
      el.statusDot.classList.remove('active');
      el.btnPlay.disabled = false;
      el.btnPause.disabled = true;
      el.btnStop.disabled = true;
      el.playText.textContent = 'Replay';
    } else if (newStatus === 'idle') {
      el.statusDot.classList.remove('active');
      el.btnPlay.disabled = false;
      el.btnPause.disabled = true;
      el.btnStop.disabled = true;
      el.playText.textContent = 'Start Replay';
    }
  }

  function updateTelemetry() {
    const totalChars = state.currentText.length;
    const currentChars = state.charIndex;
    const progress = totalChars === 0 ? 0 : Math.round((currentChars / totalChars) * 100);

    el.statProgress.textContent = `${progress}%`;
    el.statChars.textContent = `${currentChars} / ${totalChars}`;
    el.progressBar.style.width = `${progress}%`;

    // Speed metrics
    if (state.timerStart) {
      const elapsedMinutes = (Date.now() - state.timerStart) / 60000;
      if (elapsedMinutes > 0.005) {
        const cpm = Math.round(currentChars / elapsedMinutes);
        const wpm = Math.round(cpm / 5);
        el.statCpm.textContent = cpm;
        el.statWpm.textContent = wpm;
      }
    }
  }

  function startTimer() {
    if (!state.timerStart) {
      state.timerStart = Date.now();
    }
    clearInterval(state.timerInterval);
    state.timerInterval = setInterval(() => {
      if (state.status === 'typing' && state.timerStart) {
        const elapsedSec = Math.floor((Date.now() - state.timerStart) / 1000);
        const m = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
        const s = String(elapsedSec % 60).padStart(2, '0');
        el.statTime.textContent = `${m}:${s}`;
      }
    }, 1000);
  }

  function renderView() {
    const visibleSub = state.currentText.slice(0, state.charIndex);
    el.codeTarget.innerHTML = highlightSnippet(visibleSub);
    updateLineNumbers(state.currentText);
    updateTelemetry();

    if (state.autoScroll) {
      el.editorBody.scrollTop = el.editorBody.scrollHeight;
    }
  }

  // --- Typing Loop ---
  let currentWordTempo = Math.random() < 0.35 ? 'fast' : (Math.random() < 0.22 ? 'deliberate' : 'normal');
  let charsSinceLastThink5s = 0;
  let nextThink5sThreshold = 140 + Math.floor(Math.random() * 160);

  function typeNextCharacter() {
    if (state.status !== 'typing') return;

    if (state.charIndex >= state.currentText.length) {
      updateStatus('done');
      clearInterval(state.timerInterval);
      return;
    }

    const nextChar = state.currentText[state.charIndex];
    state.charIndex++;
    charsSinceLastThink5s++;

    renderView();
    sound.playClick(nextChar);

    const isWordBoundary = nextChar === ' ' || nextChar === '\t';
    const isPunctuation = /[.,!?:;]/.test(nextChar);
    const isLineBreak = nextChar === '\n';

    // ── 5-Second Human Thinking Pause ──
    // "while typing somewhere wait for 5 seconds and then continue writing"
    if (charsSinceLastThink5s >= nextThink5sThreshold && (isWordBoundary || isPunctuation || isLineBreak)) {
      charsSinceLastThink5s = 0;
      nextThink5sThreshold = 150 + Math.floor(Math.random() * 180);
      currentWordTempo = Math.random() < 0.4 ? 'fast' : (Math.random() < 0.25 ? 'deliberate' : 'normal');
      const think5s = 4700 + Math.floor(Math.random() * 600);
      state.activeTimeout = setTimeout(typeNextCharacter, think5s);
      return;
    }

    if (isWordBoundary) {
      // Switch word tempo: some words fast, some words deliberate
      currentWordTempo = Math.random() < 0.35 ? 'fast' : (Math.random() < 0.22 ? 'deliberate' : 'normal');
    }

    // Dynamic tempo multiplier (never constant)
    let tempoMult = 1.0;
    if (currentWordTempo === 'fast') {
      tempoMult = 0.40 + Math.random() * 0.22; // fast burst word
    } else if (currentWordTempo === 'deliberate') {
      tempoMult = 1.45 + Math.random() * 0.65; // deliberate word
    } else {
      tempoMult = 0.80 + Math.random() * 0.40; // normal variation
    }

    let delay = Math.max(15, Math.round(state.charDelay * tempoMult * (0.80 + Math.random() * 0.40)));

    if (isLineBreak && state.lineBreakDelay > 0) {
      delay += Math.round(state.lineBreakDelay * (0.85 + Math.random() * 0.30));
    }

    state.activeTimeout = setTimeout(typeNextCharacter, delay);
  }

  // --- Engine Commands ---
  function startTyping() {
    sound.init();

    if (state.status === 'paused') {
      updateStatus('typing');
      typeNextCharacter();
      return;
    }

    if (state.charIndex >= state.currentText.length) {
      state.charIndex = 0;
      state.timerStart = null;
      el.statTime.textContent = '00:00';
    }

    if (state.startDelaySec > 0) {
      let remaining = state.startDelaySec;
      updateStatus('countdown');
      el.countdownDisplay.style.display = 'block';
      el.countdownVal.textContent = remaining;

      clearInterval(state.countdownInterval);
      state.countdownInterval = setInterval(() => {
        remaining--;
        if (remaining <= 0) {
          clearInterval(state.countdownInterval);
          el.countdownDisplay.style.display = 'none';
          updateStatus('typing');
          startTimer();
          typeNextCharacter();
        } else {
          el.countdownVal.textContent = remaining;
        }
      }, 1000);
    } else {
      updateStatus('typing');
      startTimer();
      typeNextCharacter();
    }
  }

  function pauseTyping() {
    if (state.status === 'typing') {
      clearTimeout(state.activeTimeout);
      updateStatus('paused');
    }
  }

  function stopTyping() {
    clearTimeout(state.activeTimeout);
    clearInterval(state.countdownInterval);
    clearInterval(state.timerInterval);
    el.countdownDisplay.style.display = 'none';
    state.charIndex = 0;
    state.timerStart = null;
    el.statTime.textContent = '00:00';
    renderView();
    updateStatus('idle');
  }

  function restartTyping() {
    stopTyping();
    startTyping();
  }

  function stepCharacter() {
    if (state.charIndex < state.currentText.length) {
      pauseTyping();
      const ch = state.currentText[state.charIndex];
      state.charIndex++;
      sound.playClick(ch);
      renderView();
    }
  }

  // --- Speed Controls Binding ---
  function setSpeed(delay, presetName) {
    state.charDelay = Number(delay);
    el.charDelaySlider.value = delay;
    el.charDelayNum.value = delay;
    el.presetBadge.textContent = `${presetName} (${delay}ms)`;

    el.presetButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.preset === presetName);
    });
  }

  el.presetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = btn.dataset.preset;
      const delay = btn.dataset.delay;
      setSpeed(delay, preset);
    });
  });

  el.charDelaySlider.addEventListener('input', (e) => {
    const val = Number(e.target.value);
    state.charDelay = val;
    el.charDelayNum.value = val;
    el.presetBadge.textContent = `Custom (${val}ms)`;
    el.presetButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.preset === 'Custom'));
  });

  el.charDelayNum.addEventListener('change', (e) => {
    const val = Math.max(1, Math.min(5000, Number(e.target.value) || 50));
    state.charDelay = val;
    el.charDelaySlider.value = Math.min(1000, val);
    el.charDelayNum.value = val;
    el.presetBadge.textContent = `Custom (${val}ms)`;
    el.presetButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.preset === 'Custom'));
  });

  el.lineDelaySlider.addEventListener('input', (e) => {
    const val = Number(e.target.value);
    state.lineBreakDelay = val;
    el.lineDelayNum.value = val;
  });

  el.lineDelayNum.addEventListener('change', (e) => {
    const val = Math.max(0, Math.min(5000, Number(e.target.value) || 0));
    state.lineBreakDelay = val;
    el.lineDelaySlider.value = Math.min(2000, val);
    el.lineDelayNum.value = val;
  });

  el.startDelaySlider.addEventListener('input', (e) => {
    const val = Number(e.target.value);
    state.startDelaySec = val;
    el.startDelayNum.value = val;
  });

  el.startDelayNum.addEventListener('change', (e) => {
    const val = Math.max(0, Math.min(10, Number(e.target.value) || 0));
    state.startDelaySec = val;
    el.startDelaySlider.value = val;
    el.startDelayNum.value = val;
  });

  // Toggles
  el.toggleSound.addEventListener('change', (e) => {
    sound.enabled = e.target.checked;
  });

  el.toggleIndent.addEventListener('change', (e) => {
    state.preserveIndentation = e.target.checked;
  });

  el.toggleAutoScroll.addEventListener('change', (e) => {
    state.autoScroll = e.target.checked;
  });

  // Preset Selector
  el.snippetSelect.addEventListener('change', (e) => {
    const selected = PRESETS[e.target.value] || PRESETS.javascript;
    state.currentText = selected.text;
    el.tabName.textContent = selected.filename;
    el.rawTextInput.value = selected.text;
    stopTyping();
  });

  // Source Text Drawer
  el.btnEditSource.addEventListener('click', () => {
    const isOpen = el.sourceDrawer.style.display !== 'none';
    el.sourceDrawer.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) {
      el.rawTextInput.focus();
    }
  });

  el.btnClearSource.addEventListener('click', () => {
    el.rawTextInput.value = '';
    el.rawTextInput.focus();
  });

  el.btnSaveSource.addEventListener('click', () => {
    state.currentText = el.rawTextInput.value;
    el.sourceDrawer.style.display = 'none';
    stopTyping();
  });

  // Actions Toolbar
  el.btnPlay.addEventListener('click', () => {
    if (state.status === 'paused') {
      startTyping();
    } else {
      startTyping();
    }
  });

  el.btnPause.addEventListener('click', pauseTyping);
  el.btnStop.addEventListener('click', stopTyping);
  el.btnRestart.addEventListener('click', restartTyping);
  el.btnStep.addEventListener('click', stepCharacter);

  // Copy Typed Output
  el.btnCopyOutput.addEventListener('click', async () => {
    const typed = state.currentText.slice(0, state.charIndex);
    try {
      await navigator.clipboard.writeText(typed);
      const originalTitle = el.btnCopyOutput.title;
      el.btnCopyOutput.title = 'Copied!';
      setTimeout(() => el.btnCopyOutput.title = originalTitle, 1500);
    } catch {
      // fallback
    }
  });

  // Fullscreen
  el.btnFullscreen.addEventListener('click', () => {
    el.editorContainer.classList.toggle('fullscreen');
  });

  // Global Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    // Alt + Shift + S => Start
    if (e.altKey && e.shiftKey && (e.key === 'S' || e.key === 's')) {
      e.preventDefault();
      if (state.status === 'typing') pauseTyping();
      else startTyping();
    }
    // Alt + Shift + P => Pause / Resume
    if (e.altKey && e.shiftKey && (e.key === 'P' || e.key === 'p')) {
      e.preventDefault();
      if (state.status === 'typing') pauseTyping();
      else if (state.status === 'paused') startTyping();
    }
    // Alt + Shift + X => Stop
    if (e.altKey && e.shiftKey && (e.key === 'X' || e.key === 'x')) {
      e.preventDefault();
      stopTyping();
    }
    // Alt + Shift + T => Focus or Open Source
    if (e.altKey && e.shiftKey && (e.key === 'T' || e.key === 't')) {
      e.preventDefault();
      el.btnEditSource.click();
    }
    // Escape to close fullscreen
    if (e.key === 'Escape' && el.editorContainer.classList.contains('fullscreen')) {
      el.editorContainer.classList.remove('fullscreen');
    }
  });

  // ─── Human Mistake Simulation Toggle ───
  if (el.toggleHumanTypo) {
    el.toggleHumanTypo.addEventListener('change', (e) => {
      state.humanTypoMode = e.target.checked;
    });
  }

  // ─── AI API Key Manager ───
  const STORAGE_KEY_GROQ = 'typebyaman_groq_key';

  function initApiKeyManager() {
    if (!el.webApiKeyInput) return;
    const savedKey = (localStorage.getItem(STORAGE_KEY_GROQ) || '').trim();
    if (savedKey) {
      el.webApiKeyInput.value = savedKey;
      if (el.keyHintText) el.keyHintText.textContent = '✓ Groq API Key saved';
    }

    el.btnSaveWebKey?.addEventListener('click', () => {
      const val = el.webApiKeyInput.value.trim();
      if (val) {
        localStorage.setItem(STORAGE_KEY_GROQ, val);
        if (el.keyHintText) el.keyHintText.textContent = '✓ Groq API Key saved';
      } else {
        localStorage.removeItem(STORAGE_KEY_GROQ);
        if (el.keyHintText) el.keyHintText.textContent = 'Key removed (using local fallback)';
      }
    });

    el.btnToggleKeyVisibility?.addEventListener('click', () => {
      const isPass = el.webApiKeyInput.type === 'password';
      el.webApiKeyInput.type = isPass ? 'text' : 'password';
      el.btnToggleKeyVisibility.textContent = isPass ? 'Hide' : 'Show';
    });

    el.aiCategorySelect?.addEventListener('change', () => {
      if (el.aiCustomPromptContainer) {
        el.aiCustomPromptContainer.style.display = el.aiCategorySelect.value === 'custom' ? 'block' : 'none';
      }
    });
  }

  // ─── AI Prompt & Code Generation Engine ───
  const AI_FALLBACKS = {
    algorithm: {
      filename: 'quickSortOptimization.js',
      text: `/**
 * TypeByAman AI • Dual-Pivot QuickSort Engine
 * Generated via TypeByAman Creative Engine
 */
function dualPivotQuickSort(arr, low = 0, high = arr.length - 1) {
  if (low < high) {
    if (arr[low] > arr[high]) [arr[low], arr[high]] = [arr[high], arr[low]];
    let p = arr[low], q = arr[high];
    let l = low + 1, g = high - 1, k = l;
    while (k <= g) {
      if (arr[k] < p) {
        [arr[k], arr[l]] = [arr[l], arr[k]];
        l++;
      } else if (arr[k] >= q) {
        while (arr[g] > q && k < g) g--;
        [arr[k], arr[g]] = [arr[g], arr[k]];
        g--;
        if (arr[k] < p) {
          [arr[k], arr[l]] = [arr[l], arr[k]];
          l++;
        }
      }
      k++;
    }
    l--; g++;
    [arr[low], arr[l]] = [arr[l], arr[low]];
    [arr[high], arr[g]] = [arr[g], arr[high]];
    dualPivotQuickSort(arr, low, l - 1);
    dualPivotQuickSort(arr, l + 1, g - 1);
    dualPivotQuickSort(arr, g + 1, high);
  }
  return arr;
}`
    },
    'python-ml': {
      filename: 'transformer_attention.py',
      text: `"""
TypeByAman AI • Scaled Dot-Product Attention
Author: Aman Kumar | Type. Replay. Create.
"""
import torch
import torch.nn as nn
import math

class ScaledDotProductAttention(nn.Module):
    def __init__(self, temperature: float, dropout: float = 0.1):
        super().__init__()
        self.temperature = temperature
        self.dropout = nn.Dropout(dropout)
        self.softmax = nn.Softmax(dim=-1)

    def forward(self, q, k, v, mask=None):
        scores = torch.matmul(q / self.temperature, k.transpose(2, 3))
        if mask is not None:
            scores = scores.masked_fill(mask == 0, -1e9)
        attn = self.dropout(self.softmax(scores))
        output = torch.matmul(attn, v)
        return output, attn`
    },
    'react-ui': {
      filename: 'CyberCard.jsx',
      text: `import React, { useState } from 'react';

export default function CyberCard({ title = "BEYOND THE HORIZON", category = "AI INTERACTION" }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div 
      className="relative p-8 rounded-2xl border border-cyan-500/30 bg-slate-900/80 backdrop-blur-xl"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span className="text-xs uppercase tracking-widest text-cyan-400 font-bold">{category}</span>
      <h2 className="text-2xl font-black text-white mt-2">{title}</h2>
      <p className="text-slate-400 text-sm mt-3">Engineered for human authenticity and fluid execution.</p>
    </div>
  );
}`
    },
    headline: {
      filename: 'creative_headline.txt',
      text: `THE ARCHITECTURE OF SILENCE\nBEYOND THE BOUNDARIES OF COMPUTATION\nCRAFTING THE FUTURE OF DIGITAL EXPRESSION`
    },
    quote: {
      filename: 'quote.txt',
      text: `"True simplicity is not the absence of clutter, but the mastery of intent in every stroke." — TypeByAman`
    },
    cta: {
      filename: 'call_to_action.txt',
      text: `EXPLORE COLLECTION →\nINITIALIZE REPLAY NOW\nUNLOCK CREATIVE CAPABILITIES`
    }
  };

  async function generateAiContent() {
    const category = el.aiCategorySelect?.value || 'algorithm';
    const customPrompt = (el.aiCustomPromptInput?.value || '').trim();
    const apiKey = (localStorage.getItem(STORAGE_KEY_GROQ) || '').trim();

    if (el.btnGenerateAi) el.btnGenerateAi.disabled = true;
    if (el.btnGenerateAiText) el.btnGenerateAiText.textContent = 'Generating with Llama 3...';

    try {
      if (apiKey) {
        let prompt = '';
        switch (category) {
          case 'algorithm':
            prompt = 'Write ONE clean, complete, modern JavaScript algorithm or data structure (e.g. A* search, LRU Cache, or Red-Black Tree) with concise comments. Output ONLY the code, no markdown, no backticks.';
            break;
          case 'python-ml':
            prompt = 'Write ONE clean, authentic Python class for machine learning (e.g. self-attention, loss function, or dataset pipeline). Output ONLY the clean code.';
            break;
          case 'react-ui':
            prompt = 'Write ONE modern React component with Tailwind/CSS classes showcasing state and interaction. Output ONLY valid JSX code.';
            break;
          case 'headline':
            prompt = 'Write 3 punchy, ultra-modern bold design headlines in all uppercase. 2-5 words each.';
            break;
          case 'quote':
            prompt = 'Write ONE profound, authentic quote about engineering, design, or architecture. 1 sentence.';
            break;
          case 'cta':
            prompt = 'Write 3 high-converting, modern button call-to-actions with arrow glyphs (→).';
            break;
          default:
            prompt = customPrompt || 'Write a modern, elegant coding snippet.';
        }

        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 6000);

        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          signal: ctrl.signal,
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
              { role: 'system', content: 'You are an elite software architect and creative director. Output ONLY the raw code or text requested with zero markdown formatting and zero introductory chat.' },
              { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 350,
          })
        });
        clearTimeout(tid);

        if (res.ok) {
          const data = await res.json();
          let generated = data.choices?.[0]?.message?.content?.trim() || '';
          generated = generated.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
          if (generated) {
            applyGeneratedText(generated, category);
            return;
          }
        }
      }
    } catch (_) {
      // Fallback seamlessly
    } finally {
      if (el.btnGenerateAi) el.btnGenerateAi.disabled = false;
      if (el.btnGenerateAiText) el.btnGenerateAiText.textContent = 'Generate with AI & Load';
    }

    // High quality curated fallback if API offline or no key
    const fallback = AI_FALLBACKS[category] || AI_FALLBACKS.algorithm;
    applyGeneratedText(fallback.text, category, fallback.filename);
  }

  function applyGeneratedText(text, category, customFilename) {
    state.currentText = text;
    el.rawTextInput.value = text;
    const names = {
      algorithm: 'aiAlgorithm.js',
      'python-ml': 'aiNeuralNet.py',
      'react-ui': 'AiComponent.jsx',
      headline: 'aiHeadlines.txt',
      quote: 'aiQuote.txt',
      cta: 'aiCallToAction.txt',
      custom: 'aiCustomSnippet.js'
    };
    el.tabName.textContent = customFilename || names[category] || 'aiGenerated.js';
    restartTyping();
  }

  // ─── Live OS Hardware Bridge Status Checker ───
  function initWebBridgeChecker() {
    async function check() {
      try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 1200);
        const res = await fetch('http://127.0.0.1:9876/ping', { signal: ctrl.signal });
        clearTimeout(tid);
        const data = await res.json();
        if (data && data.ok) {
          if (el.webOsBridgeCard) el.webOsBridgeCard.className = 'os-bridge-card online';
          if (el.webBridgeDot) el.webBridgeDot.className = 'bridge-status-dot online';
          if (el.webBridgeTitle) el.webBridgeTitle.textContent = 'OS Hardware Bridge: ACTIVE';
          if (el.webBridgeDesc) el.webBridgeDesc.textContent = 'Native Helper connected on port 9876. Keystrokes & mouse cursor are synced with OS hardware.';
          return;
        }
      } catch (_) { }

      if (el.webOsBridgeCard) el.webOsBridgeCard.className = 'os-bridge-card offline';
      if (el.webBridgeDot) el.webBridgeDot.className = 'bridge-status-dot offline';
      if (el.webBridgeTitle) el.webBridgeTitle.textContent = 'OS Hardware Bridge: OFFLINE';
      if (el.webBridgeDesc) el.webBridgeDesc.textContent = 'Press Win + R and type "start" to launch the silent native hardware helper.';
    }

    check();
    setInterval(check, 5000);
  }

  el.btnGenerateAi?.addEventListener('click', generateAiContent);

  // Init
  initApiKeyManager();
  initWebBridgeChecker();
  el.rawTextInput.value = state.currentText;
  renderView();
  updateStatus('idle');
})();
