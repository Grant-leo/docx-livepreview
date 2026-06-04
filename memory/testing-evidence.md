# Testing Evidence

Last updated: 2026-06-04 Asia/Shanghai

## Command Checks Passed

- `npm run compile`
- `python -m py_compile python\render_server.py python\check_deps.py`
- `python python\check_deps.py`
- `npm audit --omit=dev`
- `git diff --check` passed with CRLF warnings only.
- Webview VM regression passed for saved zoom, 1:1 persistence, stale response rejection, refresh response acceptance, and layout-sized zoom.
- Real VS Code extension-host E2E passed after review fixes:
  - Test DOCX: `e2e_artifacts/zoom_persistence_test_en.docx`
  - Result JSON: `e2e_artifacts/postfix_zoom_layout_e2e_result.json`
  - Screenshots: `e2e_artifacts/postfix_zoom_layout_valid2_01_page1_100.png`, `e2e_artifacts/postfix_zoom_layout_valid2_02_page1_130.png`, `e2e_artifacts/postfix_zoom_layout_valid2_03_page2_130.png`, `e2e_artifacts/postfix_zoom_layout_valid2_04_page2_100_refresh.png`
  - Verified states: page 1 opened at 100%; manual zoom input changed page 1 to 130%; page 2 kept 130%; 1:1 plus refresh kept page 2 at 100%.
- `npx @vscode/vsce ls --no-dependencies`
- `npx @vscode/vsce package --no-dependencies --out %TEMP%\docx-livepreview-0.2.4-prepackage-confirm.vsix`
- `npx @vscode/vsce package --no-dependencies --out %TEMP%\docx-livepreview-0.2.4-prepublish-check.vsix`
- `npx @vscode/vsce package --no-dependencies --out %TEMP%\docx-livepreview-0.2.4-postfix-check.vsix`
- `npx @vscode/vsce package --no-dependencies --out %TEMP%\docx-livepreview-0.2.5-prepackage-current.vsix`
- `npx @vscode/vsce package --no-dependencies --out vsix_backups\docx-livepreview-0.2.4.vsix`
- `npx @vscode/vsce package --no-dependencies --out vsix_backups\docx-livepreview-0.2.5.vsix`
- `npx @vscode/vsce package --no-dependencies --out %TEMP%\docx-livepreview-0.2.5-optimization-check.vsix`
- `npx @vscode/vsce package --no-dependencies --out vsix_backups\docx-livepreview-0.2.6.vsix`
- `npx @vscode/vsce package --no-dependencies --out vsix_backups\docx-livepreview-0.2.7.vsix`
- Installed `vsix_backups\docx-livepreview-0.2.6.vsix` into an isolated VS Code profile and confirmed `docx-chat.docx-livepreview@0.2.6`.
- Installed `vsix_backups\docx-livepreview-0.2.7.vsix` into an isolated VS Code profile and confirmed `docx-chat.docx-livepreview@0.2.7`.
- Direct render server IPC check passed for `e2e_artifacts/visual_cjk_mixed_test.docx`: `open_document`, `render_page`, `get_bookmark_positions`, `close_document`, `shutdown`.
- Direct render server IPC check passed for `e2e_artifacts/visual_formula_image_test_v4.docx`: `open_document`, `render_page`, `close_document`, `shutdown`.
- Frontend VM regression check passed for zoom persistence: 130% survives a `setPage` message that carries the old 100% host zoom; 1:1 reset persists as 100%.
- Direct render server IPC check passed for `e2e_artifacts/zoom_persistence_test.docx`: WPS opened the document, reported `page_count: 2`, and rendered pages 1 and 2.
- Real VS Code extension-host E2E check passed for zoom persistence:
  - Test DOCX: `e2e_artifacts/zoom_persistence_test.docx`
  - Result JSON: `e2e_artifacts/zoom_persistence_e2e_result.json`
  - Screenshot: `e2e_artifacts/zoom_persistence_e2e.png`
  - Verified states: page 1 at 130% after zoom-in; page 2 still at 130% after next-page navigation; page 2 at 100% after 1:1 reset; page 2 still at 100% after refresh.
- Real CJK regression E2E check passed for the current extension code:
  - Test DOCX: `e2e_artifacts/cjk_mixed_regression.docx`
  - Direct render result: `e2e_artifacts/cjk_mixed_direct_render_result.json`
  - Direct WPS-rendered page images: `e2e_artifacts/cjk_mixed_direct_page1.png`, `e2e_artifacts/cjk_mixed_direct_page2.png`
  - VS Code extension-host result: `e2e_artifacts/cjk_vscode_preview_result.json`
  - VS Code extension-host screenshots: `e2e_artifacts/cjk_vscode_preview_page1.png`, `e2e_artifacts/cjk_vscode_preview_page2_after_arrow.png`
  - Verified states: DOCX XML contained the expected Chinese text before rendering; WPS reported `page_count: 2`; page 1 and page 2 rendered readable Chinese and Chinese-English mixed text inside the actual preview webview.
- Frontend VM regression passed for Fit Width:
  - Fit Width computed the viewport-based zoom and persisted `zoomMode: fitWidth`.
  - Page 2 navigation kept Fit Width active.
  - Refresh showed `Refreshing preview...`.
  - `1:1` reset exited Fit Width and persisted manual `100`.
  - Webview state restore with saved Fit Width recomputed the current viewport zoom.
- Real VS Code Extension Host Fit Width E2E passed after dismissing VS Code onboarding:
  - Result JSON: `e2e_artifacts/fitwidth_real_final_result_9464.json`
  - Screenshots: `e2e_artifacts/fitwidth_real_final_9464_01_before_fit.png`, `e2e_artifacts/fitwidth_real_final_9464_02_page1_fit.png`, `e2e_artifacts/fitwidth_real_final_9464_03_page2_fit.png`, `e2e_artifacts/fitwidth_real_final_9464_04_page2_reset100.png`
  - Verified states: page 1 rendered at 100%; Fit Width changed to 66%; page 2 kept Fit Width active at 66%; 1:1 reset returned to manual 100%.
- Installed-VSIX E2E passed for `vsix_backups\docx-livepreview-0.2.6.vsix`:
  - Result JSON: `e2e_artifacts/vsix_0_2_6_e2e_result.json`
  - Screenshots: `e2e_artifacts/vsix_0_2_6_01_before_fit.png`, `e2e_artifacts/vsix_0_2_6_02_page1_fit.png`, `e2e_artifacts/vsix_0_2_6_03_page2_fit.png`
  - Verified states: installed extension rendered a real two-page DOCX through WPS; Fit Width changed to 48%; page 2 kept Fit Width active at 48%.
- Real VS Code Extension Host multi-DOCX E2E passed for current `0.2.7` code:
  - Test DOCX files: `e2e_artifacts/multi_docx_parallel/文本.docx`, `e2e_artifacts/multi_docx_parallel/模版.docx`, `e2e_artifacts/multi_docx_parallel/最终版本.docx`.
  - Result JSON: `e2e_artifacts/multi_docx_parallel/multi_docx_e2e_result_final4.json`.
  - Screenshot: `e2e_artifacts/multi_docx_parallel/multi_docx_three_columns_final4.png`.
  - Verified states: 3 DOCX webviews rendered simultaneously; Fit Width, 130%, and 100% zoom states remained isolated; page navigation and refresh stayed isolated; after closing one preview, two previews remained alive.
- Installed-VSIX multi-DOCX E2E passed for `vsix_backups\docx-livepreview-0.2.7.vsix`:
  - Installed version: `docx-chat.docx-livepreview@0.2.7`.
  - Result JSON: `e2e_artifacts/vsix_0_2_7_multi_e2e_result.json`.
  - Screenshot: `e2e_artifacts/vsix_0_2_7_multi_three_columns.png`.
  - Verified states: installed extension rendered 3 real DOCX webviews simultaneously; Fit Width, 130%, and 100% zoom states remained isolated; page navigation and refresh stayed isolated; after closing one preview, two previews remained alive.

## Final VSIX Artifact

- Path: `E:\career\docx-livepreview\vsix_backups\docx-livepreview-0.2.7.vsix`
- Size: 54733 bytes
- SHA256: `67A7C967B3C7B5262398029A91B32301747C4F8ACDF765B69967A81A33147700`
- `vsce` warning: none for the extension icon after reducing `media/icon.png` to 17.02 KB.
- Package file list was confirmed to contain `extension/package.json` version `0.2.7` and the expected runtime/doc files only.
- The local temporary installed-extension profile, test driver, extension directory, path file, and close/ready control files were removed after the installed-VSIX E2E. The result JSON and screenshot were kept as ignored evidence.

## Marketplace Evidence

- User reported that the VS Code Marketplace listing was updated with `0.2.4` on 2026-05-26.
- The Marketplace publisher management page was opened in Microsoft Edge on 2026-05-27:
  - `https://marketplace.visualstudio.com/manage/publishers/docx-chat`
  - Intended upload package at that time: `E:\career\docx-livepreview\vsix_backups\docx-livepreview-0.2.5.vsix`
- User reported `0.2.5` has been uploaded. The next intended Marketplace upload package is:
  - `E:\career\docx-livepreview\vsix_backups\docx-livepreview-0.2.7.vsix`
- Post-Marketplace install verification is still pending.

## VSIX Package Evidence

The package file list was confirmed to contain only runtime/doc assets:

- `README.md`
- `CHANGELOG.md`
- `LICENSE`
- `package.json`
- `media/*`
- `out/*`
- `python/render_server.py`
- `python/check_deps.py`

It did not contain:

- `~$*.docx`
- test files
- `e2e_artifacts`
- `node_modules`
- `src`
- TypeScript sources
- source maps
- `package-lock.json`
- `DEVELOPMENT.md`
- `MEMORY.md`
- `memory/`

## Visual E2E Evidence

All visual artifacts are under `e2e_artifacts/` and are ignored from VSIX packaging.

### CJK / Mixed Chinese-English

Test DOCX:

- `e2e_artifacts/visual_cjk_mixed_test.docx`

Direct WPS render:

- `e2e_artifacts/cjk_mixed_direct_wps_render.png`

VS Code extension-host screenshot:

- `e2e_artifacts/visual_vscode_cjk_mixed_preview.png`

Result:

- Chinese title rendered correctly.
- Pure Chinese paragraph rendered correctly.
- Mixed Chinese/English paragraph rendered correctly.
- Table Chinese text and punctuation rendered correctly.
- Bottom marker `中文混排显示成功 CJK-MIXED-END-OK` rendered correctly.

### Current CJK Regression

Test DOCX:

- `e2e_artifacts/cjk_mixed_regression.docx`

Direct WPS render:

- `e2e_artifacts/cjk_mixed_direct_page1.png`
- `e2e_artifacts/cjk_mixed_direct_page2.png`

VS Code extension-host screenshots:

- `e2e_artifacts/cjk_vscode_preview_page1.png`
- `e2e_artifacts/cjk_vscode_preview_page2_after_arrow.png`
- Cropped copies for review: `e2e_artifacts/cjk_vscode_preview_page1_crop.png`, `e2e_artifacts/cjk_vscode_preview_page2_after_arrow_crop.png`

Result:

- `word/document.xml` was checked before rendering and contained all expected Chinese strings.
- Page 1 rendered `中文预览确认 - 第一页`, Chinese-English mixed text, Chinese punctuation, and formula-adjacent text correctly.
- Page 2 rendered cross-page Chinese and mixed Chinese-English text correctly after actual preview navigation.

### OMML Formulas + Embedded Image

Test DOCX:

- `e2e_artifacts/visual_formula_image_test_v4.docx`

Direct WPS render:

- `e2e_artifacts/formula_image_v4_direct_wps_render.png`

VS Code extension-host screenshot:

- `e2e_artifacts/visual_vscode_formula_image_preview.png`

Result:

- OMML superscript formula displayed: `E = mc^2`.
- OMML stacked fraction displayed: `F(x) = (x^2 + 1) / (2x + 3)`.
- OMML radical formula displayed.
- Embedded PNG image displayed with blue banner, red circle, green square, and yellow triangle.
- Webview toolbar and page content were visible.

### Multi-DOCX Parallel Preview

Test DOCX files:

- `e2e_artifacts/multi_docx_parallel/文本.docx`
- `e2e_artifacts/multi_docx_parallel/模版.docx`
- `e2e_artifacts/multi_docx_parallel/最终版本.docx`

VS Code Extension Host screenshot:

- `e2e_artifacts/multi_docx_parallel/multi_docx_three_columns_final4.png`

Result:

- Three DOCX previews opened in native VS Code editor groups at the same time.
- Chinese filenames and Chinese/English mixed document content rendered correctly.
- One preview stayed on Fit Width page 2, another stayed at 130%, and the third stayed at 100%.
- Closing one preview left the other two preview webviews alive.

## Important Lesson

Do not trust a test DOCX just because it was generated successfully. Before blaming the preview plugin for Chinese display failures, inspect `word/document.xml` or render through WPS directly. Earlier failed Chinese screenshots were caused by a test DOCX whose text had already been corrupted into question marks by the file-generation path.
