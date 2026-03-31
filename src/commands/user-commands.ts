import { MattermostClient } from '../client/mattermost-client';

type UserCommandOptions = {
  username?: string;
  userId?: string;
  term?: string;
  page?: number;
  perPage?: number;
};

function splitCsv(value: string): string[] {
  return value
    .split(',')
    .map(part => part.trim())
    .filter(Boolean);
}

export async function runUserCommand(
  command: string,
  client: MattermostClient,
  options: UserCommandOptions,
) {
  if (command === 'get-me') {
    return client.getMe();
  }

  if (command === 'get-users') {
    if (options.userId && options.username) {
      throw new Error('Cannot use both --user-id and --username. Specify one.');
    }
    if (options.userId) {
      return Promise.all(splitCsv(options.userId).map(userId => client.getUser({ userId })));
    }
    if (options.username) {
      return Promise.all(
        splitCsv(options.username).map(username => client.getUserByUsername({ username })),
      );
    }
    throw new Error('Either --user-id or --username must be provided');
  }

  if (command === 'search-users') {
    if (!options.term) {
      throw new Error('Missing required option: --term');
    }
    return client.searchUsers({ term: options.term, page: options.page, perPage: options.perPage });
  }

  throw new Error(`Unsupported user command: ${command}`);
}
