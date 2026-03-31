import { getCommandSpec } from './specs';
import { ParsedInput, OutputFormat } from './types';

function parseNumber(raw: string, flag: string): number {
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid value for --${flag}: expected a number`);
  }
  return value;
}

export function extractGlobalFormat(args: string[]): { format: OutputFormat; remaining: string[] } {
  const hasJson = args.includes('--json');
  const hasHuman = args.includes('--human');

  if (hasJson && hasHuman) {
    throw new Error('Cannot use both --json and --human at the same time.');
  }

  const remaining = args.filter(arg => arg !== '--json' && arg !== '--human');

  if (hasHuman) {
    return { format: 'human', remaining };
  }

  if (hasJson) {
    return { format: 'json', remaining };
  }

  return { format: 'json', remaining: args };
}

export function parseCliInput(args: string[]): ParsedInput {
  const { format, remaining } = extractGlobalFormat(args);

  if (remaining.length === 0) {
    return { type: 'help', format };
  }

  const first = remaining[0];
  if (first === 'help' || first === '--help' || first === '-h') {
    const command = remaining[1] && !remaining[1].startsWith('-') ? remaining[1] : undefined;
    return { type: 'help', command, format };
  }

  const spec = getCommandSpec(first);
  if (!spec) {
    throw new Error(`Unknown command: ${first}. Run with --help to list commands.`);
  }

  if (remaining.includes('--help') || remaining.includes('-h')) {
    return { type: 'help', command: first, format };
  }

  const options: Record<string, string | number | boolean> = {};
  const knownFlags = new Map(spec.options.map(option => [option.flag, option]));

  for (let index = 1; index < remaining.length; index += 1) {
    const token = remaining[index];
    if (!token.startsWith('--')) {
      throw new Error(
        `Unexpected token: ${token}. Expected an option like --${spec.options[0]?.flag || 'option'}.`,
      );
    }

    const flag = token.slice(2);
    const optionSpec = knownFlags.get(flag);
    if (!optionSpec) {
      throw new Error(`Unknown option for ${spec.name}: --${flag}`);
    }

    if (optionSpec.type === 'boolean') {
      options[optionSpec.key] = true;
      continue;
    }

    const rawValue = remaining[index + 1];
    if (!rawValue || rawValue.startsWith('--')) {
      throw new Error(`Missing value for --${flag}`);
    }

    options[optionSpec.key] = optionSpec.type === 'number' ? parseNumber(rawValue, flag) : rawValue;
    index += 1;
  }

  spec.options.forEach(option => {
    if (option.required && options[option.key] === undefined) {
      throw new Error(`Missing required option for ${spec.name}: --${option.flag}`);
    }
  });

  return {
    type: 'command',
    command: spec.name,
    options,
    format,
  };
}
