/**
 * Tests for the Bulk GitHub Organization Settings Sync Action
 */

import { jest } from '@jest/globals';

// ─── Mock fs module ─────────────────────────────────────────────────────────────

const mockFs = {
  readFileSync: jest.fn(),
  existsSync: jest.fn()
};
// CJS modules expose named exports and a default that mirrors them
mockFs.default = mockFs;

// Mock action.yml content so getKnownOrgConfigKeys() works under mocked fs
const mockActionYmlContent = `
name: 'Bulk GitHub Organization Settings Sync'
inputs:
  github-token:
    description: 'GitHub token'
  github-api-url:
    description: 'GitHub API URL'
  organizations:
    description: 'Comma-separated list of organization names'
  organizations-file:
    description: 'Path to YAML file'
  custom-properties-file:
    description: 'Custom properties file'
  delete-unmanaged-properties:
    description: 'Delete unmanaged properties'
  issue-types-file:
    description: 'Issue types file'
  delete-unmanaged-issue-types:
    description: 'Delete unmanaged issue types'
  default-repository-permission:
    description: 'Default permission level'
  members-can-create-repositories:
    description: 'Can members create repos'
  members-can-create-public-repositories:
    description: 'Can members create public repos'
  members-can-create-private-repositories:
    description: 'Can members create private repos'
  members-can-create-internal-repositories:
    description: 'Can members create internal repos'
  members-can-fork-private-repositories:
    description: 'Can members fork private repos'
  web-commit-signoff-required:
    description: 'Web commit signoff required'
  members-can-create-pages:
    description: 'Can members create pages'
  members-can-create-public-pages:
    description: 'Can members create public pages'
  members-can-create-private-pages:
    description: 'Can members create private pages'
  members-can-invite-outside-collaborators:
    description: 'Can members invite outside collaborators'
  members-can-create-teams:
    description: 'Can members create teams'
  members-can-delete-repositories:
    description: 'Can members delete repos'
  members-can-change-repo-visibility:
    description: 'Can members change visibility'
  members-can-delete-issues:
    description: 'Can members delete issues'
  default-repository-branch:
    description: 'Default branch name'
  deploy-keys-enabled-for-repositories:
    description: 'Deploy keys enabled'
  readers-can-create-discussions:
    description: 'Readers can create discussions'
  members-can-view-dependency-insights:
    description: 'Members can view dependency insights'
  display-commenter-full-name-setting-enabled:
    description: 'Display commenter full name'
  rulesets-file:
    description: 'Rulesets file'
  delete-unmanaged-rulesets:
    description: 'Delete unmanaged rulesets'
  custom-org-roles-file:
    description: 'Custom org roles file'
  delete-unmanaged-org-roles:
    description: 'Delete unmanaged org roles'
  custom-repo-roles-file:
    description: 'Custom repo roles file'
  delete-unmanaged-repo-roles:
    description: 'Delete unmanaged repo roles'
  code-security-configurations-file:
    description: 'Code security configurations file'
  delete-unmanaged-code-security-configurations:
    description: 'Delete unmanaged code security configurations'
  actions-policy-allowed-actions:
    description: 'Allowed actions policy'
  actions-policy-default-workflow-permissions:
    description: 'Default workflow permissions'
  actions-policy-actions-can-approve-pull-request-reviews:
    description: 'Actions can approve PRs'
  actions-policy-github-owned-allowed:
    description: 'GitHub-owned actions allowed'
  actions-policy-verified-allowed:
    description: 'Verified actions allowed'
  actions-allow-list-file:
    description: 'Actions allow list file'
  dry-run:
    description: 'Dry run mode'
`;

// Per-test mock file content and YAML results
let testMockFiles = {};

/**
 * Reset fs mock implementations to defaults.
 * action.yml is always available; other files are controlled via setMockFileContent.
 */
function setupDefaultMocks() {
  testMockFiles = {};

  mockFs.existsSync.mockImplementation(filePath => {
    if (typeof filePath === 'string' && filePath.endsWith('action.yml')) return true;
    return filePath in testMockFiles;
  });

  mockFs.readFileSync.mockImplementation((filePath, _encoding) => {
    if (typeof filePath === 'string' && filePath.endsWith('action.yml')) {
      return mockActionYmlContent;
    }
    if (testMockFiles[filePath] !== undefined) return testMockFiles[filePath];
    throw new Error(`ENOENT: no such file or directory, open '${filePath}'`);
  });
}

/**
 * Register mock file content for a given path.
 * @param {string} content - Raw YAML string the mock readFileSync will return
 * @param {string} filePath - The path that readFileSync / existsSync should match
 */
function setMockFileContent(content, filePath) {
  testMockFiles[filePath] = content;
}

// Mock the @actions/core module
const mockCore = {
  getInput: jest.fn(),
  getBooleanInput: jest.fn(),
  setOutput: jest.fn(),
  setFailed: jest.fn(),
  info: jest.fn(),
  warning: jest.fn(),
  setSecret: jest.fn(),
  summary: {
    addHeading: jest.fn().mockReturnThis(),
    addTable: jest.fn().mockReturnThis(),
    addRaw: jest.fn().mockReturnThis(),
    write: jest.fn().mockResolvedValue(undefined)
  }
};

// Mock octokit request function
// Mock octokit request and paginate functions
const mockRequest = jest.fn();
const mockPaginate = jest.fn();

// Mock octokit instance
const mockOctokit = {
  request: mockRequest,
  paginate: mockPaginate
};

// Mock the modules before importing the main module
jest.unstable_mockModule('fs', () => mockFs);
jest.unstable_mockModule('@actions/core', () => mockCore);
jest.unstable_mockModule('@octokit/rest', () => ({
  Octokit: jest.fn(() => mockOctokit)
}));

setupDefaultMocks();

// Import the main module and helper functions after mocking
const {
  default: run,
  parseOrganizations,
  parseOrganizationsFile,
  parseCustomPropertiesFile,
  normalizeCustomProperties,
  compareCustomProperty,
  syncCustomProperties,
  parseIssueTypesFile,
  normalizeIssueTypes,
  compareIssueType,
  syncIssueTypes,
  mergeIssueTypes,
  syncOrgRulesets,
  mergeCustomProperties,
  mergeMemberPrivileges,
  mergeCustomRoles,
  parseMemberPrivileges,
  getMemberPrivilegesFromInputs,
  syncMemberPrivileges,
  parseCustomOrgRolesFile,
  normalizeCustomOrgRoles,
  compareCustomOrgRole,
  syncCustomOrgRoles,
  parseCustomRepoRolesFile,
  normalizeCustomRepoRoles,
  compareCustomRepoRole,
  syncCustomRepoRoles,
  MEMBER_PRIVILEGE_SETTINGS,
  ORG_PROFILE_SETTINGS,
  parseOrgProfile,
  getOrgProfileFromInputs,
  mergeOrgProfile,
  syncOrgProfile,
  ACTIONS_POLICY_SETTINGS,
  parseActionsPolicy,
  getActionsPolicyFromInputs,
  mergeActionsPolicy,
  parseActionsAllowListFile,
  syncActionsPolicy,
  validateOrgConfig,
  resetKnownOrgConfigKeysCache,
  resolveFilePath,
  applyBasePathToOrgConfig,
  parseCodeSecurityConfigurationsFile,
  normalizeCodeSecurityConfigurations,
  compareCodeSecurityConfiguration,
  mergeCodeSecurityConfigurations,
  syncCodeSecurityConfigurations
} = await import('../src/index.js');

describe('Bulk GitHub Organization Settings Sync Action', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequest.mockReset();
    mockPaginate.mockReset();
    setupDefaultMocks();
    resetKnownOrgConfigKeysCache();
  });

  // ─── validateOrgConfig ───────────────────────────────────────────────

  describe('validateOrgConfig', () => {
    test('should not warn for known keys', () => {
      validateOrgConfig({ org: 'my-org', 'custom-properties': [] }, 'my-org');
      expect(mockCore.warning).not.toHaveBeenCalled();
    });

    test('should warn for unknown org-level key', () => {
      validateOrgConfig({ org: 'my-org', 'custm-properties': [] }, 'my-org');
      expect(mockCore.warning).toHaveBeenCalledWith(
        expect.stringContaining('Unknown configuration key "custm-properties"')
      );
    });

    test('should warn for unknown custom property key', () => {
      validateOrgConfig(
        {
          org: 'my-org',
          'custom-properties': [{ name: 'team', 'value-type': 'string', requred: true }]
        },
        'my-org'
      );
      expect(mockCore.warning).toHaveBeenCalledWith(expect.stringContaining('Unknown custom property key "requred"'));
    });

    test('should not warn for valid custom property keys', () => {
      validateOrgConfig(
        {
          org: 'my-org',
          'custom-properties': [
            {
              name: 'team',
              'value-type': 'single_select',
              required: true,
              description: 'Team',
              'default-value': null,
              'allowed-values': ['a'],
              'values-editable-by': 'org_actors'
            }
          ]
        },
        'my-org'
      );
      expect(mockCore.warning).not.toHaveBeenCalled();
    });

    test('should handle null/non-object gracefully', () => {
      expect(() => validateOrgConfig(null, 'test')).not.toThrow();
      expect(() => validateOrgConfig('string', 'test')).not.toThrow();
    });

    test('should warn for non-boolean delete-unmanaged-properties value', () => {
      validateOrgConfig({ org: 'my-org', 'delete-unmanaged-properties': 'yes' }, 'my-org');
      expect(mockCore.warning).toHaveBeenCalledWith(
        expect.stringContaining('Invalid "delete-unmanaged-properties" value')
      );
    });

    test('should not warn for boolean delete-unmanaged-properties value', () => {
      validateOrgConfig({ org: 'my-org', 'delete-unmanaged-properties': true }, 'my-org');
      expect(mockCore.warning).not.toHaveBeenCalled();
    });

    test('should not warn for action input keys used as per-org overrides', () => {
      validateOrgConfig(
        { org: 'my-org', 'custom-properties-file': './props.yml', 'delete-unmanaged-properties': true },
        'my-org'
      );
      expect(mockCore.warning).not.toHaveBeenCalled();
    });

    test('should warn for member privilege keys at the org top level', () => {
      validateOrgConfig({ org: 'my-org', 'default-repository-permission': 'read' }, 'my-org');
      expect(mockCore.warning).toHaveBeenCalledWith(
        expect.stringContaining(
          'Configuration key "default-repository-permission" for organization "my-org" must be nested under "member-privileges"'
        )
      );
    });

    test('should warn for actions policy input keys at the org top level', () => {
      validateOrgConfig({ org: 'my-org', 'actions-policy-allowed-actions': 'selected' }, 'my-org');
      expect(mockCore.warning).toHaveBeenCalledWith(
        expect.stringContaining(
          'Configuration key "actions-policy-allowed-actions" for organization "my-org" must be nested under "actions-policy" as "allowed-actions"'
        )
      );
    });

    test('should warn for base-only action inputs at the org top level', () => {
      validateOrgConfig({ org: 'my-org', 'dry-run': true }, 'my-org');
      expect(mockCore.warning).toHaveBeenCalledWith(
        expect.stringContaining('Action input "dry-run" is not supported as a per-org configuration key')
      );
    });

    test('should warn for unknown issue type key', () => {
      validateOrgConfig(
        {
          org: 'my-org',
          'issue-types': [{ name: 'Bug', descriptin: 'typo' }]
        },
        'my-org'
      );
      expect(mockCore.warning).toHaveBeenCalledWith(expect.stringContaining('Unknown issue type key "descriptin"'));
    });

    test('should not warn for valid issue type keys', () => {
      validateOrgConfig(
        {
          org: 'my-org',
          'issue-types': [
            {
              name: 'Bug',
              description: 'A bug',
              color: 'ff0000',
              'is-enabled': true
            }
          ]
        },
        'my-org'
      );
      expect(mockCore.warning).not.toHaveBeenCalled();
    });

    test('should warn when action.yml cannot be read', () => {
      resetKnownOrgConfigKeysCache();
      mockFs.readFileSync.mockImplementation(filePath => {
        if (typeof filePath === 'string' && filePath.endsWith('action.yml')) {
          throw new Error('ENOENT');
        }
        return '';
      });
      validateOrgConfig({ org: 'my-org', 'dry-run': true }, 'my-org');
      expect(mockCore.warning).toHaveBeenCalledWith(expect.stringContaining('Could not read action.yml'));
    });
  });

  // ─── normalizeCustomProperties ──────────────────────────────────────────

  describe('normalizeCustomProperties', () => {
    test('should normalize a string property', () => {
      const result = normalizeCustomProperties([
        {
          name: 'cost-center',
          'value-type': 'string',
          required: false,
          description: 'Cost center code'
        }
      ]);

      expect(result).toEqual([
        {
          property_name: 'cost-center',
          value_type: 'string',
          required: false,
          description: 'Cost center code',
          default_value: null,
          values_editable_by: 'org_actors'
        }
      ]);
    });

    test('should normalize a single_select property with allowed values', () => {
      const result = normalizeCustomProperties([
        {
          name: 'team',
          'value-type': 'single_select',
          required: true,
          description: 'Team ownership',
          'allowed-values': ['platform', 'frontend', 'backend'],
          'values-editable-by': 'org_and_repo_actors'
        }
      ]);

      expect(result).toEqual([
        {
          property_name: 'team',
          value_type: 'single_select',
          required: true,
          description: 'Team ownership',
          default_value: null,
          allowed_values: ['platform', 'frontend', 'backend'],
          values_editable_by: 'org_and_repo_actors'
        }
      ]);
    });

    test('should normalize a true_false property with default value', () => {
      const result = normalizeCustomProperties([
        {
          name: 'is-production',
          'value-type': 'true_false',
          'default-value': 'false',
          description: 'Production flag'
        }
      ]);

      expect(result[0].default_value).toBe('false');
      expect(result[0].value_type).toBe('true_false');
    });

    test('should throw for missing name', () => {
      expect(() => normalizeCustomProperties([{ 'value-type': 'string' }])).toThrow('must have a "name" field');
    });

    test('should throw for missing value-type', () => {
      expect(() => normalizeCustomProperties([{ name: 'test' }])).toThrow('must have a "value-type" field');
    });

    test('should throw for invalid value-type', () => {
      expect(() => normalizeCustomProperties([{ name: 'test', 'value-type': 'invalid' }])).toThrow(
        'invalid value-type'
      );
    });

    test('should throw for single_select without allowed-values', () => {
      expect(() => normalizeCustomProperties([{ name: 'test', 'value-type': 'single_select' }])).toThrow(
        'must have a non-empty "allowed-values" array'
      );
    });

    test('should throw for invalid values-editable-by', () => {
      expect(() =>
        normalizeCustomProperties([{ name: 'test', 'value-type': 'string', 'values-editable-by': 'everyone' }])
      ).toThrow('invalid values-editable-by');
    });

    test('should throw for single_select with default-value when required is false', () => {
      expect(() =>
        normalizeCustomProperties([
          {
            name: 'repo-type',
            'value-type': 'single_select',
            required: false,
            'default-value': 'unclassified',
            'allowed-values': ['exercise', 'platform', 'unclassified']
          }
        ])
      ).toThrow('cannot have a "default-value" when "required" is false');
    });

    test('should allow single_select with default-value when required is true', () => {
      const result = normalizeCustomProperties([
        {
          name: 'environment',
          'value-type': 'single_select',
          required: true,
          'default-value': 'production',
          'allowed-values': ['production', 'development']
        }
      ]);
      expect(result[0].default_value).toBe('production');
      expect(result[0].required).toBe(true);
    });

    test('should throw for default-value not in allowed-values for single_select', () => {
      expect(() =>
        normalizeCustomProperties([
          {
            name: 'env',
            'value-type': 'single_select',
            required: true,
            'default-value': 'staging',
            'allowed-values': ['production', 'development']
          }
        ])
      ).toThrow('not in allowed-values');
    });

    test('should throw for default-value entries not in allowed-values for multi_select', () => {
      expect(() =>
        normalizeCustomProperties([
          {
            name: 'envs',
            'value-type': 'multi_select',
            'default-value': ['production', 'staging'],
            'allowed-values': ['production', 'development']
          }
        ])
      ).toThrow('not in allowed-values');
    });
  });

  // ─── compareCustomProperty ──────────────────────────────────────────────

  describe('compareCustomProperty', () => {
    test('should detect no changes for identical properties', () => {
      const prop = {
        property_name: 'team',
        value_type: 'single_select',
        required: true,
        description: 'Team',
        default_value: null,
        values_editable_by: 'org_actors',
        allowed_values: ['a', 'b']
      };

      const { changed, changes } = compareCustomProperty(prop, prop);
      expect(changed).toBe(false);
      expect(changes).toHaveLength(0);
    });

    test('should detect value_type change', () => {
      const existing = {
        value_type: 'string',
        required: false,
        description: null,
        default_value: null,
        values_editable_by: 'org_actors'
      };
      const desired = { ...existing, value_type: 'single_select', allowed_values: ['a'] };

      const { changed, changes } = compareCustomProperty(existing, desired);
      expect(changed).toBe(true);
      expect(changes).toContain('value_type: string → single_select');
    });

    test('should detect required change', () => {
      const existing = {
        value_type: 'string',
        required: false,
        description: null,
        default_value: null,
        values_editable_by: 'org_actors'
      };
      const desired = { ...existing, required: true };

      const { changed } = compareCustomProperty(existing, desired);
      expect(changed).toBe(true);
    });

    test('should detect allowed_values change', () => {
      const existing = {
        value_type: 'single_select',
        required: false,
        description: null,
        default_value: null,
        values_editable_by: 'org_actors',
        allowed_values: ['a', 'b']
      };
      const desired = { ...existing, allowed_values: ['a', 'b', 'c'] };

      const { changed, changes } = compareCustomProperty(existing, desired);
      expect(changed).toBe(true);
      expect(changes).toContain('allowed_values updated');
    });

    test('should detect allowed_values order change', () => {
      const existing = {
        value_type: 'single_select',
        required: false,
        description: null,
        default_value: null,
        values_editable_by: 'org_actors',
        allowed_values: ['a', 'b', 'c']
      };
      const desired = { ...existing, allowed_values: ['c', 'b', 'a'] };

      const { changed, changes } = compareCustomProperty(existing, desired);
      expect(changed).toBe(true);
      expect(changes).toContain('allowed_values updated');
    });

    test('should not detect change when allowed_values are identical in order', () => {
      const existing = {
        value_type: 'single_select',
        required: false,
        description: null,
        default_value: null,
        values_editable_by: 'org_actors',
        allowed_values: ['a', 'b', 'c']
      };
      const desired = { ...existing, allowed_values: ['a', 'b', 'c'] };

      const { changed } = compareCustomProperty(existing, desired);
      expect(changed).toBe(false);
    });

    test('should detect description change', () => {
      const existing = {
        default_value: null,
        values_editable_by: 'org_actors'
      };
      const desired = { ...existing, description: 'new' };

      const { changed, changes } = compareCustomProperty(existing, desired);
      expect(changed).toBe(true);
      expect(changes).toContain('description updated');
    });
  });

  // ─── parseOrganizations ─────────────────────────────────────────────────

  describe('parseOrganizations', () => {
    test('should parse comma-separated organizations', () => {
      const result = parseOrganizations('org1, org2, org3', '', '');
      expect(result).toEqual([{ org: 'org1' }, { org: 'org2' }, { org: 'org3' }]);
    });

    test('should throw when no organizations specified', () => {
      expect(() => parseOrganizations('', '', '')).toThrow(
        'Either "organizations" or "organizations-file" must be specified'
      );
    });

    test('should parse organizations file', () => {
      const orgsYaml = `orgs:
  - org: my-org
  - org: my-other-org
    custom-properties:
      - name: team
        value-type: single_select
        required: true
        description: 'The team that owns this repository'
        allowed-values:
          - platform
          - frontend
          - backend
          - data-science
        values-editable-by: org_actors
`;
      setMockFileContent(orgsYaml, '/mock/orgs.yml');
      const result = parseOrganizations('', '/mock/orgs.yml', '');

      expect(result).toHaveLength(2);
      expect(result[0].org).toBe('my-org');
      expect(result[1].org).toBe('my-other-org');
      // my-org has no inline custom-properties
      expect(result[0].customProperties).toBeUndefined();
      // my-other-org has 1 override property
      expect(result[1].customProperties).toBeDefined();
      expect(result[1].customProperties.length).toBe(1);
    });

    test('should parse organizations with custom-properties-file', () => {
      const cpYaml = `- name: team
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
`;
      setMockFileContent(cpYaml, '/mock/custom-properties.yml');
      const result = parseOrganizations('my-org', '', '/mock/custom-properties.yml');

      expect(result).toHaveLength(1);
      expect(result[0].org).toBe('my-org');
      expect(result[0].customProperties).toBeDefined();
      expect(result[0].customProperties.length).toBe(4);
      expect(result[0].customProperties[0].property_name).toBe('team');
    });

    test('should merge base custom-properties-file with per-org overrides in organizations-file', () => {
      const orgsYaml = `orgs:
  - org: my-org
  - org: my-other-org
    custom-properties:
      - name: team
        value-type: single_select
        required: true
        description: 'The team that owns this repository'
        allowed-values:
          - platform
          - frontend
          - backend
          - data-science
        values-editable-by: org_actors
`;
      const cpYaml = `- name: team
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
`;
      setMockFileContent(orgsYaml, '/mock/orgs.yml');
      setMockFileContent(cpYaml, '/mock/custom-properties.yml');
      const result = parseOrganizations('', '/mock/orgs.yml', '/mock/custom-properties.yml');

      expect(result).toHaveLength(2);
      // my-org: no inline overrides → gets all 4 base properties
      expect(result[0].customProperties.length).toBe(4);
      // my-other-org: overrides "team" → gets 4 base + team override merged = 4
      expect(result[1].customProperties.length).toBe(4);
      // Verify the override took effect (data-science in allowed_values)
      const teamProp = result[1].customProperties.find(p => p.property_name === 'team');
      expect(teamProp.allowed_values).toContain('data-science');
    });

    test('should use per-org custom-properties-file to override global base', () => {
      const altCpYaml = `- name: department
  value-type: single_select
  required: true
  description: 'Department'
  allowed-values:
    - engineering
    - marketing
    - sales
  values-editable-by: org_actors
`;
      const orgsYaml = `orgs:
  - org: my-org
  - org: my-other-org
    custom-properties-file: '/mock/alt-custom-properties.yml'
    custom-properties:
      - name: department
        value-type: single_select
        required: true
        description: 'Department'
        allowed-values:
          - engineering
          - marketing
          - sales
          - data-science
        values-editable-by: org_actors
`;
      const globalCpYaml = `- name: team
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
`;
      setMockFileContent(orgsYaml, '/mock/orgs.yml');
      setMockFileContent(altCpYaml, '/mock/alt-custom-properties.yml');
      setMockFileContent(globalCpYaml, '/mock/custom-properties.yml');

      const result = parseOrganizations('', '/mock/orgs.yml', '/mock/custom-properties.yml');

      expect(result).toHaveLength(2);
      // my-org: no per-org file → uses global base (4 properties)
      expect(result[0].customProperties.length).toBe(4);
      expect(result[0].customProperties.find(p => p.property_name === 'team')).toBeDefined();

      // my-other-org: per-org file has 1 property (department), inline overrides it
      expect(result[1].customProperties.find(p => p.property_name === 'team')).toBeUndefined();
      const deptProp = result[1].customProperties.find(p => p.property_name === 'department');
      expect(deptProp).toBeDefined();
      expect(deptProp.allowed_values).toContain('data-science');
      expect(deptProp.allowed_values).toContain('engineering');
    });

    test('should parse per-org delete-unmanaged-properties override', () => {
      const orgsYaml = `orgs:
  - org: my-org
    custom-properties:
      - name: team
        value-type: string
        required: false
  - org: my-other-org
    delete-unmanaged-properties: true
    custom-properties:
      - name: team
        value-type: string
        required: false
`;
      setMockFileContent(orgsYaml, '/mock/orgs.yml');

      const result = parseOrganizations('', '/mock/orgs.yml', '');

      expect(result).toHaveLength(2);
      expect(result[0].deleteUnmanagedProperties).toBeUndefined();
      expect(result[1].deleteUnmanagedProperties).toBe(true);
    });

    test('should parse organizations with issue-types-file', () => {
      const itYaml = `- name: Bug
  description: Something is broken
  color: ff0000
- name: Feature
  description: A new feature
  color: 0e8a16
`;
      setMockFileContent(itYaml, '/mock/issue-types.yml');
      const result = parseOrganizations('my-org', '', '', [], false, '/mock/issue-types.yml');

      expect(result).toHaveLength(1);
      expect(result[0].org).toBe('my-org');
      expect(result[0].issueTypes).toBeDefined();
      expect(result[0].issueTypes.length).toBe(2);
      expect(result[0].issueTypes[0].name).toBe('Bug');
    });

    test('should merge base issue-types-file with per-org overrides in organizations-file', () => {
      const orgsYaml = `orgs:
  - org: my-org
  - org: my-other-org
    issue-types:
      - name: Bug
        description: A serious bug
        color: 0000ff
`;
      const itYaml = `- name: Bug
  description: Something is broken
  color: ff0000
- name: Feature
  description: A new feature
  color: 0e8a16
`;
      setMockFileContent(orgsYaml, '/mock/orgs.yml');
      setMockFileContent(itYaml, '/mock/issue-types.yml');
      const result = parseOrganizations('', '/mock/orgs.yml', '', [], false, '/mock/issue-types.yml');

      expect(result).toHaveLength(2);
      // my-org: no inline overrides → gets both base issue types
      expect(result[0].issueTypes.length).toBe(2);
      // my-other-org: overrides "Bug" → gets 2 merged (Bug overridden + Feature from base)
      expect(result[1].issueTypes.length).toBe(2);
      const bugType = result[1].issueTypes.find(t => t.name === 'Bug');
      expect(bugType.description).toBe('A serious bug');
      expect(bugType.color).toBe('0000ff');
    });
  });

  // ─── parseOrganizationsFile ─────────────────────────────────────────────

  describe('parseOrganizationsFile', () => {
    test('should throw for missing file', () => {
      expect(() => parseOrganizationsFile('/nonexistent/file.yml')).toThrow('not found');
    });

    test('should parse the sample config', () => {
      const orgsYaml = `orgs:
  - org: my-org
  - org: my-other-org
    custom-properties:
      - name: team
        value-type: single_select
        required: true
        description: 'The team that owns this repository'
        allowed-values:
          - platform
          - frontend
          - backend
          - data-science
        values-editable-by: org_actors
`;
      setMockFileContent(orgsYaml, '/mock/orgs.yml');
      const result = parseOrganizationsFile('/mock/orgs.yml');

      expect(result).toHaveLength(2);
      expect(result[0].org).toBe('my-org');
      // my-org has no inline custom-properties
      expect(result[0].customProperties).toBeUndefined();

      expect(result[1].org).toBe('my-other-org');
      const teamProp = result[1].customProperties.find(p => p.property_name === 'team');
      expect(teamProp).toBeDefined();
      expect(teamProp.value_type).toBe('single_select');
      expect(teamProp.required).toBe(true);
      expect(teamProp.allowed_values).toContain('data-science');
    });

    test('should throw for invalid format (no orgs array)', () => {
      setMockFileContent('settings: true', '/mock/bad.yml');
      expect(() => parseOrganizationsFile('/mock/bad.yml')).toThrow('expected a "orgs" array');
    });

    test('should throw for org entry without org field', () => {
      setMockFileContent('orgs:\n  - custom-properties: []', '/mock/bad.yml');
      expect(() => parseOrganizationsFile('/mock/bad.yml')).toThrow('must have an "org" field');
    });

    test('should throw for invalid custom-properties-file value (non-string)', () => {
      setMockFileContent('orgs:\n  - org: my-org\n    custom-properties-file: 123', '/mock/bad.yml');
      expect(() => parseOrganizationsFile('/mock/bad.yml')).toThrow(
        'Invalid "custom-properties-file" for org "my-org"'
      );
    });

    test('should throw for empty custom-properties-file value', () => {
      setMockFileContent(`orgs:\n  - org: my-org\n    custom-properties-file: ''`, '/mock/bad.yml');
      expect(() => parseOrganizationsFile('/mock/bad.yml')).toThrow(
        'Invalid "custom-properties-file" for org "my-org"'
      );
    });

    test('should resolve file paths with base-path', () => {
      const orgsYaml = `base-path: './config/'
orgs:
  - org: my-org
    custom-properties-file: 'custom-properties/base.yml'
    issue-types-file: 'issue-types/base.yml'
    rulesets-file: 'rulesets/branch-protection.json'
  - org: my-other-org
`;
      setMockFileContent(orgsYaml, '/mock/orgs.yml');
      const result = parseOrganizationsFile('/mock/orgs.yml');

      expect(result).toHaveLength(2);
      expect(result[0].customPropertiesFile).toBe('config/custom-properties/base.yml');
      expect(result[0].issueTypesFile).toBe('config/issue-types/base.yml');
      expect(result[0].rulesetsFiles).toEqual(['config/rulesets/branch-protection.json']);
      // Org without file paths should be unaffected
      expect(result[1].customPropertiesFile).toBeUndefined();
      expect(result[1].issueTypesFile).toBeUndefined();
      expect(result[1].rulesetsFiles).toBeUndefined();
    });

    test('should not modify absolute paths when base-path is set', () => {
      const orgsYaml = `base-path: './config/'
orgs:
  - org: my-org
    custom-properties-file: '/absolute/path/custom-properties.yml'
    rulesets-file: 'relative/ruleset.json'
`;
      setMockFileContent(orgsYaml, '/mock/orgs.yml');
      const result = parseOrganizationsFile('/mock/orgs.yml');

      expect(result[0].customPropertiesFile).toBe('/absolute/path/custom-properties.yml');
      expect(result[0].rulesetsFiles).toEqual(['config/relative/ruleset.json']);
    });

    test('should not modify paths when base-path is not set', () => {
      const orgsYaml = `orgs:
  - org: my-org
    custom-properties-file: 'custom-properties/base.yml'
`;
      setMockFileContent(orgsYaml, '/mock/orgs.yml');
      const result = parseOrganizationsFile('/mock/orgs.yml');

      expect(result[0].customPropertiesFile).toBe('custom-properties/base.yml');
    });

    test('should trim file paths before resolving with base-path', () => {
      const orgsYaml = `base-path: './config/'
orgs:
  - org: my-org
    custom-properties-file: ' custom-properties/base.yml '
    rulesets-file:
      - ' rulesets/branch-protection.json '
`;
      setMockFileContent(orgsYaml, '/mock/orgs.yml');
      const result = parseOrganizationsFile('/mock/orgs.yml');

      expect(result[0].customPropertiesFile).toBe('config/custom-properties/base.yml');
      expect(result[0].rulesetsFiles).toEqual(['config/rulesets/branch-protection.json']);
    });

    test('should preserve empty custom-properties-file validation after base-path resolution', () => {
      const orgsYaml = `base-path: './config/'
orgs:
  - org: my-org
    custom-properties-file: '   '
`;
      setMockFileContent(orgsYaml, '/mock/bad.yml');

      expect(() => parseOrganizationsFile('/mock/bad.yml')).toThrow(
        'Invalid "custom-properties-file" for org "my-org"'
      );
    });

    test('should resolve base-path with comma-separated rulesets-file', () => {
      const orgsYaml = `base-path: './config/'
orgs:
  - org: my-org
    rulesets-file: 'rulesets/a.json, rulesets/b.json'
`;
      setMockFileContent(orgsYaml, '/mock/orgs.yml');
      const result = parseOrganizationsFile('/mock/orgs.yml');

      expect(result[0].rulesetsFiles).toEqual(['config/rulesets/a.json', 'config/rulesets/b.json']);
    });

    test('should resolve base-path with array-format rulesets-file', () => {
      const orgsYaml = `base-path: './config/'
orgs:
  - org: my-org
    rulesets-file:
      - 'rulesets/branch-protection.json'
      - 'rulesets/tag-protection.json'
`;
      setMockFileContent(orgsYaml, '/mock/orgs.yml');
      const result = parseOrganizationsFile('/mock/orgs.yml');

      expect(result[0].rulesetsFiles).toEqual([
        'config/rulesets/branch-protection.json',
        'config/rulesets/tag-protection.json'
      ]);
    });

    test('should reject non-string base-path', () => {
      const orgsYaml = `base-path: 123
orgs:
  - org: my-org
`;
      setMockFileContent(orgsYaml, '/mock/orgs.yml');
      expect(() => parseOrganizationsFile('/mock/orgs.yml')).toThrow(
        `Invalid 'base-path' in /mock/orgs.yml: expected a string, got number`
      );
    });

    test('should treat whitespace-only base-path as no-op', () => {
      const orgsYaml = `base-path: '   '
orgs:
  - org: my-org
    custom-properties-file: './custom-properties.yml'
`;
      setMockFileContent(orgsYaml, '/mock/orgs.yml');
      const result = parseOrganizationsFile('/mock/orgs.yml');

      expect(result[0].customPropertiesFile).toBe('./custom-properties.yml');
    });

    test('should parse inline issue-types', () => {
      const orgsYaml = `orgs:
  - org: my-org
    issue-types:
      - name: Bug
        description: Something is broken
        color: ff0000
      - name: Feature
        description: A new feature
        color: 0e8a16
        is-enabled: true
`;
      setMockFileContent(orgsYaml, '/mock/orgs.yml');
      const result = parseOrganizationsFile('/mock/orgs.yml');

      expect(result).toHaveLength(1);
      expect(result[0].issueTypes).toHaveLength(2);
      expect(result[0].issueTypes[0].name).toBe('Bug');
      expect(result[0].issueTypes[0].color).toBe('ff0000');
      expect(result[0].issueTypes[1].name).toBe('Feature');
      expect(result[0].issueTypes[1].is_enabled).toBe(true);
    });

    test('should parse delete-unmanaged-issue-types', () => {
      const orgsYaml = `orgs:
  - org: my-org
    delete-unmanaged-issue-types: true
    issue-types:
      - name: Bug
        description: A bug
`;
      setMockFileContent(orgsYaml, '/mock/orgs.yml');
      const result = parseOrganizationsFile('/mock/orgs.yml');

      expect(result).toHaveLength(1);
      expect(result[0].deleteUnmanagedIssueTypes).toBe(true);
    });

    test('should throw for invalid issue-types-file value', () => {
      setMockFileContent('orgs:\n  - org: my-org\n    issue-types-file: 123', '/mock/bad.yml');
      expect(() => parseOrganizationsFile('/mock/bad.yml')).toThrow('Invalid "issue-types-file" for org "my-org"');
    });

    test('should throw for non-array inline issue-types', () => {
      setMockFileContent('orgs:\n  - org: my-org\n    issue-types:\n      name: Bug', '/mock/bad.yml');
      expect(() => parseOrganizationsFile('/mock/bad.yml')).toThrow(
        'Invalid "issue-types" for org "my-org": expected an array'
      );
    });
  });

  // ─── resolveFilePath ──────────────────────────────────────────────────────

  describe('resolveFilePath', () => {
    test('should join base path with relative file path', () => {
      expect(resolveFilePath('./base/', 'file.txt')).toBe('base/file.txt');
    });

    test('should not modify absolute paths', () => {
      expect(resolveFilePath('./base/', '/absolute/file.txt')).toBe('/absolute/file.txt');
    });

    test('should return non-string values unchanged', () => {
      expect(resolveFilePath('./base/', null)).toBeNull();
      expect(resolveFilePath('./base/', undefined)).toBeUndefined();
      expect(resolveFilePath('./base/', '')).toBe('');
    });

    test('should trim paths before resolving', () => {
      expect(resolveFilePath('./base/', ' file.txt ')).toBe('base/file.txt');
    });

    test('should return whitespace-only paths as empty', () => {
      expect(resolveFilePath('./base/', '   ')).toBe('');
    });
  });

  // ─── applyBasePathToOrgConfig ─────────────────────────────────────────────

  describe('applyBasePathToOrgConfig', () => {
    test('should return config unchanged when basePath is empty', () => {
      const config = { org: 'my-org', 'custom-properties-file': 'file.yml' };
      expect(applyBasePathToOrgConfig(config, '')).toEqual(config);
    });

    test('should not modify non-file-path keys', () => {
      const config = { org: 'my-org', 'delete-unmanaged-rulesets': true };
      const result = applyBasePathToOrgConfig(config, './base/');
      expect(result).toEqual({ org: 'my-org', 'delete-unmanaged-rulesets': true });
    });

    test('should resolve array values for rulesets-file', () => {
      const config = { org: 'my-org', 'rulesets-file': ['a.json', 'b.json'] };
      const result = applyBasePathToOrgConfig(config, './base/');
      expect(result['rulesets-file']).toEqual(['base/a.json', 'base/b.json']);
    });

    test('should resolve issue-types-file', () => {
      const config = { org: 'my-org', 'issue-types-file': 'issue-types.yml' };
      const result = applyBasePathToOrgConfig(config, './base/');
      expect(result['issue-types-file']).toBe('base/issue-types.yml');
    });

    test('should resolve actions-allow-list-file', () => {
      const config = { org: 'my-org', 'actions-allow-list-file': 'actions/allow-list.yml' };
      const result = applyBasePathToOrgConfig(config, './base/');
      expect(result['actions-allow-list-file']).toBe('base/actions/allow-list.yml');
    });
  });

  // ─── parseCustomPropertiesFile ──────────────────────────────────────────

  describe('parseCustomPropertiesFile', () => {
    test('should throw for missing file', () => {
      expect(() => parseCustomPropertiesFile('/nonexistent/file.yml')).toThrow('not found');
    });

    test('should parse the sample custom properties file', () => {
      const cpYaml = `- name: team
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
`;
      setMockFileContent(cpYaml, '/mock/custom-properties.yml');
      const result = parseCustomPropertiesFile('/mock/custom-properties.yml');

      expect(result).toHaveLength(4);
      expect(result[0].property_name).toBe('team');
      expect(result[1].property_name).toBe('environment');
      expect(result[2].property_name).toBe('is-production');
      expect(result[3].property_name).toBe('cost-center');
    });
  });

  // ─── mergeCustomProperties ───────────────────────────────────────────

  describe('mergeCustomProperties', () => {
    test('should return base properties when no org overrides', () => {
      const base = [
        { property_name: 'team', value_type: 'single_select', required: true },
        { property_name: 'env', value_type: 'multi_select', required: false }
      ];

      const result = mergeCustomProperties(base, []);
      expect(result).toHaveLength(2);
      expect(result[0].property_name).toBe('team');
      expect(result[1].property_name).toBe('env');
    });

    test('should override base property with org-specific property', () => {
      const base = [{ property_name: 'team', value_type: 'single_select', required: true, allowed_values: ['a', 'b'] }];
      const orgOverrides = [
        { property_name: 'team', value_type: 'single_select', required: false, allowed_values: ['x', 'y', 'z'] }
      ];

      const result = mergeCustomProperties(base, orgOverrides);
      expect(result).toHaveLength(1);
      expect(result[0].required).toBe(false);
      expect(result[0].allowed_values).toEqual(['x', 'y', 'z']);
    });

    test('should add org-specific properties not in base', () => {
      const base = [{ property_name: 'team', value_type: 'single_select', required: true }];
      const orgOverrides = [{ property_name: 'cost-center', value_type: 'string', required: false }];

      const result = mergeCustomProperties(base, orgOverrides);
      expect(result).toHaveLength(2);
      expect(result.find(p => p.property_name === 'team')).toBeDefined();
      expect(result.find(p => p.property_name === 'cost-center')).toBeDefined();
    });

    test('should preserve base properties not overridden by org', () => {
      const base = [
        { property_name: 'team', value_type: 'single_select', required: true },
        { property_name: 'env', value_type: 'multi_select', required: false }
      ];
      const orgOverrides = [{ property_name: 'team', value_type: 'single_select', required: false }];

      const result = mergeCustomProperties(base, orgOverrides);
      expect(result).toHaveLength(2);
      expect(result.find(p => p.property_name === 'team').required).toBe(false);
      expect(result.find(p => p.property_name === 'env').required).toBe(false);
    });
  });

  // ─── normalizeIssueTypes ─────────────────────────────────────────────────

  describe('normalizeIssueTypes', () => {
    test('should normalize an issue type with all fields', () => {
      const result = normalizeIssueTypes([
        {
          name: 'Bug',
          description: 'Something is broken',
          color: 'ff0000',
          'is-enabled': true
        }
      ]);

      expect(result).toEqual([
        {
          name: 'Bug',
          description: 'Something is broken',
          color: 'ff0000',
          is_enabled: true
        }
      ]);
    });

    test('should default is_enabled to true and missing fields to null', () => {
      const result = normalizeIssueTypes([{ name: 'Task' }]);

      expect(result).toEqual([
        {
          name: 'Task',
          description: null,
          color: null,
          is_enabled: true
        }
      ]);
    });

    test('should throw for missing name', () => {
      expect(() => normalizeIssueTypes([{ description: 'No name' }])).toThrow('must have a "name" field');
    });

    test('should throw for non-object entries', () => {
      expect(() => normalizeIssueTypes([null])).toThrow('Issue type entry at index 0 must be a key-value map');
      expect(() => normalizeIssueTypes([['Bug']])).toThrow('Issue type entry at index 0 must be a key-value map');
    });

    test('should handle is-enabled set to false', () => {
      const result = normalizeIssueTypes([{ name: 'Deprecated', 'is-enabled': false }]);
      expect(result[0].is_enabled).toBe(false);
    });

    test('should throw for non-boolean is-enabled values', () => {
      expect(() => normalizeIssueTypes([{ name: 'Deprecated', 'is-enabled': 'false' }])).toThrow(
        'Issue type "Deprecated" has invalid is-enabled value: expected a boolean'
      );
    });

    test('should trim and normalize color values', () => {
      const result = normalizeIssueTypes([{ name: 'Bug', color: ' FF0000 ' }]);
      expect(result[0].color).toBe('ff0000');
    });

    test('should throw for non-string color values', () => {
      expect(() => normalizeIssueTypes([{ name: 'Bug', color: 123456 }])).toThrow(
        'Issue type "Bug" has invalid color: expected a 6-character hex string'
      );
    });
  });

  // ─── compareIssueType ──────────────────────────────────────────────────

  describe('compareIssueType', () => {
    test('should detect no changes for identical issue types', () => {
      const issueType = {
        name: 'Bug',
        description: 'Something is broken',
        color: 'ff0000',
        is_enabled: true
      };

      const { changed, changes } = compareIssueType(issueType, issueType);
      expect(changed).toBe(false);
      expect(changes).toHaveLength(0);
    });

    test('should detect description change', () => {
      const existing = { name: 'Bug', description: 'Old desc', color: 'ff0000', is_enabled: true };
      const desired = { ...existing, description: 'New desc' };

      const { changed, changes } = compareIssueType(existing, desired);
      expect(changed).toBe(true);
      expect(changes).toContain('description updated');
    });

    test('should detect color change', () => {
      const existing = { name: 'Bug', description: null, color: 'ff0000', is_enabled: true };
      const desired = { ...existing, color: '00ff00' };

      const { changed, changes } = compareIssueType(existing, desired);
      expect(changed).toBe(true);
      expect(changes).toContain('color: ff0000 → 00ff00');
    });

    test('should detect is_enabled change', () => {
      const existing = { name: 'Bug', description: null, color: null, is_enabled: true };
      const desired = { ...existing, is_enabled: false };

      const { changed, changes } = compareIssueType(existing, desired);
      expect(changed).toBe(true);
      expect(changes).toContain('is_enabled: true → false');
    });
  });

  // ─── parseIssueTypesFile ──────────────────────────────────────────────

  describe('parseIssueTypesFile', () => {
    test('should throw for missing file', () => {
      expect(() => parseIssueTypesFile('/nonexistent/file.yml')).toThrow('not found');
    });

    test('should parse the issue types file', () => {
      const itYaml = `- name: Bug
  description: Something is broken
  color: ff0000
- name: Feature
  description: A new feature
  color: 0e8a16
  is-enabled: true
`;
      setMockFileContent(itYaml, '/mock/issue-types.yml');
      const result = parseIssueTypesFile('/mock/issue-types.yml');

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Bug');
      expect(result[0].color).toBe('ff0000');
      expect(result[1].name).toBe('Feature');
      expect(result[1].is_enabled).toBe(true);
    });

    test('should throw for non-array content', () => {
      setMockFileContent('name: Bug', '/mock/bad-it.yml');
      expect(() => parseIssueTypesFile('/mock/bad-it.yml')).toThrow('expected an array');
    });
  });

  // ─── mergeIssueTypes ──────────────────────────────────────────────────

  describe('mergeIssueTypes', () => {
    test('should return base issue types when no org overrides', () => {
      const base = [
        { name: 'Bug', description: 'A bug', color: 'ff0000', is_enabled: true },
        { name: 'Feature', description: 'A feature', color: '0e8a16', is_enabled: true }
      ];

      const result = mergeIssueTypes(base, []);
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Bug');
      expect(result[1].name).toBe('Feature');
    });

    test('should override base issue type with org-specific issue type', () => {
      const base = [{ name: 'Bug', description: 'A bug', color: 'ff0000', is_enabled: true }];
      const orgOverrides = [{ name: 'Bug', description: 'A serious bug', color: '0000ff', is_enabled: false }];

      const result = mergeIssueTypes(base, orgOverrides);
      expect(result).toHaveLength(1);
      expect(result[0].description).toBe('A serious bug');
      expect(result[0].color).toBe('0000ff');
    });

    test('should add org-specific issue types not in base', () => {
      const base = [{ name: 'Bug', description: 'A bug', color: 'ff0000', is_enabled: true }];
      const orgOverrides = [{ name: 'Task', description: 'A task', color: 'fbca04', is_enabled: true }];

      const result = mergeIssueTypes(base, orgOverrides);
      expect(result).toHaveLength(2);
      expect(result.find(t => t.name === 'Bug')).toBeDefined();
      expect(result.find(t => t.name === 'Task')).toBeDefined();
    });
  });

  // ─── syncIssueTypes ──────────────────────────────────────────────────

  describe('syncIssueTypes', () => {
    const desiredIssueTypes = [
      {
        name: 'Bug',
        description: 'Something is broken',
        color: 'ff0000',
        is_enabled: true
      }
    ];

    test('should create new issue types when none exist', async () => {
      mockRequest.mockResolvedValueOnce({ data: [] });
      mockRequest.mockResolvedValueOnce({ data: { id: 1, name: 'Bug' } });

      const result = await syncIssueTypes(mockOctokit, 'my-org', desiredIssueTypes, false, false);

      expect(result.subResults).toHaveLength(1);
      expect(result.subResults[0].kind).toBe('issue-type-create');
      expect(result.subResults[0].status).toBe('changed');
      expect(mockRequest).toHaveBeenCalledWith(
        'POST /orgs/{org}/issue-types',
        expect.objectContaining({
          org: 'my-org',
          name: 'Bug'
        })
      );
    });

    test('should detect no changes for identical issue types', async () => {
      mockRequest.mockResolvedValueOnce({
        data: [
          {
            id: 1,
            name: 'Bug',
            description: 'Something is broken',
            color: 'ff0000',
            is_enabled: true
          }
        ]
      });

      const result = await syncIssueTypes(mockOctokit, 'my-org', desiredIssueTypes, false, false);

      expect(result.subResults).toHaveLength(0);
      expect(mockRequest).toHaveBeenCalledTimes(1); // Only the GET
    });

    test('should detect and apply updates', async () => {
      mockRequest.mockResolvedValueOnce({
        data: [
          {
            id: 1,
            name: 'Bug',
            description: 'Old description',
            color: 'ff0000',
            is_enabled: true
          }
        ]
      });
      mockRequest.mockResolvedValueOnce({ data: {} });

      const result = await syncIssueTypes(mockOctokit, 'my-org', desiredIssueTypes, false, false);

      expect(result.subResults).toHaveLength(1);
      expect(result.subResults[0].kind).toBe('issue-type-update');
      expect(result.subResults[0].status).toBe('changed');
      expect(mockRequest).toHaveBeenCalledWith(
        'PATCH /orgs/{org}/issue-types/{issue_type_id}',
        expect.objectContaining({
          org: 'my-org',
          issue_type_id: 1
        })
      );
    });

    test('should delete unmanaged issue types when flag is set', async () => {
      mockRequest.mockResolvedValueOnce({
        data: [
          {
            id: 1,
            name: 'Bug',
            description: 'Something is broken',
            color: 'ff0000',
            is_enabled: true
          },
          {
            id: 2,
            name: 'Old-Type',
            description: 'Should be deleted',
            color: '000000',
            is_enabled: true
          }
        ]
      });
      mockRequest.mockResolvedValueOnce({ data: {} });

      const result = await syncIssueTypes(mockOctokit, 'my-org', desiredIssueTypes, true, false);

      expect(result.subResults).toHaveLength(1);
      expect(result.subResults[0].kind).toBe('issue-type-delete');
      expect(result.subResults[0].status).toBe('changed');
      expect(mockRequest).toHaveBeenCalledWith('DELETE /orgs/{org}/issue-types/{issue_type_id}', {
        org: 'my-org',
        issue_type_id: 2
      });
    });

    test('should not delete unmanaged issue types when flag is not set', async () => {
      mockRequest.mockResolvedValueOnce({
        data: [
          {
            id: 1,
            name: 'Bug',
            description: 'Something is broken',
            color: 'ff0000',
            is_enabled: true
          },
          {
            id: 2,
            name: 'Old-Type',
            description: 'Should not be deleted',
            color: '000000',
            is_enabled: true
          }
        ]
      });

      const result = await syncIssueTypes(mockOctokit, 'my-org', desiredIssueTypes, false, false);

      expect(result.subResults).toHaveLength(0);
      expect(mockRequest).toHaveBeenCalledTimes(1); // Only the GET
    });

    test('should handle dry-run mode without making API changes', async () => {
      mockRequest.mockResolvedValueOnce({ data: [] });

      const result = await syncIssueTypes(mockOctokit, 'my-org', desiredIssueTypes, false, true);

      expect(result.subResults).toHaveLength(1);
      expect(result.subResults[0].kind).toBe('issue-type-create');
      expect(result.subResults[0].status).toBe('changed');
      expect(result.subResults[0].message).toContain('Would');
      expect(mockRequest).toHaveBeenCalledTimes(1); // Only the GET
    });

    test('should handle API errors on create gracefully', async () => {
      mockRequest.mockResolvedValueOnce({ data: [] });
      mockRequest.mockRejectedValueOnce(new Error('Forbidden'));

      const result = await syncIssueTypes(mockOctokit, 'my-org', desiredIssueTypes, false, false);

      expect(result.subResults).toHaveLength(1);
      expect(result.subResults[0].status).toBe('warning');
      expect(result.subResults[0].message).toContain('Failed');
      expect(result.failed).toBe(true);
    });

    test('should mark update API errors as failed', async () => {
      mockRequest.mockResolvedValueOnce({
        data: [
          {
            id: 1,
            name: 'Bug',
            description: 'Old description',
            color: 'ff0000',
            is_enabled: true
          }
        ]
      });
      mockRequest.mockRejectedValueOnce(new Error('Forbidden'));

      const result = await syncIssueTypes(mockOctokit, 'my-org', desiredIssueTypes, false, false);

      expect(result.subResults).toHaveLength(1);
      expect(result.subResults[0].kind).toBe('issue-type-update');
      expect(result.subResults[0].status).toBe('warning');
      expect(result.failed).toBe(true);
    });

    test('should mark delete API errors as failed', async () => {
      mockRequest.mockResolvedValueOnce({
        data: [
          {
            id: 1,
            name: 'Bug',
            description: 'Something is broken',
            color: 'ff0000',
            is_enabled: true
          },
          {
            id: 2,
            name: 'Old-Type',
            description: 'Should be deleted',
            color: '000000',
            is_enabled: true
          }
        ]
      });
      mockRequest.mockRejectedValueOnce(new Error('Forbidden'));

      const result = await syncIssueTypes(mockOctokit, 'my-org', desiredIssueTypes, true, false);

      expect(result.subResults).toHaveLength(1);
      expect(result.subResults[0].kind).toBe('issue-type-delete');
      expect(result.subResults[0].status).toBe('warning');
      expect(result.failed).toBe(true);
    });

    test('should handle 404 on GET as empty issue types', async () => {
      const error404 = new Error('Not Found');
      error404.status = 404;
      mockRequest.mockRejectedValueOnce(error404);
      mockRequest.mockResolvedValueOnce({ data: { id: 1, name: 'Bug' } });

      const result = await syncIssueTypes(mockOctokit, 'my-org', desiredIssueTypes, false, false);

      expect(result.subResults).toHaveLength(1);
      expect(result.subResults[0].kind).toBe('issue-type-create');
    });
  });

  // ─── syncCustomProperties ──────────────────────────────────────────────

  describe('syncCustomProperties', () => {
    const desiredProperties = [
      {
        property_name: 'team',
        value_type: 'single_select',
        required: true,
        description: 'Team ownership',
        default_value: null,
        allowed_values: ['platform', 'frontend'],
        values_editable_by: 'org_actors'
      }
    ];

    test('should create new properties when none exist', async () => {
      // Mock: no existing properties
      mockRequest.mockResolvedValueOnce({ data: [] });
      // Mock: successful PATCH
      mockRequest.mockResolvedValueOnce({ data: {} });

      const result = await syncCustomProperties(mockOctokit, 'my-org', desiredProperties, false, false);

      expect(result.subResults).toHaveLength(1);
      expect(result.subResults[0].kind).toBe('custom-property-create');
      expect(result.subResults[0].status).toBe('changed');
      expect(mockRequest).toHaveBeenCalledWith('PATCH /orgs/{org}/properties/schema', {
        org: 'my-org',
        properties: desiredProperties
      });
    });

    test('should detect no changes for identical properties', async () => {
      // Mock: existing properties match desired
      mockRequest.mockResolvedValueOnce({
        data: [
          {
            property_name: 'team',
            value_type: 'single_select',
            required: true,
            description: 'Team ownership',
            default_value: null,
            allowed_values: ['platform', 'frontend'],
            values_editable_by: 'org_actors'
          }
        ]
      });

      const result = await syncCustomProperties(mockOctokit, 'my-org', desiredProperties, false, false);

      expect(result.subResults).toHaveLength(0);
      // Should not call PUT since nothing changed
      expect(mockRequest).toHaveBeenCalledTimes(1); // Only the GET
    });

    test('should detect and apply updates', async () => {
      // Mock: existing property has different required value
      mockRequest.mockResolvedValueOnce({
        data: [
          {
            property_name: 'team',
            value_type: 'single_select',
            required: false,
            description: 'Team ownership',
            default_value: null,
            allowed_values: ['platform', 'frontend'],
            values_editable_by: 'org_actors'
          }
        ]
      });
      // Mock: successful PATCH
      mockRequest.mockResolvedValueOnce({ data: {} });

      const result = await syncCustomProperties(mockOctokit, 'my-org', desiredProperties, false, false);

      expect(result.subResults).toHaveLength(1);
      expect(result.subResults[0].kind).toBe('custom-property-update');
      expect(result.subResults[0].status).toBe('changed');
    });

    test('should delete unmanaged properties when flag is set', async () => {
      // Mock: extra property exists
      mockRequest.mockResolvedValueOnce({
        data: [
          {
            property_name: 'team',
            value_type: 'single_select',
            required: true,
            description: 'Team ownership',
            default_value: null,
            allowed_values: ['platform', 'frontend'],
            values_editable_by: 'org_actors'
          },
          {
            property_name: 'old-property',
            value_type: 'string',
            required: false,
            description: 'Old property',
            default_value: null,
            values_editable_by: 'org_actors'
          }
        ]
      });
      // Mock: successful DELETE
      mockRequest.mockResolvedValueOnce({ data: {} });

      const result = await syncCustomProperties(mockOctokit, 'my-org', desiredProperties, true, false);

      expect(result.subResults).toHaveLength(1);
      expect(result.subResults[0].kind).toBe('custom-property-delete');
      expect(result.subResults[0].status).toBe('changed');
      expect(mockRequest).toHaveBeenCalledWith('DELETE /orgs/{org}/properties/schema/{custom_property_name}', {
        org: 'my-org',
        custom_property_name: 'old-property'
      });
    });

    test('should not delete unmanaged properties when flag is not set', async () => {
      mockRequest.mockResolvedValueOnce({
        data: [
          {
            property_name: 'team',
            value_type: 'single_select',
            required: true,
            description: 'Team ownership',
            default_value: null,
            allowed_values: ['platform', 'frontend'],
            values_editable_by: 'org_actors'
          },
          {
            property_name: 'old-property',
            value_type: 'string',
            required: false,
            description: 'Old property',
            default_value: null,
            values_editable_by: 'org_actors'
          }
        ]
      });

      const result = await syncCustomProperties(mockOctokit, 'my-org', desiredProperties, false, false);

      expect(result.subResults).toHaveLength(0);
      // Only the GET call, no DELETE
      expect(mockRequest).toHaveBeenCalledTimes(1);
    });

    test('should handle dry-run mode without making API changes', async () => {
      mockRequest.mockResolvedValueOnce({ data: [] });

      const result = await syncCustomProperties(mockOctokit, 'my-org', desiredProperties, false, true);

      expect(result.subResults).toHaveLength(1);
      expect(result.subResults[0].kind).toBe('custom-property-create');
      expect(result.subResults[0].status).toBe('changed');
      expect(result.subResults[0].message).toContain('Would');
      // Should only call GET, not PUT
      expect(mockRequest).toHaveBeenCalledTimes(1);
    });

    test('should handle API errors gracefully with warnings', async () => {
      mockRequest.mockResolvedValueOnce({ data: [] });
      mockRequest.mockRejectedValueOnce(new Error('Forbidden'));

      const result = await syncCustomProperties(mockOctokit, 'my-org', desiredProperties, false, false);

      expect(result.subResults).toHaveLength(1);
      expect(result.subResults[0].status).toBe('warning');
      expect(result.subResults[0].message).toContain('Failed');
    });

    test('should handle 404 on GET as empty properties', async () => {
      const error404 = new Error('Not Found');
      error404.status = 404;
      mockRequest.mockRejectedValueOnce(error404);
      // Mock: successful PATCH
      mockRequest.mockResolvedValueOnce({ data: {} });

      const result = await syncCustomProperties(mockOctokit, 'my-org', desiredProperties, false, false);

      expect(result.subResults).toHaveLength(1);
      expect(result.subResults[0].kind).toBe('custom-property-create');
    });
  });

  // ─── run (integration) ─────────────────────────────────────────────────

  describe('Action execution', () => {
    test('should fail when no github-token is provided', async () => {
      mockCore.getInput.mockReturnValue('');

      await run();

      expect(mockCore.setFailed).toHaveBeenCalledWith(expect.stringContaining('github-token is required'));
    });

    test('should fail when no organizations are specified', async () => {
      mockCore.getInput.mockImplementation(name => {
        if (name === 'github-token') return 'test-token';
        if (name === 'github-api-url') return 'https://api.github.com';
        return '';
      });

      await run();

      expect(mockCore.setFailed).toHaveBeenCalledWith(
        expect.stringContaining('Either "organizations" or "organizations-file" must be specified')
      );
    });

    test('should process orgs file and set outputs', async () => {
      const orgsYaml = `orgs:
  - org: my-org
  - org: my-other-org
    custom-properties:
      - name: team
        value-type: single_select
        required: true
        description: 'The team that owns this repository'
        allowed-values:
          - platform
          - frontend
          - backend
          - data-science
        values-editable-by: org_actors
`;
      const cpYaml = `- name: team
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
`;
      setMockFileContent(orgsYaml, '/mock/orgs.yml');
      setMockFileContent(cpYaml, '/mock/custom-properties.yml');

      mockCore.getInput.mockImplementation(name => {
        const inputs = {
          'github-token': 'test-token',
          'github-api-url': 'https://api.github.com',
          organizations: '',
          'organizations-file': '/mock/orgs.yml',
          'custom-properties-file': '/mock/custom-properties.yml',
          'delete-unmanaged-properties': 'false',
          'dry-run': 'true'
        };
        return inputs[name] ?? '';
      });
      mockCore.getBooleanInput.mockImplementation(name => {
        if (name === 'dry-run') return true;
        if (name === 'delete-unmanaged-properties') return false;
        return false;
      });

      // Mock: no existing properties for each org
      mockRequest.mockResolvedValueOnce({ data: [] });
      mockRequest.mockResolvedValueOnce({ data: [] });

      await run();

      expect(mockCore.setFailed).not.toHaveBeenCalled();
      expect(mockCore.setOutput).toHaveBeenCalledWith('updated-organizations', '2');
      expect(mockCore.setOutput).toHaveBeenCalledWith('changed-organizations', '2');
      expect(mockCore.setOutput).toHaveBeenCalledWith('failed-organizations', '0');
    });

    test('should handle org processing failure gracefully', async () => {
      const cpYaml = `- name: team
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
`;
      setMockFileContent(cpYaml, '/mock/custom-properties.yml');

      mockCore.getInput.mockImplementation(name => {
        const inputs = {
          'github-token': 'test-token',
          'github-api-url': 'https://api.github.com',
          organizations: 'my-org',
          'organizations-file': '',
          'custom-properties-file': '/mock/custom-properties.yml',
          'delete-unmanaged-properties': 'false',
          'dry-run': 'false'
        };
        return inputs[name] ?? '';
      });
      mockCore.getBooleanInput.mockImplementation(name => {
        if (name === 'dry-run') return false;
        if (name === 'delete-unmanaged-properties') return false;
        return false;
      });

      // Mock: GET throws non-404 error
      mockRequest.mockRejectedValueOnce(new Error('Unauthorized'));

      await run();

      expect(mockCore.setFailed).toHaveBeenCalledWith('1 organization(s) failed to update');
      expect(mockCore.setOutput).toHaveBeenCalledWith('failed-organizations', '1');
      expect(mockCore.warning).toHaveBeenCalledWith(expect.stringContaining('Failed to update my-org'));
    });

    test('should process organizations with rulesets-file input', async () => {
      const rulesetContent = JSON.stringify({
        name: 'test-ruleset',
        target: 'branch',
        enforcement: 'active',
        conditions: {
          ref_name: { include: ['~DEFAULT_BRANCH'], exclude: [] },
          repository_name: { include: ['~ALL'], exclude: [] }
        },
        rules: [{ type: 'deletion' }]
      });
      setMockFileContent(rulesetContent, '/mock/test-ruleset.json');

      mockCore.getInput.mockImplementation(name => {
        const inputs = {
          'github-token': 'test-token',
          'github-api-url': 'https://api.github.com',
          organizations: 'my-org',
          'organizations-file': '',
          'custom-properties-file': '',
          'rulesets-file': '/mock/test-ruleset.json',
          'delete-unmanaged-properties': 'false',
          'delete-unmanaged-rulesets': 'false',
          'dry-run': 'true'
        };
        return inputs[name] ?? '';
      });
      mockCore.getBooleanInput.mockImplementation(name => {
        if (name === 'dry-run') return true;
        if (name === 'delete-unmanaged-properties') return false;
        if (name === 'delete-unmanaged-rulesets') return false;
        return false;
      });

      // Mock: no existing rulesets
      mockPaginate.mockResolvedValueOnce([]);

      await run();

      expect(mockCore.setFailed).not.toHaveBeenCalled();
      expect(mockCore.setOutput).toHaveBeenCalledWith('updated-organizations', '1');
      expect(mockCore.setOutput).toHaveBeenCalledWith('changed-organizations', '1');
    });

    test('should process organizations with issue-types-file input', async () => {
      const itYaml = `- name: Bug
  description: Something is broken
  color: ff0000
- name: Feature
  description: A new feature
  color: 0e8a16
`;
      setMockFileContent(itYaml, '/mock/issue-types.yml');

      mockCore.getInput.mockImplementation(name => {
        const inputs = {
          'github-token': 'test-token',
          'github-api-url': 'https://api.github.com',
          organizations: 'my-org',
          'organizations-file': '',
          'custom-properties-file': '',
          'issue-types-file': '/mock/issue-types.yml',
          'rulesets-file': '',
          'delete-unmanaged-properties': 'false',
          'delete-unmanaged-rulesets': 'false',
          'delete-unmanaged-issue-types': 'false',
          'dry-run': 'true'
        };
        return inputs[name] ?? '';
      });
      mockCore.getBooleanInput.mockImplementation(name => {
        if (name === 'dry-run') return true;
        if (name === 'delete-unmanaged-properties') return false;
        if (name === 'delete-unmanaged-rulesets') return false;
        if (name === 'delete-unmanaged-issue-types') return false;
        return false;
      });

      // Mock: no existing issue types
      mockRequest.mockResolvedValueOnce({ data: [] });

      await run();

      expect(mockCore.setFailed).not.toHaveBeenCalled();
      expect(mockCore.setOutput).toHaveBeenCalledWith('updated-organizations', '1');
      expect(mockCore.setOutput).toHaveBeenCalledWith('changed-organizations', '1');
    });

    test('should allow empty custom org roles file when delete-unmanaged-org-roles is enabled', async () => {
      setMockFileContent('[]', '/mock/custom-org-roles.yml');

      mockCore.getInput.mockImplementation(name => {
        const inputs = {
          'github-token': 'test-token',
          'github-api-url': 'https://api.github.com',
          organizations: 'my-org',
          'organizations-file': '',
          'custom-org-roles-file': '/mock/custom-org-roles.yml',
          'delete-unmanaged-org-roles': 'true',
          'dry-run': 'true'
        };
        return inputs[name] ?? '';
      });
      mockCore.getBooleanInput.mockImplementation(name => {
        if (name === 'dry-run') return true;
        if (name === 'delete-unmanaged-org-roles') return true;
        return false;
      });
      mockPaginate.mockResolvedValueOnce([
        { id: 1, name: 'Unmanaged', description: null, permissions: ['x'], source: 'Organization' }
      ]);

      await run();

      expect(mockCore.setFailed).not.toHaveBeenCalled();
      expect(mockPaginate).toHaveBeenCalledWith(
        'GET /orgs/{org}/organization-roles',
        { org: 'my-org', per_page: 100 },
        expect.any(Function)
      );
      expect(mockCore.setOutput).toHaveBeenCalledWith('changed-organizations', '1');
    });

    test('should allow empty custom repo roles file when delete-unmanaged-repo-roles is enabled', async () => {
      setMockFileContent('[]', '/mock/custom-repo-roles.yml');

      mockCore.getInput.mockImplementation(name => {
        const inputs = {
          'github-token': 'test-token',
          'github-api-url': 'https://api.github.com',
          organizations: 'my-org',
          'organizations-file': '',
          'custom-repo-roles-file': '/mock/custom-repo-roles.yml',
          'delete-unmanaged-repo-roles': 'true',
          'dry-run': 'true'
        };
        return inputs[name] ?? '';
      });
      mockCore.getBooleanInput.mockImplementation(name => {
        if (name === 'dry-run') return true;
        if (name === 'delete-unmanaged-repo-roles') return true;
        return false;
      });
      mockPaginate.mockResolvedValueOnce([{ id: 1, name: 'Unmanaged', description: null, permissions: ['x'] }]);

      await run();

      expect(mockCore.setFailed).not.toHaveBeenCalled();
      expect(mockPaginate).toHaveBeenCalledWith(
        'GET /orgs/{org}/custom-repository-roles',
        { org: 'my-org', per_page: 100 },
        expect.any(Function)
      );
      expect(mockCore.setOutput).toHaveBeenCalledWith('changed-organizations', '1');
    });
  });

  // ─── syncOrgRulesets ────────────────────────────────────────────────────

  describe('syncOrgRulesets', () => {
    const rulesetPath = '/mock/test-ruleset.json';
    const tagRulesetPath = '/mock/test-tag-ruleset.json';

    const testRulesetContent = JSON.stringify({
      name: 'test-ruleset',
      target: 'branch',
      enforcement: 'active',
      conditions: {
        ref_name: { include: ['~DEFAULT_BRANCH'], exclude: [] },
        repository_name: { include: ['~ALL'], exclude: [] }
      },
      rules: [
        { type: 'deletion' },
        {
          type: 'pull_request',
          parameters: {
            required_approving_review_count: 1,
            dismiss_stale_reviews_on_push: true,
            require_code_owner_review: false,
            require_last_push_approval: false,
            required_review_thread_resolution: false,
            automatic_copilot_code_review_enabled: false
          }
        }
      ]
    });

    const testTagRulesetContent = JSON.stringify({
      name: 'test-tag-ruleset',
      target: 'tag',
      enforcement: 'active',
      conditions: {
        ref_name: { include: ['~ALL'], exclude: [] },
        repository_name: { include: ['~ALL'], exclude: [] }
      },
      rules: [{ type: 'deletion' }]
    });

    beforeEach(() => {
      setMockFileContent(testRulesetContent, rulesetPath);
      setMockFileContent(testTagRulesetContent, tagRulesetPath);
    });

    test('should create new ruleset when none exist', async () => {
      // Mock: no existing rulesets
      mockPaginate.mockResolvedValueOnce([]);
      // Mock: successful POST
      mockRequest.mockResolvedValueOnce({ data: { id: 123 } });

      const result = await syncOrgRulesets(mockOctokit, 'my-org', [rulesetPath], false, false);

      expect(result.subResults).toHaveLength(1);
      expect(result.subResults[0].kind).toBe('ruleset-create');
      expect(result.subResults[0].status).toBe('changed');
      // Verify paginate is used for listing (not request)
      expect(mockPaginate).toHaveBeenCalledWith('GET /orgs/{org}/rulesets', { org: 'my-org', per_page: 100 });
      expect(mockRequest).toHaveBeenCalledWith(
        'POST /orgs/{org}/rulesets',
        expect.objectContaining({
          org: 'my-org',
          name: 'test-ruleset'
        })
      );
    });

    test('should detect no changes for identical ruleset', async () => {
      const rulesetConfig = JSON.parse(mockFs.readFileSync(rulesetPath, 'utf8'));

      // Mock: existing ruleset with same name
      mockPaginate.mockResolvedValueOnce([{ id: 123, name: 'test-ruleset' }]);
      // Mock: full ruleset details matching config
      mockRequest.mockResolvedValueOnce({
        data: {
          id: 123,
          ...rulesetConfig
        }
      });

      const result = await syncOrgRulesets(mockOctokit, 'my-org', [rulesetPath], false, false);

      expect(result.subResults).toHaveLength(0);
      // Only GET detail (list is via paginate), no PUT
      expect(mockRequest).toHaveBeenCalledTimes(1);
    });

    test('should detect and apply updates when ruleset differs', async () => {
      // Mock: existing ruleset with same name but different enforcement
      mockPaginate.mockResolvedValueOnce([{ id: 123, name: 'test-ruleset' }]);
      // Mock: full ruleset details with different enforcement
      mockRequest.mockResolvedValueOnce({
        data: {
          id: 123,
          name: 'test-ruleset',
          target: 'branch',
          enforcement: 'disabled',
          conditions: {
            ref_name: { include: ['~DEFAULT_BRANCH'], exclude: [] },
            repository_name: { include: ['~ALL'], exclude: [] }
          },
          rules: [{ type: 'deletion' }]
        }
      });
      // Mock: successful PUT
      mockRequest.mockResolvedValueOnce({ data: {} });

      const result = await syncOrgRulesets(mockOctokit, 'my-org', [rulesetPath], false, false);

      expect(result.subResults).toHaveLength(1);
      expect(result.subResults[0].kind).toBe('ruleset-update');
      expect(result.subResults[0].status).toBe('changed');
      expect(mockRequest).toHaveBeenCalledWith(
        'PUT /orgs/{org}/rulesets/{ruleset_id}',
        expect.objectContaining({
          org: 'my-org',
          ruleset_id: 123
        })
      );
    });

    test('should delete unmanaged rulesets when flag is set', async () => {
      // Mock: existing rulesets include unmanaged one
      mockPaginate.mockResolvedValueOnce([
        { id: 123, name: 'test-ruleset' },
        { id: 456, name: 'old-ruleset' }
      ]);
      // Mock: full details for matching ruleset
      const rulesetConfig = JSON.parse(mockFs.readFileSync(rulesetPath, 'utf8'));
      mockRequest.mockResolvedValueOnce({
        data: { id: 123, ...rulesetConfig }
      });
      // Mock: successful DELETE
      mockRequest.mockResolvedValueOnce({ data: {} });

      const result = await syncOrgRulesets(mockOctokit, 'my-org', [rulesetPath], true, false);

      expect(result.subResults).toHaveLength(1);
      expect(result.subResults[0].kind).toBe('ruleset-delete');
      expect(result.subResults[0].status).toBe('changed');
      expect(mockRequest).toHaveBeenCalledWith('DELETE /orgs/{org}/rulesets/{ruleset_id}', {
        org: 'my-org',
        ruleset_id: 456
      });
    });

    test('should not delete unmanaged rulesets when flag is not set', async () => {
      // Mock: existing rulesets include unmanaged one
      mockPaginate.mockResolvedValueOnce([
        { id: 123, name: 'test-ruleset' },
        { id: 456, name: 'old-ruleset' }
      ]);
      // Mock: full details for matching ruleset
      const rulesetConfig = JSON.parse(mockFs.readFileSync(rulesetPath, 'utf8'));
      mockRequest.mockResolvedValueOnce({
        data: { id: 123, ...rulesetConfig }
      });

      const result = await syncOrgRulesets(mockOctokit, 'my-org', [rulesetPath], false, false);

      expect(result.subResults).toHaveLength(0);
      // Only GET detail (list is via paginate), no DELETE
      expect(mockRequest).toHaveBeenCalledTimes(1);
    });

    test('should handle dry-run mode for new ruleset', async () => {
      mockPaginate.mockResolvedValueOnce([]);

      const result = await syncOrgRulesets(mockOctokit, 'my-org', [rulesetPath], false, true);

      expect(result.subResults).toHaveLength(1);
      expect(result.subResults[0].kind).toBe('ruleset-create');
      expect(result.subResults[0].status).toBe('changed');
      expect(result.subResults[0].message).toContain('Would');
      // No POST in dry-run
      expect(mockRequest).not.toHaveBeenCalled();
    });

    test('should handle 404 on GET as empty rulesets', async () => {
      const error404 = new Error('Not Found');
      error404.status = 404;
      mockPaginate.mockRejectedValueOnce(error404);
      // Mock: successful POST
      mockRequest.mockResolvedValueOnce({ data: { id: 789 } });

      const result = await syncOrgRulesets(mockOctokit, 'my-org', [rulesetPath], false, false);

      expect(result.subResults).toHaveLength(1);
      expect(result.subResults[0].kind).toBe('ruleset-create');
    });

    test('should throw for missing ruleset file', async () => {
      await expect(syncOrgRulesets(mockOctokit, 'my-org', ['/nonexistent/file.json'], false, false)).rejects.toThrow(
        'Failed to read or parse ruleset file'
      );
    });

    test('should throw for ruleset without name', async () => {
      const noNamePath = '/mock/test-ruleset-no-name.json';
      setMockFileContent(JSON.stringify({ target: 'branch' }), noNamePath);

      await expect(syncOrgRulesets(mockOctokit, 'my-org', [noNamePath], false, false)).rejects.toThrow(
        'must include a "name" field'
      );
    });

    test('should handle API error on create gracefully', async () => {
      mockPaginate.mockResolvedValueOnce([]);
      mockRequest.mockRejectedValueOnce(new Error('Forbidden'));

      const result = await syncOrgRulesets(mockOctokit, 'my-org', [rulesetPath], false, false);

      expect(result.subResults).toHaveLength(1);
      expect(result.subResults[0].status).toBe('warning');
      expect(result.subResults[0].message).toContain('Failed');
    });

    test('should support multiple separate ruleset files', async () => {
      // Mock: no existing rulesets
      mockPaginate.mockResolvedValueOnce([]);
      // Mock: successful POST for first ruleset
      mockRequest.mockResolvedValueOnce({ data: { id: 100 } });
      // Mock: successful POST for second ruleset
      mockRequest.mockResolvedValueOnce({ data: { id: 200 } });

      const result = await syncOrgRulesets(mockOctokit, 'my-org', [rulesetPath, tagRulesetPath], false, false);

      expect(result.subResults).toHaveLength(2);
      expect(result.subResults[0].kind).toBe('ruleset-create');
      expect(result.subResults[0].message).toContain('test-ruleset');
      expect(result.subResults[1].kind).toBe('ruleset-create');
      expect(result.subResults[1].message).toContain('test-tag-ruleset');
    });

    test('should delete unmanaged rulesets preserving all managed names from separate files', async () => {
      const rulesetConfig = JSON.parse(mockFs.readFileSync(rulesetPath, 'utf8'));
      const tagRulesetConfig = JSON.parse(mockFs.readFileSync(tagRulesetPath, 'utf8'));

      // Mock: existing rulesets include both managed + one unmanaged
      mockPaginate.mockResolvedValueOnce([
        { id: 100, name: 'test-ruleset' },
        { id: 200, name: 'test-tag-ruleset' },
        { id: 999, name: 'old-ruleset' }
      ]);
      // Mock: full details for test-ruleset (matches)
      mockRequest.mockResolvedValueOnce({
        data: { id: 100, ...rulesetConfig }
      });
      // Mock: full details for test-tag-ruleset (matches)
      mockRequest.mockResolvedValueOnce({
        data: { id: 200, ...tagRulesetConfig }
      });
      // Mock: successful DELETE of unmanaged
      mockRequest.mockResolvedValueOnce({ data: {} });

      const result = await syncOrgRulesets(mockOctokit, 'my-org', [rulesetPath, tagRulesetPath], true, false);

      // Only the delete should be a sub-result (both managed are unchanged)
      expect(result.subResults).toHaveLength(1);
      expect(result.subResults[0].kind).toBe('ruleset-delete');
      expect(result.subResults[0].message).toContain('old-ruleset');
      expect(mockRequest).toHaveBeenCalledWith('DELETE /orgs/{org}/rulesets/{ruleset_id}', {
        org: 'my-org',
        ruleset_id: 999
      });
    });

    test('should handle mixed create and update with multiple files', async () => {
      // Mock: one existing ruleset with different config
      mockPaginate.mockResolvedValueOnce([{ id: 100, name: 'test-ruleset' }]);
      // Mock: full details (different enforcement)
      mockRequest.mockResolvedValueOnce({
        data: {
          id: 100,
          name: 'test-ruleset',
          target: 'branch',
          enforcement: 'disabled',
          rules: [{ type: 'deletion' }]
        }
      });
      // Mock: successful PUT for update
      mockRequest.mockResolvedValueOnce({ data: {} });
      // Mock: successful POST for new tag ruleset
      mockRequest.mockResolvedValueOnce({ data: { id: 200 } });

      const result = await syncOrgRulesets(mockOctokit, 'my-org', [rulesetPath, tagRulesetPath], false, false);

      expect(result.subResults).toHaveLength(2);
      expect(result.subResults[0].kind).toBe('ruleset-update');
      expect(result.subResults[0].message).toContain('test-ruleset');
      expect(result.subResults[1].kind).toBe('ruleset-create');
      expect(result.subResults[1].message).toContain('test-tag-ruleset');
    });
  });

  // ─── parseOrganizations with rulesets ─────────────────────────────────

  describe('parseOrganizations with rulesets', () => {
    test('should include rulesetsFiles when provided', () => {
      const result = parseOrganizations('org1', '', '', ['/path/to/rulesets.json'], false);
      expect(result).toHaveLength(1);
      expect(result[0].rulesetsFiles).toEqual(['/path/to/rulesets.json']);
      expect(result[0].deleteUnmanagedRulesets).toBe(false);
    });

    test('should support multiple rulesetsFiles', () => {
      const result = parseOrganizations('org1', '', '', ['/path/to/branch.json', '/path/to/tag.json'], false);
      expect(result).toHaveLength(1);
      expect(result[0].rulesetsFiles).toEqual(['/path/to/branch.json', '/path/to/tag.json']);
    });

    test('should not include rulesetsFiles when not provided', () => {
      const result = parseOrganizations('org1', '', '', [], false);
      expect(result).toHaveLength(1);
      expect(result[0].rulesetsFiles).toBeUndefined();
    });

    test('should propagate rulesetsFiles to orgs from organizations-file', () => {
      const orgsYaml = `orgs:
  - org: my-org
  - org: my-other-org
    custom-properties:
      - name: team
        value-type: string
        required: false
`;
      setMockFileContent(orgsYaml, '/mock/orgs.yml');
      const result = parseOrganizations('', '/mock/orgs.yml', '', ['/path/to/rulesets.json'], true);

      expect(result).toHaveLength(2);
      expect(result[0].rulesetsFiles).toEqual(['/path/to/rulesets.json']);
      expect(result[0].deleteUnmanagedRulesets).toBe(true);
      expect(result[1].rulesetsFiles).toEqual(['/path/to/rulesets.json']);
      expect(result[1].deleteUnmanagedRulesets).toBe(true);
    });
  });

  // ─── parseMemberPrivileges ───────────────────────────────────────────────

  describe('parseMemberPrivileges', () => {
    test('should parse valid boolean settings', () => {
      const result = parseMemberPrivileges({
        'members-can-fork-private-repositories': false,
        'members-can-create-public-repositories': true
      });

      expect(result).toEqual({
        members_can_fork_private_repositories: false,
        members_can_create_public_repositories: true
      });
    });

    test('should parse valid string settings', () => {
      const result = parseMemberPrivileges({
        'default-repository-permission': 'read',
        'default-repository-branch': 'main'
      });

      expect(result).toEqual({
        default_repository_permission: 'read',
        default_repository_branch: 'main'
      });
    });

    test('should throw for unknown key', () => {
      expect(() => parseMemberPrivileges({ 'invalid-key': true })).toThrow('Unknown member privilege key');
    });

    test('should throw for invalid boolean type', () => {
      expect(() => parseMemberPrivileges({ 'members-can-fork-private-repositories': 'yes' })).toThrow(
        'must be a boolean'
      );
    });

    test('should throw for invalid string type', () => {
      expect(() => parseMemberPrivileges({ 'default-repository-permission': true })).toThrow(
        'must be a non-empty string'
      );
    });

    test('should throw for invalid enum value', () => {
      expect(() => parseMemberPrivileges({ 'default-repository-permission': 'superadmin' })).toThrow(
        'has invalid value'
      );
    });

    test('should throw for non-object config', () => {
      expect(() => parseMemberPrivileges('string-value')).toThrow('expected a key-value map');
      expect(() => parseMemberPrivileges(null)).toThrow('expected a key-value map');
      expect(() => parseMemberPrivileges([1, 2])).toThrow('expected a key-value map');
    });

    test('should include org context in error messages', () => {
      expect(() => parseMemberPrivileges({ 'invalid-key': true }, 'my-org')).toThrow('for org "my-org"');
    });

    test('should parse all supported settings', () => {
      const config = {
        'default-repository-permission': 'read',
        'members-can-create-repositories': true,
        'members-can-create-public-repositories': true,
        'members-can-create-private-repositories': true,
        'members-can-create-internal-repositories': false,
        'members-can-fork-private-repositories': false,
        'web-commit-signoff-required': true,
        'members-can-create-pages': true,
        'members-can-create-public-pages': true,
        'members-can-create-private-pages': true,
        'members-can-invite-outside-collaborators': true,
        'members-can-create-teams': true,
        'members-can-delete-repositories': false,
        'members-can-change-repo-visibility': false,
        'members-can-delete-issues': false,
        'default-repository-branch': 'main',
        'deploy-keys-enabled-for-repositories': true,
        'readers-can-create-discussions': true,
        'members-can-view-dependency-insights': true,
        'display-commenter-full-name-setting-enabled': false
      };

      const result = parseMemberPrivileges(config);
      expect(Object.keys(result)).toHaveLength(20);
      expect(result.default_repository_permission).toBe('read');
      expect(result.members_can_create_repositories).toBe(true);
      expect(result.members_can_fork_private_repositories).toBe(false);
      expect(result.web_commit_signoff_required).toBe(true);
      expect(result.default_repository_branch).toBe('main');
    });

    test('should trim string settings before normalizing', () => {
      const result = parseMemberPrivileges({
        'default-repository-permission': ' read ',
        'default-repository-branch': ' main '
      });

      expect(result).toEqual({
        default_repository_permission: 'read',
        default_repository_branch: 'main'
      });
    });
  });

  // ─── mergeMemberPrivileges ───────────────────────────────────────────────

  describe('mergeMemberPrivileges', () => {
    test('should merge base and override settings', () => {
      const base = {
        default_repository_permission: 'read',
        members_can_fork_private_repositories: false
      };
      const overrides = {
        members_can_fork_private_repositories: true,
        members_can_create_teams: true
      };

      const result = mergeMemberPrivileges(base, overrides);
      expect(result).toEqual({
        default_repository_permission: 'read',
        members_can_fork_private_repositories: true,
        members_can_create_teams: true
      });
    });

    test('should return base when overrides are empty', () => {
      const base = { default_repository_permission: 'read' };
      const result = mergeMemberPrivileges(base, {});
      expect(result).toEqual(base);
    });

    test('should return overrides when base is empty', () => {
      const overrides = { members_can_fork_private_repositories: false };
      const result = mergeMemberPrivileges({}, overrides);
      expect(result).toEqual(overrides);
    });
  });

  // ─── syncMemberPrivileges ────────────────────────────────────────────────

  describe('syncMemberPrivileges', () => {
    test('should detect and apply changes', async () => {
      // Mock: current org settings
      mockRequest.mockResolvedValueOnce({
        data: {
          default_repository_permission: 'write',
          members_can_fork_private_repositories: true
        }
      });
      // Mock: successful PATCH
      mockRequest.mockResolvedValueOnce({ data: {} });

      const desired = {
        default_repository_permission: 'read',
        members_can_fork_private_repositories: false
      };

      const result = await syncMemberPrivileges(mockOctokit, 'my-org', desired, false);

      expect(result.subResults).toHaveLength(1);
      expect(result.subResults[0].kind).toBe('member-privileges-update');
      expect(result.subResults[0].status).toBe('changed');
      expect(result.subResults[0].message).toContain('2 setting(s)');
      expect(result.failed).toBe(false);

      // Verify PATCH was called with only changed settings
      expect(mockRequest).toHaveBeenCalledWith('PATCH /orgs/{org}', {
        org: 'my-org',
        default_repository_permission: 'read',
        members_can_fork_private_repositories: false
      });
    });

    test('should detect no changes for identical settings', async () => {
      mockRequest.mockResolvedValueOnce({
        data: {
          default_repository_permission: 'read',
          members_can_fork_private_repositories: false
        }
      });

      const desired = {
        default_repository_permission: 'read',
        members_can_fork_private_repositories: false
      };

      const result = await syncMemberPrivileges(mockOctokit, 'my-org', desired, false);

      expect(result.subResults).toHaveLength(0);
      expect(result.failed).toBe(false);
      // Only GET, no PATCH
      expect(mockRequest).toHaveBeenCalledTimes(1);
    });

    test('should handle dry-run mode without making API changes', async () => {
      mockRequest.mockResolvedValueOnce({
        data: {
          default_repository_permission: 'write'
        }
      });

      const desired = { default_repository_permission: 'read' };

      const result = await syncMemberPrivileges(mockOctokit, 'my-org', desired, true);

      expect(result.subResults).toHaveLength(1);
      expect(result.subResults[0].status).toBe('changed');
      expect(result.subResults[0].message).toContain('Would');
      // Only GET, no PATCH in dry-run
      expect(mockRequest).toHaveBeenCalledTimes(1);
    });

    test('should handle GET API error gracefully', async () => {
      mockRequest.mockRejectedValueOnce(new Error('Forbidden'));

      const desired = { default_repository_permission: 'read' };

      const result = await syncMemberPrivileges(mockOctokit, 'my-org', desired, false);

      expect(result.subResults).toHaveLength(1);
      expect(result.subResults[0].status).toBe('warning');
      expect(result.subResults[0].message).toContain('Failed to fetch');
      expect(result.failed).toBe(true);
    });

    test('should handle PATCH API error gracefully', async () => {
      mockRequest.mockResolvedValueOnce({
        data: { default_repository_permission: 'write' }
      });
      mockRequest.mockRejectedValueOnce(new Error('Validation Failed'));

      const desired = { default_repository_permission: 'read' };

      const result = await syncMemberPrivileges(mockOctokit, 'my-org', desired, false);

      expect(result.subResults).toHaveLength(1);
      expect(result.subResults[0].status).toBe('warning');
      expect(result.subResults[0].message).toContain('Failed to update');
      expect(result.failed).toBe(true);
    });

    test('should only PATCH settings that differ', async () => {
      mockRequest.mockResolvedValueOnce({
        data: {
          default_repository_permission: 'read',
          members_can_fork_private_repositories: true,
          members_can_create_pages: true
        }
      });
      mockRequest.mockResolvedValueOnce({ data: {} });

      const desired = {
        default_repository_permission: 'read',
        members_can_fork_private_repositories: false,
        members_can_create_pages: true
      };

      const result = await syncMemberPrivileges(mockOctokit, 'my-org', desired, false);

      expect(result.subResults).toHaveLength(1);
      expect(result.subResults[0].message).toContain('1 setting(s)');

      // PATCH should only include the changed setting
      expect(mockRequest).toHaveBeenCalledWith('PATCH /orgs/{org}', {
        org: 'my-org',
        members_can_fork_private_repositories: false
      });
    });
  });

  // ─── validateOrgConfig with member-privileges ────────────────────────────

  describe('validateOrgConfig with member-privileges', () => {
    test('should not warn for valid member privilege keys', () => {
      validateOrgConfig(
        {
          org: 'my-org',
          'member-privileges': {
            'default-repository-permission': 'read',
            'members-can-fork-private-repositories': false
          }
        },
        'my-org'
      );
      expect(mockCore.warning).not.toHaveBeenCalled();
    });

    test('should leave unknown member privilege keys to parser validation', () => {
      validateOrgConfig(
        {
          org: 'my-org',
          'member-privileges': {
            'invalid-privilege-key': true
          }
        },
        'my-org'
      );
      expect(mockCore.warning).not.toHaveBeenCalled();
    });
  });

  // ─── parseOrganizations with member privileges ───────────────────────────

  describe('parseOrganizations with member privileges', () => {
    test('should include memberPrivileges from base inputs', () => {
      const inputPrivileges = {
        default_repository_permission: 'read',
        members_can_fork_private_repositories: false
      };

      const result = parseOrganizations('org1', '', '', [], false, '', inputPrivileges);

      expect(result).toHaveLength(1);
      expect(result[0].memberPrivileges).toEqual({
        default_repository_permission: 'read',
        members_can_fork_private_repositories: false
      });
    });

    test('should merge base and per-org member privileges from orgs.yml', () => {
      const inputPrivileges = {
        default_repository_permission: 'read',
        members_can_fork_private_repositories: false
      };

      const orgsYaml = `orgs:
  - org: my-org
  - org: my-other-org
    member-privileges:
      members-can-fork-private-repositories: true
      members-can-create-teams: true
`;
      setMockFileContent(orgsYaml, '/mock/orgs.yml');

      const result = parseOrganizations('', '/mock/orgs.yml', '', [], false, '', inputPrivileges);

      expect(result).toHaveLength(2);
      // my-org inherits base
      expect(result[0].memberPrivileges).toEqual({
        default_repository_permission: 'read',
        members_can_fork_private_repositories: false
      });
      // my-other-org overrides fork and adds teams
      expect(result[1].memberPrivileges).toEqual({
        default_repository_permission: 'read',
        members_can_fork_private_repositories: true,
        members_can_create_teams: true
      });
    });

    test('should support per-org only member privileges without base inputs', () => {
      const orgsYaml = `orgs:
  - org: my-org
    member-privileges:
      default-repository-permission: none
`;
      setMockFileContent(orgsYaml, '/mock/orgs.yml');

      const result = parseOrganizations('', '/mock/orgs.yml', '');

      expect(result).toHaveLength(1);
      expect(result[0].memberPrivileges).toEqual({
        default_repository_permission: 'none'
      });
    });

    test('should not include memberPrivileges when not specified', () => {
      const result = parseOrganizations('org1', '', '');
      expect(result[0].memberPrivileges).toBeUndefined();
    });
  });

  // ─── parseOrganizationsFile with member-privileges ───────────────────────

  describe('parseOrganizationsFile with member-privileges', () => {
    test('should parse inline member-privileges', () => {
      const orgsYaml = `orgs:
  - org: my-org
    member-privileges:
      default-repository-permission: read
      members-can-fork-private-repositories: false
`;
      setMockFileContent(orgsYaml, '/mock/orgs.yml');
      const result = parseOrganizationsFile('/mock/orgs.yml');

      expect(result).toHaveLength(1);
      expect(result[0].memberPrivileges).toEqual({
        default_repository_permission: 'read',
        members_can_fork_private_repositories: false
      });
    });

    test('should not include memberPrivileges when not specified', () => {
      const orgsYaml = `orgs:
  - org: my-org
`;
      setMockFileContent(orgsYaml, '/mock/orgs.yml');
      const result = parseOrganizationsFile('/mock/orgs.yml');

      expect(result).toHaveLength(1);
      expect(result[0].memberPrivileges).toBeUndefined();
    });

    test('should throw for invalid member-privileges type', () => {
      const orgsYaml = `orgs:
  - org: my-org
    member-privileges:
      - invalid
`;
      setMockFileContent(orgsYaml, '/mock/orgs.yml');

      expect(() => parseOrganizationsFile('/mock/orgs.yml')).toThrow(
        'Invalid member-privileges for org "my-org": expected a key-value map'
      );
    });
  });

  // ─── MEMBER_PRIVILEGE_SETTINGS ───────────────────────────────────────────

  describe('MEMBER_PRIVILEGE_SETTINGS', () => {
    test('should have 20 settings defined', () => {
      expect(MEMBER_PRIVILEGE_SETTINGS.size).toBe(20);
    });

    test('should have unique API keys', () => {
      const apiKeys = new Set();
      for (const [, setting] of MEMBER_PRIVILEGE_SETTINGS) {
        expect(apiKeys.has(setting.apiKey)).toBe(false);
        apiKeys.add(setting.apiKey);
      }
    });
  });

  // ─── getMemberPrivilegesFromInputs ─────────────────────────────────────

  describe('getMemberPrivilegesFromInputs', () => {
    test('should return null when no member privilege inputs are set', () => {
      mockCore.getInput.mockReturnValue('');
      const result = getMemberPrivilegesFromInputs();
      expect(result).toBeNull();
    });

    test('should parse boolean inputs', () => {
      mockCore.getInput.mockImplementation(name => {
        if (name === 'members-can-fork-private-repositories') return 'false';
        if (name === 'members-can-create-teams') return 'true';
        return '';
      });
      const result = getMemberPrivilegesFromInputs();
      expect(result).toEqual({
        members_can_fork_private_repositories: false,
        members_can_create_teams: true
      });
    });

    test('should parse string inputs', () => {
      mockCore.getInput.mockImplementation(name => {
        if (name === 'default-repository-permission') return 'read';
        if (name === 'default-repository-branch') return 'main';
        return '';
      });
      const result = getMemberPrivilegesFromInputs();
      expect(result).toEqual({
        default_repository_permission: 'read',
        default_repository_branch: 'main'
      });
    });

    test('should throw on invalid boolean value', () => {
      mockCore.getInput.mockImplementation(name => {
        if (name === 'members-can-fork-private-repositories') return 'yes';
        return '';
      });
      expect(() => getMemberPrivilegesFromInputs()).toThrow(/must be a boolean/);
    });

    test('should throw on invalid enum value', () => {
      mockCore.getInput.mockImplementation(name => {
        if (name === 'default-repository-permission') return 'superadmin';
        return '';
      });
      expect(() => getMemberPrivilegesFromInputs()).toThrow(/invalid value/);
    });
  });

  // ─── parseOrganizations with member privilege inputs ────────────────────

  describe('parseOrganizations with member privilege inputs', () => {
    test('should use member privileges from inputs', () => {
      const inputPrivileges = {
        default_repository_permission: 'read',
        members_can_fork_private_repositories: false
      };

      const result = parseOrganizations('org1', '', '', [], false, '', inputPrivileges);

      expect(result).toHaveLength(1);
      expect(result[0].memberPrivileges).toEqual({
        default_repository_permission: 'read',
        members_can_fork_private_repositories: false
      });
    });

    test('should layer per-org overrides on top of inputs', () => {
      const inputPrivileges = {
        default_repository_permission: 'read',
        members_can_fork_private_repositories: false
      };

      const orgsYaml = `orgs:
  - org: my-org
  - org: my-other-org
    member-privileges:
      members-can-fork-private-repositories: true
`;
      setMockFileContent(orgsYaml, '/mock/orgs.yml');

      const result = parseOrganizations('', '/mock/orgs.yml', '', [], false, '', inputPrivileges);

      expect(result).toHaveLength(2);
      expect(result[0].memberPrivileges).toEqual({
        default_repository_permission: 'read',
        members_can_fork_private_repositories: false
      });
      expect(result[1].memberPrivileges).toEqual({
        default_repository_permission: 'read',
        members_can_fork_private_repositories: true // per-org override
      });
    });
  });

  // ─── Custom Organization Roles ──────────────────────────────────────

  describe('normalizeCustomOrgRoles', () => {
    test('should normalize valid custom org roles', () => {
      const roles = [
        {
          name: 'Security Auditor',
          description: 'Can view security alerts',
          permissions: ['read_audit_log', 'manage_organization_security']
        }
      ];

      const result = normalizeCustomOrgRoles(roles);

      expect(result).toEqual([
        {
          name: 'Security Auditor',
          description: 'Can view security alerts',
          permissions: ['read_audit_log', 'manage_organization_security']
        }
      ]);
    });

    test('should throw if role has no name', () => {
      expect(() => normalizeCustomOrgRoles([{ permissions: ['read_audit_log'] }])).toThrow(
        'Each custom organization role must have a "name" field'
      );
    });

    test('should throw if role has no permissions', () => {
      expect(() => normalizeCustomOrgRoles([{ name: 'Test' }])).toThrow('must have a non-empty "permissions" array');
    });

    test('should throw if role has empty permissions', () => {
      expect(() => normalizeCustomOrgRoles([{ name: 'Test', permissions: [] }])).toThrow(
        'must have a non-empty "permissions" array'
      );
    });

    test('should set description to null when not provided', () => {
      const result = normalizeCustomOrgRoles([{ name: 'Test', permissions: ['read_audit_log'] }]);
      expect(result[0].description).toBeNull();
    });
  });

  describe('normalizeCustomRepoRoles', () => {
    test('should normalize valid custom repo roles', () => {
      const roles = [
        {
          name: 'Contractor',
          description: 'Limited write access',
          'base-role': 'write',
          permissions: ['delete_alerts_code_scanning']
        }
      ];

      const result = normalizeCustomRepoRoles(roles);

      expect(result).toEqual([
        {
          name: 'Contractor',
          description: 'Limited write access',
          base_role: 'write',
          permissions: ['delete_alerts_code_scanning']
        }
      ]);
    });

    test('should allow admin base-role', () => {
      const result = normalizeCustomRepoRoles([{ name: 'Admin Plus', 'base-role': 'admin', permissions: ['x'] }]);

      expect(result[0].base_role).toBe('admin');
    });

    test('should throw if role has no base-role', () => {
      expect(() => normalizeCustomRepoRoles([{ name: 'Test', permissions: ['x'] }])).toThrow(
        'must have a "base-role" field'
      );
    });

    test('should throw for invalid base-role', () => {
      expect(() => normalizeCustomRepoRoles([{ name: 'Test', 'base-role': 'superadmin', permissions: ['x'] }])).toThrow(
        'invalid base-role "superadmin"'
      );
    });

    test('should throw if role has no permissions', () => {
      expect(() => normalizeCustomRepoRoles([{ name: 'Test', 'base-role': 'write' }])).toThrow(
        'must have a non-empty "permissions" array'
      );
    });
  });

  describe('compareCustomOrgRole', () => {
    test('should detect no changes', () => {
      const existing = { name: 'Role', description: 'Desc', permissions: ['a', 'b'] };
      const desired = { name: 'Role', description: 'Desc', permissions: ['a', 'b'] };
      const { changed } = compareCustomOrgRole(existing, desired);
      expect(changed).toBe(false);
    });

    test('should detect description change', () => {
      const existing = { name: 'Role', description: 'Old', permissions: ['a'] };
      const desired = { name: 'Role', description: 'New', permissions: ['a'] };
      const { changed, changes } = compareCustomOrgRole(existing, desired);
      expect(changed).toBe(true);
      expect(changes).toContain('description updated');
    });

    test('should detect permissions change regardless of order', () => {
      const existing = { name: 'Role', description: null, permissions: ['a', 'b'] };
      const desired = { name: 'Role', description: null, permissions: ['a', 'c'] };
      const { changed, changes } = compareCustomOrgRole(existing, desired);
      expect(changed).toBe(true);
      expect(changes).toContain('permissions updated');
    });

    test('should not detect change when permissions are same but different order', () => {
      const existing = { name: 'Role', description: null, permissions: ['b', 'a'] };
      const desired = { name: 'Role', description: null, permissions: ['a', 'b'] };
      const { changed } = compareCustomOrgRole(existing, desired);
      expect(changed).toBe(false);
    });
  });

  describe('compareCustomRepoRole', () => {
    test('should detect no changes', () => {
      const existing = { name: 'Role', description: 'Desc', base_role: 'write', permissions: ['a'] };
      const desired = { name: 'Role', description: 'Desc', base_role: 'write', permissions: ['a'] };
      const { changed } = compareCustomRepoRole(existing, desired);
      expect(changed).toBe(false);
    });

    test('should detect base_role change', () => {
      const existing = { name: 'Role', description: null, base_role: 'read', permissions: ['a'] };
      const desired = { name: 'Role', description: null, base_role: 'write', permissions: ['a'] };
      const { changed, changes } = compareCustomRepoRole(existing, desired);
      expect(changed).toBe(true);
      expect(changes).toContain('base_role: read → write');
    });
  });

  describe('syncCustomOrgRoles', () => {
    test('should create a new org role', async () => {
      mockPaginate.mockResolvedValueOnce([]);
      mockRequest.mockResolvedValueOnce({ data: {} });

      const desiredRoles = [{ name: 'Auditor', description: 'Audit role', permissions: ['read_audit_log'] }];

      const result = await syncCustomOrgRoles(mockOctokit, 'test-org', desiredRoles, false, false);

      expect(result.subResults).toHaveLength(1);
      expect(result.subResults[0].kind).toBe('custom-org-role-create');
      expect(mockPaginate).toHaveBeenCalledWith(
        'GET /orgs/{org}/organization-roles',
        { org: 'test-org', per_page: 100 },
        expect.any(Function)
      );
      expect(mockRequest).toHaveBeenCalledWith('POST /orgs/{org}/organization-roles', {
        org: 'test-org',
        name: 'Auditor',
        description: 'Audit role',
        permissions: ['read_audit_log']
      });
    });

    test('should update an existing org role when changed', async () => {
      mockPaginate.mockResolvedValueOnce([
        { id: 1, name: 'Auditor', description: 'Old', permissions: ['read_audit_log'], source: 'Organization' }
      ]);
      mockRequest.mockResolvedValueOnce({ data: {} });

      const desiredRoles = [{ name: 'Auditor', description: 'New', permissions: ['read_audit_log'] }];

      const result = await syncCustomOrgRoles(mockOctokit, 'test-org', desiredRoles, false, false);

      expect(result.subResults).toHaveLength(1);
      expect(result.subResults[0].kind).toBe('custom-org-role-update');
      expect(mockRequest).toHaveBeenCalledWith('PATCH /orgs/{org}/organization-roles/{role_id}', {
        org: 'test-org',
        role_id: 1,
        name: 'Auditor',
        description: 'New',
        permissions: ['read_audit_log']
      });
    });

    test('should delete unmanaged org roles when enabled', async () => {
      mockPaginate.mockResolvedValueOnce([
        { id: 1, name: 'Unmanaged', description: null, permissions: ['x'], source: 'Organization' }
      ]);
      mockRequest.mockResolvedValueOnce({ data: {} });

      const result = await syncCustomOrgRoles(mockOctokit, 'test-org', [], true, false);

      expect(result.subResults).toHaveLength(1);
      expect(result.subResults[0].kind).toBe('custom-org-role-delete');
      expect(mockRequest).toHaveBeenCalledWith('DELETE /orgs/{org}/organization-roles/{role_id}', {
        org: 'test-org',
        role_id: 1
      });
    });

    test('should not delete unmanaged roles when disabled', async () => {
      mockPaginate.mockResolvedValueOnce([
        { id: 1, name: 'Unmanaged', description: null, permissions: ['x'], source: 'Organization' }
      ]);

      const result = await syncCustomOrgRoles(mockOctokit, 'test-org', [], false, false);

      expect(result.subResults).toHaveLength(0);
    });

    test('should preview changes in dry-run mode', async () => {
      mockPaginate.mockResolvedValueOnce([]);

      const desiredRoles = [{ name: 'Auditor', description: null, permissions: ['read_audit_log'] }];

      const result = await syncCustomOrgRoles(mockOctokit, 'test-org', desiredRoles, false, true);

      expect(result.subResults).toHaveLength(1);
      expect(result.subResults[0].message).toContain('Would');
      expect(mockPaginate).toHaveBeenCalledTimes(1);
    });

    test('should not modify or delete predefined/enterprise org roles', async () => {
      mockPaginate.mockResolvedValueOnce([
        {
          id: 1,
          name: 'Predefined Role',
          description: 'Built-in',
          permissions: ['read_audit_log'],
          source: 'Predefined'
        },
        {
          id: 2,
          name: 'Enterprise Role',
          description: 'Enterprise',
          permissions: ['read_audit_log'],
          source: 'Enterprise'
        },
        { id: 3, name: 'Custom Role', description: 'Custom', permissions: ['read_audit_log'], source: 'Organization' }
      ]);
      mockRequest.mockResolvedValueOnce({ data: {} });

      // deleteUnmanaged=true; only the Organization-sourced role should be deleted
      const result = await syncCustomOrgRoles(mockOctokit, 'test-org', [], true, false);

      expect(result.subResults).toHaveLength(1);
      expect(result.subResults[0].kind).toBe('custom-org-role-delete');
      expect(mockRequest).toHaveBeenCalledWith('DELETE /orgs/{org}/organization-roles/{role_id}', {
        org: 'test-org',
        role_id: 3
      });
    });
  });

  // ─── Organization Profile ──────────────────────────────────────────────

  describe('ORG_PROFILE_SETTINGS', () => {
    test('should have 7 settings defined', () => {
      expect(ORG_PROFILE_SETTINGS.size).toBe(7);
    });

    test('should have unique API keys', () => {
      const apiKeys = new Set();
      for (const [, setting] of ORG_PROFILE_SETTINGS) {
        expect(apiKeys.has(setting.apiKey)).toBe(false);
        apiKeys.add(setting.apiKey);
      }
    });
  });

  describe('parseOrgProfile', () => {
    test('should parse valid string settings', () => {
      const result = parseOrgProfile({
        'org-name': 'My Org',
        'org-description': 'A test org',
        'org-blog': 'https://example.com'
      });
      expect(result).toEqual({
        name: 'My Org',
        description: 'A test org',
        blog: 'https://example.com'
      });
    });

    test('should trim string settings and allow empty strings', () => {
      const result = parseOrgProfile({
        'org-name': '  My Org  ',
        'org-description': '   '
      });

      expect(result).toEqual({
        name: 'My Org',
        description: ''
      });
    });

    test('should throw for unknown key', () => {
      expect(() => parseOrgProfile({ 'org-name': 'test', 'unknown-key': 'val' })).toThrow(
        /Unknown org profile key "unknown-key"/
      );
    });

    test('should throw for non-string value', () => {
      expect(() => parseOrgProfile({ 'org-name': 123 })).toThrow(/must be a string/);
    });

    test('should throw for non-object config', () => {
      expect(() => parseOrgProfile('not-an-object')).toThrow(/expected a key-value map/);
    });

    test('should include org context in error messages', () => {
      expect(() => parseOrgProfile({ 'bad-key': 'val' }, 'my-org')).toThrow(/for org "my-org"/);
    });
  });

  describe('getOrgProfileFromInputs', () => {
    test('should return null when no org profile inputs are set', () => {
      mockCore.getInput.mockReturnValue('');
      const result = getOrgProfileFromInputs();
      expect(result).toBeNull();
    });

    test('should parse string inputs', () => {
      mockCore.getInput.mockImplementation(name => {
        if (name === 'org-name') return '  My Org  ';
        if (name === 'org-email') return 'org@example.com';
        if (name === 'org-blog') return '   ';
        return '';
      });
      const result = getOrgProfileFromInputs();
      expect(result).toEqual({
        name: 'My Org',
        email: 'org@example.com'
      });
    });
  });

  describe('mergeOrgProfile', () => {
    test('should merge base and override settings', () => {
      const result = mergeOrgProfile({ name: 'Base', blog: 'https://base.com' }, { name: 'Override' });
      expect(result).toEqual({ name: 'Override', blog: 'https://base.com' });
    });

    test('should return base when overrides are empty', () => {
      const result = mergeOrgProfile({ name: 'Base' }, {});
      expect(result).toEqual({ name: 'Base' });
    });
  });

  describe('syncOrgProfile', () => {
    test('should detect and apply changes', async () => {
      mockRequest.mockResolvedValueOnce({
        data: { name: 'Old Name', description: 'Old desc', blog: '' }
      });
      mockRequest.mockResolvedValueOnce({ data: {} });

      const result = await syncOrgProfile(
        mockOctokit,
        'test-org',
        { name: 'New Name', description: 'New desc' },
        false
      );

      expect(result.failed).toBe(false);
      expect(result.subResults).toHaveLength(1);
      expect(result.subResults[0].status).toBe('changed');
      expect(mockRequest).toHaveBeenCalledWith('PATCH /orgs/{org}', {
        org: 'test-org',
        name: 'New Name',
        description: 'New desc'
      });
    });

    test('should detect no changes for identical settings', async () => {
      mockRequest.mockResolvedValueOnce({
        data: { name: 'Same', description: 'Same desc' }
      });

      const result = await syncOrgProfile(mockOctokit, 'test-org', { name: 'Same', description: 'Same desc' }, false);

      expect(result.failed).toBe(false);
      expect(result.subResults).toHaveLength(0);
      expect(mockRequest).toHaveBeenCalledTimes(1); // only GET
    });

    test('should handle dry-run mode without making API changes', async () => {
      mockRequest.mockResolvedValueOnce({
        data: { name: 'Old Name' }
      });

      const result = await syncOrgProfile(mockOctokit, 'test-org', { name: 'New Name' }, true);

      expect(result.failed).toBe(false);
      expect(result.subResults).toHaveLength(1);
      expect(result.subResults[0].status).toBe('changed');
      expect(mockRequest).toHaveBeenCalledTimes(1); // only GET, no PATCH
    });

    test('should handle GET API error gracefully', async () => {
      mockRequest.mockRejectedValueOnce(new Error('Not found'));

      const result = await syncOrgProfile(mockOctokit, 'test-org', { name: 'New' }, false);

      expect(result.failed).toBe(true);
      expect(result.subResults[0].status).toBe('warning');
    });

    test('should handle PATCH API error gracefully', async () => {
      mockRequest.mockResolvedValueOnce({ data: { name: 'Old' } });
      mockRequest.mockRejectedValueOnce(new Error('Forbidden'));

      const result = await syncOrgProfile(mockOctokit, 'test-org', { name: 'New' }, false);

      expect(result.failed).toBe(true);
      expect(result.subResults[0].status).toBe('warning');
    });

    test('should reuse shared organization settings cache', async () => {
      mockRequest.mockResolvedValueOnce({
        data: {
          default_repository_permission: 'write',
          name: 'Old Name'
        }
      });

      const orgSettingsCache = new Map();

      const memberResult = await syncMemberPrivileges(
        mockOctokit,
        'test-org',
        { default_repository_permission: 'read' },
        true,
        orgSettingsCache
      );
      const profileResult = await syncOrgProfile(mockOctokit, 'test-org', { name: 'New Name' }, true, orgSettingsCache);

      expect(memberResult.failed).toBe(false);
      expect(profileResult.failed).toBe(false);
      expect(mockRequest).toHaveBeenCalledTimes(1);
      expect(mockRequest).toHaveBeenCalledWith('GET /orgs/{org}', { org: 'test-org' });
    });
  });

  describe('parseOrganizations with org profile inputs', () => {
    test('should use org profile from inputs', () => {
      const inputProfile = { name: 'My Org', blog: 'https://example.com' };

      const result = parseOrganizations('org1', '', '', [], false, '', null, null, null, inputProfile);

      expect(result).toHaveLength(1);
      expect(result[0].orgProfile).toEqual({
        name: 'My Org',
        blog: 'https://example.com'
      });
    });

    test('should layer per-org overrides on top of inputs', () => {
      const inputProfile = { name: 'Base Name', blog: 'https://base.com' };

      const orgsYaml = `orgs:
  - org: my-org
  - org: my-other-org
    org-profile:
      org-name: Override Name
`;
      setMockFileContent(orgsYaml, '/mock/orgs.yml');

      const result = parseOrganizations('', '/mock/orgs.yml', '', [], false, '', null, null, null, inputProfile);

      expect(result).toHaveLength(2);
      expect(result[0].orgProfile).toEqual({
        name: 'Base Name',
        blog: 'https://base.com'
      });
      expect(result[1].orgProfile).toEqual({
        name: 'Override Name',
        blog: 'https://base.com'
      });
    });

    test('should support top-level org profile aliases in orgs file', () => {
      const orgsYaml = `orgs:
  - org: my-org
    org-name: Top Level Name
    org-blog: ' https://example.com '
`;
      setMockFileContent(orgsYaml, '/mock/orgs.yml');

      const result = parseOrganizations('', '/mock/orgs.yml');

      expect(result).toHaveLength(1);
      expect(result[0].orgProfile).toEqual({
        name: 'Top Level Name',
        blog: 'https://example.com'
      });
    });

    test('should let nested org-profile override top-level aliases', () => {
      const orgsYaml = `orgs:
  - org: my-org
    org-name: Top Level Name
    org-profile:
      org-name: Nested Name
      org-description: Nested description
`;
      setMockFileContent(orgsYaml, '/mock/orgs.yml');

      const result = parseOrganizations('', '/mock/orgs.yml');

      expect(result).toHaveLength(1);
      expect(result[0].orgProfile).toEqual({
        name: 'Nested Name',
        description: 'Nested description'
      });
    });
  });

  describe('validateOrgConfig with org-profile', () => {
    test('should not warn for valid org-profile key', () => {
      validateOrgConfig({ org: 'my-org', 'org-profile': { 'org-name': 'Test' } }, 'my-org');
      expect(mockCore.warning).not.toHaveBeenCalled();
    });
  });

  // ─── parseCodeSecurityConfigurationsFile ──────────────────────────────

  describe('parseCodeSecurityConfigurationsFile', () => {
    test('should parse a valid file', () => {
      const yamlContent = `- name: High risk
  description: High risk config
  advanced_security: enabled
  secret_scanning: enabled
- name: Standard
  description: Standard config
  dependency_graph: enabled
`;
      setMockFileContent(yamlContent, '/mock/code-security-configs.yml');

      const result = parseCodeSecurityConfigurationsFile('/mock/code-security-configs.yml');

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('High risk');
      expect(result[0].advanced_security).toBe('enabled');
      expect(result[1].name).toBe('Standard');
      expect(result[1].dependency_graph).toBe('enabled');
    });

    test('should throw for non-existent file', () => {
      expect(() => parseCodeSecurityConfigurationsFile('/mock/nonexistent.yml')).toThrow(
        'Code security configurations file not found'
      );
    });

    test('should throw for non-array format', () => {
      setMockFileContent('name: not-an-array', '/mock/bad-format.yml');

      expect(() => parseCodeSecurityConfigurationsFile('/mock/bad-format.yml')).toThrow('expected an array');
    });
  });

  // ─── normalizeCodeSecurityConfigurations ──────────────────────────────

  describe('normalizeCodeSecurityConfigurations', () => {
    test('should normalize a valid config', () => {
      const configs = [
        {
          name: 'Test config',
          description: 'A test configuration',
          advanced_security: 'enabled',
          secret_scanning: 'disabled',
          enforcement: 'enforced'
        }
      ];

      const result = normalizeCodeSecurityConfigurations(configs);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: 'Test config',
        description: 'A test configuration',
        advanced_security: 'enabled',
        secret_scanning: 'disabled',
        enforcement: 'enforced'
      });
    });

    test('should throw for missing name', () => {
      expect(() => normalizeCodeSecurityConfigurations([{ description: 'No name' }])).toThrow(
        'must have a "name" field'
      );
    });

    test('should throw for missing description', () => {
      expect(() => normalizeCodeSecurityConfigurations([{ name: 'Test' }])).toThrow('must have a "description" field');
    });

    test('should handle hyphenated YAML keys', () => {
      const configs = [
        {
          name: 'Hyphenated test',
          description: 'Test with hyphenated keys',
          'advanced-security': 'enabled',
          'secret-scanning': 'disabled',
          'secret-scanning-push-protection': 'enabled',
          'code-scanning-default-setup-options': { runner_type: 'default', runner_label: '' }
        }
      ];

      const result = normalizeCodeSecurityConfigurations(configs);

      expect(result[0].advanced_security).toBe('enabled');
      expect(result[0].secret_scanning).toBe('disabled');
      expect(result[0].secret_scanning_push_protection).toBe('enabled');
      expect(result[0].code_scanning_default_setup_options).toEqual({
        runner_type: 'default',
        runner_label: ''
      });
    });

    test('should throw for invalid enablement value', () => {
      expect(() =>
        normalizeCodeSecurityConfigurations([
          {
            name: 'Invalid config',
            description: 'Invalid enablement',
            advanced_security: 'enabeld'
          }
        ])
      ).toThrow('Valid values: enabled, disabled, not_set');
    });

    test('should throw for invalid enforcement value', () => {
      expect(() =>
        normalizeCodeSecurityConfigurations([
          {
            name: 'Invalid config',
            description: 'Invalid enforcement',
            enforcement: 'enabled'
          }
        ])
      ).toThrow('Valid values: enforced, unenforced');
    });

    test('should throw for non-object option fields', () => {
      expect(() =>
        normalizeCodeSecurityConfigurations([
          {
            name: 'Invalid config',
            description: 'Invalid options',
            'code-scanning-default-setup-options': ['runner']
          }
        ])
      ).toThrow('must be a key-value map');
    });

    test('should throw for duplicate names', () => {
      expect(() =>
        normalizeCodeSecurityConfigurations([
          { name: 'Duplicate', description: 'First' },
          { name: 'Duplicate', description: 'Second' }
        ])
      ).toThrow('Duplicate code security configuration name "Duplicate"');
    });

    test('should normalize attachment and default fields', () => {
      const result = normalizeCodeSecurityConfigurations([
        {
          name: 'Attachment test',
          description: 'Config with assignment',
          'attach-scope': 'selected',
          'selected-repository-ids': ['123', 456],
          'selected-repositories': ['my-org/repo-a', 'repo-b'],
          'selected-repositories-by-property': [{ property: 'team', value: 'platform' }],
          'default-for-new-repos': 'private_and_internal'
        }
      ]);

      expect(result[0]).toEqual({
        name: 'Attachment test',
        description: 'Config with assignment',
        attach_scope: 'selected',
        selected_repository_ids: [123, 456],
        selected_repositories: ['my-org/repo-a', 'repo-b'],
        selected_repositories_by_property: [{ property: 'team', value: 'platform' }],
        default_for_new_repos: 'private_and_internal'
      });
    });

    test('should normalize selected-repositories-by-property alone', () => {
      const result = normalizeCodeSecurityConfigurations([
        {
          name: 'Property filter test',
          description: 'Config with property filter',
          'attach-scope': 'selected',
          'selected-repositories-by-property': [
            { property: 'team', value: 'platform' },
            { property: 'criticality', value: 'high' }
          ]
        }
      ]);

      expect(result[0].selected_repositories_by_property).toEqual([
        { property: 'team', value: 'platform' },
        { property: 'criticality', value: 'high' }
      ]);
    });

    test('should throw for invalid selected-repositories-by-property entry', () => {
      expect(() =>
        normalizeCodeSecurityConfigurations([
          {
            name: 'Invalid filter',
            description: 'Bad property filter',
            'attach-scope': 'selected',
            'selected-repositories-by-property': ['not-an-object']
          }
        ])
      ).toThrow('entries must be objects with "property" and "value" keys');
    });

    test('should throw for property filter missing property key', () => {
      expect(() =>
        normalizeCodeSecurityConfigurations([
          {
            name: 'Invalid filter',
            description: 'Missing property key',
            'attach-scope': 'selected',
            'selected-repositories-by-property': [{ value: 'platform' }]
          }
        ])
      ).toThrow('entry is missing "property"');
    });

    test('should allow selected-repositories-by-property to satisfy selected scope requirement', () => {
      expect(() =>
        normalizeCodeSecurityConfigurations([
          {
            name: 'Property only',
            description: 'No explicit IDs',
            'attach-scope': 'selected',
            'selected-repositories-by-property': [{ property: 'team', value: 'platform' }]
          }
        ])
      ).not.toThrow();
    });

    test('should throw when selected attach scope is missing repository ids', () => {
      expect(() =>
        normalizeCodeSecurityConfigurations([
          {
            name: 'Invalid attach',
            description: 'Missing repo ids',
            'attach-scope': 'selected'
          }
        ])
      ).toThrow(
        'must include "selected_repository_ids", "selected_repositories", or "selected_repositories_by_property" when attach_scope is "selected"'
      );
    });

    test('should throw when repository ids are provided for non-selected scope', () => {
      expect(() =>
        normalizeCodeSecurityConfigurations([
          {
            name: 'Invalid attach',
            description: 'Unexpected repo ids',
            'attach-scope': 'all',
            'selected-repository-ids': [123]
          }
        ])
      ).toThrow('can only include selected repository targets when attach_scope is "selected"');
    });
  });

  // ─── compareCodeSecurityConfiguration ─────────────────────────────────

  describe('compareCodeSecurityConfiguration', () => {
    test('should detect no changes', () => {
      const existing = {
        id: 1,
        name: 'Test',
        description: 'Test config',
        advanced_security: 'enabled',
        target_type: 'organization'
      };
      const desired = {
        name: 'Test',
        description: 'Test config',
        advanced_security: 'enabled'
      };

      const result = compareCodeSecurityConfiguration(existing, desired);

      expect(result.changed).toBe(false);
      expect(result.changes).toHaveLength(0);
    });

    test('should detect string field changes', () => {
      const existing = {
        id: 1,
        name: 'Test',
        description: 'Old description',
        advanced_security: 'disabled'
      };
      const desired = {
        name: 'Test',
        description: 'New description',
        advanced_security: 'enabled'
      };

      const result = compareCodeSecurityConfiguration(existing, desired);

      expect(result.changed).toBe(true);
      expect(result.changes).toContain('description: Old description → New description');
      expect(result.changes).toContain('advanced_security: disabled → enabled');
    });

    test('should detect object field changes', () => {
      const existing = {
        id: 1,
        name: 'Test',
        description: 'Test',
        code_scanning_default_setup_options: { runner_type: 'default', runner_label: '' }
      };
      const desired = {
        name: 'Test',
        description: 'Test',
        code_scanning_default_setup_options: { runner_type: 'labeled', runner_label: 'my-runner' }
      };

      const result = compareCodeSecurityConfiguration(existing, desired);

      expect(result.changed).toBe(true);
      expect(result.changes).toContain('code_scanning_default_setup_options updated');
    });

    test('should ignore assignment-only fields when comparing', () => {
      const existing = {
        id: 1,
        name: 'Test',
        description: 'Test',
        secret_scanning: 'enabled'
      };
      const desired = {
        name: 'Test',
        description: 'Test',
        secret_scanning: 'enabled',
        attach_scope: 'all',
        default_for_new_repos: 'private_and_internal'
      };

      const result = compareCodeSecurityConfiguration(existing, desired);

      expect(result.changed).toBe(false);
      expect(result.changes).toHaveLength(0);
    });
  });

  // ─── mergeCodeSecurityConfigurations ──────────────────────────────────

  describe('mergeCodeSecurityConfigurations', () => {
    test('should merge base and org configs', () => {
      const base = [
        { name: 'Config A', description: 'Base A', advanced_security: 'enabled' },
        { name: 'Config B', description: 'Base B', secret_scanning: 'enabled' }
      ];
      const org = [{ name: 'Config C', description: 'Org C', dependabot_alerts: 'enabled' }];

      const result = mergeCodeSecurityConfigurations(base, org);

      expect(result).toHaveLength(3);
      expect(result.map(c => c.name)).toEqual(['Config A', 'Config B', 'Config C']);
    });

    test('should override by name', () => {
      const base = [
        {
          name: 'Config A',
          description: 'Base A',
          advanced_security: 'enabled',
          secret_scanning: 'enabled'
        }
      ];
      const org = [{ name: 'Config A', description: 'Override A', advanced_security: 'disabled' }];

      const result = mergeCodeSecurityConfigurations(base, org);

      expect(result).toHaveLength(1);
      expect(result[0].description).toBe('Override A');
      expect(result[0].advanced_security).toBe('disabled');
      expect(result[0].secret_scanning).toBe('enabled');
    });
  });

  // ─── syncCodeSecurityConfigurations ───────────────────────────────────

  describe('syncCodeSecurityConfigurations', () => {
    const desiredConfigs = [
      {
        name: 'High risk',
        description: 'High risk config',
        advanced_security: 'enabled',
        secret_scanning: 'enabled'
      }
    ];

    test('should create new configuration', async () => {
      mockPaginate.mockResolvedValueOnce([]);
      mockRequest.mockResolvedValueOnce({ data: { id: 1, name: 'High risk' } });

      const result = await syncCodeSecurityConfigurations(mockOctokit, 'my-org', desiredConfigs, false, false);

      expect(result.subResults).toHaveLength(1);
      expect(result.subResults[0].kind).toBe('code-security-config-create');
      expect(result.subResults[0].status).toBe('changed');
      expect(mockRequest).toHaveBeenCalledWith(
        'POST /orgs/{org}/code-security/configurations',
        expect.objectContaining({
          org: 'my-org',
          name: 'High risk'
        })
      );
      expect(mockPaginate).toHaveBeenCalledWith('GET /orgs/{org}/code-security/configurations', {
        org: 'my-org',
        per_page: 100
      });
    });

    test('should update changed configuration', async () => {
      mockPaginate.mockResolvedValueOnce([
        {
          id: 1,
          name: 'High risk',
          description: 'Old description',
          advanced_security: 'disabled',
          secret_scanning: 'enabled',
          target_type: 'organization'
        }
      ]);
      mockRequest.mockResolvedValueOnce({ data: {} });

      const result = await syncCodeSecurityConfigurations(mockOctokit, 'my-org', desiredConfigs, false, false);

      expect(result.subResults).toHaveLength(1);
      expect(result.subResults[0].kind).toBe('code-security-config-update');
      expect(result.subResults[0].status).toBe('changed');
      expect(mockRequest).toHaveBeenCalledWith(
        'PATCH /orgs/{org}/code-security/configurations/{configuration_id}',
        expect.objectContaining({
          org: 'my-org',
          configuration_id: 1
        })
      );
    });

    test('should skip unchanged configuration', async () => {
      mockPaginate.mockResolvedValueOnce([
        {
          id: 1,
          name: 'High risk',
          description: 'High risk config',
          advanced_security: 'enabled',
          secret_scanning: 'enabled',
          target_type: 'organization'
        }
      ]);

      const result = await syncCodeSecurityConfigurations(mockOctokit, 'my-org', desiredConfigs, false, false);

      expect(result.subResults).toHaveLength(0);
      expect(mockRequest).not.toHaveBeenCalled();
    });

    test('should delete unmanaged configuration when enabled', async () => {
      mockPaginate.mockResolvedValueOnce([
        {
          id: 1,
          name: 'High risk',
          description: 'High risk config',
          advanced_security: 'enabled',
          secret_scanning: 'enabled',
          target_type: 'organization'
        },
        {
          id: 2,
          name: 'Old config',
          description: 'Should be deleted',
          target_type: 'organization'
        }
      ]);
      mockRequest.mockResolvedValueOnce({ data: {} });

      const result = await syncCodeSecurityConfigurations(mockOctokit, 'my-org', desiredConfigs, true, false);

      expect(result.subResults).toHaveLength(1);
      expect(result.subResults[0].kind).toBe('code-security-config-delete');
      expect(result.subResults[0].status).toBe('changed');
      expect(mockRequest).toHaveBeenCalledWith('DELETE /orgs/{org}/code-security/configurations/{configuration_id}', {
        org: 'my-org',
        configuration_id: 2
      });
    });

    test('should not delete unmanaged when disabled', async () => {
      mockPaginate.mockResolvedValueOnce([
        {
          id: 1,
          name: 'High risk',
          description: 'High risk config',
          advanced_security: 'enabled',
          secret_scanning: 'enabled',
          target_type: 'organization'
        },
        {
          id: 2,
          name: 'Old config',
          description: 'Should not be deleted',
          target_type: 'organization'
        }
      ]);

      const result = await syncCodeSecurityConfigurations(mockOctokit, 'my-org', desiredConfigs, false, false);

      expect(result.subResults).toHaveLength(0);
      expect(mockRequest).not.toHaveBeenCalled();
    });

    test('should handle API errors gracefully', async () => {
      mockPaginate.mockResolvedValueOnce([]);
      mockRequest.mockRejectedValueOnce(new Error('Forbidden'));

      const result = await syncCodeSecurityConfigurations(mockOctokit, 'my-org', desiredConfigs, false, false);

      expect(result.subResults).toHaveLength(1);
      expect(result.subResults[0].status).toBe('warning');
      expect(result.subResults[0].message).toContain('Failed');
      expect(result.failed).toBe(true);
    });

    test('should handle 404 on list gracefully', async () => {
      const error404 = new Error('Not Found');
      error404.status = 404;
      mockPaginate.mockRejectedValueOnce(error404);
      mockRequest.mockResolvedValueOnce({ data: { id: 1, name: 'High risk' } });

      const result = await syncCodeSecurityConfigurations(mockOctokit, 'my-org', desiredConfigs, false, false);

      expect(result.subResults).toHaveLength(1);
      expect(result.subResults[0].kind).toBe('code-security-config-create');
    });

    test('should skip global configurations when deleting unmanaged', async () => {
      mockPaginate.mockResolvedValueOnce([
        {
          id: 1,
          name: 'High risk',
          description: 'High risk config',
          advanced_security: 'enabled',
          secret_scanning: 'enabled',
          target_type: 'organization'
        },
        {
          id: 99,
          name: 'GitHub recommended',
          description: 'GitHub managed config',
          target_type: 'global'
        }
      ]);

      const result = await syncCodeSecurityConfigurations(mockOctokit, 'my-org', desiredConfigs, true, false);

      // Should not delete the global config
      expect(result.subResults).toHaveLength(0);
      expect(mockRequest).not.toHaveBeenCalled();
    });

    test('should attach selected repositories when configured', async () => {
      const attachConfig = [
        {
          name: 'High risk',
          description: 'High risk config',
          advanced_security: 'enabled',
          attach_scope: 'selected',
          selected_repository_ids: [123, 456]
        }
      ];

      mockPaginate.mockImplementation(route => {
        if (route === 'GET /orgs/{org}/code-security/configurations') {
          return Promise.resolve([
            {
              id: 1,
              name: 'High risk',
              description: 'High risk config',
              advanced_security: 'enabled',
              target_type: 'organization'
            }
          ]);
        }
        if (route === 'GET /orgs/{org}/code-security/configurations/{configuration_id}/repositories') {
          return Promise.resolve([{ status: 'attached', repository: { id: 123 } }]);
        }
        return Promise.resolve([]);
      });
      mockRequest.mockResolvedValue({ data: [] });

      const result = await syncCodeSecurityConfigurations(mockOctokit, 'my-org', attachConfig, false, false);

      expect(result.failed).toBe(false);
      expect(result.subResults.some(r => r.kind === 'code-security-config-attach')).toBe(true);
      expect(mockRequest).toHaveBeenCalledWith(
        'POST /orgs/{org}/code-security/configurations/{configuration_id}/attach',
        expect.objectContaining({
          org: 'my-org',
          configuration_id: 1,
          scope: 'selected',
          selected_repository_ids: [123, 456]
        })
      );
    });

    test('should skip selected attachment when repository list already matches', async () => {
      const attachConfig = [
        {
          name: 'High risk',
          description: 'High risk config',
          attach_scope: 'selected',
          selected_repository_ids: [456, 123]
        }
      ];

      mockPaginate.mockImplementation(route => {
        if (route === 'GET /orgs/{org}/code-security/configurations') {
          return Promise.resolve([
            { id: 1, name: 'High risk', description: 'High risk config', target_type: 'organization' }
          ]);
        }
        if (route === 'GET /orgs/{org}/code-security/configurations/{configuration_id}/repositories') {
          return Promise.resolve([
            { status: 'attached', repository: { id: 123 } },
            { status: 'enforced', repository: { id: 456 } }
          ]);
        }
        return Promise.resolve([]);
      });

      const result = await syncCodeSecurityConfigurations(mockOctokit, 'my-org', attachConfig, false, false);

      expect(result.failed).toBe(false);
      expect(result.subResults.some(r => r.kind === 'code-security-config-attach')).toBe(false);
      expect(mockRequest).not.toHaveBeenCalledWith(
        'POST /orgs/{org}/code-security/configurations/{configuration_id}/attach',
        expect.anything()
      );
    });

    test('should resolve selected repositories by name and attach using ids', async () => {
      const attachConfig = [
        {
          name: 'High risk',
          description: 'High risk config',
          attach_scope: 'selected',
          selected_repositories: ['my-org/repo-a', 'repo-b']
        }
      ];

      mockPaginate.mockImplementation(route => {
        if (route === 'GET /orgs/{org}/code-security/configurations') {
          return Promise.resolve([
            { id: 1, name: 'High risk', description: 'High risk config', target_type: 'organization' }
          ]);
        }
        if (route === 'GET /orgs/{org}/repos') {
          return Promise.resolve([
            { id: 123, name: 'repo-a', full_name: 'my-org/repo-a' },
            { id: 456, name: 'repo-b', full_name: 'my-org/repo-b' }
          ]);
        }
        if (route === 'GET /orgs/{org}/code-security/configurations/{configuration_id}/repositories') {
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      });
      mockRequest.mockResolvedValue({ data: [] });

      const result = await syncCodeSecurityConfigurations(mockOctokit, 'my-org', attachConfig, false, false);

      expect(result.failed).toBe(false);
      expect(mockRequest).toHaveBeenCalledWith(
        'POST /orgs/{org}/code-security/configurations/{configuration_id}/attach',
        expect.objectContaining({
          org: 'my-org',
          configuration_id: 1,
          scope: 'selected',
          selected_repository_ids: [123, 456]
        })
      );
    });

    test('should apply selected scope after all scope', async () => {
      const attachConfig = [
        {
          name: 'All scope',
          description: 'All repos',
          attach_scope: 'all'
        },
        {
          name: 'Selected scope',
          description: 'Selected repos',
          attach_scope: 'selected',
          selected_repository_ids: [123]
        }
      ];

      mockPaginate.mockImplementation(route => {
        if (route === 'GET /orgs/{org}/code-security/configurations') {
          return Promise.resolve([
            { id: 1, name: 'All scope', description: 'All repos', target_type: 'organization' },
            { id: 2, name: 'Selected scope', description: 'Selected repos', target_type: 'organization' }
          ]);
        }
        if (route === 'GET /orgs/{org}/code-security/configurations/{configuration_id}/repositories') {
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      });
      mockRequest.mockResolvedValue({ data: [] });

      await syncCodeSecurityConfigurations(mockOctokit, 'my-org', attachConfig, false, false);

      const attachCalls = mockRequest.mock.calls.filter(
        call => call[0] === 'POST /orgs/{org}/code-security/configurations/{configuration_id}/attach'
      );
      expect(attachCalls).toHaveLength(2);
      expect(attachCalls[0][1]).toEqual(expect.objectContaining({ configuration_id: 1, scope: 'all' }));
      expect(attachCalls[1][1]).toEqual(
        expect.objectContaining({ configuration_id: 2, scope: 'selected', selected_repository_ids: [123] })
      );
    });

    test('should resolve selected repositories by custom property and attach using ids', async () => {
      const attachConfig = [
        {
          name: 'High risk',
          description: 'High risk config',
          attach_scope: 'selected',
          selected_repositories_by_property: [{ property: 'team', value: 'platform' }]
        }
      ];

      mockPaginate.mockImplementation(route => {
        if (route === 'GET /orgs/{org}/code-security/configurations') {
          return Promise.resolve([
            { id: 1, name: 'High risk', description: 'High risk config', target_type: 'organization' }
          ]);
        }
        if (route === 'GET /orgs/{org}/properties/values') {
          return Promise.resolve([
            {
              repository_id: 123,
              repository_name: 'platform-api',
              repository_full_name: 'my-org/platform-api',
              properties: [{ property_name: 'team', value: 'platform' }]
            },
            {
              repository_id: 456,
              repository_name: 'data-service',
              repository_full_name: 'my-org/data-service',
              properties: [{ property_name: 'team', value: 'data' }]
            }
          ]);
        }
        if (route === 'GET /orgs/{org}/code-security/configurations/{configuration_id}/repositories') {
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      });
      mockRequest.mockResolvedValue({ data: [] });

      const result = await syncCodeSecurityConfigurations(mockOctokit, 'my-org', attachConfig, false, false);

      expect(result.failed).toBe(false);
      expect(mockRequest).toHaveBeenCalledWith(
        'POST /orgs/{org}/code-security/configurations/{configuration_id}/attach',
        expect.objectContaining({
          org: 'my-org',
          configuration_id: 1,
          scope: 'selected',
          selected_repository_ids: [123]
        })
      );
    });

    test('should merge property-based and explicit repo selections', async () => {
      const attachConfig = [
        {
          name: 'High risk',
          description: 'High risk config',
          attach_scope: 'selected',
          selected_repository_ids: [789],
          selected_repositories_by_property: [{ property: 'criticality', value: 'high' }]
        }
      ];

      mockPaginate.mockImplementation(route => {
        if (route === 'GET /orgs/{org}/code-security/configurations') {
          return Promise.resolve([
            { id: 1, name: 'High risk', description: 'High risk config', target_type: 'organization' }
          ]);
        }
        if (route === 'GET /orgs/{org}/properties/values') {
          return Promise.resolve([
            {
              repository_id: 123,
              repository_name: 'critical-app',
              repository_full_name: 'my-org/critical-app',
              properties: [{ property_name: 'criticality', value: 'high' }]
            }
          ]);
        }
        if (route === 'GET /orgs/{org}/code-security/configurations/{configuration_id}/repositories') {
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      });
      mockRequest.mockResolvedValue({ data: [] });

      await syncCodeSecurityConfigurations(mockOctokit, 'my-org', attachConfig, false, false);

      expect(mockRequest).toHaveBeenCalledWith(
        'POST /orgs/{org}/code-security/configurations/{configuration_id}/attach',
        expect.objectContaining({
          scope: 'selected',
          selected_repository_ids: [123, 789]
        })
      );
    });

    test('should warn but not fail when no repos match property filter', async () => {
      const attachConfig = [
        {
          name: 'High risk',
          description: 'High risk config',
          attach_scope: 'selected',
          selected_repositories_by_property: [{ property: 'team', value: 'nonexistent' }]
        }
      ];

      mockPaginate.mockImplementation(route => {
        if (route === 'GET /orgs/{org}/code-security/configurations') {
          return Promise.resolve([
            { id: 1, name: 'High risk', description: 'High risk config', target_type: 'organization' }
          ]);
        }
        if (route === 'GET /orgs/{org}/properties/values') {
          return Promise.resolve([
            {
              repository_id: 123,
              repository_name: 'some-repo',
              repository_full_name: 'my-org/some-repo',
              properties: [{ property_name: 'team', value: 'platform' }]
            }
          ]);
        }
        if (route === 'GET /orgs/{org}/code-security/configurations/{configuration_id}/repositories') {
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      });
      mockRequest.mockResolvedValue({ data: [] });

      const result = await syncCodeSecurityConfigurations(mockOctokit, 'my-org', attachConfig, false, false);

      expect(result.failed).toBe(false);
      expect(mockCore.warning).toHaveBeenCalledWith(expect.stringContaining('No repositories'));
    });

    test('should set default for new repositories when configured', async () => {
      const defaultConfig = [
        {
          name: 'High risk',
          description: 'High risk config',
          default_for_new_repos: 'private_and_internal'
        }
      ];

      mockPaginate.mockResolvedValueOnce([
        { id: 1, name: 'High risk', description: 'High risk config', target_type: 'organization' }
      ]);
      mockRequest.mockImplementation(route => {
        if (route === 'GET /orgs/{org}/code-security/configurations/defaults') {
          return Promise.resolve({
            data: [{ default_for_new_repos: 'public', configuration: { id: 1 } }]
          });
        }
        if (route === 'PUT /orgs/{org}/code-security/configurations/{configuration_id}/defaults') {
          return Promise.resolve({ data: {} });
        }
        return Promise.resolve({ data: {} });
      });

      const result = await syncCodeSecurityConfigurations(mockOctokit, 'my-org', defaultConfig, false, false);

      expect(result.failed).toBe(false);
      expect(result.subResults.some(r => r.kind === 'code-security-config-default')).toBe(true);
      expect(mockRequest).toHaveBeenCalledWith(
        'PUT /orgs/{org}/code-security/configurations/{configuration_id}/defaults',
        expect.objectContaining({
          org: 'my-org',
          configuration_id: 1,
          default_for_new_repos: 'private_and_internal'
        })
      );
    });

    test('should skip default update when already matching', async () => {
      const defaultConfig = [
        {
          name: 'High risk',
          description: 'High risk config',
          default_for_new_repos: 'private_and_internal'
        }
      ];

      mockPaginate.mockResolvedValueOnce([
        { id: 1, name: 'High risk', description: 'High risk config', target_type: 'organization' }
      ]);
      mockRequest.mockImplementation(route => {
        if (route === 'GET /orgs/{org}/code-security/configurations/defaults') {
          return Promise.resolve({
            data: [{ default_for_new_repos: 'private_and_internal', configuration: { id: 1 } }]
          });
        }
        return Promise.resolve({ data: {} });
      });

      const result = await syncCodeSecurityConfigurations(mockOctokit, 'my-org', defaultConfig, false, false);

      expect(result.failed).toBe(false);
      expect(result.subResults.some(r => r.kind === 'code-security-config-default')).toBe(false);
      expect(mockRequest).not.toHaveBeenCalledWith(
        'PUT /orgs/{org}/code-security/configurations/{configuration_id}/defaults',
        expect.anything()
      );
    });

    test('should throw before API calls when desired configurations contain duplicate names', async () => {
      await expect(
        syncCodeSecurityConfigurations(
          mockOctokit,
          'my-org',
          [
            { name: 'Duplicate', description: 'First' },
            { name: 'Duplicate', description: 'Second' }
          ],
          false,
          false
        )
      ).rejects.toThrow('Duplicate code security configuration name "Duplicate"');

      expect(mockPaginate).not.toHaveBeenCalled();
      expect(mockRequest).not.toHaveBeenCalled();
    });

    test('should throw when multiple configurations define conflicting defaults', async () => {
      await expect(
        syncCodeSecurityConfigurations(
          mockOctokit,
          'my-org',
          [
            { name: 'Config A', description: 'A', default_for_new_repos: 'all' },
            { name: 'Config B', description: 'B', default_for_new_repos: 'public' }
          ],
          false,
          false
        )
      ).rejects.toThrow('conflicts with other');

      expect(mockPaginate).not.toHaveBeenCalled();
      expect(mockRequest).not.toHaveBeenCalled();
    });

    test('should throw when two configs use the same broad attach_scope', async () => {
      await expect(
        syncCodeSecurityConfigurations(
          mockOctokit,
          'my-org',
          [
            { name: 'Config A', description: 'A', attach_scope: 'all' },
            { name: 'Config B', description: 'B', attach_scope: 'all' }
          ],
          false,
          false
        )
      ).rejects.toThrow('Multiple code security configurations use attach_scope "all": "Config A" and "Config B"');

      expect(mockPaginate).not.toHaveBeenCalled();
      expect(mockRequest).not.toHaveBeenCalled();
    });

    test('should throw when two configs use the same public attach_scope', async () => {
      await expect(
        syncCodeSecurityConfigurations(
          mockOctokit,
          'my-org',
          [
            { name: 'Config A', description: 'A', attach_scope: 'public' },
            { name: 'Config B', description: 'B', attach_scope: 'public' }
          ],
          false,
          false
        )
      ).rejects.toThrow('Multiple code security configurations use attach_scope "public"');

      expect(mockPaginate).not.toHaveBeenCalled();
      expect(mockRequest).not.toHaveBeenCalled();
    });

    test('should throw when all is combined with public attach_scope', async () => {
      await expect(
        syncCodeSecurityConfigurations(
          mockOctokit,
          'my-org',
          [
            { name: 'Config A', description: 'A', attach_scope: 'all' },
            { name: 'Config B', description: 'B', attach_scope: 'public' }
          ],
          false,
          false
        )
      ).rejects.toThrow(
        '"Config A" and "Config B" have conflicting attach scopes: "all" cannot be combined with "public"'
      );

      expect(mockPaginate).not.toHaveBeenCalled();
      expect(mockRequest).not.toHaveBeenCalled();
    });

    test('should throw when all is combined with private_or_internal attach_scope', async () => {
      await expect(
        syncCodeSecurityConfigurations(
          mockOctokit,
          'my-org',
          [
            { name: 'Config A', description: 'A', attach_scope: 'all' },
            { name: 'Config B', description: 'B', attach_scope: 'private_or_internal' }
          ],
          false,
          false
        )
      ).rejects.toThrow(
        '"Config A" and "Config B" have conflicting attach scopes: "all" cannot be combined with "private_or_internal"'
      );

      expect(mockPaginate).not.toHaveBeenCalled();
      expect(mockRequest).not.toHaveBeenCalled();
    });

    test('should throw when all is combined with all_without_configurations attach_scope', async () => {
      await expect(
        syncCodeSecurityConfigurations(
          mockOctokit,
          'my-org',
          [
            { name: 'Config A', description: 'A', attach_scope: 'all' },
            { name: 'Config B', description: 'B', attach_scope: 'all_without_configurations' }
          ],
          false,
          false
        )
      ).rejects.toThrow(
        '"Config A" and "Config B" have conflicting attach scopes: "all" cannot be combined with "all_without_configurations"'
      );

      expect(mockPaginate).not.toHaveBeenCalled();
      expect(mockRequest).not.toHaveBeenCalled();
    });

    test('should throw when all_without_configurations is combined with public attach_scope', async () => {
      await expect(
        syncCodeSecurityConfigurations(
          mockOctokit,
          'my-org',
          [
            { name: 'Config A', description: 'A', attach_scope: 'all_without_configurations' },
            { name: 'Config B', description: 'B', attach_scope: 'public' }
          ],
          false,
          false
        )
      ).rejects.toThrow(
        '"Config A" and "Config B" have conflicting attach scopes: "all_without_configurations" cannot be combined with "public"'
      );

      expect(mockPaginate).not.toHaveBeenCalled();
      expect(mockRequest).not.toHaveBeenCalled();
    });

    test('should throw when all_without_configurations is combined with private_or_internal attach_scope', async () => {
      await expect(
        syncCodeSecurityConfigurations(
          mockOctokit,
          'my-org',
          [
            { name: 'Config A', description: 'A', attach_scope: 'all_without_configurations' },
            { name: 'Config B', description: 'B', attach_scope: 'private_or_internal' }
          ],
          false,
          false
        )
      ).rejects.toThrow(
        '"Config A" and "Config B" have conflicting attach scopes: "all_without_configurations" cannot be combined with "private_or_internal"'
      );

      expect(mockPaginate).not.toHaveBeenCalled();
      expect(mockRequest).not.toHaveBeenCalled();
    });

    test('should allow public and private_or_internal scopes together (disjoint repo sets)', async () => {
      const configs = [
        { name: 'Public config', description: 'Public repos', attach_scope: 'public' },
        { name: 'Private config', description: 'Private repos', attach_scope: 'private_or_internal' }
      ];

      mockPaginate.mockImplementation(route => {
        if (route === 'GET /orgs/{org}/code-security/configurations') {
          return Promise.resolve([
            { id: 1, name: 'Public config', description: 'Public repos', target_type: 'organization' },
            { id: 2, name: 'Private config', description: 'Private repos', target_type: 'organization' }
          ]);
        }
        return Promise.resolve([]);
      });
      mockRequest.mockResolvedValue({ data: [] });

      await expect(syncCodeSecurityConfigurations(mockOctokit, 'my-org', configs, false, false)).resolves.not.toThrow();
    });

    test('should allow all and selected attach scopes together (override pattern)', async () => {
      const configs = [
        { name: 'Baseline', description: 'All repos', attach_scope: 'all' },
        { name: 'High risk', description: 'Selected repos', attach_scope: 'selected', selected_repository_ids: [123] }
      ];

      mockPaginate.mockImplementation(route => {
        if (route === 'GET /orgs/{org}/code-security/configurations') {
          return Promise.resolve([
            { id: 1, name: 'Baseline', description: 'All repos', target_type: 'organization' },
            { id: 2, name: 'High risk', description: 'Selected repos', target_type: 'organization' }
          ]);
        }
        if (route === 'GET /orgs/{org}/code-security/configurations/{configuration_id}/repositories') {
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      });
      mockRequest.mockResolvedValue({ data: [] });

      await expect(syncCodeSecurityConfigurations(mockOctokit, 'my-org', configs, false, false)).resolves.not.toThrow();
    });

    test('should allow multiple selected-scope configs with disjoint repo IDs', async () => {
      const configs = [
        {
          name: 'High risk',
          description: 'High risk repos',
          attach_scope: 'selected',
          selected_repository_ids: [123, 456]
        },
        {
          name: 'Critical',
          description: 'Critical repos',
          attach_scope: 'selected',
          selected_repository_ids: [789]
        }
      ];

      mockPaginate.mockImplementation(route => {
        if (route === 'GET /orgs/{org}/code-security/configurations') {
          return Promise.resolve([
            { id: 1, name: 'High risk', description: 'High risk repos', target_type: 'organization' },
            { id: 2, name: 'Critical', description: 'Critical repos', target_type: 'organization' }
          ]);
        }
        if (route === 'GET /orgs/{org}/code-security/configurations/{configuration_id}/repositories') {
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      });
      mockRequest.mockResolvedValue({ data: [] });

      await expect(syncCodeSecurityConfigurations(mockOctokit, 'my-org', configs, false, false)).resolves.not.toThrow();
    });

    test('should throw when multiple selected-scope configs claim the same repo ID', async () => {
      const configs = [
        {
          name: 'High risk',
          description: 'High risk repos',
          attach_scope: 'selected',
          selected_repository_ids: [123, 456]
        },
        {
          name: 'Critical',
          description: 'Critical repos',
          attach_scope: 'selected',
          selected_repository_ids: [456, 789]
        }
      ];

      mockPaginate.mockImplementation(route => {
        if (route === 'GET /orgs/{org}/code-security/configurations') {
          return Promise.resolve([
            { id: 1, name: 'High risk', description: 'High risk repos', target_type: 'organization' },
            { id: 2, name: 'Critical', description: 'Critical repos', target_type: 'organization' }
          ]);
        }
        return Promise.resolve([]);
      });

      await expect(syncCodeSecurityConfigurations(mockOctokit, 'my-org', configs, false, false)).rejects.toThrow(
        'Repository ID 456 is claimed by multiple code security configurations with attach_scope "selected": "High risk" and "Critical"'
      );

      expect(mockRequest).not.toHaveBeenCalled();
    });

    test('should throw when selected-scope configs overlap via name and property resolution', async () => {
      const configs = [
        {
          name: 'By name',
          description: 'Targets by repo name',
          attach_scope: 'selected',
          selected_repositories: ['critical-app']
        },
        {
          name: 'By property',
          description: 'Targets by property filter',
          attach_scope: 'selected',
          selected_repositories_by_property: [{ property: 'criticality', value: 'high' }]
        }
      ];

      mockPaginate.mockImplementation(route => {
        if (route === 'GET /orgs/{org}/code-security/configurations') {
          return Promise.resolve([
            { id: 1, name: 'By name', description: 'Targets by repo name', target_type: 'organization' },
            { id: 2, name: 'By property', description: 'Targets by property filter', target_type: 'organization' }
          ]);
        }
        if (route === 'GET /orgs/{org}/repos') {
          return Promise.resolve([{ id: 123, name: 'critical-app', full_name: 'my-org/critical-app' }]);
        }
        if (route === 'GET /orgs/{org}/properties/values') {
          return Promise.resolve([
            {
              repository_id: 123,
              repository_name: 'critical-app',
              repository_full_name: 'my-org/critical-app',
              properties: [{ property_name: 'criticality', value: 'high' }]
            }
          ]);
        }
        return Promise.resolve([]);
      });

      await expect(syncCodeSecurityConfigurations(mockOctokit, 'my-org', configs, false, false)).rejects.toThrow(
        'Repository ID 123 is claimed by multiple code security configurations with attach_scope "selected": "By name" and "By property"'
      );

      expect(mockRequest).not.toHaveBeenCalled();
    });

    test('should throw on overlapping selected IDs for brand-new configs before any create mutations', async () => {
      const configs = [
        {
          name: 'New Config A',
          description: 'New config A',
          attach_scope: 'selected',
          selected_repository_ids: [123, 456]
        },
        {
          name: 'New Config B',
          description: 'New config B',
          attach_scope: 'selected',
          selected_repository_ids: [456, 789]
        }
      ];

      // Neither config exists yet
      mockPaginate.mockResolvedValue([]);

      await expect(syncCodeSecurityConfigurations(mockOctokit, 'my-org', configs, false, false)).rejects.toThrow(
        'Repository ID 456 is claimed by multiple code security configurations with attach_scope "selected": "New Config A" and "New Config B"'
      );

      // No create/update/delete API calls should have been made
      expect(mockRequest).not.toHaveBeenCalled();
    });
  });

  describe('syncCustomRepoRoles', () => {
    test('should create a new repo role', async () => {
      mockPaginate.mockResolvedValueOnce([]);
      mockRequest.mockResolvedValueOnce({ data: {} });

      const desiredRoles = [
        { name: 'Contractor', description: 'Limited', base_role: 'write', permissions: ['delete_alerts_code_scanning'] }
      ];

      const result = await syncCustomRepoRoles(mockOctokit, 'test-org', desiredRoles, false, false);

      expect(result.subResults).toHaveLength(1);
      expect(result.subResults[0].kind).toBe('custom-repo-role-create');
      expect(mockPaginate).toHaveBeenCalledWith(
        'GET /orgs/{org}/custom-repository-roles',
        { org: 'test-org', per_page: 100 },
        expect.any(Function)
      );
      expect(mockRequest).toHaveBeenCalledWith('POST /orgs/{org}/custom-repository-roles', {
        org: 'test-org',
        name: 'Contractor',
        description: 'Limited',
        base_role: 'write',
        permissions: ['delete_alerts_code_scanning']
      });
    });

    test('should update an existing repo role when changed', async () => {
      mockPaginate.mockResolvedValueOnce([
        { id: 5, name: 'Contractor', description: 'Old', base_role: 'write', permissions: ['x'] }
      ]);
      mockRequest.mockResolvedValueOnce({ data: {} });

      const desiredRoles = [{ name: 'Contractor', description: 'New', base_role: 'write', permissions: ['x'] }];

      const result = await syncCustomRepoRoles(mockOctokit, 'test-org', desiredRoles, false, false);

      expect(result.subResults).toHaveLength(1);
      expect(result.subResults[0].kind).toBe('custom-repo-role-update');
    });

    test('should delete unmanaged repo roles when enabled', async () => {
      mockPaginate.mockResolvedValueOnce([
        { id: 5, name: 'Old Role', description: null, base_role: 'read', permissions: ['x'] }
      ]);
      mockRequest.mockResolvedValueOnce({ data: {} });

      const result = await syncCustomRepoRoles(mockOctokit, 'test-org', [], true, false);

      expect(result.subResults).toHaveLength(1);
      expect(result.subResults[0].kind).toBe('custom-repo-role-delete');
    });
  });

  describe('mergeCustomRoles', () => {
    test('should merge base and per-org roles by name', () => {
      const base = [
        { name: 'Auditor', description: 'Base', permissions: ['a'] },
        { name: 'Manager', description: 'Base', permissions: ['b'] }
      ];
      const org = [{ name: 'Auditor', description: 'Override', permissions: ['c'] }];

      const result = mergeCustomRoles(base, org);

      expect(result).toHaveLength(2);
      expect(result.find(r => r.name === 'Auditor').description).toBe('Override');
      expect(result.find(r => r.name === 'Manager').description).toBe('Base');
    });
  });

  describe('parseCustomOrgRolesFile', () => {
    test('should parse a valid custom org roles file', () => {
      const yamlContent = `- name: Security Auditor
  description: 'Can view security alerts'
  permissions:
    - read_audit_log
`;
      setMockFileContent(yamlContent, '/mock/custom-org-roles.yml');

      const result = parseCustomOrgRolesFile('/mock/custom-org-roles.yml');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Security Auditor');
      expect(result[0].permissions).toEqual(['read_audit_log']);
    });

    test('should throw if file not found', () => {
      expect(() => parseCustomOrgRolesFile('/nonexistent.yml')).toThrow('not found');
    });
  });

  describe('parseCustomRepoRolesFile', () => {
    test('should parse a valid custom repo roles file', () => {
      const yamlContent = `- name: Contractor
  description: 'Limited write'
  base-role: write
  permissions:
    - delete_alerts_code_scanning
`;
      setMockFileContent(yamlContent, '/mock/custom-repo-roles.yml');

      const result = parseCustomRepoRolesFile('/mock/custom-repo-roles.yml');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Contractor');
      expect(result[0].base_role).toBe('write');
    });

    test('should throw if file not found', () => {
      expect(() => parseCustomRepoRolesFile('/nonexistent.yml')).toThrow('not found');
    });
  });

  // ─── parseOrganizations with code security configurations ─────────────

  describe('parseOrganizations with code security configurations', () => {
    test('should parse orgs with code-security-configurations-file', () => {
      const cscYaml = `- name: High risk
  description: High risk config
  advanced_security: enabled
`;
      setMockFileContent(cscYaml, '/mock/code-security-configs.yml');

      const result = parseOrganizations(
        'my-org,my-other-org',
        '',
        '',
        [],
        false,
        '',
        null,
        null,
        null,
        null,
        '/mock/code-security-configs.yml'
      );

      expect(result).toHaveLength(2);
      expect(result[0].codeSecurityConfigurations).toHaveLength(1);
      expect(result[0].codeSecurityConfigurations[0].name).toBe('High risk');
      expect(result[1].codeSecurityConfigurations).toHaveLength(1);
    });

    test('should handle inline code-security-configurations in orgs.yml', () => {
      const orgsYaml = `orgs:
  - org: my-org
  - org: my-other-org
    code-security-configurations:
      - name: Custom config
        description: Inline config
        secret_scanning: enabled
`;
      const cscYaml = `- name: Base config
  description: Base security config
  advanced_security: enabled
`;
      setMockFileContent(orgsYaml, '/mock/orgs.yml');
      setMockFileContent(cscYaml, '/mock/code-security-configs.yml');

      const result = parseOrganizations(
        '',
        '/mock/orgs.yml',
        '',
        [],
        false,
        '',
        null,
        null,
        null,
        null,
        '/mock/code-security-configs.yml'
      );

      expect(result).toHaveLength(2);
      // First org gets only base configs
      expect(result[0].codeSecurityConfigurations).toHaveLength(1);
      expect(result[0].codeSecurityConfigurations[0].name).toBe('Base config');
      // Second org gets base + inline merged
      expect(result[1].codeSecurityConfigurations).toHaveLength(2);
      expect(result[1].codeSecurityConfigurations.map(c => c.name)).toEqual(['Base config', 'Custom config']);
    });

    test('should layer attachment and default fields in per-org overrides', () => {
      const orgsYaml = `orgs:
  - org: my-org
    code-security-configurations:
      - name: Base config
        description: Org override
        attach-scope: selected
        selected-repository-ids: [123]
        selected-repositories: [repo-a]
        default-for-new-repos: private_and_internal
`;
      const cscYaml = `- name: Base config
  description: Base security config
  advanced_security: enabled
`;
      setMockFileContent(orgsYaml, '/mock/orgs.yml');
      setMockFileContent(cscYaml, '/mock/code-security-configs.yml');

      const result = parseOrganizations(
        '',
        '/mock/orgs.yml',
        '',
        [],
        false,
        '',
        null,
        null,
        null,
        null,
        '/mock/code-security-configs.yml'
      );

      expect(result).toHaveLength(1);
      expect(result[0].codeSecurityConfigurations).toEqual([
        {
          name: 'Base config',
          description: 'Org override',
          advanced_security: 'enabled',
          attach_scope: 'selected',
          selected_repository_ids: [123],
          selected_repositories: ['repo-a'],
          default_for_new_repos: 'private_and_internal'
        }
      ]);
    });
  });

  // ─── ACTIONS_POLICY_SETTINGS ──────────────────────────────────────────────

  describe('ACTIONS_POLICY_SETTINGS', () => {
    test('should have 5 settings defined', () => {
      expect(ACTIONS_POLICY_SETTINGS.size).toBe(5);
    });

    test('should have unique API keys', () => {
      const apiKeys = new Set();
      for (const [, setting] of ACTIONS_POLICY_SETTINGS) {
        expect(apiKeys.has(setting.apiKey)).toBe(false);
        apiKeys.add(setting.apiKey);
      }
    });

    test('should have valid endpoint values', () => {
      const validEndpoints = new Set(['permissions', 'workflow', 'selected-actions']);
      for (const [, setting] of ACTIONS_POLICY_SETTINGS) {
        expect(validEndpoints.has(setting.endpoint)).toBe(true);
      }
    });
  });

  // ─── parseActionsPolicy ───────────────────────────────────────────────────

  describe('parseActionsPolicy', () => {
    test('should parse valid actions policy config', () => {
      const config = {
        'allowed-actions': 'selected',
        'default-workflow-permissions': 'read',
        'actions-can-approve-pull-request-reviews': false,
        'github-owned-allowed': true,
        'verified-allowed': true
      };
      const result = parseActionsPolicy(config);
      expect(result).toEqual({
        allowed_actions: 'selected',
        default_workflow_permissions: 'read',
        can_approve_pull_request_reviews: false,
        github_owned_allowed: true,
        verified_allowed: true
      });
    });

    test('should throw for non-object config', () => {
      expect(() => parseActionsPolicy('invalid')).toThrow('expected a key-value map');
    });

    test('should throw for array config', () => {
      expect(() => parseActionsPolicy(['invalid'])).toThrow('expected a key-value map');
    });

    test('should throw for unknown key', () => {
      expect(() => parseActionsPolicy({ 'unknown-key': 'value' })).toThrow('Unknown actions policy key');
    });

    test('should throw for invalid boolean value', () => {
      expect(() => parseActionsPolicy({ 'github-owned-allowed': 'yes' })).toThrow('must be a boolean');
    });

    test('should throw for invalid enum value', () => {
      expect(() => parseActionsPolicy({ 'allowed-actions': 'invalid' })).toThrow('invalid value');
    });

    test('should include context in error messages', () => {
      expect(() => parseActionsPolicy({ 'unknown-key': 'value' }, 'my-org')).toThrow('for org "my-org"');
    });
  });

  // ─── getActionsPolicyFromInputs ──────────────────────────────────────────

  describe('getActionsPolicyFromInputs', () => {
    test('should return null when no actions policy inputs are set', () => {
      mockCore.getInput.mockReturnValue('');
      const result = getActionsPolicyFromInputs();
      expect(result).toBeNull();
    });

    test('should parse boolean inputs', () => {
      mockCore.getInput.mockImplementation(name => {
        if (name === 'actions-policy-github-owned-allowed') return 'true';
        if (name === 'actions-policy-actions-can-approve-pull-request-reviews') return 'false';
        return '';
      });
      const result = getActionsPolicyFromInputs();
      expect(result).toEqual({
        github_owned_allowed: true,
        can_approve_pull_request_reviews: false
      });
    });

    test('should parse string inputs', () => {
      mockCore.getInput.mockImplementation(name => {
        if (name === 'actions-policy-allowed-actions') return 'selected';
        if (name === 'actions-policy-default-workflow-permissions') return 'read';
        return '';
      });
      const result = getActionsPolicyFromInputs();
      expect(result).toEqual({
        allowed_actions: 'selected',
        default_workflow_permissions: 'read'
      });
    });

    test('should throw on invalid boolean value', () => {
      mockCore.getInput.mockImplementation(name => {
        if (name === 'actions-policy-github-owned-allowed') return 'yes';
        return '';
      });
      expect(() => getActionsPolicyFromInputs()).toThrow(/must be a boolean/);
    });

    test('should throw on invalid enum value', () => {
      mockCore.getInput.mockImplementation(name => {
        if (name === 'actions-policy-allowed-actions') return 'everything';
        return '';
      });
      expect(() => getActionsPolicyFromInputs()).toThrow(/invalid value/);
    });
  });

  // ─── mergeActionsPolicy ──────────────────────────────────────────────────

  describe('mergeActionsPolicy', () => {
    test('should merge base and org policies', () => {
      const base = { allowed_actions: 'selected', github_owned_allowed: true };
      const org = { github_owned_allowed: false, verified_allowed: true };
      const result = mergeActionsPolicy(base, org);
      expect(result).toEqual({
        allowed_actions: 'selected',
        github_owned_allowed: false,
        verified_allowed: true
      });
    });

    test('should return org policy when base is empty', () => {
      const result = mergeActionsPolicy({}, { allowed_actions: 'all' });
      expect(result).toEqual({ allowed_actions: 'all' });
    });
  });

  // ─── parseActionsAllowListFile ────────────────────────────────────────────

  describe('parseActionsAllowListFile', () => {
    test('should parse valid allow list file', () => {
      const content = `actions:
  - actions/cache@*
  - actions/setup-node@*
  - myorg/*
`;
      setMockFileContent(content, '/mock/allow-list.yml');
      const result = parseActionsAllowListFile('/mock/allow-list.yml');
      expect(result).toEqual(['actions/cache@*', 'actions/setup-node@*', 'myorg/*']);
    });

    test('should trim and de-duplicate allow list patterns', () => {
      const content = `actions:
  - ' actions/cache@* '
  - actions/setup-node@*
  - actions/cache@*
`;
      setMockFileContent(content, '/mock/dedupe-allow-list.yml');

      const result = parseActionsAllowListFile('/mock/dedupe-allow-list.yml');

      expect(result).toEqual(['actions/cache@*', 'actions/setup-node@*']);
    });

    test('should throw for missing file', () => {
      expect(() => parseActionsAllowListFile('/mock/nonexistent.yml')).toThrow('not found');
    });

    test('should throw for file without actions key', () => {
      setMockFileContent('other: value', '/mock/bad.yml');
      expect(() => parseActionsAllowListFile('/mock/bad.yml')).toThrow('expected an "actions" array');
    });

    test('should throw for non-string entries', () => {
      const content = `actions:
  - 123
`;
      setMockFileContent(content, '/mock/bad-entries.yml');
      expect(() => parseActionsAllowListFile('/mock/bad-entries.yml')).toThrow('expected a string');
    });

    test('should throw for empty patterns', () => {
      const content = `actions:
  - '  '
  - ''
`;
      setMockFileContent(content, '/mock/empty.yml');
      expect(() => parseActionsAllowListFile('/mock/empty.yml')).toThrow('no valid patterns');
    });
  });

  // ─── parseOrganizationsFile with actions-policy ─────────────────────────

  describe('parseOrganizationsFile with actions-policy', () => {
    test('should parse actions-policy from orgs.yml', () => {
      const orgsYaml = `orgs:
  - org: my-org
    actions-policy:
      allowed-actions: selected
      default-workflow-permissions: read
`;
      setMockFileContent(orgsYaml, '/mock/orgs.yml');
      const result = parseOrganizationsFile('/mock/orgs.yml');

      expect(result).toHaveLength(1);
      expect(result[0].actionsPolicy).toEqual({
        allowed_actions: 'selected',
        default_workflow_permissions: 'read'
      });
    });

    test('should parse actions-allow-list-file from orgs.yml', () => {
      const allowListContent = `actions:
  - actions/cache@*
`;
      setMockFileContent(allowListContent, '/mock/allow-list.yml');
      const orgsYaml = `orgs:
  - org: my-org
    actions-allow-list-file: /mock/allow-list.yml
`;
      setMockFileContent(orgsYaml, '/mock/orgs.yml');
      const result = parseOrganizationsFile('/mock/orgs.yml');

      expect(result).toHaveLength(1);
      expect(result[0].actionsAllowListFile).toBe('/mock/allow-list.yml');
    });

    test('should throw for invalid actions-policy type', () => {
      const orgsYaml = `orgs:
  - org: my-org
    actions-policy:
      - invalid
`;
      setMockFileContent(orgsYaml, '/mock/orgs.yml');

      expect(() => parseOrganizationsFile('/mock/orgs.yml')).toThrow(
        'Invalid actions-policy for org "my-org": expected a key-value map'
      );
    });
  });

  // ─── parseOrganizations with actions policy inputs ──────────────────────

  describe('parseOrganizations with actions policy inputs', () => {
    test('should use actions policy from inputs', () => {
      const inputPolicy = {
        allowed_actions: 'selected',
        default_workflow_permissions: 'read'
      };

      const result = parseOrganizations('org1', '', '', [], false, '', null, null, null, null, '', inputPolicy, '');

      expect(result).toHaveLength(1);
      expect(result[0].actionsPolicy).toEqual({
        allowed_actions: 'selected',
        default_workflow_permissions: 'read'
      });
    });

    test('should layer per-org overrides on top of inputs', () => {
      const inputPolicy = {
        allowed_actions: 'selected',
        default_workflow_permissions: 'read'
      };

      const orgsYaml = `orgs:
  - org: my-org
  - org: my-other-org
    actions-policy:
      default-workflow-permissions: write
`;
      setMockFileContent(orgsYaml, '/mock/orgs.yml');

      const result = parseOrganizations(
        '',
        '/mock/orgs.yml',
        '',
        [],
        false,
        '',
        null,
        null,
        null,
        null,
        '',
        inputPolicy,
        ''
      );

      expect(result).toHaveLength(2);
      expect(result[0].actionsPolicy).toEqual({
        allowed_actions: 'selected',
        default_workflow_permissions: 'read'
      });
      expect(result[1].actionsPolicy).toEqual({
        allowed_actions: 'selected',
        default_workflow_permissions: 'write'
      });
    });

    test('should use actions allow list from file input', () => {
      const allowListContent = `actions:
  - actions/cache@*
  - myorg/*
`;
      setMockFileContent(allowListContent, '/mock/allow-list.yml');

      const result = parseOrganizations(
        'org1',
        '',
        '',
        [],
        false,
        '',
        null,
        null,
        null,
        null,
        '',
        null,
        '/mock/allow-list.yml'
      );

      expect(result).toHaveLength(1);
      expect(result[0].actionsAllowList).toEqual(['actions/cache@*', 'myorg/*']);
    });

    test('should use per-org allow list file over base', () => {
      const baseContent = `actions:
  - base-action@*
`;
      const orgContent = `actions:
  - org-action@*
`;
      setMockFileContent(baseContent, '/mock/base-allow.yml');
      setMockFileContent(orgContent, '/mock/org-allow.yml');

      const orgsYaml = `orgs:
  - org: my-org
  - org: my-other-org
    actions-allow-list-file: /mock/org-allow.yml
`;
      setMockFileContent(orgsYaml, '/mock/orgs.yml');

      const result = parseOrganizations(
        '',
        '/mock/orgs.yml',
        '',
        [],
        false,
        '',
        null,
        null,
        null,
        null,
        '',
        null,
        '/mock/base-allow.yml'
      );

      expect(result).toHaveLength(2);
      expect(result[0].actionsAllowList).toEqual(['base-action@*']);
      expect(result[1].actionsAllowList).toEqual(['org-action@*']);
    });
  });

  // ─── syncActionsPolicy ─────────────────────────────────────────────────────

  describe('syncActionsPolicy', () => {
    test('should detect no changes when settings match', async () => {
      mockRequest.mockImplementation(route => {
        if (route === 'GET /orgs/{org}/actions/permissions') {
          return { data: { allowed_actions: 'selected', enabled_repositories: 'all' } };
        }
        if (route === 'GET /orgs/{org}/actions/permissions/workflow') {
          return { data: { default_workflow_permissions: 'read', can_approve_pull_request_reviews: false } };
        }
        return { data: {} };
      });

      const desired = {
        allowed_actions: 'selected',
        default_workflow_permissions: 'read',
        can_approve_pull_request_reviews: false
      };

      const result = await syncActionsPolicy(mockOctokit, 'my-org', desired, null, false);
      expect(result.failed).toBe(false);
      expect(result.subResults).toHaveLength(0);
      expect(mockCore.info).toHaveBeenCalledWith(expect.stringContaining('Actions permissions unchanged'));
      expect(mockCore.info).toHaveBeenCalledWith(expect.stringContaining('Workflow permissions unchanged'));
    });

    test('should detect and apply changes', async () => {
      mockRequest.mockImplementation(route => {
        if (route === 'GET /orgs/{org}/actions/permissions') {
          return { data: { allowed_actions: 'all', enabled_repositories: 'all' } };
        }
        if (route === 'PUT /orgs/{org}/actions/permissions') {
          return { status: 204 };
        }
        return { data: {} };
      });

      const desired = { allowed_actions: 'selected' };

      const result = await syncActionsPolicy(mockOctokit, 'my-org', desired, null, false);
      expect(result.failed).toBe(false);
      expect(result.subResults).toHaveLength(1);
      expect(result.subResults[0].kind).toBe('actions-policy-permissions-update');
      expect(result.subResults[0].status).toBe('changed');
    });

    test('should handle dry run mode', async () => {
      mockRequest.mockImplementation(route => {
        if (route === 'GET /orgs/{org}/actions/permissions/workflow') {
          return { data: { default_workflow_permissions: 'write', can_approve_pull_request_reviews: true } };
        }
        return { data: {} };
      });

      const desired = { default_workflow_permissions: 'read' };

      const result = await syncActionsPolicy(mockOctokit, 'my-org', desired, null, true);
      expect(result.failed).toBe(false);
      expect(result.subResults).toHaveLength(1);
      expect(result.subResults[0].message).toContain('Would');
      // Should not have called PUT
      expect(mockRequest).not.toHaveBeenCalledWith('PUT /orgs/{org}/actions/permissions/workflow', expect.anything());
    });

    test('should handle API fetch error gracefully', async () => {
      mockRequest.mockImplementation(route => {
        if (route === 'GET /orgs/{org}/actions/permissions') {
          throw new Error('Not Found');
        }
        return { data: {} };
      });

      const desired = { allowed_actions: 'selected' };

      const result = await syncActionsPolicy(mockOctokit, 'my-org', desired, null, false);
      expect(result.failed).toBe(true);
      expect(result.subResults[0].status).toBe('warning');
    });

    test('should sync allow list patterns', async () => {
      mockRequest.mockImplementation(route => {
        if (route === 'GET /orgs/{org}/actions/permissions') {
          return { data: { allowed_actions: 'selected', enabled_repositories: 'all' } };
        }
        if (route === 'GET /orgs/{org}/actions/permissions/selected-actions') {
          return {
            data: {
              github_owned_allowed: true,
              verified_allowed: false,
              patterns_allowed: ['old-action@*']
            }
          };
        }
        if (route === 'PUT /orgs/{org}/actions/permissions/selected-actions') {
          return { status: 200 };
        }
        return { data: {} };
      });

      const allowList = ['new-action@*', 'another-action@*'];
      const result = await syncActionsPolicy(mockOctokit, 'my-org', {}, allowList, false);

      expect(result.failed).toBe(false);
      expect(result.subResults.some(s => s.kind === 'actions-policy-allow-list-update')).toBe(true);
    });

    test('should detect no changes when allow list matches', async () => {
      mockRequest.mockImplementation(route => {
        if (route === 'GET /orgs/{org}/actions/permissions') {
          return { data: { allowed_actions: 'selected', enabled_repositories: 'all' } };
        }
        if (route === 'GET /orgs/{org}/actions/permissions/selected-actions') {
          return {
            data: {
              github_owned_allowed: true,
              verified_allowed: false,
              patterns_allowed: ['action-a@*', 'action-b@*']
            }
          };
        }
        return { data: {} };
      });

      const allowList = ['action-b@*', 'action-a@*']; // Same patterns, different order
      const result = await syncActionsPolicy(mockOctokit, 'my-org', { allowed_actions: 'selected' }, allowList, false);

      expect(result.failed).toBe(false);
      expect(result.subResults).toHaveLength(0);
    });

    test('should ignore duplicate allow list patterns when comparing', async () => {
      mockRequest.mockImplementation(route => {
        if (route === 'GET /orgs/{org}/actions/permissions') {
          return { data: { allowed_actions: 'selected', enabled_repositories: 'all' } };
        }
        if (route === 'GET /orgs/{org}/actions/permissions/selected-actions') {
          return {
            data: {
              github_owned_allowed: true,
              verified_allowed: false,
              patterns_allowed: ['action-a@*', 'action-b@*']
            }
          };
        }
        return { data: {} };
      });

      const allowList = ['action-b@*', 'action-a@*', 'action-a@*'];
      const result = await syncActionsPolicy(mockOctokit, 'my-org', { allowed_actions: 'selected' }, allowList, false);

      expect(result.failed).toBe(false);
      expect(result.subResults).toHaveLength(0);
      expect(mockRequest).not.toHaveBeenCalledWith(
        'PUT /orgs/{org}/actions/permissions/selected-actions',
        expect.anything()
      );
    });

    test('should skip selected actions settings unless allowed-actions is selected', async () => {
      mockRequest.mockImplementation(route => {
        if (route === 'GET /orgs/{org}/actions/permissions') {
          return { data: { allowed_actions: 'all', enabled_repositories: 'all' } };
        }
        return { data: {} };
      });

      const desired = { github_owned_allowed: true };
      const allowList = ['new-action@*'];
      const result = await syncActionsPolicy(mockOctokit, 'my-org', desired, allowList, false);

      expect(result.failed).toBe(false);
      expect(result.subResults).toEqual([
        {
          kind: 'actions-policy-selected-actions-update',
          status: 'warning',
          message:
            'Skipping selected actions settings because allowed_actions must be "selected" before managing selected actions or the allow list (current: "all")'
        },
        {
          kind: 'actions-policy-allow-list-update',
          status: 'warning',
          message:
            'Skipping selected actions settings because allowed_actions must be "selected" before managing selected actions or the allow list (current: "all")'
        }
      ]);
      expect(mockRequest).not.toHaveBeenCalledWith(
        'GET /orgs/{org}/actions/permissions/selected-actions',
        expect.anything()
      );
    });

    test('should mark all selected actions sub-results as warnings when update fails', async () => {
      mockRequest.mockImplementation(route => {
        if (route === 'GET /orgs/{org}/actions/permissions') {
          return { data: { allowed_actions: 'selected', enabled_repositories: 'all' } };
        }
        if (route === 'GET /orgs/{org}/actions/permissions/selected-actions') {
          return {
            data: {
              github_owned_allowed: false,
              verified_allowed: false,
              patterns_allowed: ['old-action@*']
            }
          };
        }
        if (route === 'PUT /orgs/{org}/actions/permissions/selected-actions') {
          throw new Error('Forbidden');
        }
        return { data: {} };
      });

      const desired = { allowed_actions: 'selected', github_owned_allowed: true };
      const allowList = ['new-action@*'];
      const result = await syncActionsPolicy(mockOctokit, 'my-org', desired, allowList, false);

      expect(result.failed).toBe(true);
      expect(result.subResults).toEqual([
        {
          kind: 'actions-policy-selected-actions-update',
          status: 'warning',
          message: 'Failed to update selected actions settings: Forbidden'
        },
        {
          kind: 'actions-policy-allow-list-update',
          status: 'warning',
          message: 'Failed to update selected actions settings: Forbidden'
        }
      ]);
    });
  });
});
