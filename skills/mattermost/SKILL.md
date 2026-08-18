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

Run `mmost --help` for the full command list and `mmost help <command>` for details on any command. The CLI has 19 commands:

**Users**: `get-me`, `get-users`, `search-users`
**Channels**: `search-channels`, `get-channels`, `get-my-channels`, `create-dm`
**Posts**: `search-posts`, `get-posts`, `get-posts-unread`, `create-post`, `update-post`, `get-posts-thread`, `pin-post`, `unpin-post`, `get-posts-pinned`
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
- `update-post` — replaces the message text of an existing post (own posts only)
- `create-dm` — creates a DM channel between two users (idempotent)
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

## Command Reference (exact syntax)

⚠️ **Use ONLY these flags. Do NOT invent flags like `--post-id` for commands that use `--root-id`.**

```
get-me                                          # no args
get-users       [--username <str>] [--user-id <str>]
search-users    --term <str> [--page <n>] [--per-page <n>]
search-channels --term <str> [--page <n>] [--per-page <n>]
get-channels    [--channel-id <str>] [--name <str>]
get-my-channels                                 # no args
create-dm       --user-id <id1>,<id2>           # exactly 2 user IDs
search-posts    --terms <str> [--page <n>] [--per-page <n>]
get-posts       --post-id <str>                 # comma-separated IDs
get-posts-unread --channel-id <str>
get-posts-thread --root-id <str> [--from-post <str>] [--per-page <n>]
create-post     --channel-id <str> --message <str> [--root-id <str>]
update-post     --post-id <str> --message <str>
pin-post        --post-id <str>
unpin-post      --post-id <str>
get-posts-pinned --channel-id <str>
add-reaction    --post-id <str> --emoji-name <str>
remove-reaction --post-id <str> --emoji-name <str>
get-reactions   --post-id <str>
```

### Common gotchas

| Want to...             | ✅ Correct                           | ❌ Wrong                          |
| ---------------------- | ------------------------------------ | --------------------------------- |
| Read a thread          | `get-posts-thread --root-id <id>`    | `get-posts-thread --post-id <id>` |
| Read specific posts    | `get-posts --post-id <id>`           | `get-posts --root-id <id>`        |
| Read unread in channel | `get-posts-unread --channel-id <id>` | `get-posts-unread --post-id <id>` |
| Edit a post            | `update-post --post-id <id>`         | `create-post --post-id <id>`      |

### URL → post ID extraction

Mattermost permalink format: `https://<host>/<team>/pl/<post_id>`
Extract `<post_id>` from the URL and use it as `--root-id` for threads or `--post-id` for single posts.

### Sending a DM

To send a direct message, create (or get existing) DM channel first, then post into it:

```bash
# 1. Resolve usernames → IDs
mmost get-users --username alice            # extract id
mmost get-me                                # your own id

# 2. Create/get DM channel (idempotent — returns existing if already exists)
mmost create-dm --user-id <your_id>,<alice_id>

# 3. Send message using the returned channel id
mmost create-post --channel-id <dm_channel_id> --message "Hey!"
```

### Editing a post

`update-post` replaces the whole message — read the current text first, edit it, then send the full new body:

```bash
mmost get-posts --post-id <post_id>                          # take `message`, apply your change
mmost update-post --post-id <post_id> --message "<full new text>"
```

- Only your own posts can be edited; someone else's post returns a permission error.
- `edit_at` becomes non-empty in the response — that confirms the edit landed.
- **Editing sends no notifications.** If people need to know about the change, add a reply in the thread: `create-post --root-id <post_id>`.

## Known limitations

- **No overview command** — compose triage: `get-my-channels` → `get-posts-unread` per channel
- **No mentions command** — use `get-me` to get username, then `search-posts --terms "@username"`
- **No time filters** — no `--since` flag; use `search-posts` date modifiers (`after:`, `before:`, `on:`) instead
- **`get-my-channels` excludes DMs** — returns public (O) and private (P) only; use `create-dm` to get a specific DM channel or `search-channels` for lookup
- **IDs required** — see "ID resolution" above
