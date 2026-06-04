# Decisions

Last updated: 2026-06-04 Asia/Shanghai

## Product Scope

Keep the extension focused on DOCX preview quality. Avoid adding broad editing, AI chat, document generation, or unrelated workflow features unless the user explicitly changes the product direction.

## Preview Model

Maintain one DOCX preview renderer per preview panel.

Rationale:

- Users need to compare at least three DOCX files side by side: text, template, and final output.
- The Python/WPS render server still manages one active WPS document, but each preview panel now owns its own render server.
- Per-panel sessions keep page navigation, zoom, refresh, auto-refresh, and cleanup isolated.
- It matches the user's preference for simplicity.

Tradeoff:

- Multiple simultaneous DOCX previews use more Python/WPS processes and memory.

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

Treat preview zoom as user session state after the first page initializes.

Rationale:

- `docx.defaultZoom` should define the initial view only.
- User-selected zoom is part of the reading session and must survive page navigation, refresh, and delayed page renders.
- Clicking 1:1 is also a user-selected zoom state and should continue until the user changes it again.
- Zoom should update the preview image's layout dimensions, not only apply a CSS transform, so scrollbars reflect the visible page size.

Limit the webview page cache to a small recent-page window.

Rationale:

- Long DOCX files can otherwise accumulate many base64 page images in the webview.
- The preview should stay lightweight even during extended reading sessions.

Add a persistent Fit Width zoom mode.

Rationale:

- Many WPS-rendered DOCX pages are too wide at the image pixel scale.
- Users should not need to manually re-adjust zoom after each page navigation.
- Fit Width is a single focused reading aid, not a broad UI expansion.

Tradeoff:

- Fit Width recomputes zoom when the webview size or page image changes, so the numeric zoom can change between render DPI states while the visual width stays stable.

## Source Sync

Keep source sync optional and unobtrusive.

- Forward/reverse sync depends on `_src_L{line}` bookmarks.
- Missing build scripts or missing mappings should show transient status bar messages only.
- Do not block or obscure the reading surface.
- Compute full bookmark positions only when source-sync commands need them, not during initial preview rendering.
- If multiple build scripts match discovery patterns, do not guess; ask the user to set `docx.sourceScript`.

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

## Development Skills

Use local Codex skills for extension release workflow and lightweight webview UI guidance.

Rationale:

- The plugin should stay minimal and avoid pulling in heavy UI frameworks or release tooling.
- High-quality open-source projects are best used as references and checklists, not copied wholesale into this small extension.
- `vscode-extension-release` captures VSIX, Marketplace, package hygiene, and regression-test habits.
- `minimal-vscode-webview-ui` captures native-feeling, low-dependency webview UI rules.
