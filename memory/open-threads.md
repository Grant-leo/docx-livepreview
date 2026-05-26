# Open Threads

Last updated: 2026-05-26 Asia/Shanghai

## Before Final Release

- Decide whether to push the current `0.2.4` release commit.
- After Marketplace publishing, install from Marketplace and repeat at least:
  - simple DOCX visual open;
  - CJK/mixed text visual open;
  - formula/image visual open;
  - refresh command.

## Watch List

- `@vscode/test-electron` may emit VS Code host noise such as mutex or background worker import errors. Treat DOCX-specific success markers and process exit code as the plugin test result, but keep an eye on extension host logs.
- Chinese display failures may be caused by a bad test DOCX generation path. Verify test DOCX XML and direct WPS rendering before blaming the extension.
- User-local WPS/font environment remains a real variable. If a user has missing fonts, WPS will apply its own fallback.
- Current preview model is one active renderer per VS Code window. True multi-DOCX simultaneous preview is intentionally out of scope for now.

## Potential Future Tests

- More realistic academic DOCX with:
  - multi-page formulas;
  - floating images;
  - large tables;
  - headers/footers;
  - footnotes;
  - landscape sections.
- Install-from-VSIX and install-from-Marketplace visual comparison.
- WPS already-open same-file scenario with saved vs unsaved edits.
