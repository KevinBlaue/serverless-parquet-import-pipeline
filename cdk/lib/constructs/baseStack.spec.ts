import { RemovalPolicy } from 'aws-cdk-lib';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { App } from './app';
import { BaseStack } from './baseStack';

class InspectableStack extends BaseStack {
  constructor(app: App) {
    super(app, 'importPipeline');
  }

  inspect(expectedDeletionProtection: boolean): void {
    expect(this.stringValue('glueVersion')).toBe('5.0');
    expect(this.numberValue('glueNumberOfWorkers')).toBe(2);
    expect(this.booleanValue('deletionProtection')).toBe(expectedDeletionProtection);
  }

  policies(): { removal: RemovalPolicy; retention: RetentionDays } {
    return { removal: this.removalPolicy(), retention: this.logRetention() };
  }

  invalidValues(): void {
    expect(() => this.stringValue('glueNumberOfWorkers')).toThrow('non-empty string');
    expect(() => this.numberValue('glueVersion')).toThrow('must be a number');
    expect(() => this.booleanValue('glueVersion')).toThrow('must be a boolean');
    expect(() => this.removalPolicy('glueVersion')).toThrow('destroy or retain');
    expect(() => this.logRetention('glueNumberOfWorkers')).toThrow('must be 7 or 30 days');
  }
}

describe('BaseStack', () => {
  test.each([
    ['dev', false, RemovalPolicy.DESTROY, RetentionDays.ONE_WEEK],
    ['prod', true, RemovalPolicy.RETAIN, RetentionDays.ONE_MONTH],
  ])(
    'loads defaults and %s overrides',
    (environmentName, deletionProtection, removal, retention) => {
      const app = new App({ context: { environment: environmentName } });
      const stack = new InspectableStack(app);
      stack.inspect(deletionProtection);
      expect(stack.policies()).toEqual({ removal, retention });
      stack.invalidValues();
    }
  );
});
