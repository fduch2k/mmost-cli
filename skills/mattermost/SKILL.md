---
name: mattermost
description: Read, search, and interact with Mattermost chat using the `mmost` CLI. Use this skill when the user mentions Mattermost, chat messages, team chat, unread messages, DMs, channel history, mentions, sending messages, replying to threads, reactions, pinning posts, or wants to catch up on what happened in chat. Also triggers when the user asks about specific people's messages, channel activity, searching for something someone said, checking notifications, or wants to send a message or react to a post.
---

# Mattermost CLI (`mmost`)

Read, search, and interact with Mattermost from the command line. JSON output by default, `--human` for markdown.

## Setup

Check if `mmost` is already available:

```bash
mmost get-me
```

If that works, skip to "How to use" below.

If `mmost` is not found, install it:

```bash
npm install -g @fduch2k/mmost-cli
# or run without installing:
npx @fduch2k/mmost-cli get-me
```

Configure environment variables:

| Variable               | Description                | Required          |
| ---------------------- | -------------------------- | ----------------- |
| `MATTERMOST_URL`       | Mattermost server base URL | Yes               |
| `MATTERMOST_TOKEN`     | Personal access token      | Yes               |
| `MATTERMOST_TEAM_ID`   | Team ID                    | One of ID or Name |
| `MATTERMOST_TEAM_NAME` | Team name                  | One of ID or Name |

## How to use

Run `mmost --help` for the full command list and `mmost help <command>` for details on any command. The CLI has 17 commands:

**Users**: `get-me`, `get-users`, `search-users`
**Channels**: `search-channels`, `get-channels`, `get-my-channels`
**Posts**: `search-posts`, `get-posts`, `get-posts-unread`, `create-post`, `get-posts-thread`, `pin-post`, `unpin-post`, `get-posts-pinned`
**Reactions**: `add-reaction`, `remove-reaction`, `get-reactions`

## ID resolution

Most commands require IDs, not names. Only these accept human-readable input:

- `get-users --username` / `get-channels --name` — lookup by name directly
- `search-users --term` / `search-channels --term` — search and extract `id` from results
- `search-posts --terms` — supports `from:<user>` and `in:<channel>` modifiers

For everything else, resolve the ID first:

```bash
# Channel name → ID
mmost search-channels --term "devops"       # extract id from result
mmost get-posts-unread --channel-id <id>    # use the ID

# Username → user ID
mmost get-users --username alice            # extract id from result

# user_id from a post → username
mmost get-users --user-id <user_id>         # batch: --user-id id1,id2,id3
```

## Safety: write operations

These commands modify data. **Always confirm with the user before executing.**

- `create-post` — sends a message (or thread reply with `--root-id`)
- `pin-post` / `unpin-post` — pins or unpins a post
- `add-reaction` / `remove-reaction` — adds or removes emoji reactions

Pattern: draft the action → show to user → get explicit "yes" → execute.

## Key JSON fields

Posts return raw Mattermost API objects. Key navigation fields:

| Field         | What it's for                                                       |
| ------------- | ------------------------------------------------------------------- |
| `id`          | Post/channel/user identifier — pass to other commands               |
| `user_id`     | Author's user ID (not username) — resolve via `get-users --user-id` |
| `channel_id`  | Channel where the post lives — pass to `--channel-id`               |
| `root_id`     | Thread root post ID (empty if not a reply) — pass to `--root-id`    |
| `message`     | Post text content                                                   |
| `reply_count` | Number of replies (on root posts)                                   |
| `is_pinned`   | Whether the post is pinned                                          |
| `type`        | Channel type: `O` (public), `P` (private), `D` (DM), `G` (group DM) |
| `username`    | On user profiles — the human-readable username                      |

## Known limitations

- **No overview command** — compose triage: `get-my-channels` → `get-posts-unread` per channel
- **No mentions command** — use `get-me` to get username, then `search-posts --terms "@username"`
- **No time filters** — no `--since` flag; use `search-posts` date modifiers (`after:`, `before:`, `on:`) instead
- **`get-my-channels` excludes DMs** — returns public (O) and private (P) only; use `search-channels` for specific channels
- **IDs required** — see "ID resolution" above
