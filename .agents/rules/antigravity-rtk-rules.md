# RTK - Rust Token Killer (Google Antigravity)

**Usage**: Token-optimized CLI proxy for shell commands.

## Rule

Always prefix shell commands with `.\rtk\rtk.exe` (or `./rtk/rtk.exe` depending on shell) to minimize token consumption.

Examples:

```bash
.\rtk\rtk.exe git status
.\rtk\rtk.exe cargo test
.\rtk\rtk.exe ls src/
.\rtk\rtk.exe grep "pattern" src/
.\rtk\rtk.exe find "*.rs" .
.\rtk\rtk.exe docker ps
.\rtk\rtk.exe gh pr list
```

## Meta Commands

```bash
.\rtk\rtk.exe gain              # Show token savings
.\rtk\rtk.exe gain --history    # Command history with savings
.\rtk\rtk.exe discover          # Find missed RTK opportunities
.\rtk\rtk.exe proxy <cmd>       # Run raw (no filtering, for debugging)
```

## Why

RTK filters and compresses command output before it reaches the LLM context, saving 60-90% tokens on common operations. Always use `.\rtk\rtk.exe <cmd>` instead of raw commands.
