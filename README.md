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
- 🏷️ Sync custom property values onto selected organization repositories
- 📋 Sync organization-level rulesets across organizations
- 🏷️ Sync issue type definitions across organizations
- 🧩 Sync issue field definitions across organizations
- 🔧 Sync member privileges and repository policies across organizations
- 📁 Sync `.github` and `.github-private` repository files across organizations (via PR)
- 🔒 Sync code security configurations across organizations
- 🔒 Sync GitHub Actions security and policy settings across organizations
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

### Sync .github Repository Files

Sync a local directory to the `.github` (and/or `.github-private`) repository across organizations. The action compares local files against the target repository and creates a PR with any creates/updates:

```yml
- name: Sync .github repo files
  uses: joshjohanning/bulk-github-org-settings-sync-action@v1
  with:
    github-token: ${{ secrets.ORG_ADMIN_TOKEN }}
    organizations: 'my-org,my-other-org'
    dot-github-source-dir: './dot-github-template'
    dot-github-private-source-dir: './dot-github-private-template'
    dry-run: ${{ github.event_name == 'pull_request' }}
```

This sync is intentionally non-destructive: it creates or updates files present in the source directory, but it does not delete remote-only files from `.github` or `.github-private`.

---

## Authentication

### GitHub App (Recommended)

For stronger security and higher rate limits, use a GitHub App:

1. Create a GitHub App with the following permissions:

   **Organization permissions:**
   - **Administration**: Read and write (required for managing organization settings, rulesets, and organization role team assignments)
   - **Custom properties**: Admin (required for managing custom property definitions) or Write (required for managing repository custom property values)
   - **Custom organization roles**: Write (required for managing custom organization roles)
   - **Custom repository roles**: Write (required for managing custom repository roles)
   - **Issue types**: Write (required for managing issue type definitions)
   - **Issue fields**: Write (required for managing issue field definitions)

   **Repository permissions** _(only required for `.github`/`.github-private` repo sync)_:
   - **Contents**: Read and write
   - **Workflows**: Read and write (required if syncing workflow files)
   - **Pull requests**: Read and write

2. Install it to your organization(s)
3. Add `APP_CLIENT_ID` as a repository variable and `APP_PRIVATE_KEY` as a repository secret

If a sync step warns that it could not fetch existing settings with status `403` or `404`, re-check the matching GitHub App permission above and re-approve the app installation. GitHub can return `404` for inaccessible organization resources, not only missing resources.

```yml
- name: Generate GitHub App Token
  id: app-token
  uses: actions/create-github-app-token@v3
  with:
    client-id: ${{ vars.APP_CLIENT_ID }}
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

**Optional: `base-path`**

Use the `base-path` top-level property to avoid repeating a common directory prefix for all file-path settings (`custom-properties-file`, `custom-property-values-file`, `issue-types-file`, `issue-fields-file`, `rulesets-file`). Relative paths in per-org overrides are resolved relative to `base-path`. Absolute paths are left unchanged.

```yaml
base-path: './config/'
orgs:
  - org: my-org
    custom-properties-file: 'custom-properties/base.yml' # resolved to ./config/custom-properties/base.yml
    issue-types-file: 'issue-types/base.yml' # resolved to ./config/issue-types/base.yml
    rulesets-file: 'rulesets/branch-protection.json' # resolved to ./config/rulesets/branch-protection.json
  - org: my-other-org
    custom-properties-file: 'custom-properties/other-org.yml'
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

The same merging applies to member privilege inputs and per-org `member-privileges` — per-org settings override base settings with the same key; base settings not overridden are preserved:

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

## Per-Org Overrides: Inline vs File-Based

Most features that accept a base configuration file (e.g. `custom-properties-file`) also support **per-org overrides** in `orgs.yml`. For each of these features you can override per org in one of two equivalent ways:

- **Inline** — embed the config directly under the org entry (e.g. `custom-properties: [...]`)
- **File-based** — point the org at a different file (e.g. `custom-properties-file: './config/other-org.yml'`)

The file-based form lets you keep per-org config in separate files while still using a single `orgs.yml` to map orgs. Use whichever form is more convenient for each org — you can mix and match across orgs in the same `orgs.yml`.

### Supported features

| Feature                            | Inline key                           | File-path key                             | Per-org semantics                  |
| ---------------------------------- | ------------------------------------ | ----------------------------------------- | ---------------------------------- |
| Custom properties                  | `custom-properties`                  | `custom-properties-file`                  | Merge by `name` with base          |
| Custom property values             | `custom-property-values`             | `custom-property-values-file`             | File replaces base; inline appends |
| Issue types                        | `issue-types`                        | `issue-types-file`                        | Merge by `name` with base          |
| Issue fields                       | `issue-fields`                       | `issue-fields-file`                       | Merge by `name` with base          |
| Custom organization roles          | `custom-org-roles`                   | `custom-org-roles-file`                   | Merge by `name` with base          |
| Custom repository roles            | `custom-repo-roles`                  | `custom-repo-roles-file`                  | Merge by `name` with base          |
| Code security configurations       | `code-security-configurations`       | `code-security-configurations-file`       | Merge by `name` with base          |
| Organization role team assignments | `organization-role-team-assignments` | `organization-role-team-assignments-file` | Replaces base for that org         |
| Member privileges                  | `member-privileges`                  | _(direct action inputs serve as base)_    | Per-key override of base           |
| Organization profile               | `org-profile`                        | _(direct action inputs serve as base)_    | Per-key override of base           |
| Actions policy                     | `actions-policy`                     | _(direct action inputs serve as base)_    | Per-key override of base           |
| Rulesets                           | _(file only — no inline form)_       | `rulesets-file` (string or YAML array)    | Replaces base for that org         |
| Actions allow list                 | _(file only — no inline form)_       | `actions-allow-list-file`                 | Replaces base for that org         |

### Precedence

For features that support both forms, precedence is:

1. **Inline** per-org config (highest)
2. **File-based** per-org config (`*-file` under the org entry)
3. **Base** input/file (lowest — applied to all orgs that don't override)

When both inline and file-based per-org overrides are set for the same org:

- For **replace-semantics** features (currently `organization-role-team-assignments`), inline takes precedence and the per-org file is ignored.
- For **merge-by-name** features (`custom-properties`, `issue-types`, `issue-fields`, `custom-org-roles`, `custom-repo-roles`, `code-security-configurations`), the per-org file becomes that org's base and inline entries then merge on top by `name`.
- For **custom property values**, the per-org file replaces the base values file for that org, and inline `custom-property-values` rules append after file rules. Later rules win if they set the same property on the same repository.

### Merge vs replace

- **Merge by `name`** — per-org list items with the same `name` override the base item; other base items are preserved.
- **File replaces base; inline appends** — the per-org file replaces the base file, then inline per-org rules are appended and can override earlier rules by order.
- **Replaces base for that org** — the entire per-org value replaces the base (no merge).
- **Per-key override of base** — keys present in the per-org block override base values for those keys only; other base keys are preserved.

> [!TIP]
> 📄 **See full example:** [sample-configuration/orgs.yml](sample-configuration/orgs.yml)

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

> [!NOTE]
> GitHub API-style underscore aliases are also accepted for custom property fields:
> `value_type`, `default_value`, `allowed_values`, and `values_editable_by`.
> Hyphenated fields remain supported in v1 for backward compatibility, but are planned to be removed in v2.

### Per-Org Custom Properties Overrides

In `orgs.yml`, override custom properties per org either inline or by pointing at a different file. Per-org properties are merged with the base by `name`; see [Per-Org Overrides: Inline vs File-Based](#per-org-overrides-inline-vs-file-based) for precedence and merge rules.

```yaml
orgs:
  - org: my-org
    # inherits base custom-properties-file as-is

  - org: inline-org
    custom-properties: # inline override (merges with base by name)
      - name: team
        value-type: single_select
        required: true
        allowed-values: [platform, frontend, backend, data-science]
        values-editable-by: org_actors
    delete-unmanaged-properties: true

  - org: file-based-org
    custom-properties-file: './config/custom-properties/file-based-org.yml' # file-based override
```

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

## Syncing Custom Property Values

Sync custom property values onto repositories in each organization. This assigns values for properties that already exist in the org schema, such as setting `team=platform` on selected repositories.

> [!TIP]
> 📄 **See full example:** [sample-configuration/custom-property-values.yml](sample-configuration/custom-property-values.yml)

Create a `custom-property-values.yml` file:

```yaml
- repositories:
    names:
      - api
      - web
    names-file: teams/platform-repos.yml
    query: 'topic:platform archived:false'
  properties:
    team: platform
    environment:
      - production
      - staging

- repositories:
    names-file: teams/infra-repos.yml
  properties:
    team: infrastructure
```

Use it in a workflow:

```yml
- name: Sync Organization Settings
  uses: joshjohanning/bulk-github-org-settings-sync-action@v1
  with:
    github-token: ${{ secrets.ORG_ADMIN_TOKEN }}
    organizations: 'my-org'
    custom-properties-file: './custom-properties.yml'
    custom-property-values-file: './custom-property-values.yml'
    dry-run: ${{ github.event_name == 'pull_request' }}
```

**Repository selectors:**

| Selector                  | Description                                                                                                                                                                                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `repositories.names`      | Explicit bare repository names in the current org. `org/repo` is rejected because the action already runs per org and the API accepts bare names.                                                                                                            |
| `repositories.names-file` | YAML file containing a list of bare repository names. Paths are resolved relative to the custom property values file that references them. Inline `orgs.yml` rules resolve relative to `base-path`, or the `orgs.yml` directory when `base-path` is not set. |
| `repositories.query`      | GitHub repository query passed to `GET /orgs/{org}/properties/values` as `repository_query`.                                                                                                                                                                 |

Selectors in one rule are unioned. Missing repositories from `names` or `names-file` warn and are skipped. Query selectors that match zero repositories warn and continue.

`names-file` is useful when a team owns a repo list through CODEOWNERS and normal pull request review:

```yaml
# teams/platform-repos.yml
- api
- web
- worker
```

> [!IMPORTANT]
> CODEOWNERS provides review and audit workflow, not an authorization boundary. The token running this action can still apply values to any repository it can manage.

**Conflict and update behavior:**

- Rules are resolved before any writes happen.
- If multiple rules set the same property on the same repo, later rules win and a warning is logged.
- If multiple rules set different properties on the same repo, the values are merged.
- Existing unmanaged values are left alone. To unset a value, set that property to `null` explicitly.
- `multi_select` values are compared order-insensitively to avoid unnecessary updates.
- Updates are batched in groups of up to 30 repositories, matching GitHub's API limit.

> [!NOTE]
> Query selectors depend on GitHub repository search behavior and can be affected by indexing latency or result limits. Prefer `names` or `names-file` for large or freshness-sensitive selections.

### Per-Org Custom Property Value Overrides

In `orgs.yml`, use `custom-property-values-file` to replace the base values file for a specific org, and `custom-property-values` to append org-specific rules after file rules:

```yaml
orgs:
  - org: my-org
    # inherits base custom-property-values-file as-is

  - org: my-other-org
    custom-property-values-file: './config/custom-property-values/other-org.yml'
    custom-property-values:
      - repositories:
          names: [special-service]
        properties:
          team: platform
```

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

Rulesets are **file-only** — there is no inline form. Override per org by pointing `rulesets-file` at a different set of JSON files. Per-org rulesets replace the base for that org. See [Per-Org Overrides: Inline vs File-Based](#per-org-overrides-inline-vs-file-based) for precedence.

```yaml
orgs:
  - org: my-org
    # inherits base rulesets-file from action input

  - org: my-other-org
    rulesets-file: # YAML array of JSON file paths (replaces base for this org)
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

## Syncing Issue Types

Sync organization-level issue type definitions across organizations. Issue types define the categories (e.g., Bug, Feature, Task) that can be assigned to issues within the organization.

Create an `issue-types.yml` file:

```yaml
- name: Bug
  description: 'Something is broken'
  color: 'ff0000'

- name: Feature
  description: 'A new feature request'
  color: '0e8a16'

- name: Task
  description: 'A unit of work'
  color: 'fbca04'
  is-enabled: true
```

Use in workflow:

```yml
- name: Sync Organization Settings
  uses: joshjohanning/bulk-github-org-settings-sync-action@v1
  with:
    github-token: ${{ secrets.ORG_ADMIN_TOKEN }}
    organizations: 'my-org'
    issue-types-file: './issue-types.yml'
```

**Behavior:**

- If an issue type with the same name doesn't exist, it is created
- If it exists but differs from the config, it is updated
- If content is identical, no changes are made
- With `delete-unmanaged-issue-types: true`, issue types not in the config are deleted

### Issue Type Fields

Each issue type supports these fields:

| Field         | Description                                                                                                         | Required | Default |
| ------------- | ------------------------------------------------------------------------------------------------------------------- | -------- | ------- |
| `name`        | Issue type name                                                                                                     | Yes      |         |
| `description` | Human-readable description                                                                                          | No       |         |
| `color`       | Named color (`gray`, `blue`, `green`, `yellow`, `orange`, `red`, `pink`, `purple`) or 6-character hex (without `#`) | No       |         |
| `is-enabled`  | Whether the issue type is enabled                                                                                   | No       | `true`  |

Color values are normalized case-insensitively before comparison to avoid unnecessary updates when only letter casing differs.

### Per-Org Issue Types Override

In `orgs.yml`, override issue types per org either inline or by pointing at a different file. Per-org issue types are merged with the base by `name`; see [Per-Org Overrides: Inline vs File-Based](#per-org-overrides-inline-vs-file-based) for precedence and merge rules.

```yaml
orgs:
  - org: my-org
    # inherits base issue-types-file from action input

  - org: inline-org
    issue-types: # inline override (merges with base by name)
      - name: Bug
        description: 'Critical bug for this org'
        color: 'ff0000'
    delete-unmanaged-issue-types: true

  - org: file-based-org
    issue-types-file: './config/issue-types/file-based-org.yml' # file-based override
```

### Delete Unmanaged Issue Types

By default, syncing issue types will create or update the specified types, but will not delete other issue types that may exist in the organization. To delete all other issue types not defined in the config, use `delete-unmanaged-issue-types`:

```yml
- name: Sync Organization Settings
  uses: joshjohanning/bulk-github-org-settings-sync-action@v1
  with:
    github-token: ${{ secrets.ORG_ADMIN_TOKEN }}
    organizations: 'my-org'
    issue-types-file: './issue-types.yml'
    delete-unmanaged-issue-types: true
```

**Behavior with `delete-unmanaged-issue-types: true`:**

- Creates issue types that don't exist
- Updates issue types that differ from the config
- **Deletes all other issue types not defined in the config**
- In dry-run mode, shows which issue types would be deleted without actually deleting them

---

## Syncing Issue Fields

Sync organization-level issue field definitions across organizations. Issue fields let you add structured metadata (for example priority, effort, target date) to issues.

> [!TIP]
> 📄 **See full example:** [sample-configuration/issue-fields.yml](sample-configuration/issue-fields.yml)

Create an `issue-fields.yml` file:

```yaml
- name: Priority
  description: 'Issue priority'
  data-type: single_select
  visibility: organization_members_only
  options:
    - name: Urgent
      color: red
      priority: 1
    - name: High
      color: orange
      priority: 2
    - name: Medium
      color: yellow
      priority: 3
    - name: Low
      color: green
      priority: 4

- name: Target date
  description: 'Target completion date'
  data-type: date
```

Use in workflow:

```yml
- name: Sync Organization Settings
  uses: joshjohanning/bulk-github-org-settings-sync-action@v1
  with:
    github-token: ${{ secrets.ORG_ADMIN_TOKEN }}
    organizations: 'my-org'
    issue-fields-file: './issue-fields.yml'
```

**Behavior:**

- If an issue field with the same name doesn't exist, it is created
- If it exists but differs from the config, it is updated
- If content is identical, no changes are made
- With `delete-unmanaged-issue-fields: true`, issue fields not in the config are deleted

### Issue Field Fields

Each issue field supports these fields:

| Field         | Description                                                                        | Required    | Default     |
| ------------- | ---------------------------------------------------------------------------------- | ----------- | ----------- |
| `name`        | Issue field name                                                                   | Yes         |             |
| `description` | Human-readable description                                                         | No          |             |
| `data-type`   | Field type: `text`, `date`, `single_select`, `number`                              | Yes         |             |
| `visibility`  | Field visibility: `organization_members_only` or `all`                             | No          | API default |
| `options`     | Required for `single_select`; list of options with `name`, `color`, and `priority` | Conditional |             |

### Per-Org Issue Fields Override

In `orgs.yml`, override issue fields per org either inline or by pointing at a different file. Per-org issue fields are merged with the base by `name`; see [Per-Org Overrides: Inline vs File-Based](#per-org-overrides-inline-vs-file-based) for precedence and merge rules.

```yaml
orgs:
  - org: my-org
    # inherits base issue-fields-file from action input

  - org: inline-org
    issue-fields: # inline override (merges with base by name)
      - name: Priority
        data-type: single_select
        options:
          - name: Critical
            color: red
            priority: 1
          - name: Normal
            color: yellow
            priority: 2
    delete-unmanaged-issue-fields: true

  - org: file-based-org
    issue-fields-file: './config/issue-fields/file-based-org.yml' # file-based override
```

### Delete Unmanaged Issue Fields

By default, syncing issue fields will create or update the specified fields, but will not delete other issue fields that may exist in the organization. To delete all other issue fields not defined in the config, use `delete-unmanaged-issue-fields`:

```yml
- name: Sync Organization Settings
  uses: joshjohanning/bulk-github-org-settings-sync-action@v1
  with:
    github-token: ${{ secrets.ORG_ADMIN_TOKEN }}
    organizations: 'my-org'
    issue-fields-file: './issue-fields.yml'
    delete-unmanaged-issue-fields: true
```

---

## Syncing Custom Organization Roles

> [!IMPORTANT]
> Custom organization roles require **GitHub Enterprise Cloud (GHEC)**.

Sync custom organization roles across organizations. These define custom roles with specific organization-level permissions that can be assigned to members.

> [!TIP]
> 📄 **See full examples:** [sample-configuration/custom-org-roles.yml](sample-configuration/custom-org-roles.yml)

Create a YAML file defining your custom organization roles:

**`custom-org-roles.yml`:**

```yaml
- name: Security Auditor
  description: 'Can view security alerts and manage security settings'
  permissions:
    - read_audit_log
    - manage_organization_security

- name: CI/CD Manager
  description: 'Can manage Actions settings and self-hosted runners'
  permissions:
    - manage_organization_actions_settings
    - manage_organization_runners
```

Then reference it in your workflow:

```yml
- name: Sync Organization Settings
  uses: joshjohanning/bulk-github-org-settings-sync-action@v1
  with:
    github-token: ${{ secrets.ORG_ADMIN_TOKEN }}
    organizations: 'my-org,my-other-org'
    custom-org-roles-file: './custom-org-roles.yml'
    delete-unmanaged-org-roles: false
```

**Behavior:**

- Creates new roles that don't exist yet
- Updates roles that differ from the config (description or permissions)
- Only applies changes when the role definition differs from what's already configured
- In dry-run mode, shows what would be changed without applying

### `delete-unmanaged-org-roles`

When `delete-unmanaged-org-roles: true`:

- Creates and updates roles from the config
- **Deletes all other custom org roles not defined in the config**
- In dry-run mode, shows which roles would be deleted without actually deleting them

### Per-Org Custom Org Roles Overrides

In `orgs.yml`, override custom org roles per org either inline or by pointing at a different file. Per-org roles are merged with the base by `name`; see [Per-Org Overrides: Inline vs File-Based](#per-org-overrides-inline-vs-file-based) for precedence and merge rules.

```yaml
orgs:
  - org: my-org
    # inherits base custom-org-roles-file as-is

  - org: inline-org
    custom-org-roles: # inline override (merges with base by name)
      - name: Security Auditor
        description: 'Override for this org'
        permissions:
          - read_audit_log
    delete-unmanaged-org-roles: true

  - org: file-based-org
    custom-org-roles-file: './config/custom-org-roles/file-based-org.yml' # file-based override
```

---

## Syncing Organization Profile

Sync organization profile/branding fields across organizations. These control the public-facing identity of the organization.

Set organization profile fields directly as action inputs:

```yml
- name: Sync Organization Settings
  uses: joshjohanning/bulk-github-org-settings-sync-action@v1
  with:
    github-token: ${{ secrets.ORG_ADMIN_TOKEN }}
    organizations: 'my-org'
    org-name: 'My Organization'
    org-description: 'Building great things'
    org-company: 'My Company Inc.'
    org-location: 'San Francisco, CA'
    org-email: 'contact@myorg.com'
    org-twitter-username: 'myorg'
    org-url: 'https://myorg.com'
```

> [!NOTE]
> `org-blog` is deprecated and still supported for backward compatibility. If both `org-url` and `org-blog` are set, `org-url` takes precedence.

### Per-Org Organization Profile Overrides

In `orgs.yml`, use `org-profile` to override specific profile fields for an org. Per-org keys override base action inputs for those keys only; see [Per-Org Overrides: Inline vs File-Based](#per-org-overrides-inline-vs-file-based).

```yaml
orgs:
  - org: my-org
    # inherits base org profile action inputs

  - org: my-other-org
    org-profile:
      org-name: 'Different Name' # override base
      org-description: 'Custom description for this org'
```

---

## Syncing Custom Repository Roles

> [!IMPORTANT]
> Custom repository roles require **GitHub Enterprise Cloud (GHEC)**.

Sync custom repository roles across organizations. These define custom roles that extend a base role (read, triage, write, maintain, admin) with additional repository-level permissions.

> [!TIP]
> 📄 **See full examples:** [sample-configuration/custom-repo-roles.yml](sample-configuration/custom-repo-roles.yml)

Create a YAML file defining your custom repository roles:

**`custom-repo-roles.yml`:**

```yaml
- name: Contractor
  description: 'Write access without sensitive settings'
  base-role: write
  permissions:
    - delete_alerts_code_scanning

- name: Release Manager
  description: 'Can manage releases and deployments'
  base-role: maintain
  permissions:
    - manage_deploy_keys
    - manage_webhooks
```

Then reference it in your workflow:

```yml
- name: Sync Organization Settings
  uses: joshjohanning/bulk-github-org-settings-sync-action@v1
  with:
    github-token: ${{ secrets.ORG_ADMIN_TOKEN }}
    organizations: 'my-org,my-other-org'
    custom-repo-roles-file: './custom-repo-roles.yml'
    delete-unmanaged-repo-roles: false
```

**Behavior:**

- Creates new roles that don't exist yet
- Updates roles that differ from the config (description, base role, or permissions)
- Only applies changes when the role definition differs from what's already configured
- In dry-run mode, shows what would be changed without applying

> [!NOTE]
> GitHub API-style `base_role` is also accepted in custom repository role files.
> `base-role` remains supported in v1 for backward compatibility, but is planned to be removed in v2.

### `delete-unmanaged-repo-roles`

When `delete-unmanaged-repo-roles: true`:

- Creates and updates roles from the config
- **Deletes all other custom repo roles not defined in the config**
- In dry-run mode, shows which roles would be deleted without actually deleting them

### Per-Org Custom Repo Roles Overrides

In `orgs.yml`, override custom repository roles per org either inline or by pointing at a different file. Per-org roles are merged with the base by `name`; see [Per-Org Overrides: Inline vs File-Based](#per-org-overrides-inline-vs-file-based) for precedence and merge rules.

```yaml
orgs:
  - org: my-org
    # inherits base custom-repo-roles-file as-is

  - org: inline-org
    custom-repo-roles: # inline override (merges with base by name)
      - name: Contractor
        description: 'Override for this org'
        base-role: write
        permissions:
          - delete_alerts_code_scanning
    delete-unmanaged-repo-roles: true

  - org: file-based-org
    custom-repo-roles-file: './config/custom-repo-roles/file-based-org.yml' # file-based override
```

---

## Syncing Organization Role Team Assignments

Assign built-in or custom organization roles to teams by slug.

This uses GitHub's organization roles APIs and supports built-in roles such as `security_manager` and `CI/CD Admin`, plus custom organization roles created by `custom-org-roles-file`. Custom organization role definitions are synced before team assignments, so newly created custom roles can be assigned in the same run.

```yml
- name: Sync Organization Settings
  uses: joshjohanning/bulk-github-org-settings-sync-action@v1
  with:
    github-token: ${{ secrets.ORG_ADMIN_TOKEN }}
    organizations: 'my-org,my-other-org'
    organization-role-team-assignments-file: './config/organization-role-team-assignments.yml'
```

```yaml
# config/organization-role-team-assignments.yml
- role: security_manager
  teams:
    - security-team
    - appsec
  delete-unmanaged: true
- role: CI/CD Admin
  teams: platform-admins
- role: Security Auditor
  teams:
    - compliance
```

**Behavior:**

- Adds configured team slugs that do not already have the organization role
- Leaves existing role team assignments alone unless `delete-unmanaged: true` is set for that role
- When `delete-unmanaged: true`, removes teams assigned to that role that are not in the configured desired set
- In dry-run mode, shows which teams would be added or removed without applying changes

In `orgs.yml`, override organization role team assignments per org either inline or by pointing at a different file. Per-org assignments **replace** the base for that org (no merge); see [Per-Org Overrides: Inline vs File-Based](#per-org-overrides-inline-vs-file-based) for precedence.

```yaml
orgs:
  - org: inline-org
    organization-role-team-assignments: # inline override (replaces base for this org)
      - role: security_manager
        teams:
          - security-team
          - appsec
        delete-unmanaged: true

  - org: file-based-org
    organization-role-team-assignments-file: './config/org-role-team-assignments/file-based-org.yml' # file-based override
```

> [!NOTE]
> If both inline `organization-role-team-assignments` and `organization-role-team-assignments-file` are specified for the same org, inline values take precedence and the file is ignored.

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
    members-can-create-repositories: true
    members-can-fork-private-repositories: false
    members-can-create-internal-repositories: false # GHEC/GHES only
    web-commit-signoff-required: true
    default-repository-branch: main
```

**Behavior:**

- Only settings included in the config are managed — omitted settings remain unchanged
- If a setting already matches the config, no API call is made
- Settings are applied via a single `PATCH /orgs/{org}` call per organization
- In dry-run mode, shows which settings would be changed without applying them

### Member Privilege Settings

| Setting                                       | Type    | Description                                                          |
| --------------------------------------------- | ------- | -------------------------------------------------------------------- |
| `default-repository-permission`               | string  | Default permission for org members: `read`, `write`, `admin`, `none` |
| `members-can-create-repositories`             | boolean | Can members create repositories                                      |
| `members-can-create-public-repositories`      | boolean | Can members create public repositories                               |
| `members-can-create-private-repositories`     | boolean | Can members create private repositories                              |
| `members-can-create-internal-repositories`    | boolean | Can members create internal repositories (GHEC/GHES only)            |
| `members-can-fork-private-repositories`       | boolean | Can members fork private repositories                                |
| `web-commit-signoff-required`                 | boolean | Require web UI commits to be signed off                              |
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

In `orgs.yml`, use `member-privileges` to override specific settings for an org (per-key override of base inputs). See [Per-Org Overrides: Inline vs File-Based](#per-org-overrides-inline-vs-file-based) for precedence.

```yaml
orgs:
  - org: my-org
    # inherits base member privilege action inputs

  - org: my-other-org
    member-privileges:
      members-can-fork-private-repositories: true # override base
      members-can-create-internal-repositories: true # GHEC/GHES only
```

---

## Syncing .github Repository Files

Sync a local directory to the `.github` (and/or `.github-private`) repository across organizations. The action compares local files against the target repository and creates a PR with any creates/updates:

```yml
- name: Sync .github repo files
  uses: joshjohanning/bulk-github-org-settings-sync-action@v1
  with:
    github-token: ${{ secrets.ORG_ADMIN_TOKEN }}
    organizations: 'my-org,my-other-org'
    dot-github-source-dir: './dot-github-template'
    dot-github-private-source-dir: './dot-github-private-template'
    dry-run: ${{ github.event_name == 'pull_request' }}
```

This sync is intentionally non-destructive: it creates or updates files present in the source directory, but it does not delete remote-only files from `.github` or `.github-private`.

Per-org overrides can be set in `orgs.yml` using the `dot-github-source-dir` and `dot-github-private-source-dir` keys.

### Auto-creating missing `.github` / `.github-private` repos

By default, if the target `.github` or `.github-private` repository doesn't exist, the action skips it with a warning. To have the action bootstrap missing repos before syncing, opt in with `create-missing-dot-github-repos: true`. Only repos with a configured source-dir are affected. Created repos use `auto_init: true` so the sync flow has a default branch to PR against.

```yml
- name: Sync .github repo files (auto-create missing)
  uses: joshjohanning/bulk-github-org-settings-sync-action@v1
  with:
    github-token: ${{ secrets.ORG_ADMIN_TOKEN }}
    organizations: 'my-org,my-other-org'
    dot-github-source-dir: './dot-github-template'
    dot-github-private-source-dir: './dot-github-private-template'
    create-missing-dot-github-repos: true
    # Defaults: dot-github-repo-visibility=public, dot-github-private-repo-visibility=private.
    # EMU / restricted-GHEC orgs that disallow public repos must set this to 'internal'.
    dot-github-repo-visibility: public
    dot-github-private-repo-visibility: private
```

All three settings (`create-missing-dot-github-repos`, `dot-github-repo-visibility`, `dot-github-private-repo-visibility`) can also be set per-org in `orgs.yml`. Allowed visibility values: `public`, `private`, `internal`.

> [!IMPORTANT]
> Creating repositories requires `administration: write` on the GitHub App at the organization level, in addition to the existing `contents: write`. If `public` is rejected by the organization (e.g. Enterprise Managed Users or a restricted GHEC org), the action emits an actionable warning suggesting the appropriate repo-specific visibility setting: `dot-github-repo-visibility: internal` for `.github`, or `dot-github-private-repo-visibility: internal` for `.github-private`.

---

## Syncing Code Security Configurations

Sync named code security configurations across organizations. These configurations define security feature enablement policies (e.g., Dependabot, secret scanning, code scanning) that can be applied to repositories.

### Basic Usage

```yml
- name: Sync Organization Settings
  uses: joshjohanning/bulk-github-org-settings-sync-action@v1
  with:
    github-token: ${{ secrets.ORG_ADMIN_TOKEN }}
    organizations: 'my-org,my-other-org'
    code-security-configurations-file: './code-security-configurations.yml'
```

### Example Configuration File

```yaml
# code-security-configurations.yml
- name: High risk settings
  description: Security configuration for high risk repositories
  advanced_security: enabled
  dependency_graph: enabled
  dependabot_alerts: enabled
  dependabot_security_updates: enabled
  code_scanning_default_setup: enabled
  secret_scanning: enabled
  secret_scanning_push_protection: enabled
  private_vulnerability_reporting: enabled
  enforcement: enforced

- name: Standard settings
  description: Security configuration for standard repositories
  advanced_security: enabled
  dependency_graph: enabled
  dependabot_alerts: enabled
  secret_scanning: enabled
  secret_scanning_push_protection: enabled
  private_vulnerability_reporting: enabled
  enforcement: unenforced
```

All enablement fields accept: `enabled`, `disabled`, or `not_set`. The `enforcement` field accepts: `enforced` or `unenforced`.

### Optional Repository Attachment and Defaults

You can also configure how each code security configuration is applied:

- `attach-scope`: attach to `all`, `all_without_configurations`, `public`, `private_or_internal`, or `selected` repositories
- `selected-repository-ids`: optional repository IDs when `attach-scope: selected`
- `selected-repositories`: optional repository names (for example `high-risk-service` or `app-api`) when `attach-scope: selected`
- `selected-repositories-by-property`: optional list of `{property, value}` filters; any repo in the org matching any filter is included when `attach-scope: selected`
- `default-for-new-repos`: set default for newly created repos (`all`, `none`, `public`, `private_and_internal`)

Example:

```yaml
- name: High risk settings
  description: Security configuration for high risk repositories
  advanced_security: enabled
  attach-scope: selected
  selected-repositories: [high-risk-service, app-api]
  default-for-new-repos: private_and_internal
```

Or select repositories by custom property:

```yaml
- name: High risk settings
  description: Security configuration for high risk repositories
  advanced_security: enabled
  attach-scope: selected
  selected-repositories-by-property:
    - property: criticality
      value: high
  default-for-new-repos: private_and_internal
```

`selected-repository-ids`, `selected-repositories`, and `selected-repositories-by-property` can all be combined — matching repos from all three sources are merged into one set.

If multiple configurations use `attach-scope`, broader scopes are applied first and `selected` is applied last, so selected repositories can override broad assignments.

For `attach-scope`, the following combinations are invalid and will fail the run:

- The same broad scope (`all`, `all_without_configurations`, `public`, `private_or_internal`) cannot appear on more than one configuration.
- `all` cannot be combined with `all_without_configurations`, `public`, or `private_or_internal`.
- `all_without_configurations` cannot be combined with `public` or `private_or_internal` (unconfigured repos in those visibility categories would be targeted by both).
- `selected` may appear on multiple configurations, but each repository may only be targeted by one of them — overlapping repo sets across `selected`-scope configurations will fail the run.

For `default-for-new-repos`, values must not conflict:

- `none` cannot be combined with any other default assignment.
- `all` cannot be combined with `public` or `private_and_internal`.
- You cannot define the same default target more than once.

### Per-Org Code Security Configuration Overrides

In `orgs.yml`, override code security configurations per org either inline or by pointing at a different file. Per-org configurations are merged with the base by `name`; see [Per-Org Overrides: Inline vs File-Based](#per-org-overrides-inline-vs-file-based) for precedence and merge rules.

```yaml
orgs:
  - org: my-org
    # inherits base code-security-configurations-file as-is

  - org: inline-org
    code-security-configurations: # inline override (merges with base by name)
      - name: High risk settings
        description: Stricter settings for this org
        advanced_security: enabled
        secret_scanning: enabled
        secret_scanning_push_protection: enabled
        enforcement: enforced
        attach-scope: all_without_configurations
        default-for-new-repos: private_and_internal
    delete-unmanaged-code-security-configurations: true

  - org: file-based-org
    code-security-configurations-file: './config/code-security/file-based-org.yml' # file-based override
```

### Delete Unmanaged Configurations

Set `delete-unmanaged-code-security-configurations: true` to remove code security configurations not defined in the configuration file. Only custom (organization-owned) configurations are deleted — global GitHub-managed configurations are never touched.

When `attach-scope` and/or `default-for-new-repos` are configured, the action also applies repository attachment and default assignment for that named configuration.

> [!NOTE]
> Requires a GitHub Advanced Security (GHAS) license for `advanced_security` features. Available on GitHub.com (GHEC) and GHES 3.x+.

## Syncing Actions Policy

Sync organization-level GitHub Actions security and policy settings across organizations. These control which actions can run, workflow token permissions, and PR approval policies.

Set actions policy settings directly as action inputs:

```yml
- name: Sync Organization Settings
  uses: joshjohanning/bulk-github-org-settings-sync-action@v1
  with:
    github-token: ${{ secrets.ORG_ADMIN_TOKEN }}
    organizations: 'my-org'
    actions-policy-allowed-actions: selected
    actions-policy-github-owned-allowed: true
    actions-policy-verified-allowed: true
    actions-allow-list-file: './actions-allow-list.yml'
    actions-policy-default-workflow-permissions: read
    actions-policy-actions-can-approve-pull-request-reviews: false
```

**Behavior:**

- Only settings included in the config are managed — omitted settings remain unchanged
- If a setting already matches the config, no API call is made
- Settings are applied via `PUT` calls to the appropriate `/orgs/{org}/actions/permissions/*` endpoints
- In dry-run mode, shows which settings would be changed without applying them
- The `github-owned-allowed`, `verified-allowed`, and `actions-allow-list-file` settings only apply when `allowed-actions` is `selected`

### Actions Policy Settings

| Setting                                    | Type    | Description                                                                              |
| ------------------------------------------ | ------- | ---------------------------------------------------------------------------------------- |
| `allowed-actions`                          | string  | Allowed actions policy: `all`, `local_only`, or `selected`                               |
| `github-owned-allowed`                     | boolean | Allow GitHub-owned actions (when `allowed-actions` is `selected`)                        |
| `verified-allowed`                         | boolean | Allow GitHub Marketplace verified creator actions (when `allowed-actions` is `selected`) |
| `default-workflow-permissions`             | string  | Default `GITHUB_TOKEN` permissions for workflows: `read` or `write`                      |
| `actions-can-approve-pull-request-reviews` | boolean | Whether GitHub Actions can approve pull request reviews                                  |

### Actions Allow List File

When `allowed-actions` is `selected`, use `actions-allow-list-file` to specify allowed action/reusable workflow patterns:

```yaml
# actions-allow-list.yml
actions:
  - actions/checkout@*
  - actions/setup-node@*
  - actions/cache@*
  - myorg/* # all actions from an owner
```

### Per-Org Actions Policy Overrides

In `orgs.yml`, use `actions-policy` to override individual actions policy settings for an org (per-key override of base inputs). The `actions-allow-list-file` is **file-only** — there is no inline form; point it at a different file to override. See [Per-Org Overrides: Inline vs File-Based](#per-org-overrides-inline-vs-file-based) for precedence.

```yaml
orgs:
  - org: my-org
    # inherits base actions policy action inputs

  - org: my-other-org
    actions-policy:
      allowed-actions: selected # override base
      github-owned-allowed: true
      verified-allowed: true
    actions-allow-list-file: './config/actions-allow-list/other-org.yml' # file-only override
```

---

## Action Inputs

| Input                                                     | Description                                                                                          | Required | Default                 |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------- | ----------------------- |
| `github-token`                                            | GitHub token for API access (requires `admin:org` scope)                                             | Yes      |                         |
| `github-api-url`                                          | GitHub API URL (e.g., `https://api.github.com` or `https://ghes.domain.com/api/v3`)                  | No       | `${{ github.api_url }}` |
| `organizations`                                           | Comma-separated list of organization names                                                           | No       |                         |
| `organizations-file`                                      | Path to YAML file containing organization settings configuration                                     | No       |                         |
| `custom-properties-file`                                  | Path to a YAML file defining custom property schemas                                                 | No       |                         |
| `custom-property-values-file`                             | Path to a YAML file defining custom property values for selected organization repositories           | No       |                         |
| `delete-unmanaged-properties`                             | Delete custom properties not defined in the configuration file                                       | No       | `false`                 |
| `issue-types-file`                                        | Path to a YAML file defining issue type definitions                                                  | No       |                         |
| `delete-unmanaged-issue-types`                            | Delete issue types not defined in the configuration file                                             | No       | `false`                 |
| `issue-fields-file`                                       | Path to a YAML file defining issue field definitions                                                 | No       |                         |
| `delete-unmanaged-issue-fields`                           | Delete issue fields not defined in the configuration file                                            | No       | `false`                 |
| `default-repository-permission`                           | Default permission for org members: `read`, `write`, `admin`, `none`                                 | No       |                         |
| `members-can-create-repositories`                         | Whether members can create repositories                                                              | No       |                         |
| `members-can-create-public-repositories`                  | Whether members can create public repositories                                                       | No       |                         |
| `members-can-create-private-repositories`                 | Whether members can create private repositories                                                      | No       |                         |
| `members-can-create-internal-repositories`                | Whether members can create internal repositories (GHEC/GHES only)                                    | No       |                         |
| `members-can-fork-private-repositories`                   | Whether members can fork private repositories                                                        | No       |                         |
| `web-commit-signoff-required`                             | Whether web UI commits require signoff                                                               | No       |                         |
| `members-can-create-pages`                                | Whether members can create GitHub Pages sites                                                        | No       |                         |
| `members-can-create-public-pages`                         | Whether members can create public GitHub Pages sites                                                 | No       |                         |
| `members-can-create-private-pages`                        | Whether members can create private GitHub Pages sites                                                | No       |                         |
| `members-can-invite-outside-collaborators`                | Whether members can invite outside collaborators                                                     | No       |                         |
| `members-can-create-teams`                                | Whether members can create teams                                                                     | No       |                         |
| `members-can-delete-repositories`                         | Whether members can delete repositories                                                              | No       |                         |
| `members-can-change-repo-visibility`                      | Whether members can change repository visibility                                                     | No       |                         |
| `members-can-delete-issues`                               | Whether members can delete issues                                                                    | No       |                         |
| `default-repository-branch`                               | Default branch name for new repositories                                                             | No       |                         |
| `deploy-keys-enabled-for-repositories`                    | Whether deploy keys can be added to repositories                                                     | No       |                         |
| `readers-can-create-discussions`                          | Whether users with read access can create discussions                                                | No       |                         |
| `members-can-view-dependency-insights`                    | Whether members can view dependency insights                                                         | No       |                         |
| `display-commenter-full-name-setting-enabled`             | Whether to display commenter full name in issues and PRs                                             | No       |                         |
| `organization-role-team-assignments-file`                 | Path to a YAML file defining organization role team assignments                                      | No       |                         |
| `rulesets-file`                                           | Comma-separated paths to JSON files, each with a single org ruleset config                           | No       |                         |
| `delete-unmanaged-rulesets`                               | Delete all other rulesets besides those being synced                                                 | No       | `false`                 |
| `custom-org-roles-file`                                   | Path to a YAML file defining custom organization role definitions (GHEC only)                        | No       |                         |
| `delete-unmanaged-org-roles`                              | Delete custom org roles not defined in the configuration file                                        | No       | `false`                 |
| `custom-repo-roles-file`                                  | Path to a YAML file defining custom repository role definitions (GHEC only)                          | No       |                         |
| `delete-unmanaged-repo-roles`                             | Delete custom repo roles not defined in the configuration file                                       | No       | `false`                 |
| `dot-github-source-dir`                                   | Path to a local directory to sync to the `.github` repo in each org (via PR)                         | No       |                         |
| `dot-github-private-source-dir`                           | Path to a local directory to sync to the `.github-private` repo in each org (via PR)                 | No       |                         |
| `create-missing-dot-github-repos`                         | Create missing `.github` / `.github-private` repos before syncing (requires `administration: write`) | No       | `false`                 |
| `dot-github-repo-visibility`                              | Visibility for newly created `.github` repo: `public`, `private`, or `internal`                      | No       | `public`                |
| `dot-github-private-repo-visibility`                      | Visibility for newly created `.github-private` repo: `public`, `private`, or `internal`              | No       | `private`               |
| `actions-policy-allowed-actions`                          | Allowed GitHub Actions policy: `all`, `local_only`, or `selected`                                    | No       |                         |
| `actions-policy-github-owned-allowed`                     | Whether GitHub-owned actions are allowed (when `allowed-actions` is `selected`)                      | No       |                         |
| `actions-policy-verified-allowed`                         | Whether verified creator actions are allowed (when `allowed-actions` is `selected`)                  | No       |                         |
| `actions-allow-list-file`                                 | Path to YAML file with allowed action/reusable workflow patterns                                     | No       |                         |
| `actions-policy-default-workflow-permissions`             | Default `GITHUB_TOKEN` permissions for workflows: `read` or `write`                                  | No       |                         |
| `actions-policy-actions-can-approve-pull-request-reviews` | Whether GitHub Actions can approve pull request reviews                                              | No       |                         |
| `org-name`                                                | Organization display name                                                                            | No       |                         |
| `org-description`                                         | Organization description (max 160 chars)                                                             | No       |                         |
| `org-company`                                             | Company name                                                                                         | No       |                         |
| `org-location`                                            | Location                                                                                             | No       |                         |
| `org-email`                                               | Publicly visible email                                                                               | No       |                         |
| `org-twitter-username`                                    | Twitter/X username                                                                                   | No       |                         |
| `org-url`                                                 | Website URL                                                                                          | No       |                         |
| `org-blog`                                                | Blog/website URL (deprecated; use `org-url`)                                                         | No       |                         |
| `code-security-configurations-file`                       | Path to a YAML file defining code security configurations to sync                                    | No       |                         |
| `delete-unmanaged-code-security-configurations`           | Delete code security configurations not defined in the configuration file                            | No       | `false`                 |
| `dry-run`                                                 | Preview changes without applying them                                                                | No       | `false`                 |

> [!NOTE]
> You must provide either `organizations` or `organizations-file`. The `custom-properties-file`, `custom-property-values-file`, `issue-types-file`, `issue-fields-file`, `rulesets-file`, `custom-org-roles-file`, `custom-repo-roles-file`, `actions-allow-list-file`, `code-security-configurations-file`, and `organization-role-team-assignments-file` inputs provide base settings for all orgs and can be combined with either approach. Member privilege settings can be provided as individual inputs (e.g., `default-repository-permission`). Actions policy settings can be provided as individual inputs (e.g., `actions-policy-allowed-actions`). Org profile settings can be provided as individual inputs (e.g., `org-name`). The `dot-github-source-dir` and `dot-github-private-source-dir` inputs sync a local directory to the respective special repositories via PR, and `create-missing-dot-github-repos` plus the repo-visibility inputs control optional repo bootstrapping before sync. Per-org overrides in `organizations-file` layer on top of the base unless otherwise noted — see [Per-Org Overrides: Inline vs File-Based](#per-org-overrides-inline-vs-file-based) for which features support inline vs file-path overrides and their precedence and merge semantics.

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
          client-id: ${{ vars.APP_CLIENT_ID }}
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
