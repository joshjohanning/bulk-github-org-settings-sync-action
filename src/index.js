/**
 * Bulk GitHub Organization Settings Sync Action
 * Sync organization settings across multiple GitHub organizations
 *
 * Local Development & Testing:
 *
 * Uses core.getInput() which reads INPUT_<NAME> env vars (hyphens preserved).
 * Since shell variables can't contain hyphens, set these via env(1):
 *
 *    env 'INPUT_GITHUB-TOKEN=ghp_xxx' 'INPUT_ORGANIZATIONS=my-org' node "$(pwd)/src/index.js"
 */

import * as core from '@actions/core';
import { Octokit } from '@octokit/rest';
import * as fs from 'fs';
import * as path from 'path';
import * as url from 'url';
import * as yaml from 'js-yaml';

// ─── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Parse a boolean action input, returning null when the input is empty.
 * Delegates boolean parsing to core.getBooleanInput() so standard
 * GitHub Actions boolean values such as true, True, and FALSE are accepted.
 * @param {string} name - Input name
 * @returns {boolean|null}
 */
function getBooleanInput(name) {
  const val = core.getInput(name);
  if (val === '') return null;
  return core.getBooleanInput(name);
}

// ─── YAML key validation ────────────────────────────────────────────────────────

/**
 * Build the set of known org config keys by reading action.yml inputs.
 * This ensures per-org overrides in orgs.yml stay in sync with action inputs
 * without maintaining a separate hardcoded list.
 * @returns {Set<string>} Set of valid configuration keys
 */
function getKnownOrgConfigKeys() {
  // 'org' is the organization identifier in YAML config
  // 'custom-properties' is inline property definitions (YAML-only, not an action input)
  // 'issue-types' is inline issue type definitions (YAML-only, not an action input)
  // 'member-privileges' is inline member privilege overrides (YAML-only, not an action input)
  // 'actions-policy' is inline actions policy overrides (YAML-only; individual settings are also available as action inputs)
  const keys = new Set(['org', 'custom-properties', 'issue-types', 'member-privileges', 'actions-policy']);

  try {
    const __filename = url.fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    const actionYmlPath = path.join(__dirname, '..', 'action.yml');
    const actionYmlContent = fs.readFileSync(actionYmlPath, 'utf8');
    const actionConfig = yaml.load(actionYmlContent);

    if (actionConfig?.inputs) {
      for (const inputName of Object.keys(actionConfig.inputs)) {
        keys.add(inputName);
      }
    }
  } catch (error) {
    core.warning(`Could not read action.yml to determine valid configuration keys: ${error.message}`);
  }

  return keys;
}

let _knownOrgConfigKeys = null;

/**
 * Get cached known configuration keys.
 * @returns {Set<string>} Set of valid configuration keys
 */
function getCachedKnownOrgConfigKeys() {
  if (_knownOrgConfigKeys === null) {
    _knownOrgConfigKeys = getKnownOrgConfigKeys();
  }
  return _knownOrgConfigKeys;
}

/**
 * Reset the known org config keys cache.
 * Exported for testing purposes to ensure test isolation.
 */
export function resetKnownOrgConfigKeysCache() {
  _knownOrgConfigKeys = null;
}

/**
 * Known keys for custom property definitions in the YAML file.
 * Used to warn about typos or unknown keys.
 */
const KNOWN_CUSTOM_PROPERTY_KEYS = new Set([
  'name',
  'value-type',
  'required',
  'description',
  'default-value',
  'allowed-values',
  'values-editable-by'
]);

/**
 * Known keys for issue type definitions in the YAML file.
 * Used to warn about typos or unknown keys.
 */
const KNOWN_ISSUE_TYPE_KEYS = new Set(['name', 'description', 'color', 'is-enabled']);

/**
 * Supported member privilege settings.
 * Maps YAML key (hyphenated) to API key (snake_case) and expected type.
 * @type {Map<string, { apiKey: string, type: string, validValues?: string[] }>}
 */
export const MEMBER_PRIVILEGE_SETTINGS = new Map([
  [
    'default-repository-permission',
    { apiKey: 'default_repository_permission', type: 'string', validValues: ['read', 'write', 'admin', 'none'] }
  ],
  ['members-can-create-repositories', { apiKey: 'members_can_create_repositories', type: 'boolean' }],
  ['members-can-create-public-repositories', { apiKey: 'members_can_create_public_repositories', type: 'boolean' }],
  ['members-can-create-private-repositories', { apiKey: 'members_can_create_private_repositories', type: 'boolean' }],
  ['members-can-create-internal-repositories', { apiKey: 'members_can_create_internal_repositories', type: 'boolean' }],
  ['members-can-fork-private-repositories', { apiKey: 'members_can_fork_private_repositories', type: 'boolean' }],
  ['web-commit-signoff-required', { apiKey: 'web_commit_signoff_required', type: 'boolean' }],
  ['members-can-create-pages', { apiKey: 'members_can_create_pages', type: 'boolean' }],
  ['members-can-create-public-pages', { apiKey: 'members_can_create_public_pages', type: 'boolean' }],
  ['members-can-create-private-pages', { apiKey: 'members_can_create_private_pages', type: 'boolean' }],
  ['members-can-invite-outside-collaborators', { apiKey: 'members_can_invite_outside_collaborators', type: 'boolean' }],
  ['members-can-create-teams', { apiKey: 'members_can_create_teams', type: 'boolean' }],
  ['members-can-delete-repositories', { apiKey: 'members_can_delete_repositories', type: 'boolean' }],
  ['members-can-change-repo-visibility', { apiKey: 'members_can_change_repo_visibility', type: 'boolean' }],
  ['members-can-delete-issues', { apiKey: 'members_can_delete_issues', type: 'boolean' }],
  ['default-repository-branch', { apiKey: 'default_repository_branch', type: 'string' }],
  ['deploy-keys-enabled-for-repositories', { apiKey: 'deploy_keys_enabled_for_repositories', type: 'boolean' }],
  ['readers-can-create-discussions', { apiKey: 'readers_can_create_discussions', type: 'boolean' }],
  ['members-can-view-dependency-insights', { apiKey: 'members_can_view_dependency_insights', type: 'boolean' }],
  [
    'display-commenter-full-name-setting-enabled',
    { apiKey: 'display_commenter_full_name_setting_enabled', type: 'boolean' }
  ]
]);

/**
 * Supported Actions policy settings.
 * Maps YAML key (hyphenated) to API key (snake_case), expected type, and endpoint group.
 * @type {Map<string, { apiKey: string, type: string, validValues?: string[], endpoint: string }>}
 */
export const ACTIONS_POLICY_SETTINGS = new Map([
  [
    'allowed-actions',
    {
      apiKey: 'allowed_actions',
      type: 'string',
      validValues: ['all', 'local_only', 'selected'],
      endpoint: 'permissions'
    }
  ],
  [
    'default-workflow-permissions',
    {
      apiKey: 'default_workflow_permissions',
      type: 'string',
      validValues: ['read', 'write'],
      endpoint: 'workflow'
    }
  ],
  [
    'actions-can-approve-pull-request-reviews',
    { apiKey: 'can_approve_pull_request_reviews', type: 'boolean', endpoint: 'workflow' }
  ],
  ['github-owned-allowed', { apiKey: 'github_owned_allowed', type: 'boolean', endpoint: 'selected-actions' }],
  ['verified-allowed', { apiKey: 'verified_allowed', type: 'boolean', endpoint: 'selected-actions' }]
]);

/**
 * Validate organization configuration and warn about unknown keys.
 * @param {Object} orgConfig - Organization configuration object from YAML
 * @param {string} orgName - Organization name for logging context
 */
export function validateOrgConfig(orgConfig, orgName) {
  if (typeof orgConfig !== 'object' || orgConfig === null) {
    return;
  }

  const knownKeys = getCachedKnownOrgConfigKeys();

  for (const key of Object.keys(orgConfig)) {
    if (!knownKeys.has(key)) {
      core.warning(
        `⚠️  Unknown configuration key "${key}" found for organization "${orgName}". ` +
          `This setting may not exist, may not be available in this version, or may have a typo.`
      );
    }
  }

  // Validate custom property keys if present
  if (Array.isArray(orgConfig['custom-properties'])) {
    for (const prop of orgConfig['custom-properties']) {
      if (typeof prop !== 'object' || prop === null) continue;
      const propName = prop.name || '(unnamed)';
      for (const key of Object.keys(prop)) {
        if (!KNOWN_CUSTOM_PROPERTY_KEYS.has(key)) {
          core.warning(
            `⚠️  Unknown custom property key "${key}" found for property "${propName}" in organization "${orgName}". ` +
              `This key may not exist or may have a typo.`
          );
        }
      }
    }
  }

  // Validate issue type keys if present
  if (Array.isArray(orgConfig['issue-types'])) {
    for (const issueType of orgConfig['issue-types']) {
      if (typeof issueType !== 'object' || issueType === null) continue;
      const typeName = issueType.name || '(unnamed)';
      for (const key of Object.keys(issueType)) {
        if (!KNOWN_ISSUE_TYPE_KEYS.has(key)) {
          core.warning(
            `⚠️  Unknown issue type key "${key}" found for issue type "${typeName}" in organization "${orgName}". ` +
              `This key may not exist or may have a typo.`
          );
        }
      }
    }
  }

  // Validate delete-unmanaged-properties value if present
  if (Object.prototype.hasOwnProperty.call(orgConfig, 'delete-unmanaged-properties')) {
    const val = orgConfig['delete-unmanaged-properties'];
    if (typeof val !== 'boolean') {
      core.warning(
        `⚠️  Invalid "delete-unmanaged-properties" value for organization "${orgName}": ` +
          `expected true or false, got "${val}". This setting will be ignored.`
      );
    }
  }

  // Validate delete-unmanaged-rulesets value if present
  if (Object.prototype.hasOwnProperty.call(orgConfig, 'delete-unmanaged-rulesets')) {
    const val = orgConfig['delete-unmanaged-rulesets'];
    if (typeof val !== 'boolean') {
      core.warning(
        `⚠️  Invalid "delete-unmanaged-rulesets" value for organization "${orgName}": ` +
          `expected true or false, got "${val}". This setting will be ignored.`
      );
    }
  }

  // Validate delete-unmanaged-issue-types value if present
  if (Object.prototype.hasOwnProperty.call(orgConfig, 'delete-unmanaged-issue-types')) {
    const val = orgConfig['delete-unmanaged-issue-types'];
    if (typeof val !== 'boolean') {
      core.warning(
        `⚠️  Invalid "delete-unmanaged-issue-types" value for organization "${orgName}": ` +
          `expected true or false, got "${val}". This setting will be ignored.`
      );
    }
  }

  // member-privileges is fully validated by parseMemberPrivileges(), which throws contextual errors.

  // actions-policy is fully validated by parseActionsPolicy(), which throws contextual errors.
}

// ─── Base-path resolution ────────────────────────────────────────────────────

/**
 * File-path config keys that should be resolved against base-path.
 * @type {string[]}
 */
const FILE_PATH_CONFIG_KEYS = [
  'custom-properties-file',
  'issue-types-file',
  'rulesets-file',
  'actions-allow-list-file'
];

/**
 * Resolve a single file path against a base path.
 * Absolute paths are returned unchanged; relative paths are joined with basePath.
 * Non-string or falsy values are returned as-is. String values are trimmed first,
 * and whitespace-only strings resolve to an empty string so downstream validation
 * continues to treat them as empty.
 * @param {string} basePath - Base path to prepend
 * @param {*} filePath - File path to resolve (non-string values returned unchanged)
 * @returns {*} Resolved file path, or original value if not a non-empty string
 */
export function resolveFilePath(basePath, filePath) {
  if (!filePath || typeof filePath !== 'string') return filePath;
  const trimmedFilePath = filePath.trim();
  if (!trimmedFilePath) return trimmedFilePath;
  if (path.isAbsolute(trimmedFilePath)) return trimmedFilePath;
  return path.join(basePath, trimmedFilePath);
}

/**
 * Apply base-path resolution to all file-path config values in an org config object.
 * Handles string values, comma-separated strings (for rulesets-file),
 * and array values.
 * @param {Object} orgConfig - Organization configuration object
 * @param {string} basePath - Base path to prepend to relative file paths
 * @returns {Object} New org config with resolved file paths
 */
export function applyBasePathToOrgConfig(orgConfig, basePath) {
  if (!basePath) return orgConfig;

  const resolved = { ...orgConfig };
  for (const key of FILE_PATH_CONFIG_KEYS) {
    if (resolved[key] === undefined) continue;

    const value = resolved[key];
    if (typeof value === 'string') {
      // rulesets-file supports comma-separated paths
      if (key === 'rulesets-file') {
        resolved[key] = value
          .split(',')
          .map(p => p.trim())
          .filter(p => p.length > 0)
          .map(p => resolveFilePath(basePath, p))
          .join(',');
      } else {
        resolved[key] = resolveFilePath(basePath, value);
      }
    } else if (Array.isArray(value)) {
      resolved[key] = value.map(p => (typeof p === 'string' ? resolveFilePath(basePath, p) : p));
    }
  }

  return resolved;
}

// ─── SubResult model (mirrors bulk-github-repo-settings-sync-action PR #120) ─

/**
 * Valid statuses for a sub-result.
 * Only reportable statuses are included — unchanged/skipped operations
 * do not push sub-results.
 * @readonly
 * @enum {string}
 */
const SubResultStatus = Object.freeze({
  CHANGED: 'changed',
  WARNING: 'warning'
});

/**
 * Human-readable labels for sync operation kinds in the summary table.
 */
const SYNC_KIND_LABELS = Object.freeze({
  'custom-property-create': 'custom property (created)',
  'custom-property-update': 'custom property (updated)',
  'custom-property-delete': 'custom property (deleted)',
  'issue-type-create': 'issue type (created)',
  'issue-type-update': 'issue type (updated)',
  'issue-type-delete': 'issue type (deleted)',
  'member-privileges-update': 'member privileges (updated)',
  'ruleset-create': 'ruleset (created)',
  'ruleset-update': 'ruleset (updated)',
  'ruleset-delete': 'ruleset (deleted)',
  'actions-policy-permissions-update': 'actions policy (permissions updated)',
  'actions-policy-workflow-update': 'actions policy (workflow permissions updated)',
  'actions-policy-selected-actions-update': 'actions policy (selected actions updated)',
  'actions-policy-allow-list-update': 'actions policy (allow list updated)'
});

/**
 * Create a normalized sub-result for a single feature operation.
 * @param {string} kind - Feature identifier
 * @param {string} status - One of SubResultStatus values
 * @param {string} message - Human-readable detail for logging
 * @returns {{ kind: string, status: string, message: string }}
 */
function createSubResult(kind, status, message) {
  return { kind, status, message };
}

/**
 * Format a curated summary message for a sub-result in the summary table.
 * @param {{ kind: string, status: string, message: string }} subResult
 * @returns {string} Curated summary text
 */
function formatSubResultSummary(subResult) {
  const label = SYNC_KIND_LABELS[subResult.kind];
  return label ? `${label}: ${subResult.message}` : subResult.message;
}

// ─── Organization parsing ───────────────────────────────────────────────────────

/**
 * Parse the list of organizations and their settings from inputs.
 * Supports two modes:
 *   1. organizations-file: YAML file with full org + settings config
 * Supports layering: base settings from action inputs (custom-properties-file, rulesets-file, direct
 * member privilege inputs, direct actions policy inputs, and actions-allow-list-file) are merged with
 * per-org overrides from organizations-file.
 * Per-org properties override base properties with the same name; base properties
 * not overridden are preserved.
 *
 * Per-org custom-properties-file, issue-types-file, rulesets-file, or actions-allow-list-file in the
 * organizations file overrides the corresponding base file from the action input for that org.
 *
 * Modes:
 *   1. organizations-file (optionally combined with custom-properties-file / rulesets-file / direct member privilege inputs / direct actions policy inputs for base settings)
 *   2. organizations input + custom-properties-file / rulesets-file / direct member privilege inputs / direct actions policy inputs (same properties for all orgs)
 * @param {string} organizationsInput - Comma-separated org names
 * @param {string} organizationsFile - Path to YAML config file
 * @param {string} customPropertiesFile - Path to custom properties YAML file
 * @param {string[]} [rulesetsFiles] - Paths to ruleset JSON files (base for all orgs)
 * @param {boolean} [deleteUnmanagedRulesets] - Whether to delete rulesets not in config
 * @param {string} [issueTypesFile] - Path to issue types YAML file (base for all orgs)
 * @param {Object|null} [memberPrivilegesFromInputs] - Member privileges parsed from action inputs (base for all orgs)
 * @param {Object|null} [actionsPolicyFromInputs] - Actions policy parsed from action inputs (base for all orgs)
 * @param {string} [actionsAllowListFile] - Path to actions allow list YAML file (base for all orgs)
 * @returns {Array<{ org: string, customProperties?: Array, rulesetsFiles?: string[], deleteUnmanagedRulesets?: boolean, issueTypes?: Array, memberPrivileges?: Object, actionsPolicy?: Object, actionsAllowList?: string[] }>} Parsed org configs
 */
export function parseOrganizations(
  organizationsInput,
  organizationsFile,
  customPropertiesFile,
  rulesetsFiles,
  deleteUnmanagedRulesets,
  issueTypesFile,
  memberPrivilegesFromInputs,
  actionsPolicyFromInputs,
  actionsAllowListFile
) {
  // Load base custom properties from separate file (applies to all orgs)
  let baseCustomProperties = null;
  if (customPropertiesFile) {
    baseCustomProperties = parseCustomPropertiesFile(customPropertiesFile);
  }

  // Load base issue types from separate file (applies to all orgs)
  let baseIssueTypes = null;
  if (issueTypesFile) {
    baseIssueTypes = parseIssueTypesFile(issueTypesFile);
  }

  // Load base member privileges from direct action inputs.
  let baseMemberPrivileges = null;
  if (memberPrivilegesFromInputs) {
    baseMemberPrivileges = { ...memberPrivilegesFromInputs };
  }

  // Load base actions policy from direct action inputs.
  let baseActionsPolicy = null;
  if (actionsPolicyFromInputs) {
    baseActionsPolicy = { ...actionsPolicyFromInputs };
  }

  // Load base actions allow list from separate file (applies to all orgs)
  let baseActionsAllowList = null;
  if (actionsAllowListFile) {
    baseActionsAllowList = parseActionsAllowListFile(actionsAllowListFile);
  }

  if (organizationsFile) {
    const orgConfigs = parseOrganizationsFile(organizationsFile);

    for (const orgConfig of orgConfigs) {
      // Per-org custom-properties-file overrides the base for this org
      let orgBase = baseCustomProperties;
      if (orgConfig.customPropertiesFile) {
        try {
          orgBase = parseCustomPropertiesFile(orgConfig.customPropertiesFile);
        } catch (error) {
          throw new Error(
            `Failed to parse custom properties file "${orgConfig.customPropertiesFile}" for organization "${orgConfig.org}": ${error.message}`,
            { cause: error }
          );
        }
      }

      if (orgBase) {
        // Inline custom-properties layer on top of the base (per-org file or global file)
        orgConfig.customProperties = mergeCustomProperties(orgBase, orgConfig.customProperties || []);
      }

      // Clean up the intermediate field
      delete orgConfig.customPropertiesFile;

      // Per-org issue-types-file overrides the base for this org
      let orgIssueTypesBase = baseIssueTypes;
      if (orgConfig.issueTypesFile) {
        try {
          orgIssueTypesBase = parseIssueTypesFile(orgConfig.issueTypesFile);
        } catch (error) {
          throw new Error(
            `Failed to parse issue types file "${orgConfig.issueTypesFile}" for organization "${orgConfig.org}": ${error.message}`,
            { cause: error }
          );
        }
      }

      if (orgIssueTypesBase) {
        // Inline issue-types layer on top of the base (per-org file or global file)
        orgConfig.issueTypes = mergeIssueTypes(orgIssueTypesBase, orgConfig.issueTypes || []);
      }

      // Clean up the intermediate field
      delete orgConfig.issueTypesFile;

      // Per-org rulesets-file overrides the base for this org
      if (!orgConfig.rulesetsFiles && rulesetsFiles && rulesetsFiles.length > 0) {
        orgConfig.rulesetsFiles = rulesetsFiles;
      }

      // Per-org delete-unmanaged-rulesets overrides the base for this org
      if (orgConfig.deleteUnmanagedRulesets === undefined && deleteUnmanagedRulesets !== undefined) {
        orgConfig.deleteUnmanagedRulesets = deleteUnmanagedRulesets;
      }

      // Per-org member-privileges layer on top of base member privileges
      if (baseMemberPrivileges || orgConfig.memberPrivileges) {
        orgConfig.memberPrivileges = mergeMemberPrivileges(
          baseMemberPrivileges || {},
          orgConfig.memberPrivileges || {}
        );
      }

      // Per-org actions-policy layer on top of base actions policy
      if (baseActionsPolicy || orgConfig.actionsPolicy) {
        orgConfig.actionsPolicy = mergeActionsPolicy(baseActionsPolicy || {}, orgConfig.actionsPolicy || {});
      }

      // Per-org actions-allow-list-file overrides the base for this org
      if (orgConfig.actionsAllowListFile) {
        try {
          orgConfig.actionsAllowList = parseActionsAllowListFile(orgConfig.actionsAllowListFile);
        } catch (error) {
          throw new Error(
            `Failed to parse actions allow list file "${orgConfig.actionsAllowListFile}" for organization "${orgConfig.org}": ${error.message}`,
            { cause: error }
          );
        }
      } else if (baseActionsAllowList) {
        orgConfig.actionsAllowList = [...baseActionsAllowList];
      }

      // Clean up the intermediate field
      delete orgConfig.actionsAllowListFile;
    }

    return orgConfigs;
  }

  if (!organizationsInput) {
    throw new Error('Either "organizations" or "organizations-file" must be specified');
  }

  const orgs = organizationsInput
    .split(',')
    .map(o => o.trim())
    .filter(o => o.length > 0);

  if (orgs.length === 0) {
    throw new Error('No organizations specified in "organizations" input');
  }

  return orgs.map(org => ({
    org,
    ...(baseCustomProperties ? { customProperties: baseCustomProperties } : {}),
    ...(baseIssueTypes ? { issueTypes: baseIssueTypes } : {}),
    ...(rulesetsFiles && rulesetsFiles.length > 0 ? { rulesetsFiles } : {}),
    ...(deleteUnmanagedRulesets !== undefined ? { deleteUnmanagedRulesets } : {}),
    ...(baseMemberPrivileges ? { memberPrivileges: baseMemberPrivileges } : {}),
    ...(baseActionsPolicy ? { actionsPolicy: baseActionsPolicy } : {}),
    ...(baseActionsAllowList ? { actionsAllowList: baseActionsAllowList } : {})
  }));
}

/**
 * Merge base custom properties with per-org overrides.
 * Per-org properties override base properties with the same name.
 * Base properties not overridden are preserved.
 * @param {Array<Object>} baseProperties - Base custom property definitions
 * @param {Array<Object>} orgProperties - Per-org custom property overrides
 * @returns {Array<Object>} Merged properties
 */
export function mergeCustomProperties(baseProperties, orgProperties) {
  // Start with a copy of base properties keyed by property_name
  const merged = new Map(baseProperties.map(p => [p.property_name, { ...p }]));

  // Per-org properties override base properties with the same name
  for (const orgProp of orgProperties) {
    merged.set(orgProp.property_name, { ...orgProp });
  }

  return Array.from(merged.values());
}

/**
 * Merge base issue types with per-org overrides.
 * Per-org issue types override base issue types with the same name.
 * Base issue types not overridden are preserved.
 * @param {Array<Object>} baseIssueTypes - Base issue type definitions
 * @param {Array<Object>} orgIssueTypes - Per-org issue type overrides
 * @returns {Array<Object>} Merged issue types
 */
export function mergeIssueTypes(baseIssueTypes, orgIssueTypes) {
  const merged = new Map(baseIssueTypes.map(t => [t.name, { ...t }]));

  for (const orgType of orgIssueTypes) {
    merged.set(orgType.name, { ...orgType });
  }

  return Array.from(merged.values());
}

/**
 * Merge base member privileges with per-org overrides.
 * Per-org settings override base settings with the same key.
 * Base settings not overridden are preserved.
 * @param {Object} basePrivileges - Base member privilege settings (API-keyed)
 * @param {Object} orgPrivileges - Per-org member privilege overrides (API-keyed)
 * @returns {Object} Merged privileges
 */
export function mergeMemberPrivileges(basePrivileges, orgPrivileges) {
  return { ...basePrivileges, ...orgPrivileges };
}

// ─── Actions Policy Parsing ─────────────────────────────────────────────────────

/**
 * Parse and validate an actions policy YAML config object (inline or from file).
 * Converts YAML keys (hyphenated) to API keys (snake_case) and validates types.
 * @param {Object} config - Raw key-value map from YAML
 * @param {string} [context] - Context for error messages (e.g., org name)
 * @returns {Object} Normalized policy with API keys
 */
export function parseActionsPolicy(config, context) {
  if (typeof config !== 'object' || config === null || Array.isArray(config)) {
    const label = context ? ` for org "${context}"` : '';
    throw new Error(`Invalid actions-policy${label}: expected a key-value map`);
  }

  const normalized = {};
  const label = context ? ` for org "${context}"` : '';

  for (const [yamlKey, value] of Object.entries(config)) {
    const setting = ACTIONS_POLICY_SETTINGS.get(yamlKey);
    if (!setting) {
      throw new Error(
        `Unknown actions policy key "${yamlKey}"${label}. ` +
          `Valid keys: ${[...ACTIONS_POLICY_SETTINGS.keys()].join(', ')}`
      );
    }

    if (setting.type === 'boolean') {
      if (typeof value !== 'boolean') {
        throw new Error(`Actions policy key "${yamlKey}"${label} must be a boolean, got "${value}"`);
      }
      normalized[setting.apiKey] = value;
    } else if (setting.type === 'string') {
      const strValue = String(value).trim();
      if (setting.validValues && !setting.validValues.includes(strValue)) {
        throw new Error(
          `Actions policy key "${yamlKey}"${label} has invalid value "${strValue}". ` +
            `Valid values: ${setting.validValues.join(', ')}`
        );
      }
      normalized[setting.apiKey] = strValue;
    }
  }

  return normalized;
}

/**
 * Build actions policy from action inputs.
 * Reads each actions policy setting from core.getInput() and returns
 * a normalized object with API keys for any non-empty inputs.
 * @returns {Object|null} Normalized policy with API keys, or null if no inputs set
 */
export function getActionsPolicyFromInputs() {
  const result = {};

  for (const [yamlKey, setting] of ACTIONS_POLICY_SETTINGS) {
    const inputName = `actions-policy-${yamlKey}`;
    const raw = core.getInput(inputName);
    if (raw === '') continue;

    if (setting.type === 'boolean') {
      const lower = raw.toLowerCase();
      if (lower === 'true') {
        result[setting.apiKey] = true;
      } else if (lower === 'false') {
        result[setting.apiKey] = false;
      } else {
        throw new Error(`Input "${inputName}" must be a boolean (true/false), got "${raw}"`);
      }
    } else if (setting.type === 'string') {
      const trimmedRaw = raw.trim();
      if (trimmedRaw === '') continue;
      if (setting.validValues && !setting.validValues.includes(trimmedRaw)) {
        throw new Error(
          `Input "${inputName}" has invalid value "${trimmedRaw}". Valid values: ${setting.validValues.join(', ')}`
        );
      }
      result[setting.apiKey] = trimmedRaw;
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}

/**
 * Merge base actions policy with per-org overrides.
 * Per-org settings override base settings with the same key.
 * Base settings not overridden are preserved.
 * @param {Object} basePolicy - Base actions policy settings (API-keyed)
 * @param {Object} orgPolicy - Per-org actions policy overrides (API-keyed)
 * @returns {Object} Merged policy
 */
export function mergeActionsPolicy(basePolicy, orgPolicy) {
  return { ...basePolicy, ...orgPolicy };
}

/**
 * Parse an actions allow list YAML file.
 * The file should contain an 'actions' key with an array of pattern strings.
 * @param {string} filePath - Path to the YAML file
 * @returns {string[]} Array of allow list patterns
 */
export function parseActionsAllowListFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Actions allow list file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const config = yaml.load(content);

  if (!config || !config.actions || !Array.isArray(config.actions)) {
    throw new Error(`Invalid actions allow list file format: expected an "actions" array in ${filePath}`);
  }

  const patterns = [];
  const seenPatterns = new Set();

  for (const entry of config.actions) {
    if (typeof entry !== 'string') {
      throw new Error(`Invalid entry in actions allow list: expected a string, got ${typeof entry}`);
    }

    const pattern = entry.trim();
    if (pattern.length > 0 && !seenPatterns.has(pattern)) {
      patterns.push(pattern);
      seenPatterns.add(pattern);
    }
  }

  if (patterns.length === 0) {
    throw new Error(`Actions allow list file contains no valid patterns: ${filePath}`);
  }

  return patterns;
}

/**
 * Parse the organizations YAML config file.
 * @param {string} filePath - Path to the YAML file
 * @returns {Array<{ org: string, customPropertiesFile?: string, customProperties?: Array, issueTypesFile?: string, issueTypes?: Array, rulesetsFiles?: string[], deleteUnmanagedRulesets?: boolean, deleteUnmanagedProperties?: boolean, deleteUnmanagedIssueTypes?: boolean, memberPrivileges?: Object }>}
 */
export function parseOrganizationsFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Organizations file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const config = yaml.load(content);

  if (!config || !config.orgs || !Array.isArray(config.orgs)) {
    throw new Error(`Invalid organizations file format: expected a "orgs" array in ${filePath}`);
  }

  // Read optional base-path for file path resolution
  const rawBasePath = config['base-path'];
  if (rawBasePath !== undefined && rawBasePath !== null && typeof rawBasePath !== 'string') {
    throw new Error(`Invalid 'base-path' in ${filePath}: expected a string, got ${typeof rawBasePath}`);
  }
  const basePath = typeof rawBasePath === 'string' ? rawBasePath.trim() : undefined;
  if (basePath) {
    core.info(`Resolving file paths relative to base-path: ${basePath}`);
  }

  return config.orgs.map(rawOrgConfig => {
    // Apply base-path resolution before processing
    const orgConfig = basePath ? applyBasePathToOrgConfig(rawOrgConfig, basePath) : rawOrgConfig;
    if (!orgConfig.org) {
      throw new Error('Each entry in "orgs" must have an "org" field');
    }

    validateOrgConfig(orgConfig, orgConfig.org);

    const result = { org: orgConfig.org };

    if (Object.prototype.hasOwnProperty.call(orgConfig, 'custom-properties-file')) {
      const cpFile = orgConfig['custom-properties-file'];
      if (typeof cpFile !== 'string' || cpFile.trim() === '') {
        throw new Error(`Invalid "custom-properties-file" for org "${orgConfig.org}": expected a non-empty string`);
      }
      result.customPropertiesFile = cpFile.trim();
    }

    if (orgConfig['custom-properties']) {
      result.customProperties = normalizeCustomProperties(orgConfig['custom-properties']);
    }

    if (Object.prototype.hasOwnProperty.call(orgConfig, 'issue-types-file')) {
      const itFile = orgConfig['issue-types-file'];
      if (typeof itFile !== 'string' || itFile.trim() === '') {
        throw new Error(`Invalid "issue-types-file" for org "${orgConfig.org}": expected a non-empty string`);
      }
      result.issueTypesFile = itFile.trim();
    }

    if (Object.prototype.hasOwnProperty.call(orgConfig, 'issue-types')) {
      if (!Array.isArray(orgConfig['issue-types'])) {
        throw new Error(`Invalid "issue-types" for org "${orgConfig.org}": expected an array`);
      }
      result.issueTypes = normalizeIssueTypes(orgConfig['issue-types']);
    }

    if (Object.prototype.hasOwnProperty.call(orgConfig, 'rulesets-file')) {
      const rsFile = orgConfig['rulesets-file'];
      result.rulesetsFiles = parseRulesetsFileValue(rsFile, orgConfig.org);
    }

    if (Object.prototype.hasOwnProperty.call(orgConfig, 'delete-unmanaged-rulesets')) {
      const val = orgConfig['delete-unmanaged-rulesets'];
      if (typeof val === 'boolean') {
        result.deleteUnmanagedRulesets = val;
      }
    }

    if (Object.prototype.hasOwnProperty.call(orgConfig, 'delete-unmanaged-properties')) {
      const val = orgConfig['delete-unmanaged-properties'];
      if (typeof val === 'boolean') {
        result.deleteUnmanagedProperties = val;
      }
    }

    if (Object.prototype.hasOwnProperty.call(orgConfig, 'delete-unmanaged-issue-types')) {
      const val = orgConfig['delete-unmanaged-issue-types'];
      if (typeof val === 'boolean') {
        result.deleteUnmanagedIssueTypes = val;
      }
    }

    if (Object.prototype.hasOwnProperty.call(orgConfig, 'member-privileges')) {
      result.memberPrivileges = parseMemberPrivileges(orgConfig['member-privileges'], orgConfig.org);
    }

    if (Object.prototype.hasOwnProperty.call(orgConfig, 'actions-policy')) {
      result.actionsPolicy = parseActionsPolicy(orgConfig['actions-policy'], orgConfig.org);
    }

    if (Object.prototype.hasOwnProperty.call(orgConfig, 'actions-allow-list-file')) {
      const alFile = orgConfig['actions-allow-list-file'];
      if (typeof alFile !== 'string' || alFile.trim() === '') {
        throw new Error(`Invalid "actions-allow-list-file" for org "${orgConfig.org}": expected a non-empty string`);
      }
      result.actionsAllowListFile = alFile.trim();
    }

    return result;
  });
}

/**
 * Parse a rulesets-file value into an array of file paths.
 * Accepts a single string (comma-separated), a YAML array of strings,
 * or an empty/falsy value (returns empty array).
 * @param {string|string[]} value - The rulesets-file value from config
 * @param {string} [context] - Context for error messages (e.g., org name)
 * @returns {string[]} Array of trimmed, non-empty file paths
 */
function parseRulesetsFileValue(value, context) {
  if (!value || (typeof value === 'string' && value.trim() === '')) {
    return [];
  }

  // Allow empty array to explicitly disable inherited rulesets
  if (Array.isArray(value) && value.length === 0) {
    return [];
  }

  const label = context ? ` for org "${context}"` : '';
  let paths;
  if (Array.isArray(value)) {
    paths = value.map(v => {
      if (typeof v !== 'string' || v.trim() === '') {
        throw new Error(`Invalid entry in "rulesets-file" array${label}: expected non-empty strings`);
      }
      return v.trim();
    });
  } else if (typeof value === 'string') {
    paths = value
      .split(',')
      .map(p => p.trim())
      .filter(p => p.length > 0);
  } else {
    throw new Error(`Invalid "rulesets-file"${label}: expected a string, comma-separated string, or array of strings`);
  }

  return paths;
}

/**
 * Parse a standalone custom properties YAML file.
 * @param {string} filePath - Path to the YAML file
 * @returns {Array<Object>} Normalized custom property definitions
 */
export function parseCustomPropertiesFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Custom properties file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const properties = yaml.load(content);

  if (!Array.isArray(properties)) {
    throw new Error(`Invalid custom properties file format: expected an array in ${filePath}`);
  }

  return normalizeCustomProperties(properties);
}

/**
 * Normalize custom property definitions from YAML format to API format.
 * @param {Array<Object>} properties - Custom property definitions from YAML
 * @returns {Array<Object>} Normalized properties
 */
export function normalizeCustomProperties(properties) {
  return properties.map(prop => {
    if (!prop.name) {
      throw new Error('Each custom property must have a "name" field');
    }
    if (!prop['value-type']) {
      throw new Error(`Custom property "${prop.name}" must have a "value-type" field`);
    }

    const validTypes = ['string', 'single_select', 'multi_select', 'true_false', 'url'];
    if (!validTypes.includes(prop['value-type'])) {
      throw new Error(
        `Custom property "${prop.name}" has invalid value-type "${prop['value-type']}". ` +
          `Valid types: ${validTypes.join(', ')}`
      );
    }

    const validEditableBy = ['org_actors', 'org_and_repo_actors'];
    if (prop['values-editable-by'] && !validEditableBy.includes(prop['values-editable-by'])) {
      throw new Error(
        `Custom property "${prop.name}" has invalid values-editable-by "${prop['values-editable-by']}". ` +
          `Valid values: ${validEditableBy.join(', ')}`
      );
    }

    // Require allowed-values for select types
    if (['single_select', 'multi_select'].includes(prop['value-type'])) {
      if (!prop['allowed-values'] || !Array.isArray(prop['allowed-values']) || prop['allowed-values'].length === 0) {
        throw new Error(
          `Custom property "${prop.name}" with value-type "${prop['value-type']}" must have a non-empty "allowed-values" array`
        );
      }
    }

    const normalized = {
      property_name: prop.name,
      value_type: prop['value-type'],
      required: prop.required === true,
      description: prop.description || null,
      values_editable_by: prop['values-editable-by'] || 'org_actors'
    };

    if (prop['default-value'] !== undefined && prop['default-value'] !== null) {
      // Validate default-value against select type constraints
      if (prop['value-type'] === 'single_select' && prop.required !== true) {
        throw new Error(
          `Custom property "${prop.name}" with value-type "single_select" cannot have a "default-value" when "required" is false. ` +
            `Set "required: true" or remove the "default-value".`
        );
      }

      // multi_select default values must be arrays; other types are strings
      if (prop['value-type'] === 'multi_select') {
        if (Array.isArray(prop['default-value'])) {
          normalized.default_value = prop['default-value'].map(v => String(v));
        } else {
          throw new Error(
            `Custom property "${prop.name}" with value-type "multi_select" must have an array for "default-value"`
          );
        }
      } else {
        normalized.default_value = String(prop['default-value']);
      }

      // Validate default-value is in allowed-values for select types
      if (['single_select', 'multi_select'].includes(prop['value-type']) && prop['allowed-values']) {
        const allowedStr = prop['allowed-values'].map(v => String(v));
        if (prop['value-type'] === 'single_select') {
          if (!allowedStr.includes(normalized.default_value)) {
            throw new Error(
              `Custom property "${prop.name}" has default-value "${normalized.default_value}" ` +
                `which is not in allowed-values: ${allowedStr.join(', ')}`
            );
          }
        } else if (Array.isArray(normalized.default_value)) {
          const invalid = normalized.default_value.filter(v => !allowedStr.includes(v));
          if (invalid.length > 0) {
            throw new Error(
              `Custom property "${prop.name}" has default-value entries not in allowed-values: ${invalid.join(', ')}`
            );
          }
        }
      }
    } else {
      normalized.default_value = null;
    }

    if (prop['allowed-values'] && Array.isArray(prop['allowed-values'])) {
      normalized.allowed_values = prop['allowed-values'].map(v => String(v));
    }

    return normalized;
  });
}

// ─── Issue Types Parsing & Sync ─────────────────────────────────────────────────

/**
 * Parse a standalone issue types YAML file.
 * @param {string} filePath - Path to the YAML file
 * @returns {Array<Object>} Normalized issue type definitions
 */
export function parseIssueTypesFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Issue types file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const issueTypes = yaml.load(content);

  if (!Array.isArray(issueTypes)) {
    throw new Error(`Invalid issue types file format: expected an array in ${filePath}`);
  }

  return normalizeIssueTypes(issueTypes);
}

/**
 * Normalize issue type definitions from YAML format to API format.
 * @param {Array<Object>} issueTypes - Issue type definitions from YAML
 * @returns {Array<Object>} Normalized issue types
 */
export function normalizeIssueTypes(issueTypes) {
  return issueTypes.map((it, index) => {
    if (typeof it !== 'object' || it === null || Array.isArray(it)) {
      throw new Error(`Issue type entry at index ${index} must be a key-value map`);
    }
    if (!it.name) {
      throw new Error('Each issue type must have a "name" field');
    }
    if (Object.prototype.hasOwnProperty.call(it, 'is-enabled') && typeof it['is-enabled'] !== 'boolean') {
      throw new Error(`Issue type "${it.name}" has invalid is-enabled value: expected a boolean`);
    }
    if (Object.prototype.hasOwnProperty.call(it, 'color') && it.color != null) {
      if (typeof it.color !== 'string' || !/^[0-9a-fA-F]{6}$/.test(it.color.trim())) {
        throw new Error(`Issue type "${it.name}" has invalid color: expected a 6-character hex string`);
      }
    }

    const normalized = {
      name: it.name,
      is_enabled: it['is-enabled'] ?? true,
      description: it.description || null,
      color: it.color == null ? null : it.color.trim().toLowerCase()
    };

    return normalized;
  });
}

/**
 * Compare two issue type definitions to check if they differ.
 * @param {Object} existing - Current issue type from API
 * @param {Object} desired - Desired issue type from config
 * @returns {{ changed: boolean, changes: Array<string> }}
 */
export function compareIssueType(existing, desired) {
  const changes = [];

  // Normalize empty strings to null for consistent comparison
  const existingDesc = existing.description || null;
  const desiredDesc = desired.description || null;
  if (existingDesc !== desiredDesc) {
    changes.push(`description updated`);
  }
  const existingColor = existing.color || null;
  const desiredColor = desired.color || null;
  if (existingColor !== desiredColor) {
    changes.push(`color: ${existingColor || 'none'} → ${desiredColor || 'none'}`);
  }
  if (Boolean(existing.is_enabled) !== Boolean(desired.is_enabled)) {
    changes.push(`is_enabled: ${existing.is_enabled} → ${desired.is_enabled}`);
  }

  return { changed: changes.length > 0, changes };
}

/**
 * Sync issue type definitions for an organization.
 * @param {Octokit} octokit - Octokit instance
 * @param {string} org - Organization name
 * @param {Array<Object>} desiredIssueTypes - Desired issue type definitions
 * @param {boolean} deleteUnmanaged - Whether to delete issue types not in config
 * @param {boolean} dryRun - Preview mode
 * @returns {Promise<Object>} Result object with subResults
 */
export async function syncIssueTypes(octokit, org, desiredIssueTypes, deleteUnmanaged, dryRun) {
  const subResults = [];
  const wouldPrefix = dryRun ? 'Would ' : '';
  let hasFailed = false;

  // Fetch current issue types
  let existingIssueTypes;
  try {
    const { data } = await octokit.request('GET /orgs/{org}/issue-types', { org });
    existingIssueTypes = data;
  } catch (error) {
    if (error.status === 404) {
      existingIssueTypes = [];
    } else {
      throw error;
    }
  }

  const existingMap = new Map(existingIssueTypes.map(t => [t.name, t]));
  const desiredMap = new Map(desiredIssueTypes.map(t => [t.name, t]));

  // Determine creates and updates
  for (const desired of desiredIssueTypes) {
    const existing = existingMap.get(desired.name);

    if (!existing) {
      // New issue type
      core.info(`  🆕 ${wouldPrefix}Create issue type: ${desired.name}`);
      subResults.push(
        createSubResult('issue-type-create', SubResultStatus.CHANGED, `${wouldPrefix}create "${desired.name}"`)
      );

      if (!dryRun) {
        try {
          await octokit.request('POST /orgs/{org}/issue-types', {
            org,
            name: desired.name,
            ...(desired.description != null ? { description: desired.description } : {}),
            ...(desired.color != null ? { color: desired.color } : {}),
            is_enabled: desired.is_enabled
          });
        } catch (error) {
          hasFailed = true;
          core.warning(`  ⚠️  Failed to create issue type "${desired.name}": ${error.message}`);
          subResults[subResults.length - 1] = createSubResult(
            'issue-type-create',
            SubResultStatus.WARNING,
            `Failed to create "${desired.name}": ${error.message}`
          );
        }
      }
    } else {
      // Check for updates
      const { changed, changes } = compareIssueType(existing, desired);
      if (changed) {
        core.info(`  📝 ${wouldPrefix}Update issue type: ${desired.name} (${changes.join(', ')})`);
        subResults.push(
          createSubResult(
            'issue-type-update',
            SubResultStatus.CHANGED,
            `${wouldPrefix}update "${desired.name}" (${changes.join(', ')})`
          )
        );

        if (!dryRun) {
          try {
            await octokit.request('PATCH /orgs/{org}/issue-types/{issue_type_id}', {
              org,
              issue_type_id: existing.id,
              name: desired.name,
              ...(desired.description != null ? { description: desired.description } : {}),
              ...(desired.color != null ? { color: desired.color } : {}),
              is_enabled: desired.is_enabled
            });
          } catch (error) {
            hasFailed = true;
            core.warning(`  ⚠️  Failed to update issue type "${desired.name}": ${error.message}`);
            subResults[subResults.length - 1] = createSubResult(
              'issue-type-update',
              SubResultStatus.WARNING,
              `Failed to update "${desired.name}": ${error.message}`
            );
          }
        }
      } else {
        core.info(`  ✅ Issue type unchanged: ${desired.name}`);
      }
    }
  }

  // Determine and apply deletions
  if (deleteUnmanaged) {
    for (const existing of existingIssueTypes) {
      if (!desiredMap.has(existing.name)) {
        core.info(`  🗑️ ${wouldPrefix}Delete issue type: ${existing.name}`);
        subResults.push(
          createSubResult('issue-type-delete', SubResultStatus.CHANGED, `${wouldPrefix}delete "${existing.name}"`)
        );

        if (!dryRun) {
          try {
            await octokit.request('DELETE /orgs/{org}/issue-types/{issue_type_id}', {
              org,
              issue_type_id: existing.id
            });
          } catch (error) {
            hasFailed = true;
            core.warning(`  ⚠️  Failed to delete issue type "${existing.name}": ${error.message}`);
            subResults[subResults.length - 1] = createSubResult(
              'issue-type-delete',
              SubResultStatus.WARNING,
              `Failed to delete "${existing.name}": ${error.message}`
            );
          }
        }
      }
    }
  }

  return { subResults, failed: hasFailed };
}

// ─── Member Privileges Parsing ──────────────────────────────────────────────────

/**
 * Parse and validate a member privileges YAML config object (inline or from file).
 * Converts YAML keys (hyphenated) to API keys (snake_case) and validates types.
 * @param {Object} config - Raw key-value map from YAML
 * @param {string} [context] - Context for error messages (e.g., org name)
 * @returns {Object} Normalized privileges with API keys
 */
export function parseMemberPrivileges(config, context) {
  if (typeof config !== 'object' || config === null || Array.isArray(config)) {
    const label = context ? ` for org "${context}"` : '';
    throw new Error(`Invalid member-privileges${label}: expected a key-value map`);
  }

  const normalized = {};
  const label = context ? ` for org "${context}"` : '';

  for (const [yamlKey, value] of Object.entries(config)) {
    const setting = MEMBER_PRIVILEGE_SETTINGS.get(yamlKey);
    if (!setting) {
      throw new Error(
        `Unknown member privilege key "${yamlKey}"${label}. ` +
          `Valid keys: ${Array.from(MEMBER_PRIVILEGE_SETTINGS.keys()).join(', ')}`
      );
    }

    if (setting.type === 'boolean') {
      if (typeof value !== 'boolean') {
        throw new Error(`Member privilege "${yamlKey}"${label} must be a boolean (true/false), got "${value}"`);
      }
    } else if (setting.type === 'string') {
      const trimmedValue = typeof value === 'string' ? value.trim() : value;
      if (typeof trimmedValue !== 'string' || trimmedValue === '') {
        throw new Error(`Member privilege "${yamlKey}"${label} must be a non-empty string`);
      }
      if (setting.validValues && !setting.validValues.includes(trimmedValue)) {
        throw new Error(
          `Member privilege "${yamlKey}"${label} has invalid value "${trimmedValue}". ` +
            `Valid values: ${setting.validValues.join(', ')}`
        );
      }
      normalized[setting.apiKey] = trimmedValue;
      continue;
    }

    normalized[setting.apiKey] = value;
  }

  return normalized;
}

/**
 * Build member privileges from action inputs.
 * Reads each member privilege setting from core.getInput() and returns
 * a normalized object with API keys for any non-empty inputs.
 * @returns {Object|null} Normalized privileges with API keys, or null if no inputs set
 */
export function getMemberPrivilegesFromInputs() {
  const result = {};

  for (const [yamlKey, setting] of MEMBER_PRIVILEGE_SETTINGS) {
    const raw = core.getInput(yamlKey);
    if (raw === '') continue;

    if (setting.type === 'boolean') {
      const lower = raw.toLowerCase();
      if (lower === 'true') {
        result[setting.apiKey] = true;
      } else if (lower === 'false') {
        result[setting.apiKey] = false;
      } else {
        throw new Error(`Input "${yamlKey}" must be a boolean (true/false), got "${raw}"`);
      }
    } else if (setting.type === 'string') {
      const trimmedRaw = raw.trim();
      if (trimmedRaw === '') continue;
      if (setting.validValues && !setting.validValues.includes(trimmedRaw)) {
        throw new Error(
          `Input "${yamlKey}" has invalid value "${trimmedRaw}". Valid values: ${setting.validValues.join(', ')}`
        );
      }
      result[setting.apiKey] = trimmedRaw;
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}

// ─── Custom Properties Sync ─────────────────────────────────────────────────────

/**
 * Compare two custom property definitions to check if they differ.
 * @param {Object} existing - Current property from API
 * @param {Object} desired - Desired property from config
 * @returns {{ changed: boolean, changes: Array<string> }}
 */
export function compareCustomProperty(existing, desired) {
  const changes = [];

  if (existing.value_type !== desired.value_type) {
    changes.push(`value_type: ${existing.value_type} → ${desired.value_type}`);
  }
  if (Boolean(existing.required) !== Boolean(desired.required)) {
    changes.push(`required: ${existing.required} → ${desired.required}`);
  }
  if ((existing.description || null) !== (desired.description || null)) {
    changes.push(`description updated`);
  }
  // Compare default_value (deep compare for arrays, scalar for strings/null)
  const existingDefault = existing.default_value ?? null;
  const desiredDefault = desired.default_value ?? null;
  if (JSON.stringify(existingDefault) !== JSON.stringify(desiredDefault)) {
    changes.push(`default_value: ${existingDefault ?? 'none'} → ${desiredDefault ?? 'none'}`);
  }
  if ((existing.values_editable_by ?? 'org_actors') !== (desired.values_editable_by ?? 'org_actors')) {
    changes.push(`values_editable_by: ${existing.values_editable_by} → ${desired.values_editable_by}`);
  }

  // Compare allowed_values arrays (order matters per GitHub API docs)
  const existingAllowed = (existing.allowed_values || []).map(String);
  const desiredAllowed = (desired.allowed_values || []).map(String);
  if (JSON.stringify(existingAllowed) !== JSON.stringify(desiredAllowed)) {
    changes.push(`allowed_values updated`);
  }

  return { changed: changes.length > 0, changes };
}

/**
 * Sync custom property definitions for an organization.
 * @param {Octokit} octokit - Octokit instance
 * @param {string} org - Organization name
 * @param {Array<Object>} desiredProperties - Desired custom property definitions
 * @param {boolean} deleteUnmanaged - Whether to delete properties not in config
 * @param {boolean} dryRun - Preview mode
 * @returns {Promise<Object>} Result object with subResults
 */
export async function syncCustomProperties(octokit, org, desiredProperties, deleteUnmanaged, dryRun) {
  const subResults = [];
  const wouldPrefix = dryRun ? 'Would ' : '';

  // Fetch current custom properties
  let existingProperties;
  try {
    const { data } = await octokit.request('GET /orgs/{org}/properties/schema', { org });
    existingProperties = data;
  } catch (error) {
    if (error.status === 404) {
      existingProperties = [];
    } else {
      throw error;
    }
  }

  const existingMap = new Map(existingProperties.map(p => [p.property_name, p]));
  const desiredMap = new Map(desiredProperties.map(p => [p.property_name, p]));

  // Determine creates and updates
  const toCreateOrUpdate = [];
  for (const desired of desiredProperties) {
    const existing = existingMap.get(desired.property_name);

    if (!existing) {
      // New property
      toCreateOrUpdate.push(desired);
      core.info(`  🆕 ${wouldPrefix}Create custom property: ${desired.property_name}`);
      subResults.push(
        createSubResult(
          'custom-property-create',
          SubResultStatus.CHANGED,
          `${wouldPrefix}create "${desired.property_name}" (${desired.value_type})`
        )
      );
    } else {
      // Check for updates
      const { changed, changes } = compareCustomProperty(existing, desired);
      if (changed) {
        toCreateOrUpdate.push(desired);
        core.info(`  📝 ${wouldPrefix}Update custom property: ${desired.property_name} (${changes.join(', ')})`);
        subResults.push(
          createSubResult(
            'custom-property-update',
            SubResultStatus.CHANGED,
            `${wouldPrefix}update "${desired.property_name}" (${changes.join(', ')})`
          )
        );
      } else {
        core.info(`  ✅ Custom property unchanged: ${desired.property_name}`);
      }
    }
  }

  // Apply creates/updates via batch PATCH (before deletions to avoid destructive partial state)
  if (toCreateOrUpdate.length > 0 && !dryRun) {
    try {
      await octokit.request('PATCH /orgs/{org}/properties/schema', {
        org,
        properties: toCreateOrUpdate
      });
    } catch (error) {
      // Mark all pending creates/updates as warnings
      core.warning(`  ⚠️  Failed to sync custom properties: ${error.message}`);
      for (let i = 0; i < subResults.length; i++) {
        const sub = subResults[i];
        if (
          (sub.kind === 'custom-property-create' || sub.kind === 'custom-property-update') &&
          sub.status === SubResultStatus.CHANGED
        ) {
          subResults[i] = createSubResult(sub.kind, SubResultStatus.WARNING, `Failed: ${error.message}`);
        }
      }
      // Skip deletions — don't leave org in partially-applied state
      return { subResults, failed: true };
    }
  }

  // Determine and apply deletions (only after successful creates/updates)
  if (deleteUnmanaged) {
    for (const existing of existingProperties) {
      if (!desiredMap.has(existing.property_name)) {
        core.info(`  🗑️ ${wouldPrefix}Delete custom property: ${existing.property_name}`);
        subResults.push(
          createSubResult(
            'custom-property-delete',
            SubResultStatus.CHANGED,
            `${wouldPrefix}delete "${existing.property_name}"`
          )
        );

        if (!dryRun) {
          try {
            await octokit.request('DELETE /orgs/{org}/properties/schema/{custom_property_name}', {
              org,
              custom_property_name: existing.property_name
            });
          } catch (error) {
            core.warning(`  ⚠️  Failed to delete custom property "${existing.property_name}": ${error.message}`);
            subResults[subResults.length - 1] = createSubResult(
              'custom-property-delete',
              SubResultStatus.WARNING,
              `Failed to delete "${existing.property_name}": ${error.message}`
            );
          }
        }
      }
    }
  }

  return { subResults, failed: false };
}

// ─── Member Privileges Sync ─────────────────────────────────────────────────────

/**
 * Build a reverse lookup from API key to YAML key for human-readable logging.
 * @returns {Map<string, string>}
 */
function buildApiToYamlKeyMap() {
  const map = new Map();
  for (const [yamlKey, setting] of MEMBER_PRIVILEGE_SETTINGS) {
    map.set(setting.apiKey, yamlKey);
  }
  return map;
}

const API_TO_YAML_KEY = buildApiToYamlKeyMap();

/**
 * Sync member privilege settings for an organization.
 * Fetches current org settings via GET, compares with desired values,
 * and applies a single PATCH if any settings differ.
 *
 * @param {Octokit} octokit - Octokit instance
 * @param {string} org - Organization name
 * @param {Object} desiredSettings - Desired member privilege settings (API-keyed)
 * @param {boolean} dryRun - Preview mode
 * @returns {Promise<Object>} Result object with subResults
 */
export async function syncMemberPrivileges(octokit, org, desiredSettings, dryRun) {
  const subResults = [];
  const wouldPrefix = dryRun ? 'Would ' : '';

  // Fetch current organization settings
  let currentOrg;
  try {
    const { data } = await octokit.request('GET /orgs/{org}', { org });
    currentOrg = data;
  } catch (error) {
    core.warning(`  ⚠️  Failed to fetch organization settings: ${error.message}`);
    subResults.push(
      createSubResult(
        'member-privileges-update',
        SubResultStatus.WARNING,
        `Failed to fetch organization settings: ${error.message}`
      )
    );
    return { subResults, failed: true };
  }

  // Compare each desired setting with current
  const patch = {};
  const changes = [];

  for (const [apiKey, desiredValue] of Object.entries(desiredSettings)) {
    const currentValue = currentOrg[apiKey];
    const yamlKey = API_TO_YAML_KEY.get(apiKey) || apiKey;

    if (currentValue !== desiredValue) {
      patch[apiKey] = desiredValue;
      changes.push(`${yamlKey}: ${currentValue} → ${desiredValue}`);
    }
  }

  if (changes.length === 0) {
    core.info(`  ✅ Member privileges unchanged`);
    return { subResults, failed: false };
  }

  // Log changes
  for (const change of changes) {
    core.info(`  🔧 ${wouldPrefix}Update ${change}`);
  }

  subResults.push(
    createSubResult(
      'member-privileges-update',
      SubResultStatus.CHANGED,
      `${wouldPrefix}update ${changes.length} setting(s): ${changes.join(', ')}`
    )
  );

  // Apply the patch
  if (!dryRun) {
    try {
      await octokit.request('PATCH /orgs/{org}', {
        org,
        ...patch
      });
    } catch (error) {
      core.warning(`  ⚠️  Failed to update member privileges: ${error.message}`);
      subResults[subResults.length - 1] = createSubResult(
        'member-privileges-update',
        SubResultStatus.WARNING,
        `Failed to update member privileges: ${error.message}`
      );
      return { subResults, failed: true };
    }
  }

  return { subResults, failed: false };
}

// ─── Actions Policy Sync ────────────────────────────────────────────────────────

/**
 * Build a reverse lookup from API key to YAML key for actions policy settings.
 * @returns {Map<string, string>}
 */
function buildActionsPolicyApiToYamlKeyMap() {
  const map = new Map();
  for (const [yamlKey, setting] of ACTIONS_POLICY_SETTINGS) {
    map.set(setting.apiKey, yamlKey);
  }
  return map;
}

const ACTIONS_POLICY_API_TO_YAML_KEY = buildActionsPolicyApiToYamlKeyMap();

/**
 * Return de-duplicated allow-list patterns while preserving original order.
 * @param {string[]} patterns
 * @returns {string[]}
 */
function uniqueActionsAllowListPatterns(patterns) {
  return [...new Set(patterns)];
}

/**
 * Sync Actions policy settings for an organization.
 * Manages three API endpoints:
 *   1. GET/PUT /orgs/{org}/actions/permissions — allowed_actions
 *   2. GET/PUT /orgs/{org}/actions/permissions/workflow — default_workflow_permissions, can_approve_pull_request_reviews
 *   3. GET/PUT /orgs/{org}/actions/permissions/selected-actions — github_owned_allowed, verified_allowed, patterns_allowed
 *
 * @param {Octokit} octokit - Octokit instance
 * @param {string} org - Organization name
 * @param {Object} desiredSettings - Desired actions policy settings (API-keyed)
 * @param {string[]|null} allowList - Desired allow list patterns, or null if not managed
 * @param {boolean} dryRun - Preview mode
 * @returns {Promise<Object>} Result object with subResults
 */
export async function syncActionsPolicy(octokit, org, desiredSettings, allowList, dryRun) {
  const subResults = [];
  const wouldPrefix = dryRun ? 'Would ' : '';

  // Group desired settings by endpoint
  const permissionsSettings = {};
  const workflowSettings = {};
  const selectedActionsSettings = {};

  for (const [apiKey, value] of Object.entries(desiredSettings)) {
    const yamlKey = ACTIONS_POLICY_API_TO_YAML_KEY.get(apiKey);
    if (!yamlKey) continue;
    const setting = ACTIONS_POLICY_SETTINGS.get(yamlKey);
    if (!setting) continue;

    if (setting.endpoint === 'permissions') {
      permissionsSettings[apiKey] = value;
    } else if (setting.endpoint === 'workflow') {
      workflowSettings[apiKey] = value;
    } else if (setting.endpoint === 'selected-actions') {
      selectedActionsSettings[apiKey] = value;
    }
  }

  // 1. Sync /actions/permissions (allowed_actions)
  if (Object.keys(permissionsSettings).length > 0) {
    const result = await syncActionsPermissions(octokit, org, permissionsSettings, dryRun, wouldPrefix);
    subResults.push(...result.subResults);
    if (result.failed) return { subResults, failed: true };
  }

  // 2. Sync /actions/permissions/workflow (default_workflow_permissions, can_approve_pull_request_reviews)
  if (Object.keys(workflowSettings).length > 0) {
    const result = await syncActionsWorkflowPermissions(octokit, org, workflowSettings, dryRun, wouldPrefix);
    subResults.push(...result.subResults);
    if (result.failed) return { subResults, failed: true };
  }

  // 3. Sync /actions/permissions/selected-actions (github_owned_allowed, verified_allowed, patterns)
  if (Object.keys(selectedActionsSettings).length > 0 || allowList) {
    const result = await syncActionsSelectedActions(
      octokit,
      org,
      selectedActionsSettings,
      allowList,
      dryRun,
      wouldPrefix
    );
    subResults.push(...result.subResults);
    if (result.failed) return { subResults, failed: true };
  }

  return { subResults, failed: false };
}

/**
 * Sync the /actions/permissions endpoint for allowed_actions.
 * @param {Octokit} octokit
 * @param {string} org
 * @param {Object} desiredSettings
 * @param {boolean} dryRun
 * @param {string} wouldPrefix
 * @returns {Promise<Object>}
 */
async function syncActionsPermissions(octokit, org, desiredSettings, dryRun, wouldPrefix) {
  const subResults = [];

  let current;
  try {
    const { data } = await octokit.request('GET /orgs/{org}/actions/permissions', { org });
    current = data;
  } catch (error) {
    core.warning(`  ⚠️  Failed to fetch actions permissions: ${error.message}`);
    subResults.push(
      createSubResult(
        'actions-policy-permissions-update',
        SubResultStatus.WARNING,
        `Failed to fetch actions permissions: ${error.message}`
      )
    );
    return { subResults, failed: true };
  }

  const patch = {};
  const changes = [];

  for (const [apiKey, desiredValue] of Object.entries(desiredSettings)) {
    const currentValue = current[apiKey];
    const yamlKey = ACTIONS_POLICY_API_TO_YAML_KEY.get(apiKey) || apiKey;
    if (currentValue !== desiredValue) {
      patch[apiKey] = desiredValue;
      changes.push(`${yamlKey}: ${currentValue} → ${desiredValue}`);
    }
  }

  if (changes.length === 0) {
    core.info(`  ✅ Actions permissions unchanged`);
    return { subResults, failed: false };
  }

  for (const change of changes) {
    core.info(`  🔧 ${wouldPrefix}Update ${change}`);
  }

  subResults.push(
    createSubResult(
      'actions-policy-permissions-update',
      SubResultStatus.CHANGED,
      `${wouldPrefix}update ${changes.length} setting(s): ${changes.join(', ')}`
    )
  );

  if (!dryRun) {
    try {
      await octokit.request('PUT /orgs/{org}/actions/permissions', {
        org,
        enabled_repositories: current.enabled_repositories,
        ...patch
      });
    } catch (error) {
      core.warning(`  ⚠️  Failed to update actions permissions: ${error.message}`);
      subResults[subResults.length - 1] = createSubResult(
        'actions-policy-permissions-update',
        SubResultStatus.WARNING,
        `Failed to update actions permissions: ${error.message}`
      );
      return { subResults, failed: true };
    }
  }

  return { subResults, failed: false };
}

/**
 * Sync the /actions/permissions/workflow endpoint.
 * @param {Octokit} octokit
 * @param {string} org
 * @param {Object} desiredSettings
 * @param {boolean} dryRun
 * @param {string} wouldPrefix
 * @returns {Promise<Object>}
 */
async function syncActionsWorkflowPermissions(octokit, org, desiredSettings, dryRun, wouldPrefix) {
  const subResults = [];

  let current;
  try {
    const { data } = await octokit.request('GET /orgs/{org}/actions/permissions/workflow', { org });
    current = data;
  } catch (error) {
    core.warning(`  ⚠️  Failed to fetch workflow permissions: ${error.message}`);
    subResults.push(
      createSubResult(
        'actions-policy-workflow-update',
        SubResultStatus.WARNING,
        `Failed to fetch workflow permissions: ${error.message}`
      )
    );
    return { subResults, failed: true };
  }

  const patch = {};
  const changes = [];

  for (const [apiKey, desiredValue] of Object.entries(desiredSettings)) {
    const currentValue = current[apiKey];
    const yamlKey = ACTIONS_POLICY_API_TO_YAML_KEY.get(apiKey) || apiKey;
    if (currentValue !== desiredValue) {
      patch[apiKey] = desiredValue;
      changes.push(`${yamlKey}: ${currentValue} → ${desiredValue}`);
    }
  }

  if (changes.length === 0) {
    core.info(`  ✅ Workflow permissions unchanged`);
    return { subResults, failed: false };
  }

  for (const change of changes) {
    core.info(`  🔧 ${wouldPrefix}Update ${change}`);
  }

  subResults.push(
    createSubResult(
      'actions-policy-workflow-update',
      SubResultStatus.CHANGED,
      `${wouldPrefix}update ${changes.length} setting(s): ${changes.join(', ')}`
    )
  );

  if (!dryRun) {
    try {
      await octokit.request('PUT /orgs/{org}/actions/permissions/workflow', {
        org,
        ...patch
      });
    } catch (error) {
      core.warning(`  ⚠️  Failed to update workflow permissions: ${error.message}`);
      subResults[subResults.length - 1] = createSubResult(
        'actions-policy-workflow-update',
        SubResultStatus.WARNING,
        `Failed to update workflow permissions: ${error.message}`
      );
      return { subResults, failed: true };
    }
  }

  return { subResults, failed: false };
}

/**
 * Sync the /actions/permissions/selected-actions endpoint.
 * @param {Octokit} octokit
 * @param {string} org
 * @param {Object} desiredSettings
 * @param {string[]|null} allowList
 * @param {boolean} dryRun
 * @param {string} wouldPrefix
 * @returns {Promise<Object>}
 */
async function syncActionsSelectedActions(octokit, org, desiredSettings, allowList, dryRun, wouldPrefix) {
  const subResults = [];

  let current;
  try {
    const { data } = await octokit.request('GET /orgs/{org}/actions/permissions/selected-actions', { org });
    current = data;
  } catch (error) {
    core.warning(`  ⚠️  Failed to fetch selected actions settings: ${error.message}`);
    subResults.push(
      createSubResult(
        'actions-policy-selected-actions-update',
        SubResultStatus.WARNING,
        `Failed to fetch selected actions settings: ${error.message}`
      )
    );
    return { subResults, failed: true };
  }

  const patch = {};
  const changes = [];

  // Compare boolean settings
  for (const [apiKey, desiredValue] of Object.entries(desiredSettings)) {
    const currentValue = current[apiKey];
    const yamlKey = ACTIONS_POLICY_API_TO_YAML_KEY.get(apiKey) || apiKey;
    if (currentValue !== desiredValue) {
      patch[apiKey] = desiredValue;
      changes.push(`${yamlKey}: ${currentValue} → ${desiredValue}`);
    }
  }

  // Compare allow list patterns
  if (allowList) {
    const currentPatterns = uniqueActionsAllowListPatterns(current.patterns_allowed || []);
    const desiredPatterns = uniqueActionsAllowListPatterns(allowList);
    const sortedCurrent = [...currentPatterns].sort();
    const sortedDesired = [...desiredPatterns].sort();
    const patternsChanged =
      sortedCurrent.length !== sortedDesired.length || sortedCurrent.some((v, i) => v !== sortedDesired[i]);

    if (patternsChanged) {
      patch.patterns_allowed = desiredPatterns;
      const currentPatternSet = new Set(currentPatterns);
      const desiredPatternSet = new Set(desiredPatterns);
      const added = desiredPatterns.filter(p => !currentPatternSet.has(p));
      const removed = currentPatterns.filter(p => !desiredPatternSet.has(p));
      const details = [];
      if (added.length > 0) details.push(`+${added.length} added`);
      if (removed.length > 0) details.push(`-${removed.length} removed`);
      changes.push(`allow-list: ${details.join(', ')} (${desiredPatterns.length} total)`);
    }
  }

  if (changes.length === 0) {
    core.info(`  ✅ Selected actions settings unchanged`);
    return { subResults, failed: false };
  }

  for (const change of changes) {
    core.info(`  🔧 ${wouldPrefix}Update ${change}`);
  }

  // Determine the sync kind for sub-results
  const hasSettingChanges = Object.keys(desiredSettings).some(k => patch[k] !== undefined);
  const hasAllowListChanges = patch.patterns_allowed !== undefined;

  if (hasSettingChanges) {
    const settingChanges = changes.filter(c => !c.startsWith('allow-list:'));
    subResults.push(
      createSubResult(
        'actions-policy-selected-actions-update',
        SubResultStatus.CHANGED,
        `${wouldPrefix}update ${settingChanges.length} setting(s): ${settingChanges.join(', ')}`
      )
    );
  }

  if (hasAllowListChanges) {
    const allowListChange = changes.find(c => c.startsWith('allow-list:'));
    subResults.push(
      createSubResult(
        'actions-policy-allow-list-update',
        SubResultStatus.CHANGED,
        `${wouldPrefix}update ${allowListChange}`
      )
    );
  }

  if (!dryRun) {
    try {
      // Build the full PUT body: preserve current values for unmanaged keys
      const putBody = {
        github_owned_allowed: current.github_owned_allowed,
        verified_allowed: current.verified_allowed,
        patterns_allowed: current.patterns_allowed || [],
        ...patch
      };

      await octokit.request('PUT /orgs/{org}/actions/permissions/selected-actions', {
        org,
        ...putBody
      });
    } catch (error) {
      core.warning(`  ⚠️  Failed to update selected actions settings: ${error.message}`);
      for (let i = 0; i < subResults.length; i++) {
        subResults[i] = createSubResult(
          subResults[i].kind,
          SubResultStatus.WARNING,
          `Failed to update selected actions settings: ${error.message}`
        );
      }
      return { subResults, failed: true };
    }
  }

  return { subResults, failed: false };
}

// ─── Organization Rulesets Sync ─────────────────────────────────────────────────

/**
 * Deep equality check for objects, insensitive to key insertion order.
 * @param {*} a - First value
 * @param {*} b - Second value
 * @returns {boolean} Whether the values are deeply equal
 */
function deepEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    return a.every((val, i) => deepEqual(val, b[i]));
  }
  if (typeof a === 'object') {
    const keysA = Object.keys(a).sort();
    const keysB = Object.keys(b).sort();
    if (keysA.length !== keysB.length) return false;
    return keysA.every((key, i) => key === keysB[i] && deepEqual(a[key], b[key]));
  }
  return false;
}

/**
 * Read-only fields returned by GET that should be stripped before POST/PUT.
 * Using a blocklist (instead of whitelist) so new fields GitHub adds are
 * passed through without requiring an action update.
 */
const RULESET_READONLY_FIELDS = new Set([
  'id',
  'node_id',
  'source',
  'source_type',
  'created_at',
  'updated_at',
  '_links',
  'current_user_can_bypass'
]);

/**
 * Strip read-only fields from a ruleset config for create/update requests.
 * @param {Object} config - Full ruleset configuration (possibly exported from API)
 * @returns {Object} Config with read-only fields removed
 */
function stripRulesetReadonlyFields(config) {
  const result = {};
  for (const [key, value] of Object.entries(config)) {
    if (!RULESET_READONLY_FIELDS.has(key)) {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Sync organization-level rulesets.
 * Reads one or more JSON files, each containing a single ruleset configuration,
 * compares with existing rulesets, and creates/updates/deletes as needed
 * (mirroring the repo-level rulesets sync in bulk-github-repo-settings-sync-action).
 *
 * @param {Octokit} octokit - Octokit instance
 * @param {string} org - Organization name
 * @param {string[]} rulesetFilePaths - Paths to ruleset JSON files (one ruleset per file)
 * @param {boolean} deleteUnmanaged - Whether to delete rulesets not in config
 * @param {boolean} dryRun - Preview mode
 * @returns {Promise<Object>} Result object with subResults
 */
export async function syncOrgRulesets(octokit, org, rulesetFilePaths, deleteUnmanaged, dryRun) {
  const subResults = [];
  const wouldPrefix = dryRun ? 'Would ' : '';
  let hasFailed = false;

  // Read and parse each ruleset JSON file
  const rulesetConfigs = [];
  for (const filePath of rulesetFilePaths) {
    let rulesetConfig;
    try {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      rulesetConfig = JSON.parse(fileContent);
    } catch (error) {
      throw new Error(`Failed to read or parse ruleset file at ${filePath}: ${error.message}`);
    }

    if (!rulesetConfig.name) {
      throw new Error(`Ruleset file "${filePath}" must include a "name" field`);
    }

    rulesetConfigs.push(rulesetConfig);
  }

  // Detect duplicate ruleset names across files
  const seenNames = new Set();
  for (const config of rulesetConfigs) {
    if (seenNames.has(config.name)) {
      throw new Error(`Duplicate ruleset name "${config.name}" found across ruleset files`);
    }
    seenNames.add(config.name);
  }

  // Collect managed names for delete-unmanaged logic
  const managedNames = new Set(rulesetConfigs.map(r => r.name));

  // Fetch existing org rulesets (paginate to get the full set)
  let existingRulesets;
  try {
    existingRulesets = await octokit.paginate('GET /orgs/{org}/rulesets', { org, per_page: 100 });
  } catch (error) {
    if (error.status === 404) {
      existingRulesets = [];
    } else {
      throw error;
    }
  }

  // Process each desired ruleset
  for (const rulesetConfig of rulesetConfigs) {
    const rulesetName = rulesetConfig.name;
    const existingRuleset = existingRulesets.find(r => r.name === rulesetName);

    if (existingRuleset) {
      // Fetch full ruleset details to compare
      let fullRuleset;
      try {
        const { data } = await octokit.request('GET /orgs/{org}/rulesets/{ruleset_id}', {
          org,
          ruleset_id: existingRuleset.id
        });
        fullRuleset = data;
      } catch (error) {
        core.warning(
          `  ⚠️  Failed to fetch ruleset details for "${rulesetName}" (ID: ${existingRuleset.id}): ${error.message}`
        );
        subResults.push(
          createSubResult(
            'ruleset-update',
            SubResultStatus.WARNING,
            `Failed to fetch details for "${rulesetName}" (ID: ${existingRuleset.id}): ${error.message}`
          )
        );
        hasFailed = true;
        continue;
      }

      // Strip read-only fields from both sides for comparison
      const existingConfig = stripRulesetReadonlyFields(fullRuleset);
      const normalizedSourceConfig = stripRulesetReadonlyFields(rulesetConfig);

      const configsMatch = deepEqual(existingConfig, normalizedSourceConfig);

      if (configsMatch) {
        core.info(`  📋 Ruleset "${rulesetName}" is already up to date`);
      } else {
        // Update existing ruleset
        core.info(`  📋 ${wouldPrefix}Update ruleset: ${rulesetName} (ID: ${existingRuleset.id})`);
        subResults.push(
          createSubResult(
            'ruleset-update',
            SubResultStatus.CHANGED,
            `${wouldPrefix}update "${rulesetName}" (ID: ${existingRuleset.id})`
          )
        );

        if (!dryRun) {
          try {
            await octokit.request('PUT /orgs/{org}/rulesets/{ruleset_id}', {
              org,
              ruleset_id: existingRuleset.id,
              ...stripRulesetReadonlyFields(rulesetConfig)
            });
          } catch (error) {
            core.warning(`  ⚠️  Failed to update ruleset "${rulesetName}": ${error.message}`);
            subResults[subResults.length - 1] = createSubResult(
              'ruleset-update',
              SubResultStatus.WARNING,
              `Failed to update "${rulesetName}": ${error.message}`
            );
            hasFailed = true;
          }
        }
      }
    } else {
      // Create new ruleset
      core.info(`  🆕 ${wouldPrefix}Create ruleset: ${rulesetName}`);
      subResults.push(
        createSubResult('ruleset-create', SubResultStatus.CHANGED, `${wouldPrefix}create "${rulesetName}"`)
      );

      if (!dryRun) {
        try {
          const { data: newRuleset } = await octokit.request('POST /orgs/{org}/rulesets', {
            org,
            ...stripRulesetReadonlyFields(rulesetConfig)
          });
          core.info(`  📋 Created ruleset "${rulesetName}" (ID: ${newRuleset.id})`);
        } catch (error) {
          core.warning(`  ⚠️  Failed to create ruleset "${rulesetName}": ${error.message}`);
          subResults[subResults.length - 1] = createSubResult(
            'ruleset-create',
            SubResultStatus.WARNING,
            `Failed to create "${rulesetName}": ${error.message}`
          );
          hasFailed = true;
        }
      }
    }
  }

  // Delete unmanaged rulesets (those not in the managed set)
  if (deleteUnmanaged) {
    for (const existing of existingRulesets) {
      if (!managedNames.has(existing.name)) {
        core.info(`  🗑️ ${wouldPrefix}Delete ruleset: ${existing.name} (ID: ${existing.id})`);
        subResults.push(
          createSubResult(
            'ruleset-delete',
            SubResultStatus.CHANGED,
            `${wouldPrefix}delete "${existing.name}" (ID: ${existing.id})`
          )
        );

        if (!dryRun) {
          try {
            await octokit.request('DELETE /orgs/{org}/rulesets/{ruleset_id}', {
              org,
              ruleset_id: existing.id
            });
          } catch (error) {
            core.warning(`  ⚠️  Failed to delete ruleset "${existing.name}": ${error.message}`);
            subResults[subResults.length - 1] = createSubResult(
              'ruleset-delete',
              SubResultStatus.WARNING,
              `Failed to delete "${existing.name}": ${error.message}`
            );
            hasFailed = true;
          }
        }
      }
    }
  }

  return { subResults, failed: hasFailed };
}

// ─── Result helpers ─────────────────────────────────────────────────────────────

/**
 * Check if an org result has any changes.
 * @param {{ subResults: Array }} result
 * @returns {boolean}
 */
function hasOrgChanges(result) {
  return result.subResults?.some(s => s.status === SubResultStatus.CHANGED) ?? false;
}

// ─── Main ───────────────────────────────────────────────────────────────────────

/**
 * Main action logic
 */
export async function run() {
  try {
    // Get inputs
    const githubToken = core.getInput('github-token');
    const githubApiUrl = core.getInput('github-api-url') || 'https://api.github.com';
    const organizationsInput = core.getInput('organizations');
    const organizationsFile = core.getInput('organizations-file');
    const customPropertiesFile = core.getInput('custom-properties-file');
    const deleteUnmanagedProperties = getBooleanInput('delete-unmanaged-properties') ?? false;
    const rulesetsFileInput = core.getInput('rulesets-file');
    const rulesetsFiles = parseRulesetsFileValue(rulesetsFileInput);
    const deleteUnmanagedRulesets = getBooleanInput('delete-unmanaged-rulesets') ?? false;
    const issueTypesFile = core.getInput('issue-types-file');
    const deleteUnmanagedIssueTypes = getBooleanInput('delete-unmanaged-issue-types') ?? false;
    const memberPrivilegesFromInputs = getMemberPrivilegesFromInputs();
    const actionsPolicyFromInputs = getActionsPolicyFromInputs();
    const actionsAllowListFile = core.getInput('actions-allow-list-file');
    const dryRun = getBooleanInput('dry-run') ?? false;

    core.info('Starting Bulk GitHub Organization Settings Sync Action...');

    if (dryRun) {
      core.info('🔍 DRY-RUN MODE: No changes will be applied');
    }

    if (!githubToken) {
      throw new Error('github-token is required');
    }

    // Parse organization list
    const orgList = parseOrganizations(
      organizationsInput,
      organizationsFile,
      customPropertiesFile,
      rulesetsFiles,
      deleteUnmanagedRulesets,
      issueTypesFile,
      memberPrivilegesFromInputs,
      actionsPolicyFromInputs,
      actionsAllowListFile
    );

    // Check that at least one setting type is specified
    const hasCustomProperties = orgList.some(o => o.customProperties && o.customProperties.length > 0);
    const hasRulesets = orgList.some(o => o.rulesetsFiles && o.rulesetsFiles.length > 0);
    const hasIssueTypes = orgList.some(o => o.issueTypes && o.issueTypes.length > 0);
    const hasMemberPrivileges = orgList.some(o => o.memberPrivileges && Object.keys(o.memberPrivileges).length > 0);
    const hasActionsPolicy = orgList.some(
      o =>
        (o.actionsPolicy && Object.keys(o.actionsPolicy).length > 0) ||
        (o.actionsAllowList && o.actionsAllowList.length > 0)
    );
    if (!hasCustomProperties && !hasRulesets && !hasIssueTypes && !hasMemberPrivileges && !hasActionsPolicy) {
      throw new Error(
        'At least one setting must be specified. Provide custom properties via ' +
          '"organizations-file" or via "organizations" + "custom-properties-file" inputs, ' +
          'provide issue types via "issue-types-file", rulesets via "rulesets-file", member privileges via ' +
          'individual inputs (e.g., "default-repository-permission"), or actions policy via ' +
          'individual inputs (e.g., "actions-policy-allowed-actions").'
      );
    }

    // Initialize Octokit
    const octokit = new Octokit({
      auth: githubToken,
      baseUrl: githubApiUrl
    });

    core.info(`Processing ${orgList.length} organization(s)...`);

    if (deleteUnmanagedProperties) {
      core.info('⚠️  delete-unmanaged-properties is enabled: properties not in config will be deleted');
    }

    if (deleteUnmanagedRulesets) {
      core.info('⚠️  delete-unmanaged-rulesets is enabled: rulesets not in config will be deleted');
    }

    if (deleteUnmanagedIssueTypes) {
      core.info('⚠️  delete-unmanaged-issue-types is enabled: issue types not in config will be deleted');
    }

    // Process organizations
    const results = [];
    let successCount = 0;
    let failureCount = 0;
    let changedCount = 0;
    let warningCount = 0;

    for (const orgConfig of orgList) {
      const org = orgConfig.org;
      core.info(`\nProcessing ${org}...`);

      const result = {
        organization: org,
        success: true,
        hasWarnings: false,
        subResults: [],
        dryRun
      };

      try {
        // Sync custom properties
        if (orgConfig.customProperties && orgConfig.customProperties.length > 0) {
          core.info(`  🏷️  Syncing custom properties (${orgConfig.customProperties.length} defined)...`);
          const cpResult = await syncCustomProperties(
            octokit,
            org,
            orgConfig.customProperties,
            orgConfig.deleteUnmanagedProperties ?? deleteUnmanagedProperties,
            dryRun
          );
          result.subResults.push(...cpResult.subResults);

          if (cpResult.failed) {
            result.success = false;
            result.error = 'Custom properties sync failed';
          }
        }

        // Sync issue types
        if (orgConfig.issueTypes && orgConfig.issueTypes.length > 0) {
          core.info(`  🏷️  Syncing issue types (${orgConfig.issueTypes.length} defined)...`);
          const itResult = await syncIssueTypes(
            octokit,
            org,
            orgConfig.issueTypes,
            orgConfig.deleteUnmanagedIssueTypes ?? deleteUnmanagedIssueTypes,
            dryRun
          );
          result.subResults.push(...itResult.subResults);

          if (itResult.failed) {
            result.success = false;
            result.error = result.error ? `${result.error}; Issue types sync failed` : 'Issue types sync failed';
          }
        }

        // Sync rulesets
        if (orgConfig.rulesetsFiles && orgConfig.rulesetsFiles.length > 0) {
          core.info(`  📋 Syncing rulesets from ${orgConfig.rulesetsFiles.length} file(s)...`);
          const rsResult = await syncOrgRulesets(
            octokit,
            org,
            orgConfig.rulesetsFiles,
            orgConfig.deleteUnmanagedRulesets ?? false,
            dryRun
          );
          result.subResults.push(...rsResult.subResults);

          if (rsResult.failed) {
            result.success = false;
            result.error = result.error ? `${result.error}; Rulesets sync failed` : 'Rulesets sync failed';
          }
        }

        // Sync member privileges
        if (orgConfig.memberPrivileges && Object.keys(orgConfig.memberPrivileges).length > 0) {
          const settingCount = Object.keys(orgConfig.memberPrivileges).length;
          core.info(`  🔧 Syncing member privileges (${settingCount} setting(s))...`);
          const mpResult = await syncMemberPrivileges(octokit, org, orgConfig.memberPrivileges, dryRun);
          result.subResults.push(...mpResult.subResults);

          if (mpResult.failed) {
            result.success = false;
            result.error = result.error
              ? `${result.error}; Member privileges sync failed`
              : 'Member privileges sync failed';
          }
        }

        // Sync actions policy
        const hasActionsPolicyCfg =
          (orgConfig.actionsPolicy && Object.keys(orgConfig.actionsPolicy).length > 0) ||
          (orgConfig.actionsAllowList && orgConfig.actionsAllowList.length > 0);
        if (hasActionsPolicyCfg) {
          const policySettings = orgConfig.actionsPolicy || {};
          const allowList = orgConfig.actionsAllowList || null;
          const settingCount = Object.keys(policySettings).length + (allowList ? 1 : 0);
          core.info(`  🔒 Syncing actions policy (${settingCount} setting(s))...`);
          const apResult = await syncActionsPolicy(octokit, org, policySettings, allowList, dryRun);
          result.subResults.push(...apResult.subResults);

          if (apResult.failed) {
            result.success = false;
            result.error = result.error ? `${result.error}; Actions policy sync failed` : 'Actions policy sync failed';
          }
        }

        // Derive hasWarnings from subResults
        result.hasWarnings = result.subResults.some(s => s.status === SubResultStatus.WARNING);

        if (!result.success) {
          // Sync function reported failure (e.g., PATCH failed)
          failureCount++;
          core.warning(`❌ Failed to update ${org}: ${result.error}`);
        } else {
          successCount++;
          if (result.hasWarnings) {
            warningCount++;
          }
          const orgHasChanges = hasOrgChanges(result);
          if (orgHasChanges) {
            changedCount++;
          }

          if (dryRun) {
            if (orgHasChanges) {
              core.info(`🔍 Would update ${org}`);
            } else {
              core.info(`✅ No changes needed for ${org}`);
            }
          } else {
            if (orgHasChanges) {
              core.info(`✅ Successfully updated ${org}`);
            } else {
              core.info(`✅ No changes needed for ${org}`);
            }
          }
        }
      } catch (error) {
        result.success = false;
        result.error = error.message;
        failureCount++;
        core.warning(`❌ Failed to update ${org}: ${error.message}`);
      }

      results.push(result);
    }

    // Set outputs
    const unchangedCount = successCount - changedCount;
    core.setOutput('updated-organizations', successCount.toString());
    core.setOutput('changed-organizations', changedCount.toString());
    core.setOutput('unchanged-organizations', unchangedCount.toString());
    core.setOutput('failed-organizations', failureCount.toString());
    core.setOutput('warning-organizations', warningCount.toString());
    core.setOutput('results', JSON.stringify(results));

    // Create summary
    const summaryTable = [
      [
        { data: 'Organization', header: true },
        { data: 'Status', header: true },
        { data: 'Details', header: true }
      ],
      ...results.map(r => {
        if (!r.success) {
          return [r.organization, '❌ Failed', r.error];
        }

        const hasChanges = hasOrgChanges(r);
        let status;
        if (r.hasWarnings) {
          status = '⚠️ Warning';
        } else if (hasChanges) {
          status = '✅ Changed';
        } else {
          status = '➖ No changes';
        }

        let details;
        if (r.subResults && r.subResults.length > 0) {
          const messages = r.subResults
            .filter(s => s.status === SubResultStatus.WARNING || s.status === SubResultStatus.CHANGED)
            .map(s => formatSubResultSummary(s));
          details = messages.length > 0 ? messages.join('; ') : 'No changes needed';
        } else {
          details = 'No changes needed';
        }

        return [r.organization, status, details];
      })
    ];

    try {
      const heading = dryRun
        ? 'Bulk Organization Settings Sync Results (DRY-RUN)'
        : 'Bulk Organization Settings Sync Results';

      let summaryBuilder = core.summary.addHeading(heading);

      if (dryRun) {
        summaryBuilder = summaryBuilder.addRaw('\n**🔍 DRY-RUN MODE:** No changes were applied\n');
      }

      await summaryBuilder
        .addRaw(`\n**Total Organizations:** ${orgList.length}`)
        .addRaw(`\n**Changed:** ${changedCount}`)
        .addRaw(`\n**Unchanged:** ${unchangedCount}`)
        .addRaw(`\n**Warnings:** ${warningCount}`)
        .addRaw(`\n**Failed:** ${failureCount}\n\n`)
        .addTable(summaryTable)
        .write();
    } catch {
      // Fallback for local development
      const heading = dryRun
        ? '🔍 DRY-RUN: Bulk Organization Settings Sync Results'
        : '📊 Bulk Organization Settings Sync Results';
      core.info(heading);
      core.info(`Total Organizations: ${orgList.length}`);
      core.info(`Changed: ${changedCount}`);
      core.info(`Unchanged: ${unchangedCount}`);
      core.info(`Warnings: ${warningCount}`);
      core.info(`Failed: ${failureCount}`);
      for (const result of results) {
        if (!result.success) {
          core.info(`  ${result.organization}: ❌ ${result.error}`);
        } else if (result.hasWarnings) {
          core.info(`  ${result.organization}: ⚠️ Warning`);
        } else {
          const hasChanges = hasOrgChanges(result);
          const details = dryRun
            ? hasChanges
              ? 'Would update'
              : 'No changes needed'
            : hasChanges
              ? 'Updated'
              : 'No changes needed';
          core.info(`  ${result.organization}: ${hasChanges ? '✅' : '➖'} ${details}`);
        }
      }
    }

    if (failureCount > 0) {
      core.setFailed(`${failureCount} organization(s) failed to update`);
    } else {
      core.info('\n✅ Action completed successfully!');
    }
  } catch (error) {
    core.setFailed(`Action failed with error: ${error.message}`);
  }
}

// Execute the action (only when run directly, not when imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  run();
}

// Export as default for testing
export default run;
