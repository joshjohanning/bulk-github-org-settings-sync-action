# Bulk GitHub Organization Settings Sync Action

[![GitHub release](https://img.shields.io/github/release/joshjohanning/bulk-github-org-settings-sync-action.svg?logo=github&labelColor=333)](https://github.com/joshjohanning/bulk-github-org-settings-sync-action/releases)
[![Immutable releases](https://img.shields.io/badge/releases-immutable-blue?labelColor=333)](https://docs.github.com/en/code-security/supply-chain-security/understanding-your-software-supply-chain/immutable-releases)
[![GitHub marketplace](https://img.shields.io/badge/marketplace-Bulk%20GitHub%20Organization%20Settings%20Sync-blue?logo=github&labelColor=333)](https://github.com/marketplace/actions/bulk-github-organization-settings-sync)
[![CI](https://github.com/joshjohanning/bulk-github-org-settings-sync-action/actions/workflows/ci.yml/badge.svg)](https://github.com/joshjohanning/bulk-github-org-settings-sync-action/actions/workflows/ci.yml)
[![Publish GitHub Action](https://github.com/joshjohanning/bulk-github-org-settings-sync-action/actions/workflows/publish.yml/badge.svg)](https://github.com/joshjohanning/bulk-github-org-settings-sync-action/actions/workflows/publish.yml)
![Coverage](./badges/coverage.svg)

🏢 Bulk configure GitHub organization settings (custom properties, security, member privileges) across multiple orgs using a declarative YAML config

## What's new

Please refer to the [release page](https://github.com/joshjohanning/bulk-github-org-settings-sync-action/releases) for the latest release notes.

## Features

- 🏷️ Sync custom property definitions across organizations
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

## Organization Selection Methods

This action supports two approaches for selecting which organizations to manage. Choose based on your needs:

| Approach                                                                         | Best For                                                 | Configuration File                           |
| -------------------------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------- |
| [**Option 1: Organization List**](#option-1-organization-list)                   | Simple setup, same settings applied to all orgs          | `custom-properties.yml`                      |
| [**Option 2: Organizations File**](#option-2-organizations-file-org-settingsyml) | Per-org overrides, different settings for different orgs | `org-settings.yml` + `custom-properties.yml` |

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

### Option 2: Organizations File (`org-settings.yml`)

Define organizations in a YAML file with optional per-org setting overrides. Common settings can still be defined via `custom-properties-file` — per-org overrides layer on top (same pattern as [`bulk-github-repo-settings-sync-action`](https://github.com/joshjohanning/bulk-github-repo-settings-sync-action) where action inputs define global defaults and the YAML file provides per-item overrides).

**Best for:** Managing multiple orgs with different settings, or when specific orgs need additional/different custom properties.

> [!TIP]
> 📄 **See full example:** [sample-configuration/org-settings.yml](sample-configuration/org-settings.yml)

Create an `org-settings.yml` file:

```yaml
orgs:
  - org: my-org
    # No custom-properties → inherits all base properties from custom-properties-file

  - org: my-other-org
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
```

Use in workflow:

```yml
- name: Sync Organization Settings
  uses: joshjohanning/bulk-github-org-settings-sync-action@v1
  with:
    github-token: ${{ secrets.ORG_ADMIN_TOKEN }}
    organizations-file: './org-settings.yml'
    custom-properties-file: './custom-properties.yml' # Base properties for all orgs
```

**Settings Merging:**

When using both `custom-properties-file` (base) and per-org `custom-properties` in the organizations file, settings are merged by property name. Per-org definitions override base definitions for the same property name; base properties not overridden are preserved:

```yaml
# custom-properties.yml (base):
- name: team            # → applied to all orgs
- name: cost-center     # → applied to all orgs

# org-settings.yml:
orgs:
  - org: my-org          # gets: team + cost-center (base only)
  - org: my-other-org
    custom-properties:
      - name: team       # overrides base "team" with different allowed-values
                          # gets: team (overridden) + cost-center (from base)
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

## Action Inputs

| Input                         | Description                                                                         | Required | Default                 |
| ----------------------------- | ----------------------------------------------------------------------------------- | -------- | ----------------------- |
| `github-token`                | GitHub token for API access (requires `admin:org` scope)                            | Yes      |                         |
| `github-api-url`              | GitHub API URL (e.g., `https://api.github.com` or `https://ghes.domain.com/api/v3`) | No       | `${{ github.api_url }}` |
| `organizations`               | Comma-separated list of organization names                                          | No       |                         |
| `organizations-file`          | Path to YAML file containing organization settings configuration                    | No       |                         |
| `custom-properties-file`      | Path to a YAML file defining custom property schemas                                | No       |                         |
| `delete-unmanaged-properties` | Delete custom properties not defined in the configuration file                      | No       | `false`                 |
| `dry-run`                     | Preview changes without applying them                                               | No       | `false`                 |

> **Note:** You must provide either `organizations` or `organizations-file`. The `custom-properties-file` input provides base properties for all orgs and can be combined with either approach. Per-org overrides in `organizations-file` layer on top of the base.

## Action Outputs

| Output                    | Description                                                          |
| ------------------------- | -------------------------------------------------------------------- |
| `updated-organizations`   | Number of organizations successfully processed (changed + unchanged) |
| `changed-organizations`   | Number of organizations with changes (or would have in dry-run mode) |
| `unchanged-organizations` | Number of organizations with no changes                              |
| `failed-organizations`    | Number of organizations that failed to update                        |
| `warning-organizations`   | Number of organizations that emitted warnings                        |
| `results`                 | JSON array of update results for each organization                   |

## Permissions

This action requires a token with **`admin:org`** scope (classic PAT) or equivalent fine-grained permissions for managing organization custom properties.

When using a **GitHub App**, the app needs the `Organization Custom Properties` permission set to **Read & Write**.

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
    node src/index.js
```
