import { Template } from 'aws-cdk-lib/assertions';
import { App } from './constructs/app';
import { ImportPipelineStack } from './importPipeline';

describe('ImportPipelineStack', () => {
  test('matches the infrastructure snapshot', () => {
    const app = new App({ context: { environment: 'dev' } });
    const stack = new ImportPipelineStack(app, 'importPipeline', {
      env: { account: '111111111111', region: 'eu-central-1' },
    });
    expect(Template.fromStack(stack).toJSON()).toMatchSnapshot();
  });
});
