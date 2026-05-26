# Progress Log

Last updated: 2026-05-26 Asia/Shanghai

## 2026-05-26

- Reviewed the whole extension for packaging readiness.
- Fixed renderer lifecycle/session safety:
  - active session id guards around async preview work;
  - stale webview messages are ignored;
  - aborted startup closes renderer state;
  - Python startup or DOCX open failure clears active renderer/session state.
- Changed rendering model from whole-document pre-render to on-demand page rendering.
- Added webview request ids so fast navigation cannot let stale page responses overwrite the current page.
- Made refresh and auto-refresh clear cached page images and re-render the requested current page.
- Made Python health check skip ping when another IPC request is pending, avoiding false restarts during long WPS export/render work.
- Switched WPS automation to owned COM instances with `DispatchEx`.
- Opened WPS documents read-only and closed them with `Close(False)`.
- Removed noisy/default bookmark cursor overlays; source cursor is transient and only appears after explicit source-to-preview navigation.
- Removed `DOCX: Toggle Auto-Refresh` command; use `docx.autoRefresh` setting instead.
- Renamed command titles to `DOCX: Go to Preview` and `DOCX: Go to Source`.
- Bumped release target to `0.2.4`.
- Updated `.vscodeignore` so WPS lock files do not enter VSIX packages.
- Added/updated docs:
  - `README.md`
  - `CHANGELOG.md`
  - `DEVELOPMENT.md`
- Performed real visual E2E tests:
  - normal CJK and CJK/English mixed DOCX preview;
  - OMML formulas and embedded image preview;
  - VS Code extension-host screenshots, not only command smoke tests.
- Created this durable disk-based memory system.
- Created and validated a local Codex skill at `C:\Users\Administrator\.codex\skills\update-memory` so saying "更新记忆" triggers normalized disk memory updates.
- Ran another pre-release check, excluded internal `DEVELOPMENT.md`, `MEMORY.md`, and `memory/` files from VSIX output, and verified direct render server IPC for CJK/mixed and formula/image DOCX samples.
- Packaged final `0.2.4` VSIX into `vsix_backups/docx-livepreview-0.2.4.vsix`.
- User updated the VS Code Marketplace listing with version `0.2.4`.
- Committed the `0.2.4` release changes locally.
