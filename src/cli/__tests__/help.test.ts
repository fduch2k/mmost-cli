import { getHelpJson, getHelpText } from '../help';

describe('help', () => {
  it('returns global text help', () => {
    const help = getHelpText();
    expect(help).toContain('Usage:');
    expect(help).toContain('Commands:');
  });

  it('returns command text help', () => {
    const help = getHelpText('search-users');
    expect(help).toContain('Command: search-users');
    expect(help).toContain('--term');
  });

  it('returns machine-readable json help', () => {
    const help = getHelpJson('search-users');
    expect(help.commands).toHaveLength(1);
    expect(help.commands[0].name).toBe('search-users');
    expect(help.commands[0].arguments[0].name).toBe('term');
  });

  it('command text help mentions --human for human-readable mode', () => {
    const help = getHelpText('search-users');
    expect(help).toContain('--human');
  });

  it('global json help includes binary field', () => {
    const help = getHelpJson();
    expect(help.binary).toBe('mmost');
    expect(help.commands.length).toBeGreaterThan(0);
    expect(help.env).toBeDefined();
  });
});
