import { join } from 'node:path';
import { App as CdkApp } from 'aws-cdk-lib';
import type { AppProps, Environment } from 'aws-cdk-lib';
import { loadEnvironmentConfiguration } from '../utils/config';
import type { Configuration } from '../utils/config';

export class App extends CdkApp {
  readonly config: Configuration;
  readonly environmentName: string;
  readonly environmentsDirectory: string;

  constructor(props?: AppProps) {
    super(props);
    this.environmentName = this.readEnvironmentName();
    this.environmentsDirectory = join(__dirname, '..', '..', 'environments');
    this.config = loadEnvironmentConfiguration(
      this.environmentsDirectory,
      this.environmentName,
      'app'
    );
  }

  get defaultRegion(): string {
    return this.stringValue('defaultRegion');
  }

  get stackEnvironment(): Environment {
    return {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: this.defaultRegion,
    };
  }

  get resourceTags(): Readonly<Record<string, string>> {
    const tags = this.config.resourceTags;
    if (!isRecord(tags)) throw new Error('Configuration value resourceTags must be an object');

    for (const [key, value] of Object.entries(tags)) {
      if (typeof value !== 'string') throw new Error(`Resource tag ${key} must be a string`);
    }
    return tags as Record<string, string>;
  }

  private readEnvironmentName(): string {
    const environment: unknown = this.node.tryGetContext('environment');
    if (typeof environment !== 'string' || !/^[a-z][a-z0-9-]*$/.test(environment)) {
      throw new Error('CDK context environment must be a lowercase environment name');
    }
    return environment;
  }

  private stringValue(key: string): string {
    const value = this.config[key];
    if (typeof value !== 'string' || value.length === 0) {
      throw new Error(`Configuration value ${key} must be a non-empty string`);
    }
    return value;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
