# mmost CLI

`mmost` is a command-line utility for interacting with Mattermost.

## Installation

```bash
npm install -g @fduch2k/mmost-cli
```

or

```bash
npx @fduch2k/mmost-cli --help
```

## Configuration

Set environment variables before running commands:

| Variable Name          | Description                      | Required |
| ---------------------- | -------------------------------- | -------- |
| `MATTERMOST_URL`       | Mattermost base URL              | Yes      |
| `MATTERMOST_TOKEN`     | Mattermost personal access token | Yes      |
| `MATTERMOST_TEAM_ID`   | Mattermost team ID               | No\*     |
| `MATTERMOST_TEAM_NAME` | Mattermost team name             | No\*     |

\* Provide at least one of `MATTERMOST_TEAM_ID` or `MATTERMOST_TEAM_NAME`.

## Usage

```bash
mmost <command> [--option value]
```

Get full help:

```bash
mmost --help
```

Get command-specific help:

```bash
mmost help create-post
```

## Output Format

By default, all commands output **JSON** (agent-friendly format).

Use `--human` to get human-readable **Markdown** output:

```bash
mmost search-users --term john --human
mmost get-me --human
mmost --help --human
```

Use `--json` to explicitly request JSON (same as default):

```bash
mmost search-users --term john --json
```

> `--json` and `--human` are mutually exclusive. Using both together produces an error.

## Commands

- `get-me`
- `get-users` (`--username` or `--user-id`)
- `search-users` (`--term`, `--page`, `--per-page`)
- `search-channels` (`--term`, `--page`, `--per-page`)
- `get-channels` (`--channel-id` or `--name`)
- `get-my-channels`
- `create-dm` (`--user-id`)
- `search-posts` (`--terms`, `--page`, `--per-page`)
- `get-posts` (`--post-id`)
- `get-posts-unread` (`--channel-id`)
- `create-post` (`--channel-id`, `--message`, `--root-id`)
- `update-post` (`--post-id`, `--message`)
- `create-scheduled-post` (`--channel-id`, `--message`, `--at`, `--root-id`, `--days`, `--repeat`)
- `get-scheduled-posts` (`--exclude-dms`)
- `update-scheduled-post` (`--scheduled-post-id`, `--message`, `--at`)
- `delete-scheduled-post` (`--scheduled-post-id`)
- `get-posts-thread` (`--root-id`, `--from-post`, `--per-page`)
- `watch-posts` (`--channel-id` or `--root-id`, `--since`, `--events`, `--include-self`, `--wait`, `--follow`, `--interval`, `--timeout`)
- `pin-post` (`--post-id`)
- `unpin-post` (`--post-id`)
- `get-posts-pinned` (`--channel-id`)
- `add-reaction` (`--post-id`, `--emoji-name`)
- `remove-reaction` (`--post-id`, `--emoji-name`)
- `get-reactions` (`--post-id`)

## Examples

```bash
mmost search-users --term john
mmost search-users --term john --human
mmost get-channels --name town-square,off-topic
mmost create-post --channel-id abc123 --message "Release is live"
mmost update-post --post-id post123 --message "Release is live (fixed link)"
mmost create-dm --user-id user1_id,user2_id
mmost add-reaction --post-id post123 --emoji-name +1,eyes
mmost create-scheduled-post --channel-id abc123 --message "Standup in 10 minutes" --at +2h
mmost get-scheduled-posts --human
mmost update-scheduled-post --scheduled-post-id sp123 --at 2026-08-25T09:30:00Z
mmost delete-scheduled-post --scheduled-post-id sp123
mmost watch-posts --root-id post123
mmost watch-posts --root-id post123 --since 1788526075811 --wait --timeout 30m
```

## Watching for new messages

`watch-posts` reports what changed in a channel or a thread since a cursor. It is meant to replace a
hand-written poll loop — an agent can run it instead of maintaining its own seen-set on disk.

The command keeps no state. Every response carries a `cursor`; you pass it to the next call.

```bash
# Baseline: a cursor and no changes, so nothing already in the channel is replayed
CUR=$(mmost watch-posts --root-id post123 | jq -r .cursor)

# What changed since then
mmost watch-posts --root-id post123 --since "$CUR"

# Or skip the baseline and name a moment directly
mmost watch-posts --root-id post123 --since -2h

# Block until something changes, print it, exit
mmost watch-posts --root-id post123 --since "$CUR" --wait --timeout 30m

# Stream changes as NDJSON, one line per change, until killed
mmost watch-posts --channel-id abc123 --since "$CUR" --follow --interval 30s
```

Each change looks like:

```json
{
  "event": "created",
  "post_id": "c53cwwoabpnwuc1wrufyuqhzpc",
  "user_id": "bhjn71fof7g1f8dzoywexkwueh",
  "root_id": "ytpyrikuz7f67nqk5rnysuqbuo",
  "create_at": "2026-09-04T12:47:52.316Z",
  "update_at": "2026-09-04T12:47:52.316Z",
  "message": "follow line 1"
}
```

| Event     | Meaning                                                                                                                                                                     |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `created` | a new post                                                                                                                                                                  |
| `edited`  | the text of an existing post changed                                                                                                                                        |
| `deleted` | a post was removed; `message` is empty because the server blanks it                                                                                                         |
| `updated` | `update_at` moved with no text change — a reaction, a pin, or a reply added to a thread. The cause is not reported, and the event is withheld unless `--events` asks for it |

### Three modes

|           | one-shot (default)            | `--wait`                                       | `--follow`                                  |
| --------- | ----------------------------- | ---------------------------------------------- | ------------------------------------------- |
| Output    | one JSON window               | one JSON window                                | NDJSON, one line per change                 |
| Exits     | immediately                   | on the first change, or at `--timeout`         | when killed (or at an explicit `--timeout`) |
| Built for | a caller driving its own loop | a background process whose exit wakes an agent | a live event stream                         |

`--wait` and `--follow` both require `--since`: there is no "watch from the beginning" mode, because
that replays the channel. Take a baseline first.

A timeout is a normal result, not an error — `--wait` returns `timed_out: true` with the cursor
unchanged and exit code 0, so the cursor can go straight back into the next call.

### What `--since` accepts

| Form                             | Example                                                                   |
| -------------------------------- | ------------------------------------------------------------------------- |
| Cursor from a previous run       | `1788526075811:c53cwwoabpnwuc1wrufyuqhzpc`                                |
| Relative offset into the past    | `-30m`, `-2h`, `-1d`, `-1w`                                               |
| ISO-8601 (UTC, offset, or local) | `2026-09-04T12:00:00Z`, `2026-09-04T15:00:00+03:00`, `"2026-09-04 15:00"` |
| Unix timestamp                   | `1788526075` (seconds) or `1788526075811` (ms)                            |

A moment carries no id list, so it means "everything from that millisecond on, inclusive". It is the
mirror of `--at`: `-2h` rather than `+2h`, and the **future** is what gets rejected — a cursor set
ahead of the clock reports nothing until it arrives, which is indistinguishable from a quiet channel.
Cursors from the server are taken verbatim and never checked against the clock.

### Details that bite

- **Your own posts are skipped** unless `--include-self`. An agent that posts into the thread it is
  watching would otherwise wake itself, forever.
- **The cursor is opaque.** It looks like `<ms>:<id>,<id>`; the id list covers posts sharing the
  cursor's millisecond, which a bare timestamp would silently drop (`since` is exclusive on the
  server, and an edit writes two rows with one timestamp).
- **A thread is watched through its channel**, not through the thread API. `--root-id` therefore
  needs no channel id, and edits and deletions of older replies are reported — the thread endpoint is
  cursored on `create_at` and cannot report them at all.
- **Editing a post makes the server emit an extra deleted record** (the archived previous version,
  linked by `original_id`). Those are dropped, so one edit is one `edited` event, not an edit plus a
  phantom deletion. A delete of a twice-edited post arrives as three records and is reported once.
- **Polling, not push.** Latency is one `--interval` (default 15s). There is no websocket mode.
- **Transient failures are retried** — five consecutive failures abort. Retry notices go to stderr so
  stdout stays parseable.
- `--follow` is JSON-only and rejects `--human`.

## Scheduled messages

`create-scheduled-post` hands the message to the server, which delivers it later. `--at` accepts:

| Format            | Example                                          |
| ----------------- | ------------------------------------------------ |
| Relative offset   | `+90s`, `+30m`, `+2h`, `+1d`, `+1w`              |
| ISO-8601 (UTC)    | `2026-08-25T09:30:00Z`                           |
| ISO-8601 (offset) | `2026-08-25T09:30:00+03:00`                      |
| Local time        | `"2026-08-25 09:30"` (quote it — it has a space) |
| Unix timestamp    | `1787500425` (seconds) or `1787500425275` (ms)   |

The time must be in the future; otherwise the command fails without contacting the server.

`get-scheduled-posts` returns pending posts ordered by delivery time. Each item carries a `scope`
field — the response key the server grouped the post under (the team ID, or its direct-channels key
for DMs and group DMs). Pass `--exclude-dms` to ask the server for team channels only.

`--days mon,wed,fri` schedules a weekly repeat (it implies `--repeat`). Repeating schedules only
exist on Loop servers; upstream Mattermost rejects them.

### Two backends, detected automatically

Scheduled messages are implemented differently depending on the server, so the CLI checks
`/api/v4/plugins/webapp` once per run and picks the backend. Every response carries a `backend` field.

|                          | `loop-plugin`                                                                                             | `server`                 |
| ------------------------ | --------------------------------------------------------------------------------------------------------- | ------------------------ |
| API                      | `/plugins/ru.loop.plugin.scheduler/{create,list,remove}`                                                  | `/api/v4/posts/schedule` |
| Detected when            | the `ru.loop.plugin.scheduler` plugin is installed                                                        | it is not                |
| Weekly repeat (`--days`) | supported                                                                                                 | rejected                 |
| `--exclude-dms`          | ignored (warning on stderr) — the plugin always lists everything                                          | honoured                 |
| `update-scheduled-post`  | no update endpoint, so the record is recreated: **the ID changes** and the response carries `replaced_id` | in-place update          |

On a server with neither, the commands fail with `Sorry, we could not find the page.` — that means the
server has no scheduled messages API at all, not that the arguments are wrong.

## Agent Skill

Install the Mattermost skill for your coding agent:

```bash
npx skills add fduch2k/mmost-cli
```

This installs the `mattermost` skill from `skills/mattermost/SKILL.md` into your agent's skill directory. Supports OpenCode, Claude Code, Cursor, Codex, and [40+ other agents](https://github.com/vercel-labs/skills#supported-agents).

All commands output JSON by default — no flags needed for agent use:

```bash
mmost --help
mmost help create-post
```

To get human-readable output:

```bash
mmost --help --human
mmost help create-post --human
```

## Credits

Based on [mcp-mattermost](https://github.com/dakatan/mcp-mattermost) by [@dakatan](https://github.com/dakatan).
