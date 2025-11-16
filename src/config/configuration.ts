import * as vscode from 'vscode';
import { CONFIG_KEYS, DEFAULTS } from './constants';
import type { CatalogRepoConfig } from '../models/types';

export class Configuration {
  private config: vscode.WorkspaceConfiguration;

  constructor() {
    this.config = vscode.workspace.getConfiguration();
  }

  refresh(): void {
    this.config = vscode.workspace.getConfiguration();
  }

  getRepositories(): CatalogRepoConfig[] {
    return this.config.get<CatalogRepoConfig[]>(CONFIG_KEYS.REPOSITORIES, []);
  }

  async setRepositories(repos: CatalogRepoConfig[]): Promise<void> {
    await this.config.update(
      CONFIG_KEYS.REPOSITORIES,
      repos,
      vscode.ConfigurationTarget.Global
    );
    this.refresh();
  }

  getAutoUpdate(): boolean {
    return this.config.get<boolean>(CONFIG_KEYS.AUTO_UPDATE, DEFAULTS.AUTO_UPDATE);
  }

  async setAutoUpdate(enabled: boolean): Promise<void> {
    await this.config.update(
      CONFIG_KEYS.AUTO_UPDATE,
      enabled,
      vscode.ConfigurationTarget.Global
    );
    this.refresh();
  }

  getUpdateInterval(): number {
    return this.config.get<number>(CONFIG_KEYS.UPDATE_INTERVAL, DEFAULTS.UPDATE_INTERVAL);
  }

  async setUpdateInterval(seconds: number): Promise<void> {
    await this.config.update(
      CONFIG_KEYS.UPDATE_INTERVAL,
      seconds,
      vscode.ConfigurationTarget.Global
    );
    this.refresh();
  }

  getInstallRoot(): string {
    return this.config.get<string>(CONFIG_KEYS.INSTALL_ROOT, DEFAULTS.INSTALL_ROOT);
  }

  async setInstallRoot(root: string): Promise<void> {
    await this.config.update(
      CONFIG_KEYS.INSTALL_ROOT,
      root,
      vscode.ConfigurationTarget.Workspace
    );
    this.refresh();
  }
}

