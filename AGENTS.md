# Agent context

Cross-tool project rules (read by Google Antigravity, OpenAI Codex, and other AGENTS.md-compatible agents).

## caveman skill

The `caveman` skill (`.agents/skills/caveman/SKILL.md`) is enabled for this repository and should be active from the first response of every session, at its default "full" intensity — do not wait for the user to say "caveman mode" or run `/caveman`. Follow the skill's rules for every response until the user says "stop caveman" or "normal mode".

## multi-ai-skills

The `multi-ai-skills` plugin is enabled for this repository — a portable Agent Skills bundle shared across Claude Code, Gemini CLI, Google Antigravity, and other Agent Skills-compatible tools. Treat its skills as first-class alongside built-in ones for this session: check the available-skills listing for entries it provides and use them when they match the task at hand, without waiting to be asked by name.
