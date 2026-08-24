import { Client4, DEFAULT_LIMIT_AFTER } from '@mattermost/client';
import { Channel } from '@mattermost/types/channels';
import { Post, PostList } from '@mattermost/types/posts';
import { Reaction } from '@mattermost/types/reactions';
import { ScheduledPost } from '@mattermost/types/schedule_post';
import { UserProfile } from '@mattermost/types/users';

import { MattermostConfig } from '../config/config';
import { toIsoWithOffset } from '../utils/time-parser';
import { formatDaysOfWeek } from '../utils/weekdays';

/**
 * Sent as the Connection-Id header on scheduled post mutations
 * The server uses it to skip echoing the change back to the originating websocket
 * connection; the CLI has none, so a stable placeholder is enough
 */
const CONNECTION_ID = 'mmost-cli';

/**
 * Loop ships its own scheduled messages implementation as a plugin instead of the
 * upstream `/api/v4/posts/schedule` API, so the backend is detected per server
 */
const SCHEDULER_PLUGIN_ID = 'ru.loop.plugin.scheduler';

export type SchedulerBackend = 'loop-plugin' | 'server';

/**
 * Envelope the Loop scheduler plugin wraps every response in
 * Errors come back as HTTP 200 with `result: 'error'`, so the status code alone means nothing
 */
type PluginEnvelope<T> = {
  result: 'success' | 'error';
  data?: T;
  key?: string;
};

type LoopSchedule = {
  id: string;
  startDate: string;
  endDate?: string;
  nextDate?: string;
  daysOfWeek?: boolean[];
  post: {
    user_id?: string;
    channel_id: string;
    root_id?: string;
    message: string;
  };
};

/**
 * Wrapper for the Mattermost Client4 API client
 * Provides typed methods for interacting with the Mattermost API
 */
export class MattermostClient {
  private readonly client: Client4;
  private teamId: string = '';
  private readonly config: MattermostConfig;
  private schedulerBackend?: SchedulerBackend;

  /**
   * Create a new Mattermost client
   * @param config Mattermost configuration
   */
  constructor(config: MattermostConfig) {
    this.client = new Client4();
    this.client.setUrl(config.url);
    this.client.setToken(config.token);
    this.config = config;

    // If teamId is provided directly, use it
    if (config.teamId) {
      this.teamId = config.teamId;
    }
  }

  async init() {
    // If teamId is not set but teamName is provided, resolve team name to team ID
    if (!this.teamId && this.config.teamName) {
      const team = await this.client.getTeamByName(this.config.teamName);
      if (!team) {
        throw new Error(`Team with name '${this.config.teamName}' not found or not accessible`);
      }
      this.teamId = team.id;
    } else if (this.teamId) {
      // If teamId is provided, validate it exists
      const team = await this.client.getTeam(this.teamId);
      if (!team) {
        throw new Error(`Team with ID '${this.teamId}' not found or not accessible`);
      }
    } else {
      throw new Error('Either team name or team ID must be provided in configuration');
    }
  }

  /**
   * Get the current user
   */
  async getMe() {
    return this.convertUserProfile(await this.client.getMe());
  }

  /**
   * Get a user by ID
   */
  async getUser({ userId }: { userId: string }) {
    return this.convertUserProfile(await this.client.getUser(userId));
  }

  /**
   * Get a user by username
   */
  async getUserByUsername({ username }: { username: string }) {
    return this.convertUserProfile(await this.client.getUserByUsername(username));
  }

  /**
   * Search users by term
   */
  async searchUsers({
    term,
    page = 0,
    perPage = 60,
  }: {
    term: string;
    page?: number;
    perPage?: number;
  }) {
    const response = await this.client.searchUsers(term, {
      team_id: this.teamId,
      page,
      per_page: perPage,
    });
    return response.map(this.convertUserProfile);
  }

  /**
   * Search channels by term
   */
  async searchChannels({
    term,
    page = 0,
    perPage = 100,
  }: {
    term: string;
    page?: number;
    perPage?: number;
  }) {
    if (!this.teamId) {
      throw new Error('Team ID not set');
    }
    return this.client.searchAllChannels(term, {
      team_ids: [this.teamId],
      page,
      per_page: perPage,
    });
  }

  /**
   * Get a channel by ID
   */
  async getChannel({ channelId }: { channelId: string }) {
    return this.convertChannel(await this.client.getChannel(channelId));
  }

  /**
   * Get a channel by name
   */
  async getChannelByName({ name }: { name: string }) {
    if (!this.teamId) {
      throw new Error('Team ID not set');
    }
    return this.convertChannel(await this.client.getChannelByName(this.teamId, name));
  }

  /**
   * Search posts by term
   */
  async searchPosts({
    terms,
    page = 0,
    perPage = 100,
  }: {
    terms: string;
    page?: number;
    perPage?: number;
  }) {
    if (!this.teamId) {
      throw new Error('Team ID not set');
    }
    return this.convertPostList(
      await this.client.searchPostsWithParams(this.teamId, {
        terms,
        page,
        per_page: perPage,
      }),
    );
  }

  /**
   * Get a post by ID
   */
  async getPost({ postId }: { postId: string }) {
    return this.convertPost(await this.client.getPost(postId));
  }

  /**
   * Get unread posts in a channel
   */
  async getPostsUnread({ channelId }: { channelId: string }) {
    const me = await this.client.getMe();
    return this.convertPostList(
      await this.client.getPostsUnread(channelId, me.id, DEFAULT_LIMIT_AFTER, 0, true),
    );
  }

  /**
   * Create a new post
   */
  async createPost({
    channelId,
    message,
    rootId,
  }: {
    channelId: string;
    message: string;
    rootId?: string;
  }) {
    return this.convertPost(
      await this.client.createPost({ channel_id: channelId, message, root_id: rootId }),
    );
  }

  /**
   * Update the message of an existing post
   * Patch request — post fields other than the message are preserved
   */
  async updatePost({ postId, message }: { postId: string; message: string }) {
    return this.convertPost(await this.client.patchPost({ id: postId, message }));
  }

  /**
   * Get posts in a thread
   */
  async getPostsThread({
    rootId,
    fromPost,
    perPage,
  }: {
    rootId: string;
    fromPost?: string;
    perPage?: number;
  }) {
    return this.convertPostList(
      await this.client.getPaginatedPostThread(rootId, {
        direction: 'up',
        fromPost,
        perPage,
      }),
    );
  }

  /**
   * Add a reaction to a post
   */
  async addReaction({ postId, emojiName }: { postId: string; emojiName: string }) {
    const me = await this.client.getMe();
    return this.convertReaction(await this.client.addReaction(me.id, postId, emojiName));
  }

  /**
   * Remove a reaction from a post
   */
  async removeReaction({ postId, emojiName }: { postId: string; emojiName: string }) {
    const me = await this.client.getMe();
    return this.client.removeReaction(me.id, postId, emojiName);
  }

  /**
   * Get reactions for a post
   */
  async getReactionsForPost({ postId }: { postId: string }) {
    const response = await this.client.getReactionsForPost(postId);
    return response.map(this.convertReaction);
  }

  /**
   * Pin a post to a channel
   */
  async pinPost({ postId }: { postId: string }) {
    return this.client.pinPost(postId);
  }

  /**
   * Unpin a post from a channel
   */
  async unpinPost({ postId }: { postId: string }) {
    return this.client.unpinPost(postId);
  }

  /**
   * Get pinned posts in a channel
   */
  async getPinnedPosts({ channelId }: { channelId: string }) {
    return this.convertPostList(await this.client.getPinnedPosts(channelId));
  }

  /**
   * Which scheduled messages implementation this server offers
   * Loop installs the `ru.loop.plugin.scheduler` plugin; upstream Mattermost
   * exposes `/api/v4/posts/schedule` instead. Detected once per process.
   */
  async getSchedulerBackend(): Promise<SchedulerBackend> {
    if (!this.schedulerBackend) {
      let plugins: { id: string }[] = [];
      try {
        plugins = await this.client.getWebappPlugins();
      } catch {
        // A server that refuses the plugin listing is treated as upstream Mattermost
        plugins = [];
      }
      this.schedulerBackend = plugins.some(plugin => plugin.id === SCHEDULER_PLUGIN_ID)
        ? 'loop-plugin'
        : 'server';
    }
    return this.schedulerBackend;
  }

  /**
   * Schedule a post for future delivery
   * @param scheduledAt Delivery time as a unix timestamp in milliseconds
   * @param daysOfWeek Weekly repeat mask, Sunday first — Loop plugin only
   */
  async createScheduledPost({
    channelId,
    message,
    scheduledAt,
    rootId,
    daysOfWeek,
  }: {
    channelId: string;
    message: string;
    scheduledAt: number;
    rootId?: string;
    daysOfWeek?: boolean[];
  }) {
    const repeat = !!daysOfWeek?.some(Boolean);

    if ((await this.getSchedulerBackend()) === 'loop-plugin') {
      const me = await this.client.getMe();
      const created = await this.callSchedulerPlugin<LoopSchedule>('/create', 'post', {
        startDate: toIsoWithOffset(scheduledAt),
        repeat,
        daysOfWeek: daysOfWeek || new Array(7).fill(false),
        post: {
          // The plugin silently stores an unreachable record when the owner is absent
          user_id: me.id,
          channel_id: channelId,
          message,
          root_id: rootId || '',
        },
      });
      if (!created?.post?.user_id) {
        throw new Error(
          'Loop scheduler plugin accepted the message but stored no owner — it would never be delivered',
        );
      }
      return this.convertLoopSchedule(created);
    }

    if (repeat) {
      throw new Error(
        'Repeating schedules (--repeat/--days) need the Loop scheduler plugin, which this server does not have',
      );
    }

    const { data } = await this.client.createScheduledPost(
      {
        channel_id: channelId,
        message,
        scheduled_at: scheduledAt,
        root_id: rootId || '',
      },
      CONNECTION_ID,
    );
    return this.convertScheduledPost(data);
  }

  /**
   * Get pending scheduled posts of the current user, ordered by delivery time
   * `includeDirectChannels` only applies to the upstream API; the Loop plugin
   * always returns every scheduled message of the current user
   */
  async getScheduledPosts({
    includeDirectChannels = true,
  }: { includeDirectChannels?: boolean } = {}) {
    if ((await this.getSchedulerBackend()) === 'loop-plugin') {
      const schedules = await this.fetchLoopSchedules();
      return schedules
        .map(schedule => this.convertLoopSchedule(schedule))
        .sort((left, right) => Number(left.scheduled_at) - Number(right.scheduled_at));
    }

    const byScope = await this.fetchScheduledPosts(includeDirectChannels);
    return Object.entries(byScope)
      .flatMap(([scope, posts]) => (posts || []).map(post => ({ scope, post })))
      .sort((left, right) => left.post.scheduled_at - right.post.scheduled_at)
      .map(({ scope, post }) => ({ scope, ...this.convertScheduledPost(post) }));
  }

  /**
   * Update the message and/or the delivery time of a pending scheduled post
   * The Loop plugin has no update endpoint, so there the record is recreated:
   * the new one is created before the old one is removed, and the ID changes
   * @param scheduledAt New delivery time as a unix timestamp in milliseconds
   */
  async updateScheduledPost({
    scheduledPostId,
    message,
    scheduledAt,
  }: {
    scheduledPostId: string;
    message?: string;
    scheduledAt?: number;
  }) {
    if ((await this.getSchedulerBackend()) === 'loop-plugin') {
      const existing = await this.findLoopSchedule(scheduledPostId);
      const created = await this.createScheduledPost({
        channelId: existing.post.channel_id,
        message: message === undefined ? existing.post.message : message,
        scheduledAt:
          scheduledAt === undefined
            ? Date.parse(existing.nextDate || existing.startDate)
            : scheduledAt,
        rootId: existing.post.root_id,
        daysOfWeek: existing.daysOfWeek,
      });
      await this.callSchedulerPlugin(
        `/remove?scheduleId=${encodeURIComponent(scheduledPostId)}`,
        'delete',
      );
      return { ...created, replaced_id: scheduledPostId };
    }

    const existing = await this.findScheduledPost(scheduledPostId);
    const { data } = await this.client.updateScheduledPost(
      {
        ...existing,
        message: message === undefined ? existing.message : message,
        scheduled_at: scheduledAt === undefined ? existing.scheduled_at : scheduledAt,
      },
      CONNECTION_ID,
    );
    return this.convertScheduledPost(data);
  }

  /**
   * Delete a pending scheduled post so it is never delivered
   */
  async deleteScheduledPost({ scheduledPostId }: { scheduledPostId: string }) {
    if ((await this.getSchedulerBackend()) === 'loop-plugin') {
      // The plugin answers `success` for an ID it has never seen, so an unknown
      // ID would look deleted; look it up first to keep the report truthful
      await this.findLoopSchedule(scheduledPostId);
      await this.callSchedulerPlugin(
        `/remove?scheduleId=${encodeURIComponent(scheduledPostId)}`,
        'delete',
      );
      return { backend: 'loop-plugin', id: scheduledPostId, status: 'deleted' };
    }

    const me = await this.client.getMe();
    const { data } = await this.client.deleteScheduledPost(me.id, scheduledPostId, CONNECTION_ID);
    return data
      ? this.convertScheduledPost(data)
      : { backend: 'server', id: scheduledPostId, status: 'deleted' };
  }

  /**
   * Create a direct message channel between two users
   * Idempotent — returns existing channel if already exists
   */
  async createDirectChannel({ userIds }: { userIds: [string, string] }) {
    return this.convertChannel(await this.client.createDirectChannel(userIds));
  }

  /**
   * Get channels for the current user
   */
  async getMyChannels() {
    if (!this.teamId) {
      throw new Error('Team ID not set');
    }
    const channels = await this.client.getMyChannels(this.teamId);
    return channels.filter(channel => ['O', 'P'].includes(channel.type)).map(this.convertChannel);
  }

  /**
   * Call the Loop scheduler plugin
   * The plugin answers with HTTP 200 even for failures, so the envelope decides
   */
  private async callSchedulerPlugin<T>(
    path: string,
    method: 'get' | 'post' | 'delete',
    body?: unknown,
  ): Promise<T | undefined> {
    const response = await fetch(`${this.config.url}/plugins/${SCHEDULER_PLUGIN_ID}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.config.token}`,
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(
        `Loop scheduler plugin request failed: ${response.status} ${response.statusText}`,
      );
    }

    const envelope = (await response.json()) as PluginEnvelope<T>;
    if (envelope.result === 'error') {
      const reason = typeof envelope.data === 'string' ? envelope.data : 'unknown error';
      throw new Error(
        `Loop scheduler plugin error: ${reason}${envelope.key ? ` (${envelope.key})` : ''}`,
      );
    }

    return envelope.data;
  }

  private async fetchLoopSchedules(): Promise<LoopSchedule[]> {
    // An empty channelId asks the plugin for every scheduled message of the current user
    const schedules = await this.callSchedulerPlugin<LoopSchedule[]>('/list?channelId=', 'get');
    return schedules || [];
  }

  private async findLoopSchedule(scheduleId: string): Promise<LoopSchedule> {
    const found = (await this.fetchLoopSchedules()).find(schedule => schedule.id === scheduleId);
    if (!found) {
      throw new Error(`Scheduled post with ID '${scheduleId}' not found`);
    }
    return found;
  }

  private convertLoopSchedule(schedule: LoopSchedule) {
    const deliveryDate = schedule.nextDate || schedule.startDate;
    const daysOfWeek = formatDaysOfWeek(schedule.daysOfWeek);

    return {
      backend: 'loop-plugin' as const,
      id: schedule.id,
      user_id: schedule.post.user_id || '',
      channel_id: schedule.post.channel_id,
      root_id: schedule.post.root_id || '',
      message: schedule.post.message,
      scheduled_at: new Date(deliveryDate),
      start_date: new Date(schedule.startDate),
      next_date: schedule.nextDate ? new Date(schedule.nextDate) : '',
      repeat: daysOfWeek.length > 0,
      days_of_week: daysOfWeek,
    };
  }

  private async fetchScheduledPosts(includeDirectChannels: boolean) {
    if (!this.teamId) {
      throw new Error('Team ID not set');
    }
    const { data } = await this.client.getScheduledPosts(this.teamId, includeDirectChannels);
    return data || {};
  }

  private async findScheduledPost(scheduledPostId: string): Promise<ScheduledPost> {
    const byScope = await this.fetchScheduledPosts(true);
    const found = Object.values(byScope)
      .flat()
      .find(post => post && post.id === scheduledPostId);
    if (!found) {
      throw new Error(`Scheduled post with ID '${scheduledPostId}' not found`);
    }
    return found;
  }

  private convertScheduledPost(post: ScheduledPost) {
    return {
      backend: 'server' as const,
      ...post,
      create_at: new Date(post.create_at),
      update_at: new Date(post.update_at),
      scheduled_at: new Date(post.scheduled_at),
      processed_at: post.processed_at ? new Date(post.processed_at) : '',
    };
  }

  private convertPost(post: Post) {
    return {
      ...post,
      create_at: new Date(post.create_at),
      update_at: new Date(post.update_at),
      edit_at: post.edit_at !== 0 ? new Date(post.edit_at) : '',
      delete_at: post.delete_at !== 0 ? new Date(post.delete_at) : '',
    };
  }

  private convertPostList(postList: PostList) {
    return {
      ...postList,
      posts: postList.order.reduce(
        (acc, postId) => ({
          ...acc,
          [postId]: {
            ...postList.posts[postId],
            ...this.convertPost(postList.posts[postId]),
          },
        }),
        {},
      ),
    };
  }

  private convertReaction(reaction: Reaction) {
    return {
      ...reaction,
      create_at: new Date(reaction.create_at),
    };
  }

  private convertChannel(channel: Channel) {
    return {
      ...channel,
      create_at: new Date(channel.create_at),
      update_at: new Date(channel.update_at),
      delete_at: channel.delete_at !== 0 ? new Date(channel.delete_at) : '',
    };
  }

  private convertUserProfile(user: UserProfile) {
    return {
      ...user,
      create_at: new Date(user.create_at),
      update_at: new Date(user.update_at),
      delete_at: user.delete_at !== 0 ? new Date(user.delete_at) : '',
    };
  }
}
