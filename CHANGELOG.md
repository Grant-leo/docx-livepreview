# Changelog

All notable changes to DOCX Live Preview are documented in this file.

The format follows the spirit of [Keep a Changelog](https://keepachangelog.com/en/1.0.0/). Versions are aligned with `package.json` and Marketplace releases.

## [0.2.3] - 2026-05-26

### Changed

- Replaced non-critical missing sync/build notifications with transient status bar messages.
- Missing build scripts, missing source mappings, and unavailable preview panels no longer block the reading surface.

### Packaging

- Added `vsix_backups/` to `.gitignore`.
- Packaged `docx-livepreview-0.2.3.vsix` and organized historical VSIX files under `vsix_backups/`.

## [0.2.2] - 2026-05-25

### Fixed

- Fixed startup `.docx` handling so files opened from the VS Code command line are restored into `WPS DOCX Preview`.
- Fixed `DOCX: Go to Preview (SyncTeX)` so it opens or reveals the preview and displays the source cursor.
- Fixed `DOCX: Go to Source (SyncTeX)` so command-based reverse lookup prefers the nearest visible bookmark instead of blindly using the page center.
- Fixed overly broad build script glob matching.

### Changed

- Added command activation events so SyncTeX commands are available before a custom editor is opened.
- Added default editor association for `.docx` files.
- Rewrote README documentation and package description.

### Packaging

- Added `.vscodeignore` cleanup so test artifacts and local configuration do not enter published VSIX packages.

## [0.2.1] - 2026-05-25

### Fixed

- Improved WPS lock-file handling by rejecting only basenames that start with `~$`.
- Improved Python/WPS renderer recovery around COM/RPC failures.
- Improved source bookmark cache behavior for `_src_L{line}` mappings.

### Tested

- Verified direct Python render server flow.
- Verified WPS render output through VS Code webview.
- Verified zoom controls and preview-to-source `Ctrl` + click flow.

## [0.2.0] - 2026-05-15

### Added

- Initial Marketplace-ready WPS DOCX preview workflow.
- Custom readonly editor for `.docx` files.
- WPS COM to PDF to PyMuPDF PNG rendering pipeline.
- Page navigation, zoom, refresh, and auto-refresh controls.

## [0.1.0] - 2026-05-14

### Added

- Early local VSIX prototype.
