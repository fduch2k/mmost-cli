import { Post } from '@mattermost/types/posts';

import {
  baselineCursor,
  detectChanges,
  formatCursor,
  parseCursor,
  sinceParam,
} from '../post-changes';

/**
 * Fixtures are the records a real Loop server returned when the `since` semantics
 * were probed; README "Watching for new messages" describes what they mean
 */
function post(overrides: Partial<Post> & { id: string }): Post {
  return {
    create_at: 1000,
    update_at: 1000,
    edit_at: 0,
    delete_at: 0,
    is_pinned: false,
    user_id: 'author',
    channel_id: 'chan',
    root_id: '',
    original_id: '',
    message: 'hello',
    type: '',
    props: {},
    hashtags: '',
    pending_post_id: '',
    reply_count: 0,
    metadata: {},
    ...overrides,
  } as Post;
}

describe('parseCursor / formatCursor', () => {
  it('round-trips the full form', () => {
    expect(formatCursor(parseCursor('1788525201548:abc,def'))).toBe('1788525201548:abc,def');
  });

  it('accepts a bare timestamp', () => {
    expect(parseCursor('1788525201548')).toEqual({ ts: 1788525201548, ids: [] });
  });

  it('round-trips the cursor an empty channel produces', () => {
    expect(parseCursor('0')).toEqual({ ts: 0, ids: [] });
  });

  it('rejects anything that is neither a cursor nor a moment', () => {
    expect(() => parseCursor('yesterday')).toThrow(/Invalid value for --since/);
    expect(() => parseCursor('')).toThrow(/Invalid value for --since/);
    expect(() => parseCursor('+2h')).toThrow(/Invalid value for --since/);
  });

  describe('human forms', () => {
    const now = Date.parse('2026-09-04T12:00:00Z');

    it('accepts a relative offset into the past', () => {
      expect(parseCursor('-2h', now)).toEqual({ ts: now - 7_200_000, ids: [] });
      expect(parseCursor('-30m', now)).toEqual({ ts: now - 1_800_000, ids: [] });
      expect(parseCursor('-1w', now)).toEqual({ ts: now - 604_800_000, ids: [] });
    });

    it('accepts ISO-8601, with an offset or in local time', () => {
      expect(parseCursor('2026-09-04T09:30:00Z', now).ts).toBe(Date.parse('2026-09-04T09:30:00Z'));
      expect(parseCursor('2026-09-04T09:30:00+03:00', now).ts).toBe(
        Date.parse('2026-09-04T09:30:00+03:00'),
      );
    });

    it('reads ten digits as unix seconds and thirteen as milliseconds', () => {
      const seconds = Math.floor(now / 1000);
      expect(parseCursor(String(seconds), now).ts).toBe(seconds * 1000);
      expect(parseCursor(String(now), now).ts).toBe(now);
    });

    it('rejects a moment in the future, which would look like a quiet channel', () => {
      expect(() => parseCursor('2026-09-05T09:30:00Z', now)).toThrow(/in the future/);
    });

    it('tolerates the clock skew between client and server', () => {
      // A cursor derived from server data can sit a few hundred ms ahead of the local clock
      expect(parseCursor(new Date(now + 500).toISOString(), now).ts).toBe(now + 500);
    });

    it('never applies the future check to a server cursor', () => {
      // Cursors must round-trip untouched, whatever the local clock says
      expect(parseCursor('1788525201548:abc', 0)).toEqual({ ts: 1788525201548, ids: ['abc'] });
      expect(parseCursor('1788525201548', 0).ts).toBe(1788525201548);
    });
  });

  it('asks the server for one millisecond before the cursor, because since is exclusive', () => {
    expect(sinceParam({ ts: 1788525201548, ids: [] })).toBe(1788525201547);
    expect(sinceParam({ ts: 0, ids: [] })).toBe(1);
  });
});

describe('detectChanges', () => {
  const cursor = { ts: 2000, ids: [] };

  it('reports a post created after the cursor', () => {
    const { changes } = detectChanges(
      [post({ id: 'new', create_at: 3000, update_at: 3000 })],
      cursor,
    );
    expect(changes).toMatchObject([{ event: 'created', post_id: 'new' }]);
  });

  it('reports an older post that was edited', () => {
    const edited = post({ id: 'old', create_at: 500, update_at: 3000, edit_at: 3000 });
    const { changes } = detectChanges([edited], cursor);
    expect(changes).toMatchObject([{ event: 'edited', post_id: 'old' }]);
  });

  it('reports a real deletion', () => {
    const deleted = post({
      id: 'gone',
      create_at: 500,
      update_at: 3000,
      delete_at: 3000,
      message: '',
    });
    const { changes } = detectChanges([deleted], cursor);
    expect(changes).toMatchObject([{ event: 'deleted', post_id: 'gone' }]);
  });

  it('reports a real deletion of a post that had been edited', () => {
    // The live row keeps original_id empty even after edits, so the deletion survives the artifact filter
    const deleted = post({
      id: 'was7t4',
      create_at: 1788525397845,
      update_at: 1788525399460,
      edit_at: 1788525399345,
      delete_at: 1788525399460,
      message: '',
    });
    const { changes } = detectChanges([deleted], { ts: 1788525398051, ids: [] });
    expect(changes).toMatchObject([{ event: 'deleted', post_id: 'was7t4' }]);
  });

  it('drops the archived copies an edit leaves behind', () => {
    // One delete of a twice-edited post came back as three records: two artifacts, one deletion
    const window = [
      post({
        id: 'xjodij',
        create_at: 1788525397845,
        update_at: 1788525398051,
        delete_at: 1788525398051,
        original_id: 'was7t4',
        message: '',
      }),
      post({
        id: 'n6qzwp',
        create_at: 1788525397845,
        update_at: 1788525399345,
        edit_at: 1788525398051,
        delete_at: 1788525399345,
        original_id: 'was7t4',
        message: '',
      }),
      post({
        id: 'was7t4',
        create_at: 1788525397845,
        update_at: 1788525399460,
        edit_at: 1788525399345,
        delete_at: 1788525399460,
        message: '',
      }),
    ];
    const { changes } = detectChanges(window, { ts: 1788525398051, ids: [] });
    expect(changes).toEqual([expect.objectContaining({ event: 'deleted', post_id: 'was7t4' })]);
  });

  it('calls a bump with no edit an update, and withholds it by default', () => {
    // A reaction moved update_at while edit_at stayed 0
    const reacted = post({ id: 'reacted', create_at: 500, update_at: 3000, edit_at: 0 });
    expect(detectChanges([reacted], cursor).changes).toEqual([]);
    expect(detectChanges([reacted], cursor, { events: ['updated'] }).changes).toMatchObject([
      { event: 'updated', post_id: 'reacted' },
    ]);
  });

  it('does not re-report the posts sitting on the cursor millisecond', () => {
    const boundary = post({ id: 'seen', create_at: 2000, update_at: 2000 });
    const sibling = post({ id: 'sibling', create_at: 2000, update_at: 2000 });
    const { changes } = detectChanges([boundary, sibling], { ts: 2000, ids: ['seen'] });
    expect(changes).toMatchObject([{ post_id: 'sibling' }]);
  });

  it('keeps a sibling written to the cursor millisecond after the previous read', () => {
    const first = detectChanges([post({ id: 'a', create_at: 2500, update_at: 2500 })], cursor);
    expect(formatCursor(first.cursor)).toBe('2500:a');
    const second = detectChanges(
      [
        post({ id: 'a', create_at: 2500, update_at: 2500 }),
        post({ id: 'b', create_at: 2500, update_at: 2500 }),
      ],
      first.cursor,
    );
    expect(second.changes).toMatchObject([{ post_id: 'b' }]);
    expect(formatCursor(second.cursor)).toBe('2500:a,b');
  });

  it('leaves the cursor alone when the window brought nothing', () => {
    const { changes, cursor: next } = detectChanges([], { ts: 2000, ids: ['seen'] });
    expect(changes).toEqual([]);
    expect(formatCursor(next)).toBe('2000:seen');
  });

  it('advances over posts it filtered out, so the window is not re-read forever', () => {
    const own = post({ id: 'mine', create_at: 3000, update_at: 3000, user_id: 'me' });
    const { changes, cursor: next } = detectChanges([own], cursor, { excludeUserId: 'me' });
    expect(changes).toEqual([]);
    expect(formatCursor(next)).toBe('3000:mine');
  });

  it('keeps the thread root and its replies when watching a thread', () => {
    const window = [
      post({ id: 'root', create_at: 500, update_at: 3000 }),
      post({ id: 'reply', create_at: 3000, update_at: 3000, root_id: 'root' }),
      post({ id: 'elsewhere', create_at: 3000, update_at: 3000 }),
      post({ id: 'other-thread', create_at: 3000, update_at: 3000, root_id: 'nope' }),
    ];
    const { changes } = detectChanges(window, cursor, {
      rootId: 'root',
      events: ['created', 'updated'],
    });
    expect(changes.map(c => c.post_id).sort()).toEqual(['reply', 'root']);
  });

  it('does not re-announce a known post as created when a reply bumps it', () => {
    // A thread root whose create_at is the baseline millisecond: adding a reply moves its
    // update_at, so it returns in the window. Timestamps alone would call it created again
    const root = post({ id: 'root', create_at: 2000, update_at: 4000 });
    const reply = post({ id: 'reply', create_at: 4000, update_at: 4000, root_id: 'root' });
    const { changes } = detectChanges(
      [root, reply],
      { ts: 2000, ids: ['root'] },
      {
        rootId: 'root',
        events: ['created', 'edited', 'deleted', 'updated'],
      },
    );
    expect(changes).toMatchObject([
      { event: 'updated', post_id: 'root' },
      { event: 'created', post_id: 'reply' },
    ]);
  });

  it('still calls a same-millisecond sibling created, since the cursor never covered it', () => {
    const sibling = post({ id: 'sibling', create_at: 2000, update_at: 2000 });
    const { changes } = detectChanges([sibling], { ts: 2000, ids: ['other'] });
    expect(changes).toMatchObject([{ event: 'created', post_id: 'sibling' }]);
  });

  it('calls the first post in an empty channel created, not edited', () => {
    // baselineCursor returns ts 0 for a channel with no posts, where edit_at 0 would
    // otherwise compare equal to the cursor
    const first = post({ id: 'first', create_at: 3000, update_at: 3000, edit_at: 0 });
    const { changes } = detectChanges([first], { ts: 0, ids: [] });
    expect(changes).toMatchObject([{ event: 'created', post_id: 'first' }]);
  });

  it('sorts changes oldest first', () => {
    const window = [
      post({ id: 'late', create_at: 5000, update_at: 5000 }),
      post({ id: 'early', create_at: 3000, update_at: 3000 }),
    ];
    const { changes } = detectChanges(window, cursor);
    expect(changes.map(c => c.post_id)).toEqual(['early', 'late']);
  });
});

describe('baselineCursor', () => {
  it('takes the newest update_at the server reported, not the local clock', () => {
    const window = [
      post({ id: 'a', update_at: 1000 }),
      post({ id: 'c', update_at: 3000 }),
      post({ id: 'b', update_at: 3000 }),
    ];
    expect(formatCursor(baselineCursor(window))).toBe('3000:b,c');
  });

  it('handles an empty channel', () => {
    expect(formatCursor(baselineCursor([]))).toBe('0');
  });
});
