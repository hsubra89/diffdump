# Diffdump shell command

Install or update `ddd` with:

```zsh
curl -fsSL https://diffdump.com/install | zsh
```

The checksum-verifying installer places `ddd` in `~/.local/bin`, creates
`ddc`, `ddu`, `ddp`, and `ddb` symlinks, and adds that directory to `PATH` in
`~/.zshrc` when necessary. Running the installer again updates the command.

`ddd` with no arguments is equivalent to `ddd uncommitted`. Run `ddd help` for
the full command reference. Diffdump URLs open automatically when macOS `open`
is available; otherwise, the command prints the URL.
