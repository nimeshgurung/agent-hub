import type { ArtifactService } from './ArtifactService';
import type { SearchService } from './SearchService';
import type { Profile, CatalogRepoConfig } from '../models/types';

export class ProfileService {
  constructor(
    private artifactService: ArtifactService,
    private searchService: SearchService
  ) {}

  async installProfile(
    profile: Profile,
    installRoot: string,
    repoConfigs: CatalogRepoConfig[]
  ): Promise<{ success: number; failed: number; errors: string[] }> {
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const ref of profile.artifacts) {
      try {
        // Find artifact
        const artifact = this.searchService.getArtifact(ref.catalogId, ref.artifactId);

        if (!artifact) {
          throw new Error(`Artifact not found: ${ref.catalogId}/${ref.artifactId}`);
        }

        // Check version if specified
        if (ref.version && artifact.version !== ref.version) {
          console.warn(
            `Version mismatch for ${ref.artifactId}: requested ${ref.version}, found ${artifact.version}`
          );
        }

        // Find repo config for auth
        const repoConfig = repoConfigs.find(c => c.id === ref.catalogId);

        // Install artifact
        const result = await this.artifactService.install(artifact, installRoot, repoConfig);

        if (result.success) {
          success++;
        } else {
          failed++;
          errors.push(`${ref.artifactId}: ${result.error}`);
        }
      } catch (err) {
        failed++;
        const error = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`${ref.artifactId}: ${error}`);
      }
    }

    return { success, failed, errors };
  }

  createProfile(name: string, description: string, installations: Array<{ catalogId: string; artifactId: string; version: string }>): Profile {
    return {
      id: name.toLowerCase().replace(/\s+/g, '-'),
      name,
      description,
      version: '1.0.0',
      artifacts: installations.map(i => ({
        catalogId: i.catalogId,
        artifactId: i.artifactId,
        version: i.version,
      })),
    };
  }
}

