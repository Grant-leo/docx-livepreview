# Progress Log

Last updated: 2026-06-04 Asia/Shanghai

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

## 2026-05-27

- Researched VS Code extension and webview UI references from high-quality GitHub/open-source projects and official VS Code docs.
- Deployed local Codex skills:
  - `vscode-extension-release`
  - `minimal-vscode-webview-ui`
- Chose skill deployment instead of adding UI/runtime dependencies to keep the plugin simple, efficient, and lightweight.
- Fixed preview zoom persistence so user-selected zoom survives page navigation and refresh, and the 1:1 reset becomes the continuing zoom state.
- Ran a real VS Code extension-host E2E test against a two-page DOCX to verify 130% persists to page 2 and restored 100% persists after refresh.
- Ran a focused CJK regression on the current plugin code with a fresh Chinese/English mixed DOCX, checked the DOCX XML before rendering, verified direct WPS page renders, and captured real VS Code extension-host screenshots for page 1 and page 2.
- Fixed follow-up review issues before the next package:
  - auto-refresh now uses `vscode.RelativePattern` plus exact file filtering for Windows path reliability;
  - stale page-render responses are rejected when the user has already navigated elsewhere;
  - zoom now changes real image layout dimensions so scrollbars match the visible page size;
  - webview page-image caching is capped to a small recent-page window;
  - source bookmark position scanning is deferred until source-sync is requested;
  - `@types/vscode` is pinned to `1.85.0` to match the declared VS Code engine.
- Bumped the next release candidate to `0.2.5` because `0.2.4` has already been published to Marketplace.
- Packaged final `0.2.5` VSIX into `vsix_backups/docx-livepreview-0.2.5.vsix`.
- Opened the VS Code Marketplace publisher management page in Microsoft Edge for the user's manual `0.2.5` upload.
- Started a post-package optimization batch:
  - added persistent Fit Width zoom mode;
  - made page render and refresh loading text more specific;
  - compressed `media/icon.png` from about 642 KB to 17 KB;
  - extended renderer request timeouts for larger DOCX files;
  - made multiple build-script discovery require explicit `docx.sourceScript`;
  - made auto-refresh failures show a transient status bar message.
- Produced `%TEMP%\docx-livepreview-0.2.5-optimization-check.vsix` for verification; this means the earlier backed-up final `0.2.5` VSIX should be rebuilt before publishing these newer optimizations.

## 2026-05-28

- User reported that `0.2.5` has been uploaded, so the optimization release target moved to `0.2.6`.
- Bumped package metadata to `0.2.6` and moved the Fit Width/icon/timeouts/build-script/auto-refresh notes into the `0.2.6` changelog section.
- Ran release checks:
  - TypeScript compile passed.
  - Python syntax check passed.
  - WPS/pywin32/PyMuPDF dependency check passed outside the sandbox.
  - `npm audit --omit=dev` passed with 0 vulnerabilities.
  - `git diff --check` passed with CRLF warnings only.
  - `npx @vscode/vsce ls --no-dependencies` showed only runtime/doc files.
- Packaged final `0.2.6` VSIX:
  - `E:\career\docx-livepreview\vsix_backups\docx-livepreview-0.2.6.vsix`
  - Size: `53914` bytes
  - SHA256: `0B5839E81F7CF9DA7350A7E521C7314DD8EB4BE660EDF66E659A8625B33AF73B`
- Installed the packaged VSIX into an isolated VS Code profile and confirmed `docx-chat.docx-livepreview@0.2.6`.
- Ran installed-VSIX E2E against a real two-page DOCX:
  - Result: `e2e_artifacts/vsix_0_2_6_e2e_result.json`
  - Screenshots: `e2e_artifacts/vsix_0_2_6_01_before_fit.png`, `e2e_artifacts/vsix_0_2_6_02_page1_fit.png`, `e2e_artifacts/vsix_0_2_6_03_page2_fit.png`
  - Verified Fit Width persisted after navigating to page 2.

## 2026-06-04

- Implemented simultaneous multi-DOCX preview for version `0.2.7`.
- Refactored preview lifecycle from one active renderer per VS Code window to one independent Python/WPS renderer per preview panel.
- Kept the UI simple: no dedicated comparison view or diff UI; users use VS Code native editor groups for side-by-side comparison.
- Generated three real DOCX files with Chinese filenames and Chinese/English mixed content:
  - `e2e_artifacts/multi_docx_parallel/文本.docx`
  - `e2e_artifacts/multi_docx_parallel/模版.docx`
  - `e2e_artifacts/multi_docx_parallel/最终版本.docx`
- Ran real VS Code Extension Host multi-DOCX E2E:
  - Result: `e2e_artifacts/multi_docx_parallel/multi_docx_e2e_result_final4.json`
  - Screenshot: `e2e_artifacts/multi_docx_parallel/multi_docx_three_columns_final4.png`
  - Verified 3 simultaneous DOCX webviews, isolated zoom states, isolated page navigation/refresh, and two previews surviving after closing one.
- Updated README/CHANGELOG/DEVELOPMENT plus durable memory files for the `0.2.7` multi-DOCX preview release state, then prepared the git commit and push.
- Packaged final `0.2.7` VSIX:
  - `E:\career\docx-livepreview\vsix_backups\docx-livepreview-0.2.7.vsix`
  - Size: `54733` bytes
  - SHA256: `67A7C967B3C7B5262398029A91B32301747C4F8ACDF765B69967A81A33147700`
  - Confirmed package contents exclude `src/`, `memory/`, `e2e_artifacts/`, test DOCX, test screenshots, source maps, and `node_modules`.
- Deleted root-level ignored leftovers `test_document.docx` and `test_render_output.png`; kept ignored `e2e_artifacts/` evidence and XHS materials out of the VSIX.
- Installed `0.2.7` VSIX into an isolated VS Code profile and confirmed `docx-chat.docx-livepreview@0.2.7`.
- Ran installed-VSIX multi-DOCX E2E against three real DOCX files; verified 3 simultaneous previews, isolated Fit Width / 130% / 100% zoom states, isolated page navigation and refresh, and closing one preview left two alive.
  - Result: `e2e_artifacts/vsix_0_2_7_multi_e2e_result.json`
  - Screenshot: `e2e_artifacts/vsix_0_2_7_multi_three_columns.png`
  - Removed the temporary installed-extension profile, test driver, control files, and extension directory after the test.
