function escapeCell(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  const str =
    value instanceof Date
      ? value.toISOString()
      : typeof value === 'object'
        ? JSON.stringify(value)
        : String(value);
  return str.replace(/\|/g, '\\|');
}

function truncate(value: unknown, maxLen: number): string {
  const str = escapeCell(value);
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

function dateOrDash(value: unknown): string {
  if (!value) return '-';
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function str(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

export function formatUserMarkdown(user: object): string {
  const u = user as Record<string, unknown>;
  const status = u.delete_at ? `deleted (${dateOrDash(u.delete_at)})` : 'active';

  return [
    `## User: @${str(u.username)}`,
    '',
    '| Field      | Value |',
    '|------------|-------|',
    `| ID         | ${escapeCell(u.id)} |`,
    `| Username   | @${escapeCell(u.username)} |`,
    `| First Name | ${escapeCell(u.first_name)} |`,
    `| Last Name  | ${escapeCell(u.last_name)} |`,
    `| Email      | ${escapeCell(u.email)} |`,
    `| Status     | ${escapeCell(status)} |`,
    `| Created    | ${dateOrDash(u.create_at)} |`,
    '',
  ].join('\n');
}

export function formatUsersMarkdown(users: object[]): string {
  const lines: string[] = [
    `## Users (${users.length} found)`,
    '',
    '| Username | ID | First Name | Last Name | Email |',
    '|----------|----|------------|-----------|-------|',
  ];

  for (const item of users) {
    const u = item as Record<string, unknown>;
    lines.push(
      `| @${truncate(u.username, 40)} | ${truncate(u.id, 40)} | ${escapeCell(u.first_name)} | ${escapeCell(u.last_name)} | ${truncate(u.email, 40)} |`,
    );
  }

  lines.push('');
  return lines.join('\n');
}

export function formatChannelMarkdown(channel: object): string {
  const c = channel as Record<string, unknown>;

  return [
    `## Channel: ${str(c.display_name)}`,
    '',
    '| Field        | Value |',
    '|--------------|-------|',
    `| ID           | ${escapeCell(c.id)} |`,
    `| Name         | ${escapeCell(c.name)} |`,
    `| Display Name | ${escapeCell(c.display_name)} |`,
    `| Type         | ${escapeCell(c.type)} |`,
    `| Purpose      | ${escapeCell(c.purpose)} |`,
    `| Created      | ${dateOrDash(c.create_at)} |`,
    '',
  ].join('\n');
}

export function formatChannelsMarkdown(channels: object[]): string {
  const lines: string[] = [
    `## Channels (${channels.length} found)`,
    '',
    '| Name | Display Name | Type | ID |',
    '|------|--------------|------|----|',
  ];

  for (const item of channels) {
    const c = item as Record<string, unknown>;
    lines.push(
      `| ${truncate(c.name, 40)} | ${truncate(c.display_name, 40)} | ${escapeCell(c.type)} | ${truncate(c.id, 40)} |`,
    );
  }

  lines.push('');
  return lines.join('\n');
}

export function formatPostMarkdown(post: object): string {
  const p = post as Record<string, unknown>;

  return [
    '## Post',
    '',
    '| Field     | Value |',
    '|-----------|-------|',
    `| ID        | ${escapeCell(p.id)} |`,
    `| Channel   | ${escapeCell(p.channel_id)} |`,
    `| Author    | ${escapeCell(p.user_id)} |`,
    `| Message   | ${truncate(p.message, 80)} |`,
    `| Created   | ${dateOrDash(p.create_at)} |`,
    `| Root Post | ${p.root_id ? escapeCell(p.root_id) : '-'} |`,
    '',
  ].join('\n');
}

export function formatPostListMarkdown(postList: object): string {
  const pl = postList as Record<string, unknown>;
  const order = Array.isArray(pl.order) ? (pl.order as string[]) : [];
  const posts = (pl.posts ?? {}) as Record<string, Record<string, unknown>>;

  const lines: string[] = [
    `## Posts (${order.length} posts, ordered)`,
    '',
    '| ID | Author | Message | Channel | Created |',
    '|----|--------|---------|---------|---------|',
  ];

  for (const postId of order) {
    const p = posts[postId];
    if (!p) continue;
    lines.push(
      `| ${truncate(p.id ?? postId, 40)} | ${truncate(p.user_id, 40)} | ${truncate(p.message, 80)} | ${truncate(p.channel_id, 40)} | ${dateOrDash(p.create_at)} |`,
    );
  }

  lines.push('');
  return lines.join('\n');
}

function repeatCell(post: Record<string, unknown>): string {
  const days = post.days_of_week;
  if (Array.isArray(days) && days.length > 0) {
    return `weekly: ${days.join(', ')}`;
  }
  return 'no';
}

export function formatScheduledPostMarkdown(post: object): string {
  const p = post as Record<string, unknown>;

  return [
    '## Scheduled Post',
    '',
    '| Field       | Value |',
    '|-------------|-------|',
    `| ID          | ${escapeCell(p.id)} |`,
    `| Channel     | ${escapeCell(p.channel_id)} |`,
    `| Author      | ${escapeCell(p.user_id)} |`,
    `| Message     | ${truncate(p.message, 80)} |`,
    `| Scheduled   | ${dateOrDash(p.scheduled_at)} |`,
    `| Repeat      | ${repeatCell(p)} |`,
    `| Root Post   | ${p.root_id ? escapeCell(p.root_id) : '-'} |`,
    `| Processed   | ${dateOrDash(p.processed_at)} |`,
    `| Error       | ${p.error_code ? escapeCell(p.error_code) : '-'} |`,
    `| Backend     | ${p.backend ? escapeCell(p.backend) : '-'} |`,
    '',
  ].join('\n');
}

export function formatScheduledPostsMarkdown(posts: object[]): string {
  const lines: string[] = [
    `## Scheduled Posts (${posts.length} pending)`,
    '',
    '| Scheduled | ID | Channel | Message | Repeat | Error |',
    '|-----------|----|---------|---------|--------|-------|',
  ];

  for (const item of posts) {
    const p = item as Record<string, unknown>;
    lines.push(
      `| ${dateOrDash(p.scheduled_at)} | ${truncate(p.id, 40)} | ${truncate(p.channel_id, 40)} | ${truncate(p.message, 60)} | ${repeatCell(p)} | ${p.error_code ? escapeCell(p.error_code) : '-'} |`,
    );
  }

  lines.push('');
  return lines.join('\n');
}

export function formatReactionMarkdown(reaction: object): string {
  const r = reaction as Record<string, unknown>;

  return [
    '## Reaction',
    '',
    '| Field   | Value |',
    '|---------|-------|',
    `| Emoji   | :${escapeCell(r.emoji_name)}: |`,
    `| Post    | ${escapeCell(r.post_id)} |`,
    `| User    | ${escapeCell(r.user_id)} |`,
    `| Created | ${dateOrDash(r.create_at)} |`,
    '',
  ].join('\n');
}

export function formatReactionsMarkdown(reactions: object[]): string {
  const lines: string[] = [
    `## Reactions (${reactions.length} reactions)`,
    '',
    '| Emoji | User ID | Post ID | Created |',
    '|-------|---------|---------|---------|',
  ];

  for (const item of reactions) {
    const r = item as Record<string, unknown>;
    lines.push(
      `| :${escapeCell(r.emoji_name)}: | ${truncate(r.user_id, 40)} | ${truncate(r.post_id, 40)} | ${dateOrDash(r.create_at)} |`,
    );
  }

  lines.push('');
  return lines.join('\n');
}

export function formatStatusMarkdown(data: object): string {
  return [
    '## Success',
    '',
    'Operation completed successfully.',
    '',
    '```json',
    JSON.stringify(data, null, 2),
    '```',
    '',
  ].join('\n');
}

function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

function isArray(value: unknown): value is object[] {
  return Array.isArray(value);
}

function isPostList(value: unknown): value is object {
  return (
    isObject(value) &&
    'order' in value &&
    'posts' in value &&
    Array.isArray((value as Record<string, unknown>).order)
  );
}

export function formatMarkdown(data: unknown, command: string): string {
  switch (command) {
    case 'get-me':
      return isObject(data) && !isArray(data)
        ? formatUserMarkdown(data)
        : formatStatusMarkdown(isObject(data) ? data : { result: data });

    case 'get-users':
    case 'search-users':
      if (isArray(data)) return formatUsersMarkdown(data);
      if (isObject(data)) return formatUserMarkdown(data);
      return formatStatusMarkdown({ result: data });

    case 'search-channels':
    case 'get-channels':
    case 'get-my-channels':
      if (isArray(data)) return formatChannelsMarkdown(data);
      if (isObject(data)) return formatChannelMarkdown(data);
      return formatStatusMarkdown({ result: data });

    case 'search-posts':
    case 'get-posts-unread':
    case 'get-posts-thread':
    case 'get-posts-pinned':
      if (isPostList(data)) return formatPostListMarkdown(data);
      if (isArray(data)) {
        const posts = data as Array<Record<string, unknown>>;
        const order = posts.map(p => String(p.id ?? ''));
        const postsMap: Record<string, Record<string, unknown>> = {};
        for (const p of posts) {
          postsMap[String(p.id ?? '')] = p;
        }
        return formatPostListMarkdown({ order, posts: postsMap });
      }
      if (isObject(data)) return formatPostMarkdown(data);
      return formatStatusMarkdown({ result: data });

    case 'get-posts':
      if (isArray(data)) {
        const posts = data as Array<Record<string, unknown>>;
        const order = posts.map(p => String(p.id ?? ''));
        const postsMap: Record<string, Record<string, unknown>> = {};
        for (const p of posts) {
          postsMap[String(p.id ?? '')] = p;
        }
        return formatPostListMarkdown({ order, posts: postsMap });
      }
      if (isPostList(data)) return formatPostListMarkdown(data);
      if (isObject(data)) return formatPostMarkdown(data);
      return formatStatusMarkdown({ result: data });

    case 'create-post':
      if (isObject(data) && !isArray(data)) return formatPostMarkdown(data);
      return formatStatusMarkdown(isObject(data) ? data : { result: data });

    case 'create-scheduled-post':
    case 'update-scheduled-post':
    case 'delete-scheduled-post':
      if (isObject(data) && !isArray(data)) return formatScheduledPostMarkdown(data);
      return formatStatusMarkdown(isObject(data) ? data : { result: data });

    case 'get-scheduled-posts':
      if (isArray(data)) return formatScheduledPostsMarkdown(data);
      if (isObject(data)) return formatScheduledPostMarkdown(data);
      return formatStatusMarkdown({ result: data });

    case 'pin-post':
    case 'unpin-post':
      return formatStatusMarkdown(isObject(data) ? data : { result: data });

    case 'add-reaction':
    case 'remove-reaction':
    case 'get-reactions':
      if (isArray(data)) return formatReactionsMarkdown(data);
      if (isObject(data)) return formatReactionMarkdown(data);
      return formatStatusMarkdown({ result: data });

    default:
      if (isObject(data)) return formatStatusMarkdown(data);
      return formatStatusMarkdown({ result: data });
  }
}
