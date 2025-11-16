import type Database from 'better-sqlite3';

/**
 * Initialize database schema
 * Note: This is an alpha version - breaking changes may occur.
 * Users should be prepared to reset their database.
 */
export function initializeSchema(db: Database.Database): void {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Create catalogs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS catalogs (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL UNIQUE,
      enabled INTEGER NOT NULL DEFAULT 1,
      metadata TEXT NOT NULL,
      last_fetched TEXT,
      status TEXT NOT NULL DEFAULT 'healthy',
      error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Create artifacts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS artifacts (
      id TEXT NOT NULL,
      catalog_id TEXT NOT NULL,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      path TEXT NOT NULL,
      version TEXT NOT NULL,
      category TEXT NOT NULL,
      tags TEXT,
      keywords TEXT,
      language TEXT,
      framework TEXT,
      use_case TEXT,
      difficulty TEXT,
      source_url TEXT NOT NULL,
      metadata TEXT,
      author TEXT,
      compatibility TEXT,
      dependencies TEXT,
      estimated_time TEXT,
      supporting_files TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (id, catalog_id),
      FOREIGN KEY (catalog_id) REFERENCES catalogs(id) ON DELETE CASCADE
    );
  `);

  // Create FTS5 virtual table for full-text search
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS artifacts_fts USING fts5(
      id UNINDEXED,
      catalog_id UNINDEXED,
      name,
      description,
      tags,
      keywords,
      category,
      content='artifacts',
      content_rowid='rowid'
    );
  `);

  // Create triggers to keep FTS in sync
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS artifacts_fts_insert AFTER INSERT ON artifacts BEGIN
      INSERT INTO artifacts_fts(rowid, id, catalog_id, name, description, tags, keywords, category)
      VALUES (new.rowid, new.id, new.catalog_id, new.name, new.description, new.tags, new.keywords, new.category);
    END;
  `);

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS artifacts_fts_delete AFTER DELETE ON artifacts BEGIN
      DELETE FROM artifacts_fts WHERE rowid = old.rowid;
    END;
  `);

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS artifacts_fts_update AFTER UPDATE ON artifacts BEGIN
      DELETE FROM artifacts_fts WHERE rowid = old.rowid;
      INSERT INTO artifacts_fts(rowid, id, catalog_id, name, description, tags, keywords, category)
      VALUES (new.rowid, new.id, new.catalog_id, new.name, new.description, new.tags, new.keywords, new.category);
    END;
  `);

  // Create installations table
  db.exec(`
    CREATE TABLE IF NOT EXISTS installations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      artifact_id TEXT NOT NULL,
      catalog_id TEXT NOT NULL,
      version TEXT NOT NULL,
      installed_path TEXT NOT NULL,
      installed_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_used TEXT,
      UNIQUE(artifact_id, catalog_id)
    );
  `);

  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_artifacts_catalog ON artifacts(catalog_id);
    CREATE INDEX IF NOT EXISTS idx_artifacts_type ON artifacts(type);
    CREATE INDEX IF NOT EXISTS idx_artifacts_category ON artifacts(category);
    CREATE INDEX IF NOT EXISTS idx_installations_artifact ON installations(artifact_id, catalog_id);
  `);
}

