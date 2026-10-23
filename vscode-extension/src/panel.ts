/**
 * TypeByAman — WebView Panel (VS Code)
 * Author: Aman Kumar | github.com/Amankr0075
 *
 * Premium webview control panel with the same design language
 * as the Chrome extension popup.
 */

import * as vscode from 'vscode';

type PanelCommandHandler = (msg: { command: string; payload?: unknown }) => void;

export class TypeByAmanPanel {
  public static currentPanel: TypeByAmanPanel | undefined;
  private static _commandHandler: PanelCommandHandler | null = null;

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  // ─── Factory ──────────────────────────────────────────────────────────────

  public static createOrShow(
    extensionUri: vscode.Uri,
    commandHandler: PanelCommandHandler
  ): void {
    TypeByAmanPanel._commandHandler = commandHandler;

    if (TypeByAmanPanel.currentPanel) {
      TypeByAmanPanel.currentPanel._panel.reveal(vscode.ViewColumn.Beside);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'typebyaman',
      'TypeByAman',
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      {
        enableScripts:          true,
        retainContextWhenHidden: true,
        localResourceRoots:     [vscode.Uri.joinPath(extensionUri, 'assets')],
      }
    );

    TypeByAmanPanel.currentPanel = new TypeByAmanPanel(panel, extensionUri);
  }

  public static postMessage(msg: unknown): void {
    TypeByAmanPanel.currentPanel?._panel.webview.postMessage(msg);
  }

  // ─── Constructor ──────────────────────────────────────────────────────────

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel        = panel;
    this._extensionUri = extensionUri;

    this._panel.webview.html = this._getHtml();
    this._panel.iconPath     = vscode.Uri.joinPath(extensionUri, 'assets', 'icon48.png');

    // Handle messages from webview
    this._panel.webview.onDidReceiveMessage(
      msg => TypeByAmanPanel._commandHandler?.(msg),
      null,
      this._disposables
    );

    // Cleanup on close
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
  }

  dispose(): void {
    TypeByAmanPanel.currentPanel = undefined;
    this._panel.dispose();
    this._disposables.forEach(d => d.dispose());
    this._disposables = [];
  }

  // ─── HTML ──────────────────────────────────────────────────────────────────

  private _getHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'unsafe-inline';">
  <title>TypeByAman</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet"/>
  <style>
    :root {
      --bg:       #0d0f1a;
      --bg2:      #12152a;
      --bg3:      rgba(255,255,255,0.04);
      --bg3h:     rgba(255,255,255,0.07);
      --bgin:     rgba(255,255,255,0.05);
      --bdr:      rgba(255,255,255,0.08);
      --bdr2:     rgba(79,142,247,0.5);
      --t1:       #e8ecf4;
      --t2:       #8b92a8;
      --t3:       #555f7a;
      --tc:       #a3b4d9;
      --blue:     #4f8ef7;
      --purple:   #a855f7;
      --green:    #22d3a0;
      --red:      #f75c5c;
      --orange:   #f7a44f;
      --grad:     linear-gradient(135deg,#4f8ef7,#a855f7);
      --gradh:    linear-gradient(90deg,#4f8ef7,#a855f7);
      --font:     'Inter',-apple-system,BlinkMacSystemFont,sans-serif;
      --mono:     'JetBrains Mono','Fira Code',monospace;
      --r:        8px;
      --tr:       all 0.18s cubic-bezier(.4,0,.2,1);
    }
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    html{font-size:13px;}
    body{font-family:var(--font);background:var(--bg);color:var(--t1);padding:16px;-webkit-font-smoothing:antialiased;scrollbar-width:thin;scrollbar-color:var(--bdr) transparent;}
    body::-webkit-scrollbar{width:4px;}
    body::-webkit-scrollbar-thumb{background:var(--bdr);border-radius:2px;}

    /* Header */
    .hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;}
    .brand{display:flex;align-items:center;gap:10px;}
    .brand-ico{width:36px;height:36px;background:var(--bg3);border:1px solid var(--bdr);border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
    .brand-name{font-size:11px;font-weight:700;letter-spacing:2px;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;display:block;}
    .brand-tag{font-size:9px;color:var(--t3);letter-spacing:.5px;display:block;}

    /* Status bar */
    .sbar{display:flex;align-items:center;gap:0;padding:8px 10px;background:var(--bg3);border:1px solid var(--bdr);border-radius:var(--r);margin-bottom:8px;overflow-x:auto;scrollbar-width:none;}
    .sbar::-webkit-scrollbar{display:none;}
    .si{display:flex;flex-direction:column;gap:1px;padding:0 8px;flex-shrink:0;}
    .si:first-child{padding-left:0;}
    .sl{font-size:9px;font-weight:600;color:var(--t3);text-transform:uppercase;letter-spacing:.8px;}
    .sv{font-size:11px;font-weight:600;font-family:var(--mono);color:var(--t1);white-space:nowrap;}
    .sdv{width:1px;height:26px;background:var(--bdr);flex-shrink:0;}
    .badge{display:inline-block;padding:1px 6px;border-radius:20px;font-size:9.5px;font-weight:600;}
    .idle{background:rgba(139,146,168,.15);color:var(--t2);}
    .typing{background:rgba(79,142,247,.15);color:var(--blue);}
    .paused{background:rgba(247,164,79,.15);color:var(--orange);}
    .done{background:rgba(34,211,160,.15);color:var(--green);}
    .error{background:rgba(247,92,92,.15);color:var(--red);}

    /* Progress */
    .prog{height:4px;background:var(--bdr);border-radius:2px;margin-bottom:12px;overflow:hidden;}
    .prog-fill{height:100%;background:var(--gradh);border-radius:2px;transition:width .3s ease;}

    /* Sections */
    .sec{margin-bottom:12px;}
    .sec-lbl{font-size:10px;font-weight:600;color:var(--t2);text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px;display:block;}

    /* Textarea */
    .ta{width:100%;min-height:140px;max-height:300px;padding:10px 12px;background:var(--bgin);border:1px solid var(--bdr);border-radius:var(--r);color:var(--tc);font-family:var(--mono);font-size:11.5px;line-height:1.6;resize:vertical;outline:none;transition:var(--tr);tab-size:2;white-space:pre;overflow-x:auto;scrollbar-width:thin;scrollbar-color:var(--bdr) transparent;}
    .ta:focus{border-color:var(--bdr2);background:rgba(255,255,255,.07);}
    .ta::placeholder{color:var(--t3);font-family:var(--font);font-size:11px;white-space:pre-wrap;}
    .ta-info{font-size:9px;color:var(--t3);font-family:var(--mono);text-align:right;margin-top:3px;}

    /* Input actions */
    .lrow{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;}
    .iacts{display:flex;gap:4px;}
    .mbtn{display:flex;align-items:center;gap:4px;padding:4px 8px;border:1px solid var(--bdr);border-radius:5px;background:var(--bg3);color:var(--t2);font-family:var(--font);font-size:10px;font-weight:500;cursor:pointer;transition:var(--tr);}
    .mbtn:hover{border-color:var(--blue);color:var(--blue);background:rgba(79,142,247,.08);}

    /* Speed card */
    .speed-card{background:var(--bg3);border:1px solid var(--bdr);border-radius:var(--r);padding:12px;margin-bottom:12px;}
    .speed-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;}
    .speed-disp{display:flex;align-items:baseline;gap:3px;}
    #sdv{font-size:20px;font-weight:700;font-family:var(--mono);background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
    .su{font-size:9px;color:var(--t3);font-weight:500;}

    /* Presets */
    .presets{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-bottom:8px;}
    .pb{padding:6px 4px;border:1px solid var(--bdr);border-radius:5px;background:var(--bgin);color:var(--t2);font-family:var(--font);font-size:10px;font-weight:500;cursor:pointer;transition:var(--tr);text-align:center;}
    .pb:hover{border-color:var(--blue);color:var(--blue);background:rgba(79,142,247,.08);}
    .pb.active{border-color:var(--blue);background:rgba(79,142,247,.15);color:var(--blue);font-weight:600;}

    /* Slider */
    .sl-row{margin-bottom:6px;}
    .sldr{width:100%;height:4px;background:var(--bdr);border-radius:2px;appearance:none;-webkit-appearance:none;outline:none;cursor:pointer;}
    .sldr::-webkit-slider-thumb{appearance:none;-webkit-appearance:none;width:16px;height:16px;border-radius:50%;background:var(--grad);cursor:pointer;box-shadow:0 0 6px rgba(79,142,247,.4);}

    /* Chips */
    .chips{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;}
    .chip{padding:2px 6px;border:1px solid var(--bdr);border-radius:20px;background:var(--bg3);color:var(--t3);font-family:var(--mono);font-size:9px;font-weight:500;cursor:pointer;transition:var(--tr);}
    .chip:hover{border-color:var(--purple);color:var(--purple);background:rgba(168,85,247,.08);}
    .chip.active{border-color:var(--purple);background:rgba(168,85,247,.15);color:var(--purple);}

    /* Number input */
    .num{padding:5px 8px;background:var(--bgin);border:1px solid var(--bdr);border-radius:5px;color:var(--t1);font-family:var(--mono);font-size:12px;font-weight:500;outline:none;transition:var(--tr);width:90px;}
    .num:focus{border-color:var(--bdr2);}
    .num-row{display:flex;align-items:center;gap:8px;margin-top:6px;border-top:1px solid var(--bdr);padding-top:6px;}
    .micro-lbl{font-size:9.5px;color:var(--t3);white-space:nowrap;}

    /* Controls */
    .ctrl-row{display:flex;gap:4px;}
    .cb{display:flex;align-items:center;justify-content:center;gap:4px;flex:1;padding:8px 4px;border:1px solid var(--bdr);border-radius:5px;background:var(--bg3);color:var(--t2);font-family:var(--font);font-size:10px;font-weight:600;cursor:pointer;transition:var(--tr);}
    .cb:hover:not(:disabled){border-color:var(--blue);color:var(--blue);background:rgba(79,142,247,.1);}
    .cb.prim{border-color:rgba(79,142,247,.4);background:rgba(79,142,247,.12);color:var(--blue);}
    .cb.prim:hover:not(:disabled){background:var(--grad);color:#fff;border-color:transparent;box-shadow:0 4px 12px rgba(79,142,247,.3);}
    .cb.dng{border-color:rgba(247,92,92,.3);background:rgba(247,92,92,.08);color:var(--red);}
    .cb.dng:hover:not(:disabled){background:rgba(247,92,92,.18);border-color:var(--red);}
    .cb:disabled{opacity:.3;cursor:not-allowed;}
    .cb svg{flex-shrink:0;}

    /* Shortcuts */
    .shcts{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;}
    .shct{font-size:9px;color:var(--t3);display:flex;align-items:center;gap:3px;}
    kbd{display:inline-block;padding:1px 4px;background:var(--bg3);border:1px solid var(--bdr);border-radius:3px;font-size:8.5px;color:var(--t2);}

    /* Message */
    .msg{padding:8px 10px;border-radius:var(--r);border:1px solid var(--bdr);background:var(--bg3);margin-top:10px;display:none;font-size:11px;color:var(--t2);line-height:1.5;}
    .msg.err{border-color:rgba(247,92,92,.3);background:rgba(247,92,92,.06);color:var(--red);}
    .msg.ok{border-color:rgba(34,211,160,.3);background:rgba(34,211,160,.06);color:var(--green);}
    .msg.warn{border-color:rgba(247,164,79,.3);background:rgba(247,164,79,.06);color:var(--orange);}

    /* About */
    .about{text-align:center;padding:16px 0 8px;}
    .about-title{font-size:16px;font-weight:700;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin-bottom:2px;}
    .about-tag{font-size:10px;color:var(--t2);font-style:italic;margin-bottom:8px;}
    .abadges{display:flex;flex-wrap:wrap;justify-content:center;gap:4px;margin-bottom:10px;}
    .ab{padding:2px 8px;border-radius:20px;font-size:9px;font-weight:600;border:1px solid var(--bdr);background:var(--bg3);color:var(--t2);}
    .ab.g{border-color:rgba(34,211,160,.3);background:rgba(34,211,160,.08);color:var(--green);}
    .ab.b{border-color:rgba(79,142,247,.3);background:rgba(79,142,247,.08);color:var(--blue);}
    .ab.p{border-color:rgba(168,85,247,.3);background:rgba(168,85,247,.08);color:var(--purple);}
    .about-row{display:flex;gap:8px;text-align:left;margin-bottom:6px;align-items:flex-start;}
    .akey{font-size:9.5px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.5px;min-width:64px;flex-shrink:0;padding-top:1px;}
    .aval{font-size:11px;color:var(--t2);line-height:1.4;}
    .alink{font-size:11px;color:var(--blue);text-decoration:none;}
    .alink:hover{text-decoration:underline;}
    .adiv{height:1px;background:var(--bdr);margin:10px 0;}

    /* Tabs */
    .tabs{display:flex;gap:3px;margin-bottom:12px;padding:3px;background:var(--bg3);border:1px solid var(--bdr);border-radius:var(--r);}
    .tb{flex:1;padding:5px;border:none;border-radius:5px;background:transparent;color:var(--t2);font-family:var(--font);font-size:11px;font-weight:500;cursor:pointer;transition:var(--tr);}
    .tb.active{background:var(--grad);color:#fff;font-weight:600;}
    .tb:hover:not(.active){color:var(--t1);background:var(--bg3h);}

    @keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
    .spin{animation:spin 1s linear infinite;display:inline-block;}
  </style>
</head>
<body>
  <!-- Header -->
  <div class="hdr">
    <div class="brand">
      <div class="brand-ico">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <rect x="2" y="6" width="20" height="13" rx="2" stroke="url(#pg)" stroke-width="1.8" fill="none"/>
          <path d="M6 10h2M10 10h1M13 10h1M16 10h2M6 13h1M9 13h6M17 13h1M8 16h8" stroke="url(#pg)" stroke-width="1.5" stroke-linecap="round"/>
          <path d="M12 2v2" stroke="url(#pg)" stroke-width="1.5" stroke-linecap="round"/>
          <defs><linearGradient id="pg" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#4f8ef7"/><stop offset="100%" stop-color="#a855f7"/></linearGradient></defs>
        </svg>
      </div>
      <div>
        <span class="brand-name">TYPEBYAMAN</span>
        <span class="brand-tag">Type. Replay. Create.</span>
      </div>
    </div>
    <button class="mbtn" id="btn-share-panel" title="Share TypeByAman & Setup Instructions" style="font-size:11px;padding:4px 8px;gap:5px;display:flex;align-items:center">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
      </svg>
      Share
    </button>
  </div>

  <!-- Tabs -->
  <div class="tabs" role="tablist">
    <button class="tb active" data-tab="editor" role="tab" aria-selected="true">Editor</button>
    <button class="tb" data-tab="about" role="tab" aria-selected="false">About</button>
  </div>

  <!-- Editor Panel -->
  <div id="panel-editor">

    <!-- Status Bar -->
    <div class="sbar" aria-live="polite">
      <div class="si"><span class="sl">Chars</span><span class="sv" id="vchars">0 / 0</span></div>
      <div class="sdv"></div>
      <div class="si"><span class="sl">Progress</span><span class="sv" id="vprog">0%</span></div>
      <div class="sdv"></div>
      <div class="si"><span class="sl">Speed</span><span class="sv" id="vspeed">50 ms</span></div>
      <div class="sdv"></div>
      <div class="si"><span class="sl">Status</span><span class="sv"><span class="badge idle" id="vstat">Idle</span></span></div>
    </div>

    <!-- Progress Bar -->
    <div class="prog" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100" id="pbar">
      <div class="prog-fill" id="pfill" style="width:0%"></div>
    </div>

    <!-- Text Input -->
    <div class="sec">
      <div class="lrow">
        <span class="sec-lbl">Source Text / Code</span>
        <div class="iacts">
          <button class="mbtn" id="btn-paste" title="Paste from clipboard">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>
            Paste
          </button>
          <button class="mbtn" id="btn-clear-ta" title="Clear text">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
            Clear
          </button>
        </div>
      </div>
      <textarea id="ta" class="ta"
        placeholder="Paste your text or source code here...&#10;&#10;Supports:&#10;• Multiline code  • Indentation&#10;• Unicode chars   • Special chars&#10;• Large files     • Any language"
        spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="off"
        aria-label="Input text to type"></textarea>
      <div class="ta-info" id="ta-info">0 characters</div>
    </div>

    <!-- Speed Card -->
    <div class="speed-card">
      <div class="speed-hdr">
        <span class="sec-lbl" style="margin:0">Typing Speed</span>
        <div class="speed-disp">
          <span id="sdv">50</span>
          <span class="su">ms/char</span>
        </div>
      </div>
      <div class="presets" role="group">
        <button class="pb" data-delay="1000">Very Slow</button>
        <button class="pb" data-delay="250">Slow</button>
        <button class="pb active" data-delay="50">Normal</button>
        <button class="pb" data-delay="20">Fast</button>
        <button class="pb" data-delay="5">Very Fast</button>
        <button class="pb" data-delay="custom" id="btn-custom">Custom</button>
      </div>
      <div id="custom-panel" style="display:none">
        <div class="sl-row">
          <input type="range" id="speed-slider" class="sldr" min="1" max="2000" value="50"/>
        </div>
        <div class="chips">
          <button class="chip" data-delay="10">10ms</button>
          <button class="chip" data-delay="20">20ms</button>
          <button class="chip" data-delay="30">30ms</button>
          <button class="chip" data-delay="50">50ms</button>
          <button class="chip" data-delay="100">100ms</button>
          <button class="chip" data-delay="250">250ms</button>
          <button class="chip" data-delay="500">500ms</button>
          <button class="chip" data-delay="1000">1000ms</button>
          <button class="chip" data-delay="2000">2000ms</button>
        </div>
        <div class="num-row">
          <span class="micro-lbl">Custom (ms):</span>
          <input type="number" id="custom-num" class="num" min="1" max="9999" value="50"/>
        </div>
      </div>
      <div class="num-row">
        <span class="micro-lbl">Line-break extra (ms):</span>
        <input type="number" id="lb-delay" class="num" min="0" max="9999" value="0" style="width:80px"/>
      </div>
      <div class="num-row">
        <span class="micro-lbl">Start delay (ms):</span>
        <input type="number" id="st-delay" class="num" min="0" max="9999" value="0" style="width:80px"/>
      </div>
    </div>

    <!-- Controls -->
    <div class="ctrl-row" style="margin-bottom:8px">
      <button class="cb prim" id="btn-start" aria-label="Start typing (Alt+Shift+S)">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>Start
      </button>
      <button class="cb" id="btn-pause" disabled aria-label="Pause (Alt+Shift+P)">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>Pause
      </button>
      <button class="cb" id="btn-resume" disabled aria-label="Resume">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>Resume
      </button>
      <button class="cb dng" id="btn-stop" disabled aria-label="Stop (Alt+Shift+X)">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>Stop
      </button>
      <button class="cb" id="btn-restart" disabled aria-label="Restart">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg>Restart
      </button>
    </div>

    <div class="shcts">
      <span class="shct"><kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd> Start</span>
      <span class="shct"><kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> Pause</span>
      <span class="shct"><kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>X</kbd> Stop</span>
    </div>

    <div class="msg" id="msg-area"></div>
  </div>

  <!-- About Panel -->
  <div id="panel-about" style="display:none">
    <div class="about">
      <div class="about-title">TypeByAman</div>
      <div class="about-tag">Type. Replay. Create.</div>
      <div class="abadges">
        <span class="ab g">100% Free</span>
        <span class="ab b">Unlimited Use</span>
        <span class="ab p">Local Processing</span>
        <span class="ab">No Subscription</span>
        <span class="ab">No Account Required</span>
      </div>
      <div class="adiv"></div>
      <div class="about-row"><span class="akey">Created by</span><span class="aval">Aman Kumar</span></div>
      <div class="about-row"><span class="akey">GitHub</span><a class="alink" href="https://github.com/Amankr0075" target="_blank" rel="noopener">github.com/Amankr0075</a></div>
      <div class="about-row"><span class="akey">Repository</span><a class="alink" href="https://github.com/Amankr0075/TypeByAman" target="_blank" rel="noopener">github.com/Amankr0075/TypeByAman</a></div>
      <div class="about-row"><span class="akey">Privacy</span><span class="aval">All data stays local — no servers, no tracking</span></div>
      <div class="about-row"><span class="akey">License</span><span class="aval">MIT — Free to use &amp; modify</span></div>
      <div class="adiv"></div>
      <div class="aval" style="font-size:11px;color:var(--t2);text-align:left">TypeByAman is a local typing/replay utility that gradually reproduces text or source code in your VS Code editor — perfect for coding demos, tutorials, and screen recordings.</div>
      <div style="margin-top:14px">
        <button class="cb prim" id="btn-about-share" style="width:100%;padding:8px;font-size:11px;gap:6px">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
          Share TypeByAman &amp; Setup Guide
        </button>
      </div>
    </div>
  </div>

  <script>
    (function() {
      'use strict';
      const vscode = acquireVsCodeApi();
      let state = { delay: 50, lbDelay: 0, stDelay: 0, status: 'idle', charIndex: 0, total: 0 };

      const $ = id => document.getElementById(id);
      const els = {
        tabs:        document.querySelectorAll('.tb'),
        panelEditor: $('panel-editor'),
        panelAbout:  $('panel-about'),
        vchars:      $('vchars'),
        vprog:       $('vprog'),
        vspeed:      $('vspeed'),
        vstat:       $('vstat'),
        pfill:       $('pfill'),
        pbar:        $('pbar'),
        ta:          $('ta'),
        taInfo:      $('ta-info'),
        sdv:         $('sdv'),
        presets:     document.querySelectorAll('.pb'),
        customPanel: $('custom-panel'),
        slider:      $('speed-slider'),
        chips:       document.querySelectorAll('.chip'),
        customNum:   $('custom-num'),
        lbDelay:     $('lb-delay'),
        stDelay:     $('st-delay'),
        btnStart:    $('btn-start'),
        btnPause:    $('btn-pause'),
        btnResume:   $('btn-resume'),
        btnStop:     $('btn-stop'),
        btnRestart:  $('btn-restart'),
        msgArea:     $('msg-area'),
        btnPaste:    $('btn-paste'),
        btnClear:    $('btn-clear-ta'),
      };

      // Tabs
      els.tabs.forEach(tab => {
        tab.addEventListener('click', () => {
          els.tabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected','false'); });
          tab.classList.add('active'); tab.setAttribute('aria-selected','true');
          const t = tab.dataset.tab;
          els.panelEditor.style.display = t === 'editor' ? 'block' : 'none';
          els.panelAbout.style.display  = t === 'about'  ? 'block' : 'none';
        });
      });

      // Textarea
      els.ta.addEventListener('input', () => {
        const len = els.ta.value.length;
        els.taInfo.textContent = len.toLocaleString() + ' character' + (len !== 1 ? 's' : '');
        state.total = len;
      });

      els.ta.addEventListener('keydown', e => {
        if (e.key === 'Tab') {
          e.preventDefault();
          const s = e.target.selectionStart, end = e.target.selectionEnd;
          e.target.value = e.target.value.substring(0,s)+'\t'+e.target.value.substring(end);
          e.target.selectionStart = e.target.selectionEnd = s+1;
          els.ta.dispatchEvent(new Event('input'));
        }
      });

      // Paste / Clear
      els.btnPaste.addEventListener('click', async () => {
        vscode.postMessage({ command: 'pasteFromClipboard' });
      });
      els.btnClear.addEventListener('click', () => {
        els.ta.value = ''; els.ta.dispatchEvent(new Event('input')); hideMsg();
      });

      // Speed
      function applyDelay(d, save=true) {
        d = Math.max(1, Math.min(9999, parseInt(d)||50));
        state.delay = d;
        els.sdv.textContent = d;
        els.vspeed.textContent = d + ' ms';
        els.slider.value = Math.min(d, 2000);
        els.customNum.value = d;
        els.presets.forEach(b => b.classList.toggle('active', parseInt(b.dataset.delay)===d));
        els.chips.forEach(c => c.classList.toggle('active', parseInt(c.dataset.delay)===d));
        if (save) vscode.postMessage({ command: 'updateDelay', payload: { delay: d } });
      }

      els.presets.forEach(btn => {
        btn.addEventListener('click', () => {
          if (btn.dataset.delay === 'custom') {
            els.presets.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            els.customPanel.style.display = 'block';
          } else {
            els.customPanel.style.display = 'none';
            applyDelay(parseInt(btn.dataset.delay));
          }
        });
      });
      els.slider.addEventListener('input', () => applyDelay(parseInt(els.slider.value)));
      els.chips.forEach(c => c.addEventListener('click', () => applyDelay(parseInt(c.dataset.delay))));
      els.customNum.addEventListener('change', () => applyDelay(parseInt(els.customNum.value)));

      // Controls
      els.btnStart.addEventListener('click', () => {
        const text = els.ta.value;
        if (!text.trim()) { showMsg('Please enter some text or code.', 'err'); return; }
        vscode.postMessage({ command:'start', payload:{
          text, delay:state.delay,
          lineBreakDelay:parseInt(els.lbDelay.value)||0,
          startDelay:parseInt(els.stDelay.value)||0
        }});
      });
      els.btnPause.addEventListener('click', () => vscode.postMessage({ command:'pause' }));
      els.btnResume.addEventListener('click', () => vscode.postMessage({ command:'resume', payload:{delay:state.delay} }));
      els.btnStop.addEventListener('click', () => vscode.postMessage({ command:'stop' }));
      els.btnRestart.addEventListener('click', () => {
        const text = els.ta.value;
        if (!text.trim()) { showMsg('Please enter some text or code.', 'err'); return; }
        vscode.postMessage({ command:'restart', payload:{
          text, delay:state.delay,
          lineBreakDelay:parseInt(els.lbDelay.value)||0,
          startDelay:parseInt(els.stDelay.value)||0
        }});
      });

      $('btn-share-panel')?.addEventListener('click', () => vscode.postMessage({ command: 'share' }));
      $('btn-about-share')?.addEventListener('click', () => vscode.postMessage({ command: 'share' }));

      // Receive messages from extension
      window.addEventListener('message', e => {
        const msg = e.data;
        if (msg.command === 'statusUpdate') {
          updateUI(msg.status, msg.charIndex, msg.totalChars, msg.delay);
        }
        if (msg.command === 'pasteText' && msg.text) {
          els.ta.value = msg.text;
          els.ta.dispatchEvent(new Event('input'));
        }
      });

      function updateUI(status, charIndex, totalChars, delay) {
        state = { ...state, status, charIndex: charIndex||0, total: totalChars||0 };
        if (delay !== undefined) applyDelay(delay, false);

        const pct = totalChars > 0 ? Math.round((charIndex/totalChars)*100) : 0;
        els.vchars.textContent = (charIndex||0).toLocaleString() + ' / ' + (totalChars||0).toLocaleString();
        els.vprog.textContent = pct + '%';
        els.pfill.style.width = pct + '%';
        els.pbar.setAttribute('aria-valuenow', pct);
        els.vstat.textContent = status.charAt(0).toUpperCase() + status.slice(1);
        els.vstat.className = 'badge ' + status;

        const idle   = status === 'idle' || status === 'done' || status === 'error';
        const typing = status === 'typing';
        const paused = status === 'paused';

        els.btnStart.disabled   = typing || paused;
        els.btnPause.disabled   = !typing;
        els.btnResume.disabled  = !paused;
        els.btnStop.disabled    = idle;
        els.btnRestart.disabled = idle && charIndex === 0;

        if (status === 'done') showMsg('✓ Typing complete!', 'ok');
        if (status === 'error') showMsg('An error occurred.', 'err');
      }

      function showMsg(text, type) {
        els.msgArea.textContent = text;
        els.msgArea.className = 'msg ' + (type||'');
        els.msgArea.style.display = 'block';
      }
      function hideMsg() { els.msgArea.style.display = 'none'; }

      applyDelay(50, false);
    })();
  </script>
</body>
</html>`;
  }
}
