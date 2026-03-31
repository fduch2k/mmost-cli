import { MattermostClient } from '../client/mattermost-client';

type ReactionCommandOptions = {
  postId?: string;
  emojiName?: string;
};

function splitCsv(value: string): string[] {
  return value
    .split(',')
    .map(part => part.trim())
    .filter(Boolean);
}

export async function runReactionCommand(
  command: string,
  client: MattermostClient,
  options: ReactionCommandOptions,
) {
  if (!options.postId) {
    throw new Error('Missing required option: --post-id');
  }

  if (command === 'add-reaction') {
    if (!options.emojiName) {
      throw new Error('Missing required option: --emoji-name');
    }
    return Promise.all(
      splitCsv(options.emojiName).map(emojiName =>
        client.addReaction({ postId: options.postId!, emojiName }),
      ),
    );
  }

  if (command === 'remove-reaction') {
    if (!options.emojiName) {
      throw new Error('Missing required option: --emoji-name');
    }
    return Promise.all(
      splitCsv(options.emojiName).map(emojiName =>
        client.removeReaction({ postId: options.postId!, emojiName }),
      ),
    );
  }

  if (command === 'get-reactions') {
    return client.getReactionsForPost({ postId: options.postId });
  }

  throw new Error(`Unsupported reaction command: ${command}`);
}
