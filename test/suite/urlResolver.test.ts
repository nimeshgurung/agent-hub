import * as assert from 'assert';
import { UrlResolver } from '../../src/services/UrlResolver';
import type { CatalogMetadata } from '../../src/models/types';

suite('UrlResolver Test Suite', () => {
  const resolver = new UrlResolver();

  test('should resolve GitLab URLs correctly', () => {
    const catalogMetadata: CatalogMetadata = {
      id: 'test',
      name: 'Test',
      description: 'Test catalog',
      author: { name: 'Test' },
      repository: {
        type: 'gitlab',
        url: 'https://gitlab.com/org/repo',
        branch: 'main',
      },
      license: 'MIT',
    };

    const artifact: any = {
      id: 'test-artifact',
      path: 'artifacts/test.md',
    };

    const url = resolver.resolveArtifactUrl(catalogMetadata, artifact);
    assert.strictEqual(
      url,
      'https://gitlab.com/org/repo/-/raw/main/artifacts/test.md'
    );
  });

  test('should resolve GitHub URLs correctly', () => {
    const catalogMetadata: CatalogMetadata = {
      id: 'test',
      name: 'Test',
      description: 'Test catalog',
      author: { name: 'Test' },
      repository: {
        type: 'github',
        url: 'https://github.com/org/repo',
        branch: 'main',
      },
      license: 'MIT',
    };

    const artifact: any = {
      id: 'test-artifact',
      path: 'artifacts/test.md',
    };

    const url = resolver.resolveArtifactUrl(catalogMetadata, artifact);
    assert.strictEqual(
      url,
      'https://raw.githubusercontent.com/org/repo/main/artifacts/test.md'
    );
  });

  test('should use default branch when not specified', () => {
    const catalogMetadata: CatalogMetadata = {
      id: 'test',
      name: 'Test',
      description: 'Test catalog',
      author: { name: 'Test' },
      repository: {
        type: 'github',
        url: 'https://github.com/org/repo',
      },
      license: 'MIT',
    };

    const artifact: any = {
      id: 'test-artifact',
      path: 'artifacts/test.md',
    };

    const url = resolver.resolveArtifactUrl(catalogMetadata, artifact);
    assert.ok(url.includes('/main/'));
  });

  test('should detect catalog URL type', () => {
    assert.strictEqual(
      resolver.getCatalogUrlType('https://gitlab.com/org/repo'),
      'gitlab'
    );
    assert.strictEqual(
      resolver.getCatalogUrlType('https://github.com/org/repo'),
      'github'
    );
    assert.strictEqual(
      resolver.getCatalogUrlType('https://example.com/catalog.json'),
      'generic'
    );
  });
});

