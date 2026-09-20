> Source: [Pi v0.85.1 / packages/coding-agent/docs/shell-aliases.md](https://github.com/earendil-works/pi/blob/v0.85.1/packages/coding-agent/docs/shell-aliases.md). Copied from the installed package.

# Shell Aliases

Pi runs bash in non-interactive mode (`bash -c`), which doesn't expand aliases by default.

To enable your shell aliases, add to `~/.pi/agent/settings.json`:

```json
{
  "shellCommandPrefix": "shopt -s expand_aliases\neval \"$(grep '^alias ' ~/.zshrc)\""
}
```

Adjust the path (`~/.zshrc`, `~/.bashrc`, etc.) to match your shell config.
