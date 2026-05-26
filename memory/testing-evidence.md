# Testing Evidence

Last updated: 2026-05-26 Asia/Shanghai

## Command Checks Passed

- `npm run compile`
- `python -m py_compile python\render_server.py python\check_deps.py`
- `python python\check_deps.py`
- `npm audit --omit=dev`
- `git diff --check` passed with CRLF warnings only.
- `npx @vscode/vsce ls --no-dependencies`
- `npx @vscode/vsce package --no-dependencies --out %TEMP%\docx-livepreview-0.2.4-prepackage-confirm.vsix`
- `npx @vscode/vsce package --no-dependencies --out %TEMP%\docx-livepreview-0.2.4-prepublish-check.vsix`
- `npx @vscode/vsce package --no-dependencies --out vsix_backups\docx-livepreview-0.2.4.vsix`
- Direct render server IPC check passed for `e2e_artifacts/visual_cjk_mixed_test.docx`: `open_document`, `render_page`, `get_bookmark_positions`, `close_document`, `shutdown`.
- Direct render server IPC check passed for `e2e_artifacts/visual_formula_image_test_v4.docx`: `open_document`, `render_page`, `close_document`, `shutdown`.

## Final VSIX Artifact

- Path: `E:\career\docx-livepreview\vsix_backups\docx-livepreview-0.2.4.vsix`
- Size: 671011 bytes
- SHA256: `DE73AC6E905851C2DE98E0F55A8D17F501BD3713080202EEDADFA6843A5B14F3`
- `vsce` warning: `media/icon.png` is large at 627.38 KB; this is non-blocking.

## Marketplace Evidence

- User reported that the VS Code Marketplace listing was updated with `0.2.4` on 2026-05-26.
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

## Important Lesson

Do not trust a test DOCX just because it was generated successfully. Before blaming the preview plugin for Chinese display failures, inspect `word/document.xml` or render through WPS directly. Earlier failed Chinese screenshots were caused by a test DOCX whose text had already been corrupted into question marks by the file-generation path.
