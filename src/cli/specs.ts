import { CommandSpec } from './types';

export const COMMAND_SPECS: CommandSpec[] = [
  {
    name: 'get-me',
    description: 'Get the current authenticated user profile',
    options: [],
    examples: ['mmost get-me'],
  },
  {
    name: 'get-users',
    description: 'Get users by username or user ID. One of --username or --user-id is required.',
    options: [
      {
        key: 'username',
        flag: 'username',
        type: 'string',
        description: 'Comma-separated usernames (required if --user-id not provided)',
      },
      {
        key: 'userId',
        flag: 'user-id',
        type: 'string',
        description: 'Comma-separated user IDs (required if --username not provided)',
      },
    ],
    examples: ['mmost get-users --username john,jane', 'mmost get-users --user-id id1,id2'],
  },
  {
    name: 'search-users',
    description: 'Search users by term',
    options: [
      {
        key: 'term',
        flag: 'term',
        type: 'string',
        required: true,
        description: 'Search term',
      },
      {
        key: 'page',
        flag: 'page',
        type: 'number',
        description: 'Page number (default: 0)',
      },
      {
        key: 'perPage',
        flag: 'per-page',
        type: 'number',
        description: 'Page size (default: 60)',
      },
    ],
    examples: [
      'mmost search-users --term john',
      'mmost search-users --term john --page 0 --per-page 20',
    ],
  },
  {
    name: 'search-channels',
    description: 'Search channels by term',
    options: [
      {
        key: 'term',
        flag: 'term',
        type: 'string',
        required: true,
        description: 'Search term',
      },
      {
        key: 'page',
        flag: 'page',
        type: 'number',
        description: 'Page number (default: 0)',
      },
      {
        key: 'perPage',
        flag: 'per-page',
        type: 'number',
        description: 'Page size (default: 100)',
      },
    ],
    examples: ['mmost search-channels --term qa --page 0 --per-page 50'],
  },
  {
    name: 'get-channels',
    description: 'Get channels by channel ID or name. One of --channel-id or --name is required.',
    options: [
      {
        key: 'channelId',
        flag: 'channel-id',
        type: 'string',
        description: 'Comma-separated channel IDs (required if --name not provided)',
      },
      {
        key: 'name',
        flag: 'name',
        type: 'string',
        description: 'Comma-separated channel names (required if --channel-id not provided)',
      },
    ],
    examples: [
      'mmost get-channels --channel-id cid1,cid2',
      'mmost get-channels --name town-square,offtopic',
    ],
  },
  {
    name: 'get-my-channels',
    description: 'Get channels the current user belongs to',
    options: [],
    examples: ['mmost get-my-channels'],
  },
  {
    name: 'create-dm',
    description:
      'Create a direct message channel between two users. Idempotent — returns existing channel if already exists.',
    options: [
      {
        key: 'userId',
        flag: 'user-id',
        type: 'string',
        required: true,
        description: 'Comma-separated pair of user IDs (exactly 2)',
      },
    ],
    examples: ['mmost create-dm --user-id user1_id,user2_id'],
  },
  {
    name: 'search-posts',
    description: 'Search posts by terms',
    options: [
      {
        key: 'terms',
        flag: 'terms',
        type: 'string',
        required: true,
        description:
          'Search query. Supports modifiers: from:<user>, in:<channel>, before:<date>, after:<date>, on:<date>',
      },
      {
        key: 'page',
        flag: 'page',
        type: 'number',
        description: 'Page number (default: 0)',
      },
      {
        key: 'perPage',
        flag: 'per-page',
        type: 'number',
        description: 'Page size (default: 100)',
      },
    ],
    examples: [
      'mmost search-posts --terms "deployment"',
      'mmost search-posts --terms "from:john in:town-square release"',
      'mmost search-posts --terms "after:2024-01-01 bug fix" --per-page 20',
    ],
  },
  {
    name: 'get-posts',
    description: 'Get posts by post ID',
    options: [
      {
        key: 'postId',
        flag: 'post-id',
        type: 'string',
        required: true,
        description: 'Comma-separated post IDs',
      },
    ],
    examples: ['mmost get-posts --post-id p1,p2'],
  },
  {
    name: 'get-posts-unread',
    description: 'Get unread posts in a channel',
    options: [
      {
        key: 'channelId',
        flag: 'channel-id',
        type: 'string',
        required: true,
        description: 'Channel ID',
      },
    ],
    examples: ['mmost get-posts-unread --channel-id cid1'],
  },
  {
    name: 'create-post',
    description: 'Create a post in a channel',
    options: [
      {
        key: 'channelId',
        flag: 'channel-id',
        type: 'string',
        required: true,
        description: 'Channel ID',
      },
      {
        key: 'message',
        flag: 'message',
        type: 'string',
        required: true,
        description: 'Message body',
      },
      {
        key: 'rootId',
        flag: 'root-id',
        type: 'string',
        description: 'Root post ID for thread reply',
      },
    ],
    examples: ['mmost create-post --channel-id cid1 --message "hello"'],
  },
  {
    name: 'update-post',
    description:
      'Update the message of an existing post. Other post fields are preserved. Editing sends no notifications.',
    options: [
      {
        key: 'postId',
        flag: 'post-id',
        type: 'string',
        required: true,
        description: 'Post ID',
      },
      {
        key: 'message',
        flag: 'message',
        type: 'string',
        required: true,
        description: 'New message body (replaces the current one)',
      },
    ],
    examples: ['mmost update-post --post-id p1 --message "fixed text"'],
  },
  {
    name: 'create-scheduled-post',
    description:
      'Schedule a post for future delivery. Uses the Loop scheduler plugin when the server has it, otherwise the upstream Mattermost scheduled posts API.',
    options: [
      {
        key: 'channelId',
        flag: 'channel-id',
        type: 'string',
        required: true,
        description: 'Channel ID',
      },
      {
        key: 'message',
        flag: 'message',
        type: 'string',
        required: true,
        description: 'Message body',
      },
      {
        key: 'at',
        flag: 'at',
        type: 'string',
        required: true,
        description:
          "Delivery time: relative offset (+30m, +2h, +1d, +1w), ISO-8601 ('2026-08-25T09:30:00Z', '2026-08-25 09:30' in local time) or a unix timestamp in seconds/milliseconds. Must be in the future.",
      },
      {
        key: 'rootId',
        flag: 'root-id',
        type: 'string',
        description: 'Root post ID for thread reply',
      },
      {
        key: 'days',
        flag: 'days',
        type: 'string',
        description:
          'Repeat weekly on these days: mon,tue,wed,thu,fri,sat,sun (Loop servers only). Implies --repeat.',
      },
      {
        key: 'repeat',
        flag: 'repeat',
        type: 'boolean',
        description: 'Repeat weekly; requires --days (Loop servers only)',
      },
    ],
    examples: [
      'mmost create-scheduled-post --channel-id cid1 --message "standup starts" --at +2h',
      'mmost create-scheduled-post --channel-id cid1 --message "standup" --at +1d --days mon,wed,fri',
      'mmost create-scheduled-post --channel-id cid1 --message "release notes" --at 2026-08-25T09:30:00Z',
    ],
  },
  {
    name: 'get-scheduled-posts',
    description:
      'Get pending scheduled posts of the current user, ordered by delivery time. Includes DM channels unless --exclude-dms is passed (that flag is ignored on Loop servers).',
    options: [
      {
        key: 'excludeDms',
        flag: 'exclude-dms',
        type: 'boolean',
        description: 'Return only posts scheduled in team channels, skipping DMs and group DMs',
      },
    ],
    examples: ['mmost get-scheduled-posts', 'mmost get-scheduled-posts --exclude-dms --human'],
  },
  {
    name: 'update-scheduled-post',
    description:
      'Update the message and/or the delivery time of a pending scheduled post. At least one of --message or --at is required. On Loop servers the record is recreated, so its ID changes.',
    options: [
      {
        key: 'scheduledPostId',
        flag: 'scheduled-post-id',
        type: 'string',
        required: true,
        description: 'Scheduled post ID (from get-scheduled-posts)',
      },
      {
        key: 'message',
        flag: 'message',
        type: 'string',
        description: 'New message body (replaces the current one)',
      },
      {
        key: 'at',
        flag: 'at',
        type: 'string',
        description: 'New delivery time, same formats as create-scheduled-post',
      },
    ],
    examples: [
      'mmost update-scheduled-post --scheduled-post-id sp1 --message "fixed text"',
      'mmost update-scheduled-post --scheduled-post-id sp1 --at +1d',
    ],
  },
  {
    name: 'delete-scheduled-post',
    description: 'Delete a pending scheduled post so it is never delivered',
    options: [
      {
        key: 'scheduledPostId',
        flag: 'scheduled-post-id',
        type: 'string',
        required: true,
        description: 'Scheduled post ID (from get-scheduled-posts)',
      },
    ],
    examples: ['mmost delete-scheduled-post --scheduled-post-id sp1'],
  },
  {
    name: 'get-posts-thread',
    description: 'Get posts in a thread',
    options: [
      {
        key: 'rootId',
        flag: 'root-id',
        type: 'string',
        required: true,
        description: 'Thread root post ID',
      },
      {
        key: 'fromPost',
        flag: 'from-post',
        type: 'string',
        description: 'Start from post ID',
      },
      {
        key: 'perPage',
        flag: 'per-page',
        type: 'number',
        description: 'Page size',
      },
    ],
    examples: ['mmost get-posts-thread --root-id p1 --per-page 30'],
  },
  {
    name: 'pin-post',
    description: 'Pin a post',
    options: [
      {
        key: 'postId',
        flag: 'post-id',
        type: 'string',
        required: true,
        description: 'Post ID',
      },
    ],
    examples: ['mmost pin-post --post-id p1'],
  },
  {
    name: 'unpin-post',
    description: 'Unpin a post',
    options: [
      {
        key: 'postId',
        flag: 'post-id',
        type: 'string',
        required: true,
        description: 'Post ID',
      },
    ],
    examples: ['mmost unpin-post --post-id p1'],
  },
  {
    name: 'get-posts-pinned',
    description: 'Get pinned posts in a channel',
    options: [
      {
        key: 'channelId',
        flag: 'channel-id',
        type: 'string',
        required: true,
        description: 'Channel ID',
      },
    ],
    examples: ['mmost get-posts-pinned --channel-id cid1'],
  },
  {
    name: 'add-reaction',
    description: 'Add reactions to a post',
    options: [
      {
        key: 'postId',
        flag: 'post-id',
        type: 'string',
        required: true,
        description: 'Post ID',
      },
      {
        key: 'emojiName',
        flag: 'emoji-name',
        type: 'string',
        required: true,
        description: 'Comma-separated emoji names',
      },
    ],
    examples: ['mmost add-reaction --post-id p1 --emoji-name +1,eyes'],
  },
  {
    name: 'remove-reaction',
    description: 'Remove reactions from a post',
    options: [
      {
        key: 'postId',
        flag: 'post-id',
        type: 'string',
        required: true,
        description: 'Post ID',
      },
      {
        key: 'emojiName',
        flag: 'emoji-name',
        type: 'string',
        required: true,
        description: 'Comma-separated emoji names',
      },
    ],
    examples: ['mmost remove-reaction --post-id p1 --emoji-name +1,eyes'],
  },
  {
    name: 'get-reactions',
    description: 'Get reactions for a post',
    options: [
      {
        key: 'postId',
        flag: 'post-id',
        type: 'string',
        required: true,
        description: 'Post ID',
      },
    ],
    examples: ['mmost get-reactions --post-id p1'],
  },
];

export function getCommandSpec(name: string): CommandSpec | undefined {
  return COMMAND_SPECS.find(spec => spec.name === name);
}
