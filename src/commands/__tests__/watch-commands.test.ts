import { MattermostClient, PostChangeWindow } from '../../client/mattermost-client';
import { followPostChanges, planWatch, runWatchCommand } from '../watch-commands';

function change(postId: string, updateAt: number) {
  return {
    event: 'created' as const,
    post_id: postId,
    user_id: 'author',
    root_id: '',
    message: 'hi',
    create_at: new Date(updateAt),
    update_at: new Date(updateAt),
  };
}

/**
 * Client stub replaying a scripted sequence of windows
 * A window can be an Error, which the stub throws, so retry behaviour is testable
 */
function stubClient(windows: (PostChangeWindow | Error)[]) {
  const calls: (string | undefined)[] = [];
  const client = {
    readPostChanges: jest.fn(async ({ cursor }: { cursor?: { ts: number; ids: string[] } }) => {
      calls.push(cursor ? `${cursor.ts}` : undefined);
      const next = windows.shift();
      if (!next) {
        throw new Error('stub ran out of windows');
      }
      if (next instanceof Error) {
        throw next;
      }
      return next;
    }),
  } as unknown as MattermostClient;
  return { client, calls };
}

function capture() {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    writer: {
      stdout: { write: (v: string) => stdout.push(v) },
      stderr: { write: (v: string) => stderr.push(v) },
    },
    stdout,
    stderr,
  };
}

const quiet = (cursor: string): PostChangeWindow => ({ channel_id: 'c', cursor, changes: [] });

/**
 * Drive a watch to completion on a fake clock
 * The polls sleep for minutes of wall time, which the suite cannot afford to spend
 */
async function onFakeClock<T>(run: () => Promise<T>): Promise<T> {
  const pending = run();
  let settled = false;
  void pending.then(
    () => (settled = true),
    () => (settled = true),
  );
  for (let tick = 0; !settled && tick < 1000; tick += 1) {
    await jest.advanceTimersByTimeAsync(1000);
  }
  return pending;
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('planWatch', () => {
  it('requires a target', () => {
    expect(() => planWatch({})).toThrow(/one of --channel-id or --root-id/);
  });

  it('rejects two targets at once', () => {
    expect(() => planWatch({ channelId: 'c', rootId: 'r' })).toThrow(/mutually exclusive/);
  });

  it('rejects --wait together with --follow', () => {
    expect(() => planWatch({ channelId: 'c', since: '1', wait: true, follow: true })).toThrow(
      /mutually exclusive/,
    );
  });

  it('refuses to wait without a cursor, which would wait on unknown history', () => {
    expect(() => planWatch({ channelId: 'c', wait: true })).toThrow(
      /Missing required option: --since/,
    );
    expect(() => planWatch({ channelId: 'c', follow: true })).toThrow(
      /Missing required option: --since/,
    );
  });

  it('defaults to the unambiguous events and excludes own posts', () => {
    const plan = planWatch({ channelId: 'c' });
    expect(plan.events).toEqual(['created', 'edited', 'deleted']);
    expect(plan.includeSelf).toBe(false);
    expect(plan.intervalMs).toBe(15_000);
    expect(plan.timeoutMs).toBe(15 * 60_000);
  });

  it('validates --events', () => {
    expect(planWatch({ channelId: 'c', events: 'created,updated' }).events).toEqual([
      'created',
      'updated',
    ]);
    expect(() => planWatch({ channelId: 'c', events: 'reacted' })).toThrow(/Unknown --events/);
    expect(() => planWatch({ channelId: 'c', events: ' ' })).toThrow(/--events was empty/);
  });

  it('validates durations', () => {
    expect(() => planWatch({ channelId: 'c', interval: '15' })).toThrow(
      /Invalid value for --interval/,
    );
    expect(() => planWatch({ channelId: 'c', timeout: 'soon' })).toThrow(
      /Invalid value for --timeout/,
    );
  });
});

describe('runWatchCommand', () => {
  it('reads exactly one window without --wait', async () => {
    const { client } = stubClient([quiet('100')]);
    const result = await runWatchCommand(client, { channelId: 'c', since: '90' });
    expect(result).toEqual(quiet('100'));
    expect(client.readPostChanges).toHaveBeenCalledTimes(1);
  });

  it('polls until a window brings a change, carrying the cursor forward', async () => {
    const { client, calls } = stubClient([
      quiet('100'),
      quiet('110'),
      { channel_id: 'c', cursor: '120', changes: [change('p1', 120)] },
    ]);
    const result = await onFakeClock(() =>
      runWatchCommand(
        client,
        { channelId: 'c', since: '90', wait: true, interval: '1s' },
        capture().writer,
      ),
    );
    expect(result.changes).toHaveLength(1);
    expect(result.cursor).toBe('120');
    expect(calls).toEqual(['90', '100', '110']);
  });

  it('returns timed_out with the unchanged cursor instead of failing', async () => {
    const { client } = stubClient([quiet('100'), quiet('100')]);
    const result = await onFakeClock(() =>
      runWatchCommand(
        client,
        { channelId: 'c', since: '100', wait: true, interval: '1s', timeout: '2s' },
        capture().writer,
      ),
    );
    expect(result.timed_out).toBe(true);
    expect(result.cursor).toBe('100');
    expect(result.changes).toEqual([]);
  });

  it('survives a failed poll and keeps waiting', async () => {
    const { client } = stubClient([
      new Error('socket hang up'),
      { channel_id: 'c', cursor: '120', changes: [change('p1', 120)] },
    ]);
    const cap = capture();
    const result = await onFakeClock(() =>
      runWatchCommand(
        client,
        { channelId: 'c', since: '90', wait: true, interval: '1s' },
        cap.writer,
      ),
    );
    expect(result.changes).toHaveLength(1);
    expect(cap.stderr.join('')).toContain('poll failed (1/5)');
  });

  it('gives up after five consecutive failures', async () => {
    const { client } = stubClient(
      Array.from({ length: 5 }, () => new Error('network is unreachable')),
    );
    await expect(
      onFakeClock(() =>
        runWatchCommand(
          client,
          { channelId: 'c', since: '90', wait: true, interval: '1s' },
          capture().writer,
        ),
      ),
    ).rejects.toThrow(/network is unreachable/);
  });

  it('re-reads after a failure without losing the cursor it had', async () => {
    const { client, calls } = stubClient([
      quiet('100'),
      new Error('timed out'),
      { channel_id: 'c', cursor: '130', changes: [change('p1', 130)] },
    ]);
    await onFakeClock(() =>
      runWatchCommand(
        client,
        { channelId: 'c', since: '90', wait: true, interval: '1s' },
        capture().writer,
      ),
    );
    expect(calls).toEqual(['90', '100', '100']);
  });
});

describe('followPostChanges', () => {
  it('writes one NDJSON line per change and stops at an explicit timeout', async () => {
    const { client } = stubClient([
      { channel_id: 'c', cursor: '120', changes: [change('p1', 110), change('p2', 120)] },
      quiet('120'),
    ]);
    const cap = capture();
    await onFakeClock(() =>
      followPostChanges(
        client,
        { channelId: 'c', since: '100', follow: true, interval: '1s', timeout: '2s' },
        cap.writer,
      ),
    );
    const lines = cap.stdout
      .join('')
      .trim()
      .split('\n')
      .map(l => JSON.parse(l));
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ post_id: 'p1', event: 'created', channel_id: 'c' });
  });

  it('gives each line a cursor that resumes after that change, not after the window', async () => {
    const { client } = stubClient([
      { channel_id: 'c', cursor: '120', changes: [change('p1', 110), change('p2', 120)] },
      quiet('120'),
    ]);
    const cap = capture();
    await onFakeClock(() =>
      followPostChanges(
        client,
        { channelId: 'c', since: '100', follow: true, interval: '1s', timeout: '2s' },
        cap.writer,
      ),
    );
    const lines = cap.stdout
      .join('')
      .trim()
      .split('\n')
      .map(l => JSON.parse(l));
    expect(lines[0].cursor).toBe('110:p1');
    expect(lines[1].cursor).toBe('120');
  });

  it('names the watched thread on every line', async () => {
    const { client } = stubClient([
      { channel_id: 'c', root_id: 'r', cursor: '120', changes: [change('p1', 120)] },
      quiet('120'),
    ]);
    const cap = capture();
    await onFakeClock(() =>
      followPostChanges(
        client,
        { rootId: 'r', since: '100', follow: true, interval: '1s', timeout: '2s' },
        cap.writer,
      ),
    );
    expect(JSON.parse(cap.stdout.join('').trim())).toMatchObject({ root_id_watched: 'r' });
  });
});
