"use strict";
/**
 * TypeByAman — VS Code Extension Entry Point
 * Author: Aman Kumar | github.com/Amankr0075
 *
 * Provides commands for typing/replaying text in the active editor.
 * All processing is local — no servers, no tracking, no data collection.
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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const typingEngine_1 = require("./typingEngine");
const panel_1 = require("./panel");
const statusBar_1 = require("./statusBar");
// ─── Extension State ─────────────────────────────────────────────────────────
let engine = null;
let statusBar = null;
// ─── Activate ────────────────────────────────────────────────────────────────
function activate(context) {
    // Status bar
    statusBar = new statusBar_1.StatusBarManager();
    context.subscriptions.push(statusBar);
    // Register all commands
    const commands = [
        ['typebyaman.start', cmdStart],
        ['typebyaman.pause', cmdPause],
        ['typebyaman.resume', cmdResume],
        ['typebyaman.stop', cmdStop],
        ['typebyaman.restart', cmdRestart],
        ['typebyaman.configureSpeed', cmdConfigureSpeed],
        ['typebyaman.openPanel', () => panel_1.TypeByAmanPanel.createOrShow(context.extensionUri, onPanelCommand)],
        ['typebyaman.share', cmdShare],
    ];
    for (const [cmd, handler] of commands) {
        context.subscriptions.push(vscode.commands.registerCommand(cmd, handler));
    }
    // Configuration change listener — update delay if active
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('typebyaman') && engine?.isActive()) {
            const cfg = getConfig();
            engine.updateDelay(cfg.characterDelay);
        }
    }));
    console.log('TypeByAman: activated');
}
// ─── Deactivate ──────────────────────────────────────────────────────────────
function deactivate() {
    engine?.stop();
    statusBar?.dispose();
}
// ─── Panel Command Handler ────────────────────────────────────────────────────
function onPanelCommand(msg) {
    switch (msg.command) {
        case 'start':
            cmdStart(msg.payload);
            break;
        case 'pause':
            cmdPause();
            break;
        case 'resume':
            cmdResume(msg.payload);
            break;
        case 'stop':
            cmdStop();
            break;
        case 'restart':
            cmdRestart();
            break;
        case 'updateDelay':
            engine?.updateDelay(msg.payload.delay);
            break;
        case 'configureSpeed':
            cmdConfigureSpeed();
            break;
        case 'share':
            cmdShare();
            break;
    }
}
function getConfig() {
    const cfg = vscode.workspace.getConfiguration('typebyaman');
    let delay = cfg.get('characterDelay', 50);
    // Apply preset if not Custom
    const preset = cfg.get('speedPreset', 'Normal');
    const presetMap = {
        'Very Slow': 1000,
        'Slow': 250,
        'Normal': 50,
        'Fast': 20,
        'Very Fast': 5,
    };
    if (preset !== 'Custom' && preset in presetMap) {
        delay = presetMap[preset];
    }
    return {
        characterDelay: Math.max(1, delay),
        lineBreakDelay: Math.max(0, cfg.get('lineBreakDelay', 0)),
        startDelay: Math.max(0, cfg.get('startDelay', 0)),
        speedPreset: preset,
    };
}
async function cmdStart(payload) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('TypeByAman: No active editor. Open a file first.');
        return;
    }
    // If already typing, stop first
    if (engine?.isActive()) {
        engine.stop();
        await sleep(100);
    }
    const cfg = getConfig();
    const delay = payload?.delay ?? cfg.characterDelay;
    const lineBreakDelay = payload?.lineBreakDelay ?? cfg.lineBreakDelay;
    const startDelay = payload?.startDelay ?? cfg.startDelay;
    // Text: from payload, or ask user, or use clipboard
    let text = payload?.text;
    if (!text) {
        const source = await vscode.window.showQuickPick(['Use current editor content', 'Paste from clipboard', 'Enter text manually'], { placeHolder: 'TypeByAman: Choose text source' });
        if (!source)
            return;
        if (source === 'Use current editor content') {
            text = editor.document.getText();
            // Clear editor and re-type
            await editor.edit(editBuilder => {
                const fullRange = new vscode.Range(editor.document.positionAt(0), editor.document.positionAt(editor.document.getText().length));
                editBuilder.delete(fullRange);
            });
        }
        else if (source === 'Paste from clipboard') {
            text = await vscode.env.clipboard.readText();
            if (!text) {
                vscode.window.showWarningMessage('TypeByAman: Clipboard is empty.');
                return;
            }
        }
        else {
            // Manual entry via input box
            text = await vscode.window.showInputBox({
                prompt: 'TypeByAman: Enter text to type',
                placeHolder: 'Enter your text here...',
            });
            if (!text)
                return;
        }
    }
    if (!text) {
        vscode.window.showWarningMessage('TypeByAman: No text to type.');
        return;
    }
    // Create engine
    engine = new typingEngine_1.TypingEngine({
        text,
        editor,
        delay,
        lineBreakDelay,
        startDelay,
        onProgress: (charIndex, totalChars) => {
            statusBar?.update('typing', charIndex, totalChars, delay);
            panel_1.TypeByAmanPanel.postMessage({
                command: 'statusUpdate',
                status: 'typing',
                charIndex,
                totalChars,
                delay,
            });
        },
        onPause: (charIndex, totalChars) => {
            statusBar?.update('paused', charIndex, totalChars, delay);
            panel_1.TypeByAmanPanel.postMessage({ command: 'statusUpdate', status: 'paused', charIndex, totalChars, delay });
        },
        onDone: (totalChars) => {
            statusBar?.update('done', totalChars, totalChars, delay);
            panel_1.TypeByAmanPanel.postMessage({ command: 'statusUpdate', status: 'done', charIndex: totalChars, totalChars, delay });
        },
        onError: (err, charIndex) => {
            statusBar?.update('error', charIndex, text.length, delay);
            panel_1.TypeByAmanPanel.postMessage({ command: 'statusUpdate', status: 'error', charIndex, totalChars: text.length, delay });
            vscode.window.showErrorMessage(`TypeByAman: ${err.message}`);
        },
        onStop: (charIndex) => {
            statusBar?.update('idle', charIndex, text.length, delay);
            panel_1.TypeByAmanPanel.postMessage({ command: 'statusUpdate', status: 'idle', charIndex, totalChars: text.length, delay });
        },
    });
    statusBar?.update('typing', 0, text.length, delay);
    panel_1.TypeByAmanPanel.postMessage({ command: 'statusUpdate', status: 'typing', charIndex: 0, totalChars: text.length, delay });
    engine.start();
}
function cmdPause() {
    if (!engine?.isActive()) {
        vscode.window.setStatusBarMessage('TypeByAman: Nothing is typing.', 2000);
        return;
    }
    engine.pause();
}
function cmdResume(payload) {
    if (!engine?.isPaused()) {
        vscode.window.setStatusBarMessage('TypeByAman: Not paused.', 2000);
        return;
    }
    if (payload?.delay !== undefined) {
        engine.updateDelay(payload.delay);
    }
    engine.resume();
}
function cmdStop() {
    if (!engine) {
        vscode.window.setStatusBarMessage('TypeByAman: Nothing to stop.', 2000);
        return;
    }
    engine.stop();
    engine = null;
}
function cmdRestart() {
    if (!engine) {
        cmdStart();
        return;
    }
    const prev = engine.getConfig();
    engine.stop();
    engine = null;
    setTimeout(() => cmdStart({
        text: prev.text,
        delay: prev.delay,
        lineBreakDelay: prev.lineBreakDelay,
        startDelay: prev.startDelay,
    }), 150);
}
async function cmdConfigureSpeed() {
    const items = [
        { label: '$(zap) Very Slow', description: '1000 ms/char', delay: 1000 },
        { label: '$(arrow-down) Slow', description: '250 ms/char', delay: 250 },
        { label: '$(dash) Normal', description: '50 ms/char', delay: 50 },
        { label: '$(arrow-up) Fast', description: '20 ms/char', delay: 20 },
        { label: '$(flame) Very Fast', description: '5 ms/char', delay: 5 },
        { label: '$(settings-gear) Custom…', description: 'Enter a custom delay', delay: -1 },
    ];
    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'TypeByAman: Select typing speed',
    });
    if (!selected)
        return;
    let delay = selected.delay;
    if (delay === -1) {
        const input = await vscode.window.showInputBox({
            prompt: 'TypeByAman: Enter character delay in milliseconds',
            value: String(getConfig().characterDelay),
            validateInput: v => {
                const n = parseInt(v);
                if (isNaN(n) || n < 1)
                    return 'Please enter a positive number';
                return null;
            },
        });
        if (!input)
            return;
        delay = parseInt(input);
    }
    // Update VS Code settings
    await vscode.workspace.getConfiguration('typebyaman').update('characterDelay', delay, vscode.ConfigurationTarget.Global);
    await vscode.workspace.getConfiguration('typebyaman').update('speedPreset', 'Custom', vscode.ConfigurationTarget.Global);
    // Apply immediately if typing
    if (engine?.isActive()) {
        engine.updateDelay(delay);
    }
    vscode.window.setStatusBarMessage(`TypeByAman: Speed set to ${delay} ms/char`, 2500);
}
// ─── Utility ──────────────────────────────────────────────────────────────────
async function cmdShare() {
    const shareText = `🚀 TypeByAman — The Ultimate Human-Like Typing & Code Replay Tool
Created by Aman Kumar | https://github.com/Amankr0075/TypeByAman

Replay source code and text character-by-character with natural human typing variations, automatic typo self-correction, and full editor support.

📦 Setup Instructions:

🌐 Chrome Extension:
1. Download or clone: https://github.com/Amankr0075/TypeByAman
2. Open Chrome and navigate to: chrome://extensions/
3. Turn ON "Developer mode" in the top-right corner
4. Click "Load unpacked" and select the "chrome-extension" folder
5. Shortcut: Press Alt+Shift+S in any input or editor to start typing!

💻 VS Code Extension:
1. Search "TypeByAman" in the VS Code Marketplace, OR install the VSIX from:
   https://github.com/Amankr0075/TypeByAman/releases
2. Press Alt+Shift+S to start typing or Alt+Shift+T for the Control Panel

⭐ GitHub Repository & Documentation:
https://github.com/Amankr0075/TypeByAman`;
    await vscode.env.clipboard.writeText(shareText);
    const action = await vscode.window.showInformationMessage('TypeByAman: Share link & setup instructions copied to clipboard!', 'Open GitHub Repo');
    if (action === 'Open GitHub Repo') {
        vscode.env.openExternal(vscode.Uri.parse('https://github.com/Amankr0075/TypeByAman'));
    }
}
function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}
//# sourceMappingURL=extension.js.map