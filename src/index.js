/**
 * Bulk GitHub Organization Settings Sync Action
 * Sync organization settings (custom properties, etc.) across multiple GitHub organizations
 *
 * Local Development & Testing:
 *
 * Uses core.getInput() which reads INPUT_<NAME> env vars (hyphens preserved).
 * Since shell variables can't contain hyphens, set these via env(1):
 *
 *    env 'INPUT_GITHUB-TOKEN=ghp_xxx' 'INPUT_ORGANIZATIONS=my-org' node src/index.js
 */

import * as core from '@actions/core';
import { Octokit } from '@octokit/rest';
import * as fs from 'fs';
import * as yaml from 'js-yaml';

// ─── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Parse a boolean-ish action input, returning null when the input is empty.
 * @param {string} name - Input name
 * @returns {boolean|null}
 */
function getBooleanInput(name) {
  const val = core.getInput(name);
  if (val === '') return null;
  if (val === 'true') return true;
  if (val === 'false') return false;
  throw new Error(`Input "${name}" must be "true" or "false", got "${val}"`);
}

// ─── YAML key validation ────────────────────────────────────────────────────────

/**
 * Known keys for organization config entries in the YAML file.
 * Used to warn about typos or unknown keys.
 */
const KNOWN_ORG_CONFIG_KEYS = new Set(['org', 'custom-properties']);

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
 * Validate organization configuration and warn about unknown keys.
 * @param {Object} orgConfig - Organization configuration object from YAML
 * @param {string} orgName - Organization name for logging context
 */
export function validateOrgConfig(orgConfig, orgName) {
  if (typeof orgConfig !== 'object' || orgConfig === null) {
    return;
  }

  for (const key of Object.keys(orgConfig)) {
    if (!KNOWN_ORG_CONFIG_KEYS.has(key)) {
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
  'custom-property-delete': 'custom property (deleted)'
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
 * Supports layering: base settings from action inputs (custom-properties-file) are
 * merged with per-org overrides from organizations-file. Per-org properties override
 * base properties with the same name; base properties not overridden are preserved.
 *
 * Modes:
 *   1. organizations-file (optionally combined with custom-properties-file for base settings)
 *   2. organizations input + custom-properties-file (same properties for all orgs)
 * @param {string} organizationsInput - Comma-separated org names
 * @param {string} organizationsFile - Path to YAML config file
 * @param {string} customPropertiesFile - Path to custom properties YAML file
 * @returns {Array<{ org: string, customProperties?: Array }>} Parsed org configs
 */
export function parseOrganizations(organizationsInput, organizationsFile, customPropertiesFile) {
  // Load base custom properties from separate file (applies to all orgs)
  let baseCustomProperties = null;
  if (customPropertiesFile) {
    baseCustomProperties = parseCustomPropertiesFile(customPropertiesFile);
  }

  if (organizationsFile) {
    const orgConfigs = parseOrganizationsFile(organizationsFile);

    // Merge base properties with per-org overrides
    if (baseCustomProperties) {
      for (const orgConfig of orgConfigs) {
        orgConfig.customProperties = mergeCustomProperties(baseCustomProperties, orgConfig.customProperties || []);
      }
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
    ...(baseCustomProperties ? { customProperties: baseCustomProperties } : {})
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
 * Parse the organizations YAML config file.
 * @param {string} filePath - Path to the YAML file
 * @returns {Array<{ org: string, customProperties?: Array }>}
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

  return config.orgs.map(orgConfig => {
    if (!orgConfig.org) {
      throw new Error('Each entry in "orgs" must have an "org" field');
    }

    validateOrgConfig(orgConfig, orgConfig.org);

    const result = { org: orgConfig.org };

    if (orgConfig['custom-properties']) {
      result.customProperties = normalizeCustomProperties(orgConfig['custom-properties']);
    }

    return result;
  });
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
      // multi_select default values are arrays; other types are strings
      if (prop['value-type'] === 'multi_select' && Array.isArray(prop['default-value'])) {
        normalized.default_value = prop['default-value'].map(v => String(v));
      } else {
        normalized.default_value = String(prop['default-value']);
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
  if ((existing.default_value || null) !== (desired.default_value || null)) {
    changes.push(`default_value: ${existing.default_value || 'none'} → ${desired.default_value || 'none'}`);
  }
  if ((existing.values_editable_by || 'org_actors') !== (desired.values_editable_by || 'org_actors')) {
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

  // Determine deletions
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
            // Replace the last CHANGED sub-result with a WARNING
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

  // Apply creates/updates via batch PUT
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
    }
  }

  return { subResults };
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
    const dryRun = getBooleanInput('dry-run') ?? false;

    core.info('Starting Bulk GitHub Organization Settings Sync Action...');

    if (dryRun) {
      core.info('🔍 DRY-RUN MODE: No changes will be applied');
    }

    if (!githubToken) {
      throw new Error('github-token is required');
    }

    // Parse organization list
    const orgList = parseOrganizations(organizationsInput, organizationsFile, customPropertiesFile);

    // Check that at least one setting type is specified
    const hasSettings = orgList.some(o => o.customProperties && o.customProperties.length > 0);
    if (!hasSettings) {
      throw new Error(
        'At least one setting must be specified. Provide custom properties via ' +
          '"organizations-file" or via "organizations" + "custom-properties-file" inputs.'
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
            deleteUnmanagedProperties,
            dryRun
          );
          result.subResults.push(...cpResult.subResults);
        }

        // Derive hasWarnings from subResults
        result.hasWarnings = result.subResults.some(s => s.status === SubResultStatus.WARNING);

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

      summaryBuilder
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

    core.info('\n✅ Action completed successfully!');

    if (failureCount > 0) {
      core.warning(`${failureCount} organization(s) failed to update`);
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
