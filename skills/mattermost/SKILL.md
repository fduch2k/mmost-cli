---
name: mattermost
description: Read, search, interact with and monitor Mattermost chat using the `mmost` CLI. Use this skill when the user mentions Mattermost, chat messages, team chat, unread messages, DMs, channel history, mentions, sending messages, replying to threads, reactions, pinning posts, or wants to catch up on what happened in chat. Also triggers when the user asks about specific people's messages, channel activity, searching for something someone said, checking notifications, or wants to send a message or react to a post. Also use it to watch a channel or thread for new, edited or deleted messages — poll for changes since a cursor, block until someone replies, or stream changes — instead of writing a custom poll loop.
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

Run `mmost --help` for the full command list and `mmost help <command>` for details on any command. The CLI has 24 commands:

**Users**: `get-me`, `get-users`, `search-users`
**Channels**: `search-channels`, `get-channels`, `get-my-channels`, `create-dm`
**Posts**: `search-posts`, `get-posts`, `get-posts-unread`, `create-post`, `update-post`, `get-posts-thread`, `pin-post`, `unpin-post`, `get-posts-pinned`
**Monitoring**: `watch-posts`
**Scheduled posts**: `create-scheduled-post`, `get-scheduled-posts`, `update-scheduled-post`, `delete-scheduled-post`
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
- `create-scheduled-post` — queues a message for later delivery by the server
- `update-scheduled-post` / `delete-scheduled-post` — changes or cancels a pending scheduled message
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
watch-posts     (--channel-id <str> | --root-id <str>) [--since <cursor>] [--events <list>]
                [--include-self] [--wait | --follow] [--interval 15s] [--timeout 15m]
create-post     --channel-id <str> --message <str> [--root-id <str>]
update-post     --post-id <str> --message <str>
create-scheduled-post --channel-id <str> --message <str> --at <time> [--root-id <str>] [--days mon,fri]
get-scheduled-posts   [--exclude-dms]
update-scheduled-post --scheduled-post-id <str> [--message <str>] [--at <time>]
delete-scheduled-post --scheduled-post-id <str>
pin-post        --post-id <str>
unpin-post      --post-id <str>
get-posts-pinned --channel-id <str>
add-reaction    --post-id <str> --emoji-name <str>
remove-reaction --post-id <str> --emoji-name <str>
get-reactions   --post-id <str>
```

### Common gotchas

| Want to...             | ✅ Correct                                                  | ❌ Wrong                                              |
| ---------------------- | ----------------------------------------------------------- | ----------------------------------------------------- |
| Read a thread          | `get-posts-thread --root-id <id>`                           | `get-posts-thread --post-id <id>`                     |
| Read specific posts    | `get-posts --post-id <id>`                                  | `get-posts --root-id <id>`                            |
| Read unread in channel | `get-posts-unread --channel-id <id>`                        | `get-posts-unread --post-id <id>`                     |
| Edit a post            | `update-post --post-id <id>`                                | `create-post --post-id <id>`                          |
| Watch a thread         | `watch-posts --root-id <id>`                                | `watch-posts --post-id <id>`                          |
| Start watching         | `watch-posts --root-id <id>` first, then `--since <cursor>` | `watch-posts --root-id <id> --wait` with no `--since` |
| Last 2 hours           | `watch-posts --root-id <id> --since -2h`                    | `watch-posts --root-id <id> --since +2h`              |

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

### Scheduled messages

`create-scheduled-post` hands a message to the server for later delivery. `--at` accepts a relative
offset (`+30m`, `+2h`, `+1d`, `+1w`), ISO-8601 (`2026-08-25T09:30:00Z`, `2026-08-25T09:30:00+03:00`),
a quoted local time (`"2026-08-25 09:30"` — quotes are required, it contains a space) or a unix
timestamp in seconds/milliseconds. Times in the past are rejected before any request is sent.

```bash
mmost create-scheduled-post --channel-id <cid> --message "Standup in 10 min" --at +2h
mmost create-scheduled-post --channel-id <cid> --message "Standup" --at +1d --days mon,wed,fri
mmost get-scheduled-posts                      # pending, earliest first; take `id`
mmost update-scheduled-post --scheduled-post-id <id> --at +1d     # reschedule
mmost delete-scheduled-post --scheduled-post-id <id>              # cancel delivery
```

**Two backends, picked automatically.** Loop implements scheduled messages as the
`ru.loop.plugin.scheduler` plugin, not through the upstream `/api/v4/posts/schedule` API. The CLI
detects which one the server has and reports it in the `backend` field of every response.

|                         | `loop-plugin` (Loop)                                              | `server` (upstream Mattermost) |
| ----------------------- | ----------------------------------------------------------------- | ------------------------------ |
| `--days` weekly repeat  | works                                                             | rejected with a clear error    |
| `--exclude-dms`         | ignored, warning on stderr                                        | honoured                       |
| `update-scheduled-post` | recreates the record — **ID changes**, response has `replaced_id` | updates in place               |

Other things worth knowing:

- `--scheduled-post-id` comes from `get-scheduled-posts`, **not** from `get-posts` — a scheduled
  message has no post ID until it is delivered.
- `update-scheduled-post` needs at least one of `--message` or `--at`; untouched fields are preserved,
  including the repeat days on Loop.
- On the upstream backend, `scope` is the server's grouping key (team ID or its direct-channels key)
  and `error_code` (`channel_archived`, `no_channel_permission`, …) marks a post the server kept
  pending instead of delivering.
- **`Sorry, we could not find the page.` means the server has no scheduled messages API** — neither
  the Loop plugin nor `/api/v4/posts/schedule` (e.g. Mattermost 10.5.0 without the plugin). Fall back
  to `create-post` and say the server does not support scheduling.

## Watching for new messages

`watch-posts` replaces a hand-rolled poll loop. It is cursor-based and keeps no state of its own:
the cursor comes back in every response and you pass it to the next call.

```bash
# 1. Baseline — returns a cursor and no changes, so nothing already in the channel is replayed
CUR=$(mmost watch-posts --root-id <root> | jq -r .cursor)

# 2. Ask what changed. Repeat with the cursor from each response
mmost watch-posts --root-id <root> --since "$CUR"

# 2b. Or skip the baseline entirely and name a moment: -30m, -2h, -1d, -1w,
#     ISO-8601 (2026-09-04T12:00:00Z) or a unix timestamp
mmost watch-posts --root-id <root> --since -2h

# 3. Or block until something changes, then exit (best for an agent: run it in the background
#    and the harness wakes you when the process exits)
mmost watch-posts --root-id <root> --since "$CUR" --wait --timeout 30m

# 4. Or stream, one NDJSON line per change, until killed
mmost watch-posts --channel-id <id> --since "$CUR" --follow --interval 30s
```

Each change is `{event, post_id, user_id, root_id, create_at, update_at, message}`.

| Event     | Meaning                                                                                                                                                           |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `created` | a new post                                                                                                                                                        |
| `edited`  | an existing post's text changed                                                                                                                                   |
| `deleted` | a post was removed (`message` is empty — the server blanks it)                                                                                                    |
| `updated` | `update_at` moved with no text change: a reaction, a pin, or a reply added to a thread. **Cause not reported**, and withheld unless you ask for it via `--events` |

### Rules that matter

- **Your own posts are skipped** unless `--include-self`. An agent that posts into the thread it
  watches would otherwise wake itself in a loop.
- **`--wait` and `--follow` require `--since`.** Take a baseline first; there is no "watch from the
  beginning of time" mode, because that replays the channel.
- **A timeout is not an error.** `--wait` returns `timed_out: true` with the cursor unchanged, exit
  code 0. Pass that cursor straight back in.
- **Treat the cursor as opaque.** It is `<ms>:<id>,<id>` — the timestamp alone loses messages
  written in the same millisecond.
- **`--since` also takes a human moment**: `-2h`, `-1d`, ISO-8601, or a unix timestamp. Use it for a
  one-off "what happened in the last N" without a baseline call. A moment is inclusive of that
  millisecond, and a moment in the **future** is rejected (it would report nothing until it arrives).
- **A thread is watched through its channel**, so `--root-id` needs no separate channel id, and
  edits/deletions of old replies are reported (the thread API cannot report them).
- **`--follow` is JSON-only** — it cannot be combined with `--human`.
- A transient failure is retried (5 consecutive failures abort); retries go to stderr, so stdout
  stays parseable.

## Known limitations

- **No overview command** — compose triage: `get-my-channels` → `get-posts-unread` per channel
- **No mentions command** — use `get-me` to get username, then `search-posts --terms "@username"`
- **No time filters on search** — `search-posts` has no `--since`; use its date modifiers (`after:`, `before:`, `on:`). For change monitoring use `watch-posts`
- **`watch-posts` polls, it does not push** — latency is one `--interval`; there is no websocket mode
- **`watch-posts` cannot say why an `updated` fired** — reaction, pin and reply-count bumps are indistinguishable over REST
- **Scheduled posts need server support** — see "Scheduled messages"; without the Loop plugin or the upstream API the commands 404
- **No admin view of others' scheduled messages** — the Loop plugin exposes it only to `system_admin`, and the CLI does not use it
- **`get-my-channels` excludes DMs** — returns public (O) and private (P) only; use `create-dm` to get a specific DM channel or `search-channels` for lookup
- **IDs required** — see "ID resolution" above
