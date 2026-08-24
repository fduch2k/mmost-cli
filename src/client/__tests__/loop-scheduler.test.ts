import { MattermostConfig } from '../../config/config';
import { MattermostClient } from '../mattermost-client';

const mockApi = {
  getMe: jest.fn(),
  getTeamByName: jest.fn(),
  getWebappPlugins: jest.fn(),
  createScheduledPost: jest.fn(),
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
  url: 'https://loop.example.com',
  token: 'test-token',
  teamName: 'test-team-name',
};

function envelope(body: unknown, result: 'success' | 'error' = 'success', key?: string) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({ result, data: body, key }),
  };
}

function loopSchedule(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ls1',
    startDate: '2027-03-01T09:30:00+03:00',
    endDate: '0001-01-01T00:00:00Z',
    nextDate: '2027-03-01T09:30:00+03:00',
    daysOfWeek: [false, false, false, false, false, false, false],
    post: {
      user_id: 'me1',
      channel_id: 'chan1',
      root_id: '',
      message: 'hello',
    },
    ...overrides,
  };
}

const fetchMock = jest.fn();

describe('MattermostClient scheduled posts (Loop scheduler plugin)', () => {
  let client: MattermostClient;

  beforeEach(async () => {
    jest.clearAllMocks();
    global.fetch = fetchMock as unknown as typeof fetch;
    mockApi.getMe.mockResolvedValue({ id: 'me1' });
    mockApi.getTeamByName.mockResolvedValue({ id: 'team1', name: 'test-team-name' });
    mockApi.getWebappPlugins.mockResolvedValue([
      { id: 'jira' },
      { id: 'ru.loop.plugin.scheduler' },
    ]);
    client = new MattermostClient(config);
    await client.init();
  });

  it('detects the Loop plugin and caches the answer', async () => {
    await expect(client.getSchedulerBackend()).resolves.toBe('loop-plugin');
    await client.getSchedulerBackend();
    expect(mockApi.getWebappPlugins).toHaveBeenCalledTimes(1);
  });

  it('falls back to the upstream API when the plugin is absent', async () => {
    mockApi.getWebappPlugins.mockResolvedValue([{ id: 'jira' }]);
    const other = new MattermostClient(config);
    await expect(other.getSchedulerBackend()).resolves.toBe('server');
  });

  it('treats a refused plugin listing as an upstream server', async () => {
    mockApi.getWebappPlugins.mockRejectedValue(new Error('forbidden'));
    const other = new MattermostClient(config);
    await expect(other.getSchedulerBackend()).resolves.toBe('server');
  });

  it('creates a scheduled message through the plugin, always sending an owner', async () => {
    fetchMock.mockResolvedValue(envelope(loopSchedule()));

    const result = await client.createScheduledPost({
      channelId: 'chan1',
      message: 'hello',
      scheduledAt: Date.parse('2027-03-01T09:30:00+03:00'),
      rootId: 'root1',
    });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://loop.example.com/plugins/ru.loop.plugin.scheduler/create');
    expect(options.method).toBe('post');
    expect(options.headers.Authorization).toBe('Bearer test-token');

    const body = JSON.parse(options.body);
    expect(body.post).toEqual({
      user_id: 'me1',
      channel_id: 'chan1',
      message: 'hello',
      root_id: 'root1',
    });
    expect(body.repeat).toBe(false);
    expect(body.daysOfWeek).toEqual([false, false, false, false, false, false, false]);
    expect(Date.parse(body.startDate)).toBe(Date.parse('2027-03-01T09:30:00+03:00'));

    expect(result).toMatchObject({
      backend: 'loop-plugin',
      id: 'ls1',
      channel_id: 'chan1',
      message: 'hello',
      repeat: false,
      days_of_week: [],
    });
    expect(result.scheduled_at).toEqual(new Date('2027-03-01T09:30:00+03:00'));
    expect(mockApi.createScheduledPost).not.toHaveBeenCalled();
  });

  it('sends a weekly repeat mask when days are given', async () => {
    fetchMock.mockResolvedValue(
      envelope(loopSchedule({ daysOfWeek: [false, true, false, true, false, true, false] })),
    );

    const result = await client.createScheduledPost({
      channelId: 'chan1',
      message: 'standup',
      scheduledAt: Date.parse('2027-03-01T09:30:00+03:00'),
      daysOfWeek: [false, true, false, true, false, true, false],
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.repeat).toBe(true);
    expect(body.daysOfWeek).toEqual([false, true, false, true, false, true, false]);
    expect(result).toMatchObject({ repeat: true, days_of_week: ['mon', 'wed', 'fri'] });
  });

  it('raises the plugin error even though it arrives with HTTP 200', async () => {
    fetchMock.mockResolvedValue(envelope('access denied', 'error', 'get_schedules'));

    await expect(client.getScheduledPosts()).rejects.toThrow(
      'Loop scheduler plugin error: access denied (get_schedules)',
    );
  });

  it('refuses a create the plugin stored without an owner', async () => {
    fetchMock.mockResolvedValue(
      envelope(loopSchedule({ post: { channel_id: 'chan1', message: 'x' } })),
    );

    await expect(
      client.createScheduledPost({ channelId: 'chan1', message: 'x', scheduledAt: 4102444800000 }),
    ).rejects.toThrow('stored no owner');
  });

  it('lists scheduled messages ordered by delivery time', async () => {
    fetchMock.mockResolvedValue(
      envelope([
        loopSchedule({ id: 'later', nextDate: '2027-03-05T09:30:00+03:00' }),
        loopSchedule({ id: 'sooner', nextDate: '2027-03-02T09:30:00+03:00' }),
      ]),
    );

    const result = await client.getScheduledPosts();

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://loop.example.com/plugins/ru.loop.plugin.scheduler/list?channelId=',
    );
    expect(result.map(post => post.id)).toEqual(['sooner', 'later']);
  });

  it('reports an empty plugin list as no scheduled messages', async () => {
    fetchMock.mockResolvedValue(envelope(null));

    await expect(client.getScheduledPosts()).resolves.toEqual([]);
  });

  it('recreates the record on update, keeping repeat days and reporting the old id', async () => {
    fetchMock
      .mockResolvedValueOnce(
        envelope([loopSchedule({ daysOfWeek: [false, true, false, false, false, false, false] })]),
      )
      .mockResolvedValueOnce(
        envelope(
          loopSchedule({
            id: 'ls2',
            daysOfWeek: [false, true, false, false, false, false, false],
            post: { user_id: 'me1', channel_id: 'chan1', root_id: '', message: 'edited' },
          }),
        ),
      )
      .mockResolvedValueOnce(envelope(null));

    const result = await client.updateScheduledPost({
      scheduledPostId: 'ls1',
      message: 'edited',
    });

    const [listUrl] = fetchMock.mock.calls[0];
    const [createUrl, createOptions] = fetchMock.mock.calls[1];
    const [removeUrl, removeOptions] = fetchMock.mock.calls[2];
    expect(listUrl).toContain('/list?channelId=');
    expect(createUrl).toContain('/create');
    expect(JSON.parse(createOptions.body)).toMatchObject({
      repeat: true,
      daysOfWeek: [false, true, false, false, false, false, false],
      post: { message: 'edited', channel_id: 'chan1' },
    });
    expect(removeUrl).toBe(
      'https://loop.example.com/plugins/ru.loop.plugin.scheduler/remove?scheduleId=ls1',
    );
    expect(removeOptions.method).toBe('delete');
    expect(result).toMatchObject({ id: 'ls2', replaced_id: 'ls1', message: 'edited' });
  });

  it('creates the replacement before removing the original', async () => {
    fetchMock
      .mockResolvedValueOnce(envelope([loopSchedule()]))
      .mockRejectedValueOnce(new Error('create failed'));

    await expect(
      client.updateScheduledPost({ scheduledPostId: 'ls1', message: 'edited' }),
    ).rejects.toThrow('create failed');

    expect(fetchMock.mock.calls.map(call => call[1].method)).toEqual(['get', 'post']);
  });

  it('fails with a clear message when the scheduled message is unknown', async () => {
    fetchMock.mockResolvedValue(envelope([loopSchedule()]));

    await expect(
      client.updateScheduledPost({ scheduledPostId: 'nope', message: 'x' }),
    ).rejects.toThrow("Scheduled post with ID 'nope' not found");
  });

  it('deletes through the plugin remove endpoint', async () => {
    fetchMock
      .mockResolvedValueOnce(envelope([loopSchedule()]))
      .mockResolvedValueOnce(envelope(null));

    const result = await client.deleteScheduledPost({ scheduledPostId: 'ls1' });

    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://loop.example.com/plugins/ru.loop.plugin.scheduler/remove?scheduleId=ls1',
    );
    expect(result).toEqual({ backend: 'loop-plugin', id: 'ls1', status: 'deleted' });
  });

  it('refuses to report an unknown ID as deleted', async () => {
    // The plugin answers `success` for IDs it has never seen
    fetchMock.mockResolvedValue(envelope([loopSchedule()]));

    await expect(client.deleteScheduledPost({ scheduledPostId: 'nope' })).rejects.toThrow(
      "Scheduled post with ID 'nope' not found",
    );
    expect(fetchMock.mock.calls.every(call => call[1].method === 'get')).toBe(true);
  });

  it('rejects repeating schedules on an upstream server', async () => {
    mockApi.getWebappPlugins.mockResolvedValue([{ id: 'jira' }]);
    const upstream = new MattermostClient(config);

    await expect(
      upstream.createScheduledPost({
        channelId: 'chan1',
        message: 'x',
        scheduledAt: 4102444800000,
        daysOfWeek: [false, true, false, false, false, false, false],
      }),
    ).rejects.toThrow('need the Loop scheduler plugin');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('surfaces a transport failure instead of a plugin error', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 502, statusText: 'Bad Gateway' });

    await expect(client.getScheduledPosts()).rejects.toThrow(
      'Loop scheduler plugin request failed: 502 Bad Gateway',
    );
  });
});
