import type { WebviewMessage, ExtensionMessage } from '../common/ipc';
import type { CatalogRecord } from '../../models/types';

const vscode = acquireVsCodeApi();

let catalogs: CatalogRecord[] = [];

// DOM Elements
let catalogsContainer: HTMLElement;
let addBtn: HTMLButtonElement;
let addDialog: HTMLElement;
let refreshAllBtn: HTMLButtonElement;

function init() {
  catalogsContainer = document.getElementById('catalogsContainer') as HTMLElement;
  addBtn = document.getElementById('addCatalog') as HTMLButtonElement;
  addDialog = document.getElementById('addDialog') as HTMLElement;
  refreshAllBtn = document.getElementById('refreshAll') as HTMLButtonElement;

  addBtn.addEventListener('click', showAddDialog);
  refreshAllBtn.addEventListener('click', () => {
    sendMessage({ type: 'refreshAllCatalogs' });
  });

  // Load catalogs
  sendMessage({ type: 'getCatalogs' });
}

function renderCatalogs() {
  if (catalogs.length === 0) {
    catalogsContainer.innerHTML = '<div class="no-results">No repositories configured</div>';
    return;
  }

  catalogsContainer.innerHTML = '';

  catalogs.forEach(catalog => {
    catalogsContainer.appendChild(createCatalogCard(catalog));
  });
}

function createCatalogCard(catalog: CatalogRecord): HTMLElement {
  const card = document.createElement('div');
  card.className = 'catalog-card';

  const statusIcon = catalog.status === 'healthy' ? '✅' : catalog.status === 'error' ? '❌' : '⏳';
  const artifactCount = 0; // Will be populated by extension

  card.innerHTML = `
    <div class="catalog-header">
      <div class="catalog-status">
        ${statusIcon}
        <input type="checkbox" ${catalog.enabled ? 'checked' : ''} data-catalog-id="${catalog.id}">
      </div>
      <h3>${escapeHtml(catalog.metadata.name)}</h3>
    </div>
    <div class="catalog-url">${escapeHtml(catalog.url)}</div>
    <p class="catalog-description">${escapeHtml(catalog.metadata.description)}</p>
    <div class="catalog-meta">
      <span>${artifactCount} artifacts</span>
      ${catalog.lastFetched ? `<span>Last synced: ${formatDate(catalog.lastFetched)}</span>` : '<span>Never synced</span>'}
    </div>
    ${catalog.error ? `<div class="catalog-error">Error: ${escapeHtml(catalog.error)}</div>` : ''}
    <div class="catalog-actions">
      <button class="btn-secondary" data-action="refresh">Refresh</button>
      <button class="btn-secondary" data-action="edit">Edit</button>
      <button class="btn-danger" data-action="remove">Remove</button>
    </div>
  `;

  const checkbox = card.querySelector('input[type="checkbox"]') as HTMLInputElement;
  checkbox.addEventListener('change', () => {
    sendMessage({
      type: 'toggleCatalog',
      catalogId: catalog.id,
      enabled: checkbox.checked
    });
  });

  card.querySelector('[data-action="refresh"]')?.addEventListener('click', () => {
    sendMessage({ type: 'refreshCatalog', catalogId: catalog.id });
  });

  card.querySelector('[data-action="edit"]')?.addEventListener('click', () => {
    showEditDialog(catalog);
  });

  card.querySelector('[data-action="remove"]')?.addEventListener('click', () => {
    if (confirm(`Remove catalog "${catalog.metadata.name}"?`)) {
      sendMessage({ type: 'removeCatalog', catalogId: catalog.id });
    }
  });

  return card;
}

function showAddDialog() {
  addDialog.innerHTML = `
    <div class="dialog-content">
      <h2>Add Repository</h2>
      <form id="addForm">
        <div class="form-group">
          <label>Repository URL *</label>
          <input type="url" id="repoUrl" required placeholder="https://gitlab.com/org/repo/-/raw/main/catalog.json">
        </div>
        <div class="form-group">
          <label>Repository ID</label>
          <input type="text" id="repoId" placeholder="Auto-generated from URL">
        </div>
        <div class="form-group">
          <label>
            <input type="checkbox" id="requiresAuth">
            Requires Authentication
          </label>
        </div>
        <div class="form-actions">
          <button type="button" class="btn-secondary" onclick="closeAddDialog()">Cancel</button>
          <button type="submit" class="btn-primary">Add</button>
        </div>
      </form>
    </div>
  `;

  addDialog.style.display = 'block';

  document.getElementById('addForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const url = (document.getElementById('repoUrl') as HTMLInputElement).value;
    const id = (document.getElementById('repoId') as HTMLInputElement).value || generateIdFromUrl(url);
    const requiresAuth = (document.getElementById('requiresAuth') as HTMLInputElement).checked;

    sendMessage({
      type: 'addCatalog',
      config: {
        id,
        url,
        enabled: true,
        auth: requiresAuth ? { type: 'bearer' } : undefined,
      },
    });

    closeAddDialog();
  });
}

function closeAddDialog() {
  addDialog.style.display = 'none';
}

(window as any).closeAddDialog = closeAddDialog;

function showEditDialog(_catalog: CatalogRecord) {
  // Similar to add dialog but with existing values
  alert('Edit functionality not yet implemented');
}

function generateIdFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const parts = urlObj.pathname.split('/').filter(p => p.length > 0);
    return parts.slice(-3, -1).join('-').toLowerCase();
  } catch {
    return 'custom-catalog';
  }
}

// Message handling
window.addEventListener('message', (event) => {
  const message: ExtensionMessage = event.data;

  switch (message.type) {
    case 'catalogs':
      catalogs = message.catalogs;
      renderCatalogs();
      break;
    case 'catalogAdded':
      catalogs.push(message.catalog);
      renderCatalogs();
      break;
    case 'catalogRemoved':
      catalogs = catalogs.filter(c => c.id !== message.catalogId);
      renderCatalogs();
      break;
    case 'catalogUpdated': {
      const index = catalogs.findIndex(c => c.id === message.catalog.id);
      if (index !== -1) {
        catalogs[index] = message.catalog;
        renderCatalogs();
      }
      break;
    }
  }
});

function sendMessage(message: WebviewMessage) {
  vscode.postMessage(message);
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  return date.toLocaleString();
}

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

