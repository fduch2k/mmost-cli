import { MattermostClient } from '../client/mattermost-client';
import { executeCommand } from '../commands';
import { loadConfig } from '../config/config';
import { formatMarkdown } from '../utils/markdown-formatter';
import { formatErrorOutput } from '../utils/output-formatter';

import { getHelpJson, getHelpText } from './help';
import { parseCliInput } from './parser';

type CliOutput = {
  stdout: { write: (message: string) => unknown };
  stderr: { write: (message: string) => unknown };
};

type RuntimeDependencies = {
  createClient?: () => Promise<MattermostClient>;
};

async function defaultCreateClient() {
  const config = loadConfig();
  const client = new MattermostClient(config);
  await client.init();
  return client;
}

export async function runCli(
  args: string[],
  output: CliOutput = process,
  dependencies: RuntimeDependencies = {},
): Promise<number> {
  try {
    const parsed = parseCliInput(args);
    if (parsed.type === 'help') {
      const help =
        parsed.format === 'json'
          ? JSON.stringify(getHelpJson(parsed.command), null, 2)
          : getHelpText(parsed.command);
      output.stdout.write(`${help}\n`);
      return 0;
    }

    const createClient = dependencies.createClient || defaultCreateClient;
    const client = await createClient();
    const result = await executeCommand(parsed.command, client, parsed.options);
    const formatted =
      parsed.format === 'human'
        ? `${formatMarkdown(result, parsed.command)}\n`
        : `${JSON.stringify(result, null, 2)}\n`;
    output.stdout.write(formatted);
    return 0;
  } catch (error) {
    const { message, json } = formatErrorOutput(error);
    const isHuman = args.includes('--human') && !args.includes('--json');
    if (isHuman) {
      output.stderr.write(`Error: ${message}\n`);
    } else {
      output.stderr.write(json);
    }
    return 1;
  }
}
