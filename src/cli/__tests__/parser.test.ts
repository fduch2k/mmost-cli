import { parseCliInput } from '../parser';

describe('parseCliInput', () => {
  it('returns help for empty input', () => {
    expect(parseCliInput([])).toEqual({ type: 'help', format: 'json' });
  });

  it('parses a command with options', () => {
    const parsed = parseCliInput(['search-users', '--term', 'john']);
    expect(parsed).toEqual({
      type: 'command',
      command: 'search-users',
      options: { term: 'john' },
      format: 'json',
    });
  });

  it('parses numeric options', () => {
    const parsed = parseCliInput([
      'search-posts',
      '--terms',
      'release',
      '--page',
      '1',
      '--per-page',
      '20',
    ]);
    expect(parsed).toEqual({
      type: 'command',
      command: 'search-posts',
      options: { terms: 'release', page: 1, perPage: 20 },
      format: 'json',
    });
  });

  it('returns command help when --help is provided', () => {
    const parsed = parseCliInput(['get-users', '--help']);
    expect(parsed).toEqual({ type: 'help', command: 'get-users', format: 'json' });
  });

  it('throws on unknown command', () => {
    expect(() => parseCliInput(['bad-command'])).toThrow('Unknown command');
  });

  it('throws on missing required option', () => {
    expect(() => parseCliInput(['search-users'])).toThrow('Missing required option');
  });

  it('parses --human flag before command → format: human', () => {
    const parsed = parseCliInput(['--human', 'search-users', '--term', 'john']);
    expect(parsed).toEqual({
      type: 'command',
      command: 'search-users',
      options: { term: 'john' },
      format: 'human',
    });
  });

  it('parses --json flag after options → format: json', () => {
    const parsed = parseCliInput(['search-users', '--term', 'john', '--json']);
    expect(parsed).toEqual({
      type: 'command',
      command: 'search-users',
      options: { term: 'john' },
      format: 'json',
    });
  });

  it('parses --help with --human → human format help', () => {
    const parsed = parseCliInput(['--help', '--human']);
    expect(parsed).toEqual({ type: 'help', format: 'human' });
  });

  it('throws when both --json and --human are provided', () => {
    expect(() => parseCliInput(['--json', '--human'])).toThrow(
      'Cannot use both --json and --human',
    );
  });

  it('throws when command has both --json and --human', () => {
    expect(() => parseCliInput(['search-users', '--json', '--human', '--term', 'john'])).toThrow(
      'Cannot use both --json and --human',
    );
  });
});
