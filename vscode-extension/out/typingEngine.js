"use strict";
/**
 * TypeByAman — Typing Engine (VS Code)
 * Author: Aman Kumar | github.com/Amankr0075
 *
 * Asynchronous, chunked character-by-character typing engine.
 * Supports pause/resume/stop, configurable delays, and large files.
 * All text is reproduced exactly — no modifications.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TypingEngine = void 0;
const vscode = __importStar(require("vscode"));
const nativeCursorBridge_1 = require("./nativeCursorBridge");
class TypingEngine {
    _randomRunInterval() {
        return 80 + Math.floor(Math.random() * 120); // 80–200 lines between runs
    }
    _randomThinkInterval() {
        return 15 + Math.floor(Math.random() * 25); // 15–40 lines between thinking pauses
    }
    constructor(config) {
        this._active = false;
        this._paused = false;
        this._charIndex = 0;
        this._stopped = false;
        this._pausePromise = null;
        // ── Run & Continue state ────────────────────────────────────────────────────
        this._linesTyped = 0;
        /** Next line count at which we will do a "run code" pause (randomized 80–200 lines). */
        this._nextRunAtLine = this._randomRunInterval();
        /** Next line count at which we pause briefly to "re-read" what we wrote (15–40 lines). */
        this._nextThinkAtLine = this._randomThinkInterval();
        this.config = config;
        this._abortController = new AbortController();
    }
    // ─── Public API ─────────────────────────────────────────────────────────────
    start() {
        this._active = true;
        this._stopped = false;
        this._runLoop().catch(() => { });
    }
    pause() {
        if (!this._active || this._paused)
            return;
        this._paused = true;
        this.config.onPause(this._charIndex, this.config.text.length);
    }
    resume() {
        if (!this._paused)
            return;
        this._paused = false;
        if (this._pausePromise) {
            this._pausePromise();
            this._pausePromise = null;
        }
    }
    stop() {
        this._stopped = true;
        this._active = false;
        this._paused = false;
        this._abortController.abort();
        if (this._pausePromise) {
            this._pausePromise();
            this._pausePromise = null;
        }
        nativeCursorBridge_1.NativeCursorBridge.getInstance().stop();
        this.config.onStop(this._charIndex);
    }
    updateDelay(delay) {
        this.config.delay = Math.max(1, delay);
    }
    isActive() { return this._active && !this._paused; }
    isPaused() { return this._paused; }
    isStopped() { return this._stopped; }
    getConfig() { return this.config; }
    // ─── Main Loop ──────────────────────────────────────────────────────────────
    async _runLoop() {
        const { text, editor, startDelay, lineBreakDelay } = this.config;
        const signal = this._abortController.signal;
        try {
            // Start native OS cursor bridge if extensionPath provided
            if (this.config.extensionPath) {
                nativeCursorBridge_1.NativeCursorBridge.getInstance().start(this.config.extensionPath).catch(() => { });
            }
            // Start delay
            if (startDelay > 0)
                await this._sleep(startDelay, signal);
            const total = text.length;
            let lastMinorTypoTime = Date.now();
            let nextMinorTypoInterval = 14000 + Math.random() * 8000;
            // Dynamic word tempo
            let currentWordTempo = Math.random() < 0.35 ? 'fast' : (Math.random() < 0.22 ? 'deliberate' : 'normal');
            for (let i = 0; i < total; i++) {
                if (signal.aborted || this._stopped)
                    break;
                // Pause point
                await this._waitIfPaused(signal);
                if (signal.aborted || this._stopped)
                    break;
                this._charIndex = i;
                const ch = text[i];
                // Word boundary & punctuation detection
                const isWordBoundary = ch === ' ' || ch === '\t';
                const isLineBreak = ch === '\n' || ch === '\r';
                if (isWordBoundary) {
                    currentWordTempo = Math.random() < 0.35 ? 'fast' : (Math.random() < 0.22 ? 'deliberate' : 'normal');
                }
                const now = Date.now();
                const isEligibleForTypo = ch !== '\n' && ch !== '\r' && ch !== '\t' && /[a-zA-Z0-9]/.test(ch);
                // Subtle realistic minor key slip: ONLY when humanBehavior is active and delay >= 50ms
                if (this.config.humanBehavior && this.config.delay >= 50 && isEligibleForTypo && (now - lastMinorTypoTime) >= nextMinorTypoInterval) {
                    const wrongChar = getAdjacentKey(ch);
                    if (wrongChar && wrongChar !== ch) {
                        await this._typeChar(editor, wrongChar, signal);
                        lastMinorTypoTime = Date.now();
                        nextMinorTypoInterval = 14000 + Math.random() * 8000;
                        // Notice pause (100–180ms)
                        const noticePause = 100 + Math.floor(Math.random() * 80);
                        await this._sleep(noticePause, signal);
                        if (signal.aborted || this._stopped)
                            break;
                        // Backspace delete mistake char
                        await this._deleteChar(editor, signal);
                        // Brief recovery pause (60–120ms)
                        await this._sleep(60 + Math.floor(Math.random() * 60), signal);
                        if (signal.aborted || this._stopped)
                            break;
                        // Retype the correct character
                        await this._typeChar(editor, ch, signal);
                        const recoverDelay = Math.min(80, this.config.delay);
                        await this._sleep(recoverDelay, signal);
                        if (signal.aborted || this._stopped)
                            break;
                        if (i % 25 === 0 || i === total - 1) {
                            this.config.onProgress(i + 1, total);
                        }
                        continue; // move to next char
                    }
                }
                // Type the character directly and cleanly into editor
                await this._typeChar(editor, ch, signal);
                // Subtly nudge OS mouse cursor occasionally only if humanBehavior is enabled
                if (this.config.humanBehavior && i % 50 === 0 && Math.random() < 0.25) {
                    nativeCursorBridge_1.NativeCursorBridge.getInstance().nudgeSubtly().catch(() => { });
                }
                // Progress callback (throttled)
                if (i % 25 === 0 || i === total - 1) {
                    this.config.onProgress(i + 1, total);
                }
                // Accurate delay calculation honoring user's exact speed settings
                const extraDelay = isLineBreak ? (Number.isFinite(lineBreakDelay) && lineBreakDelay > 0 ? lineBreakDelay : 0) : 0;
                const totalDelay = this._getHumanKeystrokeDelay(ch, this.config.delay, currentWordTempo) + extraDelay;
                if (totalDelay > 0 && !signal.aborted) {
                    await this._sleep(totalDelay, signal);
                }
            }
            if (!signal.aborted && !this._stopped) {
                this._active = false;
                this.config.onDone(total);
            }
        }
        catch (err) {
            if (err instanceof Error && err.name !== 'AbortError') {
                this._active = false;
                this.config.onError(err, this._charIndex);
            }
        }
    }
    // ─── Typing ─────────────────────────────────────────────────────────────────
    async _typeChar(editor, ch, signal) {
        if (signal.aborted)
            return;
        await editor.edit(editBuilder => {
            const position = editor.selection.active;
            editBuilder.insert(position, ch);
        }, {
            undoStopBefore: false,
            undoStopAfter: false,
        });
        // Move cursor forward
        const doc = editor.document;
        const pos = editor.selection.active;
        const newPos = doc.validatePosition(new vscode.Position(pos.line, pos.character));
        editor.selection = new vscode.Selection(newPos, newPos);
        // Auto-reveal cursor
        editor.revealRange(new vscode.Range(newPos, newPos), vscode.TextEditorRevealType.Default);
    }
    async _moveCursorToEnd(editor) {
        const doc = editor.document;
        const lastLine = doc.lineCount - 1;
        const lastChar = doc.lineAt(lastLine).text.length;
        const end = new vscode.Position(lastLine, lastChar);
        editor.selection = new vscode.Selection(end, end);
        editor.revealRange(new vscode.Range(end, end));
    }
    async _deleteChar(editor, signal) {
        if (signal.aborted)
            return;
        const pos = editor.selection.active;
        if (pos.character > 0) {
            const prevPos = new vscode.Position(pos.line, pos.character - 1);
            const range = new vscode.Range(prevPos, pos);
            await editor.edit(editBuilder => {
                editBuilder.delete(range);
            }, {
                undoStopBefore: false,
                undoStopAfter: false,
            });
            editor.selection = new vscode.Selection(prevPos, prevPos);
        }
        else if (pos.line > 0) {
            const prevLine = pos.line - 1;
            const prevChar = editor.document.lineAt(prevLine).text.length;
            const prevPos = new vscode.Position(prevLine, prevChar);
            const range = new vscode.Range(prevPos, pos);
            await editor.edit(editBuilder => {
                editBuilder.delete(range);
            }, {
                undoStopBefore: false,
                undoStopAfter: false,
            });
            editor.selection = new vscode.Selection(prevPos, prevPos);
        }
    }
    /**
     * Calculates typing delay respecting selected speed mode.
     * If humanBehavior is active and delay >= 30ms, adds natural organic jitter.
     */
    _getHumanKeystrokeDelay(ch, baseDelay, tempo = 'normal') {
        // 1. Fast & Very Fast modes (<= 15ms) or humanBehavior disabled: return exact delay
        if (baseDelay <= 15 || !this.config.humanBehavior) {
            return Math.max(1, baseDelay);
        }
        // 2. Fast mode (<= 30ms): slight organic variance (±15%) without heavy penalties
        if (baseDelay <= 30) {
            const jitter = 0.90 + Math.random() * 0.20;
            return Math.max(1, Math.round(baseDelay * jitter));
        }
        // 3. Normal / Slow modes (baseDelay > 30ms) with humanBehavior:
        let tempoMultiplier = 1.0;
        if (tempo === 'fast')
            tempoMultiplier = 0.85;
        else if (tempo === 'deliberate')
            tempoMultiplier = 1.20;
        let delay = baseDelay * tempoMultiplier * (0.85 + Math.random() * 0.30);
        if (ch >= 'A' && ch <= 'Z') {
            delay += Math.min(20, baseDelay * 0.25);
        }
        else if (/[{}()[\];:,.=+\-*\/&|!<>?]/.test(ch)) {
            delay += Math.min(25, baseDelay * 0.30);
        }
        else if (ch === ' ') {
            delay += Math.min(15, baseDelay * 0.20);
        }
        if (baseDelay >= 60 && Math.random() < 0.03) {
            delay += Math.min(120, baseDelay * 0.6);
        }
        return Math.max(1, Math.round(delay));
    }
    /**
     * Simulates a human developer pausing, scrolling up to review earlier code or
     * variable definitions, moving cursor to inspect, and scrolling back to coding line.
     * On screen recordings, this is the ultimate signature of authentic human coding.
     */
    async _inspectEarlierCode(editor, signal) {
        if (signal.aborted || this._stopped)
            return;
        const currentLine = editor.selection.active.line;
        if (currentLine < 8)
            return; // not enough lines above to inspect
        try {
            // 1. Scroll up 6–15 lines
            const scrollLines = Math.min(currentLine - 2, 6 + Math.floor(Math.random() * 9));
            await vscode.commands.executeCommand('editorScroll', {
                to: 'up',
                by: 'line',
                value: scrollLines,
                revealCursor: false,
            });
            // 2. Move real OS cursor up to "hover" over the lines being inspected
            nativeCursorBridge_1.NativeCursorBridge.getInstance().wander(70, 50).catch(() => { });
            // 3. Reading pause: 1.5s–3.2s
            const readTime = 1500 + Math.floor(Math.random() * 1700);
            await this._sleep(readTime, signal);
            if (signal.aborted || this._stopped)
                return;
            // 4. Scroll back down to current editing position
            editor.revealRange(new vscode.Range(editor.selection.active, editor.selection.active), vscode.TextEditorRevealType.InCenter);
            // 5. Settling pause before continuing coding
            await this._sleep(300 + Math.floor(Math.random() * 400), signal);
        }
        catch (_) { }
    }
    // ─── Run & Continue ──────────────────────────────────────────────────────────
    /**
     * Simulates a developer stopping to run/test their code mid-session.
     *
     * Sequence:
     *  1. Save the file (Ctrl+S)
     *  2. Brief "about to run" hesitation
     *  3. Open integrated terminal (or reuse existing)
     *  4. Type the run command character-by-character (human speed)
     *  5. Press Enter
     *  6. Wait a realistic "watching output" period (8–25 seconds)
     *  7. Return focus to the editor
     *  8. Brief "back to coding" hesitation before resuming typing
     */
    async _runCode(editor, signal) {
        if (signal.aborted || this._stopped)
            return;
        // 1. Save the file first — Ctrl+S
        await vscode.commands.executeCommand('workbench.action.files.save');
        await this._sleep(400 + Math.floor(Math.random() * 400), signal); // 400–800ms "saved, now let me run"
        if (signal.aborted || this._stopped)
            return;
        // 2. Open/focus the integrated terminal
        nativeCursorBridge_1.NativeCursorBridge.getInstance().wander(60, 40).catch(() => { });
        await vscode.commands.executeCommand('workbench.action.terminal.focus');
        await this._sleep(600 + Math.floor(Math.random() * 600), signal); // wait for terminal to appear
        if (signal.aborted || this._stopped)
            return;
        // 3. Determine what command to run
        const cmd = this.config.runCommand?.trim() ||
            TypingEngine._detectRunCommand(editor.document.fileName);
        if (!cmd) {
            // No command found — just return to editor
            await vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
            return;
        }
        // 4. Type the command character-by-character (human cadence)
        for (const ch of cmd) {
            if (signal.aborted || this._stopped)
                return;
            await vscode.commands.executeCommand('workbench.action.terminal.sendSequence', { text: ch });
            // Realistic typing speed in terminal: 30–100ms per char, with occasional hesitation
            const charDelay = Math.random() < 0.08
                ? 200 + Math.floor(Math.random() * 400) // occasional hesitation
                : 30 + Math.floor(Math.random() * 70);
            await this._sleep(charDelay, signal);
        }
        if (signal.aborted || this._stopped)
            return;
        // 5. Press Enter to run
        await this._sleep(80 + Math.floor(Math.random() * 120), signal);
        await vscode.commands.executeCommand('workbench.action.terminal.sendSequence', { text: '\r' });
        // 6. Watch output — humans stare at the terminal for a while and track output
        nativeCursorBridge_1.NativeCursorBridge.getInstance().nudgeSubtly().catch(() => { });
        const watchMs = 8000 + Math.floor(Math.random() * 17000);
        await this._sleep(watchMs, signal);
        if (signal.aborted || this._stopped)
            return;
        // 7. Return focus to the editor ("ok, output looks fine, back to coding")
        nativeCursorBridge_1.NativeCursorBridge.getInstance().wander(50, 30).catch(() => { });
        await vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
        await this._sleep(500 + Math.floor(Math.random() * 1000), signal); // settling pause
        if (signal.aborted || this._stopped)
            return;
        // 8. Move cursor back to end of document (terminal focus may have moved it)
        await this._moveCursorToEnd(editor);
        await this._sleep(200 + Math.floor(Math.random() * 600), signal); // "alright, where was I..."
    }
    /**
     * Auto-detects the appropriate run command from the file extension.
     * Returns null if the file type is not recognized.
     */
    static _detectRunCommand(filePath) {
        const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
        const fileName = filePath.split(/[\\/]/).pop() ?? '';
        const commandMap = {
            // JavaScript / TypeScript
            'js': `node "${fileName}"`,
            'ts': `npx ts-node "${fileName}"`,
            'mjs': `node "${fileName}"`,
            'cjs': `node "${fileName}"`,
            // Python
            'py': `python "${fileName}"`,
            'pyw': `python "${fileName}"`,
            // Java
            'java': `javac "${fileName}" && java "${fileName.replace('.java', '')}"`,
            // C / C++
            'c': `gcc "${fileName}" -o out && ./out`,
            'cpp': `g++ "${fileName}" -o out && ./out`,
            'cc': `g++ "${fileName}" -o out && ./out`,
            // Rust
            'rs': `rustc "${fileName}" && ./${fileName.replace('.rs', '')}`,
            // Go
            'go': `go run "${fileName}"`,
            // Ruby
            'rb': `ruby "${fileName}"`,
            // PHP
            'php': `php "${fileName}"`,
            // Shell
            'sh': `bash "${fileName}"`,
            'bash': `bash "${fileName}"`,
            // Kotlin
            'kt': `kotlinc "${fileName}" -include-runtime -d out.jar && java -jar out.jar`,
            // Swift
            'swift': `swift "${fileName}"`,
            // Lua
            'lua': `lua "${fileName}"`,
            // R
            'r': `Rscript "${fileName}"`,
        };
        return commandMap[ext] ?? null;
    }
    // ─── Utilities ──────────────────────────────────────────────────────────────
    _sleep(ms, signal) {
        return new Promise((resolve, reject) => {
            if (ms <= 0) {
                resolve();
                return;
            }
            const id = setTimeout(resolve, ms);
            if (signal) {
                signal.addEventListener('abort', () => {
                    clearTimeout(id);
                    const err = new Error('Aborted');
                    err.name = 'AbortError';
                    reject(err);
                }, { once: true });
            }
        });
    }
    _waitIfPaused(signal) {
        if (!this._paused)
            return Promise.resolve();
        return new Promise((resolve, reject) => {
            this._pausePromise = resolve;
            signal.addEventListener('abort', () => {
                const err = new Error('Aborted');
                err.name = 'AbortError';
                reject(err);
            }, { once: true });
        });
    }
}
exports.TypingEngine = TypingEngine;
// ─── Realistic Stream-of-Thought Wrong Chunks (50–70 characters each) ────────
// Each entry is a plausible-but-wrong sequence a developer might blurt out
// before realising they went down the wrong path.
const WRONG_CHUNK_SNIPPETS = [
    "const tempResult = data.filter(item => item.isActive && item.isValid);",
    "function calculateTotalSum(values) { return values.reduce((acc, cur) =>",
    "retunr response.status(200).json({ status: 'ok', payload: result });",
    "console.log('debugging state output:', JSON.stringify(state, null, 2));",
    "let items = list.map(item => ({ id: item.id, label: item.title }));",
    "if (userState === null || userState === undefined || !userState.auth)",
    "const formattedDate = new Date(timestamp).toLocaleDateString('en-US');",
    "return new Promise((resolve, reject) => { setTimeout(() => resolve(),",
    "document.querySelector('#target-container').addEventListener('click',",
    "async function fetchDataFromApi(endpoint, options = { method: 'GET' })",
    "const finalOutput = result.map(r => r.value).filter(v => v !== null);",
    "this.setState({ isLoading: true, error: null, data: prevResponse });",
    "export default function App({ children, className, initialTheme }) {",
    "import React, { useState, useEffect, useCallback, useMemo } from 'react';",
    "const handleSubmit = async (event) => { event.preventDefault(); if (",
    "useEffect(() => { fetchData().then(res => setData(res.data)); }, []);",
    "const router = useRouter(); const { id, slug, category } = router.query;",
    "type UserProfile = { id: string; name: string; email: string; role: string;",
    "interface ApiResponse<T> { data: T; error: string | null; code: number;",
    "const dispatch = useDispatch(); const selector = useSelector(state =>",
];
/**
 * Returns a random wrong snippet strictly between 50 and 70 characters
 * with randomized organic length variations.
 */
function getWrongChunk() {
    const base = WRONG_CHUNK_SNIPPETS[Math.floor(Math.random() * WRONG_CHUNK_SNIPPETS.length)];
    const targetLen = 50 + Math.floor(Math.random() * 21); // strictly 50 to 70 chars
    if (base.length <= targetLen)
        return base;
    return base.slice(0, targetLen);
}
// ─── QWERTY Adjacent Key Map for Realistic Typo Simulation ───────────────────
const QWERTY_NEIGHBORS = {
    'q': ['w', 'a'], 'w': ['q', 'e', 's', 'a'], 'e': ['w', 'r', 'd', 's'], 'r': ['e', 't', 'f', 'd'],
    't': ['r', 'y', 'g', 'f'], 'y': ['t', 'u', 'h', 'g'], 'u': ['y', 'i', 'j', 'h'], 'i': ['u', 'o', 'k', 'j'],
    'o': ['i', 'p', 'l', 'k'], 'p': ['o', '[', 'l'],
    'a': ['q', 'w', 's', 'z'], 's': ['a', 'w', 'e', 'd', 'z', 'x'], 'd': ['s', 'e', 'r', 'f', 'x', 'c'],
    'f': ['d', 'r', 't', 'g', 'c', 'v'], 'g': ['f', 't', 'y', 'h', 'v', 'b'], 'h': ['g', 'y', 'u', 'j', 'b', 'n'],
    'j': ['h', 'u', 'i', 'k', 'n', 'm'], 'k': ['j', 'i', 'o', 'l', 'm', ','], 'l': ['k', 'o', 'p', ';', ',', '.'],
    'z': ['a', 's', 'x'], 'x': ['z', 's', 'd', 'c'], 'c': ['x', 'd', 'f', 'v'], 'v': ['c', 'f', 'g', 'b'],
    'b': ['v', 'g', 'h', 'n'], 'n': ['b', 'h', 'j', 'm'], 'm': ['n', 'j', 'k', ','],
    '1': ['2', 'q'], '2': ['1', '3', 'q', 'w'], '3': ['2', '4', 'w', 'e'], '4': ['3', '5', 'e', 'r'],
    '5': ['4', '6', 'r', 't'], '6': ['5', '7', 't', 'y'], '7': ['6', '8', 'y', 'u'], '8': ['7', '9', 'u', 'i'],
    '9': ['8', '0', 'i', 'o'], '0': ['9', '-', 'o', 'p'],
};
function getAdjacentKey(ch) {
    const lower = ch.toLowerCase();
    const neighbors = QWERTY_NEIGHBORS[lower];
    if (!neighbors || neighbors.length === 0)
        return null;
    const pick = neighbors[Math.floor(Math.random() * neighbors.length)];
    return ch === ch.toUpperCase() && ch !== ch.toLowerCase() ? pick.toUpperCase() : pick;
}
//# sourceMappingURL=typingEngine.js.map