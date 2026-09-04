import { MattermostClient, PostChangeWindow } from '../client/mattermost-client';
import {
  CHANGE_EVENTS,
  ChangeEvent,
  DEFAULT_CHANGE_EVENTS,
  cursorThrough,
  parseCursor,
} from '../utils/post-changes';
import { parseDuration } from '../utils/time-parser';

export type WatchCommandOptions = {
  channelId?: string;
  rootId?: string;
  since?: string;
  events?: string;
  includeSelf?: boolean;
  wait?: boolean;
  follow?: boolean;
  interval?: string;
  timeout?: string;
};

export type WatchWriter = {
  stdout: { write: (message: string) => unknown };
  stderr: { write: (message: string) => unknown };
};

export type WatchResult = PostChangeWindow & { timed_out?: boolean };

const DEFAULT_INTERVAL = '15s';
const DEFAULT_TIMEOUT = '15m';

/**
 * Consecutive failed polls tolerated before a wait or a follow gives up
 * A single failure is normal — a laptop sleeps, a proxy resets — and must not end a
 * watch that is meant to survive the night
 */
const MAX_CONSECUTIVE_FAILURES = 5;

type WatchPlan = {
  channelId?: string;
  rootId?: string;
  cursor?: string;
  events: ChangeEvent[];
  includeSelf: boolean;
  wait: boolean;
  follow: boolean;
  intervalMs: number;
  timeoutMs: number;
};

export function planWatch(options: WatchCommandOptions): WatchPlan {
  if (!options.channelId && !options.rootId) {
    throw new Error('Missing required option: one of --channel-id or --root-id');
  }
  if (options.channelId && options.rootId) {
    throw new Error('--channel-id and --root-id are mutually exclusive');
  }
  if (options.wait && options.follow) {
    throw new Error('--wait and --follow are mutually exclusive');
  }
  if ((options.wait || options.follow) && !options.since) {
    throw new Error(
      'Missing required option: --since. Run watch-posts once without --wait/--follow to get a baseline cursor first',
    );
  }

  return {
    channelId: options.channelId,
    rootId: options.rootId,
    cursor: options.since,
    events: parseEvents(options.events),
    includeSelf: Boolean(options.includeSelf),
    wait: Boolean(options.wait),
    follow: Boolean(options.follow),
    intervalMs: parseDuration(options.interval ?? DEFAULT_INTERVAL, '--interval'),
    timeoutMs: parseDuration(options.timeout ?? DEFAULT_TIMEOUT, '--timeout'),
  };
}

function parseEvents(raw?: string): ChangeEvent[] {
  if (raw === undefined) {
    return DEFAULT_CHANGE_EVENTS;
  }
  const requested = raw
    .split(',')
    .map(part => part.trim())
    .filter(Boolean);
  if (!requested.length) {
    throw new Error('--events was empty; omit it to use the default, or name at least one event');
  }
  const unknown = requested.filter(event => !CHANGE_EVENTS.includes(event as ChangeEvent));
  if (unknown.length) {
    throw new Error(
      `Unknown --events value(s): ${unknown.join(', ')}. Supported: ${CHANGE_EVENTS.join(', ')}`,
    );
  }
  return requested as ChangeEvent[];
}

function readWindow(client: MattermostClient, plan: WatchPlan, cursor?: string) {
  return client.readPostChanges({
    channelId: plan.channelId,
    rootId: plan.rootId,
    cursor: cursor ? parseCursor(cursor) : undefined,
    events: plan.events,
    includeSelf: plan.includeSelf,
  });
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Poll until `handle` says to stop, the deadline passes, or the server keeps failing
 *
 * Errors are reported and retried rather than thrown: a watch that dies on the first
 * timeout is indistinguishable, from outside, from a quiet channel
 */
async function poll(
  client: MattermostClient,
  plan: WatchPlan,
  writer: WatchWriter,
  deadline: number,
  handle: (window: PostChangeWindow) => boolean,
): Promise<WatchResult | undefined> {
  let cursor = plan.cursor;
  let failures = 0;
  let last: PostChangeWindow | undefined;

  for (;;) {
    try {
      const window = await readWindow(client, plan, cursor);
      failures = 0;
      cursor = window.cursor;
      last = window;
      if (handle(window)) {
        return window;
      }
    } catch (error) {
      failures += 1;
      if (failures >= MAX_CONSECUTIVE_FAILURES) {
        throw error;
      }
      writer.stderr.write(
        `watch-posts: poll failed (${failures}/${MAX_CONSECUTIVE_FAILURES}), retrying: ${errorText(error)}\n`,
      );
    }
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      return last ? { ...last, timed_out: true } : undefined;
    }
    await sleep(Math.min(plan.intervalMs, remaining));
  }
}

/**
 * One-shot and `--wait` modes
 *
 * Without `--wait` this reads exactly one window and returns — the primitive the
 * other modes are built on. With `--wait` it keeps reading until a window brings a
 * change or the timeout expires. A timeout is a normal result carrying the unchanged
 * cursor, not an error, so the caller can pass it straight back in
 */
export async function runWatchCommand(
  client: MattermostClient,
  options: WatchCommandOptions,
  writer: WatchWriter = process,
): Promise<WatchResult> {
  const plan = planWatch(options);

  if (!plan.wait) {
    return readWindow(client, plan, plan.cursor);
  }

  const result = await poll(
    client,
    plan,
    writer,
    Date.now() + plan.timeoutMs,
    window => window.changes.length > 0,
  );
  // `poll` only returns undefined when the very first attempt outlives the deadline
  return result ?? { ...(await readWindow(client, plan, plan.cursor)), timed_out: true };
}

/**
 * `--follow` mode: one NDJSON line per change on stdout, forever
 *
 * Each line carries the cursor as of that change rather than as of its window, so a
 * consumer that dies halfway through a busy window resumes without skipping the rest
 */
export async function followPostChanges(
  client: MattermostClient,
  options: WatchCommandOptions,
  writer: WatchWriter = process,
): Promise<number> {
  const plan = planWatch(options);
  // A stream runs until it is killed; the default timeout applies to --wait only
  const deadline = options.timeout ? Date.now() + plan.timeoutMs : Infinity;

  await poll(client, plan, writer, deadline, window => {
    window.changes.forEach((change, index) => {
      writer.stdout.write(
        `${JSON.stringify({
          ...change,
          channel_id: window.channel_id,
          ...(window.root_id ? { root_id_watched: window.root_id } : {}),
          cursor: cursorThrough(window.changes, index, window.cursor),
        })}\n`,
      );
    });
    return false;
  });
  return 0;
}
