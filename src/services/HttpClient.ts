import type { AuthConfig } from '../models/types';
import { RETRY_CONFIG } from '../config/constants';

export interface FetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  auth?: AuthConfig;
}

export class HttpClient {
  private async resolveAuthToken(auth: AuthConfig): Promise<string | null> {
    if (!auth || auth.type === 'none') {
      return null;
    }

    if (auth.type === 'bearer' && auth.token) {
      // Check for environment variable reference
      const envMatch = auth.token.match(/^\$\{env:(\w+)\}$/);
      if (envMatch) {
        return process.env[envMatch[1]] || null;
      }
      return auth.token;
    }

    if (auth.type === 'basic' && auth.username && auth.password) {
      const encoded = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
      return encoded;
    }

    return null;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(), ms);
    });
  }

  async fetch(url: string, options: FetchOptions = {}): Promise<Response> {
    const headers: Record<string, string> = {
      'User-Agent': 'ArtifactHub/0.1.0',
      'Accept': 'application/json, text/plain, */*',
      ...options.headers,
    };

    // Add authentication
    if (options.auth) {
      const token = await this.resolveAuthToken(options.auth);
      if (token) {
        if (options.auth.type === 'bearer') {
          headers['Authorization'] = `Bearer ${token}`;
        } else if (options.auth.type === 'basic') {
          headers['Authorization'] = `Basic ${token}`;
        }
      }
    }

    // Retry logic with exponential backoff
    let lastError: Error | null = null;
    let delay: number = RETRY_CONFIG.INITIAL_DELAY;

    for (let attempt = 0; attempt <= RETRY_CONFIG.MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(url, {
          method: options.method || 'GET',
          headers,
          body: options.body,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response;
      } catch (err) {
        lastError = err as Error;

        // Don't retry on client errors (4xx)
        if (err instanceof Error && err.message.match(/HTTP 4\d{2}/)) {
          throw err;
        }

        // Retry on network errors and 5xx
        if (attempt < RETRY_CONFIG.MAX_RETRIES) {
          await this.sleep(delay);
          delay = Math.min(delay * RETRY_CONFIG.BACKOFF_MULTIPLIER, RETRY_CONFIG.MAX_DELAY);
        }
      }
    }

    throw lastError || new Error('Failed to fetch after retries');
  }

  async fetchJson<T>(url: string, options: FetchOptions = {}): Promise<T> {
    const response = await this.fetch(url, options);
    return response.json() as Promise<T>;
  }

  async fetchText(url: string, options: FetchOptions = {}): Promise<string> {
    const response = await this.fetch(url, options);
    return response.text();
  }

  async testConnection(url: string, auth?: AuthConfig): Promise<{ success: boolean; error?: string }> {
    try {
      await this.fetch(url, { method: 'HEAD', auth });
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }
}

