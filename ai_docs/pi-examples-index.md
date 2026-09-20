> Source: [Pi v0.85.1 / packages/coding-agent/examples/README.md](https://github.com/earendil-works/pi/blob/v0.85.1/packages/coding-agent/examples/README.md). Copied from the installed package.

# Examples

Example code for pi-coding-agent SDK and extensions.

## Directories

### [sdk/](pi-sdk-examples-index.md)
Programmatic usage via `createAgentSession()`. Shows how to customize models, prompts, tools, extensions, and session management.

### [extensions/](pi-extension-examples-index.md)
Example extensions demonstrating:
- Lifecycle event handlers (tool interception, safety gates, context modifications)
- Custom tools (todo lists, questions, subagents, output truncation)
- Commands and keyboard shortcuts
- Custom UI (footers, headers, editors, overlays)
- Git integration (checkpoints, auto-commit)
- System prompt modifications and custom compaction
- External integrations (SSH, file watchers, system theme sync)
- Custom providers (Anthropic with custom streaming, GitLab Duo)

### [plugins/pi-example-plugin/](https://github.com/earendil-works/pi/blob/v0.85.1/packages/coding-agent/examples/plugins/pi-example-plugin/)
An experimental plugin package that Pi automatically builds into separate Session-worker and TUI Chord facets.

## Documentation

- [SDK Reference](pi-sdk-examples-index.md)
- [Extensions Documentation](pi-extensions.md)
- [Skills Documentation](pi-skills.md)
