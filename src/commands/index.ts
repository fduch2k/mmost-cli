import { MattermostClient } from '../client/mattermost-client';

import { runChannelCommand } from './channel-commands';
import { runPostCommand } from './post-commands';
import { runReactionCommand } from './reaction-commands';
import { runUserCommand } from './user-commands';
import { WatchCommandOptions, runWatchCommand } from './watch-commands';

type CommandOptions = Record<string, string | number | boolean>;

/** `watch-posts` is also reachable from the runtime's streaming path, so the mapping is shared */
export function toWatchOptions(options: CommandOptions): WatchCommandOptions {
  return {
    channelId: options.channelId as string | undefined,
    rootId: options.rootId as string | undefined,
    since: options.since as string | undefined,
    events: options.events as string | undefined,
    includeSelf: options.includeSelf as boolean | undefined,
    wait: options.wait as boolean | undefined,
    follow: options.follow as boolean | undefined,
    interval: options.interval as string | undefined,
    timeout: options.timeout as string | undefined,
  };
}

export async function executeCommand(
  command: string,
  client: MattermostClient,
  options: CommandOptions,
): Promise<unknown> {
  if (command === 'get-me' || command === 'get-users' || command === 'search-users') {
    return runUserCommand(command, client, {
      username: options.username as string | undefined,
      userId: options.userId as string | undefined,
      term: options.term as string | undefined,
      page: options.page as number | undefined,
      perPage: options.perPage as number | undefined,
    });
  }

  if (
    command === 'search-channels' ||
    command === 'get-channels' ||
    command === 'get-my-channels' ||
    command === 'create-dm'
  ) {
    return runChannelCommand(command, client, {
      term: options.term as string | undefined,
      page: options.page as number | undefined,
      perPage: options.perPage as number | undefined,
      channelId: options.channelId as string | undefined,
      name: options.name as string | undefined,
      userId: options.userId as string | undefined,
    });
  }

  if (
    command === 'search-posts' ||
    command === 'get-posts' ||
    command === 'get-posts-unread' ||
    command === 'create-post' ||
    command === 'update-post' ||
    command === 'get-posts-thread' ||
    command === 'pin-post' ||
    command === 'unpin-post' ||
    command === 'get-posts-pinned' ||
    command === 'create-scheduled-post' ||
    command === 'get-scheduled-posts' ||
    command === 'update-scheduled-post' ||
    command === 'delete-scheduled-post'
  ) {
    return runPostCommand(command, client, {
      terms: options.terms as string | undefined,
      page: options.page as number | undefined,
      perPage: options.perPage as number | undefined,
      postId: options.postId as string | undefined,
      channelId: options.channelId as string | undefined,
      message: options.message as string | undefined,
      rootId: options.rootId as string | undefined,
      fromPost: options.fromPost as string | undefined,
      at: options.at as string | undefined,
      scheduledPostId: options.scheduledPostId as string | undefined,
      excludeDms: options.excludeDms as boolean | undefined,
      days: options.days as string | undefined,
      repeat: options.repeat as boolean | undefined,
    });
  }

  if (command === 'watch-posts') {
    return runWatchCommand(client, toWatchOptions(options));
  }

  if (command === 'add-reaction' || command === 'remove-reaction' || command === 'get-reactions') {
    return runReactionCommand(command, client, {
      postId: options.postId as string | undefined,
      emojiName: options.emojiName as string | undefined,
    });
  }

  throw new Error(`Unsupported command: ${command}`);
}
