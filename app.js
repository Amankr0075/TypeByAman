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
    btnJumpStudio: document.getElementById('btn-jump-studio')
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
  function typeNextCharacter() {
    if (state.status !== 'typing') return;

    if (state.charIndex >= state.currentText.length) {
      updateStatus('done');
      clearInterval(state.timerInterval);
      return;
    }

    const nextChar = state.currentText[state.charIndex];
    state.charIndex++;

    renderView();
    sound.playClick(nextChar);

    let delay = state.charDelay;
    if (nextChar === '\n' && state.lineBreakDelay > 0) {
      delay += state.lineBreakDelay;
    }

    // Dynamic micro jitter (1-5ms) to give natural human feel if delay > 25
    if (delay > 25) {
      const jitter = (Math.random() * 8) - 4;
      delay = Math.max(1, Math.round(delay + jitter));
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

  // Init
  el.rawTextInput.value = state.currentText;
  renderView();
  updateStatus('idle');
})();
