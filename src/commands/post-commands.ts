import { MattermostClient } from '../client/mattermost-client';
import { parseScheduledAt } from '../utils/time-parser';
import { parseDaysOfWeek } from '../utils/weekdays';

type PostCommandOptions = {
  terms?: string;
  page?: number;
  perPage?: number;
  postId?: string;
  channelId?: string;
  message?: string;
  rootId?: string;
  fromPost?: string;
  at?: string;
  scheduledPostId?: string;
  excludeDms?: boolean;
  days?: string;
  repeat?: boolean;
};

function resolveDaysOfWeek(options: PostCommandOptions): boolean[] | undefined {
  if (options.days) {
    return parseDaysOfWeek(options.days);
  }
  if (options.repeat) {
    throw new Error('Missing required option: --days (which days to repeat on)');
  }
  return undefined;
}

function splitCsv(value: string): string[] {
  return value
    .split(',')
    .map(part => part.trim())
    .filter(Boolean);
}

export async function runPostCommand(
  command: string,
  client: MattermostClient,
  options: PostCommandOptions,
) {
  if (command === 'search-posts') {
    if (!options.terms) {
      throw new Error('Missing required option: --terms');
    }
    return client.searchPosts({
      terms: options.terms,
      page: options.page,
      perPage: options.perPage,
    });
  }

  if (command === 'get-posts') {
    if (!options.postId) {
      throw new Error('Missing required option: --post-id');
    }
    return Promise.all(splitCsv(options.postId).map(postId => client.getPost({ postId })));
  }

  if (command === 'get-posts-unread') {
    if (!options.channelId) {
      throw new Error('Missing required option: --channel-id');
    }
    return client.getPostsUnread({ channelId: options.channelId });
  }

  if (command === 'create-post') {
    if (!options.channelId) {
      throw new Error('Missing required option: --channel-id');
    }
    if (!options.message) {
      throw new Error('Missing required option: --message');
    }
    return client.createPost({
      channelId: options.channelId,
      message: options.message,
      rootId: options.rootId,
    });
  }

  if (command === 'update-post') {
    if (!options.postId) {
      throw new Error('Missing required option: --post-id');
    }
    if (!options.message) {
      throw new Error('Missing required option: --message');
    }
    return client.updatePost({
      postId: options.postId,
      message: options.message,
    });
  }

  if (command === 'create-scheduled-post') {
    if (!options.channelId) {
      throw new Error('Missing required option: --channel-id');
    }
    if (!options.message) {
      throw new Error('Missing required option: --message');
    }
    if (!options.at) {
      throw new Error('Missing required option: --at');
    }
    return client.createScheduledPost({
      channelId: options.channelId,
      message: options.message,
      scheduledAt: parseScheduledAt(options.at),
      rootId: options.rootId,
      daysOfWeek: resolveDaysOfWeek(options),
    });
  }

  if (command === 'get-scheduled-posts') {
    if (options.excludeDms && (await client.getSchedulerBackend()) === 'loop-plugin') {
      process.stderr.write(
        'Warning: --exclude-dms is ignored on Loop servers — the scheduler plugin always lists every scheduled message.\n',
      );
    }
    return client.getScheduledPosts({ includeDirectChannels: !options.excludeDms });
  }

  if (command === 'update-scheduled-post') {
    if (!options.scheduledPostId) {
      throw new Error('Missing required option: --scheduled-post-id');
    }
    if (!options.message && !options.at) {
      throw new Error('Missing required option: at least one of --message or --at');
    }
    return client.updateScheduledPost({
      scheduledPostId: options.scheduledPostId,
      message: options.message,
      scheduledAt: options.at ? parseScheduledAt(options.at) : undefined,
    });
  }

  if (command === 'delete-scheduled-post') {
    if (!options.scheduledPostId) {
      throw new Error('Missing required option: --scheduled-post-id');
    }
    return client.deleteScheduledPost({ scheduledPostId: options.scheduledPostId });
  }

  if (command === 'get-posts-thread') {
    if (!options.rootId) {
      throw new Error('Missing required option: --root-id');
    }
    return client.getPostsThread({
      rootId: options.rootId,
      fromPost: options.fromPost,
      perPage: options.perPage,
    });
  }

  if (command === 'pin-post') {
    if (!options.postId) {
      throw new Error('Missing required option: --post-id');
    }
    return client.pinPost({ postId: options.postId });
  }

  if (command === 'unpin-post') {
    if (!options.postId) {
      throw new Error('Missing required option: --post-id');
    }
    return client.unpinPost({ postId: options.postId });
  }

  if (command === 'get-posts-pinned') {
    if (!options.channelId) {
      throw new Error('Missing required option: --channel-id');
    }
    return client.getPinnedPosts({ channelId: options.channelId });
  }

  throw new Error(`Unsupported post command: ${command}`);
}
