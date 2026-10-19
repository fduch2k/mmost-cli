#!/usr/bin/env node

import { exitAfterFlush } from './cli/exit';
import { runCli } from './cli/runtime';

async function main() {
  const exitCode = await runCli(process.argv.slice(2));
  await exitAfterFlush(exitCode);
}

void main();
