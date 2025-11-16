# Artifact Hub - Architecture Documentation

## Overview

Artifact Hub is a VS Code extension that provides a marketplace for AI development artifacts (chat modes, prompts, instructions, tasks, and profiles). It allows users to discover, install, and manage artifacts from multiple Git-based catalog repositories.

## High-Level Architecture

```mermaid
graph TB
    subgraph "VS Code Extension Host"
        EXT[Extension Entry Point<br/>extension.ts]

        subgraph "Configuration Layer"
            CONFIG[Configuration Service]
        end

        subgraph "Service Layer"
            HTTP[HttpClient]
            AUTH[AuthService]
            URL[UrlResolver]
            CAT[CatalogService]
            SEARCH[SearchService]
            ART[ArtifactService]
            UPDATE[UpdateService]
            STATUS[StatusBarService]
        end

        subgraph "Storage Layer"
            DB[(SQLite Database<br/>better-sqlite3)]
            MIGRATIONS[Migrations]
        end

        subgraph "Webview Layer"
            SEARCH_VIEW[SearchViewProvider]
            INSTALLED_VIEW[InstalledViewProvider]
            REPO_VIEW[RepositoriesViewProvider]
        end

        subgraph "UI Layer"
            SEARCH_HTML[search.html]
            INSTALLED_HTML[installed.html]
            REPO_HTML[repositories.html]
            SEARCH_JS[search/index.ts]
            INSTALLED_JS[installed/index.ts]
            REPO_JS[repositories/index.ts]
        end
    end

    subgraph "External"
        GITLAB[GitLab Repositories]
        GITHUB[GitHub Repositories]
        WORKSPACE[VS Code Workspace]
        VSCODE_API[VS Code API]
    end

    EXT --> CONFIG
    EXT --> HTTP
    EXT --> AUTH
    EXT --> URL
    EXT --> CAT
    EXT --> SEARCH
    EXT --> ART
    EXT --> UPDATE
    EXT --> STATUS
    EXT --> DB
    EXT --> SEARCH_VIEW
    EXT --> INSTALLED_VIEW
    EXT --> REPO_VIEW

    CONFIG --> VSCODE_API
    AUTH --> VSCODE_API
    DB --> MIGRATIONS

    HTTP --> GITLAB
    HTTP --> GITHUB

    CAT --> HTTP
    CAT --> URL
    CAT --> AUTH
    CAT --> DB

    SEARCH --> DB
    ART --> DB
    ART --> HTTP
    ART --> AUTH
    ART --> SEARCH
    UPDATE --> DB
    UPDATE --> SEARCH
    UPDATE --> HTTP
    UPDATE --> AUTH

    SEARCH_VIEW --> SEARCH_HTML
    SEARCH_VIEW --> SEARCH_JS
    INSTALLED_VIEW --> INSTALLED_HTML
    INSTALLED_VIEW --> INSTALLED_JS
    REPO_VIEW --> REPO_HTML
    REPO_VIEW --> REPO_JS

    ART --> WORKSPACE
    STATUS --> VSCODE_API

    style EXT fill:#e1f5ff
    style DB fill:#fff4e1
    style HTTP fill:#ffe1f5
    style SEARCH fill:#e1ffe1
```

## Service Layer Architecture

```mermaid
graph LR
    subgraph "Core Services"
        HTTP[HttpClient<br/>- Retry logic<br/>- Auth headers<br/>- Error handling]
        AUTH[AuthService<br/>- Token storage<br/>- Secret resolution<br/>- Env var support]
        URL[UrlResolver<br/>- GitLab URL resolution<br/>- GitHub URL resolution<br/>- Generic URL handling]
    end

    subgraph "Business Logic Services"
        CAT[CatalogService<br/>- Fetch catalogs<br/>- Index artifacts<br/>- Validate schemas]
        SEARCH[SearchService<br/>- Full-text search<br/>- Filtering<br/>- Ranking]
        ART[ArtifactService<br/>- Install artifacts<br/>- Dependency resolution<br/>- Conflict handling]
        UPDATE[UpdateService<br/>- Version checking<br/>- Update detection<br/>- Changelog fetching]
    end

    subgraph "UI Services"
        STATUS[StatusBarService<br/>- Artifact count<br/>- Update count<br/>- Status display]
    end

    CAT --> HTTP
    CAT --> AUTH
    CAT --> URL

    ART --> HTTP
    ART --> AUTH
    ART --> SEARCH

    UPDATE --> HTTP
    UPDATE --> AUTH
    UPDATE --> SEARCH

    style HTTP fill:#ffe1f5
    style AUTH fill:#ffe1f5
    style URL fill:#ffe1f5
    style CAT fill:#e1ffe1
    style SEARCH fill:#e1ffe1
    style ART fill:#e1ffe1
    style UPDATE fill:#e1ffe1
    style STATUS fill:#fff4e1
```

## Data Flow: Catalog Refresh

```mermaid
sequenceDiagram
    participant User
    participant Extension
    participant Config
    participant CatalogService
    participant AuthService
    participant HttpClient
    participant UrlResolver
    participant Database
    participant GitRepo

    User->>Extension: Refresh Catalogs Command
    Extension->>Config: getRepositories()
    Config-->>Extension: Catalog Configs

    loop For each catalog
        Extension->>CatalogService: refreshCatalog(id, config)
        CatalogService->>AuthService: resolveAuth(id, auth)
        AuthService-->>CatalogService: Resolved Auth Config

        CatalogService->>HttpClient: fetchJson(catalogUrl, auth)
        HttpClient->>GitRepo: HTTP GET Request
        GitRepo-->>HttpClient: Catalog JSON
        HttpClient-->>CatalogService: Parsed Catalog

        CatalogService->>CatalogService: Validate Schema (Zod)

        CatalogService->>Database: Begin Transaction

        loop For each artifact
            CatalogService->>UrlResolver: resolveArtifactUrl(metadata, artifact)
            UrlResolver-->>CatalogService: Source URL
            CatalogService->>Database: INSERT artifact
        end

        CatalogService->>Database: UPDATE catalog metadata
        CatalogService->>Database: Commit Transaction
        CatalogService-->>Extension: Success
    end

    Extension->>User: Show success message
```

## Data Flow: Artifact Installation

```mermaid
sequenceDiagram
    participant User
    participant Webview
    participant SearchViewProvider
    participant ArtifactService
    participant SearchService
    participant AuthService
    participant HttpClient
    participant Database
    participant GitRepo
    participant Workspace

    User->>Webview: Click Install
    Webview->>SearchViewProvider: install message
    SearchViewProvider->>ArtifactService: install(artifact, root, config)

    ArtifactService->>ArtifactService: Check if already installed

    alt Has dependencies
        ArtifactService->>SearchService: getArtifact() for each dep
        SearchService-->>ArtifactService: Dependency artifacts
        loop For each dependency
            ArtifactService->>ArtifactService: install(dependency)
        end
    end

    ArtifactService->>ArtifactService: checkConflict(targetPath)

    alt Conflict exists
        ArtifactService->>User: Prompt resolution
        User-->>ArtifactService: Resolution choice
    end

    ArtifactService->>AuthService: resolveAuth(config.id, config.auth)
    AuthService-->>ArtifactService: Resolved auth

    ArtifactService->>HttpClient: fetchText(sourceUrl, auth)
    HttpClient->>GitRepo: HTTP GET artifact file
    GitRepo-->>HttpClient: Artifact content
    HttpClient-->>ArtifactService: Content string

    ArtifactService->>Workspace: createDirectory()
    ArtifactService->>Workspace: writeFile(content)

    ArtifactService->>Database: INSERT installation record
    Database-->>ArtifactService: Success

    ArtifactService-->>SearchViewProvider: InstallResult
    SearchViewProvider->>Webview: installResult message
    Webview->>User: Show success notification
```

## Database Schema

> **Note**: The `ARTIFACTS` table uses a composite primary key `(id, catalog_id)` in the actual database, but Mermaid ER diagrams don't support composite keys directly. The diagram shows `id` as PK and `catalog_id` as FK.

```mermaid
erDiagram
    CATALOGS ||--o{ ARTIFACTS : contains
    ARTIFACTS ||--o{ INSTALLATIONS : installed_as

    CATALOGS {
        string id PK
        string url UK
        int enabled
        string metadata "JSON"
        datetime last_fetched
        string status
        string error
        datetime created_at
        datetime updated_at
    }

    ARTIFACTS {
        string id PK
        string catalog_id FK
        string type
        string name
        string description
        string path
        string version
        string category
        string tags "JSON"
        string keywords "JSON"
        string language "JSON"
        string framework "JSON"
        string use_case "JSON"
        string difficulty
        string source_url
        string metadata "JSON"
        string author "JSON"
        string compatibility "JSON"
        string dependencies "JSON"
        string estimated_time
        datetime created_at
        datetime updated_at
    }

    ARTIFACTS_FTS {
        int rowid PK
        string id
        string catalog_id
        string name
        string description
        string tags
        string keywords
        string category
    }

    INSTALLATIONS {
        int id PK
        string artifact_id FK
        string catalog_id FK
        string version
        string installed_path
        datetime installed_at
        datetime last_used
    }

    METADATA {
        string key PK
        string value
    }

    ARTIFACTS ||--o| ARTIFACTS_FTS : "FTS index"
```

## Webview Communication Flow

```mermaid
sequenceDiagram
    participant Webview as Webview UI
    participant Provider as ViewProvider
    participant Service as Service Layer
    participant DB as Database

    Note over Webview,DB: Search Flow
    Webview->>Provider: {type: 'search', query: {...}}
    Provider->>Service: searchService.search(query)
    Service->>DB: Query with FTS
    DB-->>Service: Artifacts
    Service->>Service: Score and rank
    Service-->>Provider: SearchResult
    Provider->>Webview: {type: 'searchResult', result: {...}}

    Note over Webview,DB: Install Flow
    Webview->>Provider: {type: 'install', artifact: {...}}
    Provider->>Service: artifactService.install(...)
    Service->>Service: Resolve dependencies
    Service->>Service: Download & write file
    Service->>DB: Record installation
    Service-->>Provider: InstallResult
    Provider->>Webview: {type: 'installResult', ...}

    Note over Webview,DB: Preview Flow
    Webview->>Provider: {type: 'preview', catalogId, artifactId}
    Provider->>Service: searchService.getArtifact(...)
    Service->>DB: Get artifact
    DB-->>Service: Artifact
    Provider->>Service: httpClient.fetchText(sourceUrl)
    Service-->>Provider: Content
    Provider->>Webview: {type: 'previewContent', content, artifact}
```

## Component Dependencies

```mermaid
graph TD
    subgraph "Extension Entry"
        EXT[extension.ts]
    end

    subgraph "Configuration"
        CONFIG[Configuration]
        CONSTANTS[constants.ts]
    end

    subgraph "Models & Types"
        TYPES[models/types.ts<br/>Zod schemas & TypeScript types]
    end

    subgraph "Storage"
        DB[DatabaseService]
        MIGRATIONS[migrations.ts]
        DB_TYPES[storage/types.ts]
    end

    subgraph "Services"
        HTTP[HttpClient]
        AUTH[AuthService]
        URL[UrlResolver]
        CAT[CatalogService]
        SEARCH[SearchService]
        ART[ArtifactService]
        UPDATE[UpdateService]
        STATUS[StatusBarService]
    end

    subgraph "Webviews"
        SEARCH_VP[SearchViewProvider]
        INSTALLED_VP[InstalledViewProvider]
        REPO_VP[RepositoriesViewProvider]
        IPC[common/ipc.ts]
    end

    EXT --> CONFIG
    EXT --> DB
    EXT --> HTTP
    EXT --> AUTH
    EXT --> URL
    EXT --> CAT
    EXT --> SEARCH
    EXT --> ART
    EXT --> UPDATE
    EXT --> STATUS
    EXT --> SEARCH_VP
    EXT --> INSTALLED_VP
    EXT --> REPO_VP

    CONFIG --> CONSTANTS
    DB --> MIGRATIONS
    DB --> DB_TYPES

    CAT --> DB
    CAT --> HTTP
    CAT --> AUTH
    CAT --> URL
    CAT --> TYPES

    SEARCH --> DB
    SEARCH --> TYPES
    SEARCH --> DB_TYPES

    ART --> DB
    ART --> HTTP
    ART --> AUTH
    ART --> SEARCH
    ART --> TYPES

    UPDATE --> DB
    UPDATE --> SEARCH
    UPDATE --> HTTP
    UPDATE --> AUTH
    UPDATE --> TYPES

    SEARCH_VP --> SEARCH
    SEARCH_VP --> ART
    SEARCH_VP --> HTTP
    SEARCH_VP --> AUTH
    SEARCH_VP --> CONFIG
    SEARCH_VP --> IPC

    INSTALLED_VP --> ART
    INSTALLED_VP --> UPDATE
    INSTALLED_VP --> CONFIG
    INSTALLED_VP --> IPC

    REPO_VP --> CAT
    REPO_VP --> CONFIG
    REPO_VP --> IPC

    style EXT fill:#e1f5ff
    style TYPES fill:#fff4e1
    style DB fill:#ffe1f5
```

## Search Architecture

```mermaid
graph TB
    subgraph "Search Query"
        QUERY[SearchQuery<br/>- query string<br/>- filters<br/>- sort options]
    end

    subgraph "Search Service"
        DECIDE{Has query<br/>string?}
        FTS[Full-Text Search<br/>FTS5 virtual table]
        FILTER[Filter & Sort<br/>SQL WHERE clauses]
        RANK[Score & Rank<br/>Relevance algorithm]
    end

    subgraph "Database"
        ARTIFACTS[(artifacts table)]
        FTS_TABLE[(artifacts_fts<br/>FTS5 virtual table)]
    end

    QUERY --> DECIDE
    DECIDE -->|Yes| FTS
    DECIDE -->|No| FILTER

    FTS --> FTS_TABLE
    FTS_TABLE --> ARTIFACTS
    FILTER --> ARTIFACTS

    ARTIFACTS --> RANK
    RANK --> RESULT[SearchResult<br/>- artifacts<br/>- total<br/>- pagination]

    style FTS fill:#e1ffe1
    style FTS_TABLE fill:#fff4e1
    style RANK fill:#ffe1f5
```

## Authentication Flow

```mermaid
sequenceDiagram
    participant User
    participant Config
    participant AuthService
    participant Secrets
    participant HttpClient

    Note over User,HttpClient: Token Resolution Flow

    User->>Config: Add catalog with auth config
    Config->>AuthService: resolveAuth(repoId, authConfig)

    alt Token is secret reference
        AuthService->>AuthService: Match ${secret:key}
        AuthService->>Secrets: getToken(key)
        Secrets-->>AuthService: Stored token
        AuthService-->>Config: Resolved auth with token
    else Token is env var reference
        AuthService->>AuthService: Match ${env:VAR}
        AuthService-->>Config: Resolved auth with env ref
    else Token is direct value
        AuthService-->>Config: Resolved auth with direct token
    end

    Config->>HttpClient: fetch(url, {auth})
    HttpClient->>AuthService: resolveAuthToken(auth)

    alt Env var reference
        HttpClient->>HttpClient: Extract env var name
        HttpClient->>HttpClient: Read from process.env
    end

    HttpClient->>HttpClient: Add Authorization header
    HttpClient->>HttpClient: Make HTTP request
```

## Update Detection Flow

```mermaid
sequenceDiagram
    participant User
    participant UpdateService
    participant Database
    participant SearchService
    participant HttpClient
    participant GitRepo

    User->>UpdateService: checkForUpdates(configs)
    UpdateService->>Database: Get all installations

    loop For each installation
        UpdateService->>SearchService: getArtifact(catalogId, artifactId)
        SearchService->>Database: Query artifact
        Database-->>SearchService: Latest artifact
        SearchService-->>UpdateService: Artifact with version

        UpdateService->>UpdateService: Compare versions (semver)

        alt New version available
            UpdateService->>HttpClient: fetchChangelog(sourceUrl)
            HttpClient->>GitRepo: GET CHANGELOG.md
            GitRepo-->>HttpClient: Changelog content
            HttpClient-->>UpdateService: Changelog

            UpdateService->>UpdateService: Create UpdateInfo
        end
    end

    UpdateService-->>User: UpdateInfo[]

    Note over User,GitRepo: User can then update artifacts
```

## File Structure

```
extension/
├── src/
│   ├── extension.ts              # Entry point, service initialization
│   ├── config/
│   │   ├── configuration.ts      # VS Code config wrapper
│   │   └── constants.ts          # Constants and defaults
│   ├── models/
│   │   └── types.ts              # Zod schemas & TypeScript types
│   ├── storage/
│   │   ├── Database.ts           # SQLite database wrapper
│   │   ├── migrations.ts         # Database migrations
│   │   └── types.ts              # Database row types
│   ├── services/
│   │   ├── HttpClient.ts         # HTTP client with retry logic
│   │   ├── AuthService.ts        # Authentication & secrets
│   │   ├── UrlResolver.ts        # Git URL resolution
│   │   ├── CatalogService.ts    # Catalog management
│   │   ├── SearchService.ts     # Search & filtering
│   │   ├── ArtifactService.ts   # Installation & management
│   │   ├── UpdateService.ts     # Update detection
│   │   └── StatusBarService.ts  # Status bar UI
│   └── webview/
│       ├── common/
│       │   └── ipc.ts            # IPC message types
│       ├── SearchViewProvider.ts
│       ├── InstalledViewProvider.ts
│       ├── RepositoriesViewProvider.ts
│       ├── search/index.ts       # Webview frontend
│       ├── installed/index.ts
│       └── repositories/index.ts
├── media/                        # HTML templates & CSS
├── dist/                         # Compiled output
└── package.json                  # Extension manifest
```

## Key Design Patterns

### 1. **Service Layer Pattern**
- Clear separation of concerns
- Services are dependency-injected
- Single responsibility principle

### 2. **Repository Pattern**
- Database abstraction through DatabaseService
- Transaction support
- Migration system

### 3. **Provider Pattern**
- Webview providers handle UI lifecycle
- Message-based communication
- Separation of extension host and webview

### 4. **Schema Validation**
- Zod schemas for runtime validation
- Type safety with TypeScript
- Clear error messages

### 5. **Full-Text Search**
- FTS5 virtual table for performance
- Triggers to keep FTS in sync
- Relevance scoring algorithm

## Technology Stack

- **Runtime**: Node.js (VS Code Extension Host)
- **Language**: TypeScript
- **Database**: SQLite (better-sqlite3)
- **Validation**: Zod
- **Build**: esbuild
- **UI**: VS Code Webview API + HTML/CSS/JS
- **Versioning**: semver

## Data Flow Summary

1. **Catalog Management**: User adds catalog → Fetch → Validate → Index → Store in DB
2. **Search**: User queries → FTS/Filter → Rank → Return results
3. **Installation**: User installs → Resolve deps → Download → Write file → Record in DB
4. **Updates**: Periodic check → Compare versions → Notify user
5. **Authentication**: Config → Resolve secrets/env → Add headers → HTTP request

