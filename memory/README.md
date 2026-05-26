# Memory System

Last updated: 2026-05-26 Asia/Shanghai

This directory stores long-term project memory for DOCX Live Preview. Its purpose is to keep important context on disk instead of only inside a chat window.

## Design Principles

- Local-first: memory lives in this repository as Markdown and JSON.
- Human-readable: the canonical state is plain text that can be reviewed in Git.
- Evidence-linked: important claims should point to files, screenshots, test artifacts, or commands.
- Additive by default: append progress and evidence rather than rewriting history.
- Small enough to read: keep high-signal state here, not full command logs.
- Retrieval-friendly: split project state, decisions, tests, and open threads into separate files.

## Influences

- Mem0: separates persistent memories from transient context and emphasizes user/session/agent state.
- Zep: distinguishes recent raw messages from long-term memory context.
- Letta/MemGPT lineage: uses explicit memory blocks and archival memory.
- Local-first Markdown memory projects such as Basic Memory/IWE/Dory: keep files on disk as source of truth.

## Files

- `project-state.md`: current repo status, release target, user priorities, and working assumptions.
- `progress-log.md`: chronological high-level progress.
- `testing-evidence.md`: test matrix and visual proof artifacts.
- `decisions.md`: architectural and product decisions.
- `open-threads.md`: unresolved or watch-list items.
- `update-protocol.md`: how future agents should maintain this memory.
- `index.json`: compact machine-readable state.

