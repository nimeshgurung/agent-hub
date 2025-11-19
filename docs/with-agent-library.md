# Using Agent Hub with Agent Library

This guide shows the end-to-end workflow: scaffold a catalog with Agent Library, then consume it in VS Code with Agent Hub.

## Prerequisites
- Node 18+ and npm
- VS Code and the Agent Hub extension installed

## 1) Set up Agent Library
Clone or fork the Agent Library scaffold and install dependencies:
```bash
npm run bootstrap
```

Generate artifacts:
```bash
npm run generate:chatmode
npm run generate:prompt
npm run generate:instructions
npm run generate:task
npm run generate:agent   # optional: directory-based agent packs that can contain multiple artifacts/resources
```

Build catalog + frontend:
```bash
npm run build
npm run dev
```
Open `http://localhost:5173`. You should see your artifacts, and a floating button to open `/copilot-catalog.json`.

## 2) Host your catalog
Pick a host for `copilot-catalog.json`:
- GitHub Raw: `https://raw.githubusercontent.com/<org>/<repo>/<branch>/copilot-catalog.json`
- GitLab Raw: `https://gitlab.com/<org>/<repo>/-/raw/<branch>/copilot-catalog.json`
- Frontend Pages: `https://<your-frontend-host>/copilot-catalog.json`

Agent Library’s frontend can auto-detect the first reachable URL via env vars:
```
VITE_CATALOG_FRONTEND_URL=/copilot-catalog.json
VITE_CATALOG_GITHUB_URL=...
VITE_CATALOG_GITLAB_URL=...
```

## 3) Add the catalog in VS Code
Open the Agent Hub extension and click “Add Repository”:
```
URL: (your raw catalog URL)
ID:  (auto-generated or choose one)
Auth: optional (required for private catalogs)
```

Or add via settings:
```json
{
  "agentHub.repositories": [
    { "id": "agent-library", "url": "https://nimeshgurung.github.io/agent-library/copilot-catalog.json", "enabled": true }
  ]
}
```

## 4) Browse and install
Use the Search view to find artifacts. Click **Preview** to inspect, then **Install** to add to your workspace.

- Standard artifacts are installed under `.github/…` in your repo.
- Agent packs are installed with a hidden definition file under `.github/.agent-hub/agents/<id>/`, while their resources are projected into your workspace root:
  - Files under `resources/.github/agents` → `.github/agents/`
  - Files under `resources/.github/prompts` → `.github/prompts/`
  - `.vscode/settings.json` (if shipped) → `.vscode/settings.json` at workspace root
  - Other resources (like `.specify/`) are projected to the workspace root

## 5) Private catalogs
Use PAT/Bearer tokens and environment variables in settings:
```json
{
  "agentHub.repositories": [
    {
      "id": "private-catalog",
      "url": "https://gitlab.company.com/.../copilot-catalog.json",
      "auth": { "type": "bearer", "token": "${env:GITLAB_TOKEN}" }
    }
  ]
}
```

## 6) CI/CD
Automate catalog generation and frontend deployment with GitHub Actions or GitLab CI. See Agent Library docs: `docs/ci-cd.md`.

## Troubleshooting
If your catalog doesn’t load in VS Code or the frontend, check:
- URL correctness and reachability
- Content type is JSON or text/plain
- CORS allowances (for private gateways)
- That the catalog was rebuilt after adding artifacts

## Cross-References
- Agent Library Quickstart: [`agent-library/docs/quickstart.md`](https://github.com/nimeshgurung/agent-library/blob/main/docs/quickstart.md)
- Agent Library Hosting: [`agent-library/docs/catalogs-and-hosting.md`](https://github.com/nimeshgurung/agent-library/blob/main/docs/catalogs-and-hosting.md)
- Extension Marketplace: `https://marketplace.visualstudio.com/items?itemName=nimsbhai.agent-hub`


