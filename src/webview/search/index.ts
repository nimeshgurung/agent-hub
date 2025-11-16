import type { WebviewMessage, ExtensionMessage } from '../common/ipc';
import type { SearchQuery, SearchResult, ArtifactWithSource } from '../../models/types';

const vscode = acquireVsCodeApi();

type DisplayArtifact = ArtifactWithSource & { installed?: boolean };

let currentResult: SearchResult | null = null;
let currentQuery: SearchQuery = { page: 1, pageSize: 50 };
let aggregatedArtifacts: DisplayArtifact[] = [];
let totalAvailableResults = 0;

// DOM Elements
let searchInput: HTMLInputElement;
let typeFilters: HTMLElement;
let resultsContainer: HTMLElement;
let loadMoreBtn: HTMLButtonElement;
let resultsHeader: HTMLElement;
let addRepositoryButton: HTMLButtonElement;

function init() {
  searchInput = document.getElementById('searchInput') as HTMLInputElement;
  typeFilters = document.getElementById('typeFilters') as HTMLElement;
  resultsContainer = document.getElementById('resultsContainer') as HTMLElement;
  loadMoreBtn = document.getElementById('loadMore') as HTMLButtonElement;
  resultsHeader = document.getElementById('resultsHeader') as HTMLElement;
  addRepositoryButton = document.getElementById('addRepository') as HTMLButtonElement;

  // Event listeners
  searchInput.addEventListener('input', debounce(handleSearch, 300));

  typeFilters.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', handleSearch);
  });

  loadMoreBtn.addEventListener('click', handleLoadMore);
  addRepositoryButton.addEventListener('click', () => {
    sendMessage({ type: 'openAddRepository' });
  });

  // Initial search
  handleSearch();
}

function handleSearch() {
  const query = searchInput.value.trim();

  const selectedTypes: string[] = [];
  typeFilters.querySelectorAll('input[type="checkbox"]:checked').forEach((cb: any) => {
    selectedTypes.push(cb.value);
  });

  currentQuery = {
    query: query || undefined,
    type: selectedTypes.length > 0 ? selectedTypes as any : undefined,
    page: 1,
    pageSize: 50,
  };

  resultsContainer.innerHTML = '<div class="loading">Loading...</div>';
  aggregatedArtifacts = [];
  totalAvailableResults = 0;
  sendMessage({ type: 'search', query: currentQuery });
}

function handleLoadMore() {
  if (!currentResult || !currentResult.hasMore) return;

  currentQuery.page = (currentQuery.page || 1) + 1;
  sendMessage({ type: 'search', query: currentQuery });
}

function renderResults(result: SearchResult, append: boolean = false) {
  totalAvailableResults = result.total;

  if (!append) {
    aggregatedArtifacts = [...result.artifacts];
  } else {
    aggregatedArtifacts = aggregatedArtifacts.concat(result.artifacts);
  }

  currentResult = {
    ...result,
    artifacts: aggregatedArtifacts,
  };

  renderAggregatedResults();
  loadMoreBtn.style.display = result.hasMore ? 'block' : 'none';
}

function renderAggregatedResults() {
  if (!currentResult) {
    return;
  }

  const filteredArtifacts = aggregatedArtifacts;

  if (aggregatedArtifacts.length === 0) {
    resultsContainer.innerHTML = '<div class="no-results">No artifacts found</div>';
    resultsHeader.style.display = 'none';
    loadMoreBtn.style.display = 'none';
  } else if (filteredArtifacts.length === 0) {
    resultsContainer.innerHTML = '<div class="no-results">No artifacts match the current filter.</div>';
    updateResultsHeader(0);
  } else {
    resultsContainer.innerHTML = '';
    filteredArtifacts.forEach(artifact => {
      const card = createArtifactCard(artifact);
      resultsContainer.appendChild(card);
    });
    updateResultsHeader(filteredArtifacts.length);
  }
}

function updateResultsHeader(visibleCount: number) {
  if (!currentResult) {
    return;
  }

  if (aggregatedArtifacts.length === 0) {
    resultsHeader.style.display = 'none';
    return;
  }

  const filterLabel = 'all artifacts';
  resultsHeader.style.display = 'flex';
  resultsHeader.textContent = `${visibleCount} shown · ${totalAvailableResults} total · Viewing ${filterLabel}`;
}


function createArtifactCard(artifact: DisplayArtifact): HTMLElement {
  const card = document.createElement('div');
  card.className = 'artifact-card';
  card.dataset.catalogId = artifact.catalogId;
  card.dataset.artifactId = artifact.id;

  const typeIcon = getTypeIcon(artifact.type);
  const rating = artifact.metadata?.rating || 0;
  const downloads = artifact.metadata?.downloads || 0;
  const installed = Boolean(artifact.installed);

  card.innerHTML = `
    <div class="artifact-header">
      <div class="artifact-title">
        <span class="artifact-icon">${typeIcon}</span>
        <div>
          <h3 class="artifact-name">${escapeHtml(artifact.name)}</h3>
          <p class="artifact-subtitle">Catalog: ${escapeHtml(artifact.catalogId)} · Version ${escapeHtml(artifact.version)}</p>
        </div>
      </div>
      ${installed ? '<span class="installed-badge">Installed</span>' : ''}
    </div>
    <div class="artifact-meta">
      <span class="artifact-type">${escapeHtml(artifact.type)}</span>
      <span>${escapeHtml(artifact.category)}</span>
    </div>
    <p class="artifact-description">${escapeHtml(artifact.description)}</p>
    <div class="artifact-tags">
      ${artifact.tags.slice(0, 5).map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
    </div>
    <div class="artifact-footer">
      <div class="artifact-stats">
        <span>Catalog: ${escapeHtml(artifact.catalogId)}</span>
        ${rating > 0 ? `<span>⭐ ${rating.toFixed(1)}</span>` : ''}
        ${downloads > 0 ? `<span>${formatNumber(downloads)} installs</span>` : ''}
      </div>
      <div class="artifact-actions">
        <button class="btn-secondary" data-action="preview">Preview</button>
        <button class="${installed ? 'btn-danger' : 'btn-primary'}" data-action="toggle-install">
          ${installed ? 'Uninstall' : 'Install'}
        </button>
      </div>
    </div>
  `;

  card.querySelector('[data-action="preview"]')?.addEventListener('click', () => {
    sendMessage({ type: 'preview', catalogId: artifact.catalogId, artifactId: artifact.id });
  });

  card.querySelector('[data-action="toggle-install"]')?.addEventListener('click', (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    button.disabled = true;

    if (installed) {
      sendMessage({ type: 'uninstall', catalogId: artifact.catalogId, artifactId: artifact.id });
    } else {
      sendMessage({ type: 'install', artifact });
    }
  });

  return card;
}

// Message handling
window.addEventListener('message', (event) => {
  const message: ExtensionMessage = event.data;

  switch (message.type) {
    case 'searchResult':
      renderResults(message.result, (currentQuery.page || 1) > 1);
      break;
    case 'installResult':
      if (message.success) {
        handleSearch();
      } else {
        renderAggregatedResults();
        vscode.postMessage({ command: 'showError', text: message.error });
      }
      break;
    case 'uninstallResult':
      if (message.success) {
        handleSearch();
      } else {
        renderAggregatedResults();
        vscode.postMessage({ command: 'showError', text: message.error });
      }
      break;
    case 'catalogsUpdated':
      // Refresh search results when catalogs are added/updated
      handleSearch();
      break;
    case 'error':
      renderAggregatedResults();
      vscode.postMessage({ command: 'showError', text: message.message });
      break;
  }
});

// Utilities
function sendMessage(message: WebviewMessage) {
  vscode.postMessage(message);
}

function debounce<T extends (...args: any[]) => void>(func: T, wait: number): T {
  let timeout: NodeJS.Timeout;
  return ((...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  }) as T;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    chatmode: '💬',
    instructions: '📝',
    prompt: '🤖',
    task: '✓',
    profile: '📦',
  };
  return icons[type] || '📄';
}

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
  return num.toString();
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}



