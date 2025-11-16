export const CONFIG_KEYS = {
  REPOSITORIES: 'artifactHub.repositories',
  AUTO_UPDATE: 'artifactHub.autoUpdate',
  UPDATE_INTERVAL: 'artifactHub.updateInterval',
  INSTALL_ROOT: 'artifactHub.installRoot',
} as const;

export const DEFAULTS = {
  AUTO_UPDATE: true,
  UPDATE_INTERVAL: 3600, // 1 hour in seconds
  INSTALL_ROOT: '.github',
} as const;

export const ARTIFACT_PATHS = {
  chatmode: 'chatmodes',
  instructions: 'instructions',
  prompt: 'prompts',
  task: 'tasks',
  profile: '../.vscode/artifact-hub/profiles',
} as const;

export const ARTIFACT_EXTENSIONS = {
  chatmode: '.chatmode.md',
  instructions: '.md',
  prompt: '.md',
  task: '.md',
  profile: '.json',
} as const;

export const DB_VERSION = 1;
export const CATALOG_SCHEMA_VERSION = '1.0.0';

export const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  INITIAL_DELAY: 1000,
  MAX_DELAY: 10000,
  BACKOFF_MULTIPLIER: 2,
} as const;

