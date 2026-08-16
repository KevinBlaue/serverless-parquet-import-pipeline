import { join } from 'node:path';
import { CfnOutput, Duration, Stack } from 'aws-cdk-lib';
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Rule, RuleTargetInput } from 'aws-cdk-lib/aws-events';
import { SfnStateMachine } from 'aws-cdk-lib/aws-events-targets';
import { CfnJob } from 'aws-cdk-lib/aws-glue';
import { ManagedPolicy, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import { BlockPublicAccess, Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import type { CfnBucket } from 'aws-cdk-lib/aws-s3';
import { Asset } from 'aws-cdk-lib/aws-s3-assets';
import {
  DefinitionBody,
  IntegrationPattern,
  JsonPath,
  LogLevel,
  StateMachine,
  StateMachineType,
  TaskInput,
} from 'aws-cdk-lib/aws-stepfunctions';
import { GlueStartJobRun } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import type { App } from './constructs/app';
import { BaseStack } from './constructs/baseStack';
import type { StackProps } from './constructs/baseStack';

export class ImportPipelineStack extends BaseStack {
  constructor(app: App, id: string, props?: StackProps) {
    super(app, id, props);

    const removalPolicy = this.removalPolicy();
    const inputBucket = new Bucket(this, 'InputBucket', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy,
    });
    const cfnInputBucket = inputBucket.node.defaultChild as CfnBucket;
    cfnInputBucket.notificationConfiguration = {
      eventBridgeConfiguration: { eventBridgeEnabled: true },
    };
    const items = new Table(this, 'Items', {
      partitionKey: { name: 'id', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      deletionProtection: this.booleanValue('deletionProtection'),
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: this.booleanValue('pointInTimeRecovery'),
      },
      removalPolicy,
    });

    const glueScript = new Asset(this, 'GlueScript', {
      path: join(__dirname, '..', '..', 'src', 'glue-jobs', 'import-items', 'src', 'index.py'),
    });

    const glueRole = new Role(this, 'GlueJobRole', {
      assumedBy: new ServicePrincipal('glue.amazonaws.com'),
      managedPolicies: [ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSGlueServiceRole')],
    });
    inputBucket.grantRead(glueRole);
    glueScript.grantRead(glueRole);
    items.grantWriteData(glueRole);

    const glueJob = new CfnJob(this, 'ImportItemsJob', {
      name: `${Stack.of(this).stackName}-import-items`,
      description: 'Imports id, name and description fields from one Parquet object.',
      role: glueRole.roleArn,
      command: {
        name: 'glueetl',
        pythonVersion: '3',
        scriptLocation: glueScript.s3ObjectUrl,
      },
      defaultArguments: {
        '--enable-metrics': 'true',
        '--enable-observability-metrics': 'true',
        '--job-bookmark-option': 'job-bookmark-disable',
        '--job-language': 'python',
      },
      executionClass: 'STANDARD',
      executionProperty: { maxConcurrentRuns: 2 },
      glueVersion: this.stringValue('glueVersion'),
      maxRetries: 0,
      numberOfWorkers: this.numberValue('glueNumberOfWorkers'),
      timeout: this.numberValue('glueJobTimeoutMinutes'),
      workerType: this.stringValue('glueWorkerType'),
    });
    glueScript.addResourceMetadata(glueJob, 'Command.ScriptLocation');

    const startGlueJob = new GlueStartJobRun(this, 'ImportParquet', {
      glueJobName: glueJob.ref,
      integrationPattern: IntegrationPattern.RUN_JOB,
      arguments: TaskInput.fromObject({
        '--SOURCE_BUCKET': JsonPath.stringAt('$.detail.bucket.name'),
        '--SOURCE_KEY': JsonPath.stringAt('$.detail.object.key'),
        '--DYNAMODB_TABLE': items.tableName,
      }),
      resultPath: '$.importResult',
    });
    const stateMachineLogs = new LogGroup(this, 'StateMachineLogs', {
      retention: this.logRetention(),
      removalPolicy,
    });
    const stateMachine = new StateMachine(this, 'ImportStateMachine', {
      definitionBody: DefinitionBody.fromChainable(startGlueJob),
      logs: {
        destination: stateMachineLogs,
        includeExecutionData: false,
        level: LogLevel.ERROR,
      },
      stateMachineType: StateMachineType.STANDARD,
      timeout: Duration.minutes(this.numberValue('stateMachineTimeoutMinutes')),
      tracingEnabled: true,
    });

    new Rule(this, 'ParquetObjectCreated', {
      description: 'Starts the import state machine for new Parquet objects.',
      eventPattern: {
        source: ['aws.s3'],
        detailType: ['Object Created'],
        resources: [inputBucket.bucketArn],
        detail: {
          bucket: { name: [inputBucket.bucketName] },
          object: { key: [{ suffix: '.parquet' }] },
        },
      },
      targets: [
        new SfnStateMachine(stateMachine, {
          input: RuleTargetInput.fromEventPath('$'),
        }),
      ],
    });

    new CfnOutput(this, 'InputBucketName', { value: inputBucket.bucketName });
    new CfnOutput(this, 'ItemsTableName', { value: items.tableName });
    new CfnOutput(this, 'StateMachineArn', { value: stateMachine.stateMachineArn });
  }
}
