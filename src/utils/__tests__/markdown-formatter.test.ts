import {
  formatMarkdown,
  formatUserMarkdown,
  formatUsersMarkdown,
  formatChannelsMarkdown,
  formatPostListMarkdown,
  formatReactionsMarkdown,
  formatStatusMarkdown,
} from '../markdown-formatter';

const sampleUser = {
  id: 'u1',
  username: 'john',
  first_name: 'John',
  last_name: 'Doe',
  email: 'john@test.com',
  create_at: new Date('2024-01-01'),
  update_at: new Date('2024-01-01'),
  delete_at: '',
};

const sampleUser2 = {
  id: 'u2',
  username: 'jane',
  first_name: 'Jane',
  last_name: 'Smith',
  email: 'jane@test.com',
  create_at: new Date('2024-02-01'),
  update_at: new Date('2024-02-01'),
  delete_at: '',
};

const sampleChannel = {
  id: 'c1',
  name: 'town-square',
  display_name: 'Town Square',
  type: 'O',
  purpose: 'General discussion',
  create_at: new Date('2024-01-01'),
};

const samplePostList = {
  order: ['p1'],
  posts: {
    p1: {
      id: 'p1',
      user_id: 'u1',
      channel_id: 'c1',
      message: 'Hello world',
      create_at: new Date('2024-01-01'),
    },
  },
};

const sampleReaction = {
  emoji_name: 'thumbsup',
  post_id: 'p1',
  user_id: 'u1',
  create_at: new Date('2024-01-01'),
};

describe('formatUserMarkdown', () => {
  it('contains user heading with username', () => {
    const result = formatUserMarkdown(sampleUser);
    expect(result).toContain('## User: @john');
  });

  it('contains ID column and value', () => {
    const result = formatUserMarkdown(sampleUser);
    expect(result).toContain('| ID');
    expect(result).toContain('u1');
  });

  it('contains Status field showing active for non-deleted user', () => {
    const result = formatUserMarkdown(sampleUser);
    expect(result).toContain('| Status');
    expect(result).toContain('active');
  });

  it('shows deleted status for users with delete_at set', () => {
    const deletedUser = { ...sampleUser, delete_at: new Date('2024-06-01') };
    const result = formatUserMarkdown(deletedUser);
    expect(result).toContain('deleted');
  });
});

describe('formatUsersMarkdown', () => {
  it('contains users count heading', () => {
    const result = formatUsersMarkdown([sampleUser, sampleUser2]);
    expect(result).toContain('## Users (2 found)');
  });

  it('contains first username', () => {
    const result = formatUsersMarkdown([sampleUser, sampleUser2]);
    expect(result).toContain('@john');
  });

  it('contains second username', () => {
    const result = formatUsersMarkdown([sampleUser, sampleUser2]);
    expect(result).toContain('@jane');
  });

  it('handles empty list', () => {
    const result = formatUsersMarkdown([]);
    expect(result).toContain('## Users (0 found)');
  });
});

describe('formatChannelsMarkdown', () => {
  it('contains channels count heading', () => {
    const result = formatChannelsMarkdown([sampleChannel]);
    expect(result).toContain('## Channels (1 found)');
  });

  it('contains channel name', () => {
    const result = formatChannelsMarkdown([sampleChannel]);
    expect(result).toContain('town-square');
  });

  it('handles empty list', () => {
    const result = formatChannelsMarkdown([]);
    expect(result).toContain('## Channels (0 found)');
  });
});

describe('formatPostListMarkdown', () => {
  it('contains posts count heading with ordered label', () => {
    const result = formatPostListMarkdown(samplePostList);
    expect(result).toContain('## Posts (1 posts, ordered)');
  });

  it('contains post message', () => {
    const result = formatPostListMarkdown(samplePostList);
    expect(result).toContain('Hello world');
  });

  it('handles empty post list', () => {
    const result = formatPostListMarkdown({ order: [], posts: {} });
    expect(result).toContain('## Posts (0 posts, ordered)');
  });
});

describe('formatReactionsMarkdown', () => {
  it('contains reactions count heading', () => {
    const result = formatReactionsMarkdown([sampleReaction]);
    expect(result).toContain('## Reactions (1 reactions)');
  });

  it('contains emoji name in colon notation', () => {
    const result = formatReactionsMarkdown([sampleReaction]);
    expect(result).toContain(':thumbsup:');
  });

  it('handles empty reactions list', () => {
    const result = formatReactionsMarkdown([]);
    expect(result).toContain('## Reactions (0 reactions)');
  });
});

describe('formatStatusMarkdown', () => {
  it('contains Success heading', () => {
    const result = formatStatusMarkdown({ status: 'OK' });
    expect(result).toContain('## Success');
  });

  it('contains json block with status key', () => {
    const result = formatStatusMarkdown({ status: 'OK' });
    expect(result).toContain('"status"');
  });

  it('contains the actual status value', () => {
    const result = formatStatusMarkdown({ status: 'OK' });
    expect(result).toContain('"OK"');
  });
});

describe('formatMarkdown dispatcher', () => {
  it('dispatches get-me to user formatter', () => {
    const result = formatMarkdown(sampleUser, 'get-me');
    expect(result).toContain('## User:');
  });

  it('dispatches search-users with array to users formatter', () => {
    const result = formatMarkdown([sampleUser], 'search-users');
    expect(result).toContain('## Users (');
  });

  it('dispatches search-posts with post list to post list formatter', () => {
    const result = formatMarkdown(samplePostList, 'search-posts');
    expect(result).toContain('## Posts (');
  });

  it('dispatches pin-post to status formatter', () => {
    const result = formatMarkdown({ status: 'OK' }, 'pin-post');
    expect(result).toContain('## Success');
  });

  it('dispatches get-reactions with array to reactions formatter', () => {
    const result = formatMarkdown([sampleReaction], 'get-reactions');
    expect(result).toContain('## Reactions (');
  });

  it('dispatches get-channels with array to channels formatter', () => {
    const result = formatMarkdown([sampleChannel], 'get-channels');
    expect(result).toContain('## Channels (');
  });

  it('dispatches unknown command with object to status formatter', () => {
    const result = formatMarkdown({ foo: 'bar' }, 'unknown-command');
    expect(result).toContain('## Success');
  });
});
