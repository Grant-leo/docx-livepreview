# DOCX Live Preview

[![VS Code Marketplace](https://img.shields.io/vscode-marketplace/v/docx-chat.docx-livepreview.svg?label=Marketplace)](https://marketplace.visualstudio.com/items?itemName=docx-chat.docx-livepreview)

<p align="center">
  <a href="#english"><strong>English</strong></a> &nbsp;|&nbsp;
  <a href="#chinese"><strong>中文</strong></a>
</p>

---

<a id="english"></a>

WPS-native DOCX preview for VSCode — renders **OMML math equations**, **CJK fonts**, and **three-line tables** pixel-perfect via the WPS COM engine.

## Why

This plugin was built for **[word_chat](https://github.com/Grant-leo/word_chat)** .

**Existing DOCX preview extensions display formatting incorrectly in VSCode.** What you see in VSCode does not match what WPS actually renders — fonts shift, tables misalign, math equations break. You end up constantly switching out of VSCode to verify formatting in WPS.

This plugin solves that by **using WPS itself as the renderer**. Same engine, same output. No more context-switching.

## Prerequisites

- Windows (COM automation requires Windows)
- [WPS Office](https://www.wps.com/) installed
- Python 3.8+ with `pywin32` and `PyMuPDF`:
  ```bash
  pip install pywin32 PyMuPDF
  ```

## Installation

- **VSCode Marketplace:** Search `DOCX Live Preview` in the Extensions panel (`Ctrl+Shift+X`)
- **Manual:** Download `.vsix` from [Releases](https://github.com/Grant-leo/docx-livepreview/releases) → `Ctrl+Shift+P` → `Extensions: Install from VSIX...`

## Usage

1. Open any `.docx` file in VSCode
2. The preview opens automatically with the WPS DOCX Preview editor
3. Or right-click a `.docx` file → **Open With...** → **WPS DOCX Preview**

### Controls

| Action | Shortcut / Button |
|---|---|
| Prev / Next page | ← → arrow keys |
| Zoom in / out | Toolbar buttons or <kbd>Ctrl</kbd> + scroll |
| 100% zoom | `1:1` button in toolbar |
| Custom zoom | Type a value in the zoom input box |
| Refresh | ⟳ button or `Ctrl+Shift+P` → Refresh Preview |
| Toggle auto-refresh | `Ctrl+Shift+P` → Toggle Auto-Refresh |

## Configuration

| Setting | Default | Description |
|---|---|---|
| `docx.defaultZoom` | `100` | Default zoom percentage (10-500) |
| `docx.renderDpi` | `200` | Render DPI — higher is sharper but slower |
| `docx.autoRefresh` | `true` | Auto-refresh preview when file changes |
| `docx.pythonPath` | `python` | Path to Python 3.8+ executable |

## How It Works

WPS Office COM → ExportAsFixedFormat (PDF) → PyMuPDF renders to PNG → webview displays page-by-page. Low-res preview appears in ~50ms, high-res follows immediately.

---

<a id="chinese"></a>

基于 WPS COM 引擎的 DOCX 预览 VSCode 插件，**OMML 数学公式**、**CJK 字体**、**三线表** 像素级还原。

## 为什么需要

本插件为 **[word_chat](https://github.com/Grant-leo/word_chat)** 项目打造。

**现有的 DOCX 预览插件在 VSCode 中的显示效果与 WPS 实际渲染不一致**——字体偏移、表格错位、数学公式变形。你不得不在 VSCode 和 WPS 之间来回切换，严重打断排版效率。

本插件**直接调用 WPS 引擎进行渲染**，同一引擎，同一输出，所见即所得。

## 环境要求

- Windows（COM 自动化仅支持 Windows）
- 安装 [WPS Office](https://www.wps.com/)
- Python 3.8+，需安装 `pywin32` 和 `PyMuPDF`：
  ```bash
  pip install pywin32 PyMuPDF
  ```

## 安装

- **VSCode 扩展商店：** 搜索 `DOCX Live Preview` 直接安装
- **手动安装：** 从 [Releases](https://github.com/Grant-leo/docx-livepreview/releases) 下载 `.vsix` → `Ctrl+Shift+P` → `Extensions: Install from VSIX...`

## 使用

1. 在 VSCode 中打开任意 `.docx` 文件
2. 预览自动以 WPS DOCX Preview 编辑器打开
3. 或右键 `.docx` 文件 → **打开方式...** → **WPS DOCX Preview**

### 操作

| 操作 | 快捷键 / 按钮 |
|---|---|
| 上/下翻页 | ← → 方向键 |
| 缩放 | 工具栏按钮 或 <kbd>Ctrl</kbd> + 滚轮 |
| 100% 缩放 | 工具栏 `1:1` 按钮 |
| 自定义缩放 | 在缩放输入框直接输入数值 |
| 刷新 | ⟳ 按钮 或 `Ctrl+Shift+P` → Refresh Preview |
| 切换自动刷新 | `Ctrl+Shift+P` → Toggle Auto-Refresh |

## 配置

| 设置项 | 默认值 | 说明 |
|---|---|---|
| `docx.defaultZoom` | `100` | 默认缩放百分比 (10-500) |
| `docx.renderDpi` | `200` | 渲染 DPI — 越高越清晰但越慢 |
| `docx.autoRefresh` | `true` | 文件变更时自动刷新预览 |
| `docx.pythonPath` | `python` | Python 3.8+ 可执行文件路径 |

## 工作原理

WPS Office COM → ExportAsFixedFormat (PDF) → PyMuPDF 渲染为 PNG → webview 逐页显示。低清预览约 50ms 首屏可见，高清随即加载。

---

## License

MIT
