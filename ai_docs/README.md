# Pi Documentation for the Self-Compact Build

This is the local reference bundle for building the self-compacting Pi extension across SOTA and open-weight model runs. Give every builder the same plan and this same documentation snapshot.

## Source and scope

- Snapshot: `@earendil-works/pi-coding-agent` v0.85.1, plus matching `pi-ai`, `pi-agent-core`, and `pi-tui` API documentation.
- Includes all 30 Markdown pages shipped in the coding-agent `docs/` directory, its complete main README, API dependency READMEs, example catalogs, 12 selected extension examples, and all 13 SDK examples.
- Documentation bodies are complete, not summaries. Source metadata was added and navigation links were adapted to this flat folder.
- Bundled references link to local Markdown files. Non-bundled source files, examples, and images link to the verified upstream `v0.85.1` tag.
- TypeScript examples are preserved in fenced Markdown for reading, not installed or executed.
- No existing self-compact implementation, private harness extensions, credentials, or user settings are included.
- Match the runtime version to this snapshot when comparing builds. Do not assume older Pi package names or lifecycle behavior apply.

## Read first for this build

1. [CLI and loading](pi-coding-agent.md): `pi -e`, model selection, tools, and session behavior.
2. [Extensions](pi-extensions.md) and [compaction](pi-compaction.md): flags, tool registration, tool preflight, lifecycle events, usage, summary hooks, and continuation.
3. [Session format](pi-session-format.md) and [settings](pi-settings.md): durable notes, compaction entries, recent-history retention, and isolated test settings.
4. [TUI](pi-tui.md), [themes](pi-themes.md), and [custom footer](example-extension-custom-footer.md): the 20-cell context bar and visible progress states.
5. [Providers](pi-providers.md), [models](pi-models.md), [custom providers](pi-custom-provider.md), and [Pi AI](pi-ai.md): running different SOTA and open-weight models with the correct provider configuration.
6. [RPC](pi-rpc.md), [JSON events](pi-json.md), [SDK](pi-sdk.md), and [agent core](pi-agent-core.md): automated checks, completion events, and bounded live validation.

## Useful examples and cautions

- [Dynamic tools](example-extension-dynamic-tools.md), [tool override](example-extension-tool-override.md), and [structured output](example-extension-structured-output.md) illustrate tool selection, interception, and termination APIs.
- [Entry rendering](example-extension-entry-renderer.md), [message rendering](example-extension-message-renderer.md), and [sending user messages](example-extension-send-user-message.md) distinguish visible entries from messages that start work.
- [Custom compaction](example-extension-custom-compaction.md) and [trigger compaction](example-extension-trigger-compact.md) demonstrate APIs, not the desired self-compact policy. The build plan requires idle-only compaction and keeping the note and tool lock after failure, even where an example shows different behavior.
- A terminating tool result does not cancel already-running sibling tools. Use the documented preflight and lifecycle behavior rather than assuming prompt instructions enforce tool access.
- Context usage and post-compaction sizes are estimates. Provider availability and model quality are not validated by copying documentation.

## Complete file index

### Overview

- [pi-coding-agent.md](pi-coding-agent.md)

### Coding-agent documentation

- [pi-compaction.md](pi-compaction.md)
- [pi-containerization.md](pi-containerization.md)
- [pi-custom-provider.md](pi-custom-provider.md)
- [pi-development.md](pi-development.md)
- [pi-environment-variables.md](pi-environment-variables.md)
- [pi-extensions.md](pi-extensions.md)
- [pi-index.md](pi-index.md)
- [pi-json.md](pi-json.md)
- [pi-keybindings.md](pi-keybindings.md)
- [pi-llama-cpp.md](pi-llama-cpp.md)
- [pi-models.md](pi-models.md)
- [pi-packages.md](pi-packages.md)
- [pi-prompt-templates.md](pi-prompt-templates.md)
- [pi-providers.md](pi-providers.md)
- [pi-quickstart.md](pi-quickstart.md)
- [pi-rpc.md](pi-rpc.md)
- [pi-sdk.md](pi-sdk.md)
- [pi-security.md](pi-security.md)
- [pi-session-format.md](pi-session-format.md)
- [pi-sessions.md](pi-sessions.md)
- [pi-settings.md](pi-settings.md)
- [pi-shell-aliases.md](pi-shell-aliases.md)
- [pi-skills.md](pi-skills.md)
- [pi-terminal-setup.md](pi-terminal-setup.md)
- [pi-termux.md](pi-termux.md)
- [pi-themes.md](pi-themes.md)
- [pi-tmux.md](pi-tmux.md)
- [pi-tui.md](pi-tui.md)
- [pi-usage.md](pi-usage.md)
- [pi-windows.md](pi-windows.md)

### Related API documentation

- [pi-agent-core.md](pi-agent-core.md)
- [pi-ai.md](pi-ai.md)
- [pi-tui-library.md](pi-tui-library.md)

### Example catalogs

- [pi-examples-index.md](pi-examples-index.md)
- [pi-extension-examples-index.md](pi-extension-examples-index.md)
- [pi-sdk-examples-index.md](pi-sdk-examples-index.md)

### Extension example source

- [example-extension-custom-compaction.md](example-extension-custom-compaction.md)
- [example-extension-custom-footer.md](example-extension-custom-footer.md)
- [example-extension-dynamic-tools.md](example-extension-dynamic-tools.md)
- [example-extension-entry-renderer.md](example-extension-entry-renderer.md)
- [example-extension-message-renderer.md](example-extension-message-renderer.md)
- [example-extension-model-status.md](example-extension-model-status.md)
- [example-extension-rpc-demo.md](example-extension-rpc-demo.md)
- [example-extension-send-user-message.md](example-extension-send-user-message.md)
- [example-extension-structured-output.md](example-extension-structured-output.md)
- [example-extension-tool-override.md](example-extension-tool-override.md)
- [example-extension-tools.md](example-extension-tools.md)
- [example-extension-trigger-compact.md](example-extension-trigger-compact.md)

### SDK example source

- [example-sdk-01-minimal.md](example-sdk-01-minimal.md)
- [example-sdk-02-custom-model.md](example-sdk-02-custom-model.md)
- [example-sdk-03-custom-prompt.md](example-sdk-03-custom-prompt.md)
- [example-sdk-04-skills.md](example-sdk-04-skills.md)
- [example-sdk-05-tools.md](example-sdk-05-tools.md)
- [example-sdk-06-extensions.md](example-sdk-06-extensions.md)
- [example-sdk-07-context-files.md](example-sdk-07-context-files.md)
- [example-sdk-08-prompt-templates.md](example-sdk-08-prompt-templates.md)
- [example-sdk-09-api-keys-and-oauth.md](example-sdk-09-api-keys-and-oauth.md)
- [example-sdk-10-settings.md](example-sdk-10-settings.md)
- [example-sdk-11-sessions.md](example-sdk-11-sessions.md)
- [example-sdk-12-full-control.md](example-sdk-12-full-control.md)
- [example-sdk-13-session-runtime.md](example-sdk-13-session-runtime.md)
