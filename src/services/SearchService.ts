import type { DatabaseService } from '../storage/Database';
import type {
  SearchQuery,
  SearchResult,
  ArtifactWithSource,
  ArtifactType,
} from '../models/types';
import type { ArtifactRow } from '../storage/types';

export class SearchService {
  constructor(private db: DatabaseService) {}

  search(query: SearchQuery): SearchResult {
    const page = query.page || 1;
    const pageSize = query.pageSize || 50;
    const offset = (page - 1) * pageSize;

    let artifacts: ArtifactWithSource[];
    let total: number;

    if (query.query) {
      // Full-text search
      const result = this.fullTextSearch(query, pageSize, offset);
      artifacts = result.artifacts;
      total = result.total;
    } else {
      // No query, just filter and sort
      const result = this.filterAndSort(query, pageSize, offset);
      artifacts = result.artifacts;
      total = result.total;
    }

    return {
      artifacts,
      total,
      page,
      pageSize,
      hasMore: offset + artifacts.length < total,
    };
  }

  private fullTextSearch(
    query: SearchQuery,
    limit: number,
    offset: number
  ): { artifacts: ArtifactWithSource[]; total: number } {
    const db = this.db.getDb();

    // Build FTS query
    const searchTerms = query.query!
      .split(/\s+/)
      .filter(t => t.length > 0)
      .map(t => `"${t}"*`)
      .join(' OR ');

    let sql = `
      SELECT a.* FROM artifacts a
      INNER JOIN artifacts_fts fts ON a.rowid = fts.rowid
      WHERE fts.artifacts_fts MATCH ?
    `;

    const params: unknown[] = [searchTerms];

    // Add filters
    const filterClause = this.buildFilterClause(query, params);
    if (filterClause) {
      sql += ` AND ${filterClause}`;
    }

    // Get total count
    const countSql = sql.replace('SELECT a.*', 'SELECT COUNT(*) as count');
    const countResult = db.prepare(countSql).get(...params) as { count: number };
    const total = countResult.count;

    // Add sorting and pagination
    sql += this.buildOrderClause(query);
    sql += ` LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const rows = db.prepare(sql).all(...params) as ArtifactRow[];
    const artifacts = rows.map(row => this.rowToArtifact(row));

    // Score and re-rank if using relevance sort
    if (!query.sortBy || query.sortBy === 'relevance') {
      this.scoreAndRank(artifacts, query.query!);
    }

    this.markInstalledFlag(artifacts);

    return { artifacts, total };
  }

  private filterAndSort(
    query: SearchQuery,
    limit: number,
    offset: number
  ): { artifacts: ArtifactWithSource[]; total: number } {
    const db = this.db.getDb();

    let sql = 'SELECT * FROM artifacts WHERE 1=1';
    const params: unknown[] = [];

    // Add filters
    const filterClause = this.buildFilterClause(query, params);
    if (filterClause) {
      sql += ` AND ${filterClause}`;
    }

    // Get total count
    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as count');
    const countResult = db.prepare(countSql).get(...params) as { count: number };
    const total = countResult.count;

    // Add sorting and pagination
    sql += this.buildOrderClause(query);
    sql += ` LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const rows = db.prepare(sql).all(...params) as ArtifactRow[];
    const artifacts = rows.map(row => this.rowToArtifact(row));

    this.markInstalledFlag(artifacts);

    return { artifacts, total };
  }

  private buildFilterClause(query: SearchQuery, params: unknown[]): string {
    const conditions: string[] = [];

    if (query.type && query.type.length > 0) {
      const placeholders = query.type.map(() => '?').join(',');
      conditions.push(`type IN (${placeholders})`);
      params.push(...query.type);
    }

    if (query.category && query.category.length > 0) {
      const placeholders = query.category.map(() => '?').join(',');
      conditions.push(`category IN (${placeholders})`);
      params.push(...query.category);
    }

    if (query.difficulty && query.difficulty.length > 0) {
      const placeholders = query.difficulty.map(() => '?').join(',');
      conditions.push(`difficulty IN (${placeholders})`);
      params.push(...query.difficulty);
    }

    if (query.catalog && query.catalog.length > 0) {
      const placeholders = query.catalog.map(() => '?').join(',');
      conditions.push(`catalog_id IN (${placeholders})`);
      params.push(...query.catalog);
    }

    // JSON array filters
    if (query.language && query.language.length > 0) {
      const langConditions = query.language.map(() => 'language LIKE ?');
      conditions.push(`(${langConditions.join(' OR ')})`);
      params.push(...query.language.map(l => `%"${l}"%`));
    }

    if (query.framework && query.framework.length > 0) {
      const fwConditions = query.framework.map(() => 'framework LIKE ?');
      conditions.push(`(${fwConditions.join(' OR ')})`);
      params.push(...query.framework.map(f => `%"${f}"%`));
    }

    if (query.tags && query.tags.length > 0) {
      const tagConditions = query.tags.map(() => 'tags LIKE ?');
      conditions.push(`(${tagConditions.join(' OR ')})`);
      params.push(...query.tags.map(t => `%"${t}"%`));
    }

    return conditions.join(' AND ');
  }

  private buildOrderClause(query: SearchQuery): string {
    switch (query.sortBy) {
      case 'rating':
        return " ORDER BY json_extract(metadata, '$.rating') DESC NULLS LAST";
      case 'downloads':
        return " ORDER BY json_extract(metadata, '$.downloads') DESC NULLS LAST";
      case 'updated':
        return " ORDER BY json_extract(metadata, '$.lastUpdated') DESC NULLS LAST";
      case 'relevance':
      default:
        return ' ORDER BY name ASC';
    }
  }

  private scoreAndRank(artifacts: ArtifactWithSource[], query: string): void {
    const queryLower = query.toLowerCase();
    const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 0);

    artifacts.forEach((artifact) => {
      let score = 0;

      // Exact name match: +10
      if (artifact.name.toLowerCase().includes(queryLower)) {
        score += 10;
      }

      // Tag matches: +5 per tag
      const tagMatches = artifact.tags.filter((tag: string) =>
        queryTerms.some(term => tag.toLowerCase().includes(term))
      );
      score += tagMatches.length * 5;

      // Description match: +3
      if (artifact.description.toLowerCase().includes(queryLower)) {
        score += 3;
      }

      // Keyword matches: +2 per keyword
      if (artifact.keywords) {
        const keywordMatches = artifact.keywords.filter((kw: string) =>
          queryTerms.some(term => kw.toLowerCase().includes(term))
        );
        score += keywordMatches.length * 2;
      }

      // Popularity boost
      if (artifact.metadata?.downloads) {
        score += Math.log10(artifact.metadata.downloads);
      }

      // Rating boost
      if (artifact.metadata?.rating) {
        score += artifact.metadata.rating;
      }

      // Recency boost
      if (artifact.metadata?.lastUpdated) {
        const daysSince = (Date.now() - new Date(artifact.metadata.lastUpdated).getTime()) / (1000 * 60 * 60 * 24);
        score += Math.max(0, 5 - daysSince / 30);
      }

      (artifact as ArtifactWithSource & { _score?: number })._score = score;
    });

    artifacts.sort((a, b) => {
      const scoreA = (a as ArtifactWithSource & { _score?: number })._score || 0;
      const scoreB = (b as ArtifactWithSource & { _score?: number })._score || 0;
      return scoreB - scoreA;
    });
  }

  private rowToArtifact(row: ArtifactRow): ArtifactWithSource {
    return {
      id: row.id,
      catalogId: row.catalog_id,
      type: row.type as ArtifactType,
      name: row.name,
      description: row.description,
      path: row.path,
      version: row.version,
      category: row.category,
      tags: JSON.parse(row.tags),
      keywords: JSON.parse(row.keywords),
      language: JSON.parse(row.language),
      framework: JSON.parse(row.framework),
      useCase: JSON.parse(row.use_case),
      difficulty: (row.difficulty as ArtifactWithSource['difficulty']) || undefined,
      sourceUrl: row.source_url,
      metadata: JSON.parse(row.metadata),
      author: JSON.parse(row.author),
      compatibility: JSON.parse(row.compatibility),
      dependencies: JSON.parse(row.dependencies),
      estimatedTime: row.estimated_time || undefined,
    };
  }

  private markInstalledFlag(artifacts: ArtifactWithSource[]): void {
    if (!artifacts.length) {
      return;
    }

    const db = this.db.getDb();
    const placeholders = artifacts.map(() => '(?, ?)').join(',');
    const params = artifacts.flatMap(artifact => [artifact.catalogId, artifact.id]);

    const rows = db.prepare(`
      SELECT catalog_id, artifact_id
      FROM installations
      WHERE (catalog_id, artifact_id) IN (${placeholders})
    `).all(...params) as { catalog_id: string; artifact_id: string }[];

    const installedSet = new Set(rows.map(row => `${row.catalog_id}:${row.artifact_id}`));

    artifacts.forEach(artifact => {
      artifact.installed = installedSet.has(`${artifact.catalogId}:${artifact.id}`);
    });
  }

  getArtifact(catalogId: string, artifactId: string): ArtifactWithSource | null {
    const row = this.db.getDb().prepare(
      'SELECT * FROM artifacts WHERE catalog_id = ? AND id = ?'
    ).get(catalogId, artifactId) as ArtifactRow | undefined;

    return row ? this.rowToArtifact(row) : null;
  }

  getAllCategories(): string[] {
    const rows = this.db.getDb().prepare(
      'SELECT DISTINCT category FROM artifacts ORDER BY category'
    ).all() as { category: string }[];

    return rows.map(r => r.category);
  }

  getAllTags(): string[] {
    const rows = this.db.getDb().prepare(
      'SELECT DISTINCT tags FROM artifacts'
    ).all() as { tags: string }[];

    const tagSet = new Set<string>();
    rows.forEach(row => {
      const tags = JSON.parse(row.tags) as string[];
      tags.forEach(tag => tagSet.add(tag));
    });

    return Array.from(tagSet).sort();
  }
}

