// Database row types for better-sqlite3 queries

export interface InstallationRow {
  id: number;
  artifact_id: string;
  catalog_id: string;
  version: string;
  installed_path: string;
  installed_at: string;
  last_used: string | null;
}

export interface CatalogRow {
  id: string;
  url: string;
  enabled: number; // SQLite stores boolean as 0/1
  metadata: string; // JSON string
  last_fetched: string | null;
  status: string;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface ArtifactRow {
  id: string;
  catalog_id: string;
  type: string;
  name: string;
  description: string;
  path: string;
  version: string;
  category: string;
  tags: string; // JSON string
  keywords: string; // JSON string
  language: string; // JSON string
  framework: string; // JSON string
  use_case: string; // JSON string
  difficulty: string | null;
  source_url: string;
  metadata: string; // JSON string
  author: string; // JSON string
  compatibility: string; // JSON string
  dependencies: string; // JSON string
  estimated_time: string | null;
  created_at: string;
  updated_at: string;
}

export interface CountResult {
  count: number;
}

