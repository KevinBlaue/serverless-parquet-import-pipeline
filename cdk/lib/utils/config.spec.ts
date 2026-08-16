import { join } from 'node:path';
import { deepMerge, loadEnvironmentConfiguration } from './config';

describe('environment configuration', () => {
  test('merges defaults with the selected environment', () => {
    const directory = join(__dirname, '..', '..', 'environments');
    expect(loadEnvironmentConfiguration(directory, 'dev', 'importPipeline')).toMatchObject({
      deletionProtection: false,
      glueVersion: '5.0',
      logRetentionDays: 7,
      removalPolicy: 'destroy',
    });
    expect(loadEnvironmentConfiguration(directory, 'prod', 'importPipeline')).toMatchObject({
      deletionProtection: true,
      logRetentionDays: 30,
      pointInTimeRecovery: true,
      removalPolicy: 'retain',
    });
  });

  test('deep-merges nested objects without mutating defaults', () => {
    const defaults = { tags: { project: 'import', lifecycle: 'default' }, region: 'eu-central-1' };
    expect(deepMerge(defaults, { tags: { lifecycle: 'ephemeral' } })).toEqual({
      tags: { project: 'import', lifecycle: 'ephemeral' },
      region: 'eu-central-1',
    });
    expect(defaults.tags.lifecycle).toBe('default');
  });
});
