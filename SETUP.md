# Agent Hub - Development Setup Guide

## Prerequisites

- Node.js >= 18.x
- npm >= 9.x
- VS Code >= 1.95.0

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd extension
```

2. Install dependencies:
```bash
npm install
```

## Development

### Build the extension

```bash
# One-time build
npm run build

# Watch mode (rebuilds on file changes)
npm run watch
```

### Run the extension

1. Open the `extension` folder in VS Code
2. Press `F5` to launch the Extension Development Host
3. The extension will be available in the new VS Code window

### Debugging

- Set breakpoints in TypeScript files
- Use the Debug Console to inspect variables
- Check the Output panel (select "Agent Hub" from the dropdown)

## Project Structure

```
extension/
├── src/
│   ├── config/              # Configuration management
│   ├── models/              # TypeScript types and Zod schemas
│   ├── services/            # Core business logic
│   ├── storage/             # Database and migrations
│   ├── webview/             # Webview UI code
│   └── extension.ts         # Extension entry point
├── media/                   # HTML templates and CSS
├── resources/               # Icons and assets
├── test/                    # Tests
├── examples/                # Example catalogs
└── dist/                    # Compiled output
```

## Testing

### Run tests

```bash
npm test
```

### Writing tests

Tests are located in `test/suite/`. Create new test files with the `.test.ts` extension.

Example:
```typescript
import * as assert from 'assert';
import { MyService } from '../../src/services/MyService';

suite('MyService Test Suite', () => {
  test('should do something', () => {
    const service = new MyService();
    const result = service.doSomething();
    assert.strictEqual(result, 'expected');
  });
});
```

## Database

The extension uses SQLite with better-sqlite3 for local storage:

- **Location**: `~/.vscode/extensions/<extension-id>/globalStorage/agent-hub/artifacts.db`
- **Schema**: Defined in `src/storage/migrations.ts`
- **Migrations**: Run automatically on extension activation

### Inspecting the database

```bash
sqlite3 ~/.vscode/extensions/<extension-id>/globalStorage/agent-hub/artifacts.db

# List tables
.tables

# View catalogs
SELECT * FROM catalogs;

# View artifacts
SELECT id, name, type, catalog_id FROM artifacts LIMIT 10;

# Search test
SELECT * FROM artifacts_fts WHERE artifacts_fts MATCH 'typescript';
```

## Creating a Test Catalog

1. Create a `copilot-catalog.json` file:
```json
{
  "version": "1.0.0",
  "catalog": {
    "id": "my-test-catalog",
    "name": "My Test Catalog",
    "description": "Testing the extension",
    "author": { "name": "Your Name" },
    "repository": {
      "type": "github",
      "url": "https://github.com/user/repo",
      "branch": "main"
    },
    "license": "MIT"
  },
  "artifacts": [
    {
      "id": "test-chatmode",
      "type": "chatmode",
      "name": "Test Chat Mode",
      "description": "A test chat mode",
      "path": "test.chatmode.md",
      "version": "1.0.0",
      "category": "Testing",
      "tags": ["test"],
      "dependencies": []
    }
  ]
}
```

2. Host it somewhere accessible (GitHub Gist, local server, etc.)

3. Add the catalog in the extension:
   - Open Repositories view
   - Click "Add Repository"
   - Enter the URL to your `copilot-catalog.json`

## Building for Production

```bash
# Build and package
npm run vscode:prepublish
npx vsce package
```

This creates a `.vsix` file that can be:
- Installed locally: Extensions > Install from VSIX
- Published to VS Code Marketplace

## Common Issues

### Extension doesn't activate

- Check the Output panel (select "Agent Hub")
- Look for errors in the Developer Tools Console (`Help > Toggle Developer Tools`)

### Database errors

- Delete the database file and restart VS Code
- Check file permissions on the globalStorage directory

### Webview not loading

- Check CSP errors in Developer Tools Console
- Verify file paths in webview providers
- Ensure esbuild compiled webview scripts

### TypeScript errors

```bash
# Check for type errors
npx tsc --noEmit
```

## Code Style

- Use Prettier for formatting
- Follow ESLint rules
- Use TypeScript strict mode
- Document public APIs with JSDoc

## Performance Tips

- Use SQLite prepared statements for repeated queries
- Batch database operations in transactions
- Debounce expensive operations (search, refresh)
- Lazy-load preview content
- Paginate large result sets

## Contributing

1. Create a feature branch
2. Make your changes
3. Write/update tests
4. Run linter and tests
5. Submit a pull request

## Resources

- [VS Code Extension API](https://code.visualstudio.com/api)
- [Webview API Guide](https://code.visualstudio.com/api/extension-guides/webview)
- [better-sqlite3 docs](https://github.com/WiseLibs/better-sqlite3/wiki)
- [Zod docs](https://zod.dev/)

## Support

- 📖 [Documentation](https://artifact-hub.dev/docs)
- 💬 [Discussions](https://github.com/artifact-hub/artifact-hub/discussions)
- 🐛 [Issue Tracker](https://github.com/artifact-hub/artifact-hub/issues)

