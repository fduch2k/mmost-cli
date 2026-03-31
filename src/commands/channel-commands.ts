import { MattermostClient } from '../client/mattermost-client';

type ChannelCommandOptions = {
  term?: string;
  page?: number;
  perPage?: number;
  channelId?: string;
  name?: string;
};

function splitCsv(value: string): string[] {
  return value
    .split(',')
    .map(part => part.trim())
    .filter(Boolean);
}

export async function runChannelCommand(
  command: string,
  client: MattermostClient,
  options: ChannelCommandOptions,
) {
  if (command === 'search-channels') {
    if (!options.term) {
      throw new Error('Missing required option: --term');
    }
    return client.searchChannels({
      term: options.term,
      page: options.page,
      perPage: options.perPage,
    });
  }

  if (command === 'get-channels') {
    if (options.channelId && options.name) {
      throw new Error('Cannot use both --channel-id and --name. Specify one.');
    }
    if (options.channelId) {
      return Promise.all(
        splitCsv(options.channelId).map(channelId => client.getChannel({ channelId })),
      );
    }
    if (options.name) {
      return Promise.all(splitCsv(options.name).map(name => client.getChannelByName({ name })));
    }
    throw new Error('Either --channel-id or --name must be provided');
  }

  if (command === 'get-my-channels') {
    return client.getMyChannels();
  }

  throw new Error(`Unsupported channel command: ${command}`);
}
