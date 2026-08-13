#!/bin/bash
set -euo pipefail

cat <<'EOF'
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "The \"multi-ai-skills\" plugin is enabled for this repository — a portable Agent Skills bundle shared across Claude Code, Gemini CLI, Google Antigravity, and other Agent Skills-compatible tools. Treat its skills as first-class alongside built-in ones for this session: check the available-skills listing for entries it provides and use them when they match the task at hand, without waiting to be asked by name."
  }
}
EOF
