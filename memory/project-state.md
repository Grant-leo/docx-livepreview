# Project State

Last updated: 2026-06-04 Asia/Shanghai

## Product Goal

DOCX Live Preview is a VS Code extension focused on one job: simple, clear, high-fidelity DOCX preview through WPS Office. The user wants the plugin to stay minimal and avoid unrelated features.

## User Preferences

- Language: Chinese for communication.
- Product direction: concise, clean, no bloated feature set.
- Main quality bar: best possible DOCX preview, especially academic documents with Chinese, English, formulas, images, tables, and WPS-like layout.
- Testing preference: real end-to-end and visual confirmation, not only command-level smoke tests.
- Memory preference: durable project memory should live on disk and be updateable by saying "更新记忆".

## Current Release Target

- Current package version: `0.2.7`.
- `package.json`, `package-lock.json`, and `CHANGELOG.md` are aligned to `0.2.7`.
- `0.2.7` adds simultaneous multi-DOCX preview through independent per-panel Python/WPS renderer sessions.
- The last packaged VSIX remains `0.2.6`; package `0.2.7` only after release checks are accepted.
- Final `0.2.6` VSIX package was produced, backed up, installed into an isolated VS Code profile, and tested end to end:
  - `E:\career\docx-livepreview\vsix_backups\docx-livepreview-0.2.6.vsix`
  - Size: `53914` bytes
  - SHA256: `0B5839E81F7CF9DA7350A7E521C7314DD8EB4BE660EDF66E659A8625B33AF73B`
  - Installed version check: `docx-chat.docx-livepreview@0.2.6`
  - Installed-VSIX E2E result: `e2e_artifacts/vsix_0_2_6_e2e_result.json`
- The user updated the Marketplace listing with the `0.2.4` package on 2026-05-26.
- The `0.2.5` Marketplace management page was opened in Microsoft Edge on 2026-05-27 for manual upload.
- The user reported `0.2.5` has been uploaded; `0.2.6` was later committed and pushed.
- Current `0.2.7` multi-DOCX changes are implemented, E2E verified, committed, and pushed; package `0.2.7` only after release checks are accepted.

## Current Architecture

- VS Code extension registers a readonly custom editor: `docx.docxPreview`.
- TypeScript side:
  - `src/extension.ts`: activation, commands, startup tab recovery.
  - `src/docxEditorProvider.ts`: preview lifecycle, per-panel sessions, refresh, source sync.
  - `src/pythonManager.ts`: JSON-line Python process management for each preview renderer.
  - `src/wpsRenderer.ts`: TypeScript wrapper around Python renderer IPC.
  - `media/viewer.js`: webview page display, zoom, navigation, reverse sync messages.
- Python side:
  - `python/render_server.py`: WPS COM open/export, PDF rendering via PyMuPDF, bookmark lookup.
  - `python/check_deps.py`: dependency and WPS availability check.

## Known Behavior

- Multiple DOCX preview panels can stay open at the same time; at least 3 side-by-side previews have been verified.
- Each preview panel owns an independent Python/WPS renderer session, so page navigation, zoom, refresh, and auto-refresh stay isolated.
- Closing one preview panel releases only its own renderer process and does not close the other previews.
- WPS documents are opened through an owned COM instance with read-only flags where possible.
- Documents are closed without saving.
- Unsaved edits in an external WPS window are not visible until saved to disk.
- WPS lock files such as `~$*.docx` are ignored and excluded from VSIX packages.
- Missing build script or source mapping shows a transient status bar message and does not block reading.
- Fit Width zoom is available and persists across page navigation, refresh, and webview state restore.
- If multiple source build scripts match discovery patterns, the extension asks for explicit `docx.sourceScript` instead of guessing.

## Important Working Tree Context

At the time this memory was written, the `0.2.7` multi-DOCX preview changes were ready to commit and push. Ignored E2E artifacts remain under `e2e_artifacts/multi_docx_parallel/`.

Do not revert unrelated dirty state unless the user explicitly asks.

## Local Skills

- `C:\Users\Administrator\.codex\skills\update-memory` is the local Codex skill for normalized disk memory updates.
- Trigger phrases include "更新记忆", "同步记忆", "刷新记忆", "更新 memory", and "update memory".
- The skill updates this repository's `MEMORY.md` and `memory/` files, then validates `memory/index.json` and `git diff --check`.
- `C:\Users\Administrator\.codex\skills\vscode-extension-release` is the local Codex skill for lean VS Code extension release checks, VSIX packaging, Marketplace workflow, and regression verification.
- `C:\Users\Administrator\.codex\skills\minimal-vscode-webview-ui` is the local Codex skill for lightweight VS Code webview UI design and review.
- These skills are guidance-only and do not add runtime dependencies to the DOCX Live Preview extension.
