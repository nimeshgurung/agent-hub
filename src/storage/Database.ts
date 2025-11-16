import Database from 'better-sqlite3';
import * as path from 'path';
import * as vscode from 'vscode';
import { initializeSchema } from './migrations';

export class DatabaseService {
  private db: Database.Database | null = null;
  private dbPath: string;

  constructor(context: vscode.ExtensionContext) {
    this.dbPath = path.join(context.globalStorageUri.fsPath, 'artifacts.db');
  }

  async initialize(): Promise<void> {
    // Ensure directory exists
    const dbDir = path.dirname(this.dbPath);
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(dbDir));

    // Open database
    this.db = new Database(this.dbPath);

    // Initialize schema
    initializeSchema(this.db);
  }

  getDb(): Database.Database {
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.db;
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  // Transaction helper
  transaction<T>(fn: (db: Database.Database) => T): T {
    const db = this.getDb();
    const transaction = db.transaction(fn);
    return transaction(db);
  }
}

