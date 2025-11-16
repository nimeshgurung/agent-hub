import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import type { ArtifactService } from '../services/ArtifactService';
import type { UpdateService } from '../services/UpdateService';
import type { WebviewMessage } from './common/ipc';
import { Configuration } from '../config/configuration';

export class InstalledViewProvider implements vscode.WebviewViewProvider {
  private webviewView?: vscode.WebviewView;

  constructor(
    private context: vscode.ExtensionContext,
    private artifactService: ArtifactService,
    private updateService: UpdateService,
    private config: Configuration
  ) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void | Thenable<void> {
    this.webviewView = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.file(path.join(this.context.extensionPath, 'media')),
        vscode.Uri.file(path.join(this.context.extensionPath, 'dist', 'webview')),
      ],
    };

    webviewView.webview.html = this.getHtmlContent(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (message: WebviewMessage) => {
      try {
        await this.handleMessage(message, webviewView.webview);
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Unknown error';
        webviewView.webview.postMessage({ type: 'error', message: error });
        vscode.window.showErrorMessage(error);
      }
    });
  }

  public async refreshInstalled() {
    if (this.webviewView) {
      const configs = this.config.getRepositories();
      const updates = await this.updateService.checkForUpdates(configs);
      const artifacts = this.updateService.getInstallationsWithUpdates(updates);
      this.webviewView.webview.postMessage({ type: 'installedArtifacts', artifacts });
    }
  }

  private async handleMessage(message: WebviewMessage, webview: vscode.Webview): Promise<void> {
    switch (message.type) {
      case 'getInstalled': {
        const configs = this.config.getRepositories();
        const updates = await this.updateService.checkForUpdates(configs);
        const artifacts = this.updateService.getInstallationsWithUpdates(updates);

        webview.postMessage({ type: 'installedArtifacts', artifacts });
        break;
      }

      case 'uninstall': {
        await this.artifactService.uninstall(message.catalogId, message.artifactId);

        // Refresh list
        const configs = this.config.getRepositories();
        const updates = await this.updateService.checkForUpdates(configs);
        const artifacts = this.updateService.getInstallationsWithUpdates(updates);
        webview.postMessage({ type: 'installedArtifacts', artifacts });
        break;
      }

      case 'update': {
        const installRoot = this.config.getInstallRoot();
        const repos = this.config.getRepositories();
        const repoConfig = repos.find(r => r.id === message.catalogId);

        const result = await this.artifactService.update(
          message.catalogId,
          message.artifactId,
          installRoot,
          repoConfig
        );

        if (result.success) {
          vscode.window.showInformationMessage(`Updated ${message.artifactId}`);
        } else {
          vscode.window.showErrorMessage(`Failed to update: ${result.error}`);
        }

        // Refresh list
        const configs = this.config.getRepositories();
        const updates = await this.updateService.checkForUpdates(configs);
        const artifacts = this.updateService.getInstallationsWithUpdates(updates);
        webview.postMessage({ type: 'installedArtifacts', artifacts });
        break;
      }
    }
  }

  private getHtmlContent(webview: vscode.Webview): string {
    const htmlPath = path.join(this.context.extensionPath, 'media', 'installed.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');

    const scriptUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(this.context.extensionPath, 'dist', 'webview', 'installed.js'))
    );
    const cssUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'styles.css'))
    );

    return htmlContent
      .replace(/{{scriptUri}}/g, scriptUri.toString())
      .replace(/{{cssUri}}/g, cssUri.toString())
      .replace(/{{cspSource}}/g, webview.cspSource);
  }
}

