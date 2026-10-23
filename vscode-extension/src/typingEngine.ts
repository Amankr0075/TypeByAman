/**
 * TypeByAman — Typing Engine (VS Code)
 * Author: Aman Kumar | github.com/Amankr0075
 *
 * Asynchronous, chunked character-by-character typing engine.
 * Supports pause/resume/stop, configurable delays, and large files.
 * All text is reproduced exactly — no modifications.
 */

import * as vscode from 'vscode';

export interface TypingEngineConfig {
  text:          string;
  editor:        vscode.TextEditor;
  delay:         number;
  lineBreakDelay:number;
  startDelay:    number;
  onProgress:    (charIndex: number, totalChars: number) => void;
  onPause:       (charIndex: number, totalChars: number) => void;
  onDone:        (totalChars: number) => void;
  onError:       (err: Error, charIndex: number) => void;
  onStop:        (charIndex: number) => void;
}

export class TypingEngine {
  private config:     TypingEngineConfig;
  private _active:    boolean = false;
  private _paused:    boolean = false;
  private _charIndex: number  = 0;
  private _stopped:   boolean = false;
  private _abortController: AbortController;
  private _pausePromise:    (() => void) | null = null;

  constructor(config: TypingEngineConfig) {
    this.config = config;
    this._abortController = new AbortController();
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  start(): void {
    this._active  = true;
    this._stopped = false;
    this._runLoop().catch(() => {});
  }

  pause(): void {
    if (!this._active || this._paused) return;
    this._paused = true;
    this.config.onPause(this._charIndex, this.config.text.length);
  }

  resume(): void {
    if (!this._paused) return;
    this._paused = false;
    if (this._pausePromise) {
      this._pausePromise();
      this._pausePromise = null;
    }
  }

  stop(): void {
    this._stopped = true;
    this._active  = false;
    this._paused  = false;
    this._abortController.abort();
    if (this._pausePromise) {
      this._pausePromise();
      this._pausePromise = null;
    }
    this.config.onStop(this._charIndex);
  }

  updateDelay(delay: number): void {
    this.config.delay = Math.max(1, delay);
  }

  isActive():  boolean { return this._active && !this._paused; }
  isPaused():  boolean { return this._paused; }
  isStopped(): boolean { return this._stopped; }

  getConfig(): TypingEngineConfig { return this.config; }

  // ─── Main Loop ──────────────────────────────────────────────────────────────

  private async _runLoop(): Promise<void> {
    const { text, editor, startDelay, lineBreakDelay } = this.config;
    const signal = this._abortController.signal;

    try {
      // Start delay
      if (startDelay > 0) await this._sleep(startDelay, signal);

      // Move cursor to end of document
      await this._moveCursorToEnd(editor);

      const total = text.length;

      for (let i = 0; i < total; i++) {
        if (signal.aborted || this._stopped) break;

        // Pause point
        await this._waitIfPaused(signal);
        if (signal.aborted || this._stopped) break;

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
        const totalDelay  = this.config.delay + (isLineBreak ? lineBreakDelay : 0);
        if (totalDelay > 0 && !signal.aborted) {
          await this._sleep(totalDelay, signal);
        }
      }

      if (!signal.aborted && !this._stopped) {
        this._active = false;
        this.config.onDone(total);
      }

    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        this._active = false;
        this.config.onError(err, this._charIndex);
      }
    }
  }

  // ─── Typing ─────────────────────────────────────────────────────────────────

  private async _typeChar(
    editor: vscode.TextEditor,
    ch: string,
    signal: AbortSignal
  ): Promise<void> {
    if (signal.aborted) return;

    await editor.edit(editBuilder => {
      const position = editor.selection.active;
      editBuilder.insert(position, ch);
    }, {
      undoStopBefore: false,
      undoStopAfter:  false,
    });

    // Move cursor forward
    const doc   = editor.document;
    const pos   = editor.selection.active;
    const newPos = doc.validatePosition(
      new vscode.Position(pos.line, pos.character)
    );
    editor.selection = new vscode.Selection(newPos, newPos);

    // Auto-reveal cursor
    editor.revealRange(
      new vscode.Range(newPos, newPos),
      vscode.TextEditorRevealType.Default
    );
  }

  private async _moveCursorToEnd(editor: vscode.TextEditor): Promise<void> {
    const doc     = editor.document;
    const lastLine = doc.lineCount - 1;
    const lastChar = doc.lineAt(lastLine).text.length;
    const end      = new vscode.Position(lastLine, lastChar);
    editor.selection = new vscode.Selection(end, end);
    editor.revealRange(new vscode.Range(end, end));
  }

  // ─── Utilities ──────────────────────────────────────────────────────────────

  private _sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (ms <= 0) { resolve(); return; }
      const id = setTimeout(resolve, ms);
      if (signal) {
        signal.addEventListener('abort', () => {
          clearTimeout(id);
          const err = new Error('Aborted');
          err.name  = 'AbortError';
          reject(err);
        }, { once: true });
      }
    });
  }

  private _waitIfPaused(signal: AbortSignal): Promise<void> {
    if (!this._paused) return Promise.resolve();
    return new Promise((resolve, reject) => {
      this._pausePromise = resolve;
      signal.addEventListener('abort', () => {
        const err = new Error('Aborted');
        err.name  = 'AbortError';
        reject(err);
      }, { once: true });
    });
  }
}
