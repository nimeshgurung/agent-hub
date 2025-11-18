import * as vscode from 'vscode';

export class StatusBarService {
  private statusBarItem: vscode.StatusBarItem;
  private artifactCount: number = 0;
  private updateCount: number = 0;

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.statusBarItem.command = 'agent-hub.viewInstalled';
    this.statusBarItem.show();
    this.update();
  }

  setArtifactCount(count: number): void {
    this.artifactCount = count;
    this.update();
  }

  setUpdateCount(count: number): void {
    this.updateCount = count;
    this.update();
  }

  private update(): void {
    let text = `$(package) ${this.artifactCount}`;

    if (this.updateCount > 0) {
      text += ` $(sync~spin) ${this.updateCount}`;
      this.statusBarItem.tooltip = `${this.artifactCount} artifacts installed, ${this.updateCount} updates available`;
    } else {
      this.statusBarItem.tooltip = `${this.artifactCount} artifacts installed`;
    }

    this.statusBarItem.text = text;
  }

  dispose(): void {
    this.statusBarItem.dispose();
  }
}

