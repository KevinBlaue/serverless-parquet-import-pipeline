#!/usr/bin/env node
import { App } from '../lib/constructs/app';
import { ImportPipelineStack } from '../lib/importPipeline';

const app = new App();
new ImportPipelineStack(app, 'importPipeline');
