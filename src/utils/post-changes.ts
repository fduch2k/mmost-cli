import { Post } from '@mattermost/types/posts';

import { parsePastMoment } from './time-parser';

/**
 * What happened to a post between two cursors
 *
 * `updated` is a bump with no textual change — the server moved `update_at`
 * without touching `edit_at`. A reaction, a pin, or a reply added to/removed from
 * a thread all look identical from the REST API, so the cause is not reported
 */
export type ChangeEvent = 'created' | 'edited' | 'deleted' | 'updated';

export const CHANGE_EVENTS: ChangeEvent[] = ['created', 'edited', 'deleted', 'updated'];

/** Events a watch reports unless `--events` says otherwise; `updated` is opt-in because it is ambiguous */
export const DEFAULT_CHANGE_EVENTS: ChangeEvent[] = ['created', 'edited', 'deleted'];

/**
 * Opaque watch position
 *
 * `ts` is the highest `update_at` already reported. `ids` are the posts sitting on
 * exactly that millisecond, kept because `since` is exclusive: a sibling written to
 * the same millisecond after the previous read would be lost if the cursor were a
 * bare timestamp. Two posts really do share a millisecond routinely — editing a post
 * writes the live row and its archived copy with one `update_at`
 */
export type WatchCursor = {
  ts: number;
  ids: string[];
};

export type PostChange = {
  event: ChangeEvent;
  post_id: string;
  user_id: string;
  root_id: string;
  create_at: number;
  update_at: number;
  /** Empty for a deleted post — the server blanks the message on deletion */
  message: string;
};

const CURSOR_PATTERN = /^(\d+):([A-Za-z0-9,]*)$/;
const BARE_MILLIS_PATTERN = /^\d+$/;
/** Ten digits is a unix timestamp in seconds, the one length that is not read as milliseconds */
const UNIX_SECONDS_LENGTH = 10;

/**
 * Parse the `--since` value
 *
 * A cursor from a previous run is taken verbatim — the `<ts>:<id>,<id>` form and the
 * bare millisecond form both come back from the server and must round-trip untouched,
 * including the `0` an empty channel produces. Anything else is a moment a human
 * wrote, and is resolved by {@link parsePastMoment}; it carries no id list, so it
 * means "everything from this millisecond on, inclusive"
 */
export function parseCursor(raw: string, now: number = Date.now()): WatchCursor {
  const value = raw.trim();

  const cursor = CURSOR_PATTERN.exec(value);
  if (cursor) {
    return { ts: Number(cursor[1]), ids: cursor[2].split(',').filter(Boolean) };
  }

  if (BARE_MILLIS_PATTERN.test(value) && value.length !== UNIX_SECONDS_LENGTH) {
    return { ts: Number(value), ids: [] };
  }

  return { ts: parsePastMoment(value, '--since', now), ids: [] };
}

export function formatCursor(cursor: WatchCursor): string {
  return cursor.ids.length ? `${cursor.ts}:${cursor.ids.join(',')}` : `${cursor.ts}`;
}

/**
 * The `since` value to send for a given cursor
 *
 * One millisecond back, because the server applies `update_at > since` and the
 * cursor's own millisecond may still hold posts this watch has not seen. The
 * re-served boundary posts are dropped by their ids in {@link detectChanges}
 */
export function sinceParam(cursor: WatchCursor): number {
  return Math.max(1, cursor.ts - 1);
}

/**
 * A post the server returns only because editing archives the previous version
 *
 * The archived row carries `delete_at` and points at the live post through
 * `original_id`. Reporting it would turn every edit into a spurious deletion —
 * three of them when the post had been edited twice before
 */
function isEditArtifact(post: Post): boolean {
  return post.delete_at > 0 && Boolean(post.original_id);
}

/**
 * Whether a timestamp on a post falls outside what the cursor already covers
 *
 * A plain `>= cursor.ts` is not enough. A post created on exactly the cursor
 * millisecond and already reported is named in `cursor.ids`; when a later reply bumps
 * its `update_at` it comes back in the window, and comparing timestamps alone would
 * announce it as freshly created a second time
 */
function isBeyond(at: number, postId: string, cursor: WatchCursor): boolean {
  if (at <= 0) {
    return false;
  }
  if (at > cursor.ts) {
    return true;
  }
  return at === cursor.ts && !cursor.ids.includes(postId);
}

function classify(post: Post, cursor: WatchCursor): ChangeEvent {
  if (post.delete_at > 0) {
    return 'deleted';
  }
  if (isBeyond(post.create_at, post.id, cursor)) {
    return 'created';
  }
  if (isBeyond(post.edit_at, post.id, cursor)) {
    return 'edited';
  }
  return 'updated';
}

export type DetectOptions = {
  /** Keep only posts in this thread (the root itself plus its replies) */
  rootId?: string;
  /** Drop posts written by this user — an agent watching a thread it posts into would otherwise wake itself */
  excludeUserId?: string;
  events?: ChangeEvent[];
};

/**
 * Turn one `since` window into changes plus the next cursor
 *
 * The next cursor advances over every post in the window, including the ones
 * filtered out of the report: an edit artifact or a post from the excluded author
 * still moves the watch forward, otherwise the same window would be re-read forever
 */
export function detectChanges(
  posts: Post[],
  cursor: WatchCursor,
  options: DetectOptions = {},
): { changes: PostChange[]; cursor: WatchCursor } {
  const events = options.events ?? DEFAULT_CHANGE_EVENTS;
  const alreadyReported = new Set(cursor.ids);

  const fresh = posts.filter(post => {
    if (post.update_at < cursor.ts) {
      return false;
    }
    return !(post.update_at === cursor.ts && alreadyReported.has(post.id));
  });

  const changes = fresh
    .filter(post => !isEditArtifact(post))
    .filter(post => {
      if (!options.rootId) {
        return true;
      }
      return post.id === options.rootId || post.root_id === options.rootId;
    })
    .filter(post => post.user_id !== options.excludeUserId)
    .map(post => ({ post, event: classify(post, cursor) }))
    .filter(({ event }) => events.includes(event))
    .sort((a, b) => a.post.update_at - b.post.update_at)
    .map(({ post, event }) => ({
      event,
      post_id: post.id,
      user_id: post.user_id,
      root_id: post.root_id,
      create_at: post.create_at,
      update_at: post.update_at,
      message: post.message,
    }));

  return { changes, cursor: advance(fresh, cursor) };
}

function advance(fresh: Post[], cursor: WatchCursor): WatchCursor {
  const ts = fresh.reduce((max, post) => Math.max(max, post.update_at), cursor.ts);
  if (ts === cursor.ts) {
    // Nothing moved: keep the boundary ids, they are still the ones already reported
    const atBoundary = fresh.filter(post => post.update_at === ts).map(post => post.id);
    return { ts, ids: [...new Set([...cursor.ids, ...atBoundary])].sort() };
  }
  return {
    ts,
    ids: fresh
      .filter(post => post.update_at === ts)
      .map(post => post.id)
      .sort(),
  };
}

/**
 * Cursor covering a window only up to and including one of its changes
 *
 * `--follow` puts this on every line so a consumer that stops mid-window resumes at
 * the next change instead of skipping the rest of it. Posts the window filtered out
 * (edit artifacts, the watcher's own posts) are not listed and get re-served on
 * resume, which is harmless: the same filters drop them again
 */
export function cursorThrough(
  changes: { post_id: string; update_at: number | Date }[],
  index: number,
  windowCursor: string,
): string {
  if (index >= changes.length - 1) {
    return windowCursor;
  }
  const ts = asMillis(changes[index].update_at);
  const ids = changes
    .slice(0, index + 1)
    .filter(change => asMillis(change.update_at) === ts)
    .map(change => change.post_id)
    .sort();
  return formatCursor({ ts, ids });
}

function asMillis(value: number | Date): number {
  return value instanceof Date ? value.getTime() : value;
}

/**
 * Baseline cursor for a watch that was started without `--since`
 *
 * Taken from the newest posts the server returns rather than from the local clock:
 * client and server clocks differ (162 ms apart when this was measured), and a
 * cursor ahead of the server's clock silently swallows the next messages
 */
export function baselineCursor(posts: Post[]): WatchCursor {
  const ts = posts.reduce((max, post) => Math.max(max, post.update_at), 0);
  return {
    ts,
    ids: posts
      .filter(post => post.update_at === ts)
      .map(post => post.id)
      .sort(),
  };
}
