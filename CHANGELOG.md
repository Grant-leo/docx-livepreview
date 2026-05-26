# Changelog

All notable changes to DOCX Live Preview are documented in this file.

The format follows the spirit of [Keep a Changelog](https://keepachangelog.com/en/1.0.0/). Versions are aligned with `package.json` and Marketplace releases.

## [Unreleased]

## [0.2.4] - 2026-05-26

### Fixed

- Prevented multiple DOCX preview sessions from sharing renderer state.
- Opened WPS through an owned COM instance and used read-only document open flags.
- Replaced full-document pre-rendering with on-demand page rendering.
- Made source-position cursors transient and removed default all-bookmark cursor overlays.
- Made preview refresh re-render the DOCX and refresh bookmark positions instead of only reloading the webview shell.
- Cleared cached webview page images on command refresh and auto-refresh so non-current pages cannot show stale renders.
- Guarded preview lifecycle, refresh, and webview message handling with active-session checks so old async work cannot update a newly opened renderer.
- Closed renderer state when preview startup is canceled before the webview finishes resolving.
- Cleared active renderer state when Python startup or DOCX open fails.
- Skipped renderer health pings while another Python IPC request is pending, avoiding false restarts during long WPS work.
- Ignored stale page-render responses in the webview after fast page navigation or refresh.
- Hardened startup DOCX recovery when VS Code exposes tabs without `tab.input.uri`, including ambiguous same-basename matches.
- Made startup label recovery skip overly large DOCX scans instead of risking a false unique match.
- Excluded WPS temporary lock files from packaged VSIX output.

### Changed

- Renamed source sync command titles to `DOCX: Go to Preview` and `DOCX: Go to Source`.
- Removed the `DOCX: Toggle Auto-Refresh` command; use the `docx.autoRefresh` setting instead.
- Raised the declared minimum `docx.defaultZoom` to match the viewer clamp at `25`.
- Stopped tracking local Claude settings and ad hoc render test artifacts.
- Excluded internal maintainer and memory files from packaged VSIX output.

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
- Fixed `DOCX: Go to Preview` so it opens or reveals the preview and displays the source cursor.
- Fixed `DOCX: Go to Source` so command-based reverse lookup prefers the nearest visible bookmark instead of blindly using the page center.
- Fixed overly broad build script glob matching.

### Changed

- Added command activation events so source sync commands are available before a custom editor is opened.
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
