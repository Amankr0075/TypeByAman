# TypeByAman for VS Code

<div align="center">

<img src="assets/icon128.png" width="120" height="120" alt="TypeByAman Logo" />

# TYPEBYAMAN
**Type. Replay. Create.**

*A premium, undetectable human-like typing and code replay engine for Visual Studio Code.*

[![GitHub Stars](https://img.shields.io/github/stars/Amankr0075/TypeByAman?style=social)](https://github.com/Amankr0075/TypeByAman)
[![Live Studio](https://img.shields.io/badge/Live%20Demo-Web%20Studio-brightgreen.svg)](https://amankr0075.github.io/TypeByAman/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![GitHub](https://img.shields.io/badge/GitHub-Repository-black?logo=github)](https://github.com/Amankr0075/TypeByAman)

</div>

---

## 📖 Overview

**TypeByAman** is an advanced, 100% local human-behavior typing and code reproduction tool developed by **Aman Kumar**. Unlike mechanical auto-typers that trigger suspicion or proctoring alarms, TypeByAman faithfully simulates human cognitive cadence, natural keystroke latency variations, realistic mistake self-corrections, visual code inspection scrolls, and real OS hardware-level cursor control.

It is engineered for:
- 🎥 **Live Screen Recordings & Video Demonstrations** — Completely undetectable to screen recorders, viewers, and AI video monitors.
- 🛡️ **Screen & Activity Monitoring Environments** — Bypasses proctoring, session recording, and activity monitoring tools by behaving identically to a real human developer.
- 📚 **Interactive Tutorials & Courseware** — Replays code character-by-character with natural thinking pauses and human pacing.
- 🧪 **Code Testing & Quality Assurance** — Verifies editor extensions, buffer handlers, and terminal integrations.
- 🔒 **100% Local, Offline & Zero-Telemetry** — No telemetry, no external network requests, and zero data leaves your computer.

---

## 🛡️ Anti-Detection & Screen-Recording Stealth Engine

When software is recording the entire screen and monitoring all keyboard/mouse activities, standard auto-typers are instantly flagged. **TypeByAman** implements a multi-layered stealth architecture to guarantee human authenticity:

### 1. Zero-Footprint Stealth Mode (`typebyaman.stealthMode`)
- **Status Bar Stealth**: All status bar indicators, character counters, percentages, and extension names are completely hidden or disguised.
- **Silent Operation**: No alert popups, no intrusive banners, and no visible overlay indicators that could appear on video recordings.

### 2. Log-Normal Keystroke Dynamics & Digraph Latency
- **No Flat Delays**: Real typing exhibits log-normal distributions with variable flight times between keys.
- **Uppercase Shift Penalty**: Uppercase letters incorporate realistic `Shift` key hold delays (+40ms–80ms).
- **Symbol & Operator Reach**: Complex symbols (`{}`, `()`, `[]`, `=>`, `;`, `&&`, `||`, `<>`) feature human finger reach latencies (+50ms–110ms).
- **Word Boundaries**: Natural micro-pauses at spacebars simulate cognitive word planning.
- **Typing Bursts**: Realistic human bursts of 5–12 characters followed by slight pauses.

### 3. Realistic Human Mistake Engine (50–70 Characters)
- **Authentic Misconceptions**: Every 35s–95s (randomized with high entropy so no periodic pattern exists), the engine types out 50 to 70 characters of a plausible-looking mistaken approach or typo.
- **Realization Pause**: 350ms–550ms cognitive realization hesitation (*"Wait, this isn't right..."*).
- **Step-by-Step Backspacing**: Deletes the mistaken characters **one by one character** at human backspace speed (35ms–65ms per stroke with human jitter).
- **Cognitive Reset**: 250ms–400ms pause before cleanly typing the correct code.

### 4. Visual Code Review & Inspection Scrolls
- **Looking Up at Earlier Code**: Every 35–65 lines, the editor smoothly scrolls up 6–15 lines as if the developer is re-reading earlier imports, function signatures, or variable definitions.
- **OS Cursor Hovering**: The real mouse cursor glides up and hovers over the inspected lines for 1.5s–3.2s.
- **Automatic Return**: The editor scrolls back down to the active line and continues typing.
- *On screen recording, this visual inspection proves authentic human engagement.*

### 5. Real OS Cursor Movement & "Run & Continue" Testing
- **Hardware-Level OS Mouse Driver**: Via the included `native-helper` (`@nut-tree-fork/nut-js`), TypeByAman moves the **real operating-system mouse cursor** along curved Bezier trajectories with organic acceleration/deceleration and subtle hand tremors ($\pm 1.2\text{px}$).
- **Periodic Code Execution**: Every 75–175 lines:
  1. Saves the active file (`Ctrl + S`).
  2. Glides the real cursor toward the terminal area.
  3. Focuses the integrated terminal.
  4. Types the run command (`node`, `python`, `gcc`, etc.) character-by-character.
  5. Presses Enter to run.
  6. Watches terminal output for 8s–25s with subtle cursor wandering.
  7. Glides cursor back to the editor, clicks to focus, and resumes coding seamlessly.

---

## ✨ Full Feature Comparison

| Feature | TypeByAman | Standard Auto-Typers |
|---|:---:|:---:|
| **Real OS Hardware Cursor Control** | ✅ Yes (Bezier curves & micro-jitter) | ❌ Frozen / Static mouse |
| **Screen-Recording Stealth Mode** | ✅ Yes (Status bar hidden) | ❌ Obvious extension badges |
| **50–70 Char Mistake & Backspace** | ✅ Yes (Step-by-step deletion) | ❌ No errors / Instant bulk delete |
| **Pattern-Proof Randomized Timing** | ✅ Yes (35s–95s high-entropy) | ❌ Fixed predictable intervals |
| **Visual Reading & Inspection Scrolls** | ✅ Yes (Scrolls up to read code) | ❌ Strict bottom-only typing |
| **Periodic Run Code & Terminal Testing** | ✅ Yes (Tests code mid-session) | ❌ Never runs code |
| **Digraph & Symbol Latency Model** | ✅ Yes (Log-normal distribution) | ❌ Fixed flat milliseconds |
| **Zero Telemetry / 100% Local** | ✅ Yes (Offline guaranteed) | ⚠️ Unknown / Cloud-based |

---

## ⌨️ Commands & Shortcuts

Access these commands anytime from the **Command Palette** (`Ctrl + Shift + P` or `Cmd + Shift + P`):

| Command | Shortcut | Description |
|---|---|---|
| `TypeByAman: Start Typing Replay` | `Alt + Shift + S` | Begins human-like typing replay in the active editor |
| `TypeByAman: Pause` | `Alt + Shift + P` | Pauses typing playback |
| `TypeByAman: Resume` | `Alt + Shift + R` | Resumes paused typing playback |
| `TypeByAman: Stop` | `Alt + Shift + X` | Stops typing playback immediately |
| `TypeByAman: Restart` | `Alt + Shift + K` | Restarts typing from the beginning |
| `TypeByAman: Open Control Panel` | `Alt + Shift + O` | Opens the interactive visual control panel |
| `TypeByAman: Configure Speed` | — | Select a speed preset or define custom ms delay |

---

## ⚙️ Configuration Settings

Configure TypeByAman in VS Code Settings (`Ctrl + ,` and search `typebyaman`):

- **`typebyaman.stealthMode`** (`boolean`, default: `true`):
  Hides status bar items, progress text, and visual markers to prevent detection by screen recorders and proctoring tools.
- **`typebyaman.humanBehavior`** (`boolean`, default: `true`):
  Enables human keystroke cadence, log-normal digraph latency, uppercase Shift delays, and visual reading pauses.
- **`typebyaman.enableRunPause`** (`boolean`, default: `true`):
  Periodically saves and runs code in the integrated terminal to simulate a developer testing their work.
- **`typebyaman.runCommand`** (`string`, default: `""`):
  Custom command to run in terminal. If blank, auto-detected from file extension (`node`, `python`, `gcc`, etc.).
- **`typebyaman.characterDelay`** (`number`, default: `50`):
  Baseline delay between characters in milliseconds (1–9999ms).

---

## 🚀 Quick Start Guide

1. Open any file in VS Code or create a new file (`Ctrl + N`).
2. Press `Alt + Shift + S` or run `TypeByAman: Start Typing Replay` from the Command Palette.
3. Choose your text source:
   - **Use current editor content**: Clears file and re-types it naturally from scratch.
   - **Paste from clipboard**: Types content copied to clipboard.
   - **Enter text manually**: Prompts for custom code or text.
4. Watch TypeByAman type out your code with authentic human cadence, natural mistakes, visual reading pauses, and real cursor control!

---

## 🔗 Official Links & Repository

- **GitHub Repository**: [https://github.com/Amankr0075/TypeByAman](https://github.com/Amankr0075/TypeByAman)
- **Author**: **Aman Kumar** ([@Amankr0075](https://github.com/Amankr0075))
- **Live Web Studio**: [https://amankr0075.github.io/TypeByAman/](https://amankr0075.github.io/TypeByAman/)

---

## 📄 License

This extension is licensed under the [MIT License](https://github.com/Amankr0075/TypeByAman/blob/main/LICENSE).

Created with ❤️ by **Aman Kumar** ([@Amankr0075](https://github.com/Amankr0075)).
