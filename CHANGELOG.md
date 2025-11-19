# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2024-11-19

### BREAKING CHANGES

**Bundle → Agent Rename**

This release renames the `bundle` artifact type to `agent` (agent pack) throughout the extension.

#### What Changed

- **Artifact Type**: `bundle` → `agent` in type schemas and all internal logic
- **UI Filter**: Search filter now shows "Agents" instead of "Bundles"
- **Installation Path**: Agent packs now install to `.github/.agent-hub/agents/<id>/` (was `.agent-hub/bundles/<id>/`)
- **Terminology**: "bundles" are now called "agent packs" or "agents" throughout docs and UI

#### Migration Impact

- **Catalogs**: Only catalogs using `type: "agent"` will work with this version
- **Existing Installations**: Previously installed bundles will continue to work, but:
  - They are stored under the old `.github/.agent-hub/bundles/` path
  - Future installations will use the new `.github/.agent-hub/agents/` path
  - Uninstalling old bundles will still clean them up correctly
- **Search Filters**: The type filter now checks for `agent` instead of `bundle`

#### Updating Your Catalog

If you maintain a catalog (e.g., with Agent Library), update to Agent Library 2.0.0+ and regenerate your catalog to use `type: "agent"`.

#### Why This Change

The term "agent pack" better reflects the nature of these artifacts: they are collections of agents, prompts, and resources that work together as a cohesive development kit.

## [0.0.5] - 2024-11-18

- Initial release with bundle support

