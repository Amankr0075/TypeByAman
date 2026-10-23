# TypeByAman

<div align="center">

![TypeByAman Logo](chrome-extension/assets/icon128.png)

# TYPEBYAMAN

**Type. Replay. Create.**

*A premium local typing/replay utility — 100% free, unlimited use, no account required.*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![GitHub Pages](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-brightgreen.svg)](https://amankr0075.github.io/TypeByAman/)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Manifest%20V3-green.svg)](chrome-extension/)
[![VS Code Extension](https://img.shields.io/badge/VS%20Code-Extension-blue.svg)](vscode-extension/)
[![GitHub Stars](https://img.shields.io/github/stars/Amankr0075/TypeByAman?style=social)](https://github.com/Amankr0075/TypeByAman)
[![Author](https://img.shields.io/badge/Author-Aman%20Kumar-purple.svg)](https://github.com/Amankr0075)

</div>

---

## 📖 Overview

**TypeByAman** is a local typing/replay utility that allows you to provide text or source code and reproduce it gradually inside a supported text field, code editor, or online interactive studio. It's perfect for:

- 🎥 **Coding demonstrations** — make your typing look natural on screen recordings
- 📚 **Programming tutorials** — replay code character by character for clarity
- ♿ **Accessibility** — allow automated text input for users who need it
- 🎓 **Educational presentations** — engage audiences with live-like typing
- 🧪 **Testing text-input workflows** — replay known inputs into text fields
- ✍️ **Replaying your own text** — reproduce content you've written before

> **Zero-Server Guarantee**: 100% of the code runs client-side in your browser or local editor. No backend server, no database, no sign-up, no subscriptions, and zero data leaves your machine. Hosted entirely on GitHub.

---

## ✨ Features

| Feature | Details |
|---------|---------|
| 🌐 Live Web Studio | Interactive sandbox with simulated IDE & Web Audio mechanical click synthesis |
| ⚡ Adjustable speed | Very Slow → Very Fast + Custom (1–9999 ms/char) |
| 📄 Unlimited text | No artificial character limit |
| 🔤 Full fidelity | Preserves indentation, tabs, Unicode, blank lines, special chars |
| ⏯️ Full controls | Start, Pause, Resume, Stop, Restart, Single Step |
| 📊 Progress tracking | Characters typed, percentage, WPM, CPM, elapsed time, status |
| 🎨 Premium UI | Dark cyber theme, glassmorphism, glowing accents, smooth animations |
| 🔒 100% local | No data leaves your device |
| ⌨️ Universal shortcuts | Alt+Shift+S (Start), Alt+Shift+P (Pause), Alt+Shift+X (Stop) |
| 🆓 100% free | No subscription, no account, no paywall — MIT Licensed |

---

## 🗂️ Project Structure

```
TypeByAman/
├── index.html                 # Live Interactive Web Studio (GitHub Pages)
├── style.css                  # Studio styling, glassmorphism, responsive theme
├── app.js                     # Web typing engine & Web Audio sound synthesizer
├── assets/                    # High-resolution logos and icons (16/48/128px)
│
├── chrome-extension/          # Chrome Manifest V3 extension
│   ├── manifest.json
│   ├── popup/                 # Interactive popup dashboard
│   ├── content/               # Content script with floating HUD
│   ├── background/            # Service worker
│   ├── options/               # Settings & options page
│   └── assets/                # Extension icons
│
├── vscode-extension/          # VS Code extension
│   ├── package.json
│   ├── tsconfig.json
│   ├── typebyaman-1.0.0.vsix  # Pre-compiled ready-to-install extension package
│   ├── out/                   # Compiled JavaScript
│   └── src/
│       ├── extension.ts       # Main entry point & command bindings
│       ├── typingEngine.ts    # Core async typing engine
│       ├── panel.ts           # WebView control panel
│       ├── statusBar.ts       # Status bar progress indicator
│       └── speedConfig.ts     # Speed preset helpers
│
├── .github/
│   └── workflows/
│       ├── deploy-pages.yml   # Auto-deploy Web Studio to GitHub Pages
│       └── build-release.yml  # Auto-build & package VSIX and ZIP artifacts
│
├── LICENSE                    # MIT License
├── CONTRIBUTING.md            # Guidelines for open-source contributors
└── README.md                  # Complete documentation
```

---

## 🌐 Chrome Extension Installation

### Method 1: Developer Mode (Recommended for Local Use)

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **"Load unpacked"**
4. Select the `chrome-extension/` folder from this repository
5. TypeByAman will appear in your extensions list
6. Click the puzzle icon (🧩) in Chrome's toolbar and pin TypeByAman

### Method 2: From Chrome Web Store

> Coming soon — the extension will be published to the Chrome Web Store.

### First Use

1. Navigate to any webpage with a text field (Gmail, GitHub, CodePen, etc.)
2. Click the TypeByAman icon in your toolbar
3. Paste or type your text in the input area
4. Click **"Pick Target Field"** and click the input on the page where you want to type
5. Select your speed and click **Start**

---

## 💻 VS Code Extension Installation

### Method 1: From VSIX file

```bash
# Build the VSIX package
cd vscode-extension
npm install
npm run compile
npx @vscode/vsce package

# Install in VS Code
code --install-extension typebyaman-1.0.0.vsix
```

### Method 2: From Source (Development)

```bash
cd vscode-extension
npm install
npm run compile

# Then press F5 in VS Code to launch Extension Development Host
```

### Method 3: VS Code Marketplace

> Coming soon — the extension will be published to the VS Code Marketplace.

### First Use in VS Code

1. Open a file in VS Code
2. Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
3. Type `TypeByAman: Open Control Panel`
4. Paste your text in the panel
5. Configure speed and click **Start**

---

## ⚡ Speed Settings

| Preset | Delay | Best for |
|--------|-------|----------|
| Very Slow | 1000 ms/char | Accessibility, very deliberate demos |
| Slow | 250 ms/char | Tutorial-style demos |
| Normal | 50 ms/char | Standard demos & recordings |
| Fast | 20 ms/char | Quick replays |
| Very Fast | 5 ms/char | Rapid automated input |
| Custom | 1–9999 ms | Fine-grained control |

**Quick delays**: 10ms, 20ms, 30ms, 40ms, 50ms, 100ms, 250ms, 500ms, 1000ms, 2000ms

**Live speed adjustment**: Change speed while typing is in progress — takes effect immediately.

**Line-break delay**: Add extra delay after each newline (useful for code with long lines).

**Start delay**: Wait N milliseconds before typing begins (gives time to focus the target field).

---

## ⌨️ Keyboard Shortcuts

### Chrome Extension

| Shortcut | Action |
|----------|--------|
| `Alt+Shift+S` | Start typing |
| `Alt+Shift+P` | Pause / Resume |
| `Alt+Shift+X` | Stop |

> Customize in Chrome: `chrome://extensions/shortcuts`

### VS Code Extension

| Shortcut | Action |
|----------|--------|
| `Alt+Shift+S` | Start Typing |
| `Alt+Shift+P` | Pause |
| `Alt+Shift+X` | Stop |
| `Alt+Shift+T` | Open Control Panel |

> Customize in VS Code: File → Preferences → Keyboard Shortcuts → search "typebyaman"

### VS Code Command Palette

| Command | Description |
|---------|-------------|
| `TypeByAman: Start Typing` | Start the typing replay |
| `TypeByAman: Pause` | Pause typing |
| `TypeByAman: Resume` | Resume paused typing |
| `TypeByAman: Stop` | Stop typing entirely |
| `TypeByAman: Restart` | Restart from the beginning |
| `TypeByAman: Configure Speed` | Open speed picker |
| `TypeByAman: Open Control Panel` | Open the WebView control panel |

---

## ⚙️ Configuration (VS Code)

Access via: File → Preferences → Settings → search `TypeByAman`

| Setting | Default | Description |
|---------|---------|-------------|
| `typebyaman.characterDelay` | `50` | Ms between each character (1–9999) |
| `typebyaman.lineBreakDelay` | `0` | Extra ms after each newline |
| `typebyaman.startDelay` | `0` | Ms to wait before typing begins |
| `typebyaman.speedPreset` | `Normal` | Speed preset selection |
| `typebyaman.preserveIndentation` | `true` | Preserve tabs/spaces |
| `typebyaman.preserveLineBreaks` | `true` | Preserve blank lines |

---

## 🌐 Supported Editors (Chrome Extension)

TypeByAman works with:

- ✅ Standard HTML `<textarea>` elements
- ✅ Standard HTML `<input type="text">` elements
- ✅ ContentEditable elements
- ✅ **Monaco Editor** (VS Code Web, CodeSandbox, GitHub Codespaces)
- ✅ **CodeMirror** editors (JSFiddle, JS Bin, etc.)
- ✅ **Ace Editor** (Cloud9, etc.)
- ✅ Gmail compose window
- ✅ GitHub issue/PR editors
- ✅ Most web-based IDEs

---

## 🔒 Privacy

TypeByAman is designed with privacy as a first-class concern:

- **All processing is local** — your text never leaves your device
- **No external servers** — no API calls, no cloud processing
- **No analytics** — no telemetry, no usage tracking
- **No data collection** — no code, passwords, or personal data collected
- **No accounts** — no sign-up, no login, no cookies
- **Settings stored locally** — in `chrome.storage.local` or VS Code workspace settings

---

## 🐛 Troubleshooting

### Chrome Extension

**Extension doesn't type in the target field**
- Make sure you've clicked "Pick Target Field" and selected an input
- Try refreshing the page and picking again
- Some pages with strict CSP may block content scripts

**Speed changes don't apply immediately**
- Click "Pause" then "Resume" if the speed doesn't update mid-typing
- Or use "Stop" and restart — new speed will take effect

**Extension not loading**
- Ensure Developer Mode is enabled in `chrome://extensions/`
- Click "Update" on the extensions page
- Check that all files are present in the `chrome-extension/` folder

### VS Code Extension

**"No active editor" error**
- Open a file in VS Code before running TypeByAman: Start Typing
- The extension needs an active text editor to type into

**TypeScript compilation errors**
```bash
cd vscode-extension
npm install
npm run compile
```

**Extension not activating**
- Check the VS Code Output panel for errors (View → Output → TypeByAman)
- Ensure Node.js version ≥ 16 and VS Code ≥ 1.80

---

## 🛠️ Development

### Chrome Extension

No build step required — it's pure HTML/CSS/JavaScript.

```bash
# Load in Chrome
1. Open chrome://extensions/
2. Enable Developer Mode
3. Load Unpacked → select chrome-extension/

# Generate PNG icons (optional — SVGs also provided)
cd chrome-extension
npm install canvas
node generate-icons.js
```

### VS Code Extension

```bash
cd vscode-extension

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch mode (auto-recompile)
npm run watch

# Press F5 in VS Code to launch Extension Development Host

# Package as .vsix
npm run package
```

### Build Requirements

- **Node.js** ≥ 16.x
- **npm** ≥ 8.x
- **TypeScript** ≥ 5.x (installed via npm)
- **VS Code** ≥ 1.80.0 (for extension development)

---

## 📄 License

**MIT License**

Copyright (c) 2024 Aman Kumar

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.

---

## ⭐ Support & Acknowledgements

If you find **TypeByAman** helpful or valuable for your workflow, demos, or tutorials, please consider giving this repository a **star (★)** on GitHub. Your support is greatly appreciated and helps motivate ongoing improvements and maintenance.

[![Star on GitHub](https://img.shields.io/badge/Star%20on%20GitHub-★%20TypeByAman-yellow?style=for-the-badge&logo=github)](https://github.com/Amankr0075/TypeByAman)

---

## 👤 Author

**Aman Kumar**

- GitHub: [@Amankr0075](https://github.com/Amankr0075)

---

## ⚠️ Important Notice

TypeByAman is a **legitimate typing/replay utility** for personal use, demonstrations, and accessibility.

It does **NOT** implement:
- Anti-detection mechanisms
- Fingerprint manipulation
- Security monitor bypasses
- CAPTCHA bypass
- Bot-detection evasion
- Mechanisms intended to defeat anti-abuse systems

This software accurately represents itself as a local typing/replay utility. Use responsibly and in accordance with the terms of service of any website or application you use it with.

---

<div align="center">

Made with ❤️ by **Aman Kumar** | [GitHub](https://github.com/Amankr0075)

*TypeByAman — Type. Replay. Create.*

</div>
