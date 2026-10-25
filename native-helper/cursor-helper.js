/**
 * TypeByAman — Native OS Cursor & Keyboard Helper
 * Author: Aman Kumar | github.com/Amankr0075
 *
 * Controls the REAL OS-level mouse cursor and keyboard using @nut-tree/nut-js.
 * Communicates with VS Code extension / Chrome extension via stdin/stdout JSON-RPC.
 *
 * Commands received on stdin (one JSON object per line):
 *   { "cmd": "moveTo",    "x": 500, "y": 300, "duration": 800 }
 *   { "cmd": "click",     "x": 500, "y": 300, "button": "left" }
 *   { "cmd": "doubleClick","x": 500, "y": 300 }
 *   { "cmd": "drag",      "fromX": 100, "fromY": 100, "toX": 400, "toY": 300, "duration": 600 }
 *   { "cmd": "scroll",    "x": 500, "y": 300, "amount": -3 }
 *   { "cmd": "keyTap",    "key": "a", "modifiers": ["control"] }
 *   { "cmd": "typeString","text": "hello world", "delay": 60 }
 *   { "cmd": "getPos" }   — returns { "x": ..., "y": ... }
 *   { "cmd": "ping" }     — returns { "pong": true }
 *
 * All responses are written to stdout as JSON lines:
 *   { "ok": true, "id": <id> }
 *   { "ok": false, "error": "...", "id": <id> }
 *
 * Anti-detection techniques applied:
 *  - All mouse movements use randomized bezier-curved paths (not straight lines)
 *  - Movement speed is non-uniform (ease-in-out with jitter)
 *  - Click timing includes random pre/post delays
 *  - Keyboard typing uses randomized per-key delays matching human cadence
 *  - No fixed intervals or patterns in movement timing
 */

'use strict';

const readline = require('readline');
const http = require('http');
let WebSocketServer;
try {
  WebSocketServer = require('ws').WebSocketServer;
} catch (_) {}

const PORT = parseInt(process.env.TBA_NATIVE_PORT || '9876', 10);

// ─── Load nut-js ─────────────────────────────────────────────────────────────

let mouse, keyboard, Key, Button, straightTo, Point, screen;

async function loadNutJs() {
  try {
    const nut = await import('@nut-tree-fork/nut-js');
    mouse    = nut.mouse;
    keyboard = nut.keyboard;
    Key      = nut.Key;
    Button   = nut.Button;
    screen   = nut.screen;

    // Configure nut-js for smooth, human-like speed
    mouse.config.autoDelayMs     = 0;   // we control delays ourselves
    mouse.config.mouseSpeed      = 1500; // pixels/sec baseline (we override per move)
    keyboard.config.autoDelayMs  = 0;   // we add our own per-key delays

    return true;
  } catch (err) {
    return false;
  }
}

// ─── Math Helpers ─────────────────────────────────────────────────────────────

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randf(min, max) {
  return Math.random() * (max - min) + min;
}

/**
 * Generate a curved path of (x, y) points from start to end using a
 * quadratic bezier with a randomized control point.
 * Returns an array of {x, y} waypoints.
 */
function bezierPath(x0, y0, x1, y1, steps) {
  const dist = Math.hypot(x1 - x0, y1 - y0);
  steps = steps ?? Math.max(12, Math.min(80, Math.floor(dist / 10)));

  // Control point: offset perpendicular to the line by up to 20% of distance
  const midX = (x0 + x1) / 2 + randf(-dist * 0.2, dist * 0.2);
  const midY = (y0 + y1) / 2 + randf(-dist * 0.2, dist * 0.2);

  const points = [];
  for (let s = 1; s <= steps; s++) {
    const t = s / steps;
    // Ease-in-out t
    const te = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    const x = Math.round(
      (1 - te) * (1 - te) * x0 + 2 * (1 - te) * te * midX + te * te * x1
      + randf(-1.2, 1.2)  // micro-jitter
    );
    const y = Math.round(
      (1 - te) * (1 - te) * y0 + 2 * (1 - te) * te * midY + te * te * y1
      + randf(-1.2, 1.2)
    );
    points.push({ x, y });
  }
  return points;
}

/**
 * Move the real OS cursor from current position to (toX, toY) along a
 * bezier curve over `durationMs` milliseconds.
 */
async function moveTo(toX, toY, durationMs) {
  durationMs = durationMs ?? rand(200, 600);
  const pos = await mouse.getPosition();
  const fromX = pos.x;
  const fromY = pos.y;

  const path = bezierPath(fromX, fromY, toX, toY);
  const stepMs = durationMs / path.length;

  for (const pt of path) {
    await mouse.setPosition({ x: pt.x, y: pt.y });
    // Non-uniform step timing — faster in middle, slower at start/end
    await sleep(Math.max(2, stepMs + randf(-stepMs * 0.4, stepMs * 0.4)));
  }

  // Final precision correction
  await mouse.setPosition({ x: toX, y: toY });
}

/**
 * Click at (x, y) with optional pre-move and human-realistic delays.
 */
async function click(x, y, button = 'left') {
  await moveTo(x, y, rand(150, 500));
  await sleep(rand(30, 120));  // pre-click hesitation
  const btn = button === 'right' ? Button.RIGHT : button === 'middle' ? Button.MIDDLE : Button.LEFT;
  await mouse.pressButton(btn);
  await sleep(rand(40, 130));  // hold duration
  await mouse.releaseButton(btn);
  await sleep(rand(30, 100));  // post-click
}

/**
 * Double-click at (x, y).
 */
async function doubleClick(x, y) {
  await click(x, y);
  await sleep(rand(60, 130));
  const btn = Button.LEFT;
  await mouse.pressButton(btn);
  await sleep(rand(30, 90));
  await mouse.releaseButton(btn);
  await sleep(rand(50, 120));
}

/**
 * Drag from (fromX, fromY) to (toX, toY).
 */
async function drag(fromX, fromY, toX, toY, durationMs) {
  durationMs = durationMs ?? rand(300, 800);
  await moveTo(fromX, fromY, rand(150, 400));
  await sleep(rand(60, 180));  // settle before grab

  await mouse.pressButton(Button.LEFT);
  await sleep(rand(40, 100));  // hold briefly

  // Drag along bezier path
  const path = bezierPath(fromX, fromY, toX, toY);
  const stepMs = durationMs / path.length;
  for (const pt of path) {
    await mouse.setPosition({ x: pt.x, y: pt.y });
    await sleep(Math.max(2, stepMs + randf(-stepMs * 0.3, stepMs * 0.3)));
  }

  await mouse.setPosition({ x: toX, y: toY });
  await sleep(rand(60, 160));
  await mouse.releaseButton(Button.LEFT);
  await sleep(rand(80, 200));
}

/**
 * Scroll at (x, y). Positive amount = down, negative = up.
 */
async function scroll(x, y, amount) {
  await moveTo(x, y, rand(100, 300));
  await sleep(rand(40, 100));
  // nut-js scroll: positive y = scroll down
  await mouse.scrollDown(Math.abs(amount));
  if (amount < 0) await mouse.scrollUp(Math.abs(amount));
  await sleep(rand(60, 150));
}

/**
 * Tap a keyboard key with optional modifiers.
 * modifier values: "control" | "shift" | "alt" | "meta"
 */
async function keyTap(key, modifiers = []) {
  const modMap = {
    'control': Key.LeftControl,
    'ctrl':    Key.LeftControl,
    'shift':   Key.LeftShift,
    'alt':     Key.LeftAlt,
    'meta':    Key.LeftSuper,
    'win':     Key.LeftSuper,
  };
  const keyMap = {
    'enter':    Key.Return,
    'escape':   Key.Escape,
    'tab':      Key.Tab,
    'backspace':Key.Backspace,
    'delete':   Key.Delete,
    'space':    Key.Space,
    'up':       Key.Up,
    'down':     Key.Down,
    'left':     Key.Left,
    'right':    Key.Right,
    'f1': Key.F1, 'f2': Key.F2, 'f3': Key.F3, 'f4': Key.F4,
    'f5': Key.F5, 'f6': Key.F6, 'f7': Key.F7, 'f8': Key.F8,
    'f9': Key.F9,'f10':Key.F10,'f11':Key.F11,'f12':Key.F12,
    's': Key.S, 'c': Key.C, 'v': Key.V, 'z': Key.Z, 'a': Key.A,
    'x': Key.X, 'r': Key.R, 'd': Key.D, 'f': Key.F, 'n': Key.N,
    'p': Key.P, 'w': Key.W, 't': Key.T, 'g': Key.G, 'b': Key.B,
    '=': Key.Equal, '-': Key.Minus, '[': Key.LeftBracket, ']': Key.RightBracket,
    '0': Key.Num0, '1': Key.Num1, '2': Key.Num2,
  };

  const mods = modifiers.map(m => modMap[m.toLowerCase()]).filter(Boolean);
  const k    = keyMap[key.toLowerCase()] ?? Key[key.toUpperCase()] ?? null;
  if (!k) return;

  if (mods.length > 0) {
    await keyboard.pressKey(...mods, k);
    await sleep(rand(30, 80));
    await keyboard.releaseKey(...mods, k);
  } else {
    await keyboard.pressKey(k);
    await sleep(rand(20, 60));
    await keyboard.releaseKey(k);
  }
  await sleep(rand(20, 60));
}

/**
 * Type a string character by character with human-realistic delays.
 * averageDelay is the base ms/char, with ±50% jitter applied.
 */
async function typeString(text, averageDelay = 60) {
  for (const ch of text) {
    // Map char to Key if possible, otherwise use keyboard.type
    try {
      await keyboard.type(ch);
    } catch (_) {
      // fallback: skip unmappable chars
    }
    // Human typing: occasional burst, occasional slow key
    const jitter = Math.random() < 0.05
      ? averageDelay * (2 + Math.random() * 2)   // rare long pause
      : averageDelay * (0.5 + Math.random());
    await sleep(Math.max(10, jitter));
  }
}

// ─── Sleep ────────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, Math.max(0, ms)));
}

// ─── JSON-RPC stdin/stdout Protocol ──────────────────────────────────────────

// ─── Command Dispatcher ───────────────────────────────────────────────────────

async function dispatchCommand(cmd, msg = {}) {
  let result = null;
  switch (cmd) {
    case 'ping':
      result = { pong: true };
      break;

    case 'getPos': {
      const pos = await mouse.getPosition();
      result = { x: pos.x, y: pos.y };
      break;
    }

    case 'moveTo':
      await moveTo(msg.x, msg.y, msg.duration);
      break;

    case 'click':
      await click(msg.x, msg.y, msg.button ?? 'left');
      break;

    case 'doubleClick':
      await doubleClick(msg.x, msg.y);
      break;

    case 'drag':
      await drag(msg.fromX, msg.fromY, msg.toX, msg.toY, msg.duration);
      break;

    case 'scroll':
      await scroll(msg.x, msg.y, msg.amount ?? -3);
      break;

    case 'keyTap':
      await keyTap(msg.key, msg.modifiers ?? []);
      break;

    case 'typeString':
      await typeString(msg.text ?? '', msg.delay ?? 60);
      break;

    default:
      throw new Error(`Unknown command: ${cmd}`);
  }
  return result;
}

// ─── HTTP & WebSocket Server ─────────────────────────────────────────────────

function startServer() {
  const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === 'GET' && (req.url === '/ping' || req.url === '/status')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, ready: true, version: '1.0.0' }));
      return;
    }

    if (req.method === 'POST' && (req.url === '/rpc' || req.url === '/')) {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const msg = JSON.parse(body);
          const result = await dispatchCommand(msg.cmd, msg);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, id: msg.id, ...(result ?? {}) }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: err.message, id: msg?.id }));
        }
      });
      return;
    }

    res.writeHead(404);
    res.end();
  });

  if (WebSocketServer) {
    const wss = new WebSocketServer({ server });
    wss.on('connection', ws => {
      ws.on('message', async data => {
        let msg;
        try {
          msg = JSON.parse(data.toString());
          const result = await dispatchCommand(msg.cmd, msg);
          ws.send(JSON.stringify({ ok: true, id: msg.id, ...(result ?? {}) }));
        } catch (err) {
          ws.send(JSON.stringify({ ok: false, error: err.message, id: msg?.id }));
        }
      });
    });
  }

  server.listen(PORT, '127.0.0.1', () => {
    process.stderr.write(`[TBA NativeHelper] HTTP/WebSocket server listening on http://127.0.0.1:${PORT}\n`);
  });

  server.on('error', err => {
    process.stderr.write(`[TBA NativeHelper] Server port error: ${err.message}\n`);
  });
}

// ─── JSON-RPC stdin/stdout Protocol ──────────────────────────────────────────

async function main() {
  const ready = await loadNutJs();
  if (!ready) {
    process.stdout.write(JSON.stringify({ ok: false, error: '@nut-tree-fork/nut-js not installed. Run: npm install' }) + '\n');
    process.exit(1);
  }

  // Start HTTP and WebSocket listener for browser extension
  startServer();

  // Signal ready to stdout for VS Code child process
  process.stdout.write(JSON.stringify({ ok: true, ready: true, version: '1.0.0' }) + '\n');

  const rl = readline.createInterface({ input: process.stdin });

  rl.on('line', async (line) => {
    let msg;
    try {
      msg = JSON.parse(line.trim());
    } catch {
      process.stdout.write(JSON.stringify({ ok: false, error: 'Invalid JSON' }) + '\n');
      return;
    }

    const id  = msg.id ?? null;
    const cmd = msg.cmd;

    try {
      const result = await dispatchCommand(cmd, msg);
      process.stdout.write(JSON.stringify({ ok: true, id, ...(result ?? {}) }) + '\n');
    } catch (err) {
      process.stdout.write(JSON.stringify({ ok: false, error: err.message, id }) + '\n');
    }
  });

  rl.on('close', () => {
    process.exit(0);
  });
}

main().catch(err => {
  process.stderr.write(`Fatal: ${err.message}\n`);
  process.exit(1);
});
