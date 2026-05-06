# Bulk GitHub Organization Settings Sync Action

[![GitHub release](https://img.shields.io/github/release/joshjohanning/bulk-github-org-settings-sync-action.svg?logo=github&labelColor=333)](https://github.com/joshjohanning/bulk-github-org-settings-sync-action/releases)
[![Immutable releases](https://img.shields.io/badge/releases-immutable-blue?labelColor=333)](https://docs.github.com/en/code-security/supply-chain-security/understanding-your-software-supply-chain/immutable-releases)
[![GitHub marketplace](https://img.shields.io/badge/marketplace-Bulk%20GitHub%20Organization%20Settings%20Sync-blue?logo=github&labelColor=333)](https://github.com/marketplace/actions/bulk-github-organization-settings-sync)
[![CI](https://github.com/joshjohanning/bulk-github-org-settings-sync-action/actions/workflows/ci.yml/badge.svg)](https://github.com/joshjohanning/bulk-github-org-settings-sync-action/actions/workflows/ci.yml)
[![Publish GitHub Action](https://github.com/joshjohanning/bulk-github-org-settings-sync-action/actions/workflows/publish.yml/badge.svg)](https://github.com/joshjohanning/bulk-github-org-settings-sync-action/actions/workflows/publish.yml)
![Coverage](./badges/coverage.svg)

🏢 Bulk configure GitHub organization settings across multiple orgs using a declarative YAML config

## What's new

Please refer to the [release page](https://github.com/joshjohanning/bulk-github-org-settings-sync-action/releases) for the latest release notes.

## Features

- 🏷️ Sync custom property definitions across organizations
- 📋 Sync organization-level rulesets across organizations
- 🔧 Sync member privileges and repository policies across organizations
- ✅ Support for all custom property types: `string`, `single_select`, `multi_select`, `true_false`, `url`
- 🔍 Dry-run mode with change preview and intelligent change detection
- 📋 Per-organization overrides via YAML configuration
- 📊 Rich job summary with per-organization status table
- 🌐 Support for GitHub.com, GHES, and GHEC

## Usage Examples

### Basic Usage

```yml
- name: Sync Organization Settings
  uses: joshjohanning/bulk-github-org-settings-sync-action@v1
  with:
    github-token: ${{ secrets.ORG_ADMIN_TOKEN }}
    organizations: 'my-org,my-other-org'
    custom-properties-file: './custom-properties.yml'
    delete-unmanaged-properties: true
    dry-run: ${{ github.event_name == 'pull_request' }} # dry run if PR
```

---

## Authentication

### GitHub App (Recommended)

For stronger security and higher rate limits, use a GitHub App:

1. Create a GitHub App with the following permissions:
   - **Organization Custom Properties**: Admin (required for managing custom property definitions)
   - **Organization Administration**: Read and write (required for managing organization settings and rulesets)
2. Install it to your organization(s)
3. Add `APP_ID` and `APP_PRIVATE_KEY` as repository secrets

```yml
- name: Generate GitHub App Token
  id: app-token
  uses: actions/create-github-app-token@v3
  with:
    app-id: ${{ secrets.APP_ID }}
    private-key: ${{ secrets.APP_PRIVATE_KEY }}
    owner: ${{ github.repository_owner }}

- name: Sync Organization Settings
  uses: joshjohanning/bulk-github-org-settings-sync-action@v1
  with:
    github-token: ${{ steps.app-token.outputs.token }}
    # ... other inputs
```

### Personal Access Token

Alternatively, use a PAT with `admin:org` scope:

```yml
- name: Sync Organization Settings
  uses: joshjohanning/bulk-github-org-settings-sync-action@v1
  with:
    github-token: ${{ secrets.ORG_ADMIN_TOKEN }}
    # ... other inputs
```

---

## Organization Selection Methods

This action supports two approaches for selecting which organizations to manage. Choose based on your needs:

| Approach                                                                 | Best For                                                 | Configuration File                   |
| ------------------------------------------------------------------------ | -------------------------------------------------------- | ------------------------------------ |
| [**Option 1: Organization List**](#option-1-organization-list)           | Simple setup, same settings applied to all orgs          | `custom-properties.yml`              |
| [**Option 2: Organizations File**](#option-2-organizations-file-orgsyml) | Per-org overrides, different settings for different orgs | `orgs.yml` + `custom-properties.yml` |

---

### Option 1: Organization List

List organizations directly via the `organizations` input. All orgs receive the same settings defined via `custom-properties-file`.

**Best for:** Applying identical settings across all organizations.

```yml
- name: Sync Organization Settings
  uses: joshjohanning/bulk-github-org-settings-sync-action@v1
  with:
    github-token: ${{ secrets.ORG_ADMIN_TOKEN }}
    organizations: 'my-org, my-other-org, my-third-org'
    custom-properties-file: './custom-properties.yml'
```

---

### Option 2: Organizations File (`orgs.yml`)

Define organizations in a YAML file with optional per-org setting overrides. Common settings can still be defined via action inputs (including member privilege inputs and `custom-properties-file`) — per-org overrides layer on top (same pattern as [`bulk-github-repo-settings-sync-action`](https://github.com/joshjohanning/bulk-github-repo-settings-sync-action) where action inputs define global defaults and the YAML file provides per-item overrides).

**Best for:** Managing multiple orgs with different settings, or when specific orgs need additional/different custom properties or member privileges.

> [!TIP]
> 📄 **See full example:** [sample-configuration/orgs.yml](sample-configuration/orgs.yml)

Create an `orgs.yml` file:

```yaml
orgs:
  - org: my-org
    # No custom-properties → inherits all base properties from custom-properties-file
    # No member-privileges → inherits all base settings from action inputs

  - org: my-other-org
    custom-properties-file: './config/custom-properties/other-org.yml' # Override base file for this org
    rulesets-file: # Override rulesets for this org (YAML array)
      - './config/rulesets/branch-protection.json'
      - './config/rulesets/tag-protection.json'
    delete-unmanaged-rulesets: true # Delete rulesets not in the config for this org
    delete-unmanaged-properties: true # Override the action input for this org
    custom-properties:
      # Override "team" to add extra allowed values for this org
      - name: team
        value-type: single_select
        required: true
        description: 'The team that owns this repository'
        allowed-values:
          - platform
          - frontend
          - backend
          - data-science # extra team only in this org
        values-editable-by: org_actors
    member-privileges:
      # Override specific member privilege settings for this org
      members-can-fork-private-repositories: true
      members-can-create-internal-repositories: true # GHEC/GHES only
```

Use in workflow:

```yml
- name: Sync Organization Settings
  uses: joshjohanning/bulk-github-org-settings-sync-action@v1
  with:
    github-token: ${{ secrets.ORG_ADMIN_TOKEN }}
    organizations-file: './orgs.yml'
    custom-properties-file: './config/custom-properties/base.yml' # Base properties for all orgs
    rulesets-file: './config/rulesets/branch-protection.json, ./config/rulesets/tag-protection.json' # Base rulesets for all orgs
    default-repository-permission: read # Base member privileges for all orgs
    members-can-fork-private-repositories: false
```

**Settings Merging:**

When using both `custom-properties-file` (base) and per-org `custom-properties` in the organizations file, settings are merged by property name. Per-org definitions override base definitions for the same property name; base properties not overridden are preserved:

```yaml
# custom-properties.yml (base):
- name: team             # → applied to all orgs
- name: cost-center      # → applied to all orgs

# orgs.yml:
orgs:
  - org: my-org          # gets: team + cost-center (base only)
  - org: my-other-org
    custom-properties:
      - name: team       # overrides base "team" with different allowed-values
                         # gets: team (overridden) + cost-center (from base)
```

The same merging applies to member privilege inputs (or `member-privileges-file`) and per-org `member-privileges` — per-org settings override base settings with the same key; base settings not overridden are preserved:

```yaml
# action inputs (base): default-repository-permission=read, members-can-fork-private-repositories=false

# orgs.yml:
orgs:
  - org: my-org # gets: read + no fork (base only)
  - org: my-other-org
    member-privileges:
      members-can-fork-private-repositories: true # override → fork allowed
      # gets: read (from base) + fork allowed (overridden)
```

---

## Syncing Custom Properties

Sync custom property definitions (schemas) to organizations. Properties define the metadata that can be set on repositories within the organization.

> [!TIP]
> 📄 **See full example:** [sample-configuration/custom-properties.yml](sample-configuration/custom-properties.yml)

Create a `custom-properties.yml` file:

```yaml
- name: team
  value-type: single_select
  required: true
  description: 'The team that owns this repository'
  allowed-values:
    - platform
    - frontend
    - backend
    - devops
    - security
  values-editable-by: org_actors

- name: environment
  value-type: multi_select
  required: false
  description: 'Deployment environments for this repository'
  allowed-values:
    - production
    - staging
    - development
  values-editable-by: org_and_repo_actors

- name: is-production
  value-type: true_false
  required: false
  default-value: 'false'
  description: 'Whether this repository is used in production'
  values-editable-by: org_actors

- name: cost-center
  value-type: string
  required: false
  description: 'Cost center code for billing'
  values-editable-by: org_actors
```

**Behavior:**

- If a custom property doesn't exist in the org, it is created
- If it exists but differs from the config, it is updated
- If content is identical, no changes are made
- With `delete-unmanaged-properties: true`, properties not in the config are deleted

### Custom Property Types

| Type            | Description                     | Requires `allowed-values` |
| --------------- | ------------------------------- | ------------------------- |
| `string`        | Free-form text                  | No                        |
| `single_select` | Single selection from a list    | Yes                       |
| `multi_select`  | Multiple selections from a list | Yes                       |
| `true_false`    | Boolean value                   | No                        |
| `url`           | URL value                       | No                        |

### Custom Property Fields

Each custom property supports these fields:

| Field                | Description                                         | Required    | Default      |
| -------------------- | --------------------------------------------------- | ----------- | ------------ |
| `name`               | Property name                                       | Yes         |              |
| `value-type`         | Property type (`string`, `single_select`, etc.)     | Yes         |              |
| `required`           | Whether a value is required for all repos           | No          | `false`      |
| `description`        | Human-readable description                          | No          |              |
| `default-value`      | Default value for new repositories                  | No          |              |
| `allowed-values`     | List of allowed values (required for select types)  | Conditional |              |
| `values-editable-by` | Who can edit: `org_actors` or `org_and_repo_actors` | No          | `org_actors` |

### Delete Unmanaged Properties

By default, syncing custom properties will create or update the specified properties, but will not delete other properties that may exist in the organization. To delete all other properties not defined in the config, use `delete-unmanaged-properties`:

```yml
- name: Sync Organization Settings
  uses: joshjohanning/bulk-github-org-settings-sync-action@v1
  with:
    github-token: ${{ secrets.ORG_ADMIN_TOKEN }}
    organizations: 'my-org'
    custom-properties-file: './custom-properties.yml'
    delete-unmanaged-properties: true
```

**Behavior with `delete-unmanaged-properties: true`:**

- Creates properties that don't exist
- Updates properties that differ from the config
- **Deletes all other properties not defined in the config**
- In dry-run mode, shows which properties would be deleted without actually deleting them

---

## Syncing Organization Rulesets

Sync organization-level rulesets across organizations. Rulesets define rules that apply to repositories within the organization (e.g., branch protection rules, tag rules). Each ruleset is defined in its own JSON file, and `rulesets-file` accepts comma-separated paths to sync multiple rulesets.

> [!TIP]
> 📄 **See full examples:** [sample-configuration/rulesets/](sample-configuration/rulesets/)

Create a JSON file for each ruleset (one ruleset per file):

**`rulesets/branch-protection.json`:**

```json
{
  "name": "org-branch-protection",
  "target": "branch",
  "enforcement": "active",
  "bypass_actors": [
    {
      "actor_id": 5,
      "actor_type": "RepositoryRole",
      "bypass_mode": "always"
    }
  ],
  "conditions": {
    "ref_name": {
      "include": ["~DEFAULT_BRANCH"],
      "exclude": []
    },
    "repository_name": {
      "include": ["~ALL"],
      "exclude": []
    }
  },
  "rules": [
    {
      "type": "deletion"
    },
    {
      "type": "non_fast_forward"
    },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 1,
        "dismiss_stale_reviews_on_push": true,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false,
        "automatic_copilot_code_review_enabled": false
      }
    }
  ]
}
```

**`rulesets/tag-protection.json`:**

```json
{
  "name": "org-tag-protection",
  "target": "tag",
  "enforcement": "active",
  "conditions": {
    "ref_name": {
      "include": ["~ALL"],
      "exclude": []
    },
    "repository_name": {
      "include": ["~ALL"],
      "exclude": []
    }
  },
  "rules": [
    {
      "type": "deletion"
    },
    {
      "type": "non_fast_forward"
    }
  ]
}
```

Sync both rulesets using comma-separated paths:

```yml
- name: Sync Organization Settings
  uses: joshjohanning/bulk-github-org-settings-sync-action@v1
  with:
    github-token: ${{ secrets.ORG_ADMIN_TOKEN }}
    organizations: 'my-org'
    rulesets-file: './rulesets/branch-protection.json, ./rulesets/tag-protection.json'
```

> [!TIP]
> The JSON format matches the [GitHub REST API for organization rulesets](https://docs.github.com/en/rest/orgs/rules). You can export an existing ruleset from your organization via the API as a starting point, but exported responses may include read-only fields (e.g., `id`, `source`, `node_id`) that are automatically stripped before create/update operations.

**Behavior:**

- If a ruleset with the same name doesn't exist, it is created
- If it exists but differs from the config, it is updated
- If content is identical, no changes are made
- With `delete-unmanaged-rulesets: true`, rulesets not matching any managed name are deleted

### Per-Org Rulesets Override

In `orgs.yml`, use a YAML array to override rulesets for a specific org:

```yaml
orgs:
  - org: my-org
    # inherits base rulesets-file from action input

  - org: my-other-org
    rulesets-file:
      - './config/rulesets/branch-protection.json'
      - './config/rulesets/tag-protection.json'
    delete-unmanaged-rulesets: true
```

### Delete Unmanaged Rulesets

By default, syncing rulesets will create or update the specified rulesets, but will not delete other rulesets that may exist in the organization. To delete all other rulesets besides those being synced, use `delete-unmanaged-rulesets`:

```yml
- name: Sync Organization Settings
  uses: joshjohanning/bulk-github-org-settings-sync-action@v1
  with:
    github-token: ${{ secrets.ORG_ADMIN_TOKEN }}
    organizations: 'my-org'
    rulesets-file: './rulesets/branch-protection.json, ./rulesets/tag-protection.json'
    delete-unmanaged-rulesets: true
```

**Behavior with `delete-unmanaged-rulesets: true`:**

- Creates rulesets that don't exist
- Updates rulesets that differ from the config
- **Deletes all other rulesets not matching any managed ruleset name**
- In dry-run mode, shows which rulesets would be deleted without actually deleting them

---

## Syncing Member Privileges

Sync organization-level member privilege settings (repository policies) across organizations. These control what members can do within the organization, such as creating repositories, forking private repos, and managing pages.

Set member privilege settings directly as action inputs:

```yml
- name: Sync Organization Settings
  uses: joshjohanning/bulk-github-org-settings-sync-action@v1
  with:
    github-token: ${{ secrets.ORG_ADMIN_TOKEN }}
    organizations: 'my-org'
    default-repository-permission: read
    members-can-fork-private-repositories: false
    members-can-create-internal-repositories: false # GHEC/GHES only
    default-repository-branch: main
```

Alternatively, define all settings in a separate file via `member-privileges-file`:

> [!TIP]
> 📄 **See full example:** [sample-configuration/member-privileges.yml](sample-configuration/member-privileges.yml)

```yml
- name: Sync Organization Settings
  uses: joshjohanning/bulk-github-org-settings-sync-action@v1
  with:
    github-token: ${{ secrets.ORG_ADMIN_TOKEN }}
    organizations: 'my-org'
    member-privileges-file: './member-privileges.yml'
```

**Behavior:**

- Only settings included in the config are managed — omitted settings remain unchanged
- If a setting already matches the config, no API call is made
- Settings are applied via a single `PATCH /orgs/{org}` call per organization
- In dry-run mode, shows which settings would be changed without applying them
- When both individual inputs and `member-privileges-file` are provided, the file takes precedence for any conflicting keys

### Member Privilege Settings

| Setting                                       | Type    | Description                                                          |
| --------------------------------------------- | ------- | -------------------------------------------------------------------- |
| `default-repository-permission`               | string  | Default permission for org members: `read`, `write`, `admin`, `none` |
| `members-can-create-public-repositories`      | boolean | Can members create public repositories                               |
| `members-can-create-private-repositories`     | boolean | Can members create private repositories                              |
| `members-can-create-internal-repositories`    | boolean | Can members create internal repositories (GHEC/GHES only)            |
| `members-can-fork-private-repositories`       | boolean | Can members fork private repositories                                |
| `members-can-create-pages`                    | boolean | Can members create GitHub Pages sites                                |
| `members-can-create-public-pages`             | boolean | Can members create public GitHub Pages sites                         |
| `members-can-create-private-pages`            | boolean | Can members create private GitHub Pages sites                        |
| `members-can-invite-outside-collaborators`    | boolean | Can members invite outside collaborators                             |
| `members-can-create-teams`                    | boolean | Can members create teams                                             |
| `members-can-delete-repositories`             | boolean | Can members delete repositories                                      |
| `members-can-change-repo-visibility`          | boolean | Can members change repository visibility                             |
| `members-can-delete-issues`                   | boolean | Can members delete issues                                            |
| `default-repository-branch`                   | string  | Default branch name for new repositories                             |
| `deploy-keys-enabled-for-repositories`        | boolean | Whether deploy keys can be added to repositories                     |
| `readers-can-create-discussions`              | boolean | Can users with read access create discussions                        |
| `members-can-view-dependency-insights`        | boolean | Can members view dependency insights                                 |
| `display-commenter-full-name-setting-enabled` | boolean | Display commenter full name in issues and PRs                        |

### Per-Org Member Privilege Overrides

In `orgs.yml`, use `member-privileges` to override specific settings for an org:

```yaml
orgs:
  - org: my-org
    # inherits base member-privileges-file from action input

  - org: my-other-org
    member-privileges:
      members-can-fork-private-repositories: true # override base
      members-can-create-internal-repositories: true # GHEC/GHES only
```

---

## Action Inputs

| Input                                         | Description                                                                         | Required | Default                 |
| --------------------------------------------- | ----------------------------------------------------------------------------------- | -------- | ----------------------- |
| `github-token`                                | GitHub token for API access (requires `admin:org` scope)                            | Yes      |                         |
| `github-api-url`                              | GitHub API URL (e.g., `https://api.github.com` or `https://ghes.domain.com/api/v3`) | No       | `${{ github.api_url }}` |
| `organizations`                               | Comma-separated list of organization names                                          | No       |                         |
| `organizations-file`                          | Path to YAML file containing organization settings configuration                    | No       |                         |
| `custom-properties-file`                      | Path to a YAML file defining custom property schemas                                | No       |                         |
| `delete-unmanaged-properties`                 | Delete custom properties not defined in the configuration file                      | No       | `false`                 |
| `member-privileges-file`                      | Path to a YAML file defining member privilege settings (alternative to inputs)      | No       |                         |
| `default-repository-permission`               | Default permission for org members: `read`, `write`, `admin`, `none`                | No       |                         |
| `members-can-create-public-repositories`      | Whether members can create public repositories                                      | No       |                         |
| `members-can-create-private-repositories`     | Whether members can create private repositories                                     | No       |                         |
| `members-can-create-internal-repositories`    | Whether members can create internal repositories (GHEC/GHES only)                   | No       |                         |
| `members-can-fork-private-repositories`       | Whether members can fork private repositories                                       | No       |                         |
| `members-can-create-pages`                    | Whether members can create GitHub Pages sites                                       | No       |                         |
| `members-can-create-public-pages`             | Whether members can create public GitHub Pages sites                                | No       |                         |
| `members-can-create-private-pages`            | Whether members can create private GitHub Pages sites                               | No       |                         |
| `members-can-invite-outside-collaborators`    | Whether members can invite outside collaborators                                    | No       |                         |
| `members-can-create-teams`                    | Whether members can create teams                                                    | No       |                         |
| `members-can-delete-repositories`             | Whether members can delete repositories                                             | No       |                         |
| `members-can-change-repo-visibility`          | Whether members can change repository visibility                                    | No       |                         |
| `members-can-delete-issues`                   | Whether members can delete issues                                                   | No       |                         |
| `default-repository-branch`                   | Default branch name for new repositories                                            | No       |                         |
| `deploy-keys-enabled-for-repositories`        | Whether deploy keys can be added to repositories                                    | No       |                         |
| `readers-can-create-discussions`              | Whether users with read access can create discussions                               | No       |                         |
| `members-can-view-dependency-insights`        | Whether members can view dependency insights                                        | No       |                         |
| `display-commenter-full-name-setting-enabled` | Whether to display commenter full name in issues and PRs                            | No       |                         |
| `rulesets-file`                               | Comma-separated paths to JSON files, each with a single org ruleset config          | No       |                         |
| `delete-unmanaged-rulesets`                   | Delete all other rulesets besides those being synced                                | No       | `false`                 |
| `dry-run`                                     | Preview changes without applying them                                               | No       | `false`                 |

> [!NOTE]
> You must provide either `organizations` or `organizations-file`. Member privilege settings can be provided as individual inputs (e.g., `default-repository-permission`) or via `member-privileges-file` — when both are used, the file takes precedence for conflicting keys. Per-org overrides in `organizations-file` layer on top of the base.

## Action Outputs

| Output                    | Description                                                          |
| ------------------------- | -------------------------------------------------------------------- |
| `updated-organizations`   | Number of organizations successfully processed (changed + unchanged) |
| `changed-organizations`   | Number of organizations with changes (or would have in dry-run mode) |
| `unchanged-organizations` | Number of organizations with no changes                              |
| `failed-organizations`    | Number of organizations that failed to update                        |
| `warning-organizations`   | Number of organizations that emitted warnings                        |
| `results`                 | JSON array of update results for each organization                   |

## Dry-Run Mode

Use `dry-run: true` to preview what changes would be made without actually applying them. The job summary will show all planned changes prefixed with "Would":

```text
🔍 DRY-RUN MODE: No changes will be applied
  🆕 Would Create custom property: team
  🆕 Would Create custom property: environment
  📝 Would Update custom property: is-production (required: false → true)
```

## Development

### Setup

```bash
npm install
```

### Available Scripts

```bash
npm test              # Run tests
npm run lint          # Check code quality with ESLint
npm run format:write  # Run Prettier for formatting
npm run package       # Bundle for distribution
npm run all           # Run format, lint, test, coverage, and package
```

### Testing Locally

```bash
env 'INPUT_GITHUB-TOKEN=ghp_xxx' \
    'INPUT_ORGANIZATIONS=my-org' \
    'INPUT_CUSTOM-PROPERTIES-FILE=./sample-configuration/custom-properties.yml' \
    'INPUT_DRY-RUN=true' \
    node "$(pwd)/src/index.js"
```

## Working Example

For a complete working example of this action in use, see the [sync-github-org-settings](https://github.com/joshjohanning/sync-github-org-settings) repository:

- **[orgs.yml](https://github.com/joshjohanning/sync-github-org-settings/blob/main/orgs.yml)** - Example configuration file with per-org overrides
- **[sync-github-org-settings.yml](https://github.com/joshjohanning/sync-github-org-settings/blob/main/.github/workflows/sync-github-org-settings.yml)** - Example workflow using a GitHub App token

**Example workflow:**

```yml
name: sync-github-org-settings

on:
  push:
    branches: ['main']
  pull_request:
    branches: ['main']
  workflow_dispatch:

jobs:
  sync-github-org-settings:
    runs-on: ubuntu-latest
    if: github.actor != 'dependabot[bot]'
    permissions:
      contents: read

    steps:
      - uses: actions/checkout@v6

      - uses: actions/create-github-app-token@v3
        id: app-token
        with:
          app-id: ${{ vars.APP_ID }}
          private-key: ${{ secrets.APP_PRIVATE_KEY }}
          owner: ${{ github.repository_owner }}

      - name: Sync Organization Settings
        uses: joshjohanning/bulk-github-org-settings-sync-action@v1
        with:
          github-token: ${{ steps.app-token.outputs.token }}
          organizations-file: 'orgs.yml'
          custom-properties-file: './config/custom-properties/base.yml'
          dry-run: ${{ github.event_name == 'pull_request' }} # dry run if PR
```

## Important Notes

- Settings not specified will remain unchanged
- Custom properties and member privileges that already match the config are skipped (no unnecessary API calls)
- Failed updates are logged as warnings but don't fail the action; if one or more organizations fail entirely, the action is marked as failed
- With `delete-unmanaged-properties: true`, properties not in the config are **deleted** from the organization
- `members-can-create-internal-repositories` only applies to organizations on GitHub Enterprise Cloud (GHEC) or GitHub Enterprise Server (GHES)

## Contributing

Contributions are welcome! See the [Development](#development) section for setup instructions.
