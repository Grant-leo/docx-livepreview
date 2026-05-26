# Decisions

Last updated: 2026-05-26 Asia/Shanghai

## Product Scope

Keep the extension focused on DOCX preview quality. Avoid adding broad editing, AI chat, document generation, or unrelated workflow features unless the user explicitly changes the product direction.

## Preview Model

Maintain one active DOCX preview renderer per VS Code window.

Rationale:

- The Python/WPS render server manages one active WPS document at a time.
- This keeps lifecycle and file-lock behavior understandable.
- It matches the user's preference for simplicity.

Tradeoff:

- True simultaneous multi-DOCX preview would require multiple renderer instances or a more complex queue/session model.

## WPS Interop

Use an owned WPS COM instance via `DispatchEx` when available.

Open documents read-only and close without saving.

Rationale:

- The preview must not take edit ownership from WPS.
- User edits in WPS should remain the source of truth.
- Preview should render the last saved file on disk.

## Rendering Strategy

Render page 1 progressively, then render other pages on demand.

Rationale:

- Avoids full-document pre-render memory and latency cost.
- Better for large academic DOCX files.

## Webview State

Use request ids for page renders and ignore stale responses.

Rationale:

- Fast navigation can otherwise let an older page response overwrite the newest page.

## Source Sync

Keep source sync optional and unobtrusive.

- Forward/reverse sync depends on `_src_L{line}` bookmarks.
- Missing build scripts or missing mappings should show transient status bar messages only.
- Do not block or obscure the reading surface.

## Memory System

Use local Markdown plus a compact JSON index for durable memory.

Rationale:

- Inspired by local-first memory projects.
- Works without external services.
- Easy to review in Git.
- Robust across sessions and agents.

Use a local Codex skill named `update-memory` for explicit memory refreshes.

Rationale:

- The user wants memory updates to happen through a short natural trigger: "更新记忆".
- The skill keeps the update workflow consistent across future sessions.
- The skill is stored outside the repo in the Codex skills directory, while project facts stay inside the repo memory files.
