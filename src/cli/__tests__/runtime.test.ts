import { runCli } from '../runtime';

function createOutputCapture() {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    output: {
      stdout: { write: (value: string) => stdout.push(value) },
      stderr: { write: (value: string) => stderr.push(value) },
    },
    stdout,
    stderr,
  };
}

describe('runCli', () => {
  it('prints JSON help by default (--help with no format flag)', async () => {
    const capture = createOutputCapture();
    const code = await runCli(['--help'], capture.output);
    expect(code).toBe(0);
    const out = capture.stdout.join('');
    expect(out).toContain('"binary"');
    expect(out).toContain('"commands"');
  });

  it('prints text help when --help --human is provided', async () => {
    const capture = createOutputCapture();
    const code = await runCli(['--help', '--human'], capture.output);
    expect(code).toBe(0);
    expect(capture.stdout.join('')).toContain('Usage:');
  });

  it('runs command and prints json output', async () => {
    const capture = createOutputCapture();
    const createClient = async () =>
      ({
        searchUsers: jest.fn().mockResolvedValue([{ username: 'john' }]),
      }) as never;

    const code = await runCli(['search-users', '--term', 'john'], capture.output, { createClient });
    expect(code).toBe(0);
    expect(capture.stdout.join('')).toContain('john');
  });

  it('runs command with --human and prints markdown output', async () => {
    const capture = createOutputCapture();
    const createClient = async () =>
      ({
        searchUsers: jest.fn().mockResolvedValue([
          {
            id: 'u1',
            username: 'john',
            first_name: 'John',
            last_name: 'Doe',
            email: 'john@test.com',
          },
        ]),
      }) as never;

    const code = await runCli(['search-users', '--term', 'john', '--human'], capture.output, {
      createClient,
    });
    expect(code).toBe(0);
    const out = capture.stdout.join('');
    expect(out).toMatch(/##|^\|/m);
  });

  it('prints JSON error to stderr in default (json) mode', async () => {
    const capture = createOutputCapture();
    const code = await runCli(['unknown'], capture.output);
    expect(code).toBe(1);
    const err = capture.stderr.join('');
    expect(err).toContain('"error"');
    expect(err).not.toMatch(/^Error:/m);
  });

  it('prints text error to stderr in --human mode', async () => {
    const capture = createOutputCapture();
    const code = await runCli(['unknown', '--human'], capture.output);
    expect(code).toBe(1);
    const err = capture.stderr.join('');
    expect(err).toMatch(/^Error:/m);
    expect(err).not.toContain('"error"');
  });
});
