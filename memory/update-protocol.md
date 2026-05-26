# Memory Update Protocol

Last updated: 2026-05-26 Asia/Shanghai

## When To Update Memory

Update this memory after:

- a bug is fixed;
- a test outcome materially changes confidence;
- a release/version/package state changes;
- the user gives a durable preference;
- an architectural decision is made;
- a visual E2E artifact is produced;
- a major open question is answered.

If the user says "更新记忆", treat it as an explicit request to run the local `update-memory` skill.

## How To Update

1. Update `memory/project-state.md` if the current release state, architecture, or user preferences changed.
2. Append a dated bullet to `memory/progress-log.md` for completed work.
3. Add concrete artifacts and command outcomes to `memory/testing-evidence.md`.
4. Add or amend `memory/decisions.md` for durable decisions.
5. Move resolved items out of `memory/open-threads.md`.
6. Keep `memory/index.json` aligned with the most important machine-readable facts.

## Style Rules

- Prefer concise factual notes over long transcripts.
- Include exact dates and file paths.
- Mark uncertainty explicitly.
- Do not store secrets, tokens, publisher credentials, or private account information.
- Do not record every command output; record only outcomes and artifacts that matter later.

## Start-of-Session Protocol

Before substantial work in this repository:

1. Read `MEMORY.md`.
2. Read `memory/project-state.md`.
3. Read `memory/open-threads.md`.
4. If doing release/testing work, also read `memory/testing-evidence.md`.
