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
```

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
