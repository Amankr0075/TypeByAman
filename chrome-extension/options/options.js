/**
 * TypeByAman — Options Page Script
 * Author: Aman Kumar | github.com/Amankr0075
 */

'use strict';

const KEYS = {
  THEME:           'tba_theme',
  DELAY:           'tba_delay',
  LINEBREAK_DELAY: 'tba_linebreak_delay',
  START_DELAY:     'tba_start_delay',
  AUTO_SCROLL:     'tba_auto_scroll',
  REMEMBER_TEXT:   'tba_remember_text',
};

const DEFAULTS = {
  [KEYS.THEME]:           'dark',
  [KEYS.DELAY]:           50,
  [KEYS.LINEBREAK_DELAY]: 0,
  [KEYS.START_DELAY]:     0,
  [KEYS.AUTO_SCROLL]:     true,
  [KEYS.REMEMBER_TEXT]:   true,
};

let settings = { ...DEFAULTS };

// ─── DOM ─────────────────────────────────────────────────────────────────────

const $ = id => document.getElementById(id);

// ─── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  bindNav();
  bindSpeedSection();
  bindBehaviorSection();
  bindAppearanceSection();
  bindSave();
});

// ─── Load / Save ─────────────────────────────────────────────────────────────

async function loadSettings() {
  return new Promise(resolve => {
    chrome.storage.local.get(Object.values(KEYS), result => {
      settings = { ...DEFAULTS, ...result };
      applySettingsToUI();
      resolve();
    });
  });
}

function applySettingsToUI() {
  // Theme
  applyTheme(settings[KEYS.THEME]);

  // Delay
  const delay = settings[KEYS.DELAY];
  setDelay(delay, false);

  // Linebreak / start delay
  $('opt-linebreak-delay').value = settings[KEYS.LINEBREAK_DELAY];
  $('opt-start-delay').value     = settings[KEYS.START_DELAY];

  // Toggles
  $('opt-auto-scroll').checked   = settings[KEYS.AUTO_SCROLL];
  $('opt-remember-text').checked = settings[KEYS.REMEMBER_TEXT];
}

function gatherSettings() {
  return {
    [KEYS.THEME]:           settings[KEYS.THEME],
    [KEYS.DELAY]:           parseInt($('opt-delay-input').value) || 50,
    [KEYS.LINEBREAK_DELAY]: parseInt($('opt-linebreak-delay').value) || 0,
    [KEYS.START_DELAY]:     parseInt($('opt-start-delay').value) || 0,
    [KEYS.AUTO_SCROLL]:     $('opt-auto-scroll').checked,
    [KEYS.REMEMBER_TEXT]:   $('opt-remember-text').checked,
  };
}

function saveSettings() {
  const s = gatherSettings();
  chrome.storage.local.set(s, () => {
    settings = s;
    showToast();
  });
}

function resetSettings() {
  chrome.storage.local.set(DEFAULTS, () => {
    settings = { ...DEFAULTS };
    applySettingsToUI();
    showToast('Settings reset');
  });
}

function showToast(msg = '✓ Settings saved') {
  const toast = $('save-toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

// ─── Theme ────────────────────────────────────────────────────────────────────

function applyTheme(theme) {
  settings[KEYS.THEME] = theme;
  document.body.setAttribute('data-theme', theme);
  document.querySelectorAll('.theme-option').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === theme);
  });
}

// ─── Speed ────────────────────────────────────────────────────────────────────

function setDelay(delay, updatePresets = true) {
  delay = Math.max(1, Math.min(9999, parseInt(delay) || 50));
  $('opt-delay-slider').value    = Math.min(delay, 2000);
  $('opt-delay-input').value     = delay;
  $('opt-delay-display').textContent = `${delay} ms`;

  // Chips
  document.querySelectorAll('.opt-chip').forEach(c => {
    c.classList.toggle('active', parseInt(c.dataset.delay) === delay);
  });

  // Presets
  if (updatePresets) {
    document.querySelectorAll('.preset-option').forEach(p => {
      p.classList.toggle('active', parseInt(p.dataset.delay) === delay);
    });
  }
}

// ─── Event Bindings ──────────────────────────────────────────────────────────

function bindNav() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      const section = item.dataset.section;

      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      document.querySelectorAll('.settings-section').forEach(s => s.classList.remove('active'));

      item.classList.add('active');
      const sec = document.getElementById(section);
      if (sec) sec.classList.add('active');
    });
  });
}

function bindSpeedSection() {
  // Slider
  $('opt-delay-slider').addEventListener('input', () => {
    setDelay(parseInt($('opt-delay-slider').value));
  });

  // Number input
  $('opt-delay-input').addEventListener('change', () => {
    setDelay(parseInt($('opt-delay-input').value));
  });

  // Chips
  document.querySelectorAll('.opt-chip').forEach(c => {
    c.addEventListener('click', () => setDelay(parseInt(c.dataset.delay)));
  });

  // Presets
  document.querySelectorAll('.preset-option').forEach(p => {
    p.addEventListener('click', () => {
      document.querySelectorAll('.preset-option').forEach(x => x.classList.remove('active'));
      p.classList.add('active');
      setDelay(parseInt(p.dataset.delay), false);
    });
  });
}

function bindBehaviorSection() {
  // Toggles are handled by gather
}

function bindAppearanceSection() {
  document.querySelectorAll('.theme-option').forEach(btn => {
    btn.addEventListener('click', () => applyTheme(btn.dataset.theme));
  });
}

function bindSave() {
  $('btn-save-all').addEventListener('click', saveSettings);
  $('btn-reset').addEventListener('click', resetSettings);
}
