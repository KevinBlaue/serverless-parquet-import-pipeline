import { RemovalPolicy, Stack, Tags } from 'aws-cdk-lib';
import type { StackProps as CdkStackProps } from 'aws-cdk-lib';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { loadEnvironmentConfiguration } from '../utils/config';
import type { Configuration } from '../utils/config';
import type { App } from './app';

export type StackProps = CdkStackProps;

export class BaseStack extends Stack {
  protected readonly configuration: Configuration;
  protected readonly environmentName: string;

  constructor(app: App, id: string, props?: StackProps) {
    super(app, `${app.environmentName}-${id}`, {
      env: app.stackEnvironment,
      ...props,
    });

    this.environmentName = app.environmentName;
    this.configuration = loadEnvironmentConfiguration(
      app.environmentsDirectory,
      app.environmentName,
      id
    );

    this.applyTags(app.resourceTags);
  }

  protected stringValue(key: string): string {
    const value = this.configuration[key];
    if (typeof value !== 'string' || value.length === 0) {
      throw new Error(`Configuration value ${key} must be a non-empty string`);
    }
    return value;
  }

  protected numberValue(key: string): number {
    const value = this.configuration[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`Configuration value ${key} must be a number`);
    }
    return value;
  }

  protected booleanValue(key: string): boolean {
    const value = this.configuration[key];
    if (typeof value !== 'boolean') {
      throw new Error(`Configuration value ${key} must be a boolean`);
    }
    return value;
  }

  protected removalPolicy(key = 'removalPolicy'): RemovalPolicy {
    const value = this.stringValue(key);
    if (value === 'destroy') return RemovalPolicy.DESTROY;
    if (value === 'retain') return RemovalPolicy.RETAIN;
    throw new Error(`Configuration value ${key} must be destroy or retain`);
  }

  protected logRetention(key = 'logRetentionDays'): RetentionDays {
    const value = this.numberValue(key);
    if (value === 7) return RetentionDays.ONE_WEEK;
    if (value === 30) return RetentionDays.ONE_MONTH;
    throw new Error(`Configuration value ${key} must be 7 or 30 days`);
  }

  private applyTags(resourceTags: Readonly<Record<string, string>>): void {
    for (const [key, value] of Object.entries(resourceTags)) {
      Tags.of(this).add(key, value);
    }
    Tags.of(this).add('environment', this.environmentName);
  }
}
