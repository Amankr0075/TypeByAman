# TypeByAman

<div align="center">

![TypeByAman Logo](chrome-extension/assets/icon128.png)

# TYPEBYAMAN

**Type. Replay. Create.**

*A premium local typing/replay utility developed by **Aman Kumar** — Free Beta Evaluation • Future Subscription Planned.*

[![License: Proprietary](https://img.shields.io/badge/License-Proprietary-red.svg)](LICENSE)
[![GitHub Pages](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-brightgreen.svg)](https://amankr0075.github.io/TypeByAman/)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Manifest%20V3-green.svg)](chrome-extension/)
[![VS Code Extension](https://img.shields.io/badge/VS%20Code-Extension-blue.svg)](vscode-extension/)
[![Subscription Model](https://img.shields.io/badge/Model-Free%20Beta%20•%20Future%20Subscription-orange.svg)](#-commercial-roadmap--future-subscription-model)
[![Author](https://img.shields.io/badge/Author-Aman%20Kumar-purple.svg)](https://github.com/Amankr0075)

</div>

---

## 📖 Overview

**TypeByAman** is a local typing/replay utility designed and developed by **Aman Kumar** that allows you to provide text or source code and reproduce it gradually inside a supported text field, code editor, or online interactive studio. It's perfect for:

- 🎥 **Coding demonstrations** — make your typing look natural on screen recordings
- 📚 **Programming tutorials** — replay code character by character for clarity
- ♿ **Accessibility** — allow automated text input for users who need it
- 🎓 **Educational presentations** — engage audiences with live-like typing
- 🧪 **Testing text-input workflows** — replay known inputs into text fields
- ✍️ **Replaying your own text** — reproduce content you've written before

> **Developer & Commercial Subscription Notice**: Developed by **Aman Kumar**. 100% of the code runs client-side on your device with zero cloud tracking. Currently available for open public beta evaluation. **This extension developed by the developer may charge you in the future under both monthly and yearly subscriptions.** Official pricing will be displayed once the project becomes commercially successful.

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
| 🤖 Human Mistake Engine | Types 50–70 wrong chars, backspaces one-by-one, and retypes correctly with randomized high-entropy timing |
| 🎨 1-Hour Design Mode | Autonomous step-by-step human designing on Canva, Adobe Express, Photoshop Web, Figma, etc. |
| 🖱️ Real OS Cursor Control | Curved Bezier paths, micro-jitter, and thinking pauses for undetected human simulation |
| ▶️ Run & Continue Mode | Periodically pauses, opens terminal/clicks run button, tests code, watches output, and resumes typing |
| 🛡️ Anti-Detection Bypass | 100% hardware-level events, zero telemetry, indistinguishable from real physical keyboard & mouse |
| 💳 Subscription Model | Free Public Beta • The developer may charge in the future under monthly and yearly subscriptions (pricing displayed upon commercial success) |

---

## 🛡️ Screen Recording & Activity Monitoring Stealth Engine

When software is recording the entire screen and tracking mouse/keyboard activity (e.g. proctoring platforms, video screen recorders, corporate monitors, interview proctors), standard auto-typers are easily detected due to static cursor positions, flat millisecond delays, and absence of human errors. 

**TypeByAman** incorporates an undetectable behavioral architecture designed to look 100% human to both human reviewers and AI video/telemetry monitors:

### 1. Realistic Human Mistake Engine (50–70 Characters)
- **Stream-of-Thought Errors**: Periodically types out 50 to 70 characters of plausible mistaken code (e.g. initiating the wrong function or filter logic).
- **Cognitive Realization Pause**: 350ms–550ms natural hesitation (*"Wait, let me fix this..."*).
- **One-by-One Backspacing**: Automatically erases the wrong characters **one by one character** at human cadence (35ms–65ms per stroke with keystroke jitter).
- **Recovery Hesitation**: 250ms–400ms pause before cleanly re-typing the correct solution.
- **Pattern-Proof Randomized Timing**: Mistakes occur at non-periodic intervals between **35s and 95s** with high-entropy jitter so no detection algorithm can find any periodic signature.

### 2. Log-Normal Keystroke Cadence & Digraph Latency
- **Human Latency Model**: Characters are never typed with flat delays. Latency follows a log-normal distribution with micro-variations.
- **Shift Key Latency**: Capital letters (`A-Z`) incur realistic +40ms–80ms Shift hold delays.
- **Symbol & Punctuation Reach**: Complex punctuation and brackets (`{}`, `()`, `[]`, `=>`, `;`, `&&`, `||`) feature finger reach penalties (+50ms–110ms).
- **Word Planning Micro-Pauses**: Slight pauses at spacebars mimic cognitive sentence structure.

### 3. Visual Code Review & Upward Inspection Scrolls
- **Glancing at Earlier Lines**: Every 35–65 lines of code, the editor smoothly scrolls up 6–15 lines.
- **Cursor Reading Trajectory**: The mouse cursor glides up and hovers over previously written functions or imports for 1.5s–3.2s.
- **Return to Coding**: The editor smoothly returns to the editing position and resumes typing. On screen recording, this visual inspection proves active human reading.

### 4. Real OS Hardware Cursor Driver (`native-helper`)
- Controls the **physical OS-level mouse pointer** using curved quadratic Bezier paths, micro-jitter ($\pm 1.2\text{px}$ hand tremors), and organic ease-in-out velocity curves.
- The mouse never freezes or moves in robotic straight lines.

### 5. "Run & Continue" Testing mid-Coding
- **Simulates a Real Developer**: Every 75–175 lines, the tool saves the file (`Ctrl + S`), glides cursor to the terminal or web Run button, types the run command character-by-character, executes it, stares at/scrolls through output for 8s–25s, and clicks back into the editor to continue coding.

### 6. Zero-Footprint Stealth Mode
- In VS Code, the status bar text and indicators are completely hidden (`typebyaman.stealthMode`), ensuring no extension names or counters appear on video recordings.
- In Chrome, no DOM overlays, watermarks, or badges are injected into the page.

### 7. Autonomous Human Design Mode (Canva, Adobe, Figma, Photoshop Web)
- **100% Single-Pointer Lock (No Duplicate Cursors)**: Automatically hides the browser's native cursor across the document (`cursor: none !important;`) and renders a single, authentic OS-style vector mouse pointer. If the user moves their physical mouse, the virtual pointer moves in lockstep. Screen recording and monitoring software see **exactly one mouse pointer** at all times.
- **Realistic Mouse Clicks & Visual Feedback**: Every click depresses the virtual cursor and triggers a smooth expanding ripple halo (azure on single clicks, dual purple on double clicks, and a persistent glowing halo during element drags).
- **Rich Human Design Operations**:
  - 🎨 **Changing Colors**: Selects elements, opens color pickers and swatches, hovers over harmonious palette choices, applies new fills, and adjusts hue/opacity.
  - ✍️ **Editing Texts**: Double-clicks text boxes, selects existing text (`Ctrl+A`), types modern design headlines and slogans with natural keystroke timing, realistic typos, backspace self-correction, and styling (`Ctrl+B`/`Ctrl+I`).
  - 🖼️ **Changing Backgrounds**: Selects the artboard boundary, opens background palettes, browses presets/gradients, and evaluates canvas contrast.
  - 📐 **Adding Shapes & Graphics**: Navigates to sidebar elements, drags shapes onto the canvas with visible drag halos, and nudges them into position.
  - 🔄 **Rotating Elements**: Grabs rotation handles and performs circular arc drags (15°–35°) with micro-pauses to inspect balance.
  - ⏪ **Undo/Redo Exploration**: Makes test adjustments, pauses to think, undoes with `Ctrl+Z`, and optionally redoes or tests alternative placements.
  - 🔍 **Zoom & Detail Inspection**: Zooms in (`Ctrl++`), pans across canvas details with spacebar drags, and resets zoom (`Ctrl+0`).
  - ⏱️ **1-Hour Continuous Autonomous Workflow**: Runs unattended step-by-step for up to 1 hour with variable cognitive pauses (micro, short, medium, long, idle).

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
│   ├── popup/                 # Interactive popup dashboard with Design Mode tab
│   ├── content/               # Content script with typo engine & web code runner
│   │   └── design-engine.js   # 1-hour autonomous design engine for Canva/Adobe/Photoshop
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
│       ├── typingEngine.ts    # Core async typing engine with 50-70 char mistake simulation
│       ├── nativeCursorBridge.ts # Real OS cursor controller bridge via JSON-RPC
│       ├── panel.ts           # WebView control panel
│       ├── statusBar.ts       # Status bar progress indicator
│       └── speedConfig.ts     # Speed preset helpers
│
├── native-helper/             # OS-level hardware input controller
│   ├── cursor-helper.js       # Real mouse/keyboard driver using Bezier curves & micro-jitter
│   └── package.json           # Dependencies (@nut-tree-fork/nut-js)
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

**Proprietary & Commercial Software License**

Copyright (c) 2025-2026 Aman Kumar (https://github.com/Amankr0075). All Rights Reserved.

- **Not Open Source:** This software is strictly proprietary and is NOT open source.
- **Not Free for Unauthorized Use:** Use is restricted to authorized evaluations and explicit permissions granted by Aman Kumar.
- **Not Editable by Others:** Modifying, decompiling, altering, distributing, or producing derivative works based on this software or its extensions is strictly prohibited.

For commercial licensing and inquiries: https://github.com/Amankr0075

---

## ⭐ Support & Acknowledgements

If you find **TypeByAman** helpful or valuable for your workflow, demos, or tutorials, please consider giving this repository a **star (★)** on GitHub. Your support is greatly appreciated and helps motivate ongoing improvements and maintenance.

[![Star on GitHub](https://img.shields.io/badge/Star%20on%20GitHub-★%20TypeByAman-yellow?style=for-the-badge&logo=github)](https://github.com/Amankr0075/TypeByAman)

---

## 💳 Commercial Roadmap & Future Subscription Model

TypeByAman is authored and maintained by **Aman Kumar**. 

> ⚠️ **Commercial Subscription Notice:**  
> This extension which is developed by the developer may charge you in the future in **monthly or yearly both as a subscription**.  
> The software is currently provided free of charge for open beta evaluation and testing. **The exact subscription price will be displayed once the project becomes successful.**

### Planned Subscription Tiers:
- **Free Public Beta**: Complete access to the web studio, Chrome extension, VS Code extension, and OS Hardware Bridge while in evaluation phase.
- **Monthly Subscription (Upcoming)**: Flexible month-to-month access for developers, students, and content creators. Price will be announced upon commercial release.
- **Yearly Subscription (Upcoming)**: Discounted annual billing plan with priority updates and dedicated developer support. Price will be announced upon commercial release.

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
