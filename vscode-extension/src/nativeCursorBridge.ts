/**
 * TypeByAman — Native Cursor Bridge (VS Code Extension)
 * Author: Aman Kumar | github.com/Amankr0075
 *
 * Spawns the native-helper/cursor-helper.js as a child process and
 * provides a clean async API for controlling the real OS cursor.
 *
 * Usage:
 *   const bridge = NativeCursorBridge.getInstance();
 *   await bridge.start();
 *   await bridge.moveTo(500, 300);
 *   await bridge.click(500, 300);
 *   bridge.stop();
 */

import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

interface RpcRequest {
  id: number;
  cmd: string;
  [key: string]: unknown;
}

interface RpcResponse {
  ok: boolean;
  id?: number;
  error?: string;
  [key: string]: unknown;
}

export class NativeCursorBridge {
  private static _instance: NativeCursorBridge | null = null;
  private _proc: cp.ChildProcess | null = null;
  private _pending: Map<number, { resolve: (r: RpcResponse) => void; reject: (e: Error) => void }> = new Map();
  private _idCounter = 0;
  private _buffer = '';
  private _ready = false;

  static getInstance(): NativeCursorBridge {
    if (!NativeCursorBridge._instance) {
      NativeCursorBridge._instance = new NativeCursorBridge();
    }
    return NativeCursorBridge._instance;
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  async start(extensionPath: string): Promise<void> {
    if (this._proc && this._ready) return; // already running

    const candidates = [
      path.join(extensionPath, '..', 'native-helper', 'cursor-helper.js'),
      path.join(extensionPath, 'native-helper', 'cursor-helper.js'),
      path.join(extensionPath, '..', '..', 'native-helper', 'cursor-helper.js'),
      path.resolve(__dirname, '..', '..', 'native-helper', 'cursor-helper.js'),
      path.resolve(__dirname, '..', 'native-helper', 'cursor-helper.js'),
    ];

    const helperPath = candidates.find(c => fs.existsSync(c));
    if (!helperPath) {
      console.warn('[TBA NativeBridge] cursor-helper.js not found in candidate paths:', candidates);
      return;
    }

    const helperDir = path.dirname(helperPath);

    return new Promise((resolve, reject) => {
      try {
        this._proc = cp.spawn('node', [helperPath], {
          cwd: helperDir,
          stdio: ['pipe', 'pipe', 'pipe'],
          windowsHide: true,  // no console window flashes on Windows
        });
      } catch (e) {
        return reject(e);
      }

      this._proc.stdout!.setEncoding('utf8');
      this._proc.stdout!.on('data', (data: string) => this._handleData(data));

      this._proc.stderr!.on('data', (err: string) => {
        console.error('[TBA NativeBridge]', err.trim());
      });

      this._proc.on('error', (err) => {
        this._ready = false;
        reject(err);
      });

      this._proc.on('exit', () => {
        this._ready = false;
        this._proc = null;
      });

      // Wait for ready signal (first line from helper)
      const readyTimeout = setTimeout(() => {
        if (!this._ready) {
          console.warn('[TBA NativeBridge] Native helper start timeout — continuing without OS cursor control');
          resolve(); // Resolve anyway so typing isn't blocked
        }
      }, 5000);

      const origHandle = this._handleData.bind(this);
      this._handleData = (data: string) => {
        origHandle(data);
        if (this._ready) {
          clearTimeout(readyTimeout);
          this._handleData = origHandle; // restore
          resolve();
        }
      };
    });
  }

  stop(): void {
    if (this._proc) {
      this._proc.kill();
      this._proc = null;
    }
    this._ready = false;
    this._pending.clear();
  }

  get isReady(): boolean { return this._ready; }

  // ─── Data handling ──────────────────────────────────────────────────────────

  private _handleData(data: string): void {
    this._buffer += data;
    const lines = this._buffer.split('\n');
    this._buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const msg = JSON.parse(trimmed) as RpcResponse;
        if ((msg as unknown as { ready?: boolean }).ready) {
          this._ready = true;
        }
        if (msg.id !== undefined) {
          const pending = this._pending.get(msg.id);
          if (pending) {
            this._pending.delete(msg.id);
            if (msg.ok) {
              pending.resolve(msg);
            } else {
              pending.reject(new Error(msg.error ?? 'Unknown error from native helper'));
            }
          }
        }
      } catch (_) {}
    }
  }

  // ─── RPC Send ───────────────────────────────────────────────────────────────

  private _send(payload: Omit<RpcRequest, 'id'>): Promise<RpcResponse> {
    if (!this._proc || !this._ready) {
      return Promise.reject(new Error('Native cursor bridge not started'));
    }
    const id = ++this._idCounter;
    return new Promise((resolve, reject) => {
      this._pending.set(id, { resolve, reject });
      this._proc!.stdin!.write(JSON.stringify({ ...payload, id }) + '\n');
      // Timeout after 30s
      setTimeout(() => {
        if (this._pending.has(id)) {
          this._pending.delete(id);
          reject(new Error(`Native bridge timeout for cmd: ${payload.cmd}`));
        }
      }, 30000);
    });
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  async ping(): Promise<boolean> {
    try {
      const r = await this._send({ cmd: 'ping' });
      return r.ok;
    } catch { return false; }
  }

  async getPosition(): Promise<{ x: number; y: number }> {
    const r = await this._send({ cmd: 'getPos' });
    return { x: r.x as number, y: r.y as number };
  }

  async moveTo(x: number, y: number, durationMs?: number): Promise<void> {
    await this._send({ cmd: 'moveTo', x, y, duration: durationMs });
  }

  async click(x: number, y: number, button: 'left' | 'right' | 'middle' = 'left'): Promise<void> {
    await this._send({ cmd: 'click', x, y, button });
  }

  async doubleClick(x: number, y: number): Promise<void> {
    await this._send({ cmd: 'doubleClick', x, y });
  }

  async drag(fromX: number, fromY: number, toX: number, toY: number, durationMs?: number): Promise<void> {
    await this._send({ cmd: 'drag', fromX, fromY, toX, toY, duration: durationMs });
  }

  async scroll(x: number, y: number, amount: number): Promise<void> {
    await this._send({ cmd: 'scroll', x, y, amount });
  }

  async keyTap(key: string, modifiers: string[] = []): Promise<void> {
    await this._send({ cmd: 'keyTap', key, modifiers });
  }

  async typeString(text: string, delayMs = 60): Promise<void> {
    await this._send({ cmd: 'typeString', text, delay: delayMs });
  }

  /**
   * Subtly nudges the mouse cursor near its current position by a few pixels,
   * simulating natural human hand tremor / hand resting on mouse during coding.
   */
  async nudgeSubtly(): Promise<void> {
    if (!this._ready) return;
    try {
      const pos = await this.getPosition();
      const dx = (Math.random() - 0.5) * 8;
      const dy = (Math.random() - 0.5) * 6;
      await this.moveTo(Math.round(pos.x + dx), Math.round(pos.y + dy), 120 + Math.random() * 80);
    } catch {
      // Ignored
    }
  }

  /**
   * Simulates a human glancing / moving cursor near a screen region (e.g. while thinking).
   */
  async wander(deltaXRange = 40, deltaYRange = 30): Promise<void> {
    if (!this._ready) return;
    try {
      const pos = await this.getPosition();
      const dx = (Math.random() - 0.5) * deltaXRange * 2;
      const dy = (Math.random() - 0.5) * deltaYRange * 2;
      await this.moveTo(Math.round(pos.x + dx), Math.round(pos.y + dy), 300 + Math.random() * 250);
    } catch {
      // Ignored
    }
  }
}
