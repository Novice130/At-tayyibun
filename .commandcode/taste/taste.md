# [CommandCode][cmd]
# Workflow
- When context grows large or before clearing the chat, write findings/open-issues to a standalone markdown doc (e.g. docs/open-issues-YYYY-MM-DD.md) so the session can be resumed from the doc. Confidence: 0.85
- Write implementation plans to a markdown file in the project directory (not just in chat), in sufficient detail that another AI can build the full feature correctly from the plan alone. Confidence: 0.70
- On long multi-phase sessions, self-monitor context-window usage and proactively let the user know when approaching ~200k tokens so they can start a fresh session and avoid hallucination. Confidence: 0.70

# Communication
- Prefer terse "caveman"-style responses (short, direct, minimal filler). Confidence: 0.60
