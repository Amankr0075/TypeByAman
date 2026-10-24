/**
 * TypeByAman — Status Bar Manager (VS Code)
 * Author: Aman Kumar | github.com/Amankr0075
 */

import * as vscode from 'vscode';

type Status = 'idle' | 'typing' | 'paused' | 'done' | 'error';

export class StatusBarManager implements vscode.Disposable {
  private item: vscode.StatusBarItem;
  private shareItem: vscode.StatusBarItem;
  private stealthMode: boolean = true;

  constructor() {
    this.stealthMode = vscode.workspace.getConfiguration('typebyaman').get<boolean>('stealthMode', true);

    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    this.item.command = 'typebyaman.openPanel';

    this.shareItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      99
    );
    this.shareItem.command = 'typebyaman.share';

    if (this.stealthMode) {
      // Undetectable Stealth Mode: Completely hidden from screen recordings
      this.item.hide();
      this.shareItem.hide();
    } else {
      this.item.tooltip = 'TypeByAman — Click to open control panel';
      this.setIdle();
      this.item.show();
      this.shareItem.text = '$(share) Share';
      this.shareItem.tooltip = 'Share TypeByAman & Setup Instructions';
      this.shareItem.show();
    }
  }

  setStealthMode(enabled: boolean): void {
    this.stealthMode = enabled;
    if (enabled) {
      this.item.hide();
      this.shareItem.hide();
    } else {
      this.setIdle();
      this.item.show();
      this.shareItem.show();
    }
  }

  update(
    status: Status,
    charIndex: number,
    totalChars: number,
    delay: number
  ): void {
    // In stealth mode, do not render any visible status text that could be captured on video recording
    if (this.stealthMode) {
      return;
    }

    const pct = totalChars > 0 ? Math.round((charIndex / totalChars) * 100) : 0;

    const icons: Record<Status, string> = {
      idle:   '$(keyboard)',
      typing: '$(sync~spin)',
      paused: '$(debug-pause)',
      done:   '$(check)',
      error:  '$(error)',
    };

    const labels: Record<Status, string> = {
      idle:   'TypeByAman',
      typing: `Typing ${charIndex.toLocaleString()}/${totalChars.toLocaleString()} (${pct}%) · ${delay}ms`,
      paused: `Paused ${charIndex.toLocaleString()}/${totalChars.toLocaleString()} (${pct}%)`,
      done:   `Done ${totalChars.toLocaleString()} chars`,
      error:  'TypeByAman Error',
    };

    const colors: Partial<Record<Status, vscode.ThemeColor>> = {
      typing: new vscode.ThemeColor('statusBarItem.prominentForeground'),
      paused: new vscode.ThemeColor('statusBarItem.warningForeground'),
      done:   new vscode.ThemeColor('testing.iconPassed'),
      error:  new vscode.ThemeColor('statusBarItem.errorForeground'),
    };

    this.item.text  = `${icons[status]} ${labels[status]}`;
    this.item.color = colors[status];

    if (status === 'idle' || status === 'done') {
      setTimeout(() => this.setIdle(), 4000);
    }
  }

  private setIdle(): void {
    if (this.stealthMode) return;
    this.item.text  = '$(keyboard) TypeByAman';
    this.item.color = undefined;
  }

  dispose(): void {
    this.item.dispose();
    this.shareItem.dispose();
  }
}
