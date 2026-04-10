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
const mockRequest = jest.fn();

// Mock octokit instance
const mockOctokit = {
  request: mockRequest
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
  syncOrgRulesets,
  mergeCustomProperties,
  validateOrgConfig,
  resetKnownOrgConfigKeysCache
} = await import('../src/index.js');

describe('Bulk GitHub Organization Settings Sync Action', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequest.mockReset();
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
      mockRequest.mockResolvedValueOnce({ data: [] });

      await run();

      expect(mockCore.setFailed).not.toHaveBeenCalled();
      expect(mockCore.setOutput).toHaveBeenCalledWith('updated-organizations', '1');
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
      mockRequest.mockResolvedValueOnce({ data: [] });
      // Mock: successful POST
      mockRequest.mockResolvedValueOnce({ data: { id: 123 } });

      const result = await syncOrgRulesets(mockOctokit, 'my-org', [rulesetPath], false, false);

      expect(result.subResults).toHaveLength(1);
      expect(result.subResults[0].kind).toBe('ruleset-create');
      expect(result.subResults[0].status).toBe('changed');
      expect(mockRequest).toHaveBeenCalledWith(
        'POST /orgs/{org}/rulesets',
        expect.objectContaining({
          org: 'my-org',
          name: 'test-ruleset'
        })
      );
    });

    test('should detect no changes for identical ruleset', async () => {
      const rulesetConfig = JSON.parse((await import('fs')).readFileSync(rulesetPath, 'utf8'));

      // Mock: existing ruleset with same name
      mockRequest.mockResolvedValueOnce({
        data: [{ id: 123, name: 'test-ruleset' }]
      });
      // Mock: full ruleset details matching config
      mockRequest.mockResolvedValueOnce({
        data: {
          id: 123,
          ...rulesetConfig
        }
      });

      const result = await syncOrgRulesets(mockOctokit, 'my-org', [rulesetPath], false, false);

      expect(result.subResults).toHaveLength(0);
      // Only GET list + GET detail, no PUT
      expect(mockRequest).toHaveBeenCalledTimes(2);
    });

    test('should detect and apply updates when ruleset differs', async () => {
      // Mock: existing ruleset with same name but different enforcement
      mockRequest.mockResolvedValueOnce({
        data: [{ id: 123, name: 'test-ruleset' }]
      });
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
      mockRequest.mockResolvedValueOnce({
        data: [
          { id: 123, name: 'test-ruleset' },
          { id: 456, name: 'old-ruleset' }
        ]
      });
      // Mock: full details for matching ruleset
      const rulesetConfig = JSON.parse((await import('fs')).readFileSync(rulesetPath, 'utf8'));
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
      mockRequest.mockResolvedValueOnce({
        data: [
          { id: 123, name: 'test-ruleset' },
          { id: 456, name: 'old-ruleset' }
        ]
      });
      // Mock: full details for matching ruleset
      const rulesetConfig = JSON.parse((await import('fs')).readFileSync(rulesetPath, 'utf8'));
      mockRequest.mockResolvedValueOnce({
        data: { id: 123, ...rulesetConfig }
      });

      const result = await syncOrgRulesets(mockOctokit, 'my-org', [rulesetPath], false, false);

      expect(result.subResults).toHaveLength(0);
      // Only GET list + GET detail, no DELETE
      expect(mockRequest).toHaveBeenCalledTimes(2);
    });

    test('should handle dry-run mode for new ruleset', async () => {
      mockRequest.mockResolvedValueOnce({ data: [] });

      const result = await syncOrgRulesets(mockOctokit, 'my-org', [rulesetPath], false, true);

      expect(result.subResults).toHaveLength(1);
      expect(result.subResults[0].kind).toBe('ruleset-create');
      expect(result.subResults[0].status).toBe('changed');
      expect(result.subResults[0].message).toContain('Would');
      // Only GET list, no POST
      expect(mockRequest).toHaveBeenCalledTimes(1);
    });

    test('should handle 404 on GET as empty rulesets', async () => {
      const error404 = new Error('Not Found');
      error404.status = 404;
      mockRequest.mockRejectedValueOnce(error404);
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
      mockRequest.mockResolvedValueOnce({ data: [] });
      mockRequest.mockRejectedValueOnce(new Error('Forbidden'));

      const result = await syncOrgRulesets(mockOctokit, 'my-org', [rulesetPath], false, false);

      expect(result.subResults).toHaveLength(1);
      expect(result.subResults[0].status).toBe('warning');
      expect(result.subResults[0].message).toContain('Failed');
    });

    test('should support multiple separate ruleset files', async () => {
      // Mock: no existing rulesets
      mockRequest.mockResolvedValueOnce({ data: [] });
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
      const rulesetConfig = JSON.parse((await import('fs')).readFileSync(rulesetPath, 'utf8'));
      const tagRulesetConfig = JSON.parse((await import('fs')).readFileSync(tagRulesetPath, 'utf8'));

      // Mock: existing rulesets include both managed + one unmanaged
      mockRequest.mockResolvedValueOnce({
        data: [
          { id: 100, name: 'test-ruleset' },
          { id: 200, name: 'test-tag-ruleset' },
          { id: 999, name: 'old-ruleset' }
        ]
      });
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
      mockRequest.mockResolvedValueOnce({
        data: [{ id: 100, name: 'test-ruleset' }]
      });
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
});
