# Open Threads

Last updated: 2026-06-04 Asia/Shanghai

## Before Final Release

- Package `0.2.7` after final release checks are accepted.
- Upload the verified `0.2.7` package if the user decides to publish this multi-preview release.
- After Marketplace publishing, install from Marketplace and repeat at least:
  - simple DOCX visual open;
  - three-DOCX side-by-side visual open;
  - CJK/mixed text visual open;
  - formula/image visual open;
  - refresh command.

## Watch List

- `@vscode/test-electron` may emit VS Code host noise such as mutex or background worker import errors. Treat DOCX-specific success markers and process exit code as the plugin test result, but keep an eye on extension host logs.
- Chinese display failures may be caused by a bad test DOCX generation path. Verify test DOCX XML and direct WPS rendering before blaming the extension.
- User-local WPS/font environment remains a real variable. If a user has missing fonts, WPS will apply its own fallback.
- Multiple open DOCX previews now use multiple Python/WPS renderer processes. Watch memory and WPS COM stability when users open many documents beyond the verified 3-preview case.

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
