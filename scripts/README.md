# Diffdump shell command

Add this directory to `PATH`, then define the short aliases in `~/.zshrc`:

```zsh
export PATH="/Users/harish/projects/diffdump/scripts:$PATH"

alias ddc='ddd commit'
alias ddu='ddd uncommitted'
alias ddp='ddd pr'
alias ddb='ddd branch'
```

`ddd` with no arguments is equivalent to `ddd uncommitted`. Run `ddd help`
for the full command reference. Diffdump URLs open automatically when macOS
`open` is available; otherwise, the command prints the URL.
