"use strict";
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
exports.NativeCursorBridge = void 0;
const cp = __importStar(require("child_process"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
class NativeCursorBridge {
    constructor() {
        this._proc = null;
        this._pending = new Map();
        this._idCounter = 0;
        this._buffer = '';
        this._ready = false;
    }
    static getInstance() {
        if (!NativeCursorBridge._instance) {
            NativeCursorBridge._instance = new NativeCursorBridge();
        }
        return NativeCursorBridge._instance;
    }
    // ─── Lifecycle ──────────────────────────────────────────────────────────────
    async start(extensionPath) {
        if (this._proc && this._ready)
            return; // already running
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
                    windowsHide: true, // no console window flashes on Windows
                });
            }
            catch (e) {
                return reject(e);
            }
            this._proc.stdout.setEncoding('utf8');
            this._proc.stdout.on('data', (data) => this._handleData(data));
            this._proc.stderr.on('data', (err) => {
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
            this._handleData = (data) => {
                origHandle(data);
                if (this._ready) {
                    clearTimeout(readyTimeout);
                    this._handleData = origHandle; // restore
                    resolve();
                }
            };
        });
    }
    stop() {
        if (this._proc) {
            this._proc.kill();
            this._proc = null;
        }
        this._ready = false;
        this._pending.clear();
    }
    get isReady() { return this._ready; }
    // ─── Data handling ──────────────────────────────────────────────────────────
    _handleData(data) {
        this._buffer += data;
        const lines = this._buffer.split('\n');
        this._buffer = lines.pop() ?? '';
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed)
                continue;
            try {
                const msg = JSON.parse(trimmed);
                if (msg.ready) {
                    this._ready = true;
                }
                if (msg.id !== undefined) {
                    const pending = this._pending.get(msg.id);
                    if (pending) {
                        this._pending.delete(msg.id);
                        if (msg.ok) {
                            pending.resolve(msg);
                        }
                        else {
                            pending.reject(new Error(msg.error ?? 'Unknown error from native helper'));
                        }
                    }
                }
            }
            catch (_) { }
        }
    }
    // ─── RPC Send ───────────────────────────────────────────────────────────────
    _send(payload) {
        if (!this._proc || !this._ready) {
            return Promise.reject(new Error('Native cursor bridge not started'));
        }
        const id = ++this._idCounter;
        return new Promise((resolve, reject) => {
            this._pending.set(id, { resolve, reject });
            this._proc.stdin.write(JSON.stringify({ ...payload, id }) + '\n');
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
    async ping() {
        try {
            const r = await this._send({ cmd: 'ping' });
            return r.ok;
        }
        catch {
            return false;
        }
    }
    async getPosition() {
        const r = await this._send({ cmd: 'getPos' });
        return { x: r.x, y: r.y };
    }
    async moveTo(x, y, durationMs) {
        await this._send({ cmd: 'moveTo', x, y, duration: durationMs });
    }
    async click(x, y, button = 'left') {
        await this._send({ cmd: 'click', x, y, button });
    }
    async doubleClick(x, y) {
        await this._send({ cmd: 'doubleClick', x, y });
    }
    async drag(fromX, fromY, toX, toY, durationMs) {
        await this._send({ cmd: 'drag', fromX, fromY, toX, toY, duration: durationMs });
    }
    async scroll(x, y, amount) {
        await this._send({ cmd: 'scroll', x, y, amount });
    }
    async keyTap(key, modifiers = []) {
        await this._send({ cmd: 'keyTap', key, modifiers });
    }
    async typeString(text, delayMs = 60) {
        await this._send({ cmd: 'typeString', text, delay: delayMs });
    }
    /**
     * Subtly nudges the mouse cursor near its current position by a few pixels,
     * simulating natural human hand tremor / hand resting on mouse during coding.
     */
    async nudgeSubtly() {
        if (!this._ready)
            return;
        try {
            const pos = await this.getPosition();
            const dx = (Math.random() - 0.5) * 8;
            const dy = (Math.random() - 0.5) * 6;
            await this.moveTo(Math.round(pos.x + dx), Math.round(pos.y + dy), 120 + Math.random() * 80);
        }
        catch {
            // Ignored
        }
    }
    /**
     * Simulates a human glancing / moving cursor near a screen region (e.g. while thinking).
     */
    async wander(deltaXRange = 40, deltaYRange = 30) {
        if (!this._ready)
            return;
        try {
            const pos = await this.getPosition();
            const dx = (Math.random() - 0.5) * deltaXRange * 2;
            const dy = (Math.random() - 0.5) * deltaYRange * 2;
            await this.moveTo(Math.round(pos.x + dx), Math.round(pos.y + dy), 300 + Math.random() * 250);
        }
        catch {
            // Ignored
        }
    }
}
exports.NativeCursorBridge = NativeCursorBridge;
NativeCursorBridge._instance = null;
//# sourceMappingURL=nativeCursorBridge.js.map