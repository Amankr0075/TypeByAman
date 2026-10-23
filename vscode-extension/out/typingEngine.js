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
            for (let i = 0; i < total; i++) {
                if (signal.aborted || this._stopped)
                    break;
                // Pause point
                await this._waitIfPaused(signal);
                if (signal.aborted || this._stopped)
                    break;
                this._charIndex = i;
                const ch = text[i];
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
//# sourceMappingURL=typingEngine.js.map