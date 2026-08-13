#!/bin/bash
set -euo pipefail

cat <<'EOF'
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "The \"caveman\" skill (.claude/skills/caveman/SKILL.md) is enabled for this repository and should be active from the first response of this session, at its default \"full\" intensity — do not wait for the user to say \"caveman mode\" or run /caveman. Follow the skill's rules for every response until the user says \"stop caveman\" or \"normal mode\"."
  }
}
EOF
