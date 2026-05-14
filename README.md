# DOCX Live Preview

WPS-native DOCX preview for VSCode — renders **OMML math equations**, **CJK fonts**, and **three-line tables** pixel-perfect via the WPS COM engine.

## Why This Exists / 为什么会有这个插件

This plugin was built specifically for the **[word_chat](https://github.com/Grant-leo/word_chat)** project. The motivation is simple:

**Existing DOCX preview extensions display formatting incorrectly in VSCode.** What you see in VSCode does not match what WPS actually renders — fonts shift, tables misalign, math equations break. This discrepancy forces you to constantly switch out of VSCode to verify formatting in WPS, which kills flow and makes accurate editing nearly impossible.

This plugin solves that by **using WPS itself as the renderer**. Same engine, same output — pixel-perfect fidelity. No more context-switching.

---

本插件专为 **[word_chat](https://github.com/Grant-leo/word_chat)** 项目打造。原因很简单：

**现有的 DOCX 预览插件在 VSCode 中的显示效果与 WPS 实际渲染不一致**——字体偏移、表格错位、数学公式变形。这种差异导致你在 VSCode 中编辑时无法准确判断格式，必须频繁切回 WPS 查看实际效果，严重打断工作流。

本插件**直接调用 WPS 引擎进行渲染**，同一引擎，同一输出——显示与 WPS 完全一致，无需再切来切去。

## Prerequisites

- Windows (COM automation requires Windows)
- [WPS Office](https://www.wps.com/) installed
- Python 3.8+ with `pywin32` and `PyMuPDF`:
  ```bash
  pip install pywin32 PyMuPDF
  ```

## Usage

1. Open any `.docx` file in VSCode
2. The preview opens automatically with the WPS DOCX Preview editor
3. Or right-click a `.docx` file → **Open With...** → **WPS DOCX Preview**

### Controls

| Action | Shortcut / Button |
|---|---|
| Prev / Next page | ← → arrow keys |
| Zoom in / out | Toolbar buttons or <kbd>Ctrl</kbd> + scroll |
| Fit to width | ↔ button in toolbar |
| Refresh | ⟳ button or `Ctrl+Shift+P` → Refresh Preview |
| Toggle auto-refresh | `Ctrl+Shift+P` → Toggle Auto-Refresh |

## Configuration

| Setting | Default | Description |
|---|---|---|
| `docx.defaultZoom` | `100` | Default zoom percentage (10-500) |
| `docx.defaultFit` | `none` | Default fit mode: `none`, `width`, or `page` |
| `docx.renderDpi` | `200` | Render DPI — higher is sharper but slower |
| `docx.autoRefresh` | `true` | Auto-refresh preview when file changes |
| `docx.pythonPath` | `python` | Path to Python 3.8+ executable |

## How It Works

WPS Office COM → ExportAsFixedFormat (PDF) → PyMuPDF renders to PNG → webview displays page-by-page. Low-res preview appears in ~50ms, high-res follows immediately.

## License

MIT
