import * as semver from 'semver';
import type {
  UpdateInfo,
  Installation,
  InstallationWithUpdate,
  CatalogRepoConfig,
  ArtifactWithSource,
} from '../models/types';
import type { DatabaseService } from '../storage/Database';
import type { InstallationRow } from '../storage/types';
import type { SearchService } from './SearchService';
import type { HttpClient } from './HttpClient';
import type { AuthService } from './AuthService';

type InstallationWithArtifactRow = InstallationRow & {
  name?: string;
  type?: string;
  description?: string;
  path?: string;
  category?: string;
  tags?: string;
  keywords?: string;
  language?: string;
  framework?: string;
  use_case?: string;
  difficulty?: string | null;
  source_url?: string;
  metadata?: string;
  author?: string;
  compatibility?: string;
  dependencies?: string;
  estimated_time?: string | null;
};

export class UpdateService {
  constructor(
    private db: DatabaseService,
    private searchService: SearchService,
    private http: HttpClient,
    private authService: AuthService
  ) {}

  async checkForUpdates(configs: CatalogRepoConfig[]): Promise<UpdateInfo[]> {
    const installations = this.db.getDb().prepare(`
      SELECT id, artifact_id, catalog_id, version, installed_path, installed_at, last_used
      FROM installations
    `).all() as InstallationRow[];

    const updates: UpdateInfo[] = [];

    for (const row of installations) {
      const installation: Installation = {
        id: row.id,
        artifactId: row.artifact_id,
        catalogId: row.catalog_id,
        version: row.version,
        installedPath: row.installed_path,
        installedAt: new Date(row.installed_at),
        lastUsed: row.last_used ? new Date(row.last_used) : null,
      };

      const artifact = this.searchService.getArtifact(
        installation.catalogId,
        installation.artifactId
      );

      if (artifact && this.isNewer(artifact.version, installation.version)) {
        const config = configs.find(c => c.id === installation.catalogId);
        const changelog = await this.fetchChangelog(artifact.sourceUrl, config);

        updates.push({
          installation,
          latestVersion: artifact.version,
          changelog,
        });
      }
    }

    return updates;
  }

  getInstallationsWithUpdates(updates: UpdateInfo[]): InstallationWithUpdate[] {
    const updateMap = new Map(
      updates.map(u => [`${u.installation.catalogId}:${u.installation.artifactId}`, u])
    );

    const installations = this.db.getDb().prepare(`
      SELECT
        i.id, i.artifact_id, i.catalog_id, i.version, i.installed_path, i.installed_at, i.last_used,
        a.*
      FROM installations i
      LEFT JOIN artifacts a ON i.catalog_id = a.catalog_id AND i.artifact_id = a.id
    `).all() as InstallationWithArtifactRow[];

    return installations.map(row => {
      const key = `${row.catalog_id}:${row.artifact_id}`;
      const update = updateMap.get(key);

      return {
        id: row.id,
        artifactId: row.artifact_id,
        catalogId: row.catalog_id,
        version: row.version,
        installedPath: row.installed_path,
        installedAt: new Date(row.installed_at),
        lastUsed: row.last_used ? new Date(row.last_used) : null,
        updateAvailable: !!update,
        newVersion: update?.latestVersion || null,
        artifact: row.name ? this.rowToArtifact(row) : null,
      };
    });
  }

  private isNewer(v1: string, v2: string): boolean {
    try {
      return semver.gt(v1, v2);
    } catch {
      // Fallback to string comparison if not valid semver
      return v1 > v2;
    }
  }

  private async fetchChangelog(
    sourceUrl: string,
    config?: CatalogRepoConfig
  ): Promise<string | undefined> {
    try {
      // Try to fetch CHANGELOG.md from same directory
      const changelogUrl = sourceUrl.replace(/[^/]+$/, 'CHANGELOG.md');
      const auth = config ? await this.authService.resolveAuth(config.id, config.auth) : undefined;
      const changelog = await this.http.fetchText(changelogUrl, { auth });

      // Extract relevant section (simplified)
      const lines = changelog.split('\n').slice(0, 20);
      return lines.join('\n');
    } catch {
      return undefined;
    }
  }

  private rowToArtifact(row: InstallationWithArtifactRow): ArtifactWithSource | null {
    if (!row.name || !row.type) {
      return null;
    }

    return {
      id: row.artifact_id,
      catalogId: row.catalog_id,
      type: row.type as ArtifactWithSource['type'],
      name: row.name,
      description: row.description || '',
      path: row.path || '',
      version: row.version,
      category: row.category || '',
      tags: row.tags ? JSON.parse(row.tags) : [],
      keywords: row.keywords ? JSON.parse(row.keywords) : [],
      language: row.language ? JSON.parse(row.language) : [],
      framework: row.framework ? JSON.parse(row.framework) : [],
      useCase: row.use_case ? JSON.parse(row.use_case) : [],
      difficulty: (row.difficulty as ArtifactWithSource['difficulty']) || undefined,
      sourceUrl: row.source_url || '',
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
      author: row.author ? JSON.parse(row.author) : undefined,
      compatibility: row.compatibility ? JSON.parse(row.compatibility) : undefined,
      dependencies: row.dependencies ? JSON.parse(row.dependencies) : [],
      estimatedTime: row.estimated_time || undefined,
    };
  }
}

