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
class TypingEngine {
    constructor(config) {
        this._active = false;
        this._paused = false;
        this._charIndex = 0;
        this._stopped = false;
        this._pausePromise = null;
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
            // Start delay
            if (startDelay > 0)
                await this._sleep(startDelay, signal);
            // Move cursor to end of document
            await this._moveCursorToEnd(editor);
            const total = text.length;
            let lastMajorTypoTime = Date.now();
            let nextMajorTypoInterval = 45000 + Math.random() * 8000; // ~50 seconds (45s - 55s)
            let lastMinorTypoTime = Date.now();
            let nextMinorTypoInterval = 10000 + Math.random() * 4000; // ~12 seconds for minor key slip
            for (let i = 0; i < total; i++) {
                if (signal.aborted || this._stopped)
                    break;
                // Pause point
                await this._waitIfPaused(signal);
                if (signal.aborted || this._stopped)
                    break;
                this._charIndex = i;
                const ch = text[i];
                const now = Date.now();
                const isEligibleForTypo = ch !== '\n' && ch !== '\r' && ch !== '\t' && /[a-zA-Z0-9]/.test(ch);
                // ── 1. Major Human Mistake (Every ~50s: types 20-25+ chars wrong, erases, and retypes) ──
                if (isEligibleForTypo && (now - lastMajorTypoTime) >= nextMajorTypoInterval) {
                    const wrongSnippet = getWrongChunk(); // 28–31 characters (guaranteed at least 20–25 chars)
                    lastMajorTypoTime = Date.now();
                    nextMajorTypoInterval = 48000 + Math.random() * 6000; // reschedule in ~50 seconds
                    // A. Type out the wrong 20-25+ character sequence
                    for (let w = 0; w < wrongSnippet.length; w++) {
                        if (signal.aborted || this._stopped)
                            break;
                        await this._waitIfPaused(signal);
                        if (signal.aborted || this._stopped)
                            break;
                        await this._typeChar(editor, wrongSnippet[w], signal);
                        const wDelay = Math.max(20, this.config.delay + Math.floor(Math.random() * 25 - 10));
                        await this._sleep(wDelay, signal);
                    }
                    if (signal.aborted || this._stopped)
                        break;
                    // B. Realization pause: 350ms - 550ms ("Wait, this is wrong, let me erase it")
                    const realizationMs = 350 + Math.floor(Math.random() * 200);
                    await this._sleep(realizationMs, signal);
                    if (signal.aborted || this._stopped)
                        break;
                    // C. Rapid backspacing: erase each wrong character one by one like holding backspace
                    for (let d = 0; d < wrongSnippet.length; d++) {
                        if (signal.aborted || this._stopped)
                            break;
                        await this._waitIfPaused(signal);
                        if (signal.aborted || this._stopped)
                            break;
                        await this._deleteChar(editor, signal);
                        const backspaceSpeed = 35 + Math.floor(Math.random() * 30);
                        await this._sleep(backspaceSpeed, signal);
                    }
                    if (signal.aborted || this._stopped)
                        break;
                    // D. Cognitive reset hesitation: 250ms - 400ms before re-typing correct code
                    const resetPause = 250 + Math.floor(Math.random() * 150);
                    await this._sleep(resetPause, signal);
                    if (signal.aborted || this._stopped)
                        break;
                    // E. Cleanly type the intended character and continue!
                    await this._typeChar(editor, ch, signal);
                    continue;
                }
                // ── 2. Minor Key Slip (Every ~12-15s: adjacent key typo & backspace) ──
                if (isEligibleForTypo && (now - lastMinorTypoTime) >= nextMinorTypoInterval) {
                    const wrongChar = getAdjacentKey(ch);
                    if (wrongChar && wrongChar !== ch) {
                        // 1. Type the mistake character
                        await this._typeChar(editor, wrongChar, signal);
                        lastMinorTypoTime = Date.now();
                        nextMinorTypoInterval = 12000 + Math.random() * 4000;
                        // 2. In 40% of cases, type 1 extra character before noticing error
                        let bonusChar = null;
                        if (i + 1 < total && Math.random() < 0.4 && /[a-zA-Z0-9]/.test(text[i + 1])) {
                            bonusChar = text[i + 1];
                            await this._typeChar(editor, bonusChar, signal);
                            await this._sleep(this.config.delay + Math.floor(Math.random() * 40), signal);
                            if (signal.aborted || this._stopped)
                                break;
                        }
                        // 3. Human realization pause (200-350ms)
                        const noticePause = 200 + Math.floor(Math.random() * 150);
                        await this._sleep(noticePause, signal);
                        if (signal.aborted || this._stopped)
                            break;
                        // 4. Backspace delete bonus char if typed
                        if (bonusChar !== null) {
                            await this._deleteChar(editor, signal);
                            await this._sleep(80 + Math.floor(Math.random() * 40), signal);
                            if (signal.aborted || this._stopped)
                                break;
                        }
                        // 5. Backspace delete mistake char
                        await this._deleteChar(editor, signal);
                        // 6. Brief recovery hesitation (120-200ms)
                        await this._sleep(120 + Math.floor(Math.random() * 80), signal);
                        if (signal.aborted || this._stopped)
                            break;
                        // 7. Retype the correct character
                        await this._typeChar(editor, ch, signal);
                        // Slight pause after fixing error
                        await this._sleep(this.config.delay + Math.floor(Math.random() * 50), signal);
                        if (signal.aborted || this._stopped)
                            break;
                        if (i % 25 === 0 || i === total - 1) {
                            this.config.onProgress(i + 1, total);
                        }
                        continue; // move to next char
                    }
                }
                // ────────────────────────────────────────────────────────────────────
                // Type the character
                await this._typeChar(editor, ch, signal);
                // Progress callback (throttled)
                if (i % 25 === 0 || i === total - 1) {
                    this.config.onProgress(i + 1, total);
                }
                // Delay
                const isLineBreak = ch === '\n' || ch === '\r';
                const totalDelay = this.config.delay + (isLineBreak ? lineBreakDelay : 0);
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
// ─── Realistic Stream-of-Thought Wrong Chunks (28–31 characters each) ────────
const WRONG_CHUNK_SNIPPETS = [
    "const tempResult = data.filter",
    "function calculateTotalSum() {",
    "retunr response.json(payload)",
    "console.log('debugging value')",
    "let items = list.map(item =>",
    "if (userState === null || und",
    "const formattedDate = new Date",
    "return new Promise((resolve) ",
    "document.querySelector('#target",
    "async function fetchDataFromApi",
    "const finalOutput = result.map",
    "this.setState({ isLoading: tr",
    "export default function App() ",
    "import React, { useState, use",
];
function getWrongChunk() {
    return WRONG_CHUNK_SNIPPETS[Math.floor(Math.random() * WRONG_CHUNK_SNIPPETS.length)];
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