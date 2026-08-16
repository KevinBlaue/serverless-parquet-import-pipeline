import { App } from './app';

describe('App', () => {
  test('loads app defaults and environment-specific tags', () => {
    const app = new App({ context: { environment: 'dev' } });
    expect(app.environmentName).toBe('dev');
    expect(app.defaultRegion).toBe('eu-central-1');
    expect(app.stackEnvironment).toMatchObject({ region: 'eu-central-1' });
    expect(app.resourceTags).toEqual({
      project: 'serverless-parquet-import-pipeline',
      'managed-by': 'aws-cdk',
      lifecycle: 'ephemeral',
    });
  });

  test('validates the environment context', () => {
    expect(() => new App()).toThrow('lowercase environment name');
    expect(() => new App({ context: { environment: '../prod' } })).toThrow(
      'lowercase environment name'
    );
  });
});
