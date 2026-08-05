# Diffdump shell command

Install or update `ddd` with:

```bash
curl -fsSL https://diffdump.com/install | bash
```

The checksum-verifying installer places `ddd` in `~/.local/bin`, creates
`ddc`, `ddu`, `ddp`, and `ddb` symlinks, and adds that directory to `PATH` in
the profile detected from your login shell when necessary. Running the
installer again updates the command. Both scripts support Bash 3.2 and newer.

`ddd` with no arguments is equivalent to `ddd uncommitted`. Run `ddd help` for
the full command reference. Diffdump URLs open automatically when macOS `open`
is available; otherwise, the command prints the URL.
