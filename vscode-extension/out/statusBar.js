"use strict";
/**
 * TypeByAman — Status Bar Manager (VS Code)
 * Author: Aman Kumar | github.com/Amankr0075
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
exports.StatusBarManager = void 0;
const vscode = __importStar(require("vscode"));
class StatusBarManager {
    constructor() {
        this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.item.command = 'typebyaman.openPanel';
        this.item.tooltip = 'TypeByAman — Click to open control panel';
        this.setIdle();
        this.item.show();
    }
    update(status, charIndex, totalChars, delay) {
        const pct = totalChars > 0 ? Math.round((charIndex / totalChars) * 100) : 0;
        const icons = {
            idle: '$(keyboard)',
            typing: '$(sync~spin)',
            paused: '$(debug-pause)',
            done: '$(check)',
            error: '$(error)',
        };
        const labels = {
            idle: 'TypeByAman',
            typing: `Typing ${charIndex.toLocaleString()}/${totalChars.toLocaleString()} (${pct}%) · ${delay}ms`,
            paused: `Paused ${charIndex.toLocaleString()}/${totalChars.toLocaleString()} (${pct}%)`,
            done: `Done ${totalChars.toLocaleString()} chars`,
            error: 'TypeByAman Error',
        };
        const colors = {
            typing: new vscode.ThemeColor('statusBarItem.prominentForeground'),
            paused: new vscode.ThemeColor('statusBarItem.warningForeground'),
            done: new vscode.ThemeColor('testing.iconPassed'),
            error: new vscode.ThemeColor('statusBarItem.errorForeground'),
        };
        this.item.text = `${icons[status]} ${labels[status]}`;
        this.item.color = colors[status];
        if (status === 'idle' || status === 'done') {
            setTimeout(() => this.setIdle(), 4000);
        }
    }
    setIdle() {
        this.item.text = '$(keyboard) TypeByAman';
        this.item.color = undefined;
    }
    dispose() {
        this.item.dispose();
    }
}
exports.StatusBarManager = StatusBarManager;
//# sourceMappingURL=statusBar.js.map