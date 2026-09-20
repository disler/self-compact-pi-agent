> Source: [Pi v0.85.1 / packages/coding-agent/docs/index.md](https://github.com/earendil-works/pi/blob/v0.85.1/packages/coding-agent/docs/index.md). Copied from the installed package.

# Pi Documentation

Pi is a minimal terminal coding harness. It is designed to stay small at the core while being extended through TypeScript extensions, skills, prompt templates, themes, and pi packages.

## Quick start

Install Pi with npm:

```bash
npm install -g --ignore-scripts @earendil-works/pi-coding-agent
```

`--ignore-scripts` disables dependency lifecycle scripts during install. Pi does not require install scripts for normal npm installs.

On Linux or macOS, you can also use the installer:

```bash
curl -fsSL https://pi.dev/install.sh | sh
```

To uninstall pi itself, use npm for curl and npm installs:

```bash
npm uninstall -g @earendil-works/pi-coding-agent
```

For pnpm, Yarn, or Bun installs, use the matching global remove command: `pnpm remove -g @earendil-works/pi-coding-agent`, `yarn global remove @earendil-works/pi-coding-agent`, or `bun uninstall -g @earendil-works/pi-coding-agent`.

Then run it in a project directory:

```bash
pi
```

Authenticate with `/login` for subscription providers, or set an API key such as `ANTHROPIC_API_KEY` before starting pi.

For the full first-run flow, see [Quickstart](pi-quickstart.md).

## Start here

- [Quickstart](pi-quickstart.md) - install, authenticate, and run a first session.
- [Using Pi](pi-usage.md) - interactive mode, slash commands, context files, and CLI reference.
- [Providers](pi-providers.md) - subscription and API-key setup for built-in providers.
- [llama.cpp](pi-llama-cpp.md) - run a local router and manage models with `/llama`.
- [Security](pi-security.md) - project trust, sandbox boundaries, and vulnerability reporting.
- [Containerization](pi-containerization.md) - sandbox pi with Gondolin, Docker, or OpenShell.
- [Settings](pi-settings.md) - global and project settings.
- [Keybindings](pi-keybindings.md) - default shortcuts and custom keybindings.
- [Sessions](pi-sessions.md) - session management, branching, and tree navigation.
- [Compaction](pi-compaction.md) - context compaction and branch summarization.

## Customization

- [Extensions](pi-extensions.md) - TypeScript modules for tools, commands, events, and custom UI.
- [Skills](pi-skills.md) - Agent Skills for reusable on-demand capabilities.
- [Prompt templates](pi-prompt-templates.md) - reusable prompts that expand from slash commands.
- [Themes](pi-themes.md) - built-in and custom terminal themes.
- [Pi packages](pi-packages.md) - bundle and share extensions, skills, prompts, and themes.
- [Custom models](pi-models.md) - add model entries for supported provider APIs.
- [Custom providers](pi-custom-provider.md) - implement custom APIs and OAuth flows.

## Programmatic usage

- [SDK](pi-sdk.md) - embed pi in Node.js applications.
- [RPC mode](pi-rpc.md) - integrate over stdin/stdout JSONL.
- [JSON event stream mode](pi-json.md) - print mode with structured events.
- [TUI components](pi-tui.md) - build custom terminal UI for extensions.

## Reference

- [Environment variables](pi-environment-variables.md) - Pi process configuration and session metadata available to bash tools.
- [Session format](pi-session-format.md) - JSONL session file format, entry types, and SessionManager API.

## Platform setup

- [Windows](pi-windows.md)
- [Termux on Android](pi-termux.md)
- [tmux](pi-tmux.md)
- [Terminal setup](pi-terminal-setup.md)
- [Shell aliases](pi-shell-aliases.md)

## Development

- [Development](pi-development.md) - local setup, project structure, and debugging.
