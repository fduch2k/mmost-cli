import { MattermostConfig } from '../../config/config';
import { MattermostClient } from '../mattermost-client';

const mockApi = {
  getMe: jest.fn(),
  getWebappPlugins: jest.fn(),
  getTeamByName: jest.fn(),
  createScheduledPost: jest.fn(),
  getScheduledPosts: jest.fn(),
  updateScheduledPost: jest.fn(),
  deleteScheduledPost: jest.fn(),
};

jest.mock('@mattermost/client', () => ({
  DEFAULT_LIMIT_AFTER: 0,
  Client4: jest.fn().mockImplementation(() => ({
    setUrl: jest.fn(),
    setToken: jest.fn(),
    ...mockApi,
  })),
}));

const config: MattermostConfig = {
  url: 'https://example.com',
  token: 'test-token',
  teamName: 'test-team-name',
};

function scheduledPost(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sp1',
    user_id: 'me1',
    channel_id: 'chan1',
    root_id: '',
    message: 'hello',
    props: {},
    create_at: 1000,
    update_at: 1000,
    scheduled_at: 5000,
    ...overrides,
  };
}

describe('MattermostClient scheduled posts (upstream API)', () => {
  let client: MattermostClient;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockApi.getMe.mockResolvedValue({ id: 'me1' });
    // No Loop scheduler plugin — the client must use the upstream Mattermost API
    mockApi.getWebappPlugins.mockResolvedValue([{ id: 'com.mattermost.gcal' }]);
    mockApi.getTeamByName.mockResolvedValue({ id: 'team1', name: 'test-team-name' });
    client = new MattermostClient(config);
    await client.init();
  });

  it('creates a scheduled post and converts timestamps', async () => {
    mockApi.createScheduledPost.mockResolvedValue({ data: scheduledPost() });

    const result = await client.createScheduledPost({
      channelId: 'chan1',
      message: 'hello',
      scheduledAt: 5000,
      rootId: 'root1',
    });

    expect(mockApi.createScheduledPost).toHaveBeenCalledWith(
      { channel_id: 'chan1', message: 'hello', scheduled_at: 5000, root_id: 'root1' },
      'mmost-cli',
    );
    expect(result).toMatchObject({
      id: 'sp1',
      create_at: new Date(1000),
      update_at: new Date(1000),
      scheduled_at: new Date(5000),
      processed_at: '',
    });
  });

  it('sends an empty root id when replying outside a thread', async () => {
    mockApi.createScheduledPost.mockResolvedValue({ data: scheduledPost() });

    await client.createScheduledPost({ channelId: 'chan1', message: 'hello', scheduledAt: 5000 });

    expect(mockApi.createScheduledPost).toHaveBeenCalledWith(
      expect.objectContaining({ root_id: '' }),
      'mmost-cli',
    );
  });

  it('flattens scheduled posts of all scopes ordered by delivery time', async () => {
    mockApi.getScheduledPosts.mockResolvedValue({
      data: {
        team1: [scheduledPost({ id: 'later', scheduled_at: 9000 })],
        direct_channels: [scheduledPost({ id: 'sooner', channel_id: 'dm1', scheduled_at: 7000 })],
      },
    });

    const result = await client.getScheduledPosts();

    expect(mockApi.getScheduledPosts).toHaveBeenCalledWith('team1', true);
    const scopes = result.map(post => [post.id, 'scope' in post ? post.scope : undefined]);
    expect(scopes).toEqual([
      ['sooner', 'direct_channels'],
      ['later', 'team1'],
    ]);
    expect(result[0].scheduled_at).toEqual(new Date(7000));
  });

  it('asks the server to skip direct channels when requested', async () => {
    mockApi.getScheduledPosts.mockResolvedValue({ data: { team1: [] } });

    const result = await client.getScheduledPosts({ includeDirectChannels: false });

    expect(mockApi.getScheduledPosts).toHaveBeenCalledWith('team1', false);
    expect(result).toEqual([]);
  });

  it('tolerates an empty scheduled posts response', async () => {
    mockApi.getScheduledPosts.mockResolvedValue({ data: undefined });

    await expect(client.getScheduledPosts()).resolves.toEqual([]);
  });

  it('keeps untouched fields when updating a scheduled post', async () => {
    mockApi.getScheduledPosts.mockResolvedValue({
      data: { team1: [scheduledPost({ root_id: 'root1' })] },
    });
    mockApi.updateScheduledPost.mockResolvedValue({
      data: scheduledPost({ root_id: 'root1', scheduled_at: 8000 }),
    });

    const result = await client.updateScheduledPost({
      scheduledPostId: 'sp1',
      scheduledAt: 8000,
    });

    expect(mockApi.updateScheduledPost).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'sp1',
        message: 'hello',
        root_id: 'root1',
        channel_id: 'chan1',
        scheduled_at: 8000,
      }),
      'mmost-cli',
    );
    expect(result.scheduled_at).toEqual(new Date(8000));
  });

  it('keeps the delivery time when only the message is updated', async () => {
    mockApi.getScheduledPosts.mockResolvedValue({ data: { team1: [scheduledPost()] } });
    mockApi.updateScheduledPost.mockResolvedValue({ data: scheduledPost({ message: 'edited' }) });

    await client.updateScheduledPost({ scheduledPostId: 'sp1', message: 'edited' });

    expect(mockApi.updateScheduledPost).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'edited', scheduled_at: 5000 }),
      'mmost-cli',
    );
  });

  it('fails with a clear message when the scheduled post is unknown', async () => {
    mockApi.getScheduledPosts.mockResolvedValue({ data: { team1: [scheduledPost()] } });

    await expect(
      client.updateScheduledPost({ scheduledPostId: 'nope', message: 'x' }),
    ).rejects.toThrow("Scheduled post with ID 'nope' not found");
    expect(mockApi.updateScheduledPost).not.toHaveBeenCalled();
  });

  it('deletes a scheduled post on behalf of the current user', async () => {
    mockApi.deleteScheduledPost.mockResolvedValue({ data: scheduledPost() });

    const result = await client.deleteScheduledPost({ scheduledPostId: 'sp1' });

    expect(mockApi.deleteScheduledPost).toHaveBeenCalledWith('me1', 'sp1', 'mmost-cli');
    expect(result).toMatchObject({ id: 'sp1', scheduled_at: new Date(5000) });
  });

  it('reports a delete with an empty response body as deleted', async () => {
    mockApi.deleteScheduledPost.mockResolvedValue({ data: undefined });

    await expect(client.deleteScheduledPost({ scheduledPostId: 'sp1' })).resolves.toEqual({
      backend: 'server',
      id: 'sp1',
      status: 'deleted',
    });
  });
});
