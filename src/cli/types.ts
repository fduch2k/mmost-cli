export type OutputFormat = 'json' | 'human';

export type OptionType = 'string' | 'number' | 'boolean';

export type CommandOptionSpec = {
  key: string;
  flag: string;
  type: OptionType;
  required?: boolean;
  description: string;
};

export type CommandSpec = {
  name: string;
  description: string;
  options: CommandOptionSpec[];
  examples: string[];
};

export type ParsedCommand = {
  type: 'command';
  command: string;
  options: Record<string, string | number | boolean>;
  format: OutputFormat;
};

export type ParsedHelp = {
  type: 'help';
  command?: string;
  format: OutputFormat;
};

export type ParsedInput = ParsedCommand | ParsedHelp;
