import { COMMAND_SPECS, getCommandSpec } from './specs';

const ENV_REQUIREMENTS = [
  {
    name: 'MATTERMOST_URL',
    required: true,
    description: 'Mattermost base URL',
  },
  {
    name: 'MATTERMOST_TOKEN',
    required: true,
    description: 'Mattermost personal access token',
  },
  {
    name: 'MATTERMOST_TEAM_ID',
    required: false,
    description: 'Mattermost team ID (preferred)',
  },
  {
    name: 'MATTERMOST_TEAM_NAME',
    required: false,
    description: 'Mattermost team name (used when team ID is absent)',
  },
];

export function getHelpJson(commandName?: string) {
  const commands = commandName
    ? (() => {
        const command = getCommandSpec(commandName);
        if (!command) {
          throw new Error(`Unknown command: ${commandName}`);
        }
        return [command];
      })()
    : COMMAND_SPECS;

  return {
    binary: 'mmost',
    commands: commands.map(spec => ({
      name: spec.name,
      description: spec.description,
      arguments: spec.options.map(option => ({
        name: option.flag,
        type: option.type,
        required: !!option.required,
        description: option.description,
      })),
      examples: spec.examples,
    })),
    env: ENV_REQUIREMENTS,
  };
}

export function getHelpText(commandName?: string): string {
  if (commandName) {
    const spec = getCommandSpec(commandName);
    if (!spec) {
      throw new Error(`Unknown command: ${commandName}`);
    }

    const options =
      spec.options.length === 0
        ? '  (no options)'
        : spec.options
            .map(option => {
              const required = option.required ? ' (required)' : '';
              return `  --${option.flag}: ${option.description}${required}`;
            })
            .join('\n');

    const examples = spec.examples.map(example => `  ${example}`).join('\n');

    return [
      `Command: ${spec.name}`,
      `Description: ${spec.description}`,
      '',
      'Options:',
      options,
      '',
      'Examples:',
      examples,
      '',
      'Human-readable mode:',
      `  mmost help ${spec.name} --human`,
    ].join('\n');
  }

  const commandLines = COMMAND_SPECS.map(
    spec => `  ${spec.name.padEnd(18)} ${spec.description}`,
  ).join('\n');

  return [
    'mmost - Mattermost command-line utility',
    '',
    'Usage:',
    '  mmost <command> [--option value]',
    '  mmost help [command] [--human]',
    '',
    'Commands:',
    commandLines,
    '',
    'Environment:',
    '  MATTERMOST_URL, MATTERMOST_TOKEN, and one of MATTERMOST_TEAM_ID or MATTERMOST_TEAM_NAME',
    '',
    'Human-readable mode:',
    '  mmost help --human',
  ].join('\n');
}
