# DOCX Live Preview

[![VS Code Marketplace](https://img.shields.io/vscode-marketplace/v/docx-chat.docx-livepreview.svg?label=Marketplace)](https://marketplace.visualstudio.com/items?itemName=docx-chat.docx-livepreview)

WPS-native DOCX preview for VS Code. It renders DOCX pages through WPS Office, then displays the rendered pages in a VS Code webview so academic layout, OMML equations, CJK fonts, and tables stay close to real WPS output.

Documentation:

- [CHANGELOG.md](./CHANGELOG.md): user-facing version history.
- [DEVELOPMENT.md](./DEVELOPMENT.md): maintainer notes, testing workflow, release workflow, and design decisions.

## Features

- Opens `.docx` files with `WPS DOCX Preview` by default.
- Uses WPS Office COM automation for faithful document rendering.
- Displays rendered pages in a VS Code custom readonly editor.
- Supports page navigation, zoom controls, refresh, and auto-refresh.
- Supports source-to-preview and preview-to-source sync when the DOCX contains `_src_L{line}` bookmarks.
- Uses transient status bar messages for missing source mappings so the preview surface is not blocked.
- Ignores WPS lock files such as `~$example.docx`.

## Requirements

- Windows. WPS COM automation is Windows-only.
- [WPS Office](https://www.wps.com/) installed.
- Python 3.8+ with `pywin32` and `PyMuPDF`:

```bash
pip install pywin32 PyMuPDF
```

## Installation

- Marketplace: search `DOCX Live Preview` in the VS Code Extensions panel.
- Manual install: download a `.vsix` from [Releases](https://github.com/Grant-leo/docx-livepreview/releases), then run `Extensions: Install from VSIX...`.

## Usage

1. Open any `.docx` file in VS Code.
2. The file should open automatically with `WPS DOCX Preview`.
3. If another editor opens it, run `Reopen Editor With...` and select `WPS DOCX Preview`.

## Commands

| Command | Description |
|---|---|
| `DOCX: Open with WPS Preview` | Open the active `.docx` with the preview editor. |
| `DOCX: Go to Preview (SyncTeX)` | From a source script, open or reveal the DOCX preview and jump to the nearest mapped bookmark. |
| `DOCX: Go to Source (SyncTeX)` | From the preview, jump to the nearest mapped source line on the visible page. |
| `DOCX: Refresh Preview` | Reload the active preview webview. |
| `DOCX: Toggle Auto-Refresh` | Toggle automatic preview refresh when the DOCX changes. |

## Controls

| Action | Shortcut / Button |
|---|---|
| Previous / next page | Toolbar buttons or arrow keys |
| Zoom in / out | Toolbar buttons or `Ctrl` + mouse wheel |
| Reset zoom | `1:1` toolbar button |
| Custom zoom | Type a percentage in the zoom input |
| Reverse source lookup | `Ctrl` + click preview text |

## Source Sync

Bidirectional sync works when the DOCX includes bookmarks named `_src_L{line}`, for example `_src_L42`. The extension reads those bookmarks and uses them as source mapping anchors.

- Forward sync: place the cursor in a source file and run `DOCX: Go to Preview (SyncTeX)`.
- Reverse sync: run `DOCX: Go to Source (SyncTeX)` from the preview, or `Ctrl` + click text in the preview.
- Build script discovery: the extension uses `docx.sourceScript` when configured. Otherwise, it looks beside the DOCX for `build_generated.py`, `*_generated.py`, or `build_*.py`.

If there is no build script or no bookmark mapping, preview still works. The extension shows a short status bar message and keeps the reading surface unobstructed.

## Configuration

| Setting | Default | Description |
|---|---|---|
| `docx.pythonPath` | `python` | Path to the Python 3.8+ executable. |
| `docx.autoRefresh` | `true` | Automatically refresh preview when the DOCX file changes. |
| `docx.defaultZoom` | `100` | Default zoom percentage. |
| `docx.renderDpi` | `200` | Render DPI. Higher is sharper but slower. |
| `docx.sourceScript` | `""` | Path to the source/build script. Supports `${workspaceFolder}`. |

## How It Works

WPS Office COM opens the DOCX and exports it to PDF. PyMuPDF renders PDF pages to PNG images. The VS Code webview displays those images and overlays source mapping cursors from DOCX bookmarks.

## 中文说明

DOCX Live Preview 是一个基于 WPS Office 渲染的 VS Code DOCX 预览插件。它的目标是让 VS Code 中看到的页面尽量接近 WPS 实际排版结果，尤其适合包含公式、中文字体和论文表格的文档。

### 功能

- 默认用 `WPS DOCX Preview` 打开 `.docx` 文件。
- 通过 WPS Office COM 渲染 DOCX，减少排版偏差。
- 支持翻页、缩放、刷新和自动刷新。
- 当 DOCX 内包含 `_src_L{line}` 书签时，支持源码到预览、预览到源码的双向同步。
- 找不到 build 脚本或源码映射时，只在状态栏短暂提示，不遮挡阅读页面。
- 自动忽略 WPS 临时锁文件，例如 `~$example.docx`。

### 使用

1. 在 VS Code 中打开任意 `.docx` 文件。
2. 文件会自动使用 `WPS DOCX Preview` 打开。
3. 如果被其他编辑器打开，执行 `Reopen Editor With...`，选择 `WPS DOCX Preview`。

### 源码同步

双向同步依赖 DOCX 内的 `_src_L{line}` 书签，例如 `_src_L42`。如果没有这些书签，预览功能仍然可用，只是同步跳转不可用。

- 正向同步：在源码文件中放置光标，执行 `DOCX: Go to Preview (SyncTeX)`。
- 反向同步：在预览中执行 `DOCX: Go to Source (SyncTeX)`，或按住 `Ctrl` 点击预览文字。
- 构建脚本发现：优先使用 `docx.sourceScript` 配置；未配置时，会在 DOCX 同目录查找 `build_generated.py`、`*_generated.py` 或 `build_*.py`。

## License

MIT
