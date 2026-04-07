/**
 * Tests for the Bulk GitHub Organization Settings Sync Action
 */

import { jest } from '@jest/globals';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
jest.unstable_mockModule('@actions/core', () => mockCore);
jest.unstable_mockModule('@octokit/rest', () => ({
  Octokit: jest.fn(() => mockOctokit)
}));

// Import the main module and helper functions after mocking
const {
  default: run,
  parseOrganizations,
  parseOrganizationsFile,
  parseCustomPropertiesFile,
  normalizeCustomProperties,
  compareCustomProperty,
  syncCustomProperties,
  mergeCustomProperties,
  validateOrgConfig
} = await import('../src/index.js');

describe('Bulk GitHub Organization Settings Sync Action', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequest.mockReset();
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
      const samplePath = path.join(__dirname, '..', 'sample-configuration', 'org-settings.yml');
      const result = parseOrganizations('', samplePath, '');

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
      const cpPath = path.join(__dirname, '..', 'sample-configuration', 'custom-properties.yml');
      const result = parseOrganizations('my-org', '', cpPath);

      expect(result).toHaveLength(1);
      expect(result[0].org).toBe('my-org');
      expect(result[0].customProperties).toBeDefined();
      expect(result[0].customProperties.length).toBe(4);
      expect(result[0].customProperties[0].property_name).toBe('team');
    });

    test('should merge base custom-properties-file with per-org overrides in organizations-file', () => {
      const samplePath = path.join(__dirname, '..', 'sample-configuration', 'org-settings.yml');
      const cpPath = path.join(__dirname, '..', 'sample-configuration', 'custom-properties.yml');
      const result = parseOrganizations('', samplePath, cpPath);

      expect(result).toHaveLength(2);
      // my-org: no inline overrides → gets all 4 base properties
      expect(result[0].customProperties.length).toBe(4);
      // my-other-org: overrides "team" → gets 4 base + team override merged = 4
      expect(result[1].customProperties.length).toBe(4);
      // Verify the override took effect (data-science in allowed_values)
      const teamProp = result[1].customProperties.find(p => p.property_name === 'team');
      expect(teamProp.allowed_values).toContain('data-science');
    });
  });

  // ─── parseOrganizationsFile ─────────────────────────────────────────────

  describe('parseOrganizationsFile', () => {
    test('should throw for missing file', () => {
      expect(() => parseOrganizationsFile('/nonexistent/file.yml')).toThrow('not found');
    });

    test('should parse the sample config', () => {
      const samplePath = path.join(__dirname, '..', 'sample-configuration', 'org-settings.yml');
      const result = parseOrganizationsFile(samplePath);

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
  });

  // ─── parseCustomPropertiesFile ──────────────────────────────────────────

  describe('parseCustomPropertiesFile', () => {
    test('should throw for missing file', () => {
      expect(() => parseCustomPropertiesFile('/nonexistent/file.yml')).toThrow('not found');
    });

    test('should parse the sample custom properties file', () => {
      const cpPath = path.join(__dirname, '..', 'sample-configuration', 'custom-properties.yml');
      const result = parseCustomPropertiesFile(cpPath);

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
      const samplePath = path.join(__dirname, '..', 'sample-configuration', 'org-settings.yml');
      const cpPath = path.join(__dirname, '..', 'sample-configuration', 'custom-properties.yml');

      mockCore.getInput.mockImplementation(name => {
        const inputs = {
          'github-token': 'test-token',
          'github-api-url': 'https://api.github.com',
          organizations: '',
          'organizations-file': samplePath,
          'custom-properties-file': cpPath,
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
      mockCore.getInput.mockImplementation(name => {
        const inputs = {
          'github-token': 'test-token',
          'github-api-url': 'https://api.github.com',
          organizations: 'my-org',
          'organizations-file': '',
          'custom-properties-file': path.join(__dirname, '..', 'sample-configuration', 'custom-properties.yml'),
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
  });
});
