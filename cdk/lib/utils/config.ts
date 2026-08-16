import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { load } from 'js-yaml';

export type Configuration = Record<string, unknown>;

export function loadEnvironmentConfiguration(
  environmentsDirectory: string,
  environment: string,
  configurationName: string
): Configuration {
  const defaults = readYaml(join(environmentsDirectory, 'default', `${configurationName}.yaml`));
  const override = readYaml(join(environmentsDirectory, environment, `${configurationName}.yaml`));
  return deepMerge(defaults, override);
}

export function deepMerge(base: Configuration, override: Configuration): Configuration {
  const merged: Configuration = { ...base };

  for (const [key, value] of Object.entries(override)) {
    const current = merged[key];
    merged[key] =
      isConfiguration(current) && isConfiguration(value) ? deepMerge(current, value) : value;
  }

  return merged;
}

function readYaml(path: string): Configuration {
  const document = load(readFileSync(path, 'utf8'));
  if (!isConfiguration(document)) {
    throw new Error(`Configuration ${path} must contain a YAML object`);
  }
  return document;
}

function isConfiguration(value: unknown): value is Configuration {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
