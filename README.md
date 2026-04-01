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
- `search-posts` (`--terms`, `--page`, `--per-page`)
- `get-posts` (`--post-id`)
- `get-posts-unread` (`--channel-id`)
- `create-post` (`--channel-id`, `--message`, `--root-id`)
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
mmost add-reaction --post-id post123 --emoji-name +1,eyes
```

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
