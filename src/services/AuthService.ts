import * as vscode from 'vscode';
import type { AuthConfig } from '../models/types';

export class AuthService {
  private static readonly SECRET_KEY_PREFIX = 'artifact-hub.auth';

  constructor(private context: vscode.ExtensionContext) {}

  private getSecretKey(repoId: string): string {
    return `${AuthService.SECRET_KEY_PREFIX}.${repoId}`;
  }

  async storeToken(repoId: string, token: string): Promise<void> {
    await this.context.secrets.store(this.getSecretKey(repoId), token);
  }

  async getToken(repoId: string): Promise<string | undefined> {
    return await this.context.secrets.get(this.getSecretKey(repoId));
  }

  async deleteToken(repoId: string): Promise<void> {
    await this.context.secrets.delete(this.getSecretKey(repoId));
  }

  async resolveAuth(repoId: string, auth?: AuthConfig): Promise<AuthConfig | undefined> {
    if (!auth || auth.type === 'none') {
      return undefined;
    }

    // Clone to avoid mutating original
    const resolved: AuthConfig = { ...auth };

    // Resolve token references
    if (auth.type === 'bearer' && auth.token) {
      // Check for secret reference: ${secret:key}
      const secretMatch = auth.token.match(/^\$\{secret:(.+)\}$/);
      if (secretMatch) {
        const secretKey = secretMatch[1];
        const storedToken = await this.getToken(secretKey);
        if (storedToken) {
          resolved.token = storedToken;
        }
      }
      // Check for environment variable: ${env:VAR}
      else if (auth.token.match(/^\$\{env:(.+)\}$/)) {
        // Leave as-is, HttpClient will resolve
      }
      // Otherwise use token directly
    }

    // For basic auth, check if password is a reference
    if (auth.type === 'basic' && auth.password) {
      const secretMatch = auth.password.match(/^\$\{secret:(.+)\}$/);
      if (secretMatch) {
        const secretKey = secretMatch[1];
        const storedPassword = await this.getToken(secretKey);
        if (storedPassword) {
          resolved.password = storedPassword;
        }
      }
    }

    return resolved;
  }

  async promptForToken(repoId: string, repoName: string): Promise<string | undefined> {
    const token = await vscode.window.showInputBox({
      prompt: `Enter access token for ${repoName}`,
      password: true,
      ignoreFocusOut: true,
    });

    if (token) {
      await this.storeToken(repoId, token);
    }

    return token;
  }
}

