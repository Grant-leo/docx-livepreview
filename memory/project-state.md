# Project State

Last updated: 2026-05-26 Asia/Shanghai

## Product Goal

DOCX Live Preview is a VS Code extension focused on one job: simple, clear, high-fidelity DOCX preview through WPS Office. The user wants the plugin to stay minimal and avoid unrelated features.

## User Preferences

- Language: Chinese for communication.
- Product direction: concise, clean, no bloated feature set.
- Main quality bar: best possible DOCX preview, especially academic documents with Chinese, English, formulas, images, tables, and WPS-like layout.
- Testing preference: real end-to-end and visual confirmation, not only command-level smoke tests.
- Memory preference: durable project memory should live on disk and be updateable by saying "更新记忆".

## Current Release Target

- Current package version: `0.2.4`.
- `package.json`, `package-lock.json`, and `CHANGELOG.md` are aligned to `0.2.4`.
- A temporary package was successfully produced at:
  - `C:\Users\Administrator\AppData\Local\Temp\docx-livepreview-0.2.4-prepackage-confirm.vsix`
- Final VSIX package has been produced and backed up at:
  - `E:\career\docx-livepreview\vsix_backups\docx-livepreview-0.2.4.vsix`
- The user updated the Marketplace listing with the `0.2.4` package on 2026-05-26.
- The `0.2.4` release changes have been committed locally. Push status is pending unless a later log says otherwise.

## Current Architecture

- VS Code extension registers a readonly custom editor: `docx.docxPreview`.
- TypeScript side:
  - `src/extension.ts`: activation, commands, startup tab recovery.
  - `src/docxEditorProvider.ts`: preview lifecycle, session guards, refresh, source sync.
  - `src/pythonManager.ts`: JSON-line Python process management.
  - `src/wpsRenderer.ts`: TypeScript wrapper around Python renderer IPC.
  - `media/viewer.js`: webview page display, zoom, navigation, reverse sync messages.
- Python side:
  - `python/render_server.py`: WPS COM open/export, PDF rendering via PyMuPDF, bookmark lookup.
  - `python/check_deps.py`: dependency and WPS availability check.

## Known Behavior

- One active DOCX preview renderer per VS Code window.
- Opening another DOCX preview replaces the active preview session.
- WPS documents are opened through an owned COM instance with read-only flags where possible.
- Documents are closed without saving.
- Unsaved edits in an external WPS window are not visible until saved to disk.
- WPS lock files such as `~$*.docx` are ignored and excluded from VSIX packages.
- Missing build script or source mapping shows a transient status bar message and does not block reading.

## Important Working Tree Context

At the time this memory was written, the tree had many uncommitted changes from the current release cycle, including code, docs, package metadata, `.vscodeignore`, and generated ignored E2E artifacts.

Do not revert unrelated dirty state unless the user explicitly asks.

## Local Skills

- `C:\Users\Administrator\.codex\skills\update-memory` is the local Codex skill for normalized disk memory updates.
- Trigger phrases include "更新记忆", "同步记忆", "刷新记忆", "更新 memory", and "update memory".
- The skill updates this repository's `MEMORY.md` and `memory/` files, then validates `memory/index.json` and `git diff --check`.
