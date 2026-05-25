# DOCX Live Preview

[![VS Code Marketplace](https://img.shields.io/vscode-marketplace/v/docx-chat.docx-livepreview.svg?label=Marketplace)](https://marketplace.visualstudio.com/items?itemName=docx-chat.docx-livepreview)

WPS-native DOCX preview for VS Code. It renders DOCX pages through the WPS Office COM engine, then displays the exported pages inside a VS Code webview, so OMML equations, CJK fonts, and academic table layout match WPS output closely.

<p align="center">
  <a href="#english"><strong>English</strong></a> &nbsp;|&nbsp;
  <a href="#chinese"><strong>中文</strong></a>
</p>

---

<a id="english"></a>

## Features

- Opens `.docx` files with the WPS DOCX Preview editor by default.
- Renders pages with WPS Office, then displays page images in VS Code.
- Supports page navigation, zoom controls, refresh, and auto-refresh.
- Supports source-to-preview and preview-to-source sync when the DOCX contains `_src_L{line}` bookmarks.
- Ignores WPS lock files such as `~$example.docx`.

## Prerequisites

- Windows. WPS COM automation requires Windows.
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
| `DOCX: Go to Preview (SyncTeX)` | From a source script, open/reveal the DOCX preview and jump to the nearest mapped bookmark. |
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
| Reverse source lookup | `Ctrl` + click on preview text |

## Source Sync

Bidirectional sync works when the DOCX includes bookmarks named `_src_L{line}`, for example `_src_L42`. The extension reads those bookmarks and uses them as source mapping anchors.

- Forward sync: place the cursor in a source file and run `DOCX: Go to Preview (SyncTeX)`.
- Reverse sync: run `DOCX: Go to Source (SyncTeX)` from the preview, or `Ctrl` + click on text in the preview.
- Build script discovery: the extension uses `docx.sourceScript` when configured. Otherwise, it looks beside the DOCX for `build_generated.py`, `*_generated.py`, or `build_*.py`.

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

---

<a id="chinese"></a>

## 功能

- 默认用 `WPS DOCX Preview` 编辑器打开 `.docx` 文件。
- 通过 WPS Office 渲染 DOCX，再在 VS Code webview 中显示页面图像。
- 支持翻页、缩放、刷新和自动刷新。
- 当 DOCX 内包含 `_src_L{line}` 书签时，支持源码到预览、预览到源码的双向同步。
- 自动忽略 WPS 临时锁文件，例如 `~$example.docx`。

## 环境要求

- Windows。WPS COM 自动化依赖 Windows。
- 已安装 [WPS Office](https://www.wps.com/)。
- Python 3.8+，并安装 `pywin32` 和 `PyMuPDF`：

```bash
pip install pywin32 PyMuPDF
```

## 安装

- 扩展市场：在 VS Code 扩展面板中搜索 `DOCX Live Preview`。
- 手动安装：从 [Releases](https://github.com/Grant-leo/docx-livepreview/releases) 下载 `.vsix`，然后运行 `Extensions: Install from VSIX...`。

## 使用

1. 在 VS Code 中打开任意 `.docx` 文件。
2. 文件会自动使用 `WPS DOCX Preview` 打开。
3. 如果被其他编辑器打开，执行 `Reopen Editor With...`，选择 `WPS DOCX Preview`。

## 命令

| 命令 | 说明 |
|---|---|
| `DOCX: Open with WPS Preview` | 用预览编辑器打开当前 `.docx`。 |
| `DOCX: Go to Preview (SyncTeX)` | 从源码脚本跳到 DOCX 预览中的最近映射位置。 |
| `DOCX: Go to Source (SyncTeX)` | 从预览页跳到当前可视区域最近的源码行。 |
| `DOCX: Refresh Preview` | 重新加载当前预览。 |
| `DOCX: Toggle Auto-Refresh` | 开关 DOCX 文件变化后的自动刷新。 |

## 控制

| 操作 | 快捷键 / 按钮 |
|---|---|
| 上一页 / 下一页 | 工具栏按钮或方向键 |
| 放大 / 缩小 | 工具栏按钮或 `Ctrl` + 鼠标滚轮 |
| 重置缩放 | 工具栏 `1:1` 按钮 |
| 自定义缩放 | 在缩放输入框中输入百分比 |
| 预览反向定位源码 | 在预览文字上 `Ctrl` + 点击 |

## 源码同步

双向同步依赖 DOCX 内的 `_src_L{line}` 书签，例如 `_src_L42`。扩展会读取这些书签，并把它们当作源码映射锚点。

- 正向同步：在源码文件中放置光标，执行 `DOCX: Go to Preview (SyncTeX)`。
- 反向同步：在预览中执行 `DOCX: Go to Source (SyncTeX)`，或按住 `Ctrl` 点击预览文字。
- 构建脚本发现：优先使用 `docx.sourceScript` 配置；未配置时，会在 DOCX 同目录查找 `build_generated.py`、`*_generated.py` 或 `build_*.py`。

## 配置

| 设置 | 默认值 | 说明 |
|---|---|---|
| `docx.pythonPath` | `python` | Python 3.8+ 可执行文件路径。 |
| `docx.autoRefresh` | `true` | DOCX 文件变化后自动刷新预览。 |
| `docx.defaultZoom` | `100` | 默认缩放百分比。 |
| `docx.renderDpi` | `200` | 渲染 DPI。越高清越清晰，但速度更慢。 |
| `docx.sourceScript` | `""` | 源码/构建脚本路径，支持 `${workspaceFolder}`。 |

## 工作原理

扩展通过 WPS Office COM 打开 DOCX 并导出 PDF，随后使用 PyMuPDF 将 PDF 页面渲染为 PNG，最后由 VS Code webview 显示页面图像，并基于 DOCX 书签叠加源码定位光标。

## License

MIT
